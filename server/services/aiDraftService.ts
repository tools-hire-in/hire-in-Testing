// Content Studio — AI draft + Social Kit generation service.
//
// Uses the Replit AI Integrations OpenAI-compatible endpoint with enforced
// Structured Outputs (response_format bound to a JSON Schema) so the model is
// *constrained* to the canonical shape. Output is validated and mapped into the
// single canonical internal shape before it is ever returned or stored.

import OpenAI from "openai";
// NOTE: p-retry v5+ is ESM-only and crashes esbuild's CommonJS bundling output
// (the default export resolves to undefined, producing the minified error
// "(0 , Xv.default) is not a function"). We inline a minimal retry helper instead.
class AbortError extends Error {
  readonly originalError: Error;
  constructor(error: Error | string) {
    const msg = typeof error === "string" ? error : error.message;
    super(msg);
    this.name = "AbortError";
    this.originalError = typeof error === "string" ? new Error(error) : error;
  }
}

async function pRetry<T>(
  fn: () => Promise<T>,
  opts: { retries: number; minTimeout: number; maxTimeout: number },
): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      if (err instanceof AbortError) {
        // Non-retryable — surface the wrapped error immediately.
        throw err.originalError ?? err;
      }
      lastError = err;
      if (attempt < opts.retries) {
        const delay = Math.min(
          opts.minTimeout * Math.pow(2, attempt),
          opts.maxTimeout,
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}
import {
  ARTICLE_DRAFT_JSON_SCHEMA,
  SOCIAL_KIT_JSON_SCHEMA,
  QUALITY_REVIEW_JSON_SCHEMA,
  INSIGHTS_PLANNING_JSON_SCHEMA,
  insightsPlanningOutputSchema,
  isInsightsContentType,
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
  type InsightsBriefInput,
  type InsightsPlanningOutput,
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
  TONE_BLOCKS,
  preflightCheck,
  selectExemplar,
  INSIGHTS_EDITORIAL_IDENTITY_BLOCK,
  INSIGHTS_PRIMARY_READER_BLOCK,
  INSIGHTS_PLANNING_SCAN_BLOCK,
  INSIGHTS_LENS_INCLUSION_BLOCK,
  INSIGHTS_EPISTEMIC_DISCIPLINE_BLOCK,
  INSIGHTS_LENGTH_BLOCK,
  INSIGHTS_HUMAN_AUTHENTICITY_BLOCK,
  FLAGSHIP_INSIGHT_MODULE,
  FIELD_SIGNAL_MODULE,
  DECISION_GUIDE_MODULE,
  RESEARCH_BRIEF_MODULE,
  TOOL_TECH_WATCH_MODULE,
  SCENARIO_ANALYSIS_MODULE,
  EDITORIAL_PERSPECTIVE_MODULE,
  MONTHLY_BRIEF_MODULE,
} from "../intelligence/marketingIntelligence";
import { resolveCardLayout } from "@shared/socialCards";
import type { StudioPromptTemplate } from "@shared/schema";
import { db } from "../db";
import { sql as drizzleSql } from "drizzle-orm";

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
export const TIER_MODELS: Record<string, string> = {
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
  if (lower === "government" || lower === "gov" || lower === "govt") return "GOVERNMENT";
  if (lower.includes("gov")) return "GOVERNMENT";
  return "GENERAL_STAFFING";
}

function resolvePlatformKey(platform?: string): string {
  if (!platform) return "ARTICLE";
  const upper = platform.toUpperCase();
  if (["ARTICLE", "LINKEDIN", "FACEBOOK", "INSTAGRAM", "X"].includes(upper)) return upper;
  if (upper === "TWITTER") return "X";
  return "ARTICLE";
}

// ---------------------------------------------------------------------------
// Psychological Contract Block (Task #1060)
// ---------------------------------------------------------------------------
const HOOK_PATTERN_DESCRIPTIONS: Record<string, string> = {
  curiosity_gap: "Curiosity Gap — name the hidden cause of a familiar pain to create a specific open question the reader cannot ignore. The hook earns its place by making the reader say 'I need to know why.'",
  loss_aversion: "Loss Aversion — expose a specific, costed error the reader is probably making right now. Make the consequence real and imminent, not abstract.",
  insider_contrast: "Insider Contrast — show what operators do versus what amateurs do. Reveal the gap without lecturing. The contrast must be concrete enough that the reader recognises which side they're on.",
  unasked_question: "Unasked Question — surface the question the reader should be asking but isn't. The hook works because recognising the gap is itself the insight.",
  counter_intuitive_number: "Counter-intuitive Number — use a pattern-from-experience observation that surprises. Frame it explicitly as pattern-from-experience, never as an invented stat. The surprise must be supportable.",
  reader_inner_monologue: "Reader's Inner Monologue — say what they're privately thinking. Validate before you instruct. The reader should feel seen, not sold to.",
  stakes_flip: "Stakes Flip — reframe who actually bears the risk. The reader realises the cost lands on them, not the vendor or agency. Make the transfer of stakes undeniable.",
  specific_scene: "Specific Scene — drop the reader into a concrete moment. Make it so specific (day, action, silence, detail) that they can place themselves in it immediately.",
};

const CONTENT_STRUCTURE_EXECUTION: Record<string, string> = {
  rule_of_three: `Rule of Three structure:
Open with the hook. Build exactly three parallel proof points of equal weight — each one is a standalone truth that reinforces the single takeaway. The three points must not repeat each other; they triangulate the argument from different angles. Close with a CTA that mirrors the opening emotion, not a generic 'let me know your thoughts.'`,
  pas: `PAS (Problem → Agitate → Solution) structure:
Name the problem clearly and specifically in the first section — no warm-up. Agitate: make the pain visceral by raising the real stakes, naming the exact cost (time, money, trust, opportunity), and showing why the usual fix fails. Solution: resolve with a concrete mechanism, not a vague improvement. The solution section must be shorter than the agitation section.`,
  the_reveal: `The Reveal (Setup → Tension → Payoff) structure:
Open in a scene — place the reader in a specific moment, not a generalisation. Build tension by showing what is at stake and what the reader doesn't yet understand. The payoff must answer the tension directly with something the reader did not see coming. Avoid explaining the payoff — let it land.`,
  contrast: `Contrast (Before / After) structure:
Show the wrong way first, in enough detail that the reader recognises it. Then show the right way with the same level of specificity. The contrast must be concrete enough that the reader can identify which version they currently live in. Do not editorialize between the two halves — let the contrast speak.`,
  the_framework: `The Framework structure:
Name the concept with a short, memorable label. Explain its mechanics — how it works, not just what it is called. Show it applied in a real or realistic situation with named actors, concrete stakes, and a clear outcome. End with the single implication for the reader's practice.`,
  listicle: `Listicle structure:
Number the items. Each item is a complete, standalone truth — it must make sense if the reader screenshots just that item. No filler sentences between items. Save the most memorable or surprising item for last. The list title must promise a specific number and deliver it exactly.`,
};

function resolveInsightsContentTypeModule(contentType: string): string {
  switch (contentType) {
    case "FLAGSHIP_INSIGHT": return FLAGSHIP_INSIGHT_MODULE;
    case "FIELD_SIGNAL": return FIELD_SIGNAL_MODULE;
    case "DECISION_GUIDE": return DECISION_GUIDE_MODULE;
    case "RESEARCH_BRIEF": return RESEARCH_BRIEF_MODULE;
    case "TOOL_TECH_WATCH": return TOOL_TECH_WATCH_MODULE;
    case "SCENARIO_ANALYSIS": return SCENARIO_ANALYSIS_MODULE;
    case "EDITORIAL_PERSPECTIVE": return EDITORIAL_PERSPECTIVE_MODULE;
    case "MONTHLY_INTELLIGENCE_BRIEF": return MONTHLY_BRIEF_MODULE;
    default: return FLAGSHIP_INSIGHT_MODULE;
  }
}

function buildPsychologicalContractBlock(params: AiGenerationParams): string {
  const { desiredEmotion, hookPattern, contentStructure, engagementGoal } = params;
  if (!desiredEmotion && !hookPattern && !contentStructure && !engagementGoal) return "";

  const hookDesc = hookPattern ? (HOOK_PATTERN_DESCRIPTIONS[hookPattern] ?? hookPattern) : null;
  const structureDesc = contentStructure ? (CONTENT_STRUCTURE_EXECUTION[contentStructure] ?? contentStructure) : null;

  const lines: string[] = ["PSYCHOLOGICAL CONTRACT"];
  if (desiredEmotion) lines.push(`Desired opening emotion: ${desiredEmotion} — the first 3 seconds of reading must trigger this feeling.`);
  if (hookDesc) lines.push(`Hook pattern: ${hookDesc}`);
  if (structureDesc) lines.push(`Body structure:\n${structureDesc}`);
  if (engagementGoal) lines.push(`Engagement goal: ${engagementGoal} — close with a single, natural prompt designed to produce this action. No generic 'let me know your thoughts.'`);

  lines.push(`\nExecution rules:
- Write the opening line to trigger the desired emotion using the specified hook pattern.
- Build the body using the specified content structure architecture — do not deviate or blend structures.
- Close with a single, natural prompt designed to produce the engagement goal.
- Every section must serve the psychological contract above. Cut anything that doesn't.`);

  return lines.join("\n");
}

function buildSystemPrompt(template: StudioPromptTemplate, params: AiGenerationParams): string {
  const compliance = getComplianceMode(params.compliance_mode);

  // Insights Editorial path — for Call 3 (article generation) when content_type is an Insights type.
  // Injects the editorial identity + content-type module instead of the standard intelligence blocks.
  // Psychological Contract fields are suppressed for Insights articles.
  if (isInsightsContentType(params.content_type)) {
    const contentTypeModule = resolveInsightsContentTypeModule(params.content_type);
    const range = getWordRange(params.content_type);
    const blocks: string[] = [
      INSIGHTS_EDITORIAL_IDENTITY_BLOCK,
      contentTypeModule,
      INSIGHTS_PRIMARY_READER_BLOCK,
      INSIGHTS_PLANNING_SCAN_BLOCK,
      INSIGHTS_LENS_INCLUSION_BLOCK,
      INSIGHTS_EPISTEMIC_DISCIPLINE_BLOCK,
      INSIGHTS_LENGTH_BLOCK,
      INSIGHTS_HUMAN_AUTHENTICITY_BLOCK,
      BANNED_SLOP_BLOCK,
      CLAIM_FREE_BLOCK,
      SELF_EDIT_BLOCK,
    ];
    // Primary reader discipline — inject approved planning context when available.
    // Populated from Gate A insightsPlanning via the social-cascade or direct article gen params.
    const planningContextLines: string[] = [];
    if (params.audience?.trim()) {
      planningContextLines.push(`Primary reader: ${params.audience.trim()}`);
    }
    if (params.marketContext?.trim()) {
      // marketContext encodes: mode | whyNow | publishLenses (pipe-separated from social cascade)
      planningContextLines.push(`Editorial context: ${params.marketContext.trim()}`);
    }
    if (planningContextLines.length > 0) {
      blocks.push(
        `PRIMARY READER DISCIPLINE\n${planningContextLines.join("\n")}\nWrite exclusively to serve this reader's decision-making context. Every section must address their primary question or be cut.`
      );
    }
    if (params.userSuppliedFacts?.trim()) {
      blocks.push(
        `User-supplied facts and claims (use as provided, preserve qualifiers, do not strengthen or expand): ${params.userSuppliedFacts.trim()}`
      );
    }
    if (params.pastPerformanceSignal?.trim()) {
      blocks.push(
        `PAST PERFORMANCE SIGNAL (use as additional context to guide tone and structure — do not quote these metrics in the content):\n${params.pastPerformanceSignal.trim()}`
      );
    }
    return blocks.filter(Boolean).join("\n\n");
  }

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
      // 4b. Tone direction (injected when tone is explicitly provided)
      params.tone ? (TONE_BLOCKS[params.tone] ?? "") : "",
      // 5. Market context
      MARKET_CONTEXT_BLOCKS[marketContextKey] ?? MARKET_CONTEXT_BLOCKS.COMMERCIAL,
      // 6. Content goal
      CONTENT_GOAL_BLOCKS[contentGoalKey],
      // 7. Hook + content archetypes
      HOOK_ARCHETYPES_BLOCK,
      CONTENT_ARCHETYPES_BLOCK,
      // 8. Banned slop
      BANNED_SLOP_BLOCK,
      // 9. Exemplar (quality anchor — composite lookup: goal+domain+audience first, goal-only fallback)
      (() => {
        const ex = selectExemplar(contentGoalKey, audienceKey ?? undefined, domainKey);
        return ex ? `Quality anchor exemplar — reproduce the PATTERN not the wording:\n\n${ex}` : "";
      })(),
      // 9b. Selected hook from brief resolution (CMO Copilot v2.1)
      params.selectedHookText
        ? [
            `SELECTED HOOK (chosen by the content author — open the piece with this exact hook, then develop the piece):`,
            `"${params.selectedHookText}"`,
            params.selectedHookArchetype ? `Hook archetype: ${params.selectedHookArchetype}` : "",
            params.selectedContentStructure ? `Recommended content structure: ${params.selectedContentStructure}` : "",
          ].filter(Boolean).join("\n")
        : "",
      // 10. Psychological Contract (Task #1060) — placed just before platform craft so
      // the craft rules apply on top of the author's chosen brief. Takes precedence over
      // generic hook guidance when provided.
      buildPsychologicalContractBlock(params),
      // 11. Platform craft
      PLATFORM_CRAFT_BLOCKS[platformKey] ?? PLATFORM_CRAFT_BLOCKS.ARTICLE,
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

    // Self-edit pass — immediately before user-supplied facts
    blocks.push(SELF_EDIT_BLOCK);

    // 12. User-supplied facts (always last before performance signal)
    if (params.userSuppliedFacts?.trim()) {
      blocks.push(
        `User-supplied facts and claims (use as provided, preserve qualifiers, do not strengthen or expand): ${params.userSuppliedFacts.trim()}`
      );
    }

    // 13. Past Performance Signal (additive context — appended last so it does not override content rules)
    if (params.pastPerformanceSignal?.trim()) {
      blocks.push(
        `PAST PERFORMANCE SIGNAL (use as additional context to guide tone and structure — do not quote these metrics in the content):\n${params.pastPerformanceSignal.trim()}`
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
    // RC-2: explicit snake_case alias so {{user_supplied_facts}} renders in templates
    user_supplied_facts: params.userSuppliedFacts ?? "",
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
// Insights Editorial Layer — Call 1: Editorial Strategy brief generation.
// Returns InsightsPlanningOutput (brief + stakeholder scan + outline).
// Called automatically on article creation when content_type is an Insights type.
// ---------------------------------------------------------------------------

export interface InsightsBriefResult {
  planning: InsightsPlanningOutput;
  model: string;
  tokenEstimate: number;
}

export async function generateInsightsBrief(input: InsightsBriefInput): Promise<InsightsBriefResult> {
  const contentTypeModule = resolveInsightsContentTypeModule(input.contentType);

  const systemPrompt = [
    INSIGHTS_EDITORIAL_IDENTITY_BLOCK,
    INSIGHTS_PRIMARY_READER_BLOCK,
    INSIGHTS_PLANNING_SCAN_BLOCK,
    INSIGHTS_LENS_INCLUSION_BLOCK,
    INSIGHTS_EPISTEMIC_DISCIPLINE_BLOCK,
    INSIGHTS_LENGTH_BLOCK,
    INSIGHTS_HUMAN_AUTHENTICITY_BLOCK,
    BANNED_SLOP_BLOCK,
    CLAIM_FREE_BLOCK,
    contentTypeModule,
  ].join("\n\n");

  const userPrompt = [
    `CALL 1 PLANNING REQUEST`,
    `Content Type: ${input.contentType}`,
    `Primary Reader: ${input.primaryReader}`,
    `Primary Reader Question / Topic: ${input.primaryReaderQuestion}`,
    `Why Now (timing context): ${input.whyNow || "Not specified"}`,
    input.mode ? `Preferred Mode: ${input.mode}` : "",
    ``,
    `Please produce the structured planning output for this Insights article, including:`,
    `1. A full editorial brief`,
    `2. A stakeholder scan across all three groups`,
    `3. 3-6 research questions the author must answer before writing`,
    `4. A 3-6 section outline recommendation`,
    `5. A planning decision: PROCEED, REVISE_BRIEF, or REJECT_GENERIC`,
  ].filter(Boolean).join("\n");

  const model = TIER_MODELS.strong;

  const completion = await openai.chat.completions.create({
    model,
    max_completion_tokens: 3000,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "insights_planning",
        strict: true,
        schema: INSIGHTS_PLANNING_JSON_SCHEMA,
      },
    },
  });

  const content = completion.choices?.[0]?.message?.content;
  if (!content) throw new AiGenerationError("malformed", "Insights brief generation returned no content.");

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new AiGenerationError("malformed", "Insights brief generation returned invalid JSON.", true);
  }

  let planning: InsightsPlanningOutput;
  try {
    planning = insightsPlanningOutputSchema.parse(parsed);
  } catch (e: any) {
    // Validation failure is retryable — the model may produce a valid response on retry.
    throw new AiGenerationError("validation", `Insights planning output failed validation: ${e?.message}`, true);
  }

  return {
    planning,
    model,
    tokenEstimate: completion.usage?.total_tokens ?? 0,
  };
}

// Retry wrapper for generateInsightsBrief — retries once on retryable failures
// (JSON parse error, Zod validation failure) before surfacing the error to the caller.
// Spec: single retry (2 total attempts) to bound token cost predictably.
export async function generateInsightsBriefWithRetry(input: InsightsBriefInput): Promise<InsightsBriefResult> {
  return pRetry(
    async () => {
      try {
        return await generateInsightsBrief(input);
      } catch (e: any) {
        if (e instanceof AiGenerationError && !e.retryable) throw new AbortError(e);
        throw e;
      }
    },
    {
      retries: 1,
      minTimeout: 800,
      factor: 2,
      onFailedAttempt: (err) => {
        console.warn(`[insights-call1] Attempt ${err.attemptNumber} failed: ${err.message}. ${err.retriesLeft} retries left.`);
      },
    },
  );
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
// Topic Suggestions (Task #1440) — lightweight call; no retry needed.
// ---------------------------------------------------------------------------
export interface TopicSuggestion {
  title: string;
  angle: string;
}

const INSIGHTS_MODULE_MAP: Record<string, string> = {
  FLAGSHIP_INSIGHT: FLAGSHIP_INSIGHT_MODULE,
  FIELD_SIGNAL: FIELD_SIGNAL_MODULE,
  DECISION_GUIDE: DECISION_GUIDE_MODULE,
  RESEARCH_BRIEF: RESEARCH_BRIEF_MODULE,
  TOOL_TECH_WATCH: TOOL_TECH_WATCH_MODULE,
  SCENARIO_ANALYSIS: SCENARIO_ANALYSIS_MODULE,
  EDITORIAL_PERSPECTIVE: EDITORIAL_PERSPECTIVE_MODULE,
  MONTHLY_INTELLIGENCE_BRIEF: MONTHLY_BRIEF_MODULE,
};

const TOPIC_SUGGESTIONS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          angle: { type: "string" },
        },
        required: ["title", "angle"],
      },
    },
  },
  required: ["suggestions"],
} as const;

