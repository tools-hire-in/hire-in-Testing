/**
 * Contract Billing Service
 *
 * Utilities for computing and advancing next_billing_date on contracts,
 * and for running the daily billing reminder + escalation sweep.
 */
import { db } from "../db";
import { sql } from "drizzle-orm";
import { notifyUser } from "../notifications";
import { getPortalBaseUrl } from "../portalUrl";

export interface EscalationConfig {
  primary_recipient_id: string;
  fallback_recipient_id?: string | null;
  fallback_after_hours: number;
  cc_on_escalation?: string[];
}

/**
 * Given the current next_billing_date and billing frequency,
 * compute the next billing date after the current one.
 * Returns the same date for milestone/one_time (no auto-advance).
 */
export function advanceBillingDate(currentDate: Date, billingFrequency: string): Date {
  const next = new Date(currentDate);
  switch (billingFrequency) {
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "bi_weekly":
      next.setDate(next.getDate() + 14);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      break;
    case "milestone":
    case "one_time":
    default:
      break;
  }
  return next;
}

/** Format a Date as YYYY-MM-DD string. */
export function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Return the start of the billing period that ends at `date`.
 * E.g. for a monthly contract where next_billing_date = May 1,
 * the period that is currently due started Apr 1.
 */
export function previousBillingDate(date: Date, billingFrequency: string): Date {
  const prev = new Date(date);
  switch (billingFrequency) {
    case "weekly":    prev.setDate(prev.getDate() - 7);   break;
    case "bi_weekly": prev.setDate(prev.getDate() - 14);  break;
    case "monthly":   prev.setMonth(prev.getMonth() - 1); break;
    default: break; // one_time / milestone — no previous period
  }
  return prev;
}

/** Parse a date string YYYY-MM-DD as a local midnight Date. */
export function parseDateString(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Check whether a contract_reminder_log row already exists for this
 * contract + type + date (prevents duplicate sends on the same calendar day).
 */
async function reminderAlreadySentToday(
  contractId: string,
  reminderType: string,
  today: string,
): Promise<boolean> {
  const rows = await db.execute(sql`
    SELECT id FROM contract_reminder_log
    WHERE contract_id = ${contractId}
      AND reminder_type = ${reminderType}
      AND DATE(sent_at) = ${today}::date
    LIMIT 1
  `);
  return rows.rows.length > 0;
}

/** Write a log row so the reminder is not sent again today. */
async function logReminder(
  contractId: string,
  reminderType: string,
  sentTo: string,
): Promise<void> {
  await db.execute(sql`
    INSERT INTO contract_reminder_log(contract_id, reminder_type, sent_to)
    VALUES(${contractId}, ${reminderType}, ${sentTo})
  `);
}

interface AdminUserRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
}

async function getUserById(userId: string): Promise<AdminUserRow | null> {
  const res = await db.execute(sql`
    SELECT id, first_name, last_name, email
    FROM admin_users WHERE id = ${userId} AND deleted_at IS NULL LIMIT 1
  `);
  if (!res.rows.length) return null;
  const r = res.rows[0] as any;
  return { id: r.id, firstName: r.first_name, lastName: r.last_name, email: r.email };
}

async function isNotificationsEnabled(): Promise<boolean> {
  try {
    const res = await db.execute(sql`
      SELECT value FROM system_settings WHERE key = 'notifications_enabled' LIMIT 1
    `);
    if (!res.rows.length) return true;
    const row = res.rows[0] as any;
    return row.value !== false && row.value !== "false";
  } catch {
    return true;
  }
}

interface ContractRow {
  id: string;
  clientName: string;
  contractType: string;
  billingFrequency: string | null;
  billingType: string | null;
  billingStartDate: string | null;
  nextBillingDate: string | null;
  billingReminderDaysBefore: number;
  escalationConfig: EscalationConfig | null;
  createdBy: string | null;
  issuedAt: string | null;
  timesheetConfirmedAt: string | null;
}

