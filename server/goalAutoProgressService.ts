/**
 * Goal Auto-Progress Service
 *
 * Daily engine that identifies which performance_goals have a known
 * auto-calculable metric type, queries the relevant table, computes
 * actual progress for the plan period, and updates progress automatically.
 *
 * Runs at 7:00 AM IST (before the 8:30 AM absent sweep).
 *
 * Supported auto-trackable metric types:
 *   submission_count       — recruiter submissions in period vs weekly target
 *   ats_compliance         — % of applications updated within 24 h of creation
 *   attendance_consistency — present days / working days (M–F, excl. holidays)
 *   sop_completion         — acknowledged SOPs / assigned SOPs
 *   training_completion    — completed tracks / total assigned
 */

import { db } from "./db";
import { sql } from "drizzle-orm";

// ─── Metric type constants ────────────────────────────────────────────────────

export type GoalMetricType =
  | "submission_count"
  | "ats_compliance"
  | "attendance_consistency"
  | "sop_completion"
  | "training_completion"
  | "manual";

/** All metric types that can be auto-calculated from system data. */
export const AUTO_TRACKABLE_METRIC_TYPES: readonly GoalMetricType[] = [
  "submission_count",
  "ats_compliance",
  "attendance_consistency",
  "sop_completion",
  "training_completion",
];

// ─── Keyword classifier ───────────────────────────────────────────────────────

/**
 * Classify a goal's metric type from its target_metric text using keyword
 * matching. Used for the one-time backfill of existing active plan goals.
 */
export function classifyGoalMetricType(targetMetric: string | null | undefined): GoalMetricType {
  if (!targetMetric) return "manual";
  const t = targetMetric.toLowerCase();

  // ATS compliance check comes before submission_count to avoid partial-match ambiguity
  if (t.includes("ats update") || t.includes("same-day") || t.includes("compliance")) {
    return "ats_compliance";
  }
  if (t.includes("submission") || t.includes("ats") || t.includes("applicant")) {
    return "submission_count";
  }
  if (t.includes("attendance") || t.includes("punch") || t.includes("present")) {
    return "attendance_consistency";
  }
  if (t.includes("sop") || t.includes("acknowledge") || t.includes("policy")) {
    return "sop_completion";
  }
  if (t.includes("training") || t.includes("module") || t.includes("certification")) {
    return "training_completion";
  }

  return "manual";
}

// ─── Internal goal row shape ──────────────────────────────────────────────────

interface GoalRow {
  id: string;
  employee_id: string;
  plan_id: string | null;
  goal_metric_type: string;
  goal_metric_config: Record<string, any> | null;
  goal_progress_source: string | null;
  progress: number;
  start_date: string | null;
  target_date: string | null;
  plan_start_date: string | null;
  plan_end_date: string | null;
}

/** Resolve the effective date range for a goal within its plan period. */
function resolveDateRange(goal: GoalRow): { from: string; to: string } | null {
  const planStart = goal.plan_start_date || goal.start_date;
  const today = new Date().toISOString().slice(0, 10);

  if (!planStart) return null;

  // If the goal has a target_date (milestone date), cap the window there
  const to = goal.target_date && goal.target_date < today ? goal.target_date : today;
  return { from: planStart, to };
}

// ─── Per-metric calculation helpers ──────────────────────────────────────────