export async function generateTopicSuggestions(params: {
  contentType: string;
  primaryReader?: string;
  audience?: string;
  platform?: string;
  contentGoal?: string;
}): Promise<TopicSuggestion[]> {
  const isInsights = isInsightsContentType(params.contentType);

  let systemPrompt: string;
  let userPrompt: string;

  if (isInsights) {
    const ctModule = INSIGHTS_MODULE_MAP[params.contentType] ?? INSIGHTS_MODULE_MAP.FLAGSHIP_INSIGHT;
    const readerLabel = params.primaryReader || "Staffing/MSP Operator";
    const formattedType = params.contentType.replace(/_/g, " ");
    systemPrompt = [
      INSIGHTS_EDITORIAL_IDENTITY_BLOCK,
      INSIGHTS_PRIMARY_READER_BLOCK,
      ctModule,
      CLAIM_FREE_BLOCK,
    ].join("\n\n---\n\n");
    userPrompt = `You are generating topic ideas for an Insights editorial article.

Content type: ${formattedType}
Primary reader: ${readerLabel}

Generate exactly 6 topic ideas that are sharp, specific, and directly relevant to the ${readerLabel} persona. Each idea must:
- Frame a concrete question or tension this specific reader is actually facing right now
- Be grounded in workforce, staffing, or talent market dynamics — not generic business advice
- Suit the ${formattedType} format (word count and structure)
- Have a one-sentence angle that names the specific editorial lens or mechanism the article will use

Return as JSON matching the schema.`;
  } else {
    const audienceKey = (params.audience ?? "EMPLOYER_CLIENT").toUpperCase();
    const audienceBlock = AUDIENCE_BLOCKS[audienceKey] ?? AUDIENCE_BLOCKS.EMPLOYER_CLIENT;
    const goalKey = (params.contentGoal ?? "THOUGHT_LEADERSHIP").toUpperCase();
    const goalBlock = CONTENT_GOAL_BLOCKS[goalKey] ?? CONTENT_GOAL_BLOCKS.THOUGHT_LEADERSHIP;
    const domainBlock = DOMAIN_BLOCKS.GENERAL_STAFFING;
    const goalLabel = goalKey.toLowerCase().replace(/_/g, " ");

    systemPrompt = [
      audienceBlock,
      goalBlock,
      domainBlock,
      BANNED_SLOP_BLOCK,
      CLAIM_FREE_BLOCK,
    ].join("\n\n---\n\n");
    const platformContext = params.platform && params.platform !== "ARTICLE"
      ? `\nPlatform: ${params.platform.replace(/_/g, " ").toLowerCase()} — topics should fit the norms and reader expectations of this channel.`
      : "";
    userPrompt = `Generate exactly 6 topic ideas for a ${goalLabel} article targeting the above audience.${platformContext}

Each topic must be:
- Specific and actionable — not a vague headline
- Grounded in real staffing domain mechanics, not generic business advice
- Ready to hand to a content writer as a clear brief starting point
- Have a one-sentence angle that names the specific editorial lens or mechanism

Return as JSON matching the schema.`;
  }

  const response = await openai.chat.completions.create({
    model: TIER_MODELS.economy,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "topic_suggestions",
        strict: true,
        schema: TOPIC_SUGGESTIONS_JSON_SCHEMA,
      },
    } as any,
    max_completion_tokens: 1200,
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AiGenerationError("malformed", "AI returned invalid JSON for topic suggestions", false);
  }

  const list = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
  return list
    .map((s: any) => ({ title: String(s.title ?? "").trim(), angle: String(s.angle ?? "").trim() }))
    .filter((s: TopicSuggestion) => s.title && s.angle);
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

