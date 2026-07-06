import { db } from "./db";
import { adminUsers, attendance, leaveRequests, holidays, leaveBalances } from "@shared/schema";
import { eq, and, gte, lte, inArray, isNull } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { attendanceApprovalUrl } from "./portalUrl";

export interface AttendanceReportEntry {
  userId: string;
  managerId: string | null;
  presentDays: number;
  absentDays: number;
  lopDays: number;
  leaveDays: number;
  holidayDays: number;
  totalHours: number;
}

/** Current date parts in the business timezone (IST, UTC+5:30). */
export function getIstYearMonthDay(): { year: number; month: number; day: number } {
  const nowIst = new Date(Date.now() + (5 * 60 + 30) * 60 * 1000);
  return {
    year: nowIst.getUTCFullYear(),
    month: nowIst.getUTCMonth() + 1, // 1-indexed
    day: nowIst.getUTCDate(),
  };
}

/**
 * Count Mon–Fri working days in a month, excluding public holidays.
 * When `maxDay` is provided, only days on or before it are counted — used to keep
 * the snapshot from treating not-yet-elapsed days of the current month as absences.
 */
function getWorkingDaysInMonth(year: number, month: number, holidayDates: Set<string>, maxDay?: number): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  const lastDay = maxDay != null ? Math.min(maxDay, daysInMonth) : daysInMonth;
  let workingDays = 0;
  for (let d = 1; d <= lastDay; d++) {
    const date = new Date(year, month - 1, d);
    const dayOfWeek = date.getDay();
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidayDates.has(dateStr)) {
      workingDays++;
    }
  }
  return workingDays;
}

function prorateLeaveToMonth(lrStart: string, lrEnd: string, lrDays: number, mStart: string, mEnd: string): number {
  const reqStart = new Date(lrStart);
  const reqEnd = new Date(lrEnd);
  const monthStart = new Date(mStart);
  const monthEnd = new Date(mEnd);
  const overlapStart = reqStart < monthStart ? monthStart : reqStart;
  const overlapEnd = reqEnd > monthEnd ? monthEnd : reqEnd;
  const overlapDays = Math.max(0, Math.round((overlapEnd.getTime() - overlapStart.getTime()) / 86400000) + 1);
  const totalDays = Math.max(1, Math.round((reqEnd.getTime() - reqStart.getTime()) / 86400000) + 1);
  return (overlapDays / totalDays) * lrDays;
}