/**
 * Main daily billing reminder sweep.
 * Runs every morning (08:00 IST).
 *
 * Pass 1 — upcoming billing reminder:
 *   fires `billing_reminder_days_before` days before `next_billing_date`
 *   if no sent log row for today.
 *
 * Pass 2 — missed billing escalation:
 *   fires when `next_billing_date` has passed and no invoice with
 *   status `sent`/`paid` exists for that period, and at least
 *   `fallback_after_hours` hours have elapsed since the billing date.
 *
 * Pass 3 — one-time placement reminder:
 *   for permanent_placement / billing_type=one_time contracts,
 *   fires 3 days after `issued_at` (created_at) if no invoice exists.
 */
export async function runContractBillingReminderSweep(): Promise<{
  upcomingFired: number;
  escalationFired: number;
  oneTimeFired: number;
  timesheetFired: number;
  errors: number;
}> {
  const stats = { upcomingFired: 0, escalationFired: 0, oneTimeFired: 0, timesheetFired: 0, errors: 0 };

  if (!await isNotificationsEnabled()) {
    console.log("[contractBillingReminderSweep] notifications_enabled=false — skipping.");
    return stats;
  }

  const todayDate = new Date();
  const today = toDateString(todayDate);
  const portalBase = getPortalBaseUrl();

  // ── Fetch all active contracts with billing config ──────────────────────
  const contractsRes = await db.execute(sql`
    SELECT
      c.id, c.client_name, c.contract_type, c.billing_frequency,
      c.billing_type, c.billing_start_date, c.next_billing_date,
      COALESCE(c.billing_reminder_days_before, 2) AS billing_reminder_days_before,
      c.escalation_config, c.created_by,
      c.created_at AS issued_at,
      c.timesheet_confirmed_at
    FROM contracts c
    WHERE c.status = 'countersigned'
      AND (c.next_billing_date IS NOT NULL OR c.billing_type = 'one_time' OR c.contract_type = 'permanent_placement')
  `);

  const rows = contractsRes.rows as any[];

  for (const row of rows) {
    try {
      const contract: ContractRow = {
        id: row.id,
        clientName: row.client_name,
        contractType: row.contract_type,
        billingFrequency: row.billing_frequency,
        billingType: row.billing_type || "recurring",
        billingStartDate: row.billing_start_date,
        nextBillingDate: row.next_billing_date,
        billingReminderDaysBefore: Number(row.billing_reminder_days_before) || 2,
        escalationConfig: row.escalation_config ? (
          typeof row.escalation_config === "string"
            ? JSON.parse(row.escalation_config)
            : row.escalation_config
        ) : null,
        createdBy: row.created_by,
        issuedAt: row.issued_at,
        timesheetConfirmedAt: row.timesheet_confirmed_at || null,
      };

      const primaryId = contract.escalationConfig?.primary_recipient_id || contract.createdBy;
      if (!primaryId) continue;

      const isOneTime = contract.billingType === "one_time" || contract.contractType === "permanent_placement";
      const isHourly = contract.contractType === "contract_hourly" || contract.contractType === "contract_to_hire";

      // ── Pass 1: Upcoming billing reminder ──────────────────────────────
      if (contract.nextBillingDate && !isOneTime) {
        const billingDate = parseDateString(contract.nextBillingDate);
        const reminderDate = new Date(billingDate);
        reminderDate.setDate(reminderDate.getDate() - contract.billingReminderDaysBefore);
        const reminderDateStr = toDateString(reminderDate);

        if (reminderDateStr === today) {
          const alreadySent = await reminderAlreadySentToday(contract.id, "upcoming_billing", today);
          if (!alreadySent) {
            const daysUntil = contract.billingReminderDaysBefore;
            const link = `${portalBase}/admin/finance/contracts?contractId=${contract.id}&action=create-invoice`;

            await notifyUser({
              userId: primaryId,
              type: "contract_billing_upcoming",
              title: `Billing due in ${daysUntil} day${daysUntil !== 1 ? "s" : ""} — ${contract.clientName}`,
              message: `Invoice for ${contract.clientName} is due on ${new Date(billingDate).toLocaleDateString()}. Please raise an invoice.`,
              metadata: { contractId: contract.id, link, nextBillingDate: contract.nextBillingDate },
              email: {
                subject: `Billing Reminder: Invoice due in ${daysUntil} day${daysUntil !== 1 ? "s" : ""} — ${contract.clientName}`,
                html: buildUpcomingReminderHtml(contract.clientName, daysUntil, new Date(billingDate), link),
                configType: "contract_billing_upcoming",
                sourceJob: "contract_billing_reminder_sweep",
              },
            });

            // Timesheet request for hourly contracts — sent to the configured timesheet/hours
            // contact (escalationConfig.timesheet_recipient_id). This should be the department
            // manager or director responsible for confirming contractor hours, which may differ
            // from the billing account manager. Falls back to primary_recipient_id / createdBy
            // if no dedicated timesheet contact is configured.
            if (isHourly) {
              const timesheetRecipientId = (contract.escalationConfig?.timesheet_recipient_id as string | undefined) || primaryId;
              await notifyUser({
                userId: timesheetRecipientId,
                type: "contract_billing_timesheet_request",
                title: `Hours confirmation needed — ${contract.clientName}`,
                message: `Please confirm contractor hours for the billing period ending ${new Date(billingDate).toLocaleDateString()} before invoicing ${contract.clientName}.`,
                metadata: { contractId: contract.id, link, nextBillingDate: contract.nextBillingDate, requiresAcknowledgement: true },
              });
              await logReminder(contract.id, "timesheet_request", timesheetRecipientId);
              stats.timesheetFired++;
            }

            await logReminder(contract.id, "upcoming_billing", primaryId);
            stats.upcomingFired++;
          }
        }
      }

      // ── Pass 2: Missed billing escalation ──────────────────────────────
      if (contract.nextBillingDate && !isOneTime && contract.escalationConfig?.fallback_recipient_id) {
        const billingDate = parseDateString(contract.nextBillingDate);
        const isOverdue = billingDate < todayDate;

        if (isOverdue) {
          const fallbackAfterHours = contract.escalationConfig.fallback_after_hours || 24;
          const escalationThreshold = new Date(billingDate.getTime() + fallbackAfterHours * 60 * 60 * 1000);

          if (todayDate >= escalationThreshold) {
            // Period-aware check: only suppress escalation if a sent/paid invoice
            // covers the current billing period. We prefer the invoice's own period_start
            // column (most accurate) and fall back to created_at only for invoices that
            // predate the period columns.
            const periodStart = previousBillingDate(billingDate, contract.billingFrequency || "monthly");
            const periodStartStr = toDateString(periodStart);
            const nextBillingStr = contract.nextBillingDate!;
            const invoiceRes = await db.execute(sql`
              SELECT id FROM contract_invoices
              WHERE contract_id = ${contract.id}
                AND status IN ('sent', 'paid')
                AND (
                  -- Invoice has period columns: its period_start falls within the current billing window
                  (period_start IS NOT NULL
                    AND period_start >= ${periodStartStr}::date
                    AND period_start <= ${nextBillingStr}::date)
                  OR
                  -- Fallback for invoices without period columns: use created_at proximity
                  (period_start IS NULL AND created_at >= ${periodStart.toISOString()})
                )
              LIMIT 1
            `);
            const hasInvoice = invoiceRes.rows.length > 0;

            if (!hasInvoice) {
              const alreadySent = await reminderAlreadySentToday(contract.id, "missed_billing_escalation", today);
              if (!alreadySent) {
                const fallbackId = contract.escalationConfig.fallback_recipient_id;
                const primaryUser = await getUserById(primaryId);
                const primaryName = primaryUser ? `${primaryUser.firstName} ${primaryUser.lastName}` : "the account manager";
                const link = `${portalBase}/admin/finance/contracts?contractId=${contract.id}&action=create-invoice`;

                const ccIds = contract.escalationConfig.cc_on_escalation || [];

                await notifyUser({
                  userId: fallbackId,
                  type: "contract_billing_escalation",
                  title: `Billing overdue — ${contract.clientName}`,
                  message: `No invoice has been raised for ${contract.clientName} (billing was due ${new Date(billingDate).toLocaleDateString()}). Originally assigned to ${primaryName}.`,
                  metadata: { contractId: contract.id, link, nextBillingDate: contract.nextBillingDate },
                  email: {
                    subject: `ESCALATION: Billing overdue for ${contract.clientName}`,
                    html: buildEscalationHtml(contract.clientName, new Date(billingDate), primaryName, link),
                    configType: "contract_billing_escalation",
                    sourceJob: "contract_billing_reminder_sweep",
                  },
                });

                for (const ccId of ccIds) {
                  if (ccId !== fallbackId) {
                    await notifyUser({
                      userId: ccId,
                      type: "contract_billing_escalation",
                      title: `[CC] Billing overdue — ${contract.clientName}`,
                      message: `You are CC'd on a billing escalation for ${contract.clientName}.`,
                      metadata: { contractId: contract.id, link },
                    });
                  }
                }

                await logReminder(contract.id, "missed_billing_escalation", fallbackId);
                stats.escalationFired++;
              }
            }

          }
        }
      }

      // ── Pass 2b: Timesheet acknowledgement SLA escalation (hourly contracts) ──
      // Independent of the overdue-billing branch.
      // Fires when the primary account manager's timesheet-request has been outstanding for
      // longer than fallback_after_hours AND the timesheet is still unconfirmed for the CURRENT
      // billing period. "Current period" starts at previousBillingDate(nextBillingDate), so a
      // historical confirmation from a prior cycle does NOT suppress this cycle's escalation.
      if (isHourly && contract.nextBillingDate && contract.escalationConfig?.fallback_recipient_id) {
        const fallbackAfterHours = contract.escalationConfig.fallback_after_hours || 24;
        const currentBillingDate = parseDateString(contract.nextBillingDate);
        const currentPeriodStart = previousBillingDate(currentBillingDate, contract.billingFrequency || "monthly");

        // Period-aware confirmation check: confirmed only if timesheetConfirmedAt falls
        // WITHIN the current billing period (>= period start).
        const isConfirmedForCurrentPeriod = contract.timesheetConfirmedAt
          ? new Date(contract.timesheetConfirmedAt) >= currentPeriodStart
          : false;

        if (!isConfirmedForCurrentPeriod) {
          // Find the most recent timesheet_request that was sent WITHIN the current period.
          const currentPeriodStartStr = currentPeriodStart.toISOString();
          const tsLogRes = await db.execute(sql`
            SELECT sent_at FROM contract_reminder_log
            WHERE contract_id = ${contract.id}
              AND reminder_type = 'timesheet_request'
              AND sent_at >= ${currentPeriodStartStr}::timestamptz
            ORDER BY sent_at DESC
            LIMIT 1
          `);
          if (tsLogRes.rows.length > 0) {
            const requestSentAt = new Date((tsLogRes.rows[0] as any).sent_at);
            const slaDeadline = new Date(requestSentAt.getTime() + fallbackAfterHours * 60 * 60 * 1000);
            if (todayDate >= slaDeadline) {
              const alreadySentTs = await reminderAlreadySentToday(contract.id, "timesheet_ack_escalation", today);
              if (!alreadySentTs) {
                const fallbackId = contract.escalationConfig.fallback_recipient_id;
                const link = `${portalBase}/admin/finance/contracts?contractId=${contract.id}`;

                await notifyUser({
                  userId: fallbackId,
                  type: "contract_billing_timesheet_escalation",
                  title: `Timesheet unconfirmed — ${contract.clientName}`,
                  message: `Contractor hours for ${contract.clientName} have not been confirmed ${fallbackAfterHours}h after the request was sent (billing due ${currentBillingDate.toLocaleDateString()}). Please review and confirm hours before invoicing.`,
                  metadata: { contractId: contract.id, link, nextBillingDate: contract.nextBillingDate },
                  email: {
                    subject: `Action Required: Confirm contractor hours — ${contract.clientName}`,
                    html: buildTimesheetEscalationHtml(contract.clientName, currentBillingDate, link),
                    configType: "contract_billing_timesheet_escalation",
                    sourceJob: "contract_billing_reminder_sweep",
                  },
                });

                // CC recipients receive the same escalation — mirrors billing escalation chain
                const ccIds = contract.escalationConfig.cc_on_escalation || [];
                for (const ccId of ccIds) {
                  if (ccId !== fallbackId) {
                    await notifyUser({
                      userId: ccId,
                      type: "contract_billing_timesheet_escalation",
                      title: `[CC] Timesheet unconfirmed — ${contract.clientName}`,
                      message: `You are CC'd on a timesheet escalation for ${contract.clientName}. Hours have not been confirmed for the billing period due ${currentBillingDate.toLocaleDateString()}.`,
                      metadata: { contractId: contract.id, link },
                    });
                  }
                }

                await logReminder(contract.id, "timesheet_ack_escalation", fallbackId);
                stats.timesheetFired++;
              }
            }
          }
        }
      }

      // ── Pass 3: One-time placement reminder ────────────────────────────
      if (isOneTime && contract.issuedAt) {
        const issuedDate = new Date(contract.issuedAt);
        const triggerDate = new Date(issuedDate.getTime() + 3 * 24 * 60 * 60 * 1000);
        const triggerDateStr = toDateString(triggerDate);

        if (triggerDateStr === today) {
          const alreadySent = await reminderAlreadySentToday(contract.id, "one_time_reminder", today);
          if (!alreadySent) {
            const invoiceRes = await db.execute(sql`
              SELECT id FROM contract_invoices WHERE contract_id = ${contract.id} LIMIT 1
            `);
            if (!invoiceRes.rows.length) {
              const link = `${portalBase}/admin/finance/contracts?contractId=${contract.id}&action=create-invoice`;

              await notifyUser({
                userId: primaryId,
                type: "contract_billing_one_time_reminder",
                title: `Invoice reminder — ${contract.clientName} (placement)`,
                message: `No invoice has been created yet for the placement contract with ${contract.clientName}. Please raise the one-time placement fee invoice.`,
                metadata: { contractId: contract.id, link },
                email: {
                  subject: `Invoice Reminder: Placement fee not yet invoiced — ${contract.clientName}`,
                  html: buildOneTimeReminderHtml(contract.clientName, link),
                  configType: "contract_billing_one_time_reminder",
                  sourceJob: "contract_billing_reminder_sweep",
                },
              });

              await logReminder(contract.id, "one_time_reminder", primaryId);
              stats.oneTimeFired++;
            }
          }
        }
      }
    } catch (rowErr) {
      console.error(`[contractBillingReminderSweep] Error for contract ${row.id}:`, rowErr);
      stats.errors++;
    }
  }

  return stats;
}

