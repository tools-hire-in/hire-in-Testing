import cron from "node-cron";
import { generateMonthlySalaryReport } from "./salaryReport";
import { sendSalaryReportApprovalReminder, sendOfferLetterReminderEmail, sendAddendumReminderEmail } from "./email";
import { storage } from "./storage";
import { db } from "./db";
import { nightShiftConsents, adminUsers, holidays, attendance, leaveRequests, salaryReportRuns, offerLetters, offerLetterAddendums, policySigningRequests } from "@shared/schema";
import { eq, and, lt, gt, isNull, lte, sql } from "drizzle-orm";
import { generateAttendanceReportRun, ensureRunForMonthAndNotify } from "./attendanceReport";
import { attendanceApprovalUrl, getPortalBaseUrl } from "./portalUrl";
import { refreshRecentZips } from "./gsaRateService";
import { getEnvMode } from "./envMode";

import { notifyUser as notifyStudioUser } from "./studioNotifications";
import { notifyUser } from "./notifications";
import { buildCheckinReminderPayload } from "./contextualNotifications";

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

/** Extract year/month/day in America/Los_Angeles (PST/PDT) for the current instant. */
function getLaDateTime(): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parseInt(parts.find(p => p.type === t)?.value || "0", 10);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** True when the given LA date is the last calendar day of its month. */
function isLastDayOfMonthLa(la: { year: number; month: number; day: number }): boolean {
  const daysInMonth = new Date(la.year, la.month, 0).getDate();
  return la.day === daysInMonth;
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

/** Entry shape for each named job in the registry. */
export interface JobRegistryEntry {
  name: string;
  label: string;
  schedule: string;
  handler: () => Promise<void>;
  lastTriggeredAt?: Date;
  lastTriggeredBy?: string;
}

/**
 * Exported registry of named scheduled jobs.
 * Populated by startScheduler(); used by the Dev Control Center trigger endpoint.
 * lastTriggeredAt / lastTriggeredBy are updated in-memory both on schedule fires
 * and on manual "Run Now" triggers.
 */
export const JOB_REGISTRY = new Map<string, JobRegistryEntry>();

/** Convenience: update the registry tracking fields and run the handler. */
async function fireJob(name: string, triggeredBy: string): Promise<void> {
  const entry = JOB_REGISTRY.get(name);
  if (!entry) throw new Error(`Unknown job: ${name}`);
  entry.lastTriggeredAt = new Date();
  entry.lastTriggeredBy = triggeredBy;
  await entry.handler();
}

export function startScheduler() {
  // ─── Auto-suspend ALL cron callbacks in non-production ───────────────────
  // Monkey-patch node-cron's schedule() so that EVERY callback auto-checks
  // env_mode before executing. JOB_REGISTRY handlers are intentionally exempt:
  // they are invoked directly by the Dev Control Center trigger endpoint and
  // must run even in dev/qa.
  //
  // When getEnvMode() throws (DB unavailable), we default to "dev" so that a
  // transient DB error fails safe (jobs are suspended) rather than fail open
  // (jobs fire as if on production and send real emails).
  const _origNodeCronSchedule = cron.schedule.bind(cron);
  (cron as any).schedule = (
    expression: string,
    task: (() => void) | (() => Promise<void>),
    options?: Parameters<typeof cron.schedule>[2],
  ) => {
    const guarded = async () => {
      let envMode: string;
      try { envMode = await getEnvMode(); } catch { envMode = "dev"; }
      if (envMode !== "production") {
        console.log(`[scheduler][SUSPENDED](${expression}) — env_mode=${envMode}`);
        return;
      }
      return (task as () => void | Promise<void>)();
    };
    return _origNodeCronSchedule(expression, guarded as any, options);
  };

  // ─── Named handler functions ──────────────────────────────────────────────
  // Each handler contains the same logic as the corresponding cron callback.
  // Extracted so that the Dev Control Center can trigger them manually.

  async function handleSalaryReportGeneration() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const report = await generateMonthlySalaryReport(year, month);
    console.log(`[scheduler] Report generated: ${report.summary.totalEmployees} employees, ₹${report.summary.totalPayable} total payable.`);
    const existing = await db.select({ id: salaryReportRuns.id })
      .from(salaryReportRuns)
      .where(and(eq(salaryReportRuns.year, year), eq(salaryReportRuns.month, month)))
      .limit(1);
    if (existing.length > 0) {
      await db.update(salaryReportRuns)
        .set({ reportData: report.rows as any, adjustments: {}, status: "pending_approval", generatedAt: new Date(), approvedAt: null, approvedBy: null, emailSentAt: null })
        .where(eq(salaryReportRuns.id, existing[0].id));
      console.log(`[scheduler] Updated existing salary run for ${month}/${year} — status: pending_approval.`);
    } else {
      await db.insert(salaryReportRuns).values({ year, month, status: "pending_approval", reportData: report.rows as any, adjustments: {} as any });
      console.log(`[scheduler] Saved salary run for ${month}/${year} — status: pending_approval.`);
    }
  }

  async function handleAbsentSweep() {
    const { year, month, day } = getIstDateTime();
    const todayDate = new Date(Date.UTC(year, month - 1, day));
    const yesterdayDate = new Date(todayDate.getTime() - 24 * 60 * 60 * 1000);
    const todayStr = yesterdayDate.toISOString().slice(0, 10);
    console.log(`[scheduler] Running early-morning absent sweep for ${todayStr}...`);
    const result = await runAbsentSweep(todayStr);
    if (result.skippedWeekend) {
      console.log(`[scheduler] Absent sweep skipped — weekend (${todayStr})`);
    } else if (result.skippedHoliday) {
      console.log(`[scheduler] Absent sweep skipped — public holiday: ${result.skippedHoliday}`);
    } else {
      console.log(`[scheduler] Absent sweep complete for ${todayStr}: ${result.created} proposal(s) enqueued, ${result.skipped} skipped.`);
    }
  }

  async function handleGoalAutoProgressSync() {
    console.log("[scheduler] Running goal auto-progress sync...");
    const { runGoalAutoProgressSync } = await import("./goalAutoProgressService");
    const result = await runGoalAutoProgressSync();
    console.log(
      `[scheduler] Goal auto-progress sync complete: ${result.suggested} suggested, ` +
      `${result.skipped} skipped, ${result.anomalyFlagged} anomaly-flagged, ` +
      `${result.escalationFlagged} escalation-flagged, ${result.errors} errors.`,
    );
  }

  async function handleAttendanceReportMonthEnd() {
    const la = getLaDateTime();
    console.log(`[scheduler] Ensuring attendance report run for ${la.month}/${la.year}...`);
    const result = await ensureRunForMonthAndNotify(la.month, la.year);
    console.log(`[scheduler] Attendance report ${result.created ? "created" : "reconciled"} for ${la.month}/${la.year}: run ${result.runId}, notified ${result.notified} manager(s)`);
  }

  async function handleMonthlyLeaveAccrual() {
    const { year, month } = getIstDateTime();
    console.log(`[scheduler] Monthly leave accrual triggered for ${month}/${year}. Running...`);
    const result = await storage.accrueMonthlyLeaves(year, month);
    console.log(`[scheduler] Accrual done for ${month}/${year}: ${result.usersProcessed} processed, ${result.accrualsMade} accruals made, ${result.skippedUsers.length} skipped.`);
  }

  async function handleGovernanceSyncSweep() {
    console.log("[scheduler] Running unified governance sync sweep...");
    const { runGovernanceSyncSweep } = await import("./governanceService");
    const result = await runGovernanceSyncSweep();
    console.log(
      `[scheduler] Governance sync sweep complete: findings=${result.findingsCollected}, applied=${result.escalationsApplied}, notifications=${result.notificationsSent}`
    );
  }

  // ─── Register jobs in JOB_REGISTRY ───────────────────────────────────────
  JOB_REGISTRY.set("salary_report_generation", {
    name: "salary_report_generation",
    label: "Salary Report Generation",
    schedule: "Last day of month, 6 PM CST",
    handler: handleSalaryReportGeneration,
  });
  JOB_REGISTRY.set("monthly_leave_accrual", {
    name: "monthly_leave_accrual",
    label: "Monthly Leave Accrual",
    schedule: "1st of month, 00:00 IST",
    handler: handleMonthlyLeaveAccrual,
  });
  JOB_REGISTRY.set("absent_sweep", {
    name: "absent_sweep",
    label: "Absent Sweep",
    schedule: "Daily 8 AM IST (targets yesterday)",
    handler: handleAbsentSweep,
  });
  JOB_REGISTRY.set("goal_auto_progress_sync", {
    name: "goal_auto_progress_sync",
    label: "Goal Auto-Progress Sync",
    schedule: "Daily 7 AM IST",
    handler: handleGoalAutoProgressSync,
  });
  JOB_REGISTRY.set("attendance_report_month_end", {
    name: "attendance_report_month_end",
    label: "Attendance Report Month-End",
    schedule: "Last day of month, 10 PM PST",
    handler: handleAttendanceReportMonthEnd,
  });
  JOB_REGISTRY.set("governance_sync_sweep", {
    name: "governance_sync_sweep",
    label: "Governance Sync Sweep",
    schedule: "Daily 7 AM IST",
    handler: handleGovernanceSyncSweep,
  });

  // Salary report: last day of month at 6 PM CST — generate and hold for approval
  cron.schedule("0 18 28-31 * *", async () => {
    const _envMode = await getEnvMode();
    if (_envMode !== "production") {
      console.log(`[scheduler] [SUSPENDED] salary_report_generation — env_mode=${_envMode}`);
      return;
    }
    if (!isLastDayOfMonth()) {
      console.log("[scheduler] Not the last day of the month, skipping salary report.");
      return;
    }
    const _entry = JOB_REGISTRY.get("salary_report_generation");
    if (_entry) { _entry.lastTriggeredAt = new Date(); _entry.lastTriggeredBy = "scheduler"; }

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
    const _envMode = await getEnvMode();
    if (_envMode !== "production") {
      console.log(`[scheduler] [SUSPENDED] salary_approval_reminder — env_mode=${_envMode}`);
      return;
    }
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

      const toEmails = superAdmins.map(u => u.email).filter(Boolean) as string[];
      if (toEmails.length === 0) {
        console.log("[scheduler] No super admin emails found — skipping reminder.");
        return;
      }

      const monthName = new Date(remindYear, remindMonth - 1, 1).toLocaleString("en-US", { month: "long" });
      const portalUrl = getPortalBaseUrl();

      // Route through blast queue when >= threshold; send directly when below.
      const emailSubject = `Action Required: Salary Report Pending Approval — ${monthName} ${remindYear}`;
      const bodyHtml = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Rayomind Solutions LLP</h1>
            <p style="color: #dbeafe; margin: 8px 0 0; font-size: 14px;">Payroll Approval Reminder</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Salary Report Awaiting Approval</h2>
            <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 16px 20px; margin: 0 0 24px;">
              <p style="color: #c2410c; font-weight: 600; margin: 0 0 6px;">⚠ Pending action required</p>
              <p style="color: #9a3412; margin: 0; font-size: 14px;">
                The salary report for <strong>${monthName} ${remindYear}</strong> is still in
                <em>pending approval</em> status. Please log in to review, adjust if needed,
                and approve the report so it can be dispatched to accounts.
              </p>
            </div>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${portalUrl}/admin/hr/salary-reports"
                 style="display:inline-block;background:#1e40af;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:6px;font-weight:600;font-size:15px;">
                Review &amp; Approve Report
              </a>
            </div>
          </div>
          <div style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="color:#94a3b8;font-size:12px;margin:0;">
              &copy; ${new Date().getFullYear()} Hire'in Solutions (Rayomind Solutions LLP). All rights reserved.
            </p>
          </div>
        </div>`;

      const { queueBlast } = await import("./blastQueue");
      const blastRecipients = toEmails.map(e => ({ userId: "", name: e, email: e }));
      const blastResult = await queueBlast({
        triggerSource: "salary_report_approval_reminder",
        subject: emailSubject,
        bodyHtml,
        recipients: blastRecipients,
      });

      if (blastResult.queued) {
        console.log(`[scheduler] Salary approval reminder queued as blast ${blastResult.blastId} (${blastResult.recipientCount} recipients pending review).`);
      } else {
        // Below threshold — send directly via the existing email function
        const result = await sendSalaryReportApprovalReminder({
          to: toEmails,
          year: remindYear,
          month: remindMonth,
          monthName,
          portalUrl,
        });
        if (result.success) {
          console.log(`[scheduler] Salary approval reminder sent directly to ${toEmails.join(", ")} (below blast threshold).`);
        } else {
          console.error("[scheduler] Failed to send approval reminder:", result.error);
        }
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
    const _envMode = await getEnvMode();
    if (_envMode !== "production") {
      console.log(`[scheduler] [SUSPENDED] monthly_leave_accrual — env_mode=${_envMode}`);
      return;
    }
    const _entry = JOB_REGISTRY.get("monthly_leave_accrual");
    if (_entry) { _entry.lastTriggeredAt = new Date(); _entry.lastTriggeredBy = "scheduler"; }
    const { year, month } = getIstDateTime();

    // January: run year-end for the prior year BEFORE this month's accrual
    if (month === 1) {
      const priorYear = year - 1;
      console.log(`[scheduler] January detected — running year-end batch for ${priorYear} first...`);
      try {
        const result = await storage.runYearEndBatch(priorYear);
        console.log(`[scheduler] Year-end batch done for ${priorYear}: ${result.processed} users, ${result.elCarried} EL carried, ${result.slLapsed} SL lapsed, ${result.coCleared} CO expired.`);

        const { getFeatureFlag: _getFF } = await import("./featureFlags");
        const notificationsEnabled = await _getFF("notifications_enabled");

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
      const { getFeatureFlag: _getFF } = await import("./featureFlags");
      const notificationsEnabled = await _getFF("notifications_enabled");

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

      // Fetch roles for all users in the map so admin/super_admin can be excluded
      const allUserIds = Array.from(userMap.keys());
      const userRoleRows = allUserIds.length > 0
        ? await db.select({ id: adminUsers.id, role: adminUsers.role })
            .from(adminUsers)
            .where(sql`${adminUsers.id} = ANY(ARRAY[${sql.join(allUserIds.map(id => sql`${id}`), sql`, `)}])`)
        : [];
      const userRoleMap = new Map(userRoleRows.map(r => [r.id, r.role]));

      for (const [userId, info] of Array.from(userMap.entries())) {
        const role = userRoleMap.get(userId);
        if (role === "admin" || role === "super_admin") continue;

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

    // ── Deficit Pool Settlement — runs immediately after accrual on the 1st ──
    // Settle the PRIOR month (month that just ended). We're now on the 1st of the
    // new month so the priorMonth is trivially the month before getIstDateTime().
    try {
      const { getFeatureFlag: _ffDeficit } = await import("./featureFlags");
      if (await _ffDeficit("attendance_deficit_pool_enabled")) {
        const { year: nowY, month: nowM } = getIstDateTime();
        let priorYear = nowY;
        let priorMonth = nowM - 1;
        if (priorMonth === 0) { priorMonth = 12; priorYear -= 1; }
        const priorMonthStr = `${priorYear}-${String(priorMonth).padStart(2, "0")}`;
        console.log(`[scheduler] Settling attendance deficit pool for ${priorMonthStr}...`);
        const { settleMonthlyDeficitPool } = await import("./attendancePolicy");
        const results = await settleMonthlyDeficitPool(priorMonthStr);
        const settled = results.filter(r => r.settled).length;
        const forgiven = results.filter(r => r.forgiven).length;
        const lwpApplied = results.filter(r => r.lwpDays > 0).length;
        console.log(`[scheduler] Deficit pool settled for ${priorMonthStr}: ${settled} employees — ${forgiven} forgiven, ${lwpApplied} with LWP.`);
      }
    } catch (err) {
      console.error("[scheduler] Deficit pool settlement failed (non-fatal):", err);
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
    const _envMode = await getEnvMode();
    if (_envMode !== "production") {
      console.log(`[scheduler] [SUSPENDED] absent_sweep — env_mode=${_envMode}`);
      return;
    }
    const _entry = JOB_REGISTRY.get("absent_sweep");
    if (_entry) { _entry.lastTriggeredAt = new Date(); _entry.lastTriggeredBy = "scheduler"; }
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
            const { getFeatureFlag: _getFF3 } = await import("./featureFlags");
            if (await _getFF3("notifications_enabled")) {
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

  // Goal Auto-Progress Engine: runs at 7:00 AM IST daily, before the 8:30 AM absent sweep.
  // Calculates actual progress for all auto-trackable active plan goals and updates the DB.
  cron.schedule("0 7 * * *", async () => {
    const _envMode = await getEnvMode();
    if (_envMode !== "production") {
      console.log(`[scheduler] [SUSPENDED] goal_auto_progress_sync — env_mode=${_envMode}`);
      return;
    }
    const _entry = JOB_REGISTRY.get("goal_auto_progress_sync");
    if (_entry) { _entry.lastTriggeredAt = new Date(); _entry.lastTriggeredBy = "scheduler"; }
    console.log("[scheduler] Running goal auto-progress sync...");
    try {
      const { runGoalAutoProgressSync } = await import("./goalAutoProgressService");
      const result = await runGoalAutoProgressSync();
      console.log(
        `[scheduler] Goal auto-progress sync complete: ${result.suggested} suggested, ` +
        `${result.skipped} skipped, ${result.anomalyFlagged} anomaly-flagged, ` +
        `${result.escalationFlagged} escalation-flagged, ${result.errors} errors.`,
      );

      // Write a durable audit log entry for traceability.
      // actor_id requires a real admin_users FK — use the first super_admin found.
      try {
        const actorRow = await db.execute(sql`
          SELECT id FROM admin_users WHERE role = 'super_admin' AND deleted_at IS NULL LIMIT 1
        `);
        const actorId = (actorRow.rows[0] as any)?.id;
        if (actorId) {
          await db.execute(sql`
            INSERT INTO audit_logs (actor_id, action, changes)
            VALUES (${actorId}, 'goal_auto_progress_sync', ${JSON.stringify({
              suggested: result.suggested,
              skipped: result.skipped,
              anomalyFlagged: result.anomalyFlagged,
              escalationFlagged: result.escalationFlagged,
              errors: result.errors,
              triggeredBy: "scheduler",
              ranAt: new Date().toISOString(),
            })}::jsonb)
          `);
        }
      } catch (auditErr) {
        console.warn("[scheduler] Goal auto-progress audit log write failed (non-fatal):", auditErr);
      }
    } catch (error) {
      console.error("[scheduler] Goal auto-progress sync failed:", error);
    }
  }, {
    timezone: "Asia/Kolkata",
  });

  // Goodhart Guard: auto-commit stale suggested progress every 4 hours.
  // Commits suggested_progress → progress for goals pending > 96 calendar hours
  // where no manager has acted. Anomaly-flagged goals are excluded.
  cron.schedule("0 */4 * * *", async () => {
    try {
      const { runProgressAutoCommit } = await import("./goalAutoProgressService");
      const result = await runProgressAutoCommit();
      if (result.committed > 0 || result.errors > 0) {
        console.log(`[scheduler] Goal progress auto-commit: ${result.committed} committed, ${result.errors} errors.`);
      }
    } catch (err) {
      console.error("[scheduler] Goal progress auto-commit failed:", err);
    }
  }, { timezone: "Asia/Kolkata" });

  // Admin route to update shift grace period: handled in routes.ts
  // (PATCH /api/hr/admin/shifts/:id/grace-period)

  // PRIMARY: Attendance report generation on the LAST DAY of the month at 22:00 PST.
  // Cron fires daily at 22:00 America/Los_Angeles; we generate + notify only when
  // today (in LA) is the last day of the month, for the CURRENT month.
  cron.schedule("0 22 * * *", async () => {
    const _envMode = await getEnvMode();
    if (_envMode !== "production") {
      console.log(`[scheduler] [SUSPENDED] attendance_report_month_end — env_mode=${_envMode}`);
      return;
    }
    try {
      const la = getLaDateTime();
      if (!isLastDayOfMonthLa(la)) return;
      console.log(`[scheduler] Last day of month (PST) — ensuring attendance report run for ${la.month}/${la.year}...`);
      const _entry = JOB_REGISTRY.get("attendance_report_month_end");
      if (_entry) { _entry.lastTriggeredAt = new Date(); _entry.lastTriggeredBy = "scheduler"; }
      const result = await ensureRunForMonthAndNotify(la.month, la.year);
      console.log(`[scheduler] Attendance report ${result.created ? "created" : "reconciled"} for ${la.month}/${la.year}: run ${result.runId}, notified ${result.notified} manager(s)`);
    } catch (error) {
      console.error("[scheduler] Last-day attendance report generation failed:", error);
    }
  }, {
    timezone: "America/Los_Angeles",
  });

  // SAFETY NET: 1st of month at 00:05 IST. If the last-day PST job was missed, this
  // ensures the prior month's run exists and reconciles missing managers (dedupes,
  // never re-pings managers who already responded).
  cron.schedule("5 0 1 * *", async () => {
    try {
      const { year, month } = getIstDateTime();
      let prevMonth = month - 1;
      let prevYear = year;
      if (prevMonth === 0) { prevMonth = 12; prevYear = year - 1; }
      const result = await ensureRunForMonthAndNotify(prevMonth, prevYear);
      console.log(`[scheduler] IST safety-net: attendance report ${result.created ? "created" : "reconciled"} for ${prevMonth}/${prevYear}, notified ${result.notified} manager(s)`);
    } catch (error) {
      console.error("[scheduler] Attendance report safety-net failed:", error);
    }
  }, {
    timezone: "Asia/Kolkata",
  });

  // Attendance T-2h reminder: runs every hour at :04 (offset from :00 to avoid
  // colliding with studio auto-publish at :01 and deadline expiry at :02).
  cron.schedule("4 * * * *", async () => {
    try {
      const now = new Date();
      const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

      // Find runs with deadline within the next 2 hours that are not yet in terminal state
      const runs = Array.from((await db.execute(sql`
        SELECT id, month, year, deadline_at, status FROM attendance_report_runs
        WHERE status != 'approved' AND status != 'overridden' AND status != 'deadline_expired'
          AND status != 'cancelled'
          AND is_active = true
          AND notified_at IS NOT NULL
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
        const { getFeatureFlag: _getFFReminder } = await import("./featureFlags");
        const _remindNotif = await _getFFReminder("notifications_enabled");

        for (const mgr of pendingManagers) {
          sendAttendanceApprovalRequestEmail({
            to: mgr.email,
            managerName: `${mgr.first_name} ${mgr.last_name}`,
            month: monthName,
            year: run.year,
            deadlineAt: deadline,
            approvalUrl: attendanceApprovalUrl(),
            policyType: "attendance_approval_reminder",
          }).catch(console.error);

          if (_remindNotif) {
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
          AND notified_at IS NOT NULL
          AND is_active = true
          AND deadline_at < ${now.toISOString()}
          AND status != 'approved' AND status != 'overridden' AND status != 'deadline_expired'
          AND status != 'cancelled'
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
            overrideUrl: `${getPortalBaseUrl()}/admin/hr/reports?tab=attendance-approvals`,
          }).catch(console.error);
        }

        console.log(`[scheduler] Attendance deadline expired for ${run.month}/${run.year} — HR notified`);
      }
    } catch (error) {
      console.error("[scheduler] Deadline expiry processor failed:", error);
    }
  };

  // Offset by 2 minutes so this never fires at :00 alongside the T-2h reminder
  // or the studio auto-publish job — prevents simultaneous DB pool exhaustion.
  cron.schedule("2,17,32,47 * * * *", processExpiredDeadlines);

  // Belt-and-suspenders: also check on the 1st at 08:00 IST (kept for timezone correctness)
  cron.schedule("0 8 1 * *", processExpiredDeadlines, { timezone: "Asia/Kolkata" });

  // ─── Studio T1: content-idea deadline reminders (Task #906) ────────────────
  // Daily 09:00 IST: ideas due TOMORROW → in-app notification to the assignee
  // via the studio notification stub (T3 promotes to the preference gateway).
  cron.schedule("0 9 * * *", async () => {
    try {
      const { year, month, day } = getIstDateTime();
      const today = new Date(Date.UTC(year, month - 1, day));
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
      const dateStr = tomorrow.toISOString().slice(0, 10);
      const dueIdeas = await storage.getStudioIdeasDueOn(dateStr);
      const notifiable = dueIdeas.filter((i) => i.assignedToUserId);
      if (!notifiable.length) return;
      console.log(`[scheduler] Studio: ${notifiable.length} content idea(s) due ${dateStr} — notifying assignees...`);
      for (const idea of notifiable) {
        await notifyStudioUser({
          userId: idea.assignedToUserId!,
          event: "idea_due_soon",
          message: `"${idea.topic}" is due tomorrow (${dateStr}).`,
          linkPath: `/calendar?idea=${idea.id}`,
          metadata: { ideaId: idea.id, dueDate: dateStr },
        });
      }
    } catch (err) {
      console.error("[scheduler] Studio idea deadline reminder error:", err);
    }
  }, {
    timezone: "Asia/Kolkata",
  });

  // ─── Studio T2: overdue campaign content digest (Task #907) ────────────────
  // Daily 09:00 IST: unfinished campaign-linked ideas past their due date →
  // one digest per campaign to its contributors + owner. Copy-only alert; no
  // status is changed automatically.
  cron.schedule("0 9 * * *", async () => {
    try {
      const { year, month, day } = getIstDateTime();
      const todayIso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const overdue = await storage.getOverdueCampaignIdeas(todayIso);
      if (!overdue.length) return;
      const byCampaign = new Map<string, typeof overdue>();
      for (const idea of overdue) {
        const list = byCampaign.get(idea.campaignId!) ?? [];
        list.push(idea);
        byCampaign.set(idea.campaignId!, list);
      }
      console.log(`[scheduler] Studio T2: overdue campaign items in ${byCampaign.size} campaign(s).`);
      for (const [campaignId, ideas] of Array.from(byCampaign.entries())) {
        const campaign = await storage.getStudioCampaign(campaignId);
        if (!campaign || campaign.status === "completed" || campaign.status === "paused") continue;

        // 1) Flag each overdue piece to its assignee (one digest per assignee
        //    per campaign — unassigned pieces surface via the creator summary).
        const byAssignee = new Map<string, typeof ideas>();
        for (const idea of ideas) {
          if (!idea.assignedToUserId) continue;
          const list = byAssignee.get(idea.assignedToUserId) ?? [];
          list.push(idea);
          byAssignee.set(idea.assignedToUserId, list);
        }
        for (const [assigneeId, mine] of Array.from(byAssignee.entries())) {
          const preview = mine.slice(0, 3).map((i) => `"${i.topic}"`).join(", ");
          await notifyStudioUser({
            userId: assigneeId,
            event: "campaign_overdue",
            message: `${mine.length} of your item(s) in campaign "${campaign.name}" are past due: ${preview}${mine.length > 3 ? "..." : ""}`,
            linkPath: `/campaigns/${campaign.id}`,
            metadata: { campaignId: campaign.id, overdueCount: mine.length },
          });
        }

        // 2) Summary to the campaign creator — only when the campaign has
        //    accumulated >= 3 overdue pieces (product rule; avoids noise).
        if (ideas.length >= 3 && campaign.createdByUserId) {
          const preview = ideas.slice(0, 3).map((i) => `"${i.topic}"`).join(", ");
          await notifyStudioUser({
            userId: campaign.createdByUserId,
            event: "campaign_overdue",
            message: `${ideas.length} item(s) in campaign "${campaign.name}" are past due: ${preview}${ideas.length > 3 ? "..." : ""}`,
            linkPath: `/campaigns/${campaign.id}`,
            metadata: { campaignId: campaign.id, overdueCount: ideas.length },
          });
        }
      }
    } catch (err) {
      console.error("[scheduler] Studio T2 campaign overdue digest error:", err);
    }
  }, {
    timezone: "Asia/Kolkata",
  });

  // ─── Studio T3: weekly Monday digest (Task #908) ───────────────────────────
  // Monday 08:00 IST for content/marketing/admin users: pending approvals,
  // overdue ideas, this week's deadlines. Per-user opt-out via the central
  // gateway (preference key "studio_digest", COALESCE default on). NEVER sent
  // when the user's digest would be empty.
  cron.schedule("0 8 * * 1", async () => {
    try {
      const { getChannelPreferences, notifyUser: gatewayNotify } = await import("./notifications");
      const { year, month, day } = getIstDateTime();
      const todayIso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const weekEnd = new Date(Date.UTC(year, month - 1, day) + 7 * 24 * 60 * 60 * 1000)
        .toISOString().slice(0, 10);

      const OPEN_STATUSES = new Set(["idea", "in_review", "changes_requested", "approved", "in_production", "scheduled"]);
      const allIdeas = await storage.getStudioContentIdeas({});
      const openIdeas = allIdeas.filter((i) => OPEN_STATUSES.has(i.status));
      const pendingReview = openIdeas.filter((i) => i.status === "in_review");
      const overdue = openIdeas.filter((i) => i.scheduledDate && i.scheduledDate < todayIso);
      const dueThisWeek = openIdeas.filter(
        (i) => i.scheduledDate && i.scheduledDate >= todayIso && i.scheduledDate <= weekEnd,
      );
      if (!pendingReview.length && !overdue.length && !dueThisWeek.length) return;

      const { resolveRoles } = await import("@shared/accessControl");
      const reviewerRoles = resolveRoles("studio.review_article", ["super_admin", "admin", "marketing_manager", "reviewer"]);
      const viewRoles = resolveRoles("studio.view", ["super_admin", "marketing_manager", "content_editor", "reviewer"]);
      const users = await storage.getAdminUsers();
      const eligible = users.filter(
        (u: any) => u.isActive !== false && !u.deletedAt &&
          (viewRoles.includes(u.role) || !!u.studioAddOn),
      );

      let sent = 0;
      for (const user of eligible) {
        const isReviewer = reviewerRoles.includes((user as any).role);
        const myOverdue = overdue.filter((i) => i.assignedToUserId === user.id);
        const myDueThisWeek = dueThisWeek.filter((i) => i.assignedToUserId === user.id);
        const myPendingReview = isReviewer ? pendingReview : [];
        if (!myOverdue.length && !myDueThisWeek.length && !myPendingReview.length) continue;

        const prefs = await getChannelPreferences(user.id, "studio_weekly_digest");
        if (!prefs.inAppEnabled && !prefs.emailEnabled) continue;

        const parts: string[] = [];
        if (myPendingReview.length) parts.push(`${myPendingReview.length} idea(s) awaiting review`);
        if (myOverdue.length) parts.push(`${myOverdue.length} of your item(s) overdue`);
        if (myDueThisWeek.length) parts.push(`${myDueThisWeek.length} of your item(s) due this week`);
        const summary = parts.join(" · ");

        const lines: string[] = [];
        if (myPendingReview.length) {
          lines.push(`<h3>Awaiting review (${myPendingReview.length})</h3><ul>${myPendingReview.slice(0, 5).map((i) => `<li>${i.topic}</li>`).join("")}${myPendingReview.length > 5 ? "<li>…and more</li>" : ""}</ul>`);
        }
        if (myOverdue.length) {
          lines.push(`<h3>Overdue (${myOverdue.length})</h3><ul>${myOverdue.slice(0, 5).map((i) => `<li>${i.topic} — was due ${i.scheduledDate}</li>`).join("")}${myOverdue.length > 5 ? "<li>…and more</li>" : ""}</ul>`);
        }
        if (myDueThisWeek.length) {
          lines.push(`<h3>Due this week (${myDueThisWeek.length})</h3><ul>${myDueThisWeek.slice(0, 5).map((i) => `<li>${i.topic} — due ${i.scheduledDate}</li>`).join("")}${myDueThisWeek.length > 5 ? "<li>…and more</li>" : ""}</ul>`);
        }
        const studioLink = `${getPortalBaseUrl()}/studio/calendar`;

        await gatewayNotify({
          userId: user.id,
          type: "studio_weekly_digest",
          title: "Your weekly Studio digest",
          message: summary,
          metadata: { link: "/studio/calendar", url: studioLink },
          email: {
            subject: `Studio weekly digest — ${summary}`,
            html: `<p>Good morning! Here's your Content Studio week ahead:</p>${lines.join("")}<p><a href="${studioLink}">Open the content calendar →</a></p>`,
            configType: "studio_weekly_digest",
            sourceJob: "studio_weekly_digest_cron",
          },
        });
        sent++;
      }
      if (sent) console.log(`[scheduler] Studio T3 weekly digest sent to ${sent} user(s).`);
    } catch (err) {
      console.error("[scheduler] Studio T3 weekly digest error:", err);
    }
  }, {
    timezone: "Asia/Kolkata",
  });

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
      const reviewUrl = `${getPortalBaseUrl()}/admin/hr/regularizations`;

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
      const { getFeatureFlag: _getFF4 } = await import("./featureFlags");
      if (!(await _getFF4("notifications_enabled"))) return;

      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split("T")[0];
      const todayStr = now.toISOString().split("T")[0];

      // Day-before contextual reminders: employee gets data-rich summary; manager gets same + coaching note CTA.
      // Query now includes names and milestone_day for the contextual builder.
      const dayBeforeRows = (await db.execute(sql`
        SELECT ci.id, ci.employee_id, ci.manager_id, ci.plan_id, ci.check_in_type, ci.scheduled_date,
               ci.milestone_day,
               ep.plan_type,
               emp.first_name || ' ' || emp.last_name AS employee_name,
               COALESCE(mgr.first_name || ' ' || mgr.last_name, 'Your Manager') AS manager_name
        FROM check_ins ci
        JOIN employee_plans ep ON ci.plan_id = ep.id
        JOIN admin_users emp ON emp.id = ci.employee_id
        LEFT JOIN admin_users mgr ON mgr.id = ci.manager_id
        WHERE ci.scheduled_date = ${tomorrowStr}
          AND ci.status = 'scheduled'
          AND ci.plan_id IS NOT NULL
          AND ep.status = 'active'
          AND ci.notified_at IS NULL
      `)).rows as any[];

      for (const ci of dayBeforeRows) {
        try {
          // Employee contextual reminder — routes through notifyUser so SendGrid email is sent
          const empPayload = await buildCheckinReminderPayload(ci, ci.employee_name, ci.manager_name, false);
          await notifyUser({
            userId: ci.employee_id,
            type: "checkin_reminder_contextual",
            title: empPayload.inAppTitle,
            message: empPayload.inAppMessage,
            metadata: empPayload.metadata ?? {},
            email: {
              subject: empPayload.emailSubject,
              html: empPayload.emailHtml,
              configType: "checkin_reminder_contextual",
              sourceJob: "scheduler_plan_reminder",
            },
          });
          // Manager contextual reminder (same data-rich summary + coaching note CTA)
          if (ci.manager_id) {
            const mgrPayload = await buildCheckinReminderPayload(ci, ci.employee_name, ci.manager_name, true);
            await notifyUser({
              userId: ci.manager_id,
              type: "checkin_reminder_contextual",
              title: mgrPayload.inAppTitle,
              message: mgrPayload.inAppMessage,
              metadata: mgrPayload.metadata ?? {},
              email: {
                subject: mgrPayload.emailSubject,
                html: mgrPayload.emailHtml,
                configType: "checkin_reminder_contextual",
                sourceJob: "scheduler_plan_reminder",
              },
            });
            await db.execute(sql`UPDATE check_ins SET manager_notified_at = NOW() WHERE id = ${ci.id} AND manager_notified_at IS NULL`);
          }
          // Only mark as notified after all notifyUser calls succeed
          await db.execute(sql`UPDATE check_ins SET notified_at = NOW() WHERE id = ${ci.id}`);
        } catch (builderErr) {
          console.error(`[scheduler] contextual reminder build/dispatch failed for check-in ${ci.id}:`, builderErr);
          // notified_at intentionally NOT set — will retry on next scheduler run
        }
      }

      console.log(`[scheduler] Contextual plan check-in reminders sent: ${dayBeforeRows.length} check-ins`);
    } catch (err) {
      console.error("[scheduler] Plan check-in reminder job failed:", err);
    }
  }, { timezone: "Asia/Kolkata" });

  // ─── NOTE: Daily compliance sweep (09:00 IST) and probation escalation sweep
  // (08:30 IST) have been consolidated into the governance sync cron at 07:00 IST
  // below. See governanceService.runGovernanceSyncSweep() for the full sequence.

  // Content Studio: every 5 minutes, flip scheduled articles whose time has
  // arrived to published.
  // Offset by 1 minute from the top of each 5-min block so this never fires
  // at the same instant as the deadline expiry (*/15) or T-2h reminder (0 * * * *)
  // which all used to collide at :00 and exhaust the DB pool simultaneously.
  cron.schedule("1,6,11,16,21,26,31,36,41,46,51,56 * * * *", async () => {
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
          const acceptUrl = `${getPortalBaseUrl()}/onboard/${letter.token}`;
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
          const acceptUrl = `${getPortalBaseUrl()}/addendum/${addendum.token}`;
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

      // --- Orphaned pending-plan cleanup ---
      // A pending plan is seeded at offer acceptance with NULL employee_id and
      // activated (employee_id backfilled) at onboarding. If the offer was
      // cancelled, deleted, or the candidate never joined, the pending row lingers
      // forever. Delete those — pending plans have no check-ins/goals yet (those
      // are seeded only at activation), so deletion is clean and has no dependents.
      const sixtyDaysAgoStr = new Date(now.getTime() - 60 * 86400000).toISOString().slice(0, 10);
      const orphans = await db.execute(sql`
        DELETE FROM employee_plans ep
        WHERE ep.status = 'pending'
          AND ep.employee_id IS NULL
          AND (
            ep.offer_letter_id IS NULL
            OR NOT EXISTS (SELECT 1 FROM offer_letters ol WHERE ol.id = ep.offer_letter_id)
            OR EXISTS (SELECT 1 FROM offer_letters ol WHERE ol.id = ep.offer_letter_id AND ol.status = 'cancelled')
            OR (ep.start_date ~ '^\\d{4}-\\d{2}-\\d{2}$' AND ep.start_date::date < ${sixtyDaysAgoStr}::date)
          )
        RETURNING ep.id
      `);
      if (orphans.rows.length > 0) {
        console.log(`[scheduler] Orphaned pending-plan cleanup: ${orphans.rows.length} stale pending plan(s) deleted.`);
      }
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
      const { getFeatureFlag: _getFF4 } = await import("./featureFlags");
      if (!(await _getFF4("notifications_enabled"))) return;

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

  // ─── Future-dated salary change promotion (Task #686) ───────────────────────
  // Daily at 00:30 IST: promote any future-dated salary changes whose effective
  // date has now arrived to admin_users.salary. The salary report already reads
  // the ledger by effective date, so this only keeps the live current-salary
  // field in sync. Idempotent — only touches entries with appliedAt IS NULL.
  cron.schedule("30 0 * * *", async () => {
    try {
      const { applyDueSalaryChanges } = await import("./salaryLedger");
      const { promoted } = await applyDueSalaryChanges();
      if (promoted > 0) console.log(`[scheduler] Salary change promotion: ${promoted} due change(s) applied to live salary.`);
    } catch (err) {
      console.error("[scheduler] Salary change promotion failed:", err);
    }
  }, { timezone: "Asia/Kolkata" });

  // ─── Unified governance sync sweep — daily at 07:00 IST ─────────────────────
  // Single entry point for all governance escalation logic:
  //   1. Probation cadence backfill (idempotent check-in insertion)
  //   2. syncGovernanceObligations() — create/refresh governance_controls
  //   3. collectOverdueItems() — detect overdue goals, SOPs, check-ins
  //   4. collectProbationMilestoneEvents() — detect overdue plan check-ins
  //   5. applyEscalation() per finding — central state machine, deduped by
  //      governance_events (20-hour guard)
  //   6. runDailySweep() — HR check-in overdue digest
  // Previously split across 07:00 (governance), 08:30 (probation), and 09:00
  // (compliance sweep) crons — now consolidated to prevent triple-notification.
  cron.schedule("0 7 * * *", async () => {
    const _envMode = await getEnvMode();
    if (_envMode !== "production") {
      console.log(`[scheduler] [SUSPENDED] governance_sync_sweep — env_mode=${_envMode}`);
      return;
    }
    const _entry = JOB_REGISTRY.get("governance_sync_sweep");
    if (_entry) { _entry.lastTriggeredAt = new Date(); _entry.lastTriggeredBy = "scheduler"; }
    console.log("[scheduler] Running unified governance sync sweep...");
    try {
      const { runGovernanceSyncSweep } = await import("./governanceService");
      const result = await runGovernanceSyncSweep();
      console.log(
        `[scheduler] Governance sync sweep complete: ` +
        `findings=${result.findingsCollected}, ` +
        `applied=${result.escalationsApplied}, ` +
        `skipped=${result.escalationsSkipped}, ` +
        `notifications=${result.notificationsSent}`
      );
    } catch (err) {
      console.error("[scheduler] Unified governance sync sweep failed:", err);
    }
  }, { timezone: "Asia/Kolkata" });

  // ─── CEO weekly exception report — Monday 08:00 IST ─────────────────────────
  // Queries all overdue/escalated governance controls, anonymises data through
  // aiPrivacyGuard, uses AI to draft a narrative summary, and emails the CEO.
  // Raw structured data is also stored in docs/ for audit.
  cron.schedule("0 8 * * 1", async () => {
    console.log("[scheduler] Generating weekly CEO governance exception report...");
    try {
      const { buildCeoReportData } = await import("./governanceService");
      const reportData = await buildCeoReportData();

      if (reportData.totalOpen === 0) {
        console.log("[scheduler] CEO report: no open governance controls — skipping.");
        return;
      }

      // Find CEO / super_admins to send to
      const { adminUsers } = await import("@shared/schema");
      const { eq, isNull, or } = await import("drizzle-orm");
      const recipients = await db
        .select({ id: adminUsers.id, email: adminUsers.email })
        .from(adminUsers)
        .where(
          and(
            eq(adminUsers.isActive, true),
            isNull(adminUsers.deletedAt),
            or(eq(adminUsers.role, "super_admin"), eq(adminUsers.role, "executive")),
          ),
        );

      if (recipients.length === 0) {
        console.log("[scheduler] CEO report: no super_admin/executive recipients found.");
        return;
      }

      // Build allowlisted AI payload — explicit field picking, not redaction of a full object.
      // Only approved non-identifying operational values are included.
      const { auditPromptForPII, buildAllowlistedCeoPayload } = await import("./services/aiPrivacyGuard");
      const allowlistedPayload = buildAllowlistedCeoPayload({
        generatedAt: new Date().toISOString().slice(0, 10),
        totalOpen: reportData.totalOpen,
        totalOverdue: reportData.totalOverdue,
        totalEscalated: reportData.totalEscalated,
        totalDisputed: reportData.totalDisputed,
        byType: reportData.byType,
        exceptionCategories: reportData.exceptionCategories,
        highPriority: reportData.highPriority,
        semanticSummary: reportData.semanticSummary,
      });

      const promptText = JSON.stringify(allowlistedPayload, null, 2);
      const piiCheck = auditPromptForPII(promptText);
      if (piiCheck.length > 0) {
        console.error(`[scheduler] CEO report: PII detected in allowlisted payload (${piiCheck.join(", ")}) — aborting AI call`);
        return;
      }

      // Deterministic fallback narrative (no AI dependency)
      const deterministicNarrative = [
        `Total open obligations: ${reportData.totalOpen}`,
        `Overdue: ${reportData.totalOverdue} | Escalated: ${reportData.totalEscalated} | Disputed: ${reportData.totalDisputed}`,
        `Confirmed non-compliance (overdue/escalated minus disputed): ${reportData.semanticSummary.confirmedNonCompliance}`,
        `Employees with multiple overdue obligations: ${reportData.semanticSummary.employeesWithMultipleOverdueObligations}`,
        `Employees with explicit blockers (disputes): ${reportData.semanticSummary.employeesWithExplicitBlockers}`,
        `Approved exceptions: ${reportData.semanticSummary.approvedExceptions}`,
      ].join("\n");

      // AI narrative (allowlisted anonymized data only)
      let narrative = deterministicNarrative;
      try {
        const OpenAI = (await import("openai")).default;
        const openai = new OpenAI({
          apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
          baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
        });
        const completion = await openai.chat.completions.create({
          model: "gpt-5.4",
          max_completion_tokens: 1024,
          messages: [
            {
              role: "system",
              content: [
                "You are a governance analyst producing a weekly exception summary for the CEO.",
                "Summarize in 3-5 concise bullet points. Focus on escalated items and patterns.",
                "Use only the anonymized operational data provided.",
                "CRITICAL: Never mention specific names, email addresses, or personal details.",
                "CRITICAL: Disputed controls are NOT confirmed noncompliance — clearly distinguish them.",
                "CRITICAL: Employees with explicit blockers (dispute_note set) are raising concerns, not confirmed violators.",
                "CRITICAL: 'Multiple overdue obligations' means a pattern of non-completion, separate from employees who have raised disputes.",
              ].join(" "),
            },
            {
              role: "user",
              content: `Here is this week's governance control summary (all data is anonymized and allowlisted):\n\n${promptText}\n\nProvide a concise executive summary distinguishing confirmed noncompliance from disputed controls.`,
            },
          ],
        });
        narrative = completion.choices[0]?.message?.content ?? deterministicNarrative;
      } catch (aiErr) {
        console.error("[scheduler] CEO report AI draft failed — using deterministic fallback:", aiErr);
        // narrative already set to deterministicNarrative above
      }

      // Save report to audit store
      try {
        const fs = await import("fs");
        const path = await import("path");
        const docsDir = path.join(process.cwd(), "docs", "governance-reports");
        fs.mkdirSync(docsDir, { recursive: true });
        const filename = path.join(docsDir, `ceo-report-${new Date().toISOString().slice(0, 10)}.json`);
        fs.writeFileSync(filename, JSON.stringify({ narrative, data: anonymizedSummary }, null, 2));
      } catch (fsErr) {
        console.error("[scheduler] CEO report save to docs failed (non-fatal):", fsErr);
      }

      // Send email to recipients — route through blast queue when >= threshold
      const weekOf = new Date().toISOString().slice(0, 10);
      const emailSubject = `Weekly Governance Exception Report — ${weekOf}`;
      const htmlBody = `
        <h2>Weekly Governance Exception Report — ${weekOf}</h2>
        <h3>Summary</h3>
        <pre style="background:#f4f4f4;padding:12px;border-radius:4px;">${narrative}</pre>
        <h3>Metrics</h3>
        <ul>
          <li>Total open obligations: <strong>${reportData.totalOpen}</strong></li>
          <li>Overdue: <strong>${reportData.totalOverdue}</strong></li>
          <li>Escalated: <strong>${reportData.totalEscalated}</strong></li>
        </ul>
        <h3>By Type</h3>
        <table border="1" cellpadding="6" style="border-collapse:collapse;">
          <tr><th>Type</th><th>Open</th><th>Overdue</th><th>Escalated</th></tr>
          ${Object.entries(reportData.byType).map(([t, s]) =>
            `<tr><td>${t}</td><td>${s.open}</td><td>${s.overdue}</td><td>${s.escalated}</td></tr>`
          ).join("")}
        </table>
        <p style="color:#888;font-size:12px;">This report is generated from anonymized data. No personal information has been included.</p>
      `;

      const blastRecipients = recipients
        .filter(r => !!r.email)
        .map(r => ({ userId: r.id, name: r.id, email: r.email! }));

      const { queueBlast } = await import("./blastQueue");
      const blastResult = await queueBlast({
        triggerSource: "governance_ceo_report_weekly",
        subject: emailSubject,
        bodyHtml: htmlBody,
        recipients: blastRecipients,
      });

      if (blastResult.queued) {
        console.log(`[scheduler] CEO governance report queued as blast ${blastResult.blastId} (${blastResult.recipientCount} recipients pending review).`);
      } else {
        // Below threshold — send directly
        const { dispatchAutomatedEmail } = await import("./email");
        for (const r of blastRecipients) {
          await dispatchAutomatedEmail("governance_ceo_report", "governance_scheduler", {
            to: r.email,
            subject: emailSubject,
            html: htmlBody,
          }).catch(err => console.error(`[scheduler] CEO report email to ${r.email} failed:`, err));
        }
        console.log(`[scheduler] CEO governance report sent directly to ${blastRecipients.length} recipient(s) (below blast threshold).`);
      }
    } catch (err) {
      console.error("[scheduler] CEO governance exception report failed:", err);
    }
  }, { timezone: "Asia/Kolkata" });

  // ── Recruiter daily activity nudge — 5:30 PM IST (12:00 UTC) ────────────────
  // Sends an in-app notification to active recruiter/operations users who have NOT
  // logged any activity today (calls or screens both = 0 or no row for today).
  cron.schedule("0 12 * * 1-5", async () => {
    try {
      const today = (() => {
        const istOffsetMs = (5 * 60 + 30) * 60 * 1000;
        return new Date(Date.now() + istOffsetMs).toISOString().split("T")[0];
      })();

      // Find active recruiter/operations users
      const recruiterRoles = ["operations", "recruiter", "manager"];
      const activeUsers = await db
        .select({ id: adminUsers.id, email: adminUsers.email, firstName: adminUsers.firstName, role: adminUsers.role })
        .from(adminUsers)
        .where(and(isNull(adminUsers.deletedAt), eq(adminUsers.isActive, true)));

      const recruiters = activeUsers.filter((u) => recruiterRoles.includes(u.role || ""));

      if (recruiters.length === 0) return;

      // Find those who already logged today
      const { recruiterActivityLogs } = await import("@shared/schema");
      const { inArray } = await import("drizzle-orm");
      const logged = await db
        .select({ recruiterId: recruiterActivityLogs.recruiterId })
        .from(recruiterActivityLogs)
        .where(
          and(
            inArray(recruiterActivityLogs.recruiterId, recruiters.map((r) => r.id)),
            sql`${recruiterActivityLogs.logDate} = ${today}::date`,
          ),
        );

      const loggedIds = new Set(logged.map((l) => l.recruiterId));
      const needsNudge = recruiters.filter((r) => !loggedIds.has(r.id));

      if (needsNudge.length === 0) return;

      const { notifyUser } = await import("./notifications");
      let sent = 0;
      for (const user of needsNudge) {
        try {
          await notifyUser({
            userId: user.id,
            type: "recruiter_activity_daily_nudge",
            title: "Don't forget to log today's activity",
            message: "You haven't logged your calls and screens yet today. Tap to update your daily activity.",
            link: "/admin/my-desk?tab=pipeline",
          });
          sent++;
        } catch (_) {}
      }
      console.log(`[scheduler] Recruiter activity nudge sent to ${sent}/${needsNudge.length} recruiter(s).`);
    } catch (err) {
      console.error("[scheduler] Recruiter activity nudge failed:", err);
    }
  }, { timezone: "UTC" });

  // ── Ceipal Update Compliance Crons ──────────────────────────────────────────
  // Morning reminder: 8:30 AM IST (= 3:00 UTC) — notifies recruiters with unresolved yesterday commitments
  cron.schedule("0 3 * * *", async () => {
    console.log("[scheduler] Ceipal morning reminder sweep — running");
    try {
      const { sendCeipalMorningReminders } = await import("./ceipalCompliance");
      await sendCeipalMorningReminders();
    } catch (err) {
      console.error("[scheduler] Ceipal morning reminder sweep failed:", err);
    }
  }, { timezone: "UTC" });

  // Daily escalation sweep: 7:30 PM IST (= 14:00 UTC) — after typical end of business day
  // Checks for 2+ consecutive misses → manager notification
  cron.schedule("0 14 * * 1-5", async () => {
    console.log("[scheduler] Ceipal escalation sweep — running");
    try {
      const { checkCeipalUpdateCompliance } = await import("./ceipalCompliance");
      await checkCeipalUpdateCompliance();
    } catch (err) {
      console.error("[scheduler] Ceipal escalation sweep failed:", err);
    }
  }, { timezone: "UTC" });

  // ─── Blast queue housekeeping — hourly ───────────────────────────────────────
  // 1. Auto-expires blasts pending > 72 hours (sets status=cancelled, reason=expired).
  // 2. Sends a transactional alert to super_admins for blasts pending > N hours (once).
  cron.schedule("5 * * * *", async () => {
    try {
      const { runBlastHousekeeping } = await import("./blastQueue");
      await runBlastHousekeeping();
    } catch (err) {
      console.error("[scheduler] Blast queue housekeeping failed:", err);
    }
  });

  // ─── Policy overdue manager digest — daily 09:00 IST ────────────────────────
  // For each manager with direct reports who have a pending policy_signing_request
  // with due_date more than 2 days in the past, sends one consolidated digest email.

  async function handlePolicyOverdueManagerDigest() {
    console.log("[scheduler] Running policy overdue manager digest...");
    try {
      const { dispatchAutomatedEmail } = await import("./email");
      const portalUrl = getPortalBaseUrl();

      // Fetch all overdue pending requests with employee + manager info
      const overdueRows = await db.execute(sql`
        SELECT
          psr.id AS request_id,
          psr.employee_id,
          psr.due_date,
          au.first_name AS emp_first,
          au.last_name  AS emp_last,
          au.email      AS emp_email,
          au.employee_id AS emp_id,
          au.manager_id,
          mgr.first_name AS mgr_first,
          mgr.last_name  AS mgr_last,
          mgr.email      AS mgr_email,
          pd.title       AS policy_title
        FROM policy_signing_requests psr
        JOIN admin_users au  ON au.id  = psr.employee_id
        JOIN admin_users mgr ON mgr.id = au.manager_id
        JOIN policy_documents pd ON pd.id = psr.policy_id
        WHERE psr.status = 'pending'
          AND psr.due_date < NOW() - INTERVAL '2 days'
          AND au.manager_id IS NOT NULL
          AND mgr.email IS NOT NULL
          AND mgr.is_active = true
          AND mgr.deleted_at IS NULL
      `);

      if (!overdueRows.rows.length) {
        console.log("[scheduler] Policy overdue manager digest: no overdue requests found.");
        return;
      }

      // Group by manager
      const byManager = new Map<string, { mgr: any; employees: any[] }>();
      for (const row of overdueRows.rows as any[]) {
        if (!byManager.has(row.manager_id)) {
          byManager.set(row.manager_id, { mgr: row, employees: [] });
        }
        byManager.get(row.manager_id)!.employees.push(row);
      }

      let sent = 0;
      for (const { mgr, employees } of byManager.values()) {
        const listItems = employees.map(e => {
          const dueStr = new Date(e.due_date).toLocaleDateString("en-IN", { dateStyle: "long" });
          return `<li style="margin-bottom:6px;"><strong>${e.emp_first} ${e.emp_last}</strong> (${e.emp_id || e.emp_email}) — <em>${e.policy_title}</em> — due ${dueStr}</li>`;
        }).join("");

        const bodyHtml = `
          <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
            <div style="background:linear-gradient(135deg,#1F3A6E 0%,#2c5282 100%);padding:28px 32px;text-align:center;">
              <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700;">Hire&rsquo;in Solutions</h1>
              <p style="color:#bfdbfe;margin:6px 0 0;font-size:13px;">Policy Compliance — Manager Digest</p>
            </div>
            <div style="padding:32px;">
              <p style="color:#1e293b;margin:0 0 16px;">Hi ${mgr.mgr_first},</p>
              <p style="color:#475569;margin:0 0 16px;line-height:1.6;">
                The following direct report(s) have not yet signed their assigned policy and their deadline has passed by more than 2 days. Please follow up with them to ensure compliance.
              </p>
              <ul style="color:#1e293b;padding-left:20px;margin:0 0 24px;">
                ${listItems}
              </ul>
              <div style="text-align:center;margin:24px 0;">
                <a href="${portalUrl}/admin/hr/people?tab=policy"
                   style="display:inline-block;background:#F47C20;color:#fff;text-decoration:none;padding:12px 32px;border-radius:6px;font-weight:600;font-size:14px;">
                  View Policy Compliance
                </a>
              </div>
              <p style="color:#94a3b8;font-size:12px;margin:0;">This is an automated daily digest. You will continue to receive this email each day until the outstanding policy requests are signed.</p>
            </div>
          </div>`;

        const bodyText = `Hi ${mgr.mgr_first},\n\nThe following direct reports have overdue policy signing requests (more than 2 days past due):\n\n${employees.map(e => `- ${e.emp_first} ${e.emp_last} (${e.emp_id || e.emp_email}): ${e.policy_title} — due ${new Date(e.due_date).toLocaleDateString()}`).join("\n")}\n\nPlease follow up to ensure compliance.\n\nView Policy Compliance: ${portalUrl}/admin/hr/people?tab=policy`;

        await dispatchAutomatedEmail(
          "policy_overdue_manager_digest",
          "policy_overdue_manager_digest",
          {
            to: mgr.mgr_email,
            subject: `Action Required: ${employees.length} direct report${employees.length === 1 ? "" : "s"} with overdue policy sign-off`,
            html: bodyHtml,
            text: bodyText,
          },
        );
        sent++;
      }

      console.log(`[scheduler] Policy overdue manager digest: sent ${sent} email(s) covering ${overdueRows.rows.length} overdue request(s).`);
    } catch (err) {
      console.error("[scheduler] Policy overdue manager digest failed:", err);
    }
  }

  JOB_REGISTRY.set("policy_overdue_manager_digest", {
    name: "policy_overdue_manager_digest",
    label: "Policy Overdue Manager Digest",
    schedule: "Daily 9 AM IST",
    handler: handlePolicyOverdueManagerDigest,
  });

  cron.schedule("0 9 * * *", async () => {
    const _entry = JOB_REGISTRY.get("policy_overdue_manager_digest");
    if (_entry) { _entry.lastTriggeredAt = new Date(); _entry.lastTriggeredBy = "scheduler"; }
    await handlePolicyOverdueManagerDigest();
  }, { timezone: "Asia/Kolkata" });

  // ─── SOP wave scheduled launch activation — daily 07:00 IST ─────────────────
  // Picks up `approved` wave_scheduled_launches rows where go_live_date <= today,
  // calls activateWave for each, and marks the row `active`.
  JOB_REGISTRY.set("sop_scheduled_wave_launches", {
    name: "sop_scheduled_wave_launches",
    label: "SOP Scheduled Wave Launches",
    schedule: "Daily 07:00 IST",
    handler: async () => {
      const { fireScheduledWaveLaunches } = await import("./sopRollout");
      const result = await fireScheduledWaveLaunches();
      console.log(`[scheduler] SOP scheduled wave launches: fired=${result.fired}, errors=${result.errors}`);
    },
  });

  cron.schedule("0 7 * * *", async () => {
    const _entry = JOB_REGISTRY.get("sop_scheduled_wave_launches");
    if (_entry) { _entry.lastTriggeredAt = new Date(); _entry.lastTriggeredBy = "scheduler"; }
    console.log("[scheduler] Running SOP scheduled wave launch activation…");
    try {
      const { fireScheduledWaveLaunches } = await import("./sopRollout");
      const result = await fireScheduledWaveLaunches();
      console.log(`[scheduler] SOP scheduled wave launches complete: fired=${result.fired}, errors=${result.errors}`);
    } catch (err) {
      console.error("[scheduler] SOP scheduled wave launch activation failed:", err);
    }
  }, { timezone: "Asia/Kolkata" });

  // ── Dev inbox weekly purge — Sundays at 02:00 IST ────────────────────────
  // Removes dev_email_inbox rows older than 7 days. Only runs in non-production.
  JOB_REGISTRY.set("dev_inbox_purge", {
    name: "dev_inbox_purge",
    label: "Dev Inbox Weekly Purge",
    schedule: "Sundays 02:00 IST (non-production only)",
    handler: async () => {
      const envMode = await getEnvMode();
      if (envMode === "production") {
        console.log("[scheduler] dev_inbox_purge skipped — production env");
        return;
      }
      const count = await storage.purgeDevInboxOlderThan(7);
      console.log(`[scheduler] Dev inbox purge complete: ${count} row(s) older than 7 days removed.`);
      await storage.upsertSystemSetting("dev_inbox_last_purge", new Date().toISOString()).catch(() => {});
    },
  });

  cron.schedule("0 2 * * 0", async () => {
    const _entry = JOB_REGISTRY.get("dev_inbox_purge");
    if (_entry) { _entry.lastTriggeredAt = new Date(); _entry.lastTriggeredBy = "scheduler"; }
    const envMode = await getEnvMode().catch(() => "dev");
    if (envMode === "production") return;
    try {
      const count = await storage.purgeDevInboxOlderThan(7);
      console.log(`[scheduler] Dev inbox weekly purge: ${count} row(s) removed.`);
      await storage.upsertSystemSetting("dev_inbox_last_purge", new Date().toISOString()).catch(() => {});
    } catch (err) {
      console.error("[scheduler] Dev inbox purge failed:", err);
    }
  }, { timezone: "Asia/Kolkata" });

  console.log("[scheduler] All cron jobs scheduled:");
  console.log("  - Salary report hold: last day of month at 6 PM CST → saves as pending_approval");
  console.log("  - Salary report reminder: 1st of month at 8 PM CST → emails super admins if still pending");
  console.log("  - Monthly leave accrual: 1st of month at 00:00 IST (Jan: year-end for prior year runs first, then accrual)");
  console.log("  - Attendance report generation: last day of month at 22:00 PST → generates run + notifies managers (safety net 1st of month 00:05 IST)");
  console.log("  - Attendance deadline expiry: at :02/:17/:32/:47 each hour (primary) + 1st of month 08:00 IST (belt-and-suspenders)");
  console.log("  - Attendance T-2h reminder: every hour → emails pending managers approaching deadline");
  console.log("  - Night shift consent expiry check: daily at 8 AM IST");
  console.log("  - Absent sweep: daily at 08:00 IST (all shifts ended by then; targets yesterday's date)");
  console.log("  - Regularization digest: 25th of month at 09:00 IST → emails managers with pending requests");
  console.log("  - Signing reminder sweep: daily at 9 AM IST → reminds unsigned offer letters & addendums at day 2 of 7");
  console.log("  - GSA rate refresh: daily at 02:00 EST → refreshes all ZIPs used in the last 90 days");
  console.log("  - Salary change promotion: daily at 00:30 IST → applies future-dated salary changes that became effective");
  console.log("  - Goal auto-progress sync: daily at 07:00 IST → calculates KPI-linked progress from system data (submissions, ATS, attendance, SOP, training)");
  console.log("  - Unified governance sync sweep (07:00 IST): cadence backfill → obligation sync → collectOverdueItems → collectProbationMilestoneEvents → applyEscalation (deduped) → HR checkin digest");
  console.log("  - CEO governance exception report: Mondays at 08:00 IST → anonymized AI summary emailed to super_admin/executive");
  console.log("  - Recruiter activity nudge: Mon-Fri at 5:30 PM IST → in-app nudge to recruiters who haven't logged today");
  console.log("  - Ceipal morning reminder: daily at 8:30 AM IST → notifies recruiters with unresolved yesterday Ceipal commitments");
  console.log("  - Ceipal escalation sweep: Mon-Fri at 7:30 PM IST → manager alert on 2+ consecutive misses, flag on 5+ in 30 days");
  console.log("  - SOP scheduled wave launches: daily 07:00 IST → fires approved wave_scheduled_launches where go_live_date <= today");
  console.log("  - Policy overdue manager digest: daily 09:00 IST → one email per manager listing direct reports with pending policy sign-off > 2 days overdue");
  console.log("  - Dev inbox weekly purge: Sundays 02:00 IST (non-production only) → removes dev_email_inbox rows older than 7 days");
}
