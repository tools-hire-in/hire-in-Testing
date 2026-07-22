import { getCurrentShiftTiming, shiftTimeToMinutes } from "./shiftUtils.js";
import { db } from "./db.js";
import { storage } from "./storage.js";
import { sql, eq, and, isNull } from "drizzle-orm";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export interface LateStatus {
  status: "present" | "late";
  notes: string;
}

export interface HalfDayResult {
  status: string;
  notes: string | undefined;
}

export interface GraceUsageRow {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  shift: string;
  lateCount: number;
}

interface GraceRow {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  department_name: string | null;
  shift_label: string | null;
  late_count: number;
}

/**
 * Determine whether a punch-in is on-time or late given the user's shift.
 *
 * Overnight shifts (where grace end crosses midnight) are handled by anchoring
 * comparisons to the full IST datetime of the punch:
 *   - Punch at/after shift start (same evening) → present (pre-midnight window)
 *   - Punch at/before graceEndNorm (post-midnight) → present (within grace)
 *   - Punch in the ambiguous zone (graceEndNorm < T < shiftStart): if before noon
 *     IST → post-midnight late; if at/after noon IST → pre-shift same evening → present
 *
 * Returns null when the shift cannot be found.
 */
export async function computeLateStatus(
  shiftId: string,
  punchTime: Date,
): Promise<LateStatus | null> {
  const timing = await getCurrentShiftTiming(shiftId);
  if (!timing) return null;

  // Derive IST minute-of-day from the full IST datetime (avoids pure minute-of-day wrapping bugs)
  const punchIST = new Date(punchTime.getTime() + IST_OFFSET_MS);
  const punchISTMinutes = punchIST.getUTCHours() * 60 + punchIST.getUTCMinutes();

  const shiftStartMinutes = shiftTimeToMinutes(timing.istStart);
  const grace = timing.gracePeriodMinutes;

  // Signed minute difference from the shift start, wrapped into a 24h window
  // centred on the shift start. This single formulation handles every case:
  //   - on-time / late punches (positive delta),
  //   - early punches before the shift starts (negative delta),
  //   - overnight shifts and post-midnight punches (the wrap pulls a small
  //     post-midnight minute-of-day back to a large positive delta = very late),
  //   - DST (timing.istStart already reflects the active DST start time),
  //   - zero grace (delta > 0 is immediately late).
  // The ±720 boundary is the natural ambiguity split between "early this evening"
  // and "very late" for overnight shifts.
  let delta = punchISTMinutes - shiftStartMinutes;
  if (delta >= 720) delta -= 1440;
  if (delta < -720) delta += 1440;

  // No grace → late the moment delta exceeds 0. With grace → late past start+grace.
  const isLate = delta > grace;
  // delta > 0 but within the grace window → on-time but consumed grace.
  const withinGrace = !isLate && delta > 0 && grace > 0;

  const graceEndNorm = (shiftStartMinutes + grace) % 1440;
  const graceEndHH = String(Math.floor(graceEndNorm / 60)).padStart(2, "0");
  const graceEndMM = String(graceEndNorm % 60).padStart(2, "0");
  const startHH = String(Math.floor(shiftStartMinutes / 60)).padStart(2, "0");
  const startMM = String(shiftStartMinutes % 60).padStart(2, "0");

  // Explicitly label the three punch-in categories so the record makes the
  // classification unambiguous: late, within-grace (on time but used grace), or on time.
  let notes: string;
  if (isLate) {
    notes = grace > 0
      ? `[Auto] Late punch-in: ${delta} min after shift start (${startHH}:${startMM} IST); grace window ended at ${graceEndHH}:${graceEndMM} IST`
      : `[Auto] Late punch-in: ${delta} min after shift start (${startHH}:${startMM} IST, no grace)`;
  } else if (withinGrace) {
    notes = `Within grace: punched in ${delta} min after shift start (${startHH}:${startMM} IST); grace window ends ${graceEndHH}:${graceEndMM} IST`;
  } else {
    notes = `On time. Shift started at ${startHH}:${startMM} IST`;
  }

  return { status: isLate ? "late" : "present", notes };
}

/**
 * Determine the day-completion status at punch-out from worked hours.
 *
 * Tiers (thresholds derived from the employee's OWN scheduled hours, so a
 * part-timer on a shorter shift is judged against their own full day, i.e.
 * part-time aware):
 *   - worked < half the scheduled hours          → half_day
 *   - worked ≥ half but < the full scheduled hours → short_day
 *   - worked ≥ the full scheduled hours           → unchanged (present/late)
 *
 * Only transitions "present" or "late" statuses; all others are left unchanged.
 */
