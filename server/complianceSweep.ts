/**
 * Unified Daily Compliance Sweep Engine
 *
 * Domain modules register collectors via `registerCollector(name, fn)`.
 * Each collector returns a list of ComplianceFinding objects — one per user
 * per alert. The daily sweep calls every registered collector, groups all
 * findings by userId, and dispatches exactly ONE notification per user per run:
 *
 *   • 1 finding for a user → notification preserves that finding's exact
 *     type / title / message / metadata (byte-for-byte identical to the old
 *     inline check-in digest behaviour).
 *   • 2+ findings for a user → a single "compliance_digest" notification whose
 *     metadata.items array contains all per-domain details.
 *
 * Usage (from any server module):
 *   import { registerCollector } from "./complianceSweep";
 *   registerCollector("my_domain", async (flags) => { return []; });
 *
 * The check-in overdue digest is registered here as the built-in collector.
 */

import { db } from "./db";
import { sql } from "drizzle-orm";
import { storage } from "./storage";

export interface ComplianceFinding {
  userId: string;
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

type CollectorFn = (flags: Record<string, boolean>) => Promise<ComplianceFinding[]>;

const collectors: Map<string, CollectorFn> = new Map();

/**
 * Register a compliance collector. Call this from any server module during
 * startup or module load. Collectors are called once per daily sweep.
 * @param name   Unique collector name (used only for logging).
 * @param fn     Async function that returns ComplianceFinding[].
 */
export function registerCollector(name: string, fn: CollectorFn): void {
  if (collectors.has(name)) {
    console.warn(`[complianceSweep] Collector "${name}" already registered — overwriting.`);
  }
  collectors.set(name, fn);
}

/**
 * Run all registered collectors, group every finding by userId, and dispatch
 * exactly ONE notification per user per run. When a user has findings from
 * multiple collectors they are merged into a single "compliance_digest"
 * notification. This prevents notification fan-out as more domain collectors
 * are added (goals, SOPs, training, etc.).
 */
export async function runDailySweep(): Promise<void> {
  const flags =
    ((await storage.getSystemSetting("feature_flags"))?.value as Record<string, boolean> | undefined) ?? {};

  if (!flags.notifications_enabled) {
    console.log("[complianceSweep] Skipped — notifications_enabled is off");
    return;
  }

  // ── Phase 1: collect all findings from every registered collector ──────────
  const byUser = new Map<string, ComplianceFinding[]>();
  const collectorStats: { name: string; count: number }[] = [];

  for (const [name, fn] of collectors) {
    try {
      const findings = await fn(flags);
      for (const f of findings) {
        if (!byUser.has(f.userId)) byUser.set(f.userId, []);
        byUser.get(f.userId)!.push(f);
      }
      collectorStats.push({ name, count: findings.length });
    } catch (err) {
      console.error(`[complianceSweep] Collector "${name}" failed:`, err);
      collectorStats.push({ name, count: 0 });
    }
  }

  // ── Phase 2: dispatch exactly ONE notification per user ───────────────────
  let dispatched = 0;
  for (const [userId, findings] of byUser) {
    if (findings.length === 0) continue;

    if (findings.length === 1) {
      // Single finding → send as-is, preserving the collector's own type /
      // title / message / metadata exactly (byte-for-byte parity with the
      // former inline Monday check-in digest cron).
      const f = findings[0];
      await storage.createNotification({
        userId: f.userId,
        type: f.type,
        title: f.title,
        message: f.message,
        isRead: false,
        metadata: f.metadata,
      });
    } else {
      // Multiple findings from different collectors → single merged digest.
      // Per-domain detail is preserved inside metadata.items so the UI and
      // future readers can still decompose the individual alerts.
      const itemCount = findings.length;
      await storage.createNotification({
        userId,
        type: "compliance_digest",
        title: `Daily compliance: ${itemCount} item${itemCount !== 1 ? "s" : ""} need your attention`,
        message: findings.map(f => f.title).join("; "),
        isRead: false,
        metadata: {
          itemCount,
          items: findings.map(f => ({
            type: f.type,
            title: f.title,
            message: f.message,
            ...(f.metadata ?? {}),
          })),
        },
      });
    }

    dispatched++;
  }

  const collectorSummary = collectorStats.map(s => `${s.name}=${s.count}`).join(", ");
  console.log(
    `[complianceSweep] Daily sweep done. Collectors: [${collectorSummary}]. Notifications dispatched: ${dispatched} (across ${byUser.size} users).`
  );
}

// ─── Built-in collector: check-in overdue digest ──────────────────────────────
// Sends each HR/admin user a single in-app notification listing all check-ins
// that are 3+ days overdue across all active plans. This mirrors exactly the
// behavior of the former inline Monday digest cron in scheduler.ts.
registerCollector("checkin_overdue_digest", async (_flags) => {
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - 3);
  const thresholdStr = thresholdDate.toISOString().split("T")[0];

  const overdueRows = (
    await db.execute(sql`
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
    `)
  ).rows as any[];

  if (overdueRows.length === 0) {
    console.log("[complianceSweep] checkin_overdue_digest: no overdue plan check-ins");
    return [];
  }

  const hrAdmins = (
    await db.execute(sql`
      SELECT id FROM admin_users
      WHERE role IN ('hr', 'admin', 'super_admin') AND is_active = true AND deleted_at IS NULL
    `)
  ).rows as any[];

  const digestMsg = `${overdueRows.length} check-in${overdueRows.length !== 1 ? "s" : ""} across active plans are 3+ days overdue.`;
  const sharedMetadata = {
    overdueCount: overdueRows.length,
    items: overdueRows.slice(0, 20).map((r: any) => ({
      employeeName: r.employee_name,
      scheduledDate: r.scheduled_date,
      planType: r.plan_type,
      checkInType: r.check_in_type,
    })),
  };

  console.log(
    `[complianceSweep] checkin_overdue_digest: ${overdueRows.length} overdue → ${hrAdmins.length} HR/admin users queued`
  );

  return hrAdmins.map((hr: any) => ({
    userId: hr.id,
    type: "checkin_overdue_digest",
    title: `Overdue check-ins: ${overdueRows.length} pending`,
    message: digestMsg,
    metadata: sharedMetadata,
  }));
});