// ── Email HTML builders ──────────────────────────────────────────────────────

function buildUpcomingReminderHtml(clientName: string, daysUntil: number, billingDate: Date, link: string): string {
  const dateStr = billingDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  return `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
      <div style="background:linear-gradient(135deg,#1F3A6E 0%,#2c5282 100%);padding:28px 32px;text-align:center;">
        <h1 style="color:#ffffff;margin:0;font-size:20px;font-weight:700;">Hire&rsquo;in Solutions — Billing Reminder</h1>
      </div>
      <div style="padding:32px;">
        <div style="border-left:4px solid #F47C20;padding-left:16px;margin-bottom:20px;">
          <h2 style="color:#1e293b;margin:0 0 4px;font-size:18px;">Invoice Due in ${daysUntil} Day${daysUntil !== 1 ? "s" : ""}</h2>
          <p style="color:#64748b;margin:0;font-size:13px;">${clientName}</p>
        </div>
        <p style="color:#475569;line-height:1.6;margin:0 0 24px;">
          The next billing cycle for <strong>${clientName}</strong> is due on <strong>${dateStr}</strong>.
          Please raise the invoice before the due date.
        </p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${link}" style="display:inline-block;background:#F47C20;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:6px;font-weight:600;font-size:14px;">Create Invoice</a>
        </div>
      </div>
      <div style="padding:16px 32px;background:#f8fafc;text-align:center;border-top:1px solid #e2e8f0;">
        <p style="color:#94a3b8;font-size:11px;margin:0;">Hire&rsquo;in Solutions — automated billing reminder</p>
      </div>
    </div>`;
}