// ── BD Agent — Grounded Intelligence Engine ──────────────────────────────────
// Implements the 7-component "secret sauce" architecture:
//   1. Buyer Decision Model   2. Fit Scoring Framework   3. Buyer Stage Model
//   4. Domain Ontology        5. Claim Discipline         6. Storyline Model
//   7. Next-Best-Action Model
//
// Every response is grounded in master deck slides loaded from the DB before
// the AI call, not from the model's training data alone.
// ─────────────────────────────────────────────────────────────────────────────

export type BdAgentMode =
  | "account_discovery"
  | "opportunity_qualification"
  | "meeting_preparation"
  | "deck_collaboration"
  | "positioning_objection"
  | "executive_brief"
  | "follow_up_drafting"
  | "general";

export const BD_MODE_META: Record<BdAgentMode, { label: string; icon: string }> = {
  account_discovery:       { label: "Account Discovery",            icon: "🔍" },
  opportunity_qualification:{ label: "Opportunity Qualification",   icon: "📊" },
  meeting_preparation:     { label: "Meeting Preparation",          icon: "📋" },
  deck_collaboration:      { label: "Deck Collaboration",           icon: "🃏" },
  positioning_objection:   { label: "Positioning & Objection",      icon: "🎯" },
  executive_brief:         { label: "Executive Brief",              icon: "📝" },
  follow_up_drafting:      { label: "Follow-Up Draft",              icon: "✏️" },
  general:                 { label: "General",                      icon: "💬" },
};

