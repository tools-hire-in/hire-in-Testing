import { db } from "./db";
import { adminUsers, attendance, leaveRequests, holidays, departments, leaveBalances, salaryAdvanceRepayments, salaryAdvanceRequests } from "@shared/schema";
import { eq, and, gte, lte, inArray } from "drizzle-orm";

interface EmployeeReportRow {
  employeeName: string;
  email: string;
  designation: string;
  department: string;
  salary: number;
  workingDays: number;
  presentDays: number;
  absentDays: number;
  paidLeaves: number;
  lopLeaves: number;
  holidays: number;
  regionalHolidayDays: number;
  totalHours: number;
  attendancePercentage: number;
  grossSalary: number;
  deductions: number;
  // Salary advance installment recovered from this month's pay (scheduled, not yet
  // deducted at report-generation time). Subtracted from netPayable.
  advanceRecovery: number;
  netPayable: number;
}

export interface SalaryReportSummary {
  year: number;
  month: number;
  monthName: string;
  totalEmployees: number;
  totalPayable: number;
  totalDeductions: number;
  totalHoursWorked: number;
  generatedAt: string;
}

export interface SalaryReportResult {
  rows: EmployeeReportRow[];
  summary: SalaryReportSummary;
  csv: string;
}

function getMonthName(month: number): string {
  return new Date(2000, month - 1, 1).toLocaleString("en-US", { month: "long" });
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

/**
 * Prorate a leave request's totalDays to only count days falling within the
 * report month's [startDate, endDate] window. This prevents multi-month leave
 * requests from inflating a single month's approved leave count.
 */
function prorateLeaveToMonth(
  lrStartDate: string,
  lrEndDate: string,
  lrTotalDays: number,
  monthStart: string,
  monthEnd: string
): number {
  const reqStart = new Date(lrStartDate);
  const reqEnd = new Date(lrEndDate);
  const mStart = new Date(monthStart);
  const mEnd = new Date(monthEnd);

  const overlapStart = reqStart < mStart ? mStart : reqStart;
  const overlapEnd = reqEnd > mEnd ? mEnd : reqEnd;

  const overlapCalendarDays = Math.max(
    0,
    Math.round((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
  );
  const totalCalendarDays = Math.max(
    1,
    Math.round((reqEnd.getTime() - reqStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
  );

  return (overlapCalendarDays / totalCalendarDays) * lrTotalDays;
}

export async function generateMonthlySalaryReport(year: number, month: number): Promise<SalaryReportResult> {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

  const [allUsers, allAttendance, allLeaveRequests, allHolidays, allDepartments, allLeaveBalances, advanceRepayments] = await Promise.all([
    db.select().from(adminUsers).where(eq(adminUsers.isActive, true)),
    db.select().from(attendance).where(and(gte(attendance.date, startDate), lte(attendance.date, endDate))),
    db.select().from(leaveRequests).where(
      and(
        eq(leaveRequests.status, "approved"),
        lte(leaveRequests.startDate, endDate),
        gte(leaveRequests.endDate, startDate)
      )
    ),
    db.select().from(holidays).where(and(gte(holidays.date, startDate), lte(holidays.date, endDate))),
    db.select().from(departments),
    db.select().from(leaveBalances).where(eq(leaveBalances.year, year)),
    // Only recover repayments whose advance has actually been disbursed —
    // never deduct against an approved-but-not-yet-disbursed advance.
    db.select({
      userId: salaryAdvanceRepayments.userId,
      scheduledAmount: salaryAdvanceRepayments.scheduledAmount,
    })
      .from(salaryAdvanceRepayments)
      .innerJoin(salaryAdvanceRequests, eq(salaryAdvanceRepayments.advanceId, salaryAdvanceRequests.id))
      .where(
        and(
          eq(salaryAdvanceRepayments.year, year),
          eq(salaryAdvanceRepayments.month, month),
          eq(salaryAdvanceRepayments.status, "scheduled"),
          inArray(salaryAdvanceRequests.status, ["disbursed", "repaying"]),
        )
      ),
  ]);

  // Sum scheduled advance recovery per employee for this month.
  const advanceRecoveryByUser = new Map<string, number>();
  for (const rep of advanceRepayments) {
    advanceRecoveryByUser.set(
      rep.userId,
      (advanceRecoveryByUser.get(rep.userId) || 0) + Number(rep.scheduledAmount || 0),
    );
  }

  const deptMap = new Map(allDepartments.map(d => [d.id, d.name]));
  const holidayDates = new Set(allHolidays.filter(h => h.type === "public" || h.type === "mandatory").map(h => h.date));
  const workingDays = getWorkingDaysInMonth(year, month, holidayDates);

  const attendanceByUser = new Map<string, typeof allAttendance>();
  for (const rec of allAttendance) {
    if (!attendanceByUser.has(rec.userId)) attendanceByUser.set(rec.userId, []);
    attendanceByUser.get(rec.userId)!.push(rec);
  }

  // Group leave requests by user and leave type, prorated to this month's window
  const leavesByUserAndType = new Map<string, Map<string, number>>();
  for (const lr of allLeaveRequests) {
    const proratedDays = prorateLeaveToMonth(
      lr.startDate,
      lr.endDate,
      Number(lr.totalDays || 0),
      startDate,
      endDate
    );
    if (proratedDays <= 0) continue;
    if (!leavesByUserAndType.has(lr.userId)) leavesByUserAndType.set(lr.userId, new Map());
    const typeMap = leavesByUserAndType.get(lr.userId)!;
    const existing = typeMap.get(lr.leaveTypeId) || 0;
    typeMap.set(lr.leaveTypeId, existing + proratedDays);
  }

  // Group leave balances by user and leave type
  const balancesByUserAndType = new Map<string, Map<string, { totalDays: number; usedDays: number }>>();
  for (const lb of allLeaveBalances) {
    if (!balancesByUserAndType.has(lb.userId)) balancesByUserAndType.set(lb.userId, new Map());
    balancesByUserAndType.get(lb.userId)!.set(lb.leaveTypeId, {
      totalDays: Number(lb.totalDays || 0),
      usedDays: Number(lb.usedDays || 0),
    });
  }

  const rows: EmployeeReportRow[] = [];
  let totalPayable = 0;
  let totalDeductions = 0;
  let totalHoursWorked = 0;

  for (const user of allUsers) {
    const monthlySalary = Number(user.salary) || 0;
    if (monthlySalary === 0) continue;

    const userAttendance = attendanceByUser.get(user.id) || [];
    const presentDays = userAttendance.filter(a =>
      a.status === "present" || a.status === "late" || a.status === "half_day" || a.status === "short_day"
    ).length;
    const userHolidayStamps = userAttendance.filter(a => a.status === "holiday");
    const regionalHolidayDays = userHolidayStamps.filter(a => !holidayDates.has(a.date)).length;
    const totalHolidaysForUser = holidayDates.size + regionalHolidayDays;
    const totalHours = userAttendance.reduce((sum, a) => sum + (Number(a.totalHours) || 0), 0);

    // Compute paid vs LOP leaves per leave type
    let paidLeaves = 0;
    let lopLeaves = 0;
    const userLeavesByType = leavesByUserAndType.get(user.id) || new Map();
    const userBalances = balancesByUserAndType.get(user.id) || new Map();

    for (const [leaveTypeId, approvedThisMonth] of userLeavesByType) {
      const balance = userBalances.get(leaveTypeId);
      if (balance) {
        // usedDays in the balance record includes all approved leaves for the year
        // (including this month). Subtract this month's to get balance before this month.
        const usedBeforeThisMonth = balance.usedDays - approvedThisMonth;
        const remainingBalance = Math.max(0, balance.totalDays - usedBeforeThisMonth);
        const paidThisType = Math.min(approvedThisMonth, remainingBalance);
        const lopThisType = approvedThisMonth - paidThisType;
        paidLeaves += paidThisType;
        lopLeaves += lopThisType;
      } else {
        // No balance record for this leave type — all treated as LOP
        lopLeaves += approvedThisMonth;
      }
    }

    // Only paid leaves count toward effective present days.
    // LOP leaves are NOT added here — they fall through as absent days.
    const effectivePresentDays = presentDays + paidLeaves + regionalHolidayDays;
    const absentDays = Math.max(0, workingDays - effectivePresentDays);
    // absentDays now naturally includes LOP days (they were not added to effectivePresentDays).
    // So deductions = absentDays * dailyRate — NO need to add lopLeaves again.
    const attendancePercentage = workingDays > 0 ? Math.round((effectivePresentDays / workingDays) * 100) : 0;

    const dailyRate = workingDays > 0 ? monthlySalary / workingDays : 0;
    const deductions = absentDays * dailyRate;
    const netBeforeAdvance = Math.max(0, monthlySalary - deductions);
    // Recover the scheduled advance installment, capped at what's left after
    // attendance deductions so net pay never goes negative.
    const advanceRecovery = Math.min(
      Math.round((advanceRecoveryByUser.get(user.id) || 0) * 100) / 100,
      netBeforeAdvance,
    );
    const netPayable = Math.max(0, netBeforeAdvance - advanceRecovery);

    const row: EmployeeReportRow = {
      employeeName: `${user.firstName} ${user.lastName}`,
      email: user.email,
      designation: user.designation || "-",
      department: user.departmentId ? (deptMap.get(user.departmentId) || "-") : "-",
      salary: monthlySalary,
      workingDays,
      presentDays,
      absentDays,
      paidLeaves: Math.round(paidLeaves * 100) / 100,
      lopLeaves: Math.round(lopLeaves * 100) / 100,
      holidays: totalHolidaysForUser,
      regionalHolidayDays,
      totalHours: Math.round(totalHours * 100) / 100,
      attendancePercentage,
      grossSalary: monthlySalary,
      deductions: Math.round(deductions * 100) / 100,
      advanceRecovery: Math.round(advanceRecovery * 100) / 100,
      netPayable: Math.round(netPayable * 100) / 100,
    };

    rows.push(row);
    totalPayable += row.netPayable;
    totalDeductions += row.deductions;
    totalHoursWorked += row.totalHours;
  }

  rows.sort((a, b) => a.employeeName.localeCompare(b.employeeName));

  const summary: SalaryReportSummary = {
    year,
    month,
    monthName: getMonthName(month),
    totalEmployees: rows.length,
    totalPayable: Math.round(totalPayable * 100) / 100,
    totalDeductions: Math.round(totalDeductions * 100) / 100,
    totalHoursWorked: Math.round(totalHoursWorked * 100) / 100,
    generatedAt: new Date().toISOString(),
  };

  const csvHeaders = [
    "Employee Name", "Email", "Designation", "Department", "Salary",
    "Working Days", "Present Days", "Absent Days", "Paid Leaves", "LOP Leaves (Unpaid)", "Holidays",
    "Total Hours", "Attendance %", "Gross Salary", "Deductions", "Salary Advance Recovery", "Net Payable"
  ];
  const csvRows = rows.map(r => [
    `"${r.employeeName}"`, `"${r.email}"`, `"${r.designation}"`, `"${r.department}"`,
    r.salary, r.workingDays, r.presentDays, r.absentDays, r.paidLeaves, r.lopLeaves, r.holidays,
    r.totalHours, r.attendancePercentage, r.grossSalary, r.deductions, r.advanceRecovery, r.netPayable
  ].join(","));
  const csv = [csvHeaders.join(","), ...csvRows].join("\n");

  return { rows, summary, csv };
}