export async function buildAttendanceSnapshot(year: number, month: number): Promise<AttendanceReportEntry[]> {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

  const [allUsers, allAttendance, allLeaveRequests, allHolidays, allLeaveBalances] = await Promise.all([
    db.select().from(adminUsers).where(and(eq(adminUsers.isActive, true), isNull(adminUsers.deletedAt))),
    db.select().from(attendance).where(and(gte(attendance.date, startDate), lte(attendance.date, endDate))),
    db.select().from(leaveRequests).where(and(
      eq(leaveRequests.status, "approved"),
      lte(leaveRequests.startDate, endDate),
      gte(leaveRequests.endDate, startDate),
    )),
    db.select().from(holidays).where(and(gte(holidays.date, startDate), lte(holidays.date, endDate))),
    db.select().from(leaveBalances).where(eq(leaveBalances.year, year)),
  ]);

  const publicHolidayDates = new Set(allHolidays.filter(h => h.type === "public" || h.type === "mandatory").map(h => h.date));

  // Elapsed-aware safeguard: when snapshotting the current (in-progress) month, only
  // count working days up to and including the last fully-elapsed day. This prevents
  // not-yet-elapsed days from being counted as "absent". For a completed month this is
  // a no-op (maxDay stays undefined → whole month is counted).
  const ist = getIstYearMonthDay();
  const isCurrentMonth = year === ist.year && month === ist.month;
  const maxDay = isCurrentMonth ? ist.day - 1 : undefined;
  const workingDays = getWorkingDaysInMonth(year, month, publicHolidayDates, maxDay);

  const attendanceByUser = new Map<string, typeof allAttendance>();
  for (const rec of allAttendance) {
    if (!attendanceByUser.has(rec.userId)) attendanceByUser.set(rec.userId, []);
    attendanceByUser.get(rec.userId)!.push(rec);
  }

  const leavesByUserAndType = new Map<string, Map<string, number>>();
  for (const lr of allLeaveRequests) {
    const proratedDays = prorateLeaveToMonth(lr.startDate, lr.endDate, Number(lr.totalDays || 0), startDate, endDate);
    if (proratedDays <= 0) continue;
    if (!leavesByUserAndType.has(lr.userId)) leavesByUserAndType.set(lr.userId, new Map());
    const typeMap = leavesByUserAndType.get(lr.userId)!;
    typeMap.set(lr.leaveTypeId, (typeMap.get(lr.leaveTypeId) || 0) + proratedDays);
  }

  const balancesByUserAndType = new Map<string, Map<string, { totalDays: number; usedDays: number }>>();
  for (const lb of allLeaveBalances) {
    if (!balancesByUserAndType.has(lb.userId)) balancesByUserAndType.set(lb.userId, new Map());
    balancesByUserAndType.get(lb.userId)!.set(lb.leaveTypeId, {
      totalDays: Number(lb.totalDays || 0),
      usedDays: Number(lb.usedDays || 0),
    });
  }

  const entries: AttendanceReportEntry[] = [];

  for (const user of allUsers) {
    if (user.attendanceExempt) continue;

    const userAttendance = attendanceByUser.get(user.id) || [];
    const presentDays = userAttendance.filter(a => a.status === "present" || a.status === "late" || a.status === "half_day" || a.status === "short_day").length;
    const regionalHolidayDays = userAttendance.filter(a => a.status === "holiday" && !publicHolidayDates.has(a.date)).length;
    const holidayDays = publicHolidayDates.size + regionalHolidayDays;
    const totalHours = userAttendance.reduce((s, a) => s + (Number(a.totalHours) || 0), 0);

    let leaveDays = 0;
    let lopDays = 0;
    const userLeavesByType = leavesByUserAndType.get(user.id) || new Map();
    const userBalances = balancesByUserAndType.get(user.id) || new Map();

    for (const [leaveTypeId, approvedThisMonth] of userLeavesByType) {
      const balance = userBalances.get(leaveTypeId);
      if (balance) {
        const usedBefore = balance.usedDays - approvedThisMonth;
        const remaining = Math.max(0, balance.totalDays - usedBefore);
        const paid = Math.min(approvedThisMonth, remaining);
        const lop = approvedThisMonth - paid;
        leaveDays += paid;
        lopDays += lop;
      } else {
        lopDays += approvedThisMonth;
      }
    }

    const effectivePresentDays = presentDays + leaveDays + regionalHolidayDays;
    const absentDays = Math.max(0, workingDays - effectivePresentDays);

    entries.push({
      userId: user.id,
      managerId: user.managerId || null,
      presentDays: Math.round(presentDays * 100) / 100,
      absentDays: Math.round(absentDays * 100) / 100,
      lopDays: Math.round(lopDays * 100) / 100,
      leaveDays: Math.round(leaveDays * 100) / 100,
      holidayDays: Math.round(holidayDays * 100) / 100,
      totalHours: Math.round(totalHours * 100) / 100,
    });
  }

  return entries;
}

export async function generateAttendanceReportRun(
  month: number,
  year: number,
  createdBy?: string,
  opts: { version?: number; regenerationComment?: string; regeneratedBy?: string } = {},
): Promise<{ runId: string; managerIds: string[] }> {
  const deadlineAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const version = opts.version ?? 1;

  const insertResult = await db.execute(sql`
    INSERT INTO attendance_report_runs (month, year, status, deadline_at, created_by, version, is_active, regeneration_comment, regenerated_by)
    VALUES (${month}, ${year}, 'pending', ${deadlineAt.toISOString()}, ${createdBy || null}, ${version}, true, ${opts.regenerationComment || null}, ${opts.regeneratedBy || null})
    RETURNING id
  `);
  const run = (insertResult.rows as any[])[0];
  const runId = (run as any).id;

  const entries = await buildAttendanceSnapshot(year, month);

  if (entries.length > 0) {
    for (const entry of entries) {
      await db.execute(sql`
        INSERT INTO attendance_report_entries (
          run_id, user_id, manager_id,
          orig_present_days, orig_absent_days, orig_lop_days, orig_leave_days, orig_holiday_days, orig_total_hours,
          cur_present_days, cur_absent_days, cur_lop_days, cur_leave_days, cur_holiday_days, cur_total_hours
        ) VALUES (
          ${runId}, ${entry.userId}, ${entry.managerId},
          ${entry.presentDays}, ${entry.absentDays}, ${entry.lopDays}, ${entry.leaveDays}, ${entry.holidayDays}, ${entry.totalHours},
          ${entry.presentDays}, ${entry.absentDays}, ${entry.lopDays}, ${entry.leaveDays}, ${entry.holidayDays}, ${entry.totalHours}
        )
      `);
    }
  }

  // Seed approvals from a robust manager set: the snapshot's manager ids UNIONed
  // with the current org reporting structure (admin_users.manager_id). This keeps
  // a manager (e.g. Shafique) from being dropped if a snapshot row's manager id is
  // missing/stale while they genuinely have direct reports for the month.
  const snapshotManagerIds = entries.map(e => e.managerId).filter(Boolean) as string[];
  const orgManagerIds = await resolveReportManagerIds(year, month);
  const managerIds = [...new Set([...snapshotManagerIds, ...orgManagerIds])];

  for (const managerId of managerIds) {
    await db.execute(sql`
      INSERT INTO attendance_report_manager_approvals (run_id, manager_id, status)
      SELECT ${runId}, ${managerId}, 'pending'
      WHERE NOT EXISTS (
        SELECT 1 FROM attendance_report_manager_approvals
        WHERE run_id = ${runId} AND manager_id = ${managerId}
      )
    `);
  }

  return { runId, managerIds };
}

