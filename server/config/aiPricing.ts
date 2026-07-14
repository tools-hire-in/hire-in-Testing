// AI model pricing configuration.
// Prices are per 1 million tokens (USD).
// Update this map when OpenAI changes pricing — no schema migration needed.

export interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  "gpt-5-mini":  { inputPer1M: 0.40,  outputPer1M: 1.60  },
  "gpt-5.4":     { inputPer1M: 2.50,  outputPer1M: 10.00 },
  "gpt-5":       { inputPer1M: 2.50,  outputPer1M: 10.00 },
  "gpt-4o":      { inputPer1M: 2.50,  outputPer1M: 10.00 },
  "gpt-4o-mini": { inputPer1M: 0.15,  outputPer1M: 0.60  },
  "gpt-4-turbo": { inputPer1M: 10.00, outputPer1M: 30.00 },
  "gpt-4":       { inputPer1M: 30.00, outputPer1M: 60.00 },
  "gpt-3.5-turbo": { inputPer1M: 0.50, outputPer1M: 1.50 },
};

// Fallback pricing used when the model isn't in the map above.
export const FALLBACK_PRICING: ModelPricing = { inputPer1M: 2.50, outputPer1M: 10.00 };

// Expected output token ranges by content type (for pre-generation estimates).
// Values are [min, max] output tokens.
const OUTPUT_RANGES: Record<string, [number, number]> = {
  quick_take:        [300,  600],
  thought_leadership:[700,  1400],
  educational:       [800,  1600],
  case_study:        [900,  1800],
  listicle:          [500,  1000],
  checklist_card:    [200,  400],
  quote_card:        [50,   150],
  stat_card:         [50,   150],
  comparison_table:  [300,  600],
  infographic_brief: [400,  800],
  newsletter:        [600,  1200],
  blog_post:         [800,  1600],
  press_release:     [500,  1000],
  job_marketing:     [400,  800],
  // Social kit types
  master_social_kit: [300,  700],
  social_post:       [100,  250],
  // Quality review
  quality_review:    [200,  500],
  // Default fallback
  article:           [700,  1400],
};

// Approximate input token count for system prompts.
// This is a conservative estimate across all templates.
const SYSTEM_PROMPT_BASE_TOKENS = 800;

// Tokens per character (rough English approximation: 1 token ≈ 4 chars).
const CHARS_PER_TOKEN = 4;

function getPricing(modelName: string | null | undefined): ModelPricing {
  if (!modelName) return FALLBACK_PRICING;
  // Exact match first
  if (MODEL_PRICING[modelName]) return MODEL_PRICING[modelName];
  // Prefix match (handles versioned names like "gpt-5-mini-2025-07")
  const key = Object.keys(MODEL_PRICING).find((k) => modelName.startsWith(k));
  return key ? MODEL_PRICING[key] : FALLBACK_PRICING;
}

/**
 * Compute a cost range (min, max) USD for a generation before it fires.
 * inputTokens = estimated tokens in the system + user prompt.
 */
export function computeCostRange(
  modelName: string | null | undefined,
  inputTokens: number,
  contentType?: string | null,
): { minCostUsd: number; maxCostUsd: number; pricingSnapshot: ModelPricing } {
  const pricing = getPricing(modelName);
  const [minOut, maxOut] = OUTPUT_RANGES[contentType ?? "article"] ?? OUTPUT_RANGES.article;
  const minTotal = inputTokens + minOut;
  const maxTotal = inputTokens + maxOut;
  // Approximation: split tokens 30% input / 70% output for cost weighting
  const minCostUsd = (inputTokens * pricing.inputPer1M + minOut * pricing.outputPer1M) / 1_000_000;
  const maxCostUsd = (inputTokens * pricing.inputPer1M + maxOut * pricing.outputPer1M) / 1_000_000;
  return { minCostUsd, maxCostUsd, pricingSnapshot: pricing };
}

/**
 * Compute the actual cost USD from total tokens used.
 * We split total tokens assuming ~40% input, ~60% output (conservative).
 */
export function computeCost(
  modelName: string | null | undefined,
  totalTokens: number | null | undefined,
): { costUsd: number; pricingSnapshot: ModelPricing } {
  if (!totalTokens || totalTokens <= 0) {
    return { costUsd: 0, pricingSnapshot: getPricing(modelName) };
  }
  const pricing = getPricing(modelName);
  // Assume 40% input, 60% output split for actual cost calculation
  const inputTokens = Math.round(totalTokens * 0.4);
  const outputTokens = totalTokens - inputTokens;
  const costUsd = (inputTokens * pricing.inputPer1M + outputTokens * pricing.outputPer1M) / 1_000_000;
  return { costUsd, pricingSnapshot: pricing };
}

/**
 * Estimate input token count from brief fields.
 * Used in the pre-generation estimate endpoint (no AI call).
 */
export function estimateInputTokens(briefFields: {
  topic?: string | null;
  contentGoal?: string | null;
  audience?: string | null;
  userSuppliedFacts?: string | null;
  hookPattern?: string | null;
  desiredEmotion?: string | null;
}): number {
  const charCount =
    (briefFields.topic?.length ?? 0) +
    (briefFields.contentGoal?.length ?? 0) +
    (briefFields.audience?.length ?? 0) +
    (briefFields.userSuppliedFacts?.length ?? 0) +
    (briefFields.hookPattern?.length ?? 0) +
    (briefFields.desiredEmotion?.length ?? 0);
  const briefTokens = Math.ceil(charCount / CHARS_PER_TOKEN);
  return SYSTEM_PROMPT_BASE_TOKENS + briefTokens;
}