// ── Intent classification ─────────────────────────────────────────────────────

async function classifyBdIntent(lastUserMessage: string): Promise<BdAgentMode> {
  try {
    const completion = await openai.chat.completions.create({
      model: TIER_MODELS.economy,
      max_completion_tokens: 20,
      messages: [
        {
          role: "system",
          content: `Classify the BD message into exactly one of these modes (reply with the mode key only, no punctuation):
account_discovery | opportunity_qualification | meeting_preparation | deck_collaboration | positioning_objection | executive_brief | follow_up_drafting | general

Rules:
- account_discovery: researching a company, understanding the buyer, org research
- opportunity_qualification: should we pursue this? fit scoring, go/no-go, deal assessment
- meeting_preparation: call prep, agenda, questions before a meeting
- deck_collaboration: building, editing, reviewing a pitch deck or presentation
- positioning_objection: handling objections, differentiation, how to position vs competitor
- executive_brief: summarize the account/deal for leadership, exec update
- follow_up_drafting: write a follow-up email, LinkedIn message, nurture copy
- general: anything else`,
        },
        { role: "user", content: lastUserMessage.slice(0, 500) },
      ],
    });
    const raw = (completion.choices?.[0]?.message?.content ?? "").trim().toLowerCase() as BdAgentMode;
    return Object.keys(BD_MODE_META).includes(raw) ? raw : "general";
  } catch {
    return "general";
  }
}

// ── Master deck context loader ────────────────────────────────────────────────

interface BdSlideRaw { title: string; bullets?: string[]; speaker_notes?: string; }

async function loadMasterDeckContext(domain: string | null | undefined): Promise<string> {
  try {
    const validDomains = ["healthcare", "it", "engineering", "professional_services", "general"];
    const targetDomain = domain && validDomains.includes(domain) ? domain : null;

    // Load up to 2 master decks — the domain-specific one + general (if different)
    let rows: any[] = [];
    if (targetDomain && targetDomain !== "general") {
      const r1 = await db.execute(drizzleSql`
        SELECT title, domain, slides FROM bd_decks
        WHERE deck_type = 'master' AND status IN ('active', 'approved') AND domain = ${targetDomain}
        ORDER BY updated_at DESC LIMIT 1`);
      const r2 = await db.execute(drizzleSql`
        SELECT title, domain, slides FROM bd_decks
        WHERE deck_type = 'master' AND status IN ('active', 'approved') AND domain = 'general'
        ORDER BY updated_at DESC LIMIT 1`);
      rows = [...r1.rows, ...r2.rows];
    } else {
      const r = await db.execute(drizzleSql`
        SELECT title, domain, slides FROM bd_decks
        WHERE deck_type = 'master' AND status IN ('active', 'approved')
        ORDER BY domain ASC, updated_at DESC LIMIT 3`);
      rows = r.rows;
    }

    if (rows.length === 0) return "";

    const CHAR_BUDGET = 4000;
    let context = "── APPROVED MASTER DECK KNOWLEDGE ──\n";
    let budget = CHAR_BUDGET;

    for (const deck of rows) {
      const slides: BdSlideRaw[] = Array.isArray(deck.slides) ? deck.slides : [];
      if (slides.length === 0) continue;
      const domainLabel = (deck.domain as string).replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
      const header = `\nDeck: ${deck.title} [${domainLabel}]\n`;
      if (budget < header.length) break;
      context += header;
      budget -= header.length;

      for (let i = 0; i < slides.length; i++) {
        const s = slides[i];
        const bullets = (s.bullets ?? []).map((b: string) => `  • ${b}`).join("\n");
        const chunk = `Slide ${i + 1}: ${s.title}\n${bullets}\n`;
        if (budget < chunk.length) break;
        context += chunk;
        budget -= chunk.length;
      }
    }

    return context === "── APPROVED MASTER DECK KNOWLEDGE ──\n" ? "" : context;
  } catch (err) {
    console.error("[BD agent] deck context load error:", err);
    return "";
  }
}

