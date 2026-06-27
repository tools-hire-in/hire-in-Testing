import cron from "node-cron";
import { generateMonthlySalaryReport } from "./salaryReport";
import { sendSalaryReportApprovalReminder, sendOfferLetterReminderEmail, sendAddendumReminderEmail } from "./email";
import { storage } from "./storage";
import { db } from "./db";
import { nightShiftConsents, adminUsers, holidays, attendance, leaveRequests, salaryReportRuns, offerLetters, offerLetterAddendums } from "@shared/schema";
import { eq, and, lt, gt, isNull, lte, sql } from "drizzle-orm";
import { generateAttendanceReportRun } from "./attendanceReport";
import { refreshRecentZips } from "./gsaRateService";

function isLastDayOfMonth(): boolean {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.getDate() === 1;
}

/** Convert current UTC timestamp to IST (UTC+5:30) and extract year/month/day */
function getIstDateTime(): { year: number; month: number; day: number } {
  const nowUtcMs = Date.now();
  const istOffsetMs = (5 * 60 + 30) * 60 * 1000;
  const nowIst = new Date(nowUtcMs + istOffsetMs);
  return {
    year: nowIst.getUTCFullYear(),
    month: nowIst.getUTCMonth() + 1, // 1-indexed
    day: nowIst.getUTCDate(),
  };
}

export interface AbsentSweepResult {
  date: string;
  /** Number of absence PROPOSALS enqueued for Super Admin review (nothing is auto-written). */
  created: number;
  skipped: number;
  skippedWeekend?: boolean;
  skippedHoliday?: string;
}

/**
 * Core absent-sweep logic, extracted so it can be called from integration tests.
 * Pass `overrideDate` to run against a specific date (bypasses weekend/holiday check when
 * `skipGuards` is true — used in tests to exercise the per-user logic directly).
 *
 * GUARDRAIL: this sweep never writes attendance rows directly. For every active employee
 * with no punch-in / leave / holiday on the day, it PROPOSES an "absent" change into the
 * pending_changes store. A Super Admin reviews and approves (which applies the row) or
 * rejects (which discards it). The dedupe index makes re-runs idempotent and prevents a
 * previously-reviewed proposal from being recreated.
 */
export async function runAbsentSweep(
  overrideDate: string,
  skipGuards = false,
): Promise<AbsentSweepResult> {
  const todayStr = overrideDate;

  if (!skipGuards) {
    const dayOfWeek = new Date(todayStr + "T12:00:00Z").getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return { date: todayStr, created: 0, skipped: 0, skippedWeekend: true };
    }

    const todayHolidays = await db.select().from(holidays)
      .where(and(eq(holidays.date, todayStr), eq(holidays.isOptional, false)));
    if (todayHolidays.length > 0) {
      return { date: todayStr, created: 0, skipped: 0, skippedHoliday: todayHolidays[0].name };
    }
  }

  const activeUsers = await db.select({
    id: adminUsers.id,
    shiftId: adminUsers.shiftId,
    attendanceExempt: adminUsers.attendanceExempt,
  }).from(adminUsers)
    .where(and(
      isNull(adminUsers.deletedAt),
      eq(adminUsers.isActive, true),
      eq(adminUsers.employmentStatus, "active"),
      eq(adminUsers.attendanceExempt, false),
    ));

  let created = 0;
  let skipped = 0;

  for (const user of activeUsers) {
    try {
      // No shift assigned → we cannot know this employee's working window, so the
      // 23:59 IST sweep must NOT stamp them absent (same intent as the overnight skip
      // below). Their day stays blank until a shift is assigned / they punch in.
      if (!user.shiftId) {
        skipped++;
        continue;
      }

      if (user.shiftId) {
        const shiftRow = await db.execute(sql`
          SELECT ist_start_std, ist_end_std FROM shifts WHERE id = ${user.shiftId} AND is_active = true LIMIT 1
        `);
        if (shiftRow.rows.length > 0) {
          const sr = shiftRow.rows[0] as { ist_start_std: string; ist_end_std: string };
          const [startH, startM] = sr.ist_start_std.split(":").map(Number);
          const [endH, endM] = sr.ist_end_std.split(":").map(Number);
          const shiftStartMin = startH * 60 + startM;
          const shiftEndMin = endH * 60 + endM;
          const isOvernightShift = shiftStartMin > shiftEndMin;
          if (isOvernightShift || shiftEndMin >= 23 * 60 + 59) {
            skipped++;
            continue;
          }
        }
      }

      const existingRows = await db.select({ id: attendance.id })
        .from(attendance)
        .where(and(eq(attendance.userId, user.id), eq(attendance.date, todayStr)))
        .limit(1);
      if (existingRows.length > 0) {
        skipped++;
        continue;
      }

      const leaveRows = await db.select({ id: leaveRequests.id })
        .from(leaveRequests)
        .where(and(
          eq(leaveRequests.userId, user.id),
          eq(leaveRequests.status, "approved"),
          sql`${leaveRequests.startDate} <= ${todayStr}`,
          sql`${leaveRequests.endDate} >= ${todayStr}`,
        ))
        .limit(1);
      if (leaveRows.length > 0) {
        skipped++;
        continue;
      }

      // GUARDRAIL: do NOT write an absent row. Propose it for Super Admin review.
      // The dedupe index makes this idempotent and won't resurrect a reviewed proposal.
      const proposed = await storage.proposePendingChange({
        sourceJob: "absent_sweep",
        runDate: todayStr,
        targetUserId: user.id,
        targetTable: "attendance",
        targetRecordId: null,
        changeType: "insert",
        field: "status",
        currentValue: "(no record)",
        proposedValue: "absent",
        reason: "No punch-in recorded",
        payload: { status: "absent", notes: "[Auto] No punch-in recorded", date: todayStr },
      });
      if (proposed) created++;
      else skipped++; // already proposed/reviewed previously
    } catch (userErr) {
      console.error(`[scheduler] Absent sweep failed for user ${user.id}:`, userErr);
    }
  }

  return { date: todayStr, created, skipped };
}

