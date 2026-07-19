import { createHash } from "crypto";
import {
  INSIGHTS_EDITORIAL_IDENTITY_BLOCK,
  INSIGHTS_PRIMARY_READER_BLOCK,
  INSIGHTS_PLANNING_SCAN_BLOCK,
  INSIGHTS_LENS_INCLUSION_BLOCK,
  INSIGHTS_EPISTEMIC_DISCIPLINE_BLOCK,
  INSIGHTS_LENGTH_BLOCK,
  INSIGHTS_HUMAN_AUTHENTICITY_BLOCK,
} from "../../intelligence/marketingIntelligence";

export type ActivationStage = "call1_planning" | "call2_research" | "call3_draft" | "call4_review";

export interface PromptBlockManifestEntry {
  name: string;
  version: string;
  contentHash: string;
  activationStages: ActivationStage[];
  compositionOrder: number;
  description: string;
}

function hash(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex").slice(0, 16);
}

export const PROMPT_MANIFEST: Record<string, PromptBlockManifestEntry> = {
  editorialIdentity: {
    name: "editorialIdentity",
    version: "1.0.0",
    contentHash: hash(INSIGHTS_EDITORIAL_IDENTITY_BLOCK),
    activationStages: ["call1_planning", "call2_research", "call3_draft", "call4_review"],
    compositionOrder: 1,
    description: "Mission, primary domains, four-call operating model, and non-negotiable editorial rules.",
  },
  primaryReader: {
    name: "primaryReader",
    version: "1.0.0",
    contentHash: hash(INSIGHTS_PRIMARY_READER_BLOCK),
    activationStages: ["call1_planning"],
    compositionOrder: 2,
    description: "Enforces exactly one primary reader with one specific question.",
  },
  planningScan: {
    name: "planningScan",
    version: "1.0.0",
    contentHash: hash(INSIGHTS_PLANNING_SCAN_BLOCK),
    activationStages: ["call1_planning"],
    compositionOrder: 3,
    description: "Mandatory internal stakeholder scan before mode recommendation.",
  },
  lensInclusion: {
    name: "lensInclusion",
    version: "1.0.0",
    contentHash: hash(INSIGHTS_LENS_INCLUSION_BLOCK),
    activationStages: ["call1_planning"],
    compositionOrder: 4,
    description: "Five-question materiality test for lens inclusion/omission.",
  },
  epistemicDiscipline: {
    name: "epistemicDiscipline",
    version: "1.0.0",
    contentHash: hash(INSIGHTS_EPISTEMIC_DISCIPLINE_BLOCK),
    activationStages: ["call1_planning", "call2_research", "call3_draft"],
    compositionOrder: 5,
    description: "Claim labelling requirements and epistemic type classification.",
  },
  lengthCompression: {
    name: "lengthCompression",
    version: "1.0.0",
    contentHash: hash(INSIGHTS_LENGTH_BLOCK),
    activationStages: ["call1_planning", "call3_draft", "call4_review"],
    compositionOrder: 6,
    description: "Word budgets, reading time formula, and compression discipline.",
  },
  humanAuthenticity: {
    name: "humanAuthenticity",
    version: "1.0.0",
    contentHash: hash(INSIGHTS_HUMAN_AUTHENTICITY_BLOCK),
    activationStages: ["call2_research", "call3_draft", "call4_review"],
    compositionOrder: 7,
    description: "Hard prohibition on invented first-person experience, anecdotes, and attribution.",
  },
};

export function getBlocksForStage(stage: ActivationStage): PromptBlockManifestEntry[] {
  return Object.values(PROMPT_MANIFEST)
    .filter((b) => b.activationStages.includes(stage))
    .sort((a, b) => a.compositionOrder - b.compositionOrder);
}

export function composePromptForStage(
  stage: ActivationStage,
  blocks: Record<string, string>,
): string {
  const entries = getBlocksForStage(stage);
  return entries
    .map((e) => blocks[e.name] ?? "")
    .filter(Boolean)
    .join("\n\n");
}

export function getManifestSummary(): string {
  const lines = Object.values(PROMPT_MANIFEST).map(
    (b) =>
      `${b.name} v${b.version} [${b.contentHash}] stages:${b.activationStages.join(",")} order:${b.compositionOrder}`,
  );
  return lines.join("\n");
}
