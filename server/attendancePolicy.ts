import { getCurrentShiftTiming, shiftTimeToMinutes } from "./shiftUtils.js";
import { db } from "./db.js";
import { storage } from "./storage.js";
import { sql } from "drizzle-orm";

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
): Promise<HalfDayResult> {
  if (!["present", "late"].includes(currentStatus)) {
    return { status: currentStatus, notes: undefined };
  }
  const timing = await getCurrentShiftTiming(shiftId);
  if (!timing) return { status: currentStatus, notes: undefined };

  const fullThreshold = timing.scheduledHours;
  const halfThreshold = fullThreshold / 2;

  if (totalHoursNum < halfThreshold) {
    return {
      status: "half_day",
      notes: `[Auto] Half day: ${totalHoursNum.toFixed(2)} hrs worked (under half of ${fullThreshold}h, i.e. ${halfThreshold}h)`,
    };
  }
  if (totalHoursNum < fullThreshold) {
    return {
      status: "short_day",
      notes: `[Auto] Short day: ${totalHoursNum.toFixed(2)} hrs worked (under full day of ${fullThreshold}h)`,
    };
  }
  return { status: currentStatus, notes: undefined };
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
