/**
 * Compliance Sweep Engine
 *
 * After the governance centralization refactor, this file has two roles:
 *
 *   1. collectOverdueItems(db) — PURE DETECTOR used by governanceService.
 *      Returns GovernanceFinding[] for overdue goals, SOP acknowledgements,
 *      and non-probation plan check-ins. Writes nothing, sends no notifications.
 *
 *   2. registerCollector / runDailySweep — legacy dispatch infrastructure kept
 *      for the HR check-in digest (one summary notification per HR/admin user).
 *      This is the ONLY remaining collector; all governance escalations now
 *      route through governanceService.applyEscalation().
 *
 * BOUNDARY NOTE on SOP notifications:
 *   assignSopTraining()  → fires "sop_training_assigned" once on assignment (assignment event).
 *   collectOverdueItems() → returns GovernanceFinding for SOPs past the 15-day grace window
 *                          (escalation event, deduped via governance_events).
 *
 * @deprecated source-table timestamp columns (employee_nudged_at, last_escalated_at,
 * skip_escalated_at, manager_goal_escalated_at, overdue_nudge_sent_date,
 * overdue_reminded_on, milestone_escalated_at) are no longer written by this file.
 * They remain in schema for backward compatibility but are historical markers only.
 */

import { db } from "./db";
import { sql } from "drizzle-orm";
import { storage } from "./storage";
import type { GovernanceFinding } from "@shared/governanceTypes";
import { getPortalBaseUrl } from "./portalUrl";

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
 */
export function registerCollector(name: string, fn: CollectorFn): void {
  if (collectors.has(name)) {
    console.warn(`[complianceSweep] Collector "${name}" already registered — overwriting.`);
  }
  collectors.set(name, fn);
}

/**
 * Run all registered collectors, group every finding by userId, and dispatch
 * exactly ONE notification per user per run.
 *
 * After the governance refactor, this is ONLY called for the HR check-in digest
 * collector. Goal and SOP escalations go through governanceService.applyEscalation().
 */