export async function computeDayCompletionStatus(
  shiftId: string,
  totalHoursNum: number,
  currentStatus: string,
  opts?: { employeeId: string; date: string },
): Promise<HalfDayResult> {
  if (!["present", "late"].includes(currentStatus)) {
    return { status: currentStatus, notes: undefined };
  }
  const timing = await getCurrentShiftTiming(shiftId);
  if (!timing) return { status: currentStatus, notes: undefined };

  // Use global standard_shift_hours setting when set, fall back to per-shift value
  let fullThreshold = timing.scheduledHours;
  try {
    const setting = await storage.getSystemSetting("standard_shift_hours");
    if (setting?.value && typeof setting.value === "number" && setting.value > 0) {
      fullThreshold = setting.value;
    }
  } catch { /* non-fatal: use shift default */ }
  const halfThreshold = fullThreshold / 2;

  // Determine result first, then reconcile pool unconditionally.
  let result: HalfDayResult;
  if (totalHoursNum < halfThreshold) {
    result = {
      status: "half_day",
      notes: `[Auto] Half day: ${totalHoursNum.toFixed(2)} hrs worked (under half of ${fullThreshold}h, i.e. ${halfThreshold}h)`,
    };
  } else if (totalHoursNum < fullThreshold) {
    result = {
      status: "short_day",
      notes: `[Auto] Short day: ${totalHoursNum.toFixed(2)} hrs worked (under full day of ${fullThreshold}h)`,
    };
  } else {
    result = { status: currentStatus, notes: undefined };
  }

  // Reconcile deficit pool — ALWAYS write, even for non-short_day outcomes.
  // Writing 0 for half_day/full_day clears any stale short_day contribution so
  // month-end settlement never charges LWP for a deficit that was later corrected.
  if (opts?.employeeId && opts?.date) {
    try {
      const { getFeatureFlag } = await import("./featureFlags");
      if (await getFeatureFlag("attendance_deficit_pool_enabled")) {
        const poolMin = result.status === "short_day"
          ? Math.max(0, Math.round((fullThreshold - totalHoursNum) * 60))
          : 0; // 0 clears stale short_day entry for this date
        upsertDeficitPool(opts.employeeId, opts.date, poolMin).catch(
          (err) => console.warn("[deficit-pool] pool reconciliation failed:", err),
        );
      }
    } catch { /* non-fatal */ }
  }

  return result;
}

export interface LogoutStatus {
  /** "early" = before shift end, "overtime" = well past shift end, "on_time" = around shift end. */
  kind: "early" | "overtime" | "on_time";
  notes: string | null;
  /** True when this is a notable exception worth auditing / notifying a manager. */
  isException: boolean;
}

// Any punch-out before the shift end is an early logout; any punch-out after the
// shift end is overtime. A tiny ±1 min tolerance absorbs clock rounding so an
// exactly-on-time logout is not spuriously flagged; everything outside it is
// annotated and raised as an exception (audit + manager notification).
const EARLY_LOGOUT_THRESHOLD_MIN = 1;
const OVERTIME_THRESHOLD_MIN = 1;

/**
 * Determine whether a punch-out is an early logout or overtime relative to the
 * employee's shift end time. Mirrors the wrap-around logic of computeLateStatus
 * so overnight shifts (end after midnight IST) are handled correctly.
 *
 * Returns null when the shift cannot be found (caller should record no note).
 */
export async function computeLogoutStatus(
  shiftId: string,
  punchOutTime: Date,
): Promise<LogoutStatus | null> {
  const timing = await getCurrentShiftTiming(shiftId);
  if (!timing) return null;

  const punchIST = new Date(punchOutTime.getTime() + IST_OFFSET_MS);
  const punchISTMinutes = punchIST.getUTCHours() * 60 + punchIST.getUTCMinutes();

  const shiftEndMinutes = shiftTimeToMinutes(timing.istEnd);

  // Signed minute difference from the shift end, wrapped into a 24h window
  // centred on the shift end (same approach as computeLateStatus).
  let delta = punchISTMinutes - shiftEndMinutes;
  if (delta >= 720) delta -= 1440;
  if (delta < -720) delta += 1440;

  const endHH = String(Math.floor(shiftEndMinutes / 60)).padStart(2, "0");
  const endMM = String(shiftEndMinutes % 60).padStart(2, "0");

  if (delta < -EARLY_LOGOUT_THRESHOLD_MIN) {
    return {
      kind: "early",
      notes: `[Auto] Early logout: punched out ${Math.abs(delta)} min before shift end (${endHH}:${endMM} IST)`,
      isException: true,
    };
  }
  if (delta > OVERTIME_THRESHOLD_MIN) {
    return {
      kind: "overtime",
      notes: `[Auto] Overtime: punched out ${delta} min after shift end (${endHH}:${endMM} IST)`,
      isException: true,
    };
  }
  return { kind: "on_time", notes: null, isException: false };
}

