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

// ─── Built-in collector: overdue goal nudge & escalation ladder ───────────────
// Detects performance_goals that are past targetDate with status not completed/
// cancelled, then fires a strict 3-step one-time escalation ladder:
//   Day 1 past targetDate → employee nudge (dedup: employee_nudged_at IS NULL)
//   Day 3 past targetDate → manager escalation (dedup: last_escalated_at IS NULL)
//   Day 6 past targetDate → skip-level + HR escalation (dedup: skip_escalated_at IS NULL)
//
// Separation of columns ensures each step fires exactly ONCE per overdue episode.
// skip_escalated_at only fires if last_escalated_at was set in a PRIOR sweep run
// (not the same run), so Day 3 and Day 6 are never fired together in one pass.
registerCollector("overdue_goals_sweep", async (_flags) => {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const findings: ComplianceFinding[] = [];

  // Load all overdue goals (not yet completed/cancelled, past targetDate, has a plan)
  const overdueResult = await db.execute(sql`
    SELECT
      pg.id, pg.title, pg.progress, pg.target_date, pg.employee_id, pg.manager_id,
      pg.plan_id, pg.employee_nudged_at, pg.last_escalated_at, pg.skip_escalated_at,
      ep.plan_type, ep.manager_goal_escalated_at,
      au.first_name AS emp_first_name, au.last_name AS emp_last_name, au.email AS emp_email,
      m.first_name AS mgr_first_name, m.last_name AS mgr_last_name, m.email AS mgr_email,
      m.manager_id AS skip_manager_id
    FROM performance_goals pg
    LEFT JOIN employee_plans ep ON pg.plan_id = ep.id
    LEFT JOIN admin_users au ON pg.employee_id = au.id
    LEFT JOIN admin_users m ON pg.manager_id = m.id
    WHERE pg.status NOT IN ('completed', 'cancelled')
      AND pg.target_date IS NOT NULL
      AND pg.target_date < ${todayStr}
      AND pg.plan_id IS NOT NULL
      AND (pg.progress = 0 OR pg.last_progress_updated_at IS NULL OR pg.last_progress_updated_at::date <= pg.target_date::date)
  `);

  const overdue = overdueResult.rows as any[];
  if (overdue.length === 0) {
    console.log("[complianceSweep] overdue_goals_sweep: no overdue plan goals");
    return [];
  }

  // Load HR/admin users for skip-level escalation recipients
  const hrAdminResult = await db.execute(sql`
    SELECT id, email, first_name FROM admin_users
    WHERE role IN ('hr', 'admin', 'super_admin') AND is_active = true AND deleted_at IS NULL
  `);
  const hrAdmins = hrAdminResult.rows as any[];

  // Dynamically import email helpers to avoid circular dependency at module load
  const { sendPlanEscalationEmail, sendPlanOverdueReminderEmail } = await import("./email");

  for (const goal of overdue) {
    const targetDate = new Date(String(goal.target_date));
    const msPerDay = 86400000;
    const daysOverdue = Math.floor((today.getTime() - targetDate.getTime()) / msPerDay);
    if (daysOverdue < 1) continue;

    const empName = `${goal.emp_first_name ?? ""} ${goal.emp_last_name ?? ""}`.trim() || "Employee";
    const goalTitle = String(goal.title);
    const planType = goal.plan_type ?? "probation";

    // In-loop flag: track whether Day 3 fired in THIS run so Day 6 cannot
    // fire in the same sweep pass (prevents double-fire on first Day 6+ goal).
    let managerEscalatedThisRun = false;

    // ── Day 1: employee nudge (one-time; dedup: employee_nudged_at IS NULL) ──
    if (daysOverdue >= 1 && !goal.employee_nudged_at) {
      // In-app notification for the employee
      if (goal.employee_id) {
        findings.push({
          userId: String(goal.employee_id),
          type: "goal_overdue_nudge",
          title: `Overdue goal: "${goalTitle}"`,
          message: `Your goal "${goalTitle}" was due on ${String(goal.target_date)} and needs a progress update.`,
          metadata: { goalId: String(goal.id), targetDate: String(goal.target_date), daysOverdue },
        });
      }
      // Email the employee
      if (goal.emp_email) {
        try {
          await sendPlanOverdueReminderEmail({
            to: String(goal.emp_email),
            managerFirstName: String(goal.emp_first_name ?? "there"),
            employeeName: empName,
            checkInLabel: `Goal: "${goalTitle}"`,
            scheduledDate: String(goal.target_date),
            daysOverdue,
            planType: planType as any,
          });
        } catch (e) {
          console.error(`[overdue_goals_sweep] Failed employee nudge email for goal ${goal.id}:`, e);
        }
      }
      // Mark employee as nudged (one-time dedup)
      await db.execute(sql`
        UPDATE performance_goals SET employee_nudged_at = NOW() WHERE id = ${String(goal.id)}
      `);
      console.log(`[overdue_goals_sweep] Nudged employee ${goal.employee_id} for goal ${goal.id} (${daysOverdue}d overdue)`);
    }

    // ── Day 3: manager escalation (one-time; dedup: last_escalated_at IS NULL) ──
    if (daysOverdue >= 3 && !goal.last_escalated_at) {
      if (goal.manager_id && goal.mgr_email) {
        // Email the manager
        try {
          await sendPlanOverdueReminderEmail({
            to: String(goal.mgr_email),
            managerFirstName: String(goal.mgr_first_name ?? "Manager"),
            employeeName: empName,
            checkInLabel: `Goal: "${goalTitle}"`,
            scheduledDate: String(goal.target_date),
            daysOverdue,
            planType: planType as any,
          });
        } catch (e) {
          console.error(`[overdue_goals_sweep] Failed manager email for goal ${goal.id}:`, e);
        }

        // In-app notification for the manager
        findings.push({
          userId: String(goal.manager_id),
          type: "goal_overdue_manager_escalation",
          title: `Action needed: ${empName}'s goal is overdue`,
          message: `"${goalTitle}" is ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""} overdue with no progress update.`,
          metadata: { goalId: String(goal.id), employeeId: String(goal.employee_id), targetDate: String(goal.target_date), daysOverdue },
        });
      }

      // Record manager escalation (one-time dedup for Day 3; skip uses separate column)
      await db.execute(sql`
        UPDATE performance_goals SET last_escalated_at = NOW() WHERE id = ${String(goal.id)}
      `);
      if (goal.plan_id) {
        await db.execute(sql`
          UPDATE employee_plans SET manager_goal_escalated_at = NOW() WHERE id = ${String(goal.plan_id)}
        `);
      }
      managerEscalatedThisRun = true;
      console.log(`[overdue_goals_sweep] Escalated to manager for goal ${goal.id} (${daysOverdue}d overdue)`);
    }

    // ── Day 6: skip-level + HR escalation ────────────────────────────────────
    // Fires once when: 6+ days overdue AND Day 3 was already sent in a PRIOR run
    // (last_escalated_at IS NOT NULL) AND skip-level not yet sent (skip_escalated_at IS NULL)
    // AND Day 3 did NOT just fire in this same loop iteration.
    if (
      daysOverdue >= 6 &&
      goal.last_escalated_at &&
      !goal.skip_escalated_at &&
      !managerEscalatedThisRun
    ) {
      const escalationRecipients: string[] = hrAdmins.map((hr: any) => String(hr.email));

      // Add skip-level manager if known
      if (goal.skip_manager_id) {
        const skipResult = await db.execute(sql`
          SELECT email, first_name FROM admin_users WHERE id = ${String(goal.skip_manager_id)} AND is_active = true
        `);
        const skipMgr = skipResult.rows[0] as any;
        if (skipMgr?.email) escalationRecipients.push(String(skipMgr.email));
      }

      if (escalationRecipients.length > 0) {
        try {
          await sendPlanEscalationEmail({
            to: escalationRecipients,
            employeeName: empName,
            managerName: goal.mgr_first_name
              ? `${goal.mgr_first_name} ${goal.mgr_last_name ?? ""}`.trim()
              : "Unassigned",
            reason: `Goal "${goalTitle}" is ${daysOverdue} days overdue with no progress`,
            detail: `The goal was due on ${String(goal.target_date)} and has ${Number(goal.progress ?? 0)}% progress recorded. The employee's manager was notified on Day 3 — intervention may be needed.`,
            planType: planType as any,
          });
        } catch (e) {
          console.error(`[overdue_goals_sweep] Failed skip+HR escalation email for goal ${goal.id}:`, e);
        }
      }

      // In-app notification for HR users
      for (const hr of hrAdmins) {
        findings.push({
          userId: String(hr.id),
          type: "goal_overdue_hr_escalation",
          title: `Escalation: ${empName}'s goal ${daysOverdue}d overdue`,
          message: `"${goalTitle}" has no progress update after ${daysOverdue} days. Manager notified on Day 3 — further intervention may be needed.`,
          metadata: { goalId: String(goal.id), employeeId: String(goal.employee_id), targetDate: String(goal.target_date), daysOverdue },
        });
      }

      // Mark skip-level escalation sent (separate dedup column)
      await db.execute(sql`
        UPDATE performance_goals SET skip_escalated_at = NOW() WHERE id = ${String(goal.id)}
      `);
      console.log(`[overdue_goals_sweep] Skip+HR escalated for goal ${goal.id} (${daysOverdue}d overdue)`);
    }
  }

  return findings;
});
