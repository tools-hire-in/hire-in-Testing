/**
 * Email Blast Review Queue
 *
 * Automated cron jobs call queueBlast() with their full recipient list.
 * When recipients.length >= blast_threshold (default 5), the batch is held
 * as a pending_email_blasts row for Super Admin / Admin review.
 * Single-recipient transactional emails bypass this entirely.
 *
 * Delivery flow:
 *   queueBlast → pending row → Admin approves → approveBlast()
 *     → setImmediate(processBlast) → delivers per-row → status=sent/partially_failed/failed
 *
 * Crash recovery: recoverStuckBlasts() re-enqueues any blast stuck in "delivering".
 * Because processBlast only fetches pending delivery records, already-sent rows
 * are never re-sent.
 */

import { db } from "./db";
import { pendingEmailBlasts, blastDeliveryRecords, adminUsers, systemSettings } from "@shared/schema";
import { eq, and, sql, lt } from "drizzle-orm";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface QueueBlastParams {
  triggerSource: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  recipients: { userId: string; name: string; email: string }[];
}

export interface QueueBlastResult {
  queued: boolean;
  blastId?: string;
  recipientCount?: number;
  /** true when below threshold — caller should send directly */
  belowThreshold?: boolean;
}

// ── Threshold helper ─────────────────────────────────────────────────────────

async function getBlastThreshold(): Promise<number> {
  try {
    const row = await db.execute(sql`
      SELECT value FROM system_settings WHERE key = 'blast_threshold' LIMIT 1
    `);
    const val = row.rows[0]?.value;
    if (typeof val === "number") return val;
    if (typeof val === "string") return parseInt(val, 10) || 5;
    return 5;
  } catch {
    return 5;
  }
}

async function getBlastPendingAlertHours(): Promise<number> {
  try {
    const row = await db.execute(sql`
      SELECT value FROM system_settings WHERE key = 'blast_pending_alert_hours' LIMIT 1
    `);
    const val = row.rows[0]?.value;
    if (typeof val === "number") return val;
    if (typeof val === "string") return parseInt(val, 10) || 4;
    return 4;
  } catch {
    return 4;
  }
}

// ── Core functions ────────────────────────────────────────────────────────────

/**
 * Queue a multi-recipient email blast for admin review.
 * Returns { queued: false, belowThreshold: true } when below the threshold
 * so callers know to send directly instead.
 */
export async function queueBlast(params: QueueBlastParams): Promise<QueueBlastResult> {
  const threshold = await getBlastThreshold();

  if (params.recipients.length < threshold) {
    return { queued: false, belowThreshold: true };
  }

  const deduped = Array.from(
    new Map(params.recipients.map(r => [r.email.toLowerCase(), r])).values(),
  );

  const [blast] = await db.insert(pendingEmailBlasts).values({
    triggerSource: params.triggerSource,
    subject: params.subject,
    bodyHtml: params.bodyHtml,
    bodyText: params.bodyText ?? null,
    recipients: deduped,
    recipientCount: deduped.length,
    status: "pending",
  }).returning({ id: pendingEmailBlasts.id });

  if (!blast) throw new Error("Failed to insert pending_email_blasts row");

  await db.insert(blastDeliveryRecords).values(
    deduped.map(r => ({
      blastId: blast.id,
      userId: r.userId || null,
      email: r.email,
      status: "pending" as const,
    })),
  );

  console.log(`[blastQueue] Queued blast ${blast.id} (${deduped.length} recipients) — source: ${params.triggerSource}`);
  return { queued: true, blastId: blast.id, recipientCount: deduped.length };
}

/**
 * Approve a pending blast. Optionally overrides subject/body (edit-before-send).
 * Atomically transitions to "approved" and fires processBlast asynchronously.
 * Returns immediately — does not await delivery.
 */
export async function approveBlast(
  blastId: string,
  actingUserId: string,
  overrideSubject?: string,
  overrideBodyHtml?: string,
): Promise<void> {
  const now = new Date();
  const hasEdit = !!(overrideSubject || overrideBodyHtml);

  // Single transaction: read current status and transition atomically.
  // This prevents double-approvals if two admins click at the same time.
  await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(pendingEmailBlasts)
      .where(eq(pendingEmailBlasts.id, blastId))
      .for("update");                      // row-level lock
    if (!existing) throw new Error(`Blast ${blastId} not found`);
    if (existing.status !== "pending") throw new Error(`Blast ${blastId} is not pending (status: ${existing.status})`);

    await tx.update(pendingEmailBlasts).set({
      status: "approved",
      reviewedBy: actingUserId,
      reviewedAt: now,
      ...(hasEdit ? {
        originalSubject: existing.subject,
        originalBodyHtml: existing.bodyHtml,
        subject: overrideSubject ?? existing.subject,
        bodyHtml: overrideBodyHtml ?? existing.bodyHtml,
        editedBy: actingUserId,
        editedAt: now,
      } : {}),
    }).where(eq(pendingEmailBlasts.id, blastId));
  });

  setImmediate(() => {
    processBlast(blastId).catch(err => {
      console.error(`[blastQueue] processBlast(${blastId}) crashed:`, err);
    });
  });
}

