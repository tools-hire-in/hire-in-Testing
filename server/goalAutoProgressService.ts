/**
 * Goal Auto-Progress Service
 *
 * Daily engine that identifies which performance_goals have a known
 * auto-calculable metric type, queries the relevant table, computes
 * actual progress for the plan period, and writes it as a SUGGESTION
 * (suggested_progress) rather than directly overwriting progress.
 *
 * Goodhart Guard (Task #1107):
 *   - Progress changes are written to `suggested_progress` with
 *     `progress_pending_review = true`. The manager must confirm or adjust
 *     before `progress` is updated.
 *   - Velocity anomaly check: if an employee is on an active PIP or probation
 *     AND the goal's computed value moves by more than 2× the 4-week rolling
 *     average, the goal is flagged with `progress_anomaly_flagged = true` and
 *     the manager is notified immediately. Anomaly-flagged goals are NEVER
 *     auto-committed by the 48-hour fallback cron.
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
import { notifyUser } from "./notifications";
import { emitGovernanceEvent } from "./governanceEvents";

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
  suggested_progress: number | null;
  progress_pending_review: boolean;
  progress_anomaly_flagged: boolean;
  start_date: string | null;
  target_date: string | null;
  plan_start_date: string | null;
  plan_end_date: string | null;
  plan_type: string | null;
  manager_id: string | null;
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

// ─── Velocity anomaly detector ────────────────────────────────────────────────

/**
 * Compute elapsed Mon–Fri working hours (09:00–18:00 IST) between two UTC
 * timestamps. Used to enforce the 48-working-hour auto-commit threshold.
 */