export async function runDailySweep(): Promise<void> {
  const flags =
    ((await storage.getSystemSetting("feature_flags"))?.value as Record<string, boolean> | undefined) ?? {};

  if (!flags.notifications_enabled) {
    console.log("[complianceSweep] Skipped — notifications_enabled is off");
    return;
  }

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

  let dispatched = 0;
  for (const [userId, findings] of byUser) {
    if (findings.length === 0) continue;

    if (findings.length === 1) {
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

// ─── Built-in collector: check-in overdue digest (HR visibility) ──────────────
// Sends each HR/admin user a single in-app digest listing all check-ins that
// are 3+ days overdue across active plans. This is an HR VISIBILITY notification,
// distinct from the per-employee governance escalation path.
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

// ─── Pure detector: collectOverdueItems ──────────────────────────────────────
/**
 * Detect all overdue governance obligations for goals, SOP acknowledgements,
 * and non-probation plan check-ins. Returns typed GovernanceFinding[].
 *
 * PURE READ — writes nothing, sends no notifications. All side-effects are
 * handled by governanceService.applyEscalation().
 */
export async function collectOverdueItems(): Promise<GovernanceFinding[]> {
  const flags = (await storage.getSystemSetting("feature_flags"))?.value as Record<string, boolean> | undefined;
  if (!flags?.notifications_enabled) return [];

  const todayStr = new Date().toISOString().slice(0, 10);
  const portalBase = getPortalBaseUrl();
  const findings: GovernanceFinding[] = [];

  // ── 1) Overdue performance goals ──────────────────────────────────────────
  const goalRows = (await db.execute(sql`
    SELECT
      pg.id, pg.title, pg.progress, pg.target_date, pg.employee_id, pg.manager_id,
      pg.plan_id,
      ep.plan_type,
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
  `)).rows as any[];

  for (const goal of goalRows) {
    const targetDate = new Date(String(goal.target_date));
    const msPerDay = 86400000;
    const daysOverdue = Math.floor((Date.now() - targetDate.getTime()) / msPerDay);
    if (daysOverdue < 1) continue;

    const empName = `${goal.emp_first_name ?? ""} ${goal.emp_last_name ?? ""}`.trim() || "Employee";
    const planType = goal.plan_type ?? "probation";

    findings.push({
      entityType: "goal",
      entityId: String(goal.id),
      employeeId: String(goal.employee_id),
      managerId: goal.manager_id ? String(goal.manager_id) : null,
      skipManagerId: goal.skip_manager_id ? String(goal.skip_manager_id) : null,
      daysOverdue,
      ctaPath: `${portalBase}/admin/hr?tab=goals`,
      entityTitle: String(goal.title),
      employeeName: empName,
      employeeEmail: goal.emp_email ? String(goal.emp_email) : undefined,
      managerEmail: goal.mgr_email ? String(goal.mgr_email) : undefined,
      managerFirstName: goal.mgr_first_name ? String(goal.mgr_first_name) : undefined,
      planId: goal.plan_id ? String(goal.plan_id) : undefined,
      planType,
    });
  }

  // ── 2) Overdue SOP acknowledgements ───────────────────────────────────────
  // Grace period: 15 days after the SOP's wave operational_at date.
  // Uses deadline_at when set; falls back to wave_sops.operational_at + 15d.
  const sopRows = (await db.execute(sql`
    SELECT
      sep.id AS progress_id,
      sep.user_id,
      sep.sop_master_id,
      au.first_name || ' ' || au.last_name AS user_name,
      au.email AS user_email,
      au.manager_id,
      m.first_name AS mgr_first_name, m.email AS mgr_email,
      m.manager_id AS skip_manager_id,
      COALESCE(sep.deadline_at::date, ws.operational_at::date + INTERVAL '15 days')::date AS effective_deadline
    FROM sop_employee_progress sep
    JOIN wave_sops ws ON ws.sop_master_id = sep.sop_master_id
    JOIN admin_users au ON au.id = sep.user_id
    LEFT JOIN admin_users m ON m.id = au.manager_id
    WHERE sep.acknowledged_at IS NULL
      AND ws.operational_at IS NOT NULL
      AND ws.operational_at + INTERVAL '15 days' < NOW()
      AND au.is_active = true
      AND au.deleted_at IS NULL
    ORDER BY sep.user_id
  `)).rows as any[];

  for (const row of sopRows) {
    const deadline = new Date(String(row.effective_deadline));
    const daysOverdue = Math.floor((Date.now() - deadline.getTime()) / 86400000);
    if (daysOverdue < 1) continue;

    findings.push({
      entityType: "sop",
      entityId: String(row.progress_id),
      employeeId: String(row.user_id),
      managerId: row.manager_id ? String(row.manager_id) : null,
      skipManagerId: row.skip_manager_id ? String(row.skip_manager_id) : null,
      daysOverdue,
      ctaPath: `${portalBase}/admin/sops/my-sops`,
      entityTitle: "SOP acknowledgement",
      employeeName: String(row.user_name),
      employeeEmail: row.user_email ? String(row.user_email) : undefined,
      managerEmail: row.mgr_email ? String(row.mgr_email) : undefined,
      managerFirstName: row.mgr_first_name ? String(row.mgr_first_name) : undefined,
    });
  }

  // ── 3) Overdue non-probation plan check-ins ───────────────────────────────
  // Probation / PIP / growth check-ins are handled by probationEngine; here we
  // handle any scheduled check-ins that are not linked to active plans.
  const standaloneCheckInRows = (await db.execute(sql`
    SELECT ci.id, ci.employee_id, ci.manager_id, ci.scheduled_date, ci.check_in_type,
           au.first_name || ' ' || au.last_name AS employee_name,
           au.email AS employee_email,
           m.first_name AS mgr_first_name, m.email AS mgr_email,
           m.manager_id AS skip_manager_id
    FROM check_ins ci
    JOIN admin_users au ON ci.employee_id = au.id
    LEFT JOIN admin_users m ON ci.manager_id = m.id
    WHERE ci.check_in_type IN ('weekly', 'pip_review', 'weekly_update')
      AND ci.status = 'scheduled'
      AND ci.scheduled_date < ${todayStr}
      AND ci.plan_id IS NULL
    ORDER BY ci.scheduled_date ASC
  `)).rows as any[];

  for (const ci of standaloneCheckInRows) {
    const daysOverdue = Math.floor(
      (Date.now() - new Date(`${ci.scheduled_date}T00:00:00Z`).getTime()) / 86400000
    );
    if (daysOverdue < 1) continue;

    findings.push({
      entityType: "checkin",
      entityId: String(ci.id),
      employeeId: String(ci.employee_id),
      managerId: ci.manager_id ? String(ci.manager_id) : null,
      skipManagerId: ci.skip_manager_id ? String(ci.skip_manager_id) : null,
      daysOverdue,
      ctaPath: `${portalBase}/admin/hr/my-team?tab=checkins`,
      entityTitle: (ci.check_in_type as string).replace(/_/g, " "),
      employeeName: String(ci.employee_name),
      employeeEmail: ci.employee_email ? String(ci.employee_email) : undefined,
      managerEmail: ci.mgr_email ? String(ci.mgr_email) : undefined,
      managerFirstName: ci.mgr_first_name ? String(ci.mgr_first_name) : undefined,
    });
  }

  console.log(
    `[complianceSweep] collectOverdueItems: ${findings.filter(f => f.entityType === "goal").length} goals, ` +
    `${findings.filter(f => f.entityType === "sop").length} SOPs, ` +
    `${findings.filter(f => f.entityType === "checkin").length} check-ins`
  );

  return findings;
}