/**
 * Cancel a pending or delivering blast.
 * Only super_admin may cancel a delivering blast (enforcement at route level).
 */
export async function cancelBlast(
  blastId: string,
  _actingUserId: string,
  reason: string,
): Promise<void> {
  const [existing] = await db.select({ status: pendingEmailBlasts.status })
    .from(pendingEmailBlasts)
    .where(eq(pendingEmailBlasts.id, blastId));

  if (!existing) throw new Error(`Blast ${blastId} not found`);
  if (!["pending", "delivering"].includes(existing.status)) {
    throw new Error(`Blast ${blastId} cannot be cancelled (status: ${existing.status})`);
  }

  await db.update(pendingEmailBlasts).set({
    status: "cancelled",
    cancelReason: reason,
  }).where(eq(pendingEmailBlasts.id, blastId));
}

/**
 * Process a blast: deliver each pending recipient row, update per-row status,
 * then set the blast's final status.
 * Safe to re-run after a crash — already-sent rows are skipped automatically.
 */
export async function processBlast(blastId: string): Promise<void> {
  const [blast] = await db.select().from(pendingEmailBlasts)
    .where(eq(pendingEmailBlasts.id, blastId));
  if (!blast) {
    console.error(`[blastQueue] processBlast: blast ${blastId} not found`);
    return;
  }
  if (blast.status === "cancelled") {
    console.log(`[blastQueue] blast ${blastId} was cancelled — skipping delivery`);
    return;
  }

  await db.update(pendingEmailBlasts).set({
    status: "delivering",
    deliveryStartedAt: new Date(),
  }).where(eq(pendingEmailBlasts.id, blastId));

  const pendingRows = await db.select().from(blastDeliveryRecords)
    .where(and(
      eq(blastDeliveryRecords.blastId, blastId),
      eq(blastDeliveryRecords.status, "pending"),
    ));

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of pendingRows) {
    // Re-check blast status on each iteration — honour cancel-during-delivery.
    const [liveBlast] = await db.select({ status: pendingEmailBlasts.status })
      .from(pendingEmailBlasts)
      .where(eq(pendingEmailBlasts.id, blastId));
    if (!liveBlast || liveBlast.status === "cancelled") {
      // Mark all remaining pending rows as skipped and stop.
      await db.update(blastDeliveryRecords)
        .set({ status: "skipped", errorMessage: "Blast cancelled", sentAt: new Date() })
        .where(and(
          eq(blastDeliveryRecords.blastId, blastId),
          eq(blastDeliveryRecords.status, "pending"),
        ));
      console.log(`[blastQueue] blast ${blastId} was cancelled mid-delivery — remaining rows skipped`);
      return;
    }

    try {
      if (row.userId) {
        const [user] = await db.select({
          isActive: adminUsers.isActive,
          deletedAt: adminUsers.deletedAt,
        }).from(adminUsers).where(eq(adminUsers.id, row.userId));

        if (!user || !user.isActive || user.deletedAt) {
          await db.update(blastDeliveryRecords).set({
            status: "skipped",
            errorMessage: "User is inactive or deleted",
            sentAt: new Date(),
          }).where(eq(blastDeliveryRecords.id, row.id));
          skipped++;
          continue;
        }
      }

      const { getUncachableSendGridClient } = await import("./email");
      const { client, fromEmail } = await getUncachableSendGridClient();

      await client.send({
        to: row.email,
        from: fromEmail,
        subject: blast.subject,
        html: blast.bodyHtml,
        text: blast.bodyText ?? undefined,
      });

      await db.update(blastDeliveryRecords).set({
        status: "sent",
        sentAt: new Date(),
      }).where(eq(blastDeliveryRecords.id, row.id));
      sent++;
    } catch (err: any) {
      await db.update(blastDeliveryRecords).set({
        status: "failed",
        errorMessage: String(err?.message ?? err),
        sentAt: new Date(),
      }).where(eq(blastDeliveryRecords.id, row.id));
      failed++;
      console.error(`[blastQueue] delivery failed for ${row.email} (blast ${blastId}):`, err);
    }
  }

  // Compute final status from ALL delivery records for this blast — not just
  // the pending rows processed in this invocation.  This matters for crash
  // recovery: if a previous run updated rows to sent/failed before crashing,
  // re-running with 0 pending rows must still reflect those historical outcomes.
  const allDeliveryRows = await db
    .select({ status: blastDeliveryRecords.status })
    .from(blastDeliveryRecords)
    .where(eq(blastDeliveryRecords.blastId, blastId));

  const totalSent  = allDeliveryRows.filter(r => r.status === "sent").length;
  const totalFailed = allDeliveryRows.filter(r => r.status === "failed").length;

  const finalStatus =
    totalFailed > 0 && totalSent === 0 ? "failed" :
    totalFailed > 0 ? "partially_failed" :
    "sent";

  await db.update(pendingEmailBlasts).set({
    status: finalStatus,
    deliveryFinishedAt: new Date(),
  }).where(eq(pendingEmailBlasts.id, blastId));

  console.log(`[blastQueue] blast ${blastId} done — sent=${sent} skipped=${skipped} failed=${failed} (total from DB: sent=${totalSent} failed=${totalFailed}) → ${finalStatus}`);
}