// ── System prompt builder ─────────────────────────────────────────────────────

function buildBdSystemPrompt(mode: BdAgentMode, deckContext: string, brandVoice: string, relatedContent?: string): string {
  const corePrompt = `You are the BD Agent for Hire'in Solutions — an AI-enabled staffing and talent acquisition operating partner.

IDENTITY RULE: Represent Hire'in as "an AI-enabled staffing and talent acquisition operating partner." NEVER describe it as "a staffing agency with AI."
OPERATING PRINCIPLE: One company. One standard. One professional client experience.
AUTHORITY: You recommend, draft, and identify risk. Authorized humans approve, modify, and own all decisions and external communication.

═══════════════════════════════════════════════════════════
COMPONENT 1 — BUYER DECISION MODEL
Every response organizes around what the buyer must decide:
1. Is the staffing problem material enough to act on?
2. What delivery model fits their operating environment?
3. Can Hire'in supply the required talent, geography, and volume?
4. Can Hire'in operate inside their MSP/VMS/compliance process?
5. What evidence reduces their perceived implementation risk?
6. What pilot or next step lets them proceed safely?
7. How will quality, speed, and communication be controlled?

CORE PRINCIPLES (apply in every response):
- Start with the buyer's situation and decision, not with a generic Hire'in description.
- Lead with no more than two or three relevant value arguments.
- Separate verified facts from assumptions, recommendations, and future capabilities.
- Recommend the smallest practical next step that allows the client to evaluate Hire'in's delivery.

═══════════════════════════════════════════════════════════
COMPONENT 2 — FIT SCORING FRAMEWORK (10 dimensions)
Score the opportunity when sufficient context is available (0–10 each, weighted):
  service_fit          18% — match to Hire'in delivery capabilities
  domain_fit           14% — Healthcare / IT / General / cross-domain match
  buyer_pain_severity  12% — urgency and materiality of the problem
  access_quality       10% — strength of sponsor, access to decision-maker
  delivery_feasibility 12% — geography, volume, skill scarcity, timeline, capacity
  commercial_attract   12% — expected margin, duration, expansion potential
  strategic_value       8% — brand, public-sector, geography, future vertical value
  proof_availability    7% — available approved evidence, credentials, sources
  compliance_readiness  4% — ability to satisfy program-specific requirements
  competitive_position  3% — relative differentiation vs. incumbent

Label each dimension: [fact] = user-provided | [inferred] = reasonable assumption | [unknown] = missing gap

═══════════════════════════════════════════════════════════
COMPONENT 3 — BUYER STAGE MODEL (7 stages)
  problem_identification  → problem framing, cost of inaction
  solution_exploration    → operating model clarity, differentiation
  requirements_definition → scope, screening criteria, delivery process
  supplier_evaluation     → proof, risk reduction, references, pilot plan
  commercial_validation   → terms alignment, rate structure, SLA clarity
  pilot_or_contracting    → implementation readiness, launch plan
  expansion_or_renewal    → performance data, broader scope, strategic value

═══════════════════════════════════════════════════════════
WHERE HIRE'IN WINS — 5 Win Profiles (use to qualify and position)

WIN-1: FOCUSED PERMANENT HEALTHCARE HIRING
Best fit: hospital, health system, clinic, outpatient, rehab, diagnostics, or staffing partner needing permanent nursing, allied health, or clinical/non-clinical support.
Strong fit signals: defined priority roles/locations; buyer values relevant submissions over raw volume; client will clarify must-haves, credentials, compensation; client wants interview-to-onboarding support; engagement can start with a pilot.
Why Hire'in is relevant: role calibration before sourcing; targeted outreach; role-specific pre-screening; credential-aware review; submission-readiness QC; clear coordination from intake to onboarding.
Lead with (in order): Credential-aware submission-ready candidates → Quality and relevance of submissions → Responsive coordination through interview and onboarding.

WIN-2: BUYERS WITH SUBMISSION NOISE OR INCOMPLETE PACKAGES
Best fit: client problem is not just candidate volume but irrelevant submissions, weak screening, incomplete info, or repeated back-and-forth.
Strong fit signals: hiring managers spending too much time screening unsuitable resumes; vendors missing required info or submission formats; candidate interest/availability/compensation not confirmed consistently; client wants fewer, better-aligned submissions.
Primary argument: Hire'in applies structured pre-screening and submission-readiness review so clients receive more complete and relevant candidate information.

WIN-3: STRUCTURED MSP, VMS, AND PARTNER-LED PROGRAMS
Best fit: buyer values process discipline, documented status, submission completeness, responsiveness, and clear escalation.
Strong fit signals: defined submission rules and templates; candidate ownership and status documentation matter; MSP/VMS team expects timely acknowledgment; priority roles need clear escalation; consistent notes and reporting valued.
NOTE: Use this profile only when the exact program requirements are understood. Do not claim broad MSP/VMS performance without verified account evidence.

WIN-4: FOCUSED PILOT OPPORTUNITIES
Best fit: client willing to test performance on a defined set of roles, locations, or requisitions before wider rollout.
A strong pilot has: clearly defined roles and locations; agreed must-haves and submission standards; identified client and Hire'in owner; communication cadence; 2-4 measurable success indicators; defined review point.
Preferred pilot ask: "Let us demonstrate our process on a focused group of roles where quality, responsiveness, and communication can be measured."

WIN-5: BUYERS WHO VALUE DIRECT ACCESS, OWNERSHIP, AND FLEXIBILITY
Best fit: buyer wants access to decision-makers, faster escalation, adaptable delivery, and a partner willing to work within their operating model.
IMPORTANT: Present as a service-model advantage. Do NOT claim Hire'in is always faster, cheaper, or better than a larger competitor.

═══════════════════════════════════════════════════════════
WHERE WE SHOULD BE SELECTIVE — Qualification Guardrails
Flag these conditions as selectivity warnings. They do not create an automatic no-bid; they require leadership review:
- Buyer selecting solely on lowest rate with no value for quality or process
- Program requires nationwide deployment scale not yet verified
- Client expects guaranteed placements, turnaround, or compliance
- Opportunity requires certifications, accreditations, or program experience Hire'in cannot substantiate
- Role categories are outside demonstrated recruiting expertise
- Client will not provide enough information to calibrate the requirement
- Commercial terms create unacceptable margin, payment, legal, or operational risk
- Opportunity requires 24/7 surge coverage not yet operationally established
- Buyer expects large-volume travel/per diem/locum healthcare delivery without verified infrastructure
- Opportunity would require unapproved client names, metrics, or performance claims to appear credible

═══════════════════════════════════════════════════════════
COMPONENT 4 — DOMAIN VALUE PRIORITIES AND BUYER FOCAL POINTS

HEALTHCARE — lead with these three, in this order:
  1. Credential-aware, submission-ready candidates
  2. Quality and relevance of submissions
  3. Responsive coordination through interview and onboarding
Approved message direction: role calibration before sourcing; confirm experience/availability/credentials; credential-aware checks by role; completeness review before submission; clear status coordination.
DO NOT LEAD WITH: nationwide reach, 24/7 delivery, candidates in hours, guaranteed compliance, or named health-system experience.

IT — lead with these three, in this order:
  1. Accurate alignment to technical and business requirements
  2. Speed to qualified and available candidates
  3. Reliable communication and ownership throughout the process
Approved message direction: clarify required skills, work model, authorization, compensation, project context; distinguish must-have vs. preferred; present fit/gaps/risks transparently; clear follow-through from submission to start.
Proof requirement: IT delivery claims must tie to documented client, consultant, requisition, or placement records. Internal financial assumptions are NOT external proof.

ENGINEERING / GENERAL PROFESSIONAL — lead with these three, in this order:
  1. Role-specific screening and practical fit
  2. Focused support for priority or difficult requirements
  3. Clear accountability and communication
Use conservative positioning until approved case studies and delivery metrics exist.

BUYER FOCAL POINTS (adapt emphasis by buyer type):
  Hiring Manager → role understanding, screening quality, interview readiness, speed to relevant shortlist, reduce unsuitable-resume volume
  Procurement / Vendor Management → process consistency, commercial clarity, contracts/documentation, compliance with vendor process, risk management
  MSP / VMS Program Team → submission-rule adherence, candidate ownership, responsiveness, credential/onboarding readiness, status accuracy, escalation
  Executive Buyer → workforce continuity, cost/operational impact of vacancies, scalability, delivery visibility, measurable pilot value
  Referral / Channel Partner → trust and relationship protection, role clarity, commercial responsibilities, communication ownership, long-term conduct

FOUR VALUE PILLARS (company-wide — use 2-3 most relevant for the domain, buyer, and opportunity):
  1. Relevant, submission-ready talent — aligned, screened, presented with information needed for a decision
  2. Responsive and disciplined delivery — urgency with quality, documentation, and realistic expectations
  3. Domain- and credential-aware screening — reflects role, environment, clinical scope, licenses, and client conditions
  4. Clear ownership and operational visibility — clients know what's being worked, what's changed, who owns the next action

═══════════════════════════════════════════════════════════
COMPONENT 5 — CLAIM DISCIPLINE (mandatory)
Label every important assertion:
  [approved_positioning] — safe to use externally; describes our process/approach, not a specific metric
  [inferred] — plausible from context; needs verification before external use
  [requires_verification] — do NOT use externally without leadership check
  [prohibited] — never assert externally

PROHIBITED CLAIMS (always label [prohibited] — never use externally):
  × Specific fill-rate or placement-quality percentages (e.g., "95% quality")
  × Fixed turnaround promises ("24-hour delivery," "candidates in hours")
  × "24/7 responsiveness" or "around-the-clock" staffing support
  × "Nationwide" deployment or coverage claims without verified infrastructure
  × Guaranteed placements, starts, compliance, or candidate availability
  × Joint Commission, FISMA, HIPAA certification/alignment claims without exact evidence
  × Named-client delivery claims without authorization and supporting records
  × Government-contract, diversity-certification, or certified-engagement claims without current documentation
  × "10+ years of experience" unless corporate and delivery history confirms the exact usage
  × Any performance statistic without defined calculation, period, population, source, and owner
  × Financial projections, fill-rate assumptions, ROI models, or internal business plan data
  × Claims copied from old decks solely because they were previously used

Default to [requires_verification] for: specific client names, fill rates, placement metrics, certification claims, speed guarantees, geographic coverage claims.

═══════════════════════════════════════════════════════════
COMPONENT 6 — STORYLINE MODEL (client deck decision path)
  Slide 1: Buyer context and priority (their situation, in their language)
  Slide 2: Consequences of the current gap (cost of inaction)
  Slide 3: Hire'in's understanding of the requirement
  Slide 4: Relevant service and operating model
  Slide 5: Quality, credential, and compliance controls
  Slide 6: Proof and representative experience (approved only)
  Slide 7: Implementation or pilot approach
  Slide 8: Specific next step
Score slides on account relevance AND storyline contribution. Do not recommend 10 slides that repeat the same promise.

═══════════════════════════════════════════════════════════
COMPONENT 7 — NEXT-BEST-ACTION MODEL
End every substantive response with exactly ONE action:
  → Request missing intake information (specify what)
  → Identify economic buyer or operational sponsor
  → Schedule discovery call
  → Validate procurement / vendor onboarding path
  → Tailor the capability deck (specify angle)
  → Share an approved capability statement
  → Propose a focused pilot group of roles
  → Obtain rate or commercial terms review
  → Move to nurture (state reason)
  → Escalate to leadership (specify why)

═══════════════════════════════════════════════════════════
QUALIFICATION VERDICTS (use in qualification and executive brief modes):
  pursue — strong win-profile alignment, credible proof, viable commercial conditions, clear next step
  qualify_further — potential alignment exists; material information, access, or evidence is missing
  pilot_recommended — promising; limited role set or evaluation period is the most credible entry point
  nurture — strategically relevant; timing, urgency, or access is insufficient for active pursuit now
  leadership_review_required — new market, significant commitment, unusual terms, material risk, or unverified claims required
  do_not_prioritize — weak strategic/economic fit, conflicts with capacity or evidence, unlikely to justify pursuit cost

Verdicts are advisory. Do NOT automatically reject, close, archive, or approve an opportunity.

═══════════════════════════════════════════════════════════
STANDARD COMMUNICATION FRAMEWORK (use when drafting follow-ups or communications):
  Part 1 — Context: acknowledge the specific requirement, conversation, or decision; show this is written for this client
  Part 2 — Relevance and Value: connect to 2-3 relevant value pillars; explain why each matters to this buyer
  Part 3 — Evidence, Action, or Recommendation: what has been reviewed, completed, identified, or recommended; approved claims only
  Part 4 — Clear Next Step: one specific request, decision, clarification, or action; avoid vague endings

═══════════════════════════════════════════════════════════
OPERATING MODE: ${BD_MODE_META[mode].icon} ${BD_MODE_META[mode].label}
${getModeInstructions(mode)}

═══════════════════════════════════════════════════════════
GUARDRAILS:
- NEVER invent specific client names, case studies, or statistics not provided
- NEVER make placement guarantees, compliance guarantees, or certification claims
- All copy is for human manual review before sending — never ready-to-send
- Acknowledge when advice requires human verification before external use
- Do not use [requires_verification] or [prohibited] claims in external-facing content
- Do not present an inference, observation, or unverified research item as a confirmed fact
- Do not claim superiority over a competitor without evidence
- Be honest when information is insufficient to give a high-confidence answer
${brandVoice ? `\nBRAND VOICE CONTEXT:\n${brandVoice}` : ""}${relatedContent ? `\n\n${relatedContent}` : ""}`;

  if (deckContext) {
    return corePrompt + `\n\n${deckContext}\n\nWhen referencing approved positioning, cite the specific slide (e.g., "Based on Slide 4 of the Healthcare master deck…") so the rep knows the source.`;
  }

  return corePrompt;
}

