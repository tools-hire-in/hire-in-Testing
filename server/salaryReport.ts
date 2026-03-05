import { db } from "./db";
import { adminUsers, attendance, leaveRequests, holidays, departments } from "@shared/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";

interface EmployeeReportRow {
  employeeName: string;
  email: string;
  designation: string;
  department: string;
  salary: number;
  workingDays: number;
  presentDays: number;
  absentDays: number;
  approvedLeaves: number;
  holidays: number;
  totalHours: number;
  attendancePercentage: number;
  grossSalary: number;
  deductions: number;
  netPayable: number;
}

export interface SalaryReportSummary {
  year: number;
  month: number;
  monthName: string;
  totalEmployees: number;
  totalPayable: number;
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

export async function generateMonthlySalaryReport(year: number, month: number): Promise<SalaryReportResult> {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

  const [allUsers, allAttendance, allLeaveRequests, allHolidays, allDepartments] = await Promise.all([
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
  ]);

  const deptMap = new Map(allDepartments.map(d => [d.id, d.name]));
  const holidayDates = new Set(allHolidays.filter(h => h.type === "public" || h.type === "mandatory").map(h => h.date));
  const workingDays = getWorkingDaysInMonth(year, month, holidayDates);

  const attendanceByUser = new Map<string, typeof allAttendance>();
  for (const rec of allAttendance) {
    if (!attendanceByUser.has(rec.userId)) attendanceByUser.set(rec.userId, []);
    attendanceByUser.get(rec.userId)!.push(rec);
  }

  const leavesByUser = new Map<string, number>();
  for (const lr of allLeaveRequests) {
    const existing = leavesByUser.get(lr.userId) || 0;
    leavesByUser.set(lr.userId, existing + Number(lr.totalDays || 0));
  }

  const rows: EmployeeReportRow[] = [];
  let totalPayable = 0;
  let totalHoursWorked = 0;

  for (const user of allUsers) {
    const monthlySalary = Number(user.salary) || 0;
    if (monthlySalary === 0) continue;

    const userAttendance = attendanceByUser.get(user.id) || [];
    const presentDays = userAttendance.filter(a =>
      a.status === "present" || a.status === "late" || a.status === "half_day"
    ).length;
    const userHolidayStamps = userAttendance.filter(a => a.status === "holiday");
    const regionalHolidayDays = userHolidayStamps.filter(a => !holidayDates.has(a.date)).length;
    const totalHolidaysForUser = holidayDates.size + regionalHolidayDays;
    const totalHours = userAttendance.reduce((sum, a) => sum + (Number(a.totalHours) || 0), 0);
    const approvedLeaves = leavesByUser.get(user.id) || 0;

    const effectivePresentDays = presentDays + approvedLeaves + regionalHolidayDays;
    const absentDays = Math.max(0, workingDays - effectivePresentDays);
    const attendancePercentage = workingDays > 0 ? Math.round((effectivePresentDays / workingDays) * 100) : 0;

    const dailyRate = workingDays > 0 ? monthlySalary / workingDays : 0;
    const deductions = absentDays * dailyRate;
    const netPayable = Math.max(0, monthlySalary - deductions);

    const row: EmployeeReportRow = {
      employeeName: `${user.firstName} ${user.lastName}`,
      email: user.email,
      designation: user.designation || "-",
      department: user.departmentId ? (deptMap.get(user.departmentId) || "-") : "-",
      salary: monthlySalary,
      workingDays,
      presentDays,
      absentDays,
      approvedLeaves,
      holidays: totalHolidaysForUser,
      totalHours: Math.round(totalHours * 100) / 100,
      attendancePercentage,
      grossSalary: monthlySalary,
      deductions: Math.round(deductions * 100) / 100,
      netPayable: Math.round(netPayable * 100) / 100,
    };

    rows.push(row);
    totalPayable += row.netPayable;
    totalHoursWorked += row.totalHours;
  }

  rows.sort((a, b) => a.employeeName.localeCompare(b.employeeName));

  const summary: SalaryReportSummary = {
    year,
    month,
    monthName: getMonthName(month),
    totalEmployees: rows.length,
    totalPayable: Math.round(totalPayable * 100) / 100,
    totalHoursWorked: Math.round(totalHoursWorked * 100) / 100,
    generatedAt: new Date().toISOString(),
  };

  const csvHeaders = [
    "Employee Name", "Email", "Designation", "Department", "Salary",
    "Working Days", "Present Days", "Absent Days", "Approved Leaves", "Holidays",
    "Total Hours", "Attendance %", "Gross Salary", "Deductions", "Net Payable"
  ];
  const csvRows = rows.map(r => [
    `"${r.employeeName}"`, `"${r.email}"`, `"${r.designation}"`, `"${r.department}"`,
    r.salary, r.workingDays, r.presentDays, r.absentDays, r.approvedLeaves, r.holidays,
    r.totalHours, r.attendancePercentage, r.grossSalary, r.deductions, r.netPayable
  ].join(","));
  const csv = [csvHeaders.join(","), ...csvRows].join("\n");

  return { rows, summary, csv };
}