/**
 * Startup recovery: re-enqueue any blast stuck in "delivering" from a prior crash.
 * processBlast fetches only pending delivery records, so no duplicate sends.
 */
export async function recoverStuckBlasts(): Promise<void> {
  const stuck = await db.select({ id: pendingEmailBlasts.id })
    .from(pendingEmailBlasts)
    .where(eq(pendingEmailBlasts.status, "delivering"));

  if (stuck.length === 0) return;

  console.log(`[blastQueue] Recovering ${stuck.length} stuck blast(s)...`);
  for (const { id } of stuck) {
    setImmediate(() => {
      processBlast(id).catch(err => {
        console.error(`[blastQueue] crash recovery processBlast(${id}) failed:`, err);
      });
    });
  }
}

/**
 * Hourly housekeeping:
 *   1. Auto-expire blasts pending > 72 hours.
 *   2. Send a transactional alert to super_admins for blasts pending > N hours (once only).
 */
export async function runBlastHousekeeping(): Promise<void> {
  const now = new Date();

  // ── 1. Auto-expiry ──────────────────────────────────────────────────────────
  try {
    const expired = await db.select({ id: pendingEmailBlasts.id })
      .from(pendingEmailBlasts)
      .where(and(
        eq(pendingEmailBlasts.status, "pending"),
        lt(pendingEmailBlasts.createdAt, new Date(now.getTime() - 72 * 60 * 60 * 1000)),
      ));

    for (const { id } of expired) {
      await db.update(pendingEmailBlasts).set({
        status: "cancelled",
        cancelReason: "expired",
      }).where(eq(pendingEmailBlasts.id, id));
      console.log(`[blastQueue] Auto-expired blast ${id} (> 72h pending)`);
    }
  } catch (err) {
    console.error("[blastQueue] Auto-expiry sweep failed:", err);
  }

  // ── 2. Pending alert ────────────────────────────────────────────────────────
  try {
    const alertHours = await getBlastPendingAlertHours();
    const alertThreshold = new Date(now.getTime() - alertHours * 60 * 60 * 1000);

    const needsAlert = await db.select().from(pendingEmailBlasts)
      .where(and(
        eq(pendingEmailBlasts.status, "pending"),
        lt(pendingEmailBlasts.createdAt, alertThreshold),
        eq(pendingEmailBlasts.alertSent, false),
      ));

    if (needsAlert.length === 0) return;

    const superAdmins = await db.select({
      id: adminUsers.id,
      email: adminUsers.email,
      firstName: adminUsers.firstName,
    }).from(adminUsers)
      .where(and(
        eq(adminUsers.role, "super_admin"),
        eq(adminUsers.isActive, true),
        sql`${adminUsers.deletedAt} IS NULL`,
      ));

    if (superAdmins.length === 0) return;

    const { getUncachableSendGridClient } = await import("./email");

    for (const blast of needsAlert) {
      try {
        const ageH = Math.round((now.getTime() - new Date(blast.createdAt!).getTime()) / 3600000);
        const subject = `[Action Required] Email blast pending review for ${ageH}h — ${blast.triggerSource}`;
        const html = `
          <p>An automated email blast has been waiting for review for <strong>${ageH} hours</strong> and has not yet been approved or cancelled.</p>
          <table style="border-collapse:collapse;width:100%;max-width:500px">
            <tr><td style="padding:6px;font-weight:bold;background:#f5f5f5">Source</td><td style="padding:6px">${blast.triggerSource}</td></tr>
            <tr><td style="padding:6px;font-weight:bold;background:#f5f5f5">Subject</td><td style="padding:6px">${blast.subject}</td></tr>
            <tr><td style="padding:6px;font-weight:bold;background:#f5f5f5">Recipients</td><td style="padding:6px">${blast.recipientCount}</td></tr>
            <tr><td style="padding:6px;font-weight:bold;background:#f5f5f5">Queued at</td><td style="padding:6px">${blast.createdAt}</td></tr>
          </table>
          <p style="margin-top:16px">Please review it in the admin portal under <strong>Communications → Notification Blasts</strong>.</p>
        `;

        const { client, fromEmail } = await getUncachableSendGridClient();
        for (const admin of superAdmins) {
          try {
            await client.send({
              to: admin.email,
              from: fromEmail,
              subject,
              html,
              text: `Email blast pending review for ${ageH}h — ${blast.triggerSource} (${blast.recipientCount} recipients). Please review in the admin portal.`,
            });
          } catch (e) {
            console.error(`[blastQueue] alert email to ${admin.email} failed:`, e);
          }
        }

        await db.update(pendingEmailBlasts).set({ alertSent: true })
          .where(eq(pendingEmailBlasts.id, blast.id));

        console.log(`[blastQueue] Pending alert sent for blast ${blast.id}`);
      } catch (err) {
        console.error(`[blastQueue] alert for blast ${blast.id} failed:`, err);
      }
    }
  } catch (err) {
    console.error("[blastQueue] Pending alert sweep failed:", err);
  }
}