export function workingHoursElapsed(fromUtc: Date, toUtc: Date): number {
  const IST_MS   = 5.5 * 3_600_000; // UTC+5:30 in ms
  const WORK_START = 9;              // 09:00 IST
  const WORK_END   = 18;             // 18:00 IST

  if (fromUtc >= toUtc) return 0;

  const fromIST = new Date(fromUtc.getTime() + IST_MS);
  const toIST   = new Date(toUtc.getTime()   + IST_MS);

  let total = 0;
  // Walk calendar day-by-day in IST midnight boundaries
  const day = new Date(fromIST);
  day.setUTCHours(0, 0, 0, 0);

  while (day.getTime() <= toIST.getTime()) {
    const dow = day.getUTCDay(); // 0=Sun … 6=Sat
    if (dow >= 1 && dow <= 5) { // Mon–Fri only
      const wStart = new Date(day); wStart.setUTCHours(WORK_START, 0, 0, 0);
      const wEnd   = new Date(day); wEnd.setUTCHours(WORK_END,     0, 0, 0);
      const lo = Math.max(fromIST.getTime(), wStart.getTime());
      const hi = Math.min(toIST.getTime(),   wEnd.getTime());
      if (hi > lo) total += (hi - lo) / 3_600_000;
    }
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return total;
}

/**
 * Detect if this week's submission count is anomalously high compared to the
 * 4-week rolling average of WEEKLY RAW SUBMISSION COUNTS for the same recruiter.
 *
 * Spec: guard fires only for `submission_count` goals on active PIP or probation
 * plans, and only when this week's raw count > 2× the 4-week rolling average.
 * Raw weekly counts from the `applications` table are the ground truth — NOT
 * the computed progress% from goal_progress_snapshots, which would mask the
 * real gaming signal.
 *
 * Falls back to no-anomaly when fewer than 2 prior weeks of data are available.
 */
async function detectVelocityAnomaly(goal: GoalRow, _newProgress: number): Promise<boolean> {
  if (!goal.plan_type || !["pip", "probation"].includes(goal.plan_type)) return false;
  if (goal.goal_metric_type !== "submission_count") return false;

  try {
    // This week's raw submission count (Mon 00:00 IST through now)
    const thisWeekRes = await db.execute(sql`
      SELECT COUNT(*)::int AS cnt
      FROM applications
      WHERE recruiter_id = ${goal.employee_id}
        AND created_at >= (date_trunc('week', NOW() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')
        AND (ceipal_sync_status IS NULL OR ceipal_sync_status != 'failed')
    `);
    const weekCount = Number((thisWeekRes.rows[0] as any)?.cnt ?? 0);

    // 4-week rolling average — bucket submissions by ISO week in IST, take last 4 completed weeks
    const rollingRes = await db.execute(sql`
      SELECT COUNT(*)::int AS week_count
      FROM (
        SELECT date_trunc('week', created_at AT TIME ZONE 'Asia/Kolkata') AS week_start
        FROM applications
        WHERE recruiter_id = ${goal.employee_id}
          AND created_at >= NOW() - INTERVAL '28 days'
          AND created_at < date_trunc('week', NOW() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'
          AND (ceipal_sync_status IS NULL OR ceipal_sync_status != 'failed')
      ) sub
      GROUP BY week_start
      ORDER BY week_start DESC
      LIMIT 4
    `);

    const weekCounts = (rollingRes.rows as any[]).map(r => Number(r.week_count ?? 0));
    if (weekCounts.length < 2) return false;

    const rollingAvg = weekCounts.reduce((a, b) => a + b, 0) / weekCounts.length;
    if (rollingAvg <= 0) return false;

    return weekCount > rollingAvg * 2;
  } catch {
    return false;
  }
}

// ─── Main sync function ───────────────────────────────────────────────────────

export interface GoalAutoProgressSyncResult {
  suggested: number;
  skipped: number;
  anomalyFlagged: number;
  escalationFlagged: number;
  errors: number;
}

/**
 * Daily engine: fetch all auto-trackable active plan goals, compute progress,
 * and write as a SUGGESTION rather than directly overwriting progress.
 *
 * Goodhart Guard:
 *   - Writes `suggested_progress` + sets `progress_pending_review = true`.
 *   - `progress` is NOT touched — a manager must confirm (or it auto-commits
 *     after 48 working hours via the separate auto-commit cron).
 *   - If velocity anomaly detected → `progress_anomaly_flagged = true` and
 *     manager notified. Anomaly-flagged goals are EXCLUDED from auto-commit.
 *
 * Skip rule: skip when manager entered manually AND diff ≤ 5 points
 *            (prevents constant small oscillations from triggering review).
 *
 * Escalation rule: if progress REGRESSED by > 15 points since current progress,
 *   flag `escalation_flag = true` for the governance engine.
 */
export async function runGoalAutoProgressSync(): Promise<GoalAutoProgressSyncResult> {
  let suggested = 0;
  let skipped = 0;
  let anomalyFlagged = 0;
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
        pg.suggested_progress,
        pg.progress_pending_review,
        pg.progress_anomaly_flagged,
        pg.start_date,
        pg.target_date,
        ep.start_date AS plan_start_date,
        ep.end_date   AS plan_end_date,
        ep.plan_type,
        pg.manager_id
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

        // Detect significant regression (> 15 points drop) for escalation flag
        const regressed = newProgress < currentProgress - 15;

        // Detect velocity anomaly for PIP/probation plans
        const isAnomaly = await detectVelocityAnomaly(goal, newProgress);

        // ── Goodhart Guard: write suggestion, not direct progress ──────────
        // IMPORTANT: only reset suggested_progress_at when the suggested value
        // materially changes (> 2 points). Preserving the original timestamp
        // ensures the 48-working-hour auto-commit fallback can fire even if
        // the daily sync re-runs with a nearly identical suggestion.
        await db.execute(sql`
          UPDATE performance_goals
          SET
            suggested_progress = ${newProgress},
            progress_pending_review = true,
            progress_anomaly_flagged = ${isAnomaly},
            suggested_progress_at = CASE
              WHEN suggested_progress IS NULL
                OR ABS(COALESCE(suggested_progress, -999::numeric) - ${newProgress}::numeric) > 2
              THEN NOW()
              ELSE suggested_progress_at
            END,
            goal_progress_source = 'auto',
            goal_progress_updated_at = NOW(),
            updated_at = NOW()
          WHERE id = ${goal.id}
        `);

        suggested++;

        // Notify manager of anomaly immediately
        if (isAnomaly && goal.manager_id) {
          await notifyUser({
            userId: goal.manager_id,
            type: "goal_progress_anomaly" as any,
            title: "Unusual goal progress detected",
            message: `A goal's auto-calculated progress jumped to ${newProgress}% (>2× the rolling average). Please review before confirming.`,
            metadata: { goalId: goal.id, suggestedProgress: newProgress },
          }).catch(console.error);
          anomalyFlagged++;
        }

        // Flag escalation on significant regression
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

  return { suggested, skipped, anomalyFlagged, escalationFlagged, errors };
}

/**
 * Auto-commit cron: runs every 4 hours. Finds goals with pending review
 * where ≥ 48 Mon–Fri working hours (09:00–18:00 IST) have elapsed since
 * `suggested_progress_at` and no manager action has been taken.
 * Anomaly-flagged goals are EXCLUDED — they must be manually confirmed.
 *
 * "48 working hours" = 48h of Mon–Fri 09:00–18:00 IST clock time,
 * computed precisely via `workingHoursElapsed`.  The DB query uses a
 * 48-calendar-hour lower bound to skip obviously-too-recent suggestions
 * before the JS check runs.
 */
export async function runProgressAutoCommit(): Promise<{ committed: number; errors: number }> {
  let committed = 0;
  let errors = 0;
  const now = new Date();

  try {
    // Initial filter: at least 48 calendar hours old (avoids iterating fresh suggestions).
    // The precise 48-working-hour gate is enforced in JS below.
    const pending = await db.execute(sql`
      SELECT id, suggested_progress, manager_id, suggested_progress_at
      FROM performance_goals
      WHERE progress_pending_review = true
        AND progress_anomaly_flagged = false
        AND suggested_progress IS NOT NULL
        AND suggested_progress_at IS NOT NULL
        AND suggested_progress_at <= NOW() - INTERVAL '48 hours'
    `);

    for (const row of pending.rows as any[]) {
      try {
        const suggestedAt = new Date(row.suggested_progress_at);
        // Precise 48-working-hour gate
        if (workingHoursElapsed(suggestedAt, now) < 48) continue;

        await db.execute(sql`
          UPDATE performance_goals
          SET
            progress = ${row.suggested_progress},
            progress_pending_review = false,
            goal_progress_source = 'auto_committed',
            progress_confirmed_at = NOW(),
            progress_confirmed_by = 'system_autocommit',
            last_progress_updated_at = NOW(),
            updated_at = NOW()
          WHERE id = ${row.id}
        `);

        // Emit governance event on any associated control (non-fatal)
        db.execute(sql`
          SELECT id FROM governance_controls
          WHERE control_type::text = 'goal'
            AND reference_id = ${'goal:' + String(row.id)}
            AND status NOT IN ('closed','completed')
          LIMIT 1
        `).then(res => {
          if (res.rows.length > 0) {
            emitGovernanceEvent({
              controlId: (res.rows[0] as any).id,
              eventType: "status_changed",
              source: "scheduler",
              actorId: null,
              metadata: { action: "auto_committed", committedValue: row.suggested_progress },
            }).catch(console.error);
          }
        }).catch(() => {});

        committed++;
      } catch (e) {
        console.error(`[goalAutoProgress] Auto-commit failed for goal ${row.id}:`, e);
        errors++;
      }
    }
  } catch (err) {
    console.error("[goalAutoProgress] Auto-commit sweep failed:", err);
    errors++;
  }

  return { committed, errors };
}