function buildEscalationHtml(clientName: string, billingDate: Date, primaryName: string, link: string): string {
  const dateStr = billingDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  return `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
      <div style="background:linear-gradient(135deg,#dc2626 0%,#b91c1c 100%);padding:28px 32px;text-align:center;">
        <h1 style="color:#ffffff;margin:0;font-size:20px;font-weight:700;">Billing Escalation — Action Required</h1>
      </div>
      <div style="padding:32px;">
        <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:16px 20px;margin:0 0 24px;">
          <p style="color:#c2410c;font-weight:600;margin:0 0 6px;">⚠ Billing Overdue</p>
          <p style="color:#9a3412;margin:0;font-size:14px;">
            No invoice has been raised for <strong>${clientName}</strong>. Billing was due on ${dateStr}.
            Originally assigned to <strong>${primaryName}</strong>.
          </p>
        </div>
        <div style="text-align:center;margin:24px 0;">
          <a href="${link}" style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:6px;font-weight:600;font-size:14px;">Create Invoice Now</a>
        </div>
      </div>
      <div style="padding:16px 32px;background:#f8fafc;text-align:center;border-top:1px solid #e2e8f0;">
        <p style="color:#94a3b8;font-size:11px;margin:0;">Hire&rsquo;in Solutions — automated billing escalation</p>
      </div>
    </div>`;
}