/**
 * Count working days from `date` (inclusive) back to `today` (exclusive),
 * excluding weekends AND the supplied set of holiday date strings (YYYY-MM-DD).
 * Returns -1 for a future date.
 */
export function countWorkingDaysBack(date: string, today: string, holidaySet: Set<string> = new Set()): number {
  if (date > today) return -1;
  if (date === today) return 0;
  const start = new Date(date + "T00:00:00");
  const end = new Date(today + "T00:00:00");
  let wd = 0;
  const cur = new Date(start);
  while (cur < end) {
    const dow = cur.getDay();
    const ds = cur.toISOString().slice(0, 10);
    if (dow !== 0 && dow !== 6 && !holidaySet.has(ds)) wd++;
    cur.setDate(cur.getDate() + 1);
  }
  return wd;
}

/**
 * Returns true when a regularisation ticket date is within the 3-working-day window.
 */
export function isRegularisationAllowed(date: string, today: string): boolean {
  const wd = countWorkingDaysBack(date, today);
  return wd >= 0 && wd <= 3;
}

/**
 * Async: fetches public holidays from DB in the relevant date range and checks
 * whether an employee can submit a regularization for the given attendance date.
 */
export async function canSubmitRegularizationAsync(
  requestDate: string,
  today: string,
  windowDays: number,
): Promise<boolean> {
  // Quick range check first (avoids DB hit for obviously out-of-window dates)
  const roughDays = countWorkingDaysBack(requestDate, today);
  if (roughDays < 0 || roughDays > windowDays + 15) return false; // 15-day buffer for holidays

  // Fetch public holidays between requestDate and today to get accurate working-day count
  try {
    const { holidays: holidaysTable } = await import("@shared/schema");
    const { gte, lte, and: andOp, eq: eqOp } = await import("drizzle-orm");
    const rows = await db.select({ date: holidaysTable.date })
      .from(holidaysTable)
      .where(andOp(
        eqOp(holidaysTable.isOptional, false),
        gte(holidaysTable.date, requestDate),
        lte(holidaysTable.date, today),
      ));
    const holidaySet = new Set(rows.map(r => r.date));
    const wd = countWorkingDaysBack(requestDate, today, holidaySet);
    return wd >= 0 && wd <= windowDays;
  } catch {
    // Fall back to weekend-only calculation if DB query fails
    return roughDays >= 0 && roughDays <= windowDays;
  }
}

/**
 * Synchronous fallback (weekends only, no holiday exclusion).
 * Use canSubmitRegularizationAsync in route handlers where possible.
 */
export function canSubmitRegularization(requestDate: string, today: string, windowDays: number): boolean {
  const wd = countWorkingDaysBack(requestDate, today);
  return wd >= 0 && wd <= windowDays;
}

/**
 * Checks whether the acting role can take action on a regularization request.
 * Under the new run-lock model managers may act any time during the month
 * (until the attendance run is locked); HR/admin/super_admin always allowed.
 *
 * @deprecated The monthly-run-lock mechanism supersedes the old day-of-month
 * cutoff. This function is retained only for reference; do not add new callers.
 */
export function canActOnRegularization(
  actorRole: string,
): boolean {
  return ["hr", "admin", "super_admin", "manager"].includes(actorRole);
}

/**
 * Grace-period usage query: returns late-count per employee for the given month.
 * Managers are automatically scoped to their direct reports.
 */
