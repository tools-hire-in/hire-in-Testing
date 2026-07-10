// Content Studio — AI draft + Social Kit generation service.
//
// Uses the Replit AI Integrations OpenAI-compatible endpoint with enforced
// Structured Outputs (response_format bound to a JSON Schema) so the model is
// *constrained* to the canonical shape. Output is validated and mapped into the
// single canonical internal shape before it is ever returned or stored.

import OpenAI from "openai";
import pRetry, { AbortError } from "p-retry";
import {
  ARTICLE_DRAFT_JSON_SCHEMA,
  SOCIAL_KIT_JSON_SCHEMA,
  QUALITY_REVIEW_JSON_SCHEMA,
  mapToCanonicalArticleDraft,
  mapToCanonicalSocialKit,
  qualityReviewSchema,
  validateCaptionLengths,
  getComplianceMode,
  getIndustryModifier,
  getWordRange,
  COMPLIANCE_BLOCKS,
  PLATFORM_LIMITS,
  DEFAULT_BRAND,
  type AiGenerationParams,
  type CanonicalArticleDraft,
  type CanonicalSocialKit,
  type QualityReview,
} from "@shared/studioAi";
import { resolveCardLayout } from "@shared/socialCards";
import type { StudioPromptTemplate } from "@shared/schema";

// ---------------------------------------------------------------------------
// Client — OpenAI-compatible Replit AI Integrations endpoint (billed to credits,
// no own key required).
// ---------------------------------------------------------------------------
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// Model tier -> concrete model. Templates carry their own modelName; tier is the
// fallback / override knob used for cost discipline.
const TIER_MODELS: Record<string, string> = {
  economy: "gpt-5-mini",
  standard: "gpt-5.4",
  strong: "gpt-5.4",
};

export function resolveModel(template: Pick<StudioPromptTemplate, "modelName" | "modelTier">): string {
  if (template.modelName && template.modelName.trim()) return template.modelName.trim();
  return TIER_MODELS[template.modelTier] ?? TIER_MODELS.standard;
}

// ---------------------------------------------------------------------------
// Typed error so the route layer can surface a retry button and never overwrite
// existing content on failure.
// ---------------------------------------------------------------------------
export class AiGenerationError extends Error {
  code: "rate_limit" | "timeout" | "malformed" | "upstream" | "validation";
  retryable: boolean;
  constructor(
    code: AiGenerationError["code"],
    message: string,
    retryable = true,
  ) {
    super(message);
    this.name = "AiGenerationError";
    this.code = code;
    this.retryable = retryable;
  }
}

// ---------------------------------------------------------------------------
// Prompt rendering — substitute {{param}} placeholders + append guardrail
// blocks (industry modifier, compliance block, platform/word limits).
// ---------------------------------------------------------------------------
function renderTemplate(tpl: string, params: Record<string, any>): string {
  return tpl.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => {
    const v = params[key];
    if (v === undefined || v === null) return "";
    return String(v);
  });
}

function platformLimitsBlock(): string {
  return [
    `LinkedIn ${PLATFORM_LIMITS.linkedin.min}-${PLATFORM_LIMITS.linkedin.max} chars`,
    `Instagram ${PLATFORM_LIMITS.instagram.min}-${PLATFORM_LIMITS.instagram.max} chars`,
    `Facebook ${PLATFORM_LIMITS.facebook.min}-${PLATFORM_LIMITS.facebook.max} chars`,
    `X under ${PLATFORM_LIMITS.twitter.max} chars`,
    `Story frames ${PLATFORM_LIMITS.story.minWords}-${PLATFORM_LIMITS.story.maxWords} words each`,
  ].join("; ");
}

