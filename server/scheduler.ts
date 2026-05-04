import cron from "node-cron";
import { generateMonthlySalaryReport } from "./salaryReport";
import { sendSalaryReport, sendLeaveAccrualEmail, sendLeaveYearEndEmail } from "./email";
import { storage } from "./storage";
import { db } from "./db";
import { nightShiftConsents, adminUsers } from "@shared/schema";
import { eq, and, lt, gt, isNull } from "drizzle-orm";

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

export function startScheduler() {
  // Salary report: last day of month at 6 PM CST
  cron.schedule("0 18 28-31 * *", async () => {
    if (!isLastDayOfMonth()) {
      console.log("[scheduler] Not the last day of the month, skipping salary report.");
      return;
    }

    console.log("[scheduler] Last day of month detected. Generating salary report...");
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;

      const report = await generateMonthlySalaryReport(year, month);
      console.log(`[scheduler] Report generated: ${report.summary.totalEmployees} employees, $${report.summary.totalPayable} total payable.`);

      const recipientsSetting = await storage.getSystemSetting("salary_report_recipients");
      const recipients = recipientsSetting?.value as { to: string[]; cc: string[] } | undefined;

      const emailResult = await sendSalaryReport({
        csvContent: report.csv,
        summary: report.summary,
        recipients,
      });

      if (emailResult.success) {
        console.log("[scheduler] Salary report email sent successfully.");
      } else {
        console.error("[scheduler] Failed to send salary report email:", emailResult.error);
      }
    } catch (error) {
      console.error("[scheduler] Error generating/sending salary report:", error);
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
            // Year-end email (in-app + email parity with accrual notifications)
            if (info.email) {
              sendLeaveYearEndEmail({
                to: info.email,
                employeeName: info.name,
                year: priorYear,
                events: info.events,
              }).catch(emailErr => console.error(`[scheduler] Year-end email failed for ${info.email}:`, emailErr));
            }
          }
          console.log(`[scheduler] Year-end notifications and emails sent to ${userYearEndMap.size} employees.`);
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

        // Per-employee email with full breakdown
        if (info.email) {
          try {
            await sendLeaveAccrualEmail({
              to: info.email,
              employeeName: info.name,
              year,
              month,
              types: info.types,
            });
          } catch (emailErr) {
            console.error(`[scheduler] Accrual email failed for ${info.email}:`, emailErr);
          }
        }
      }

      console.log(`[scheduler] Sent accrual notifications/emails to ${userMap.size} employees.`);
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

  console.log("[scheduler] All cron jobs scheduled:");
  console.log("  - Salary report: last day of month at 6 PM CST");
  console.log("  - Monthly leave accrual: 1st of month at 00:00 IST (Jan: year-end for prior year runs first, then accrual)");
  console.log("  - Night shift consent expiry check: daily at 8 AM IST");
}