const CLOSED_RUN_STATUSES = ["approved", "overridden", "deadline_expired"];

/**
 * Additive auto-sync for an OPEN run: ensures every currently-eligible employee
 * (active, non-deleted, non-attendance-exempt) has an entry row on the run. This
 * heals two silent failure modes for the not-yet-approved month:
 *   1. An empty run (0 entries) whose eligible roster is non-empty.
 *   2. Newly hired / newly activated employees who joined after generation.
 *
 * It is strictly additive — existing entries (including manager corrections) are
 * never modified or removed, so it is safe to run on every read. Closed/locked
 * runs are left untouched. Returns the ids that were added this pass.
 */
export async function reconcileRunEntries(runId: string): Promise<{ added: number; addedUserIds: string[] }> {
  const [run] = (await db.execute(sql`SELECT id, month, year, status FROM attendance_report_runs WHERE id = ${runId}`)).rows as any[];
  if (!run) return { added: 0, addedUserIds: [] };
  if (CLOSED_RUN_STATUSES.includes(run.status)) return { added: 0, addedUserIds: [] };

  // Cheap pre-check: compare the eligible roster against existing entries. Only
  // build the (relatively expensive) snapshot when someone is genuinely missing.
  const eligibleRows = (await db.execute(sql`
    SELECT id FROM admin_users
    WHERE is_active = true AND deleted_at IS NULL AND attendance_exempt = false
  `)).rows as any[];
  const existingRows = (await db.execute(sql`
    SELECT user_id FROM attendance_report_entries WHERE run_id = ${runId}
  `)).rows as any[];
  const existingSet = new Set(existingRows.map(r => r.user_id));
  const missingIds = eligibleRows.map(r => r.id).filter(id => !existingSet.has(id));
  if (missingIds.length === 0) return { added: 0, addedUserIds: [] };

  const snapshot = await buildAttendanceSnapshot(run.year, run.month);
  const byUser = new Map(snapshot.map(e => [e.userId, e]));

  const addedUserIds: string[] = [];
  for (const uid of missingIds) {
    const entry = byUser.get(uid);
    if (!entry) continue; // not in snapshot (e.g. exempt) — skip
    await db.execute(sql`
      INSERT INTO attendance_report_entries (
        run_id, user_id, manager_id,
        orig_present_days, orig_absent_days, orig_lop_days, orig_leave_days, orig_holiday_days, orig_total_hours,
        cur_present_days, cur_absent_days, cur_lop_days, cur_leave_days, cur_holiday_days, cur_total_hours
      ) VALUES (
        ${runId}, ${entry.userId}, ${entry.managerId},
        ${entry.presentDays}, ${entry.absentDays}, ${entry.lopDays}, ${entry.leaveDays}, ${entry.holidayDays}, ${entry.totalHours},
        ${entry.presentDays}, ${entry.absentDays}, ${entry.lopDays}, ${entry.leaveDays}, ${entry.holidayDays}, ${entry.totalHours}
      )
    `);
    addedUserIds.push(uid);
  }

  if (addedUserIds.length > 0) {
    await db.execute(sql`
      UPDATE attendance_report_runs
      SET auto_added_total = auto_added_total + ${addedUserIds.length}, last_synced_at = NOW(), updated_at = NOW()
      WHERE id = ${runId}
    `);
  }
  return { added: addedUserIds.length, addedUserIds };
}