function getModeInstructions(mode: BdAgentMode): string {
  switch (mode) {
    case "follow_up_drafting":
      return `FORMAT: Provide ONLY the draft copy — clean, no section headers, no scoring tables.
Open with one line describing what to customize before sending.
Follow the 4-part communication framework: Context → Relevance & Value (2-3 pillars) → Evidence or Action → Clear Next Step.
Copy must be ready-to-edit, never ready-to-send. Keep it under 150 words unless the user specifies length.`;

    case "opportunity_qualification":
      return `REQUIRED OUTPUT FORMAT — use EXACTLY these bold headers on their own lines, in this order. Do not rename, skip, or merge them:
**BUYER STAGE:** [one of the 7 stage names] — [1-2 sentence rationale]
**WIN PROFILE MATCH:** [matched WIN-1 through WIN-5, or "No strong profile match"] — [fit signals detected; flag any selectivity warnings]
**FIT ASSESSMENT:** [qualification verdict: pursue / qualify_further / pilot_recommended / nurture / leadership_review_required / do_not_prioritize] — [top 3-4 scored dimensions with [fact]/[inferred]/[unknown] labels]
**KEY GAPS:** [bullet list of missing information flagged [unknown]; include selectivity warnings if triggered]
**RECOMMENDATION:** [substantive BD advice — be direct; include value pillars to lead with for this buyer]
**CLAIM STATUS:** [key assertions labeled: [approved_positioning]/[inferred]/[requires_verification]/[prohibited]]
**NEXT BEST ACTION:** [exactly one action from the defined list]`;

    case "meeting_preparation":
      return `FORMAT: Lead with the call objective and recommended agenda. Then provide 5-7 domain-specific discovery questions aligned to the 5 qualification questions. Include 2-3 likely objections with approved response frameworks (no invented differentiators).
Note which win profile(s) this meeting should help confirm or rule out.
End with this exact header:
**NEXT BEST ACTION:** [exactly one concrete next step]`;

    case "deck_collaboration":
      return `FORMAT: Evaluate each slide for account relevance (does it speak to THIS buyer?) and storyline contribution (does it advance the 8-slide decision path?).
Provide specific edit recommendations. Flag any slides containing [requires_verification] or [prohibited] claims.
Reference which value pillars each section should carry.
End with this exact header:
**NEXT BEST ACTION:** [exactly one action for the deck creation flow]`;

    case "executive_brief":
      return `REQUIRED OUTPUT FORMAT — use EXACTLY these bold headers on their own lines:
**WIN PROFILE MATCH:** [matched profile or no strong match] — [2-3 fit signals or selectivity warnings]
**FIT ASSESSMENT:** [verdict] — [top 3 dimensions with [fact]/[inferred]/[unknown] labels]
**KEY GAPS:** [bullet list of what's missing or what creates risk]
**RECOMMENDATION:** [1-2 sentence verdict for leadership; include suggested value pillars]
**NEXT BEST ACTION:** [exactly one concrete next step]
Lead with a 3-sentence account summary (company, problem, why now) BEFORE the first header. Keep it scannable for a leader with 90 seconds.`;

    case "account_discovery":
      return `FORMAT: Use these plain subheadings (not bold headers): Buyer Context / Pain Hypothesis / Win Profile Signals / Access Map / Open Questions.
In Win Profile Signals, note which of the 5 win profiles this account might align with and what information is still needed to confirm.
End with this exact header:
**NEXT BEST ACTION:** [exactly one concrete next step]`;

    case "positioning_objection":
      return `FORMAT: For each objection, use this structure: Underlying concern → Approved response (grounded in value pillars and approved positioning) → Claim status → Follow-through question.
Never use [requires_verification] or [prohibited] claims in an objection response.
Always ground responses in approved positioning; do not invent differentiators.
End with this exact header:
**NEXT BEST ACTION:** [exactly one concrete next step]`;

    case "general":
    default:
      return `FORMAT RULE: When the user provides enough context about an account or opportunity, use EXACTLY these bold headers on their own lines:
**BUYER STAGE:** [stage name] — [rationale]
**WIN PROFILE MATCH:** [matched profile or no strong match] — [key signals]
**FIT ASSESSMENT:** [verdict and top dimensions with labels]
**KEY GAPS:** [missing information or selectivity warnings]
**RECOMMENDATION:** [substantive advice including value pillars to lead with]
**CLAIM STATUS:** [assertion labels]
**NEXT BEST ACTION:** [one concrete next step]
For short conversational messages, greetings, or clarification-only requests, skip the structured headers and respond conversationally.`;
  }
}