function buildSystemPrompt(template: StudioPromptTemplate, params: AiGenerationParams): string {
  const compliance = getComplianceMode(params.compliance_mode);
  const blocks: string[] = [template.systemPrompt];
  const industry = getIndustryModifier(params.industry);
  if (industry) blocks.push(industry);
  blocks.push(COMPLIANCE_BLOCKS[compliance.value] ?? COMPLIANCE_BLOCKS.normal);
  if (template.outputSchemaRef === "social_kit") {
    blocks.push(`Platform limits: ${platformLimitsBlock()}.`);
  }
  if (template.outputSchemaRef === "article_draft") {
    const range = getWordRange(params.content_type);
    blocks.push(`Target body length: ${range.min}-${range.max} words. Use Markdown with ## section headings.`);
  }
  return blocks.filter(Boolean).join("\n\n");
}

function fullParams(params: AiGenerationParams): Record<string, any> {
  return {
    brand_name: DEFAULT_BRAND.brand_name,
    brand_tagline: DEFAULT_BRAND.brand_tagline,
    brand_voice: DEFAULT_BRAND.brand_voice,
    ...params,
  };
}

// ---------------------------------------------------------------------------
// Core call — enforced JSON Schema structured output with bounded retries.
// ---------------------------------------------------------------------------
interface RawCallResult {
  raw: any;
  model: string;
  tokenEstimate: number;
}

async function callStructured(
  template: StudioPromptTemplate,
  params: AiGenerationParams,
  jsonSchema: any,
  schemaName: string,
): Promise<RawCallResult> {
  const model = resolveModel(template);
  const merged = fullParams(params);
  const systemPrompt = buildSystemPrompt(template, params);
  const userPrompt = renderTemplate(template.userPromptTemplate, merged);

  const run = async (): Promise<RawCallResult> => {
    try {
      let completion: Awaited<ReturnType<typeof openai.chat.completions.create>>;
      try {
        completion = await openai.chat.completions.create({
          model,
          max_completion_tokens: template.maxTokens ?? 4000,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: schemaName,
              strict: true,
              schema: jsonSchema,
            },
          },
        });
      } catch (sdkErr: any) {
        // Log the raw SDK error (which may contain minified identifiers) so
        // engineers can see the real cause in server logs, then re-throw with
        // a clean user-facing message.
        console.error("OpenAI SDK raw error:", sdkErr?.message, sdkErr?.stack);
        throw new AiGenerationError("upstream", "AI provider error — check server logs.");
      }

      const choice = completion.choices?.[0];
      const content = choice?.message?.content;
      if (!content) {
        throw new AiGenerationError("malformed", "Model returned no content.");
      }
      let parsed: any;
      try {
        parsed = JSON.parse(content);
      } catch {
        throw new AiGenerationError("malformed", "Model returned invalid JSON.", false);
      }
      return {
        raw: parsed,
        model,
        tokenEstimate: completion.usage?.total_tokens ?? 0,
      };
    } catch (err: any) {
      if (err instanceof AiGenerationError) {
        // Don't retry non-retryable malformed output.
        if (!err.retryable) throw new AbortError(err);
        throw err;
      }
      const status = err?.status ?? err?.response?.status;
      if (status === 429) {
        throw new AiGenerationError("rate_limit", "AI provider rate limit hit. Try again shortly.");
      }
      if (status === 400) {
        throw new AbortError(new AiGenerationError("upstream", "Bad request to AI provider.", false));
      }
      throw new AiGenerationError("upstream", "AI provider request failed.");
    }
  };

  try {
    return await pRetry(run, { retries: 2, minTimeout: 800, maxTimeout: 3000 });
  } catch (err: any) {
    if (err instanceof AiGenerationError) throw err;
    if (err?.name === "AbortError" && err?.message) {
      throw new AiGenerationError("upstream", err.message, false);
    }
    throw new AiGenerationError("upstream", err?.message || "AI generation failed.");
  }
}

// ---------------------------------------------------------------------------
// Public API.
// ---------------------------------------------------------------------------
export interface ArticleGenerationResult {
  draft: CanonicalArticleDraft;
  model: string;
  tokenEstimate: number;
  rawOutput: any;
}