/**
 * Governed regeneration of a month's attendance report. Creates a NEW active
 * version (version+1), recomputes the snapshot from source, and re-seeds all
 * manager approvals as pending. The prior active run is retained as immutable
 * history and marked is_active=false.
 *
 * Callers MUST enforce the payroll-lock gate and comment requirement before
 * calling this. Returns the new run id, its version, and the manager set to
 * (re-)notify.
 */
export async function regenerateAttendanceReportRun(
  month: number,
  year: number,
  actorId: string,
  comment: string,
): Promise<{ runId: string; version: number; managerIds: string[]; priorRunId: string | null }> {
  const [prior] = (await db.execute(sql`
    SELECT id, version FROM attendance_report_runs
    WHERE month = ${month} AND year = ${year}
    ORDER BY is_active DESC, version DESC, created_at DESC
    LIMIT 1
  `)).rows as any[];

  const nextVersion = prior ? Number(prior.version || 1) + 1 : 1;

  // Retire the prior active version (history is immutable; only the flag flips).
  await db.execute(sql`
    UPDATE attendance_report_runs SET is_active = false, updated_at = NOW()
    WHERE month = ${month} AND year = ${year} AND is_active = true
  `);

  const { runId, managerIds } = await generateAttendanceReportRun(month, year, actorId, {
    version: nextVersion,
    regenerationComment: comment,
    regeneratedBy: actorId,
  });

  return { runId, version: nextVersion, managerIds, priorRunId: prior?.id ?? null };
}

/**
 * Returns the distinct set of valid (active, non-deleted) manager ids who have at
 * least one active, non-deleted, non-attendance-exempt direct report — derived
 * directly from the current org reporting structure on admin_users. This is the
 * authoritative recipient list and does not rely on snapshot rows.
 */
export async function resolveReportManagerIds(_year: number, _month: number): Promise<string[]> {
  const rows = (await db.execute(sql`
    SELECT DISTINCT e.manager_id AS id
    FROM admin_users e
    JOIN admin_users m ON m.id = e.manager_id
    WHERE e.is_active = true
      AND e.deleted_at IS NULL
      AND e.attendance_exempt = false
      AND e.manager_id IS NOT NULL
      AND m.is_active = true
      AND m.deleted_at IS NULL
  `)).rows as any[];
  return rows.map(r => r.id).filter(Boolean) as string[];
}

/**
 * Resolves the full downstream org of a manager: every active, non-deleted user
 * who rolls up to `managerId` transitively through the reporting structure
 * (direct reports, their reports, and so on). Excludes the manager themselves.
 * Used by the read-only oversight view so a senior manager can see all teams
 * beneath them without gaining approval authority.
 */
export async function resolveDownstreamUserIds(managerId: string): Promise<string[]> {
  const rows = (await db.execute(sql`
    WITH RECURSIVE downstream AS (
      SELECT id FROM admin_users
      WHERE manager_id = ${managerId} AND is_active = true AND deleted_at IS NULL
      UNION
      SELECT e.id FROM admin_users e
      JOIN downstream d ON e.manager_id = d.id
      WHERE e.is_active = true AND e.deleted_at IS NULL
    )
    SELECT id FROM downstream
  `)).rows as any[];
  return rows.map(r => r.id).filter(Boolean) as string[];
}