export async function queryGraceUsage(
  userRole: string,
  callerId: string,
  month: string,
): Promise<GraceUsageRow[]> {
  const [year, mon] = month.split("-");
  const startDate = `${year}-${mon}-01`;
  const lastDay = new Date(parseInt(year), parseInt(mon), 0).getDate();
  const endDate = `${year}-${mon}-${String(lastDay).padStart(2, "0")}`;

  let allowedUserIds: string[] | null = null;
  if (userRole === "manager") {
    const teamMembers = await storage.getTeamMembers(callerId);
    allowedUserIds = teamMembers.map((m) => m.id);
    if (allowedUserIds.length === 0) return [];
  }

  const result = await db.execute(sql`
    SELECT
      a.user_id,
      u.first_name,
      u.last_name,
      u.email,
      d.name AS department_name,
      s.display_label AS shift_label,
      COUNT(*)::int AS late_count
    FROM attendance a
    JOIN admin_users u ON u.id = a.user_id
    LEFT JOIN departments d ON d.id = u.department_id
    LEFT JOIN shifts s ON s.id = u.shift_id
    WHERE a.status = 'late'
      AND a.date >= ${startDate}
      AND a.date <= ${endDate}
      ${allowedUserIds ? sql`AND a.user_id = ANY(ARRAY[${sql.join(allowedUserIds.map((id) => sql`${id}`), sql`, `)}]::text[])` : sql``}
    GROUP BY a.user_id, u.first_name, u.last_name, u.email, d.name, s.display_label
    ORDER BY late_count DESC
  `);

  return (result.rows as GraceRow[]).map((r) => ({
    userId:     r.user_id,
    firstName:  r.first_name,
    lastName:   r.last_name,
    email:      r.email,
    department: r.department_name ?? "—",
    shift:      r.shift_label ?? "—",
    lateCount:  r.late_count,
  }));
}

/**
 * Check if an attendance date is within the strict 24-hour filing window.
 *
 * Two rules must BOTH pass:
 *  1. Current time ≤ end-of-attendanceDate (23:59:59 IST) + 24 hours
 *  2. Employee has not yet punched in on any date AFTER attendanceDate
 *     (once you start a new working day the prior day is locked)
 *
 * Returns { allowed: true } when filing is permitted.
 * Returns { allowed: false, reason: "24_hours_exceeded" | "next_punch_in_exists" } otherwise.
 */
export async function isWithinFilingWindow(
  employeeId: string,
  attendanceDate: string,
): Promise<{ allowed: boolean; reason?: string }> {
  // Window end = end-of-attendance-day in IST (23:59:59 IST) + 24 h.
  // Explicitly specify the IST offset (+05:30) so Date parsing is locale-independent.
  // "2024-06-10T23:59:59+05:30" → the JS Date constructor always interprets
  // the offset literally and produces a correct UTC epoch regardless of server TZ.
  const dayEndIST = new Date(`${attendanceDate}T23:59:59+05:30`);
  const windowEndMs = dayEndIST.getTime() + 24 * 60 * 60 * 1000;

  if (Date.now() > windowEndMs) {
    return { allowed: false, reason: "24_hours_exceeded" };
  }

  // Next-punch-in rule: any attendance record with a punchIn AFTER attendanceDate locks the prior day
  const rows = await db.execute(sql`
    SELECT id FROM attendance
    WHERE user_id = ${employeeId}
      AND date > ${attendanceDate}
      AND punch_in IS NOT NULL
    LIMIT 1
  `);

  if ((rows.rows as any[]).length > 0) {
    return { allowed: false, reason: "next_punch_in_exists" };
  }

  return { allowed: true };
}

/**
 * Check whether an attendance date falls in the month-end blackout period.
 * The blackout covers the last `blackoutDays` calendar days of the month.
 * e.g. blackoutDays=3 with a 30-day month → days 28, 29, 30 are blacked out.
 */
export function isBlackoutDate(attendanceDate: string, blackoutDays: number): boolean {
  if (blackoutDays <= 0) return false;
  const [year, month, day] = attendanceDate.split("-").map(Number);
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  return day > lastDayOfMonth - blackoutDays;
}

/**
 * Returns true when the given month is payroll-locked — i.e. a salary_report_runs
 * row exists for that year/month with status 'approved' or 'sent'.
 * Used by bulk-correction tools to prevent edits to closed payroll periods.
 */
export async function isMonthPayrollLocked(year: number, month: number): Promise<boolean> {
  const { salaryReportRuns } = await import("@shared/schema");
  const { and: andOp, eq: eqOp, inArray: inArrayOp } = await import("drizzle-orm");
  const rows = await db.select({ id: salaryReportRuns.id })
    .from(salaryReportRuns)
    .where(andOp(
      eqOp(salaryReportRuns.year, year),
      eqOp(salaryReportRuns.month, month),
      inArrayOp(salaryReportRuns.status, ["approved", "sent"]),
    ))
    .limit(1);
  return rows.length > 0;
}