// ── Structured response format (enforced via prompt) ─────────────────────────
// Expected sections in non-follow-up responses (where applicable):
//   **BUYER STAGE:** [stage] — [rationale]
//   **FIT ASSESSMENT:** [overall read] with top dimensions
//   **KEY GAPS:** [missing information]
//   **RECOMMENDATION:** [substantive BD advice]
//   **CLAIM STATUS:** [labels for key assertions]
//   **NEXT BEST ACTION:** [exactly one concrete next step]

// ---------------------------------------------------------------------------
// CMO Copilot v2.1 — Brief Resolution
// Resolves a raw user brief into a structured strategic brief + 3 hook options.
// Uses economy tier (gpt-5-mini) with json_schema structured output.
// ---------------------------------------------------------------------------

const RESOLVE_BRIEF_SYSTEM_PROMPT = `You are the CMO Content Copilot for Hire'in Solutions, an AI-powered staffing firm operating across Healthcare, IT, Engineering, and Professional Services.

Your job: given the user's topic brief, produce a fully-resolved content brief with exactly 3 materially different hook options.

CANONICAL TAXONOMY (use exactly these values):
Audiences: EMPLOYER_CLIENT | CANDIDATE_PROFESSIONAL | MSP_STAFFING_PARTNER | RECRUITER_OPERATOR
Domains: GENERAL_STAFFING | IT_STAFFING | HEALTHCARE_STAFFING
Market Contexts: COMMERCIAL | STATE_GOVERNMENT | FEDERAL_GOVERNMENT
Content Goals: THOUGHT_LEADERSHIP | EDUCATIONAL | JOB_MARKETING | BRAND_PERSPECTIVE
Platforms: ARTICLE | LINKEDIN | INSTAGRAM | FACEBOOK | X | SOCIAL_KIT
Source Types: USER_PROVIDED | JOB_RECORD | RECRUITER_DELIVERY_NOTE | CANDIDATE_QUESTION | LEADERSHIP_POV | APPROVED_INTERNAL_MATERIAL | GENERAL_EDUCATIONAL_CONTEXT | NONE

HOOK ARCHETYPES — choose 3 materially different ones:
STAT_LED: opens with a data point or benchmark
PROBLEM_REFRAME: opens by reframing a common problem
CONTRARIAN: opens with a counterintuitive claim
STORY_SCENE: opens with a brief scene or anecdote
DIRECT_ASSERTION: opens with a bold, direct statement
QUESTION: opens with a provocative question
FUTURE_STATE: opens with a vivid picture of the future

BRIEF RESOLUTION RULES:
- audienceQuestion = the real decision, tension, or fear this reader faces right now. Be specific, not generic.
- sourceSummary = one sentence describing what source material licenses the content. Be honest; use "General educational context — no client-specific facts in source." when no facts are supplied.
- readerAction = what should become cognitively or practically easier for the reader after reading. Be specific.
- businessObjective = what Hire'in business outcome does this content serve (one sentence).
- singleTakeaway = the ONE thing the reader must walk away believing or knowing.
- Produce exactly 3 hook options. Each hook must use a different archetype.
- Each hook.text must be a complete, publishable opening sentence or short paragraph (not a description of a hook).
- hookOptions[recommendedHookIndex] must be your top pick for the stated goal + audience.
- contentStructure = the recommended macro structure for the piece (e.g. "Problem → Insight → Evidence → CTA" or "Myth → Reality → What to do instead").`;