interface RunManager {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

/**
 * Re-syncs an already-generated run to the current org structure and returns the
 * managers who were newly added to the approval list (so the caller can notify
 * only them — never re-pinging managers who already responded).
 *
 * Self-heals two failure modes for an open run:
 *  1. Entry rows whose stored manager id is stale → re-pointed to the employee's
 *     current manager (only when that manager is valid and the entry's current
 *     manager has not already approved that scope).
 *  2. A manager with real direct reports who has no approval row → a pending row
 *     is inserted.
 */
export async function reconcileManagerApprovals(runId: string): Promise<{ added: RunManager[] }> {
  const [run] = (await db.execute(sql`SELECT * FROM attendance_report_runs WHERE id = ${runId}`)).rows as any[];
  if (!run) return { added: [] };
  // Don't disturb closed runs.
  if (["approved", "overridden", "deadline_expired"].includes(run.status)) return { added: [] };

  // 1. Re-sync stale entry manager assignments to current org structure, but never
  //    move an entry away from a manager who already approved it.
  await db.execute(sql`
    UPDATE attendance_report_entries AS are
    SET manager_id = e.manager_id
    FROM admin_users e
    WHERE are.run_id = ${runId}
      AND are.user_id = e.id
      AND e.manager_id IS NOT NULL
      AND e.manager_id <> are.manager_id
      AND NOT EXISTS (
        SELECT 1 FROM attendance_report_manager_approvals ma
        WHERE ma.run_id = ${runId}
          AND ma.manager_id = are.manager_id
          AND ma.status IN ('approved', 'overridden')
      )
  `);

  // 2. Resolve the authoritative manager set and find which ones lack an approval row.
  const orgManagerIds = await resolveReportManagerIds(run.year, run.month);
  const entryManagerRows = (await db.execute(sql`
    SELECT DISTINCT manager_id AS id FROM attendance_report_entries
    WHERE run_id = ${runId} AND manager_id IS NOT NULL
  `)).rows as any[];
  const wantedIds = [...new Set([...orgManagerIds, ...entryManagerRows.map(r => r.id).filter(Boolean)])];

  if (wantedIds.length === 0) return { added: [] };

  const existing = (await db.execute(sql`
    SELECT manager_id FROM attendance_report_manager_approvals WHERE run_id = ${runId}
  `)).rows as any[];
  const existingIds = new Set(existing.map(r => r.manager_id));
  const newIds = wantedIds.filter(id => !existingIds.has(id));
  if (newIds.length === 0) return { added: [] };

  for (const managerId of newIds) {
    await db.execute(sql`
      INSERT INTO attendance_report_manager_approvals (run_id, manager_id, status)
      SELECT ${runId}, ${managerId}, 'pending'
      WHERE NOT EXISTS (
        SELECT 1 FROM attendance_report_manager_approvals
        WHERE run_id = ${runId} AND manager_id = ${managerId}
      )
    `);
  }

  const added = await db
    .select({ id: adminUsers.id, email: adminUsers.email, firstName: adminUsers.firstName, lastName: adminUsers.lastName })
    .from(adminUsers)
    .where(and(inArray(adminUsers.id, newIds), eq(adminUsers.isActive, true)));

  return { added: added as RunManager[] };
}

/**
 * Sends the review-and-approve email + in-app notification to the given managers
 * for a run. Uses the canonical portal deep-link so the link actually opens the
 * approval screen. Email/storage are imported lazily to avoid module cycles.
 */
export async function notifyManagersForRun(
  runId: string,
  managers: RunManager[],
  opts: { reminder?: boolean } = {},
): Promise<void> {
  if (managers.length === 0) return;
  const [run] = (await db.execute(sql`SELECT * FROM attendance_report_runs WHERE id = ${runId}`)).rows as any[];
  if (!run) return;

  const monthName = new Date(run.year, run.month - 1, 1).toLocaleString("en-US", { month: "long" });
  const deadlineAt = run.deadline_at ? new Date(run.deadline_at) : new Date(Date.now() + 24 * 60 * 60 * 1000);
  const approvalUrl = attendanceApprovalUrl();

  const { sendAttendanceApprovalRequestEmail } = await import("./email");
  const { storage } = await import("./storage");

  let notificationsEnabled = false;
  try {
    const flags = (await storage.getSystemSetting("feature_flags"))?.value as Record<string, boolean> | undefined;
    notificationsEnabled = !!flags?.notifications_enabled;
  } catch { /* notifications best-effort */ }

  for (const mgr of managers) {
    if (!mgr.email) continue;
    sendAttendanceApprovalRequestEmail({
      to: mgr.email,
      managerName: `${mgr.firstName || ""} ${mgr.lastName || ""}`.trim() || mgr.email,
      month: monthName,
      year: run.year,
      deadlineAt,
      approvalUrl,
      policyType: opts.reminder ? "attendance_approval_reminder" : "attendance_approval_request",
    }).catch(console.error);

    if (notificationsEnabled) {
      await storage.createNotification({
        userId: mgr.id,
        title: opts.reminder ? "Reminder: Attendance Approval Required" : "Attendance Approval Required",
        message: `Your team's attendance report for ${monthName} ${run.year} is ready for review. Please approve before the deadline.`,
        type: "action",
      }).catch(console.error);
    }
  }

  // Mark the run as sent-for-approval on the first real (non-reminder) send. This is
  // what flips a manual "draft" run into an emailed one; reminders never change it.
  if (!opts.reminder) {
    await db.execute(sql`
      UPDATE attendance_report_runs SET notified_at = COALESCE(notified_at, NOW()) WHERE id = ${runId}
    `).catch(console.error);
  }
}

/**
 * Single entry point used by all schedulers/hooks: ensure a run exists for the
 * given month/year and that every manager with real direct reports has been
 * notified. Creating notifies the full seeded set; an existing run reconciles and
 * notifies only newly-added managers (no duplicate pings).
 */
export async function ensureRunForMonthAndNotify(
  month: number,
  year: number,
  createdBy?: string,
): Promise<{ created: boolean; runId: string; notified: number }> {
  const existing = (await db.execute(sql`
    SELECT id FROM attendance_report_runs
    WHERE month = ${month} AND year = ${year} AND is_active = true
    ORDER BY version DESC, created_at DESC
    LIMIT 1
  `)).rows as any[];

  if (existing.length === 0) {
    const { runId, managerIds } = await generateAttendanceReportRun(month, year, createdBy);
    let managers: RunManager[] = [];
    if (managerIds.length > 0) {
      managers = (await db
        .select({ id: adminUsers.id, email: adminUsers.email, firstName: adminUsers.firstName, lastName: adminUsers.lastName })
        .from(adminUsers)
        .where(and(inArray(adminUsers.id, managerIds), eq(adminUsers.isActive, true)))) as RunManager[];
      await notifyManagersForRun(runId, managers);
    } else {
      // Automated month-end path: mark the run as sent even when there are no managers
      // to notify, so it is never mislabeled as an un-sent manual draft.
      await db.execute(sql`
        UPDATE attendance_report_runs SET notified_at = COALESCE(notified_at, NOW()) WHERE id = ${runId}
      `).catch(console.error);
    }
    return { created: true, runId, notified: managers.length };
  }

  const runId = existing[0].id;
  // Auto-sync entries first (heals empty runs and picks up new joiners), then
  // reconcile the manager approval set to match the (possibly grown) entry set.
  await reconcileRunEntries(runId);
  const { added } = await reconcileManagerApprovals(runId);
  if (added.length > 0) await notifyManagersForRun(runId, added);
  return { created: false, runId, notified: added.length };
}

// Throttle for per-request auto-create check
let lastAutoCreateCheck = 0;
const AUTO_CREATE_THROTTLE_MS = 30 * 60 * 1000;

export async function checkAndAutoCreateRun(_forceNotify = false): Promise<{ created: boolean; runId?: string; managerIds?: string[] }> {
  try {
    const { day, month, year } = getIstDate();
    if (day !== 1) return { created: false };

    let prevMonth = month - 1;
    let prevYear = year;
    if (prevMonth === 0) { prevMonth = 12; prevYear = year - 1; }

    // Delegate to the shared ensure path so a run created here also notifies
    // managers (and reconciles missing ones), rather than silently creating it.
    const result = await ensureRunForMonthAndNotify(prevMonth, prevYear);
    if (result.created) {
      console.log(`[attendance-report] Auto-created attendance report run for ${prevMonth}/${prevYear}: ${result.runId}`);
    }
    return { created: result.created, runId: result.runId, month: prevMonth, year: prevYear } as any;
  } catch (err) {
    console.error("[attendance-report] Auto-create run failed:", err);
    return { created: false };
  }
}

export async function throttledAutoCreateCheck(): Promise<{ created: boolean; runId?: string; managerIds?: string[]; month?: number; year?: number }> {
  const now = Date.now();
  if (now - lastAutoCreateCheck < AUTO_CREATE_THROTTLE_MS) return { created: false };
  lastAutoCreateCheck = now;
  return checkAndAutoCreateRun();
}

function getIstDate(): { day: number; month: number; year: number } {
  const nowUtcMs = Date.now();
  const istOffsetMs = (5 * 60 + 30) * 60 * 1000;
  const nowIst = new Date(nowUtcMs + istOffsetMs);
  return { day: nowIst.getUTCDate(), month: nowIst.getUTCMonth() + 1, year: nowIst.getUTCFullYear() };
}
