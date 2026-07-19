import {
  MIN_CALIBRATION_CASES,
  resolveEnforcement,
  type EvaluationEnforcement,
  type SemanticEvaluatorConfig,
  type SemanticScore,
} from "./evalTypes";

export { MIN_CALIBRATION_CASES, resolveEnforcement };

export type SemanticDimension =
  | "reader_focus"
  | "stakeholder_materiality"
  | "epistemic_honesty"
  | "evidence_grounding"
  | "practical_utility"
  | "human_authenticity"
  | "compression"
  | "promotional_discipline";

export const SEMANTIC_DIMENSION_DESCRIPTIONS: Record<SemanticDimension, string> = {
  reader_focus:
    "Does the planning output serve exactly one reader with exactly one decision? Score 1 if vague/multi-audience, 5 if laser-focused.",
  stakeholder_materiality:
    "Are only material stakeholder perspectives included? Score 1 if generic/all-inclusive, 5 if each lens is justified by materiality.",
  epistemic_honesty:
    "Are claims labelled by epistemic type? Score 1 if claims are asserted without labelling, 5 if every material claim has an epistemic type.",
  evidence_grounding:
    "Are research questions pointed at specific, obtainable evidence? Score 1 if vague/unfalsifiable, 5 if each question has a clear evidence type.",
  practical_utility:
    "Can the primary reader act on this within 48 hours? Score 1 if abstract/inspirational only, 5 if specific and actionable.",
  human_authenticity:
    "Is the output free of invented experience and false attribution? Score 1 if invented anecdotes/quotes, 5 if fully authentic.",
  compression:
    "Is the word budget set at the ceiling, not the target? Score 1 if padded/over-budgeted, 5 if tight and justified.",
  promotional_discipline:
    "Is the output free of Hire'in promotional claims under editorial cover? Score 1 if disguised marketing, 5 if editorially clean.",
};

export const VETO_SENSITIVE_DIMENSIONS: SemanticDimension[] = [
  "evidence_grounding",
  "epistemic_honesty",
  "human_authenticity",
  "promotional_discipline",
];

export const DEFAULT_SEMANTIC_CONFIGS: SemanticEvaluatorConfig[] = [
  {
    dimension: "reader_focus",
    generatorFamily: "openai",
    judgeFamily: "openai",
    humanCalibrationCompleted: false,
    calibrationCaseCount: 0,
    enforcement: "advisory",
    judgePrompt: buildJudgePrompt("reader_focus"),
  },
  {
    dimension: "stakeholder_materiality",
    generatorFamily: "openai",
    judgeFamily: "openai",
    humanCalibrationCompleted: false,
    calibrationCaseCount: 0,
    enforcement: "advisory",
    judgePrompt: buildJudgePrompt("stakeholder_materiality"),
  },
  {
    dimension: "epistemic_honesty",
    generatorFamily: "openai",
    judgeFamily: "openai",
    humanCalibrationCompleted: false,
    calibrationCaseCount: 0,
    enforcement: "advisory",
    judgePrompt: buildJudgePrompt("epistemic_honesty"),
  },
  {
    dimension: "evidence_grounding",
    generatorFamily: "openai",
    judgeFamily: "openai",
    humanCalibrationCompleted: false,
    calibrationCaseCount: 0,
    enforcement: "advisory",
    judgePrompt: buildJudgePrompt("evidence_grounding"),
  },
  {
    dimension: "practical_utility",
    generatorFamily: "openai",
    judgeFamily: "openai",
    humanCalibrationCompleted: false,
    calibrationCaseCount: 0,
    enforcement: "advisory",
    judgePrompt: buildJudgePrompt("practical_utility"),
  },
  {
    dimension: "human_authenticity",
    generatorFamily: "openai",
    judgeFamily: "openai",
    humanCalibrationCompleted: false,
    calibrationCaseCount: 0,
    enforcement: "advisory",
    judgePrompt: buildJudgePrompt("human_authenticity"),
  },
  {
    dimension: "compression",
    generatorFamily: "openai",
    judgeFamily: "openai",
    humanCalibrationCompleted: false,
    calibrationCaseCount: 0,
    enforcement: "advisory",
    judgePrompt: buildJudgePrompt("compression"),
  },
  {
    dimension: "promotional_discipline",
    generatorFamily: "openai",
    judgeFamily: "openai",
    humanCalibrationCompleted: false,
    calibrationCaseCount: 0,
    enforcement: "advisory",
    judgePrompt: buildJudgePrompt("promotional_discipline"),
  },
];

