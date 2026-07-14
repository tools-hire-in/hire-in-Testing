// Brief quality scorer — pure function, no DB access.
// Produces a tiered completeness score from article brief fields.

export type BriefTier = "ready" | "fair" | "thin";

export interface BriefQualityResult {
  score: number;
  tier: BriefTier;
  missingFields: string[];
}

interface ScoredField {
  key: string;
  label: string;
  points: number;
  satisfied: boolean;
}

/**
 * Score a content brief.
 * Max score = 100. Tiers: ready ≥70, fair ≥40, thin <40.
 *
 * Weighted checklist:
 *  - topic ≥ 8 words            20 pts
 *  - content goal set           20 pts
 *  - audience set               20 pts
 *  - hook pattern set           15 pts
 *  - desired emotion set        15 pts
 *  - user-supplied facts present 10 pts
 */
export function scoreBrief(article: {
  title?: string | null;
  topic?: string | null;
  contentGoal?: string | null;
  audience?: string | null | string[];
  hookPattern?: string | null;
  desiredEmotion?: string | null;
  userSuppliedFacts?: string | null;
}): BriefQualityResult {
  // Resolve audience — may be a JSON array string or a plain string
  let audienceVal = "";
  if (Array.isArray(article.audience)) {
    audienceVal = article.audience.filter(Boolean).join("").trim();
  } else if (typeof article.audience === "string") {
    // Could be a JSON array serialised as string (e.g. '["EMPLOYER_CLIENT"]')
    try {
      const parsed = JSON.parse(article.audience);
      if (Array.isArray(parsed)) {
        audienceVal = parsed.filter(Boolean).join("").trim();
      } else {
        audienceVal = article.audience.trim();
      }
    } catch {
      audienceVal = article.audience.trim();
    }
  }

  // Use topic field; fall back to title as a rough proxy
  const topicText = (article.topic ?? article.title ?? "").trim();
  const topicWordCount = topicText ? topicText.split(/\s+/).filter(Boolean).length : 0;

  const fields: ScoredField[] = [
    {
      key: "topic",
      label: "Topic (8+ words)",
      points: 20,
      satisfied: topicWordCount >= 8,
    },
    {
      key: "contentGoal",
      label: "Content goal",
      points: 20,
      satisfied: !!(article.contentGoal?.trim()),
    },
    {
      key: "audience",
      label: "Target audience",
      points: 20,
      satisfied: !!audienceVal && audienceVal !== "AUTO_DETECT",
    },
    {
      key: "hookPattern",
      label: "Hook pattern",
      points: 15,
      satisfied: !!(article.hookPattern?.trim()),
    },
    {
      key: "desiredEmotion",
      label: "Desired emotion",
      points: 15,
      satisfied: !!(article.desiredEmotion?.trim()),
    },
    {
      key: "userSuppliedFacts",
      label: "Facts or context",
      points: 10,
      satisfied: !!(article.userSuppliedFacts?.trim()),
    },
  ];

  const score = fields.filter((f) => f.satisfied).reduce((sum, f) => sum + f.points, 0);
  const missingFields = fields.filter((f) => !f.satisfied).map((f) => f.label);

  let tier: BriefTier;
  if (score >= 70) tier = "ready";
  else if (score >= 40) tier = "fair";
  else tier = "thin";

  return { score, tier, missingFields };
}
