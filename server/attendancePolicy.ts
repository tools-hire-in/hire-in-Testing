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
  const graceEnd = shiftStartMinutes + timing.gracePeriodMinutes;
  const isOvernight = graceEnd >= 1440;
  const graceEndNorm = graceEnd % 1440;

  const graceEndHH = String(Math.floor(graceEndNorm / 60)).padStart(2, "0");
  const graceEndMM = String(graceEndNorm % 60).padStart(2, "0");

  let isLate: boolean;

  if (!isOvernight) {
    // Non-overnight: pre-shift punches have punchISTMinutes < shiftStart < graceEnd → not late.
    isLate = punchISTMinutes > graceEnd;
  } else {
    // Overnight: grace window crosses midnight (graceEnd >= 1440, graceEndNorm is small).
    if (punchISTMinutes >= shiftStartMinutes) {
      // Pre-midnight at/after shift start: still before grace end (which is tomorrow) → present.
      isLate = false;
    } else if (punchISTMinutes <= graceEndNorm) {
      // Post-midnight within grace → present.
      isLate = false;
    } else {
      // Ambiguous zone: punchISTMinutes is between graceEndNorm and shiftStartMinutes.
      // Could be post-midnight (late) or pre-shift same evening (present).
      // Use the full IST date: punches before noon IST are post-midnight → late;
      // punches at or after noon IST are pre-shift same evening → present.
      const punchISTDateMs = Date.UTC(
        punchIST.getUTCFullYear(),
        punchIST.getUTCMonth(),
        punchIST.getUTCDate(),
      );
      const noonTodayUTC = punchISTDateMs + 12 * 60 * 60_000 - IST_OFFSET_MS;
      isLate = punchTime.getTime() < noonTodayUTC;
    }
  }

  return {
    status: isLate ? "late" : "present",
    notes: isLate
      ? `[Auto] Late punch-in. Grace window ended at ${graceEndHH}:${graceEndMM} IST`
      : `Grace window ended at ${graceEndHH}:${graceEndMM} IST`,
  };
}

/**
 * Determine whether short worked hours at punch-out warrant a half-day status.
 * Only transitions "present" or "late" statuses; all others are left unchanged.
 */
export async function computeHalfDayStatus(
  shiftId: string,
  totalHoursNum: number,
  currentStatus: string,
): Promise<HalfDayResult> {
  if (!["present", "late"].includes(currentStatus)) {
    return { status: currentStatus, notes: undefined };
  }
  const timing = await getCurrentShiftTiming(shiftId);
  if (!timing) return { status: currentStatus, notes: undefined };

  const halfThreshold = timing.scheduledHours / 2;
  if (totalHoursNum < halfThreshold) {
    return {
      status: "half_day",
      notes: `[Auto] Short hours: ${totalHoursNum.toFixed(2)} hrs worked (threshold: ${halfThreshold}h)`,
    };
  }
  return { status: currentStatus, notes: undefined };
}

/**
 * Count working days from `date` (inclusive) back to `today` (exclusive).
 * Returns -1 for a future date.
 */
export function countWorkingDaysBack(date: string, today: string): number {
  if (date > today) return -1;
  if (date === today) return 0;
  const start = new Date(date + "T00:00:00");
  const end = new Date(today + "T00:00:00");
  let wd = 0;
  const cur = new Date(start);
  while (cur < end) {
    if (cur.getDay() !== 0 && cur.getDay() !== 6) wd++;
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