function buildJudgePrompt(dimension: SemanticDimension): string {
  const description =
    SEMANTIC_DIMENSION_DESCRIPTIONS[dimension] ??
    `Evaluate this dimension: ${dimension}`;
  return `You are an independent editorial quality judge. You are evaluating a planning output from an AI editorial system called Insights by Hire'in.

DIMENSION: ${dimension.replace(/_/g, " ").toUpperCase()}
RUBRIC: ${description}

IMPORTANT RULES FOR JUDGES:
- You must NOT know or infer the desired score before evaluating.
- Score each dimension independently on a 1–5 scale.
- A strong score on one dimension NEVER compensates for a failure on a veto-sensitive dimension.
- Return structured JSON with: { "dimension": "${dimension}", "score": <1-5>, "reason": "<your reasoning>", "citedExcerpt": "<relevant quote from the output>" }
- Do not expose or rely on a combined aggregate score.`;
}

export interface MockSemanticScore {
  dimension: SemanticDimension;
  score: number;
  reason: string;
  citedExcerpt?: string;
  enforcement: EvaluationEnforcement;
  isAdvisory: boolean;
}

export async function evaluateSemanticDimension(
  config: SemanticEvaluatorConfig,
  planningOutput: Record<string, unknown>,
): Promise<MockSemanticScore> {
  const apiKey = process.env.AI_INTEGRATIONS_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "evaluateSemanticDimension requires AI_INTEGRATIONS_KEY or OPENAI_API_KEY to be set. " +
        "For offline/CI evaluation use evaluateSemanticDimensionMock instead.",
    );
  }

  const { default: OpenAI } = await import("openai");
  const openai = new OpenAI({
    apiKey,
    baseURL: process.env.AI_INTEGRATIONS_URL ?? undefined,
  });

  const judgeSystemPrompt = config.judgePrompt;
  const userContent =
    `\n\nPLANNING OUTPUT TO EVALUATE:\n${JSON.stringify(planningOutput, null, 2)}\n\n` +
    `Return ONLY a JSON object matching this schema exactly:\n` +
    `{ "dimension": "${config.dimension}", "score": <integer 1-5>, "reason": "<reasoning>", "citedExcerpt": "<quote from the output>" }`;

  const completion = await openai.chat.completions.create({
    model: process.env.INSIGHTS_JUDGE_MODEL ?? "gpt-4o-mini",
    messages: [
      { role: "system", content: judgeSystemPrompt },
      { role: "user", content: userContent },
    ],
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: 512,
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error(
      `evaluateSemanticDimension: empty response from model for dimension "${config.dimension}"`,
    );
  }

  let parsed: { dimension?: string; score?: number; reason?: string; citedExcerpt?: string };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      `evaluateSemanticDimension: model returned non-JSON for dimension "${config.dimension}": ${raw.slice(0, 120)}`,
    );
  }

  const score = typeof parsed.score === "number" ? Math.min(5, Math.max(1, Math.round(parsed.score))) : 3;
  const reason = typeof parsed.reason === "string" ? parsed.reason : "No reason provided by judge.";
  const citedExcerpt = typeof parsed.citedExcerpt === "string" ? parsed.citedExcerpt : undefined;

  const enforcement = resolveEnforcement(config);
  return {
    dimension: config.dimension as SemanticDimension,
    score,
    reason,
    citedExcerpt,
    enforcement,
    isAdvisory: enforcement === "advisory",
  };
}

export function evaluateSemanticDimensionMock(
  config: SemanticEvaluatorConfig,
  mockScore: number,
  mockReason: string,
  citedExcerpt?: string,
): MockSemanticScore {
  const enforcement = resolveEnforcement(config);
  return {
    dimension: config.dimension as SemanticDimension,
    score: mockScore,
    reason: mockReason,
    citedExcerpt,
    enforcement,
    isAdvisory: enforcement === "advisory",
  };
}

export function isVetoSensitiveDimension(dimension: string): boolean {
  return VETO_SENSITIVE_DIMENSIONS.includes(dimension as SemanticDimension);
}

export function getConfigForDimension(
  dimension: string,
  configs: SemanticEvaluatorConfig[] = DEFAULT_SEMANTIC_CONFIGS,
): SemanticEvaluatorConfig | undefined {
  return configs.find((c) => c.dimension === dimension);
}

export function summarizeSemanticScores(scores: MockSemanticScore[]): {
  advisoryScores: MockSemanticScore[];
  hardGateFailures: MockSemanticScore[];
  vetoDimensionFlags: MockSemanticScore[];
  overallAdvisoryOnly: boolean;
} {
  const advisoryScores = scores.filter((s) => s.isAdvisory);
  const hardGateFailures = scores.filter((s) => !s.isAdvisory && s.score < 3);
  const vetoDimensionFlags = scores.filter(
    (s) => isVetoSensitiveDimension(s.dimension) && s.score < 3,
  );

  return {
    advisoryScores,
    hardGateFailures,
    vetoDimensionFlags,
    overallAdvisoryOnly: advisoryScores.length === scores.length,
  };
}