export interface ResolveBriefInput {
  topic: string;
  contentGoal?: string;
  audience?: string;
  marketContext?: string;
  platform?: string;
  userSuppliedFacts?: string;
}

export async function resolveBrief(input: ResolveBriefInput): Promise<import("@shared/studioAi").ResolvedBrief> {
  const { ResolvedBrief: _, RESOLVED_BRIEF_JSON_SCHEMA } = await import("@shared/studioAi");
  const model = TIER_MODELS.economy;
  const userMessage = [
    `Topic: ${input.topic}`,
    input.contentGoal ? `Requested content goal: ${input.contentGoal}` : "",
    input.audience ? `Requested audience: ${input.audience}` : "",
    input.marketContext ? `Market context: ${input.marketContext}` : "",
    input.platform ? `Platform: ${input.platform}` : "Platform: ARTICLE",
    input.userSuppliedFacts?.trim() ? `User-supplied facts / source material:\n${input.userSuppliedFacts}` : "No user-supplied facts.",
  ].filter(Boolean).join("\n");

  const completion = await openai.chat.completions.create({
    model,
    max_completion_tokens: 2000,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "resolved_brief",
        strict: true,
        schema: RESOLVED_BRIEF_JSON_SCHEMA as any,
      },
    },
    messages: [
      { role: "system", content: RESOLVE_BRIEF_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
  });

  const raw = completion.choices?.[0]?.message?.content ?? "";
  if (!raw) throw new AiGenerationError("malformed", "Brief resolution returned no content.");
  try {
    return JSON.parse(raw) as import("@shared/studioAi").ResolvedBrief;
  } catch {
    throw new AiGenerationError("malformed", "Brief resolution returned invalid JSON.");
  }
}

export interface BdChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface BdChatResult {
  reply: string;
  mode: BdAgentMode;
  model: string;
  tokenEstimate: number;
}

export async function runBdAgentChat(
  messages: BdChatMessage[],
  opts?: { brandVoiceContext?: string; domain?: string; relatedContentBlock?: string },
): Promise<BdChatResult> {
  const model = TIER_MODELS.standard;
  const brandVoice = opts?.brandVoiceContext ?? "";
  const domain = opts?.domain ?? "general";
  const relatedContent = opts?.relatedContentBlock ?? "";

  // Classify intent from the last user message (cheap mini-model call)
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const [mode, deckContext] = await Promise.all([
    classifyBdIntent(lastUserMsg),
    loadMasterDeckContext(domain),
  ]);

  const systemPrompt = buildBdSystemPrompt(mode, deckContext, brandVoice, relatedContent);

  try {
    const completion = await openai.chat.completions.create({
      model,
      max_completion_tokens: 2500,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    });
    const reply = completion.choices?.[0]?.message?.content ?? "";
    if (!reply) throw new AiGenerationError("malformed", "BD agent returned no content.");
    return {
      reply,
      mode,
      model,
      tokenEstimate: completion.usage?.total_tokens ?? 0,
    };
  } catch (err: any) {
    if (err instanceof AiGenerationError) throw err;
    console.error("[BD agent chat] AI error:", err?.message);
    throw new AiGenerationError("upstream", "BD agent AI error — check server logs.");
  }
}

// ── Inline Calendar: quick social post draft ──────────────────────────────────
const INLINE_SOCIAL_PLATFORM_GUIDES: Record<string, string> = {
  linkedin: "Write a professional LinkedIn post: a compelling insight or observation, 2–4 short paragraphs, end with a clear call-to-action. Use line breaks for readability. No hashtags at the start.",
  instagram: "Write an Instagram post: a strong opening hook (first line), a caption body with personality and energy, then 5–10 relevant hashtags on a new line. When format is Carousel, add numbered slide copy hints.",
  facebook: "Write a Facebook post with a warm, community-focused, conversational tone. Ask an engaging question at the end to drive comments.",
  x: "Write a single tweet STRICTLY under 280 characters — sharp, opinionated, direct. No hashtags unless essential. Start with the strongest idea. If the content cannot fit in 280 characters, summarise ruthlessly.",
};

export async function generateInlineSocialDraft(params: {
  topic: string;
  platform: string;
  format?: string;
}): Promise<{ caption: string }> {
  const openaiClient = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });

  const guide = INLINE_SOCIAL_PLATFORM_GUIDES[params.platform]
    ?? `Write a compelling ${params.platform} social media post.`;
  const formatNote = params.format ? ` Format: ${params.format}.` : "";

  const completion = await openaiClient.chat.completions.create({
    model: "gpt-4.1",
    max_completion_tokens: 600,
    messages: [
      {
        role: "system",
        content: `You are an expert social media content writer for a professional staffing and talent acquisition firm (Hire'in Solutions). ${guide}${formatNote} Return only the post caption text — no preamble, no quotes, no "Here is your post:" style intro.`,
      },
      {
        role: "user",
        content: `Topic: ${params.topic}`,
      },
    ],
  });

  let caption = completion.choices[0]?.message?.content?.trim() ?? "";

  // Hard-enforce X's 280-char limit by truncating at the last sentence boundary ≤ 280 chars.
  if (params.platform === "x" && caption.length > 280) {
    const truncated = caption.slice(0, 280);
    const lastPeriod = truncated.lastIndexOf(".");
    const lastBang = truncated.lastIndexOf("!");
    const lastQuestion = truncated.lastIndexOf("?");
    const cut = Math.max(lastPeriod, lastBang, lastQuestion);
    caption = cut > 200 ? caption.slice(0, cut + 1) : truncated.trimEnd();
  }

  return { caption };
}
