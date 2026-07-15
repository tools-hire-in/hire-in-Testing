/**
 * Task #1115 — Goal Auto-Progress Service
 * Calculates actual progress for auto-trackable goal metric types.
 *
 * Currently supported metric types:
 *   call_volume        — sum of calls_made from recruiter_activity_logs
 *   interview_conversion — % of submissions that reached phone_screen or above
 *   placement_count    — count of placed applications in the plan period
 *
 * This service is used by the Goal Auto-Progress Engine to back-fill actuals
 * for performance goals tagged with these metric types.
 */
import { db } from "./db";
import { and, eq, gte, lte, sql, inArray } from "drizzle-orm";
import { recruiterActivityLogs, applications, applicationStageHistory } from "@shared/schema";

export interface AutoProgressResult {
  metricType: string;
  recruiterId: string;
  periodFrom: string;
  periodTo: string;
  actual: number;
  unit: string;
  detail?: Record<string, any>;
}

/**
 * Calculate total calls made by a recruiter in a date range.
 * Returns the sum of calls_made from recruiter_activity_logs.
 */
export async function computeCallVolume(
  recruiterId: string,
  periodFrom: string,
  periodTo: string,
): Promise<AutoProgressResult> {
  const [row] = await db
    .select({
      totalCalls: sql<number>`COALESCE(SUM(${recruiterActivityLogs.callsMade}), 0)::int`,
      workingDays: sql<number>`COUNT(DISTINCT ${recruiterActivityLogs.logDate})::int`,
    })
    .from(recruiterActivityLogs)
    .where(
      and(
        eq(recruiterActivityLogs.recruiterId, recruiterId),
        gte(recruiterActivityLogs.logDate, periodFrom),
        lte(recruiterActivityLogs.logDate, periodTo),
      ),
    );

  const totalCalls = row?.totalCalls ?? 0;
  const workingDays = row?.workingDays ?? 0;
  const dailyAvg = workingDays > 0 ? Math.round((totalCalls / workingDays) * 10) / 10 : 0;

  return {
    metricType: "call_volume",
    recruiterId,
    periodFrom,
    periodTo,
    actual: totalCalls,
    unit: "calls",
    detail: { totalCalls, workingDays, dailyAvg },
  };
}

/**
 * Calculate interview conversion rate for a recruiter.
 * Formula: (submissions that EVER reached phone_screen or above) / total submissions × 100
 *
 * Uses application_stage_history for accuracy: a submission that reached "phone_screen"
 * and later moved to "rejected" still counts as converted. This prevents undercounting
 * candidates who progressed but ultimately didn't get placed.
 *
 * Only counts submissions created within the plan period.
 */
export async function computeInterviewConversion(
  recruiterId: string,
  periodFrom: string,
  periodTo: string,
): Promise<AutoProgressResult> {
  const ADVANCED_STAGES = ["phone_screen", "technical_interview", "final_interview", "offer_made", "placed"];

  // Step 1: get all applications submitted by this recruiter in the period
  const periodApps = await db
    .select({ id: applications.id })
    .from(applications)
    .where(
      and(
        eq(applications.recruiterId, recruiterId),
        gte(applications.createdAt, new Date(periodFrom)),
        lte(applications.createdAt, new Date(periodTo + "T23:59:59Z")),
      ),
    );

  const totalSubmissions = periodApps.length;
  if (totalSubmissions === 0) {
    return {
      metricType: "interview_conversion",
      recruiterId,
      periodFrom,
      periodTo,
      actual: 0,
      unit: "percent",
      detail: { totalSubmissions: 0, advancedCount: 0 },
    };
  }

  const appIds = periodApps.map((a) => a.id);

  // Step 2: count distinct applications that ever reached an advanced stage via history
  const [historyRow] = await db
    .select({
      advancedCount: sql<number>`COUNT(DISTINCT ${applicationStageHistory.applicationId})::int`,
    })
    .from(applicationStageHistory)
    .where(
      and(
        inArray(applicationStageHistory.applicationId, appIds),
        inArray(applicationStageHistory.toStage, ADVANCED_STAGES),
      ),
    );

  const advancedCount = historyRow?.advancedCount ?? 0;
  const conversionPct = Math.round((advancedCount / totalSubmissions) * 100);

  return {
    metricType: "interview_conversion",
    recruiterId,
    periodFrom,
    periodTo,
    actual: conversionPct,
    unit: "percent",
    detail: { totalSubmissions, advancedCount },
  };
}

/**
 * Count placements made by a recruiter in the period.
 * A placement is an application where stage = 'placed' AND placement_date is within the period.
 */
export async function computePlacementCount(
  recruiterId: string,
  periodFrom: string,
  periodTo: string,
): Promise<AutoProgressResult> {
  const [row] = await db
    .select({
      placements: sql<number>`COUNT(*)::int`,
    })
    .from(applications)
    .where(
      and(
        eq(applications.recruiterId, recruiterId),
        eq(applications.stage, "placed"),
        gte(applications.placementDate, periodFrom),
        lte(applications.placementDate, periodTo),
      ),
    );

  const placements = row?.placements ?? 0;

  return {
    metricType: "placement_count",
    recruiterId,
    periodFrom,
    periodTo,
    actual: placements,
    unit: "placements",
    detail: { placements },
  };
}

/**
 * Dispatcher: given a goal's metric type, recruiter, and period, compute the actual progress.
 * Returns null for metric types that are not auto-calculable.
 */
export async function computeGoalProgress(
  metricType: string,
  recruiterId: string,
  periodFrom: string,
  periodTo: string,
): Promise<AutoProgressResult | null> {
  switch (metricType) {
    case "call_volume":
      return computeCallVolume(recruiterId, periodFrom, periodTo);
    case "interview_conversion":
      return computeInterviewConversion(recruiterId, periodFrom, periodTo);
    case "placement_count":
      return computePlacementCount(recruiterId, periodFrom, periodTo);
    default:
      return null;
  }
}

/**
 * Keyword classifier: given a goal title or description, guess the metric type.
 * Used for the one-time backfill when goals are created without explicit metric types.
 */
export function classifyGoalMetricType(text: string): string | null {
  const lower = text.toLowerCase();

  if (
    lower.includes("call") ||
    lower.includes("dial") ||
    lower.includes("outreach") ||
    lower.includes("volume") ||
    lower.includes("calls per day") ||
    lower.includes("daily calls")
  ) return "call_volume";

  if (
    lower.includes("interview conversion") ||
    lower.includes("screen rate") ||
    lower.includes("conversion rate") ||
    lower.includes("submission to interview") ||
    lower.includes("phone screen")
  ) return "interview_conversion";

  if (
    lower.includes("placement") ||
    lower.includes("placed") ||
    lower.includes("fill") ||
    lower.includes("hire")
  ) return "placement_count";

  return null;
}

/** All auto-trackable metric types in this module. */
export const AUTO_TRACKABLE_METRIC_TYPES = ["call_volume", "interview_conversion", "placement_count"] as const;
