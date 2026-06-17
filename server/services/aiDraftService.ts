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
      const completion = await openai.chat.completions.create({
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
        throw new AbortError(new AiGenerationError("upstream", err?.message || "Bad request to AI provider.", false));
      }
      throw new AiGenerationError("upstream", err?.message || "AI provider request failed.");
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

export function isAiConfigured(): boolean {
  return Boolean(process.env.AI_INTEGRATIONS_OPENAI_API_KEY && process.env.AI_INTEGRATIONS_OPENAI_BASE_URL);
}
