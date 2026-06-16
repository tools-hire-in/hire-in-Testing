import { db } from "./db";
import { adminUsers, attendance, leaveRequests, holidays, leaveBalances } from "@shared/schema";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";

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

function getWorkingDaysInMonth(year: number, month: number, holidayDates: Set<string>): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  let workingDays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
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
    db.select().from(adminUsers).where(eq(adminUsers.isActive, true)),
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
  const workingDays = getWorkingDaysInMonth(year, month, publicHolidayDates);

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

export async function generateAttendanceReportRun(month: number, year: number, createdBy?: string): Promise<{ runId: string; managerIds: string[] }> {
  const deadlineAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const insertResult = await db.execute(sql`
    INSERT INTO attendance_report_runs (month, year, status, deadline_at, created_by)
    VALUES (${month}, ${year}, 'pending', ${deadlineAt.toISOString()}, ${createdBy || null})
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

  const managerIds = [...new Set(entries.map(e => e.managerId).filter(Boolean) as string[])];
  for (const managerId of managerIds) {
    await db.execute(sql`
      INSERT INTO attendance_report_manager_approvals (run_id, manager_id, status)
      VALUES (${runId}, ${managerId}, 'pending')
    `);
  }

  return { runId, managerIds };
}

// Throttle for per-request auto-create check
let lastAutoCreateCheck = 0;
const AUTO_CREATE_THROTTLE_MS = 30 * 60 * 1000;

export async function checkAndAutoCreateRun(forceNotify = false): Promise<{ created: boolean; runId?: string; managerIds?: string[] }> {
  try {
    const { day, month, year } = getIstDate();
    if (day !== 1) return { created: false };

    let prevMonth = month - 1;
    let prevYear = year;
    if (prevMonth === 0) { prevMonth = 12; prevYear = year - 1; }

    const existing = await db.execute(sql`
      SELECT id FROM attendance_report_runs WHERE month = ${prevMonth} AND year = ${prevYear} LIMIT 1
    `);
    if ((existing.rows as any[]).length > 0) return { created: false };

    const { runId, managerIds } = await generateAttendanceReportRun(prevMonth, prevYear);
    console.log(`[attendance-report] Auto-created attendance report run for ${prevMonth}/${prevYear}: ${runId}`);
    return { created: true, runId, managerIds, month: prevMonth, year: prevYear } as any;
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