/** submission_count: recruiter submissions in period vs weekly target. */
async function calcSubmissionCount(goal: GoalRow): Promise<number> {
  const range = resolveDateRange(goal);
  if (!range) return 0;

  const config = goal.goal_metric_config ?? {};
  const weeklyTarget: number = config.weeklyTarget ?? 5;

  const result = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt
    FROM applications
    WHERE recruiter_id = ${goal.employee_id}
      AND created_at::date >= ${range.from}::date
      AND created_at::date <= ${range.to}::date
      AND (ceipal_sync_status IS NULL OR ceipal_sync_status != 'failed')
  `);

  const actual = Number((result.rows[0] as any)?.cnt ?? 0);

  // Weeks elapsed in range
  const fromMs = new Date(range.from).getTime();
  const toMs = new Date(range.to).getTime();
  const weeks = Math.max(1, (toMs - fromMs) / (7 * 86400000));
  const totalTarget = weeklyTarget * weeks;

  return Math.min(100, Math.round((actual / totalTarget) * 100));
}

/** ats_compliance: applications updated within lagHours of creation vs total. */
async function calcAtsCompliance(goal: GoalRow): Promise<number> {
  const range = resolveDateRange(goal);
  if (!range) return 0;

  const config = goal.goal_metric_config ?? {};
  const lagHours: number = config.lagHours ?? 24;

  const result = await db.execute(sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (
        WHERE EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600 <= ${lagHours}
      )::int AS compliant
    FROM applications
    WHERE recruiter_id = ${goal.employee_id}
      AND created_at::date >= ${range.from}::date
      AND created_at::date <= ${range.to}::date
  `);

  const row = result.rows[0] as any;
  const total = Number(row?.total ?? 0);
  const compliant = Number(row?.compliant ?? 0);

  if (total === 0) return 0;
  return Math.min(100, Math.round((compliant / total) * 100));
}