// ── Two-Tier Attendance Classification — Deficit Pool ─────────────────────────

/**
 * Reconcile the per-day shortfall in the monthly deficit pool.
 *
 * ALWAYS writes — including when shortfallMin is 0. Writing 0 is how corrections
 * clear stale contributions: a day that was previously short_day but was later
 * regularised to a full day writes 0 for its date, which the JSONB SUM reflects.
 * This prevents month-end settlement from charging LWP for deficits that no
 * longer exist.
 *
 * JSONB merge semantics: the `||` operator replaces an existing key, so
 * re-processing the same date always sets (not adds) that day's value.
 *
 * @param employeeId   Employee's admin_users.id
 * @param date         Attendance date 'YYYY-MM-DD' — idempotency key
 * @param shortfallMin Pre-computed shortfall minutes (≥ 0). Pass 0 to clear a
 *                     stale short_day entry when the day is corrected away.
 */
export async function upsertDeficitPool(
  employeeId: string,
  date: string,         // 'YYYY-MM-DD'
  shortfallMin: number, // pass 0 to clear stale entries
): Promise<void> {
  const month = date.slice(0, 7);
  const clampedMin = Math.max(0, Math.round(shortfallMin));
  await db.execute(sql`
    INSERT INTO attendance_deficit_pool (employee_id, month, deficit_minutes, daily_contributions, updated_at)
    VALUES (
      ${employeeId}, ${month}, ${clampedMin},
      jsonb_build_object(${date}, ${clampedMin}::numeric),
      NOW()
    )
    ON CONFLICT (employee_id, month) DO UPDATE
      SET daily_contributions = CASE
            WHEN attendance_deficit_pool.settled_at IS NOT NULL
            -- Row was settled (e.g. manual mid-month run): start a fresh accumulation
            -- cycle. The settled amounts are preserved in audit_logs.
            THEN jsonb_build_object(${date}, ${clampedMin}::numeric)
            ELSE attendance_deficit_pool.daily_contributions
                 || jsonb_build_object(${date}, ${clampedMin}::numeric)
          END,
          deficit_minutes = GREATEST(0, (
            SELECT COALESCE(SUM((v.value)::numeric), 0)
            FROM jsonb_each(CASE
              WHEN attendance_deficit_pool.settled_at IS NOT NULL
              THEN jsonb_build_object(${date}, ${clampedMin}::numeric)
              ELSE attendance_deficit_pool.daily_contributions
                   || jsonb_build_object(${date}, ${clampedMin}::numeric)
            END) AS v(key, value)
          )),
          settled_at       = NULL,
          settled_lwp_days = NULL,
          settled_leave_type = NULL,
          updated_at = NOW()
  `);
}

export interface DeficitSettlementResult {
  employeeId: string;
  month: string;
  deficitMinutes: number;
  threshold: number;
  settled: boolean;
  lwpDays: number;
  forgiven: boolean;
  elDeducted: number;
  slDeducted: number;
  rawLwpDays: number;
  note: string;
}

/**
 * Settle the monthly deficit pool for one or all employees.
 *
 * Logic:
 *  1. Fetch pool row for the given employee + month.
 *  2. Skip if already settled (idempotent).
 *  3. Read threshold from system_settings (default 120 min).
 *  4. If deficit < threshold → mark forgiven (no deduction).
 *  5. Else → convert excess to fractional LWP days, offset EL first → SL → raw LWP.
 *     Writes negative leaveAdjustments for EL/SL offsets; raw LWP is logged to audit_logs.
 *  6. Mark pool row settled.
 *
 * @param month      'YYYY-MM' to settle (defaults to previous calendar month if omitted)
 * @param employeeId Optional — if omitted, all unsettled employees for the month are processed
 * @param actorId    The user ID triggering this (super_admin); used as adjustedBy in leave records
 */
