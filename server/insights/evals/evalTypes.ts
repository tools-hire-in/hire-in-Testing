import { z } from "zod";

export const assertionTypeSchema = z.enum([
  "schema_valid",
  "equals",
  "one_of",
  "not_contains",
  "word_count",
  "requires_source",
  "no_first_person_without_input",
  "no_first_person",
  "state_machine_safe",
  "word_budget_within_range",
  "no_pii",
  "no_prompt_injection",
  "lens_count_valid",
  "semantic_rubric",
]);

export type AssertionType = z.infer<typeof assertionTypeSchema>;

export const assertionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("schema_valid"), schemaName: z.string() }),
  z.object({ type: z.literal("equals"), path: z.string(), expected: z.unknown() }),
  z.object({ type: z.literal("one_of"), path: z.string(), values: z.array(z.unknown()) }),
  z.object({ type: z.literal("not_contains"), path: z.string(), forbidden: z.array(z.string()) }),
  z.object({
    type: z.literal("word_count"),
    path: z.string(),
    min: z.number().optional(),
    max: z.number().optional(),
  }),
  z.object({ type: z.literal("requires_source"), path: z.string() }),
  z.object({ type: z.literal("no_first_person_without_input") }),
  z.object({
    type: z.literal("semantic_rubric"),
    dimension: z.string(),
    minScore: z.number().min(1).max(5),
  }),
]);

export type Assertion = z.infer<typeof assertionSchema>;

export const evalCaseCategorySchema = z.enum([
  "normal",
  "edge",
  "adversarial",
  "hold_case",
]);
export type EvalCaseCategory = z.infer<typeof evalCaseCategorySchema>;

export const evalContextSchema = z.object({
  hasAuthorInput: z.boolean().default(false),
  contentType: z.string().optional(),
  mode: z.string().optional(),
  sourcePackProvided: z.boolean().default(false),
  isHighRiskClaim: z.boolean().default(false),
  isModeA: z.boolean().default(false),
});
export type EvalContext = z.infer<typeof evalContextSchema>;

export const promptEvalCaseSchema = z.object({
  id: z.string(),
  blockName: z.string(),
  description: z.string(),
  category: evalCaseCategorySchema,
  mockResponse: z.record(z.string(), z.unknown()),
  context: evalContextSchema,
  assertions: z.array(assertionSchema),
  tags: z.array(z.string()).default([]),
});
export type PromptEvalCase = z.infer<typeof promptEvalCaseSchema>;

export const assertionResultSchema = z.object({
  assertionType: assertionTypeSchema,
  pass: z.boolean(),
  reason: z.string().optional(),
  path: z.string().optional(),
});
export type AssertionResult = z.infer<typeof assertionResultSchema>;

export const evalResultSchema = z.object({
  caseId: z.string(),
  blockName: z.string(),
  category: evalCaseCategorySchema,
  assertionResults: z.array(assertionResultSchema),
  scores: z.record(z.string(), z.number()).optional(),
  passed: z.boolean(),
  failureReasons: z.array(z.string()),
  durationMs: z.number().optional(),
});
export type EvalResult = z.infer<typeof evalResultSchema>;

export const evalRunSchema = z.object({
  runId: z.string(),
  timestamp: z.string(),
  promptManifestVersion: z.string(),
  mode: z.enum(["ci", "smoke", "adversarial", "full"]),
  results: z.array(evalResultSchema),
  summary: z.object({
    total: z.number(),
    passed: z.number(),
    failed: z.number(),
    criticalFailures: z.number(),
    adversarialBlocked: z.number(),
  }),
});
export type EvalRun = z.infer<typeof evalRunSchema>;

export const semanticScoreSchema = z.object({
  dimension: z.string(),
  score: z.number().min(1).max(5),
  reason: z.string(),
  citedExcerpt: z.string().optional(),
});
export type SemanticScore = z.infer<typeof semanticScoreSchema>;

export const regressionCaseSchema = z.object({
  caseId: z.string(),
  dimension: z.string(),
  baselineScore: z.number(),
  candidateScore: z.number(),
  delta: z.number(),
});
export type RegressionCase = z.infer<typeof regressionCaseSchema>;

export const scoreDeltaDistributionSchema = z.object({
  improvement: z.number().describe("Deltas > 0"),
  noChange: z.number().describe("Deltas == 0"),
  minorRegression: z.number().describe("Deltas in (-0.1, 0)"),
  moderateRegression: z.number().describe("Deltas in (-0.3, -0.1]"),
  severeRegression: z.number().describe("Deltas <= -0.3"),
  totalObservations: z.number(),
});
export type ScoreDeltaDistribution = z.infer<typeof scoreDeltaDistributionSchema>;

export const regressionComparisonSchema = z.object({
  baselineVersion: z.string(),
  candidateVersion: z.string(),
  timestamp: z.string(),
  casesImproved: z.array(z.string()),
  casesRegressed: z.array(regressionCaseSchema),
  criticalBehaviorChanges: z.array(z.string()),
  medianScoreDelta: z.number(),
  regressionRate: z.number(),
  requiresHumanReview: z.boolean(),
  humanReviewReason: z.string().optional(),
  scoreDeltaDistribution: scoreDeltaDistributionSchema,
});
export type RegressionComparison = z.infer<typeof regressionComparisonSchema>;

export const REGRESSION_THRESHOLD_POINTS = 0.8;
export const HUMAN_REVIEW_REGRESSION_RATE = 0.1;

export type EvaluationEnforcement = "advisory" | "directional" | "hard_gate";

export const MIN_CALIBRATION_CASES = 30;

export interface SemanticEvaluatorConfig {
  dimension: string;
  generatorFamily: string;
  judgeFamily: string;
  humanCalibrationCompleted: boolean;
  calibrationCaseCount: number;
  enforcement: EvaluationEnforcement;
  judgePrompt: string;
}

export function resolveEnforcement(config: SemanticEvaluatorConfig): EvaluationEnforcement {
  const sameFamily =
    config.generatorFamily.toLowerCase() === config.judgeFamily.toLowerCase();

  const calibrated =
    config.humanCalibrationCompleted &&
    (config.calibrationCaseCount ?? 0) >= MIN_CALIBRATION_CASES;

  if (!calibrated || sameFamily) {
    return "advisory";
  }

  return config.enforcement;
}
