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
import {
  CLAIM_FREE_BLOCK,
  AUDIENCE_BLOCKS,
  DOMAIN_BLOCKS,
  MARKET_CONTEXT_BLOCKS,
  CONTENT_GOAL_BLOCKS,
  HOOK_ARCHETYPES_BLOCK,
  CONTENT_ARCHETYPES_BLOCK,
  BANNED_SLOP_BLOCK,
  PLATFORM_CRAFT_BLOCKS,
  EXEMPLAR_BLOCKS,
  SELF_EDIT_BLOCK,
  preflightCheck,
} from "../intelligence/marketingIntelligence";
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

function resolveStaffingDomain(industry?: string): string {
  if (!industry) return "GENERAL_STAFFING";
  const lower = industry.toLowerCase();
  if (lower === "it" || lower === "it_staffing") return "IT_STAFFING";
  if (lower === "healthcare" || lower === "healthcare_staffing") return "HEALTHCARE_STAFFING";
  return "GENERAL_STAFFING";
}

function resolvePlatformKey(platform?: string): string {
  if (!platform) return "ARTICLE";
  const upper = platform.toUpperCase();
  if (["ARTICLE", "LINKEDIN", "FACEBOOK", "INSTAGRAM", "X"].includes(upper)) return upper;
  if (upper === "TWITTER") return "X";
  return "ARTICLE";
}

function buildSystemPrompt(template: StudioPromptTemplate, params: AiGenerationParams): string {
  const compliance = getComplianceMode(params.compliance_mode);

  // Intelligence path: activated when contentGoal is provided
  if (params.contentGoal) {
    const pfResult = preflightCheck();
    console.log("[Intelligence v1.5] Preflight check:\n" + pfResult);

    const domainKey = resolveStaffingDomain(params.industry);
    const platformKey = resolvePlatformKey(params.platform);
    const contentGoalKey = params.contentGoal;
    const audienceKey = (!params.audience || params.audience === "AUTO") ? null : params.audience;
    const marketContextKey = params.marketContext ?? "COMMERCIAL";

    const blocks: string[] = [
      // 1. Template base
      template.systemPrompt,
      // 2. Claim-free-by-default (always first in intelligence path)
      CLAIM_FREE_BLOCK,
      // 3. Domain block
      DOMAIN_BLOCKS[domainKey] ?? DOMAIN_BLOCKS.GENERAL_STAFFING,
      // 4. Audience block (infer or use short default)
      audienceKey
        ? (AUDIENCE_BLOCKS[audienceKey] ?? "")
        : "AUDIENCE: Auto-detect from content. Write for the most relevant audience given the topic and domain.",
      // 5. Market context
      MARKET_CONTEXT_BLOCKS[marketContextKey] ?? MARKET_CONTEXT_BLOCKS.COMMERCIAL,
      // 6. Content goal
      CONTENT_GOAL_BLOCKS[contentGoalKey],
      // 7. Hook + content archetypes
      HOOK_ARCHETYPES_BLOCK,
      CONTENT_ARCHETYPES_BLOCK,
      // 8. Banned slop
      BANNED_SLOP_BLOCK,
      // 9. Platform craft
      PLATFORM_CRAFT_BLOCKS[platformKey] ?? PLATFORM_CRAFT_BLOCKS.ARTICLE,
      // 10. Exemplar (quality anchor — reproduce the PATTERN not the wording)
      EXEMPLAR_BLOCKS[contentGoalKey]
        ? `Quality anchor exemplar for this content goal — reproduce the PATTERN not the wording:\n\n${EXEMPLAR_BLOCKS[contentGoalKey]}`
        : "",
      // Compliance block + length/platform limits (before self-edit)
      COMPLIANCE_BLOCKS[compliance.value] ?? COMPLIANCE_BLOCKS.normal,
    ];

    if (template.outputSchemaRef === "social_kit") {
      blocks.push(`Platform limits: ${platformLimitsBlock()}.`);
    }
    if (template.outputSchemaRef === "article_draft") {
      const range = getWordRange(params.content_type);
      blocks.push(`Target body length: ${range.min}-${range.max} words. Use Markdown with ## section headings.`);
    }

    // 11. Self-edit pass — immediately before user-supplied facts
    blocks.push(SELF_EDIT_BLOCK);

    // 12. User-supplied facts (always last)
    if (params.userSuppliedFacts?.trim()) {
      blocks.push(
        `User-supplied facts and claims (use as provided, preserve qualifiers, do not strengthen or expand): ${params.userSuppliedFacts.trim()}`
      );
    }

    return blocks.filter(Boolean).join("\n\n");
  }

  // Standard path (no contentGoal) — unchanged for backward compat
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

// ---------------------------------------------------------------------------
// Studio BD Agent (Task #942) — chat completion + template generation.
// bd_text templates use generic JSON-object structured output since each
// template has a bespoke shape; the schema is declared per contentType below.
// ---------------------------------------------------------------------------

// Per-template JSON schemas for bd_text output.
const BD_JSON_SCHEMAS: Record<string, any> = {
  bd_proposal_outline: {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string" },
      executive_summary: { type: "string" },
      client_pain_points: { type: "array", items: { type: "string" } },
      our_approach: { type: "string" },
      engagement_model_notes: { type: "string" },
      value_propositions: { type: "array", items: { type: "string" } },
      next_steps: { type: "array", items: { type: "string" } },
      customization_notes: { type: "string" },
    },
    required: ["title", "executive_summary", "client_pain_points", "our_approach", "engagement_model_notes", "value_propositions", "next_steps", "customization_notes"],
  },
  bd_rate_card_talking_points: {
    type: "object",
    additionalProperties: false,
    properties: {
      key_messages: { type: "array", items: { type: "string" } },
      value_framing: { type: "string" },
      objection_responses: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            objection: { type: "string" },
            response: { type: "string" },
          },
          required: ["objection", "response"],
        },
      },
      closing_line: { type: "string" },
    },
    required: ["key_messages", "value_framing", "objection_responses", "closing_line"],
  },
  bd_call_prep_brief: {
    type: "object",
    additionalProperties: false,
    properties: {
      call_objective: { type: "string" },
      company_context: { type: "string" },
      discovery_questions: { type: "array", items: { type: "string" } },
      likely_objections: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            objection: { type: "string" },
            response: { type: "string" },
          },
          required: ["objection", "response"],
        },
      },
      positioning_angles: { type: "array", items: { type: "string" } },
      suggested_call_flow: { type: "array", items: { type: "string" } },
      follow_up_note: { type: "string" },
    },
    required: ["call_objective", "company_context", "discovery_questions", "likely_objections", "positioning_angles", "suggested_call_flow", "follow_up_note"],
  },
  bd_follow_up_sequence: {
    type: "object",
    additionalProperties: false,
    properties: {
      sequence_summary: { type: "string" },
      touches: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            step: { type: "integer" },
            channel: { type: "string" },
            timing_note: { type: "string" },
            subject_or_hook: { type: "string" },
            body: { type: "string" },
            purpose: { type: "string" },
          },
          required: ["step", "channel", "timing_note", "subject_or_hook", "body", "purpose"],
        },
      },
    },
    required: ["sequence_summary", "touches"],
  },
};