function buildTimesheetEscalationHtml(clientName: string, billingDate: Date, link: string): string {
  return `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
      <div style="background:linear-gradient(135deg,#1F3A6E 0%,#2c5282 100%);padding:28px 32px;text-align:center;">
        <h1 style="color:#ffffff;margin:0;font-size:20px;font-weight:700;">Hire&rsquo;in Solutions — Timesheet Confirmation Required</h1>
      </div>
      <div style="padding:32px;">
        <p style="color:#475569;line-height:1.6;margin:0 0 24px;">
          Contractor hours for <strong>${clientName}</strong> have not been confirmed for the billing period
          due <strong>${billingDate.toLocaleDateString()}</strong>. Please review and confirm hours before raising the invoice.
        </p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${link}" style="display:inline-block;background:#F47C20;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:6px;font-weight:600;font-size:14px;">Confirm Hours</a>
        </div>
      </div>
    </div>`;
}

function buildOneTimeReminderHtml(clientName: string, link: string): string {
  return `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
      <div style="background:linear-gradient(135deg,#1F3A6E 0%,#2c5282 100%);padding:28px 32px;text-align:center;">
        <h1 style="color:#ffffff;margin:0;font-size:20px;font-weight:700;">Hire&rsquo;in Solutions — Placement Invoice Reminder</h1>
      </div>
      <div style="padding:32px;">
        <p style="color:#475569;line-height:1.6;margin:0 0 24px;">
          The placement contract with <strong>${clientName}</strong> was issued 3 days ago but no invoice has been created yet.
          Please raise the one-time placement fee invoice.
        </p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${link}" style="display:inline-block;background:#F47C20;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:6px;font-weight:600;font-size:14px;">Create Invoice</a>
        </div>
      </div>
    </div>`;
}
