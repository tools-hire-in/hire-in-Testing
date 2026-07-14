/**
 * Deterministic (no-LLM) quality audit for imported content calendar rows.
 * Checks banned slop phrases, brief length, missing pillar, and platform-channel
 * mismatches. Returns per-row quality scores synchronously so preview stays fast.
 */

export type QualityScore = "high" | "medium" | "needs_work";

export interface RowQualityResult {
  qualityScore: QualityScore;
  qualityFlags: string[];
}

// ---------------------------------------------------------------------------
// Banned phrases extracted from marketingIntelligence.ts BANNED_SLOP_BLOCK
// ---------------------------------------------------------------------------
const BANNED_PHRASES: RegExp[] = [
  /in today['']s fast[\s-]paced world/i,
  /the landscape of/i,
  /game[\s-]changer/i,
  /\bunlock\b/i,
  /\bunleash\b/i,
  /\bdelve\b/i,
  /\bdive into\b/i,
  /navigate the complexities/i,
  /it['']s important to note/i,
  /at the end of the day/i,
  /\bseamless\b/i,
  /\bstreamlined\b/i,
  /war for talent/i,
  /people are our greatest asset/i,
  /we go above and beyond/i,
  /passionate about connecting people/i,
  /\btop talent\b/i,
  /\bdream job\b/i,
  /\blockstar\b/i,
  /\bninja\b/i,
  /\bguru\b/i,
  /work hard,?\s*play hard/i,
  /are you struggling with/i,
];

// Channels that make sense for story-type content
const STORY_CHANNELS = new Set(["instagram", "facebook"]);

// Channels where long-form articles are appropriate
const ARTICLE_CHANNELS = new Set(["linkedin", "website", "facebook"]);

function detectSlopPhrases(text: string): string[] {
  const found: string[] = [];
  for (const rx of BANNED_PHRASES) {
    if (rx.test(text)) {
      // Create a human-readable label from the regex source
      const match = text.match(rx);
      if (match) found.push(`Slop phrase detected: "${match[0]}"`);
    }
  }
  return found;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Audit a single idea row (one idea object produced by parseImportRows).
 */
export function auditIdeaRow(idea: {
  topic?: string | null;
  brief?: string | null;
  captionCopy?: string | null;
  pillar?: string | null;
  contentType?: string | null;
  channels?: string[] | null;
}): RowQualityResult {
  const flags: string[] = [];

  const fullText = [idea.topic, idea.brief, idea.captionCopy].filter(Boolean).join(" ");

  // 1. Banned slop phrases
  flags.push(...detectSlopPhrases(fullText));

  // 2. Brief too vague (under 10 words)
  const briefText = (idea.brief || "").trim();
  if (briefText && countWords(briefText) < 10) {
    flags.push("Brief too vague (under 10 words) — add more context");
  }
  if (!briefText) {
    flags.push("No brief provided — the team won't know what angle to take");
  }

  // 3. Missing pillar
  if (!idea.pillar) {
    flags.push("Missing content pillar — add one to balance the calendar");
  }

  // 4. Platform-channel mismatch
  const channels = idea.channels ?? [];
  const contentType = idea.contentType ?? "social_post";

  if (contentType === "story" && channels.length > 0) {
    const storyFriendly = channels.filter((c) => STORY_CHANNELS.has(c));
    if (storyFriendly.length === 0) {
      flags.push(`Platform mismatch: story content requires Instagram or Facebook, but channels are [${channels.join(", ")}]`);
    }
  }

  if (contentType === "article" && channels.length > 0) {
    const articleFriendly = channels.filter((c) => ARTICLE_CHANNELS.has(c));
    if (articleFriendly.length === 0) {
      flags.push(`Platform mismatch: article content works best on LinkedIn/Website, but channels are [${channels.join(", ")}]`);
    }
  }

  // Score
  let qualityScore: QualityScore;
  const slopCount = flags.filter((f) => f.startsWith("Slop phrase")).length;
  const totalFlags = flags.length;

  if (slopCount > 0 || totalFlags >= 3) {
    qualityScore = "needs_work";
  } else if (totalFlags >= 1) {
    qualityScore = "medium";
  } else {
    qualityScore = "high";
  }

  return { qualityScore, qualityFlags: flags };
}

/**
 * Aggregate per-idea results into a single per-row result.
 * A row may produce 1-2 ideas (e.g. post + story split).
 * The worst score across the ideas wins.
 */
export function auditRow(ideas: Array<{
  topic?: string | null;
  brief?: string | null;
  captionCopy?: string | null;
  pillar?: string | null;
  contentType?: string | null;
  channels?: string[] | null;
}>): RowQualityResult {
  if (!ideas.length) return { qualityScore: "high", qualityFlags: [] };

  const results = ideas.map(auditIdeaRow);

  const ORDER: QualityScore[] = ["needs_work", "medium", "high"];
  let worst: QualityScore = "high";
  const allFlags: string[] = [];

  for (const r of results) {
    if (ORDER.indexOf(r.qualityScore) < ORDER.indexOf(worst)) {
      worst = r.qualityScore;
    }
    for (const f of r.qualityFlags) {
      if (!allFlags.includes(f)) allFlags.push(f);
    }
  }

  return { qualityScore: worst, qualityFlags: allFlags };
}

/**
 * Batch-level pillar balance check.
 * Returns a warning string if any single pillar exceeds 60% of all valid rows,
 * or null if distribution is healthy.
 */
export function checkPillarBalance(rows: Array<{ ideas: Array<{ pillar?: string | null }> }>): string | null {
  const counts: Record<string, number> = {};
  let total = 0;

  for (const row of rows) {
    // Use the first idea's pillar as the row pillar
    const pillar = row.ideas[0]?.pillar || null;
    if (pillar) {
      counts[pillar] = (counts[pillar] ?? 0) + 1;
    }
    total++;
  }

  if (total === 0) return null;

  for (const [pillar, count] of Object.entries(counts)) {
    const pct = Math.round((count / total) * 100);
    if (pct > 60) {
      return `${pct}% of rows are tagged "${pillar.replace(/_/g, " ")}" — consider diversifying your content pillars`;
    }
  }

  return null;
}