export interface BdTemplateResult {
  output: Record<string, any>;
  contentType: string;
  model: string;
  tokenEstimate: number;
}

export async function generateBdTemplate(
  template: StudioPromptTemplate,
  params: Record<string, any>,
  brandVoiceContext?: string,
): Promise<BdTemplateResult> {
  const schema = BD_JSON_SCHEMAS[template.contentType];
  if (!schema) {
    throw new AiGenerationError("upstream", `No BD schema found for contentType: ${template.contentType}`, false);
  }
  const effectiveTemplate = brandVoiceContext
    ? { ...template, systemPrompt: template.systemPrompt + "\n\nBRAND VOICE CONTEXT:\n" + brandVoiceContext }
    : template;
  const { raw, model, tokenEstimate } = await callStructured(
    effectiveTemplate,
    params as AiGenerationParams,
    schema,
    template.contentType,
  );
  if (!raw || typeof raw !== "object") {
    throw new AiGenerationError("validation", "BD template output was not a valid object.", false);
  }
  return { output: raw, contentType: template.contentType, model, tokenEstimate };
}

// BD Agent chat — conversational multi-turn completion (not structured output).
const BD_AGENT_SYSTEM_PROMPT = `You are a Business Development expert and strategic advisor for Hire'in Solutions, an AI-powered staffing agency.

ABOUT HIRE'IN SOLUTIONS:
- Serves Healthcare, IT, Engineering, and Professional Services
- Proof points: 95% first-year retention rate, 24-hour first candidate submissions
- Multi-domain staffing capability with AI-enhanced matching
- Engagement models: Contract, Contract-to-Hire, Permanent placement

YOUR ROLE:
You help BD reps and HR professionals with:
- Research angles for prospecting into new accounts
- Discovery call preparation and objection handling
- Proposal framing and value communication
- Follow-up strategies and nurture sequences
- Domain-specific BD tactics (Healthcare, IT, Engineering, Professional Services)
- Outreach copy and messaging refinement

GUARDRAILS:
- NEVER invent specific client names, named case studies, or statistics not provided
- NEVER make placement guarantees or compliance guarantees
- NEVER suggest sending automated messages; all copy is for human manual use
- When asked to draft copy, produce it ready-to-edit, not ready-to-send
- Acknowledge when advice requires verification (legal, compliance, or local market)
- Keep advice practical and actionable, not generic platitudes

VOICE: Professional, warm, and direct — like a senior colleague who has seen hundreds of BD cycles and gives honest, useful counsel.`;

export interface BdChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface BdChatResult {
  reply: string;
  model: string;
  tokenEstimate: number;
}

export async function runBdAgentChat(
  messages: BdChatMessage[],
  brandVoiceContext?: string,
): Promise<BdChatResult> {
  const model = TIER_MODELS.standard;
  const systemPrompt = brandVoiceContext
    ? BD_AGENT_SYSTEM_PROMPT + "\n\nBRAND VOICE CONTEXT:\n" + brandVoiceContext
    : BD_AGENT_SYSTEM_PROMPT;
  try {
    const completion = await openai.chat.completions.create({
      model,
      max_completion_tokens: 2000,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    });
    const reply = completion.choices?.[0]?.message?.content ?? "";
    if (!reply) throw new AiGenerationError("malformed", "BD agent returned no content.");
    return {
      reply,
      model,
      tokenEstimate: completion.usage?.total_tokens ?? 0,
    };
  } catch (err: any) {
    if (err instanceof AiGenerationError) throw err;
    console.error("[BD agent chat] AI error:", err?.message);
    throw new AiGenerationError("upstream", "BD agent AI error — check server logs.");
  }
}