/**
 * GUARDRAIL POLICY — automated jobs vs. user-entered data.
 *
 * Jobs that could OVERWRITE values a human entered (attendance, leave, salary) must never
 * write directly. They PROPOSE into the pending_changes store for Super Admin review:
 *   - End-of-day absent sweep → proposes "absent" attendance rows (see runAbsentSweep).
 *
 * EXEMPT bookkeeping jobs MAY keep writing directly because they are additive and
 * idempotent — they only create/advance system-owned ledger rows, never clobbering a value
 * a user typed:
 *   - Monthly leave accrual (advances accrual ledger; re-run safe via per-month dedupe).
 *   - Year-end carry-forward / lapse batch (one-shot per year, logged + idempotent).
 *   - Holiday/weekend stamping & per-shift grace-zero normalization (config defaults, no-clobber).
 *   - Salary report run creation (saved as pending_approval; never auto-applied to payroll).
 * Startup config migrations follow the same rule: CREATE ... IF NOT EXISTS / ensure blocks
 * are no-clobber and safe to re-run on every boot.
 */
export function startScheduler() {
  // Salary report: last day of month at 6 PM CST — generate and hold for approval
  cron.schedule("0 18 28-31 * *", async () => {
    if (!isLastDayOfMonth()) {
      console.log("[scheduler] Not the last day of the month, skipping salary report.");
      return;
    }

    console.log("[scheduler] Last day of month detected. Generating salary report (holding for approval)...");
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;

      const report = await generateMonthlySalaryReport(year, month);
      console.log(`[scheduler] Report generated: ${report.summary.totalEmployees} employees, ₹${report.summary.totalPayable} total payable.`);

      // Save to salary_report_runs with pending_approval status — do NOT send email
      const existing = await db.select({ id: salaryReportRuns.id })
        .from(salaryReportRuns)
        .where(and(eq(salaryReportRuns.year, year), eq(salaryReportRuns.month, month)))
        .limit(1);

      if (existing.length > 0) {
        // Update existing run (e.g. if cron re-fires)
        await db.update(salaryReportRuns)
          .set({
            reportData: report.rows as any,
            adjustments: {},
            status: "pending_approval",
            generatedAt: new Date(),
            approvedAt: null,
            approvedBy: null,
            emailSentAt: null,
          })
          .where(eq(salaryReportRuns.id, existing[0].id));
        console.log(`[scheduler] Updated existing salary run for ${month}/${year} — status: pending_approval.`);
      } else {
        await db.insert(salaryReportRuns).values({
          year,
          month,
          status: "pending_approval",
          reportData: report.rows as any,
          adjustments: {} as any,
        });
        console.log(`[scheduler] Saved salary run for ${month}/${year} — status: pending_approval. Awaiting admin approval.`);
      }
    } catch (error) {
      console.error("[scheduler] Error generating salary report:", error);
    }
  }, {
    timezone: "America/Chicago",
  });

  // Salary report approval reminder: 1st of every month at 8 PM CST
  // If last month's run is still pending_approval, remind super admins
  cron.schedule("0 20 1 * *", async () => {
    console.log("[scheduler] Checking for pending salary report approval...");
    try {
      const now = new Date();
      // Calculate prior month (CST context)
      let remindYear = now.getFullYear();
      let remindMonth = now.getMonth(); // getMonth() is 0-indexed, so this is "previous month"
      if (remindMonth === 0) {
        remindMonth = 12;
        remindYear = remindYear - 1;
      }

      const pendingRuns = await db.select().from(salaryReportRuns)
        .where(and(
          eq(salaryReportRuns.year, remindYear),
          eq(salaryReportRuns.month, remindMonth),
          eq(salaryReportRuns.status, "pending_approval"),
        ));

      if (pendingRuns.length === 0) {
        console.log(`[scheduler] No pending salary run for ${remindMonth}/${remindYear} — skipping reminder.`);
        return;
      }

      const superAdmins = await db.select({ email: adminUsers.email })
        .from(adminUsers)
        .where(and(eq(adminUsers.role, "super_admin"), eq(adminUsers.isActive, true), isNull(adminUsers.deletedAt)));

      const toEmails = superAdmins.map(u => u.email).filter(Boolean);
      if (toEmails.length === 0) {
        console.log("[scheduler] No super admin emails found — skipping reminder.");
        return;
      }

      const monthName = new Date(remindYear, remindMonth - 1, 1).toLocaleString("en-US", { month: "long" });
      const portalUrl = process.env.REPLIT_DEV_DOMAIN
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : (process.env.APP_URL || "https://hire-in.com");

      const result = await sendSalaryReportApprovalReminder({
        to: toEmails,
        year: remindYear,
        month: remindMonth,
        monthName,
        portalUrl,
      });

      if (result.success) {
        console.log(`[scheduler] Salary report approval reminder sent to ${toEmails.join(", ")}`);
      } else {
        console.error("[scheduler] Failed to send approval reminder:", result.error);
      }
    } catch (error) {
      console.error("[scheduler] Salary report approval reminder failed:", error);
    }
  }, {
    timezone: "America/Chicago",
  });

  // Monthly leave accrual + year-end: 1st of every month at 00:00 IST.
  // When month=1 (January), year-end batch runs first (for the prior year),
  // then regular monthly accrual runs. This ensures SL lapse and EL carry-forward
  // are fully committed before January's EL+bonus credit is applied — all on Jan 1 IST.
  // Uses getIstDateTime() so year/month are always correct regardless of server timezone.
  cron.schedule("0 0 1 * *", async () => {
    const { year, month } = getIstDateTime();

    // January: run year-end for the prior year BEFORE this month's accrual
    if (month === 1) {
      const priorYear = year - 1;
      console.log(`[scheduler] January detected — running year-end batch for ${priorYear} first...`);
      try {
        const result = await storage.runYearEndBatch(priorYear);
        console.log(`[scheduler] Year-end batch done for ${priorYear}: ${result.processed} users, ${result.elCarried} EL carried, ${result.slLapsed} SL lapsed, ${result.coCleared} CO expired.`);

        const featureFlagsSetting = await storage.getSystemSetting("feature_flags");
        const featureFlags = (featureFlagsSetting?.value as Record<string, boolean>) || {};
        const notificationsEnabled = featureFlags.notifications_enabled === true;

        if (notificationsEnabled) {
          const userYearEndMap = new Map<string, { email: string; name: string; events: { action: string; leaveTypeName: string; days: number }[] }>();
          for (const detail of result.details) {
            const existing = userYearEndMap.get(detail.userId);
            if (existing) {
              existing.events.push({ action: detail.action, leaveTypeName: detail.leaveTypeName, days: detail.days });
            } else {
              userYearEndMap.set(detail.userId, {
                email: detail.email,
                name: detail.name,
                events: [{ action: detail.action, leaveTypeName: detail.leaveTypeName, days: detail.days }],
              });
            }
          }

          for (const [userId, info] of Array.from(userYearEndMap.entries())) {
            const carries = info.events.filter(e => e.action === "carry_forward").map(e => `${e.leaveTypeName}: ${e.days.toFixed(1)} days carried`);
            const lapses = info.events.filter(e => e.action === "lapse").map(e => `${e.leaveTypeName}: ${e.days.toFixed(1)} days lapsed`);
            const parts: string[] = [];
            if (carries.length) parts.push(carries.join(", "));
            if (lapses.length) parts.push(lapses.join(", "));
            if (!parts.length) continue;
            // In-app notification
            try {
              await storage.createNotification({
                userId,
                type: "leave_year_end",
                title: `Year-End Leave Update — ${priorYear}`,
                message: `Year-end processing complete: ${parts.join("; ")}.`,
                isRead: false,
                metadata: { year: priorYear, events: info.events },
              });
            } catch (notifErr) {
              console.error(`[scheduler] Year-end notification failed for ${info.name}:`, notifErr);
            }
          }
          console.log(`[scheduler] Year-end notifications sent to ${userYearEndMap.size} employees.`);
        }
      } catch (yearEndErr) {
        console.error("[scheduler] Year-end batch failed — proceeding with January accrual:", yearEndErr);
      }
    }

    console.log(`[scheduler] Monthly leave accrual triggered for ${month}/${year} (1st at 00:00 IST). Running...`);
    try {
      // Compute IST year/month explicitly — server may run in UTC
      const { year, month } = getIstDateTime();
      const result = await storage.accrueMonthlyLeaves(year, month);
      console.log(`[scheduler] Accrual done for ${month}/${year}: ${result.usersProcessed} processed, ${result.accrualsMade} accruals made, ${result.skippedUsers.length} skipped.`);

      // Send per-employee in-app notifications and email
      const featureFlagsSetting = await storage.getSystemSetting("feature_flags");
      const featureFlags = (featureFlagsSetting?.value as Record<string, boolean>) || {};
      const notificationsEnabled = featureFlags.notifications_enabled === true;

      const monthName = new Date(year, month - 1).toLocaleString("en-IN", { month: "long" });

      // Group by employee
      const userMap = new Map<string, { email: string; name: string; types: { leaveTypeName: string; days: number; newBalance: number; accrualType: string }[] }>();
      for (const detail of result.processedDetails) {
        const existing = userMap.get(detail.userId);
        if (existing) {
          existing.types.push({ leaveTypeName: detail.leaveTypeName, days: detail.accruedDays, newBalance: detail.newBalance, accrualType: detail.accrualType });
        } else {
          userMap.set(detail.userId, {
            email: detail.email,
            name: detail.name,
            types: [{ leaveTypeName: detail.leaveTypeName, days: detail.accruedDays, newBalance: detail.newBalance, accrualType: detail.accrualType }],
          });
        }
      }

      for (const [userId, info] of Array.from(userMap.entries())) {
        const typesSummary = info.types.map((t: { leaveTypeName: string; days: number; newBalance: number; accrualType: string }) => {
          const bonus = t.accrualType === "monthly+bonus" ? " (incl. bonus)" : "";
          return `${t.leaveTypeName}: +${t.days}${bonus} → balance: ${t.newBalance.toFixed(1)}`;
        }).join("; ");

        // In-app notification
        if (notificationsEnabled) {
          try {
            await storage.createNotification({
              userId,
              type: "leave_accrual",
              title: `${monthName} ${year} Leave Credited`,
              message: `Your leave has been credited for ${monthName} ${year}. ${typesSummary}.`,
              isRead: false,
              metadata: { year, month, types: info.types },
            });
          } catch (notifErr) {
            console.error(`[scheduler] Accrual notification failed for ${info.name}:`, notifErr);
          }
        }

      }

      console.log(`[scheduler] Sent accrual notifications to ${userMap.size} employees.`);
    } catch (error) {
      console.error("[scheduler] Monthly leave accrual failed:", error);
    }
  }, {
    timezone: "Asia/Kolkata",
  });

  // Night shift consent expiry alerts — daily at 8 AM IST
  cron.schedule("0 8 * * *", async () => {
    console.log("[scheduler] Running night shift consent expiry check...");
    try {
      const now = new Date();
      const in30days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const in14days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

      const consents = await db.select({
        consent: nightShiftConsents,
        user: { id: adminUsers.id, email: adminUsers.email, firstName: adminUsers.firstName, lastName: adminUsers.lastName },
      }).from(nightShiftConsents)
        .innerJoin(adminUsers, eq(adminUsers.id, nightShiftConsents.userId))
        .where(and(eq(nightShiftConsents.isActive, true), gt(nightShiftConsents.expiresAt, now)));

      // Fetch all active HR users for 30-day HR alerts (privacy: consent details go to HR only, not manager)
      const hrUsers = await db.select({ id: adminUsers.id }).from(adminUsers)
        .where(and(eq(adminUsers.isActive, true), eq(adminUsers.role, "hr"), isNull(adminUsers.deletedAt)));

      for (const { consent, user } of consents) {
        const expiresAt = new Date(consent.expiresAt);
        const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        // 14-day alert: notify the employee directly
        if (daysLeft <= 14) {
          await storage.createNotification({
            userId: user.id,
            type: "night_shift_consent_expiring",
            title: "Night Shift Consent Expiring Soon",
            message: `Your Night Shift Consent will expire in ${daysLeft} day(s) on ${expiresAt.toLocaleDateString()}. Please re-sign to remain compliant.`,
            isRead: false,
            metadata: { consentId: consent.id, expiresAt: expiresAt.toISOString(), daysLeft },
          }).catch(err => console.error("[scheduler] Night shift consent notification failed:", err));
        }

        // 30-day alert: notify HR users only (not manager — privacy requirement)
        if (daysLeft <= 30 && daysLeft > 14) {
          for (const hrUser of hrUsers) {
            await storage.createNotification({
              userId: hrUser.id,
              type: "night_shift_consent_hr_alert",
              title: "Night Shift Consent Expiring — Action Required",
              message: `${user.firstName} ${user.lastName}'s Night Shift Consent expires in ${daysLeft} day(s) on ${expiresAt.toLocaleDateString()}. Please follow up.`,
              isRead: false,
              metadata: { employeeId: user.id, employeeName: `${user.firstName} ${user.lastName}`, expiresAt: expiresAt.toISOString(), daysLeft },
            }).catch(err => console.error("[scheduler] Night shift consent HR notification failed:", err));
          }
        }
      }

      // Mark expired consents as inactive + status="expired"
      await db.update(nightShiftConsents)
        .set({ isActive: false, status: "expired" })
        .where(and(eq(nightShiftConsents.isActive, true), lt(nightShiftConsents.expiresAt, now)));

      console.log(`[scheduler] Night shift consent check complete. ${consents.length} active consents checked.`);
    } catch (error) {
      console.error("[scheduler] Night shift consent expiry check failed:", error);
    }
  }, {
    timezone: "Asia/Kolkata",
  });

  // Morning absent sweep: runs at 08:00 IST every day.
  // By 08:00 IST all overnight shifts have ended:
  //   - SHIFT_A DST (end 02:30) and STD (end 03:30) ended 4–5.5 h earlier.
  //   - SHIFT_B DST (end 04:30) and STD (end 05:30) ended 2–3.5 h earlier.
  //   - SHIFT_C DST (end 06:30) and STD (end 07:30) ended 0.5–1.5 h earlier.
  // The sweep targets YESTERDAY'S IST date (the calendar day the shifts started —
  // employees punched in on the prior evening). The overnight-shift guard remains as
  // a belt-and-suspenders check for any edge case where a shift extends past 08:00.
  cron.schedule("0 8 * * *", async () => {
    const { year, month, day } = getIstDateTime();
    // Compute yesterday's IST date (the shift start date for overnight shifts)
    const todayDate = new Date(Date.UTC(year, month - 1, day));
    const yesterdayDate = new Date(todayDate.getTime() - 24 * 60 * 60 * 1000);
    const yd = yesterdayDate.toISOString().slice(0, 10);
    const todayStr = yd;
    console.log(`[scheduler] Running early-morning absent sweep for ${todayStr} (yesterday's date)...`);
    try {
      const result = await runAbsentSweep(todayStr);
      if (result.skippedWeekend) {
        console.log(`[scheduler] Absent sweep skipped — weekend (${todayStr})`);
      } else if (result.skippedHoliday) {
        console.log(`[scheduler] Absent sweep skipped — public holiday: ${result.skippedHoliday}`);
      } else {
        console.log(`[scheduler] Absent sweep complete for ${todayStr}: ${result.created} absence proposal(s) enqueued, ${result.skipped} skipped.`);

        // Daily summary: notify Super Admins of proposals awaiting review.
        // Respects the notifications_enabled feature flag.
        if (result.created > 0) {
          try {
            const flags = (await storage.getSystemSetting("feature_flags"))?.value as Record<string, boolean> | undefined;
            if (flags?.notifications_enabled) {
              const superAdmins = await db.select({ id: adminUsers.id })
                .from(adminUsers)
                .where(and(
                  isNull(adminUsers.deletedAt),
                  eq(adminUsers.isActive, true),
                  eq(adminUsers.role, "super_admin"),
                ));
              for (const sa of superAdmins) {
                await storage.createNotification({
                  userId: sa.id,
                  type: "pending_changes_digest",
                  title: `${result.created} attendance proposal${result.created === 1 ? "" : "s"} need review`,
                  message: `The end-of-day absent sweep proposed ${result.created} absence${result.created === 1 ? "" : "s"} for ${todayStr}. Review and approve or reject in Automated Changes.`,
                  isRead: false,
                  metadata: { runDate: todayStr, sourceJob: "absent_sweep", count: result.created },
                }).catch(console.error);
              }
              console.log(`[scheduler] Absent sweep digest sent to ${superAdmins.length} super admin(s).`);
            }
          } catch (notifyErr) {
            console.error("[scheduler] Absent sweep digest notification failed:", notifyErr);
          }
        }
      }
    } catch (error) {
      console.error("[scheduler] Absent sweep failed:", error);
    }
  }, {
    timezone: "Asia/Kolkata",
  });

  // Weekly overtime recognition scan — runs every Monday at 9:00 AM IST
  cron.schedule("0 9 * * 1", async () => {
    console.log("[scheduler] Running weekly overtime recognition scan...");
    try {
      const { runOvertimeRecognitionScan } = await import("./attendanceExceptionRoutes");
      await runOvertimeRecognitionScan();
      console.log("[scheduler] Overtime recognition scan complete.");
    } catch (err) {
      console.error("[scheduler] Overtime recognition scan failed:", err);
    }
  }, {
    timezone: "Asia/Kolkata",
  });

  // Admin route to update shift grace period: handled in routes.ts
  // (PATCH /api/hr/admin/shifts/:id/grace-period)

  // Attendance report auto-creation: 1st of month at 00:05 IST
  // Creates the attendance report run for the prior month if none exists yet
  cron.schedule("5 0 1 * *", async () => {
    console.log("[scheduler] Auto-creating attendance report run for prior month...");
    try {
      const { year, month } = getIstDateTime();
      let prevMonth = month - 1;
      let prevYear = year;
      if (prevMonth === 0) { prevMonth = 12; prevYear = year - 1; }

      const existing = (await db.execute(sql`
        SELECT id FROM attendance_report_runs WHERE month = ${prevMonth} AND year = ${prevYear} LIMIT 1
      `)) as any[];

      if (existing.length > 0) {
        console.log(`[scheduler] Attendance report run for ${prevMonth}/${prevYear} already exists — skipping.`);
        return;
      }

      const { runId, managerIds } = await generateAttendanceReportRun(prevMonth, prevYear);
      console.log(`[scheduler] Attendance report run created for ${prevMonth}/${prevYear}: ${runId}, managers: ${managerIds.length}`);

      if (managerIds.length > 0) {
        const managers = await db.select({ id: adminUsers.id, email: adminUsers.email, firstName: adminUsers.firstName, lastName: adminUsers.lastName })
          .from(adminUsers)
          .where(and(isNull(adminUsers.deletedAt), eq(adminUsers.isActive, true)));
        const managerList = managers.filter(m => managerIds.includes(m.id));
        const monthName = new Date(prevYear, prevMonth - 1, 1).toLocaleString("en-US", { month: "long" });
        const { sendAttendanceApprovalRequestEmail } = await import("./email");
        const deadlineAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const appUrl = process.env.APP_URL || "https://hire-in.com";

        for (const mgr of managerList) {
          sendAttendanceApprovalRequestEmail({
            to: mgr.email,
            managerName: `${mgr.firstName} ${mgr.lastName}`,
            month: monthName,
            year: prevYear,
            deadlineAt,
            approvalUrl: `${appUrl}/admin/hr/my-team?tab=attendance-approval`,
          }).catch(console.error);
        }

        // In-app notifications for managers
        const flags = (await storage.getSystemSetting("feature_flags"))?.value as Record<string, boolean> | undefined;
        if (flags?.notifications_enabled) {
          for (const mgr of managerList) {
            await storage.createNotification({
              userId: mgr.id,
              title: "Attendance Approval Required",
              message: `Your team's attendance report for ${monthName} ${prevYear} is ready for review. Please approve within 24 hours.`,
              type: "action",
            }).catch(console.error);
          }
        }
      }
    } catch (error) {
      console.error("[scheduler] Attendance report auto-create failed:", error);
    }
  }, {
    timezone: "Asia/Kolkata",
  });

  // Attendance T-2h reminder: runs every hour, sends reminder to managers who haven't responded within T-2h of deadline
  cron.schedule("0 * * * *", async () => {
    try {
      const now = new Date();
      const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

      // Find runs with deadline within the next 2 hours that are not yet in terminal state
      const runs = Array.from((await db.execute(sql`
        SELECT id, month, year, deadline_at, status FROM attendance_report_runs
        WHERE status != 'approved' AND status != 'overridden' AND status != 'deadline_expired'
          AND deadline_at IS NOT NULL
          AND deadline_at > ${now.toISOString()}
          AND deadline_at <= ${twoHoursFromNow.toISOString()}
      `)) as any) as any[];

      for (const run of runs) {
        const pendingManagers = Array.from((await db.execute(sql`
          SELECT ma.manager_id, u.email, u.first_name, u.last_name
          FROM attendance_report_manager_approvals ma
          JOIN admin_users u ON u.id = ma.manager_id
          WHERE ma.run_id = ${run.id} AND (ma.status = 'pending' OR ma.status = 'edits_submitted')
        `)) as any) as any[];

        if (pendingManagers.length === 0) continue;

        const monthName = new Date(run.year, run.month - 1, 1).toLocaleString("en-US", { month: "long" });
        const deadline = new Date(run.deadline_at);
        const { sendAttendanceApprovalRequestEmail } = await import("./email");
        const appUrl = process.env.APP_URL || "https://hire-in.com";
        const flags = (await storage.getSystemSetting("feature_flags"))?.value as Record<string, boolean> | undefined;

        for (const mgr of pendingManagers) {
          sendAttendanceApprovalRequestEmail({
            to: mgr.email,
            managerName: `${mgr.first_name} ${mgr.last_name}`,
            month: monthName,
            year: run.year,
            deadlineAt: deadline,
            approvalUrl: `${appUrl}/admin/hr/my-team?tab=attendance-approval`,
            policyType: "attendance_approval_reminder",
          }).catch(console.error);

          if (flags?.notifications_enabled) {
            await storage.createNotification({
              userId: mgr.manager_id,
              title: "Reminder: Attendance Approval Due Soon",
              message: `You have less than 2 hours to approve your team's attendance for ${monthName} ${run.year}.`,
              type: "warning",
            }).catch(console.error);
          }
        }

        console.log(`[scheduler] T-2h attendance reminder sent for ${run.month}/${run.year} to ${pendingManagers.length} manager(s)`);
      }
    } catch (error) {
      console.error("[scheduler] T-2h attendance reminder failed:", error);
    }
  });

  // Attendance deadline expiry processor: runs every 15 minutes
  // Marks any run whose deadline_at has passed (and is not yet in a terminal state) as deadline_expired
  // and sends a one-time HR escalation email.  The once-monthly cron at 08:00 IST on the 1st remains
  // as a belt-and-suspenders catch, but this is the primary processor.
  const processExpiredDeadlines = async () => {
    try {
      const now = new Date();
      const expiredRuns = Array.from((await db.execute(sql`
        SELECT id, month, year FROM attendance_report_runs
        WHERE deadline_at IS NOT NULL
          AND deadline_at < ${now.toISOString()}
          AND status != 'approved' AND status != 'overridden' AND status != 'deadline_expired'
      `)) as any) as any[];

      for (const run of expiredRuns) {
        await db.execute(sql`
          UPDATE attendance_report_runs SET status = 'deadline_expired', updated_at = NOW()
          WHERE id = ${run.id}
        `);

        const hrAdmins = await db.select({ id: adminUsers.id, email: adminUsers.email, role: adminUsers.role })
          .from(adminUsers)
          .where(and(isNull(adminUsers.deletedAt), eq(adminUsers.isActive, true)));
        const hrEmails = hrAdmins.filter(u => ["super_admin", "admin", "hr"].includes(u.role || "")).map(u => u.email);
        const monthName = new Date(run.year, run.month - 1, 1).toLocaleString("en-US", { month: "long" });
        const { sendAttendanceDeadlineExpiredEmail } = await import("./email");

        if (hrEmails.length > 0) {
          sendAttendanceDeadlineExpiredEmail({
            toEmails: hrEmails,
            month: monthName,
            year: run.year,
            overrideUrl: `${process.env.APP_URL || "https://hire-in.com"}/admin/hr/reports?tab=attendance-approvals`,
          }).catch(console.error);
        }

        console.log(`[scheduler] Attendance deadline expired for ${run.month}/${run.year} — HR notified`);
      }
    } catch (error) {
      console.error("[scheduler] Deadline expiry processor failed:", error);
    }
  };

  cron.schedule("*/15 * * * *", processExpiredDeadlines);

  // Belt-and-suspenders: also check on the 1st at 08:00 IST (kept for timezone correctness)
  cron.schedule("0 8 1 * *", processExpiredDeadlines, { timezone: "Asia/Kolkata" });

  // ─── 25th-of-month: Manager Regularization Digest ───────────────────────────
  // Sends each manager a list of their pending regularization requests so they
  // resolve them before the month-end salary run.
  // Guarded by the notifications_enabled feature flag.
  cron.schedule("0 9 25 * *", async () => {
    try {
      const notifSetting = await storage.getSystemSetting("notifications_enabled");
      if (notifSetting?.value === "false") return;

      const { getIstDateTime: _getIst } = { getIstDateTime: () => getIstDateTime() };
      const { year, month } = getIstDateTime();
      const monthStr  = `${year}-${String(month).padStart(2, "0")}`;
      const nextMonth = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;

      // Fetch all pending regularizations for the current month
      const pendingRows = (await db.execute(sql`
        SELECT ar.id, ar.employee_id, ar.attendance_date, ar.request_type, ar.created_at,
               u.first_name, u.last_name, u.manager_id
        FROM attendance_regularizations ar
        JOIN admin_users u ON u.id = ar.employee_id
        WHERE ar.attendance_date >= ${monthStr + "-01"}
          AND ar.attendance_date <  ${nextMonth + "-01"}
          AND ar.status = 'pending'
          AND u.is_active = true
          AND u.deleted_at IS NULL
        ORDER BY ar.created_at ASC
      `)).rows as any[];

      if (pendingRows.length === 0) {
        console.log("[scheduler] 25th digest: no pending regularizations for the month");
        return;
      }

      // Group by manager
      const byManager: Map<string, Array<{ employeeName: string; attendanceDate: string; requestType: string; submittedAt: string }>> = new Map();
      for (const row of pendingRows) {
        if (!row.manager_id) continue;
        if (!byManager.has(row.manager_id)) byManager.set(row.manager_id, []);
        byManager.get(row.manager_id)!.push({
          employeeName: `${row.first_name} ${row.last_name}`,
          attendanceDate: row.attendance_date,
          requestType: row.request_type,
          submittedAt: row.created_at,
        });
      }

      const { sendManagerRegularizationDigestEmail } = await import("./email");
      const reviewUrl = `${process.env.APP_URL || "https://hire-in.com"}/admin/hr/regularizations`;

      for (const [managerId, requests] of byManager) {
        const manager = await storage.getAdminUser(managerId);
        if (!manager?.email) continue;

        sendManagerRegularizationDigestEmail({
          to: manager.email,
          managerName: `${manager.firstName} ${manager.lastName}`,
          pendingRequests: requests,
          reviewUrl,
        }).catch(console.error);

        // In-app notification for the manager
        await storage.createNotification({
          userId: managerId,
          type: "regularization_digest",
          title: `${requests.length} Regularization Request${requests.length === 1 ? "" : "s"} Pending`,
          message: `You have ${requests.length} attendance correction request${requests.length === 1 ? "" : "s"} pending review before month-end salary run.`,
          isRead: false,
          metadata: { month, year, pendingCount: requests.length },
        });
      }

      console.log(`[scheduler] 25th digest sent to ${byManager.size} managers for ${pendingRows.length} pending requests`);
    } catch (error) {
      console.error("[scheduler] 25th regularization digest failed:", error);
    }
  }, { timezone: "Asia/Kolkata" });

  // ─── Daily 8 AM: Plan check-in notification reminders ──────────────────────
  // Employee gets a day-before reminder; manager gets a same-day reminder.
  // Both respect the notifications_enabled feature flag.
  // Uses notified_at on check_ins to prevent duplicate sends.
  cron.schedule("0 8 * * *", async () => {
    try {
      const flags = (await storage.getSystemSetting("feature_flags"))?.value as Record<string, boolean> | undefined;
      if (!flags?.notifications_enabled) return;

      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split("T")[0];
      const todayStr = now.toISOString().split("T")[0];

      // Day-before employee reminders (check-ins scheduled for tomorrow, not yet notified)
      const dayBeforeRows = (await db.execute(sql`
        SELECT ci.id, ci.employee_id, ci.plan_id, ci.check_in_type, ci.scheduled_date,
               ep.plan_type
        FROM check_ins ci
        JOIN employee_plans ep ON ci.plan_id = ep.id
        WHERE ci.scheduled_date = ${tomorrowStr}
          AND ci.status = 'scheduled'
          AND ci.plan_id IS NOT NULL
          AND ep.status = 'active'
          AND ci.notified_at IS NULL
      `)).rows as any[];

      for (const ci of dayBeforeRows) {
        const ciTypeLabel = (ci.check_in_type as string).replace(/_/g, " ");
        await storage.createNotification({
          userId: ci.employee_id,
          type: "checkin_reminder_employee",
          title: "Check-in tomorrow",
          message: `Reminder: you have a ${ciTypeLabel} check-in scheduled for tomorrow.`,
          isRead: false,
          metadata: { planId: ci.plan_id, checkInId: ci.id, scheduledDate: ci.scheduled_date, planType: ci.plan_type },
        });
        await db.execute(sql`UPDATE check_ins SET notified_at = NOW() WHERE id = ${ci.id}`);
      }

      // Same-day manager reminders (check-ins scheduled for today, manager assigned, not yet notified)
      // Uses manager_notified_at as a separate dedupe marker independent of the day-before employee flag
      const sameDayRows = (await db.execute(sql`
        SELECT ci.id, ci.employee_id, ci.manager_id, ci.plan_id, ci.check_in_type, ci.scheduled_date,
               ep.plan_type,
               au.first_name || ' ' || au.last_name AS employee_name
        FROM check_ins ci
        JOIN employee_plans ep ON ci.plan_id = ep.id
        JOIN admin_users au ON ci.employee_id = au.id
        WHERE ci.scheduled_date = ${todayStr}
          AND ci.status = 'scheduled'
          AND ci.plan_id IS NOT NULL
          AND ep.status = 'active'
          AND ci.manager_id IS NOT NULL
          AND ci.manager_notified_at IS NULL
      `)).rows as any[];

      for (const ci of sameDayRows) {
        const ciTypeLabel = (ci.check_in_type as string).replace(/_/g, " ");
        await storage.createNotification({
          userId: ci.manager_id,
          type: "checkin_reminder_manager",
          title: `Check-in today: ${ci.employee_name}`,
          message: `${ci.employee_name} has a ${ciTypeLabel} check-in scheduled for today.`,
          isRead: false,
          metadata: { planId: ci.plan_id, checkInId: ci.id, employeeId: ci.employee_id, planType: ci.plan_type },
        });
        // Mark manager as notified so reruns / retries don't duplicate
        await db.execute(sql`UPDATE check_ins SET manager_notified_at = NOW() WHERE id = ${ci.id}`);
      }

      console.log(`[scheduler] Plan check-in reminders: ${dayBeforeRows.length} day-before, ${sameDayRows.length} same-day`);
    } catch (err) {
      console.error("[scheduler] Plan check-in reminder job failed:", err);
    }
  }, { timezone: "Asia/Kolkata" });

  // ─── Monday 9 AM: HR overdue check-in digest ────────────────────────────────
  // Sends each HR/admin user a single in-app notification listing all check-ins
  // that are 3+ days overdue across all active plans. Respects notifications_enabled.
  cron.schedule("0 9 * * 1", async () => {
    try {
      const flags = (await storage.getSystemSetting("feature_flags"))?.value as Record<string, boolean> | undefined;
      if (!flags?.notifications_enabled) return;

      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - 3);
      const thresholdStr = thresholdDate.toISOString().split("T")[0];

      const overdueRows = (await db.execute(sql`
        SELECT ci.id, ci.employee_id, ci.plan_id, ci.check_in_type, ci.scheduled_date,
               ep.plan_type,
               au.first_name || ' ' || au.last_name AS employee_name
        FROM check_ins ci
        JOIN employee_plans ep ON ci.plan_id = ep.id
        JOIN admin_users au ON ci.employee_id = au.id
        WHERE ci.scheduled_date < ${thresholdStr}
          AND ci.status != 'completed'
          AND ci.plan_id IS NOT NULL
          AND ep.status = 'active'
        ORDER BY ci.scheduled_date ASC
      `)).rows as any[];

      if (overdueRows.length === 0) {
        console.log("[scheduler] Monday digest: no overdue plan check-ins");
        return;
      }

      const hrAdmins = (await db.execute(sql`
        SELECT id FROM admin_users
        WHERE role IN ('hr', 'admin', 'super_admin') AND is_active = true AND deleted_at IS NULL
      `)).rows as any[];

      const digestMsg = `${overdueRows.length} check-in${overdueRows.length !== 1 ? "s" : ""} across active plans are 3+ days overdue.`;
      for (const hr of hrAdmins) {
        await storage.createNotification({
          userId: hr.id,
          type: "checkin_overdue_digest",
          title: `Overdue check-ins: ${overdueRows.length} pending`,
          message: digestMsg,
          isRead: false,
          metadata: {
            overdueCount: overdueRows.length,
            items: overdueRows.slice(0, 20).map((r: any) => ({
              employeeName: r.employee_name,
              scheduledDate: r.scheduled_date,
              planType: r.plan_type,
              checkInType: r.check_in_type,
            })),
          },
        });
      }

      console.log(`[scheduler] Monday digest: ${overdueRows.length} overdue check-ins notified to ${hrAdmins.length} HR/admin users`);
    } catch (err) {
      console.error("[scheduler] Monday overdue check-in digest failed:", err);
    }
  }, { timezone: "Asia/Kolkata" });

  // Content Studio: every 5 minutes, flip scheduled articles whose time has
  // arrived to published.
  cron.schedule("*/5 * * * *", async () => {
    try {
      const now = new Date();
      const due = await storage.getDueScheduledStudioArticles(now);
      if (due.length === 0) return;
      for (const article of due) {
        try {
          await storage.updateStudioArticle(article.id, {
            status: "published",
            publishedAt: new Date(),
          } as any);
          try {
            const { notifyNewContentSubscribers } = await import("./newsletterService");
            void notifyNewContentSubscribers(article.id);
          } catch (e) {
            console.error("[scheduler] newsletter notify failed:", e);
          }
          await storage.createStudioAuditEvent({
            articleId: article.id,
            actorUserId: null,
            eventType: "article_published",
            metadata: { via: "scheduler", scheduledAt: article.scheduledAt ?? null },
          } as any);
          await storage.createStudioAuditEvent({
            articleId: article.id,
            actorUserId: null,
            eventType: "status_changed",
            metadata: { from: "scheduled", to: "published", via: "scheduler" },
          } as any);
          if (article.createdBy) {
            await storage.createNotification({
              userId: article.createdBy,
              type: "studio_published",
              title: "Scheduled article published",
              message: `"${article.title}" went live on schedule.`,
              isRead: false,
              metadata: { articleId: article.id, scheduled: false },
            });
          }
        } catch (articleErr) {
          console.error(`[scheduler] Studio auto-publish failed for ${article.id}:`, articleErr);
        }
      }
      console.log(`[scheduler] Studio auto-publish: ${due.length} article(s) published.`);
    } catch (err) {
      console.error("[scheduler] Studio auto-publish sweep failed:", err);
    }
  });

  // Offer letter & addendum signing reminder: daily at 9 AM IST
  // Finds unsigned docs sent 2+ days ago, not yet reminded, not yet expired.
  // Sends reminder email to signee (+ CC to HR issuer), marks reminderSentAt.
  cron.schedule("0 9 * * *", async () => {
    try {
      const now = new Date();
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

      // --- Offer letters ---
      const pendingOffers = await db
        .select()
        .from(offerLetters)
        .where(
          and(
            eq(offerLetters.status, "sent"),
            lte(offerLetters.createdAt, twoDaysAgo),
            isNull(offerLetters.reminderSentAt),
            gt(offerLetters.expiresAt, now),
          ),
        );

      let offerReminders = 0;
      for (const letter of pendingOffers) {
        try {
          const baseUrl = process.env.REPL_SLUG
            ? `https://${process.env.REPL_SLUG}.replit.app`
            : "https://hire-in.com";
          const acceptUrl = `${baseUrl}/onboard/${letter.token}`;
          const expiresAt = new Date(letter.expiresAt);
          const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          const ccList = letter.ccEmails ? letter.ccEmails.split(",").map((e: string) => e.trim()).filter(Boolean) : [];

          await sendOfferLetterReminderEmail({
            to: letter.candidatePersonalEmail,
            candidateName: letter.candidateName,
            designation: letter.designation,
            acceptUrl,
            expiresAt,
            daysLeft,
            cc: ccList.length > 0 ? ccList : undefined,
          });
          await db.update(offerLetters).set({ reminderSentAt: now }).where(eq(offerLetters.id, letter.id));
          offerReminders++;
        } catch (err) {
          console.error(`[scheduler] Offer reminder failed for ${letter.id}:`, err);
        }
      }

      // --- Addendums ---
      const pendingAddendums = await db
        .select()
        .from(offerLetterAddendums)
        .where(
          and(
            eq(offerLetterAddendums.status, "sent"),
            lte(offerLetterAddendums.issuedAt, twoDaysAgo),
            isNull(offerLetterAddendums.reminderSentAt),
            gt(offerLetterAddendums.expiresAt, now),
          ),
        );

      let addendumReminders = 0;
      for (const addendum of pendingAddendums) {
        try {
          const baseUrl = process.env.REPL_SLUG
            ? `https://${process.env.REPL_SLUG}.replit.app`
            : "https://hire-in.com";
          const acceptUrl = `${baseUrl}/addendum/${addendum.token}`;
          const expiresAt = new Date(addendum.expiresAt!);
          const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          const ccList = addendum.ccEmails ? addendum.ccEmails.split(",").map((e: string) => e.trim()).filter(Boolean) : [];

          // Find recipient email
          let recipientEmail = "";
          if (addendum.offerLetterId) {
            const [offerRow] = await db.select().from(offerLetters).where(eq(offerLetters.id, addendum.offerLetterId));
            recipientEmail = offerRow?.candidatePersonalEmail || "";
          } else if (addendum.forEmployeeId) {
            const emp = await storage.getAdminUser(addendum.forEmployeeId);
            recipientEmail = emp?.email || "";
          }

          if (!recipientEmail) continue;

          await sendAddendumReminderEmail({
            to: recipientEmail,
            candidateName: addendum.candidateName,
            addendumType: addendum.addendumType,
            acceptUrl,
            expiresAt,
            daysLeft,
            cc: ccList.length > 0 ? ccList : undefined,
          });
          await db.update(offerLetterAddendums).set({ reminderSentAt: now }).where(eq(offerLetterAddendums.id, addendum.id));
          addendumReminders++;
        } catch (err) {
          console.error(`[scheduler] Addendum reminder failed for ${addendum.id}:`, err);
        }
      }

      console.log(`[scheduler] Signing reminders: ${offerReminders} offer letter(s), ${addendumReminders} addendum(s) reminded.`);
    } catch (err) {
      console.error("[scheduler] Signing reminder sweep failed:", err);
    }
  }, { timezone: "Asia/Kolkata" });

  // GSA per diem nightly refresh — 02:00 EST (07:00 UTC) — refreshes all ZIPs used in last 90 days
  cron.schedule("0 7 * * *", async () => {
    console.log("[scheduler] GSA nightly ZIP refresh starting…");
    try {
      await refreshRecentZips();
    } catch (err) {
      console.error("[scheduler] GSA nightly refresh failed:", err);
    }
  });

  // ─── Guided onboarding reminders (Task #630) ────────────────────────────────
  // Weekly, Monday 10 AM IST: nudge active users who still have outstanding
  // onboarding checklist items with a single in-app notification. Purely a
  // nudge — never blocks anything. Respects the notifications_enabled flag.
  cron.schedule("0 10 * * 1", async () => {
    try {
      const flags = (await storage.getSystemSetting("feature_flags"))?.value as Record<string, boolean> | undefined;
      if (!flags?.notifications_enabled) return;

      const { computeOnboardingChecklist } = await import("./onboardingChecklist");
      const users = await db
        .select({ id: adminUsers.id, role: adminUsers.role })
        .from(adminUsers)
        .where(and(eq(adminUsers.isActive, true), isNull(adminUsers.deletedAt)));

      let reminded = 0;
      for (const u of users) {
        try {
          const checklist = await computeOnboardingChecklist(u.id, u.role || "");
          if (checklist.complete || checklist.counts.total <= 0) continue;
          await storage.createNotification({
            userId: u.id,
            type: "onboarding_reminder",
            title: "Finish setting up your account",
            message: `You have ${checklist.counts.total} onboarding item${checklist.counts.total === 1 ? "" : "s"} left (${checklist.overallPct}% done). It only takes a minute — find them on your dashboard.`,
            isRead: false,
            metadata: { overallPct: checklist.overallPct, total: checklist.counts.total, pendingSections: checklist.pendingSections },
          }).catch(console.error);
          reminded++;
        } catch (perUserErr) {
          console.error(`[scheduler] Onboarding reminder failed for ${u.id}:`, perUserErr);
        }
      }
      console.log(`[scheduler] Onboarding reminders: ${reminded} user(s) nudged.`);
    } catch (err) {
      console.error("[scheduler] Onboarding reminder sweep failed:", err);
    }
  }, { timezone: "Asia/Kolkata" });

  console.log("[scheduler] All cron jobs scheduled:");
  console.log("  - Salary report hold: last day of month at 6 PM CST → saves as pending_approval");
  console.log("  - Salary report reminder: 1st of month at 8 PM CST → emails super admins if still pending");
  console.log("  - Monthly leave accrual: 1st of month at 00:00 IST (Jan: year-end for prior year runs first, then accrual)");
  console.log("  - Attendance report auto-create: 1st of month at 00:05 IST → generates run + notifies managers");
  console.log("  - Attendance deadline expiry: every 15 min (primary) + 1st of month 08:00 IST (belt-and-suspenders)");
  console.log("  - Attendance T-2h reminder: every hour → emails pending managers approaching deadline");
  console.log("  - Night shift consent expiry check: daily at 8 AM IST");
  console.log("  - Absent sweep: daily at 08:00 IST (all shifts ended by then; targets yesterday's date)");
  console.log("  - Regularization digest: 25th of month at 09:00 IST → emails managers with pending requests");
  console.log("  - Signing reminder sweep: daily at 9 AM IST → reminds unsigned offer letters & addendums at day 2 of 7");
  console.log("  - Overtime recognition scan: every Monday at 09:00 IST → alerts managers of team members with 3+ OT days");
  console.log("  - GSA rate refresh: daily at 02:00 EST → refreshes all ZIPs used in the last 90 days");
}