export async function generateArticleDraft(
  template: StudioPromptTemplate,
  params: AiGenerationParams,
): Promise<ArticleGenerationResult> {
  const { raw, model, tokenEstimate } = await callStructured(
    template,
    params,
    ARTICLE_DRAFT_JSON_SCHEMA,
    "article_draft",
  );
  let draft: CanonicalArticleDraft;
  try {
    draft = mapToCanonicalArticleDraft(raw);
  } catch (e: any) {
    throw new AiGenerationError("validation", `Article output failed validation: ${e?.message}`, false);
  }
  return { draft, model, tokenEstimate, rawOutput: raw };
}

export interface SocialKitGenerationResult {
  kit: CanonicalSocialKit;
  warnings: string[];
  model: string;
  tokenEstimate: number;
  rawOutput: any;
}

export async function generateSocialKit(
  template: StudioPromptTemplate,
  params: AiGenerationParams,
): Promise<SocialKitGenerationResult> {
  const { raw, model, tokenEstimate } = await callStructured(
    template,
    params,
    SOCIAL_KIT_JSON_SCHEMA,
    "social_kit",
  );
  let kit: CanonicalSocialKit;
  try {
    kit = mapToCanonicalSocialKit(raw, { platform: params.platform });
  } catch (e: any) {
    throw new AiGenerationError("validation", `Social kit output failed validation: ${e?.message}`, false);
  }

  // If the caller supplied a content_type, resolve its canonical card layout and
  // override what the model suggested. This ensures that e.g. a checklist_card
  // article always gets suggested_card_layout="checklist" regardless of the
  // model's free-form output.
  if (params.content_type) {
    const inferredLayout = resolveCardLayout(params.content_type);
    if (inferredLayout !== "standard" || kit.suggested_card_layout === "standard") {
      kit = { ...kit, suggested_card_layout: inferredLayout };
    }
  }

  const warnings = validateCaptionLengths(kit);
  return { kit, warnings, model, tokenEstimate, rawOutput: raw };
}

// ---------------------------------------------------------------------------
// Gated quality-reviewer pass — runs only when compliance_mode !== normal.
// ---------------------------------------------------------------------------
export async function runQualityReview(
  template: StudioPromptTemplate,
  params: AiGenerationParams,
  generatedContent: unknown,
): Promise<QualityReview> {
  const enriched: AiGenerationParams = {
    ...params,
    article_body: typeof generatedContent === "string" ? generatedContent : JSON.stringify(generatedContent),
  };
  const { raw } = await callStructured(template, enriched, QUALITY_REVIEW_JSON_SCHEMA, "quality_review");
  try {
    return qualityReviewSchema.parse(raw);
  } catch (e: any) {
    throw new AiGenerationError("validation", `Quality review output failed validation: ${e?.message}`, false);
  }
}

// ---------------------------------------------------------------------------
// Release Notes generator — turns raw git commit messages into polished,
// user-friendly release notes in JSON format.
// ---------------------------------------------------------------------------
const RELEASE_NOTES_JSON_SCHEMA = {
  type: "object",
  properties: {
    version: { type: "string" },
    title: { type: "string" },
    body: { type: "string" },
  },
  required: ["version", "title", "body"],
  additionalProperties: false,
};

export interface ReleaseNotesResult {
  version: string;
  title: string;
  body: string;
}