/** attendance_consistency: present_days / working_days (M–F, excl. non-optional holidays). */
async function calcAttendanceConsistency(goal: GoalRow): Promise<number> {
  const range = resolveDateRange(goal);
  if (!range) return 0;

  // Get non-optional holidays in range
  const holidayResult = await db.execute(sql`
    SELECT date FROM holidays
    WHERE is_optional = false
      AND date >= ${range.from}
      AND date <= ${range.to}
  `);
  const holidaySet = new Set<string>((holidayResult.rows as any[]).map((h: any) => h.date));

  // Count working days (Mon–Fri, excluding holidays)
  let workingDays = 0;
  const cur = new Date(range.from + "T12:00:00Z");
  const end = new Date(range.to + "T12:00:00Z");
  while (cur <= end) {
    const dow = cur.getUTCDay();
    const dateStr = cur.toISOString().slice(0, 10);
    if (dow !== 0 && dow !== 6 && !holidaySet.has(dateStr)) {
      workingDays++;
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  if (workingDays === 0) return 0;

  // Count days with a "present" status (including late, half_day, short_day)
  const attResult = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt
    FROM attendance
    WHERE user_id = ${goal.employee_id}
      AND date >= ${range.from}
      AND date <= ${range.to}
      AND status IN ('present', 'late', 'half_day', 'short_day')
  `);
  const present = Number((attResult.rows[0] as any)?.cnt ?? 0);

  return Math.min(100, Math.round((present / workingDays) * 100));
}

/** sop_completion: acknowledged SOPs / total assigned. */
async function calcSopCompletion(goal: GoalRow): Promise<number> {
  const result = await db.execute(sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE acknowledged_at IS NOT NULL)::int AS acknowledged
    FROM sop_employee_progress
    WHERE user_id = ${goal.employee_id}
  `);

  const row = result.rows[0] as any;
  const total = Number(row?.total ?? 0);
  const acknowledged = Number(row?.acknowledged ?? 0);

  if (total === 0) return 0;
  return Math.min(100, Math.round((acknowledged / total) * 100));
}

/** training_completion: completed tracks / total assigned in period. */
async function calcTrainingCompletion(goal: GoalRow): Promise<number> {
  const range = resolveDateRange(goal);
  if (!range) return 0;

  const result = await db.execute(sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'completed')::int AS completed
    FROM track_assignments
    WHERE user_id = ${goal.employee_id}
      AND assigned_at::date >= ${range.from}::date
      AND assigned_at::date <= ${range.to}::date
  `);

  const row = result.rows[0] as any;
  const total = Number(row?.total ?? 0);
  const completed = Number(row?.completed ?? 0);

  if (total === 0) return 0;
  return Math.min(100, Math.round((completed / total) * 100));
}

/**
 * Compute the auto-calculated progress (0–100) for a single goal row.
 * Returns null when the metric type is not auto-trackable or calculation fails.
 *
 * Exported so performanceRoutes.ts can call it for on-demand refresh.
 */
export async function computeGoalProgress(goal: GoalRow): Promise<number | null> {
  try {
    switch (goal.goal_metric_type as GoalMetricType) {
      case "submission_count":
        return await calcSubmissionCount(goal);
      case "ats_compliance":
        return await calcAtsCompliance(goal);
      case "attendance_consistency":
        return await calcAttendanceConsistency(goal);
      case "sop_completion":
        return await calcSopCompletion(goal);
      case "training_completion":
        return await calcTrainingCompletion(goal);
      default:
        return null;
    }
  } catch (err) {
    console.error(
      `[goalAutoProgress] Calculation failed for goal ${goal.id} (${goal.goal_metric_type}):`,
      err,
    );
    return null;
  }
}

// ─── Main sync function ───────────────────────────────────────────────────────

export interface GoalAutoProgressSyncResult {
  synced: number;
  skipped: number;
  escalationFlagged: number;
  errors: number;
}

/**
 * Daily engine: fetch all auto-trackable active plan goals, compute progress,
 * and update the DB. Registered at 7:00 AM IST in scheduler.ts.
 *
 * Overwrite rule: auto-calculated value overwrites a manual entry ONLY when the
 * difference is > 5 points — prevents constant small oscillations from clobbering
 * a manager's deliberate adjustment.
 *
 * Escalation rule: if progress REGRESSED by > 15 points since the last value,
 * flag the goal with escalation_flag = true for the governance engine.
 */
export async function runGoalAutoProgressSync(): Promise<GoalAutoProgressSyncResult> {
  let synced = 0;
  let skipped = 0;
  let escalationFlagged = 0;
  let errors = 0;

  try {
    // Fetch all auto-trackable goals on ACTIVE plans
    const goalsResult = await db.execute(sql`
      SELECT
        pg.id,
        pg.employee_id,
        pg.plan_id,
        pg.goal_metric_type,
        pg.goal_metric_config,
        pg.goal_progress_source,
        pg.progress,
        pg.start_date,
        pg.target_date,
        ep.start_date AS plan_start_date,
        ep.end_date   AS plan_end_date
      FROM performance_goals pg
      LEFT JOIN employee_plans ep ON ep.id = pg.plan_id
      WHERE pg.goal_metric_type IS NOT NULL
        AND pg.goal_metric_type != 'manual'
        AND (pg.plan_id IS NULL OR ep.status = 'active')
    `);

    const goals = goalsResult.rows as GoalRow[];

    for (const goal of goals) {
      try {
        const newProgress = await computeGoalProgress(goal);
        if (newProgress === null) {
          skipped++;
          continue;
        }

        const currentProgress = Number(goal.progress ?? 0);
        const diff = Math.abs(newProgress - currentProgress);

        // Skip overwrite when manager entered manually AND diff is tiny (≤ 5)
        if (goal.goal_progress_source === "manual" && diff <= 5) {
          skipped++;
          continue;
        }

        // Detect significant regression (> 15 points drop)
        const regressed = newProgress < currentProgress - 15;

        // Update progress + source markers
        await db.execute(sql`
          UPDATE performance_goals
          SET
            progress = ${newProgress},
            goal_progress_source = 'auto',
            goal_progress_updated_at = NOW(),
            last_progress_updated_at = NOW(),
            updated_at = NOW()
          WHERE id = ${goal.id}
        `);

        synced++;

        // Optionally flag escalation on significant regression
        if (regressed) {
          await db.execute(sql`
            UPDATE performance_goals
            SET escalation_flag = true
            WHERE id = ${goal.id}
          `).catch(() => {
            // escalation_flag column may not be present — non-fatal
          });
          escalationFlagged++;
        }
      } catch (goalErr) {
        console.error(`[goalAutoProgress] Error processing goal ${goal.id}:`, goalErr);
        errors++;
      }
    }
  } catch (err) {
    console.error("[goalAutoProgress] Fatal error in runGoalAutoProgressSync:", err);
    errors++;
  }

  return { synced, skipped, escalationFlagged, errors };
}