export async function settleMonthlyDeficitPool(
  month?: string,
  employeeId?: string,
  actorId?: string,
): Promise<DeficitSettlementResult[]> {
  // Default to previous calendar month (settlement runs on the 1st for the prior month)
  if (!month) {
    const now = new Date(Date.now() + IST_OFFSET_MS); // IST
    let y = now.getUTCFullYear();
    let m = now.getUTCMonth(); // 0-indexed → this is the PRIOR month
    if (m === 0) { m = 12; y -= 1; }
    month = `${y}-${String(m).padStart(2, "0")}`;
  }

  // Read threshold — 0 is a valid value meaning "every deficit minute converts to LWP"
  let threshold = 120;
  try {
    const setting = await storage.getSystemSetting("attendance_deficit_pool_threshold_minutes");
    if (setting?.value !== undefined && setting?.value !== null && typeof setting.value === "number" && setting.value >= 0) {
      threshold = setting.value;
    }
  } catch { /* use default */ }

  // Fetch unsettled pool rows for the month (optionally scoped to one employee)
  const whereClause = employeeId
    ? sql`employee_id = ${employeeId} AND month = ${month} AND settled_at IS NULL`
    : sql`month = ${month} AND settled_at IS NULL`;

  const rows = await db.execute(sql`
    SELECT id, employee_id, month, deficit_minutes FROM attendance_deficit_pool WHERE ${whereClause}
  `);

  const results: DeficitSettlementResult[] = [];
  const year = parseInt(month.split("-")[0], 10);

  for (const row of rows.rows as Array<{ id: string; employee_id: string; month: string; deficit_minutes: number }>) {
    const result: DeficitSettlementResult = {
      employeeId: row.employee_id,
      month: row.month,
      deficitMinutes: row.deficit_minutes,
      threshold,
      settled: false,
      lwpDays: 0,
      forgiven: false,
      elDeducted: 0,
      slDeducted: 0,
      rawLwpDays: 0,
      note: "",
    };

    try {
      // Find actor for all audit entries (done once per row, outside the branch)
      let resolvedActorId = actorId;
      if (!resolvedActorId) {
        const saRow = await db.execute(sql`SELECT id FROM admin_users WHERE role = 'super_admin' AND is_active = true AND deleted_at IS NULL ORDER BY created_at LIMIT 1`);
        resolvedActorId = (saRow.rows[0] as any)?.id;
      }

      if (row.deficit_minutes < threshold) {
        // Below threshold — forgive the deficit
        result.forgiven = true;
        result.note = `Deficit ${row.deficit_minutes} min < threshold ${threshold} min — forgiven`;
        await db.execute(sql`
          UPDATE attendance_deficit_pool
          SET settled_at = NOW(), settled_lwp_days = 0, settled_leave_type = 'forgiven', updated_at = NOW()
          WHERE id = ${row.id}
        `);
        // Audit trail entry for forgiven outcome (satisfies leave-audit requirement)
        if (resolvedActorId) {
          await db.execute(sql`
            INSERT INTO audit_logs (id, actor_id, target_id, action, changes, created_at)
            VALUES (gen_random_uuid(), ${resolvedActorId}, ${row.employee_id}, 'monthly_deficit_pool_forgiven',
              ${JSON.stringify({ month: row.month, deficitMinutes: row.deficit_minutes, threshold, source: "monthly_deficit_pool" })}::jsonb,
              NOW())
          `);
        }
      } else {
        // Resolve shift hours for this employee (for fractional day calculation)
        let shiftHours = 9.0;
        try {
          const empRow = await db.execute(sql`SELECT shift_id FROM admin_users WHERE id = ${row.employee_id} LIMIT 1`);
          const shiftId = (empRow.rows[0] as any)?.shift_id;
          if (shiftId) {
            const timing = await getCurrentShiftTiming(shiftId);
            if (timing?.scheduledHours) shiftHours = timing.scheduledHours;
          }
          // Prefer per-employee shift hours over global override
          // (global standard_shift_hours is a shiftless-only fallback)
        } catch { /* use default 9h */ }

        // Only the EXCESS above threshold converts to LWP — minutes up to
        // threshold are forgiven even when the total is above it.
        const excessMinutes = row.deficit_minutes - threshold;
        const lwpDays = excessMinutes / 60 / shiftHours;
        result.lwpDays = lwpDays;
        let remaining = lwpDays;

        let settledLeaveType = "LWP";
        const adjustmentParts: string[] = [];

        // 1. Offset EL first
        if (remaining > 0 && resolvedActorId) {
          const elRow = await db.execute(sql`
            SELECT lb.id, lb.total_days, lb.used_days, lb.leave_type_id, lt.name
            FROM leave_balances lb
            JOIN leave_types lt ON lt.id = lb.leave_type_id
            WHERE lb.user_id = ${row.employee_id}
              AND lb.year = ${year}
              AND LOWER(lt.name) LIKE '%earned%'
              AND (CAST(lb.total_days AS NUMERIC) - CAST(lb.used_days AS NUMERIC)) > 0
            LIMIT 1
          `);
          if (elRow.rows.length > 0) {
            const elBal = elRow.rows[0] as any;
            const elAvailable = parseFloat(elBal.total_days) - parseFloat(elBal.used_days);
            const elToDeduct = Math.min(elAvailable, remaining);
            if (elToDeduct > 0.001) {
              // Write leave_adjustments (leave audit trail)
              await db.execute(sql`
                INSERT INTO leave_adjustments (id, user_id, leave_type_id, adjustment_days, reason, year, adjusted_by, created_at)
                VALUES (gen_random_uuid(), ${row.employee_id}, ${elBal.leave_type_id}, ${-elToDeduct},
                  ${`Monthly deficit pool settlement — ${row.deficit_minutes} min deficit (${excessMinutes} min excess over ${threshold} min threshold) → ${lwpDays.toFixed(4)} LWP days; ${elToDeduct.toFixed(4)} days offset from EL. Source: monthly_deficit_pool`},
                  ${year}, ${resolvedActorId}, NOW())
              `);
              // Update leave_balances: increment used_days
              await db.execute(sql`
                UPDATE leave_balances SET used_days = CAST(used_days AS NUMERIC) + ${elToDeduct}, updated_at = NOW()
                WHERE id = ${elBal.id}
              `);
              // Unified audit log entry tagged with source monthly_deficit_pool
              await db.execute(sql`
                INSERT INTO audit_logs (id, actor_id, target_id, action, changes, created_at)
                VALUES (gen_random_uuid(), ${resolvedActorId}, ${row.employee_id}, 'monthly_deficit_pool_el_offset',
                  ${JSON.stringify({ month: row.month, deficitMinutes: row.deficit_minutes, excessMinutes, lwpDays, elDeducted: elToDeduct, source: "monthly_deficit_pool" })}::jsonb,
                  NOW())
              `);
              result.elDeducted = elToDeduct;
              remaining -= elToDeduct;
              adjustmentParts.push(`EL: -${elToDeduct.toFixed(2)}d`);
            }
          }
        }

        // 2. Offset SL next
        if (remaining > 0.001 && resolvedActorId) {
          const slRow = await db.execute(sql`
            SELECT lb.id, lb.total_days, lb.used_days, lb.leave_type_id, lt.name
            FROM leave_balances lb
            JOIN leave_types lt ON lt.id = lb.leave_type_id
            WHERE lb.user_id = ${row.employee_id}
              AND lb.year = ${year}
              AND LOWER(lt.name) LIKE '%sick%'
              AND (CAST(lb.total_days AS NUMERIC) - CAST(lb.used_days AS NUMERIC)) > 0
            LIMIT 1
          `);
          if (slRow.rows.length > 0) {
            const slBal = slRow.rows[0] as any;
            const slAvailable = parseFloat(slBal.total_days) - parseFloat(slBal.used_days);
            const slToDeduct = Math.min(slAvailable, remaining);
            if (slToDeduct > 0.001) {
              await db.execute(sql`
                INSERT INTO leave_adjustments (id, user_id, leave_type_id, adjustment_days, reason, year, adjusted_by, created_at)
                VALUES (gen_random_uuid(), ${row.employee_id}, ${slBal.leave_type_id}, ${-slToDeduct},
                  ${`Monthly deficit pool settlement — ${slToDeduct.toFixed(4)} days offset from SL. Source: monthly_deficit_pool`},
                  ${year}, ${resolvedActorId}, NOW())
              `);
              await db.execute(sql`
                UPDATE leave_balances SET used_days = CAST(used_days AS NUMERIC) + ${slToDeduct}, updated_at = NOW()
                WHERE id = ${slBal.id}
              `);
              await db.execute(sql`
                INSERT INTO audit_logs (id, actor_id, target_id, action, changes, created_at)
                VALUES (gen_random_uuid(), ${resolvedActorId}, ${row.employee_id}, 'monthly_deficit_pool_sl_offset',
                  ${JSON.stringify({ month: row.month, slDeducted: slToDeduct, source: "monthly_deficit_pool" })}::jsonb,
                  NOW())
              `);
              result.slDeducted = slToDeduct;
              remaining -= slToDeduct;
              adjustmentParts.push(`SL: -${slToDeduct.toFixed(2)}d`);
            }
          }
        }

        // 3. Remaining = raw LWP:
        //    a) Increment cur_lop_days in the ACTIVE attendance_report_entries row.
        //       This is the canonical payroll-consumable field HR reads when generating
        //       salary slips. If no active run exists for the month, the settlement is
        //       NOT marked settled (pool stays pending) so it can be retried after HR
        //       creates the attendance report. This avoids silent data loss.
        //    b) Write a unified audit_logs entry tagged monthly_deficit_pool.
        if (remaining > 0.001) {
          result.rawLwpDays = remaining;
          adjustmentParts.push(`LWP: ${remaining.toFixed(2)}d`);
          // a) Update attendance_report_entries.cur_lop_days in the active run for this month
          const [settleYear, settleMonthNum] = row.month.split("-").map(Number);
          let lopRowsUpdated = 0;
          try {
            const lopUpdate = await db.execute(sql`
              UPDATE attendance_report_entries
              SET cur_lop_days = COALESCE(CAST(cur_lop_days AS NUMERIC), 0) + ${remaining},
                  updated_at = NOW()
              WHERE user_id = ${row.employee_id}
                AND run_id IN (
                  SELECT id FROM salary_report_runs
                  WHERE year = ${settleYear} AND month = ${settleMonthNum} AND is_active = true
                  LIMIT 1
                )
            `);
            lopRowsUpdated = (lopUpdate as any).rowCount ?? 0;
          } catch (lopErr) {
            console.warn(`[deficit-pool] cur_lop_days update errored for ${row.employee_id}/${row.month}:`, lopErr);
          }

          if (lopRowsUpdated === 0) {
            // No active attendance report run — do NOT mark settled. Leave pool open so
            // the next scheduled settlement (1st of following month cron) can retry once
            // HR has created the attendance report. LWP is durably recorded in audit_logs
            // so it is never silently lost.
            result.settled = false;
            result.note = `LWP pending: no active attendance report run for ${row.month}. Pool left open — retry after HR generates the attendance report.`;
            await db.execute(sql`
              INSERT INTO audit_logs (id, actor_id, target_id, action, changes, created_at)
              VALUES (gen_random_uuid(), ${resolvedActorId ?? null}, ${row.employee_id},
                'monthly_deficit_pool_lwp_pending_run',
                ${JSON.stringify({
                  month: row.month, rawLwpDays: remaining,
                  reason: "no_active_salary_report_run",
                  source: "monthly_deficit_pool",
                })}::jsonb,
                NOW())
            `).catch(() => {});
            // Push unsettled result and skip the final settled_at UPDATE for this row.
            results.push(result);
            continue;
          }

          // b) Audit log for successful cur_lop_days write (only when salary run row updated)
          if (lopRowsUpdated > 0) {
            try {
              if (resolvedActorId) {
                await db.execute(sql`
                  INSERT INTO audit_logs (id, actor_id, target_id, action, changes, created_at)
                  VALUES (gen_random_uuid(), ${resolvedActorId}, ${row.employee_id}, 'monthly_deficit_pool_lwp',
                    ${JSON.stringify({ month: row.month, deficitMinutes: row.deficit_minutes, rawLwpDays: remaining, source: "monthly_deficit_pool" })}::jsonb,
                    NOW())
                `);
              }
            } catch { /* non-fatal */ }
          }
        }

        if (result.elDeducted > 0 && result.slDeducted > 0) settledLeaveType = "mixed";
        else if (result.elDeducted > 0) settledLeaveType = "EL";
        else if (result.slDeducted > 0) settledLeaveType = "SL";
        else settledLeaveType = "LWP";

        result.note = `Settled: ${adjustmentParts.join(", ") || "LWP only"}`;

        await db.execute(sql`
          UPDATE attendance_deficit_pool
          SET settled_at = NOW(), settled_lwp_days = ${lwpDays}, settled_leave_type = ${settledLeaveType}, updated_at = NOW()
          WHERE id = ${row.id}
        `);
      }

      result.settled = true;
    } catch (err) {
      result.note = `Error: ${String(err)}`;
      console.error(`[deficit-pool] settlement failed for ${row.employee_id}/${row.month}:`, err);
    }

    results.push(result);
  }

  return results;
}