export async function generateReleaseNotes(
  changelogInput: string,
  mode: "release" | "digest" = "release",
): Promise<ReleaseNotesResult> {
  const today = new Date();
  const dateStr = `v${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, "0")}`;

  // Internal communication & security policy applied to BOTH modes.
  const SECURITY_POLICY = `INTERNAL COMMUNICATION & SECURITY POLICY (must always follow):
- Audience is non-technical employees. Write in warm, plain English about what people can now DO — benefits, not implementation.
- NEVER include secrets, credentials, tokens, API keys, environment variable names, URLs, database details, or any sensitive configuration.
- NEVER include file names, file paths, function names, table/column names, commit hashes, PR/ticket numbers, branch names, or internal jargon.
- NEVER reveal security vulnerabilities, exploits, or how a flaw could be abused. Describe security/reliability fixes only in reassuring, high-level terms ("we made sign-in more secure").
- Skip purely internal or trivial changes (dependency bumps, refactors, typos, build tooling).
- Do not invent features that aren't supported by the input. If the input is thin, keep it short and honest.`;

  let systemPrompt: string;
  let userPrompt: string;

  if (mode === "digest") {
    systemPrompt = `You are a warm, professional communications writer for Hire'in Solutions, an AI-powered staffing and talent acquisition firm.
Your job is to turn roughly a month of changes into a SINGLE consolidated "what's new this past month" digest for employees.
${SECURITY_POLICY}
DIGEST FORMAT:
- This is a concise, benefit-led highlights reel — NOT an exhaustive changelog. Do not overwhelm the reader.
- Organize by theme using these buckets where relevant: Attendance, Leave, Letters & Documents, Performance, Onboarding, Communications, and a final "Other improvements" catch-all.
- Lead with the biggest, most useful headline features first; group smaller changes together briefly.
- Aim for about 8–15 highlights total. Use short theme headings (e.g. a line like "Attendance") followed by 1–3 bullet points each.
- Keep each bullet to one warm, plain-English sentence focused on the benefit.
- Title should make clear this is a monthly catch-up (max 8 words).
- Infer a version string like "${dateStr}" from today's date.`;
    userPrompt = `Here are the changes from roughly the past month:\n\n${changelogInput || "(no changes provided)"}\n\nPlease produce one consolidated, themed, benefit-led monthly digest from these.`;
  } else {
    systemPrompt = `You are a warm, professional communications writer for Hire'in Solutions, an AI-powered staffing and talent acquisition firm.
Your job is to turn a list of recent changes into polished, user-friendly release notes.
${SECURITY_POLICY}
RELEASE NOTE FORMAT:
- Group related changes together where sensible.
- Translate technical descriptions into plain-English benefits ("Fixed the attendance punch-in bug" → "Attendance is now more reliable — punch-ins save correctly every time").
- Infer a version string like "${dateStr}" from today's date if the input doesn't suggest one.
- Keep the title punchy (max 8 words).
- Body should be 2–5 short paragraphs or a short bulleted list.`;
    userPrompt = `Here are the recent changes since the last release:\n\n${changelogInput || "(no changes provided)"}\n\nPlease generate polished release notes from these.`;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: TIER_MODELS.standard,
      max_completion_tokens: 1200,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "release_notes",
          strict: true,
          schema: RELEASE_NOTES_JSON_SCHEMA,
        },
      },
    });

    const content = completion.choices?.[0]?.message?.content;
    if (!content) throw new AiGenerationError("malformed", "Model returned no content.");

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new AiGenerationError("malformed", "Model returned invalid JSON.", false);
    }

    return {
      version: String(parsed.version || dateStr),
      title: String(parsed.title || "Platform Update"),
      body: String(parsed.body || ""),
    };
  } catch (err: any) {
    if (err instanceof AiGenerationError) throw err;
    console.error("[generateReleaseNotes] AI error:", err?.message);
    throw new AiGenerationError("upstream", "AI provider error generating release notes.");
  }
}

// ---------------------------------------------------------------------------
// Studio T2 (Task #907) — campaign planner, repurpose-to-ideas, and copy-only
// outreach sequence generators. All propose; none publish or send.
// ---------------------------------------------------------------------------
const CAMPAIGN_PLAN_JSON_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          topic: { type: "string" },
          angle: { type: "string" },
          content_type: { type: "string", enum: ["article", "social_post", "story"] },
          channels: { type: "array", items: { type: "string" } },
          pillar: { type: "string" },
          suggested_week: { type: "integer" },
          cta: { type: "string" },
        },
        required: ["topic", "angle", "content_type", "channels", "pillar", "suggested_week", "cta"],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "items"],
  additionalProperties: false,
};

