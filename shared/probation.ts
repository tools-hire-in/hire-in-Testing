// ─── Probation framework: shared cadence + scoring helpers ───────────────────
// Single source of truth shared by frontend and backend so the milestone
// scorecard, completion enforcement, escalation sweep, and guidance view all
// agree. Authoritative cadence comes from the 90-Day Probation Framework doc;
// the weighted scoring areas / bands / pass rule are served at runtime by
// GET /api/hr/probation-scoring-bands (DB tables), and this module only holds
// the math + structural constants that are stable regardless of that config.

/** Full formal check-in cadence (days after probation start). */
export const PROBATION_CADENCE_DAYS = [1, 7, 15, 30, 45, 60, 75, 90] as const;

/** Formal milestone reviews — these require a scored milestone scorecard. */
export const PROBATION_MILESTONE_DAYS = [30, 60, 90] as const;

/** Pulse / coaching check-ins — lightweight notes, no score required. */
export const PROBATION_PULSE_DAYS = [1, 7, 15, 45, 75] as const;

/** Default pass threshold (overall %); the live value comes from the pass rule. */
export const PROBATION_DEFAULT_PASS_MIN = 75;

export function isFormalMilestoneDay(day: number): boolean {
  return (PROBATION_MILESTONE_DAYS as readonly number[]).includes(day);
}

/** check_in_type to schedule for a given cadence day (reuses existing enum). */
export function cadenceCheckInType(day: number): "milestone" | "weekly" {
  return isFormalMilestoneDay(day) ? "milestone" : "weekly";
}

/** Whole-day difference between two YYYY-MM-DD dates (target - start). */
export function probationDayOffset(startDate: string, targetDate: string): number {
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const target = new Date(`${targetDate}T00:00:00Z`).getTime();
  if (Number.isNaN(start) || Number.isNaN(target)) return NaN;
  return Math.round((target - start) / 86400000);
}

/**
 * Map a cadence day offset onto the nearest framework milestone day (30/60/90)
 * if it is one. Returns null when the offset is a pulse day or off-cadence.
 */
export function milestoneDayFor(startDate: string, scheduledDate: string): number | null {
  const offset = probationDayOffset(startDate, scheduledDate);
  return isFormalMilestoneDay(offset) ? offset : null;
}

export interface ProbationWeight {
  area: string;
  weight: number;
}

export interface ProbationBand {
  minScore: number;
  maxScore: number;
  label: string;
  recommendedOutcome?: string | null;
  meaning?: string | null;
}

/** Stable slug key for a weighted area name (used as the reviewScores map key). */
export function probationAreaKey(area: string): string {
  return area
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Weighted overall score (0-100) from per-area scores keyed by area slug.
 * Ignores areas with a missing/invalid score so a partial scorecard does not
 * silently inflate the result — callers should validate completeness first.
 */
export function computeWeightedOverall(
  scores: Record<string, number>,
  weights: ProbationWeight[],
): number {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const w of weights) {
    const key = probationAreaKey(w.area);
    const raw = scores[key];
    if (typeof raw !== "number" || Number.isNaN(raw)) continue;
    const clamped = Math.max(0, Math.min(100, raw));
    weightedSum += clamped * w.weight;
    totalWeight += w.weight;
  }
  if (totalWeight === 0) return 0;
  return Math.round(weightedSum / totalWeight);
}

/** Resolve the band a score falls into. */
export function resolveBand(score: number, bands: ProbationBand[]): ProbationBand | null {
  for (const b of bands) {
    if (score >= b.minScore && score <= b.maxScore) return b;
  }
  return null;
}

/** Shape persisted in check_ins.review_scores for a milestone scorecard. */
export interface ProbationReviewScores {
  scores: Record<string, number>;
  overall: number;
  band?: string | null;
  recommendedOutcome?: string | null;
  decisionNote?: string | null;
}