export interface CampaignPlanItem {
  topic: string;
  angle: string;
  content_type: "article" | "social_post" | "story";
  channels: string[];
  pillar: string;
  suggested_week: number;
  cta: string;
}

export interface CampaignPlanResult {
  summary: string;
  items: CampaignPlanItem[];
  model: string;
  tokenEstimate: number;
  rawOutput: any;
}

export async function generateCampaignPlan(
  template: StudioPromptTemplate,
  params: AiGenerationParams,
): Promise<CampaignPlanResult> {
  const { raw, model, tokenEstimate } = await callStructured(
    template,
    params,
    CAMPAIGN_PLAN_JSON_SCHEMA,
    "campaign_plan",
  );
  if (!raw || !Array.isArray(raw.items) || !raw.items.length) {
    throw new AiGenerationError("validation", "Campaign plan output had no items.", false);
  }
  return {
    summary: String(raw.summary || ""),
    items: raw.items as CampaignPlanItem[],
    model,
    tokenEstimate,
    rawOutput: raw,
  };
}

const REPURPOSE_IDEAS_JSON_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          topic: { type: "string" },
          angle: { type: "string" },
          content_type: { type: "string", enum: ["social_post", "story"] },
          channels: { type: "array", items: { type: "string" } },
          hook: { type: "string" },
        },
        required: ["topic", "angle", "content_type", "channels", "hook"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
};

export interface RepurposeIdeaItem {
  topic: string;
  angle: string;
  content_type: "social_post" | "story";
  channels: string[];
  hook: string;
}

export interface RepurposeIdeasResult {
  items: RepurposeIdeaItem[];
  model: string;
  tokenEstimate: number;
  rawOutput: any;
}

export async function generateRepurposeIdeas(
  template: StudioPromptTemplate,
  params: AiGenerationParams,
): Promise<RepurposeIdeasResult> {
  const { raw, model, tokenEstimate } = await callStructured(
    template,
    params,
    REPURPOSE_IDEAS_JSON_SCHEMA,
    "repurpose_ideas",
  );
  if (!raw || !Array.isArray(raw.items) || !raw.items.length) {
    throw new AiGenerationError("validation", "Repurpose output had no items.", false);
  }
  return { items: raw.items as RepurposeIdeaItem[], model, tokenEstimate, rawOutput: raw };
}

const OUTREACH_SEQUENCE_JSON_SCHEMA = {
  type: "object",
  properties: {
    steps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          order: { type: "integer" },
          subject_or_hook: { type: "string" },
          body: { type: "string" },
          notes: { type: "string" },
        },
        required: ["order", "subject_or_hook", "body", "notes"],
        additionalProperties: false,
      },
    },
  },
  required: ["steps"],
  additionalProperties: false,
};

export interface OutreachSequenceResult {
  steps: { order: number; subjectOrHook: string; body: string; notes: string }[];
  model: string;
  tokenEstimate: number;
  rawOutput: any;
}

export async function generateOutreachSequence(
  template: StudioPromptTemplate,
  params: AiGenerationParams,
): Promise<OutreachSequenceResult> {
  const { raw, model, tokenEstimate } = await callStructured(
    template,
    params,
    OUTREACH_SEQUENCE_JSON_SCHEMA,
    "outreach_sequence",
  );
  if (!raw || !Array.isArray(raw.steps) || !raw.steps.length) {
    throw new AiGenerationError("validation", "Outreach output had no steps.", false);
  }
  const steps = raw.steps
    .map((s: any) => ({
      order: Number(s.order) || 0,
      subjectOrHook: String(s.subject_or_hook || ""),
      body: String(s.body || ""),
      notes: String(s.notes || ""),
    }))
    .sort((a: any, b: any) => a.order - b.order);
  return { steps, model, tokenEstimate, rawOutput: raw };
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.AI_INTEGRATIONS_OPENAI_API_KEY && process.env.AI_INTEGRATIONS_OPENAI_BASE_URL);
}
