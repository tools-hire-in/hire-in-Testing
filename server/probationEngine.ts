/**
 * Probation Engine
 *
 * Pure detector: reads overdue probation / PIP / growth plan check-ins and
 * strike-threshold plans. Returns GovernanceFinding[] — writes nothing,
 * sends no notifications. All escalation side-effects are handled by
 * governanceService.applyEscalation().
 *
 * Also exports backfillProbationCadence() for the idempotent cadence-seeding
 * step (still a write operation, but not an escalation).
 */

import { db } from "./db";
import { sql } from "drizzle-orm";
import { storage } from "./storage";
import { PROBATION_CADENCE_DAYS, cadenceCheckInType, milestoneDayFor } from "@shared/probation";
import type { GovernanceFinding } from "@shared/governanceTypes";
import { getPortalBaseUrl } from "./portalUrl";

/**
 * Idempotent cadence backfill — inserts any missing cadence check-ins for
 * active probation plans. Pure insert-only; existing rows are untouched.
 * Safe to call on every sweep run.
 */
export async function backfillProbationCadence(): Promise<{ inserted: number }> {
  const activePlans = (await db.execute(sql`
    SELECT id, employee_id, manager_id, start_date, end_date
    FROM employee_plans
    WHERE plan_type = 'probation' AND status = 'active'
  `)).rows as any[];

  let inserted = 0;
  for (const plan of activePlans) {
    const startMs = new Date(`${plan.start_date}T00:00:00Z`).getTime();
    const endStr = plan.end_date as string | null;
    for (const day of PROBATION_CADENCE_DAYS) {
      const sched = new Date(startMs + day * 86400000).toISOString().split("T")[0];
      if (endStr && sched > endStr) continue;
      const ins = await db.execute(sql`
        INSERT INTO check_ins (employee_id, manager_id, plan_id, check_in_type, scheduled_date, status)
        SELECT ${plan.employee_id}, ${plan.manager_id}, ${plan.id}, ${cadenceCheckInType(day)}, ${sched}, 'scheduled'
        WHERE NOT EXISTS (
          SELECT 1 FROM check_ins WHERE plan_id = ${plan.id} AND scheduled_date = ${sched}
        )
        RETURNING id
      `);
      inserted += ins.rows.length;
    }
  }
  return { inserted };
}

/**
 * Collect governance findings for overdue probation / PIP / growth plan check-ins.
 * Returns one GovernanceFinding per overdue check-in (milestone or daily).
 * NO writes. NO notifications.
 */
export async function collectProbationMilestoneEvents(): Promise<GovernanceFinding[]> {
  const flags = (await storage.getSystemSetting("feature_flags"))?.value as Record<string, boolean> | undefined;
  if (!flags?.notifications_enabled) return [];

  const cfg = (await storage.getSystemSetting("probation_escalation"))?.value as
    | { milestoneEscalateAfterDays?: number; strikeThreshold?: number }
    | undefined;
  const milestoneEscalateAfterDays = Number(cfg?.milestoneEscalateAfterDays ?? 3);
  const strikeThreshold = Number(cfg?.strikeThreshold ?? 3);

  const todayStr = new Date().toISOString().split("T")[0];
  const daysBetween = (from: string) =>
    Math.floor((new Date(`${todayStr}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86400000);

  const portalBase = getPortalBaseUrl();

  // ── 1) Overdue check-ins (milestone + daily) ──────────────────────────────
  const overdueRows = (await db.execute(sql`
    SELECT ci.id, ci.employee_id, ci.manager_id, ci.plan_id, ci.check_in_type, ci.scheduled_date,
           ep.start_date, ep.plan_type,
           emp.first_name || ' ' || emp.last_name AS employee_name,
           emp.email AS employee_email,
           mgr.first_name AS mgr_first_name, mgr.email AS mgr_email,
           mgr.manager_id AS skip_manager_id
    FROM check_ins ci
    JOIN employee_plans ep ON ci.plan_id = ep.id
    JOIN admin_users emp ON ci.employee_id = emp.id
    LEFT JOIN admin_users mgr ON ci.manager_id = mgr.id
    WHERE ep.plan_type IN ('probation', 'growth', 'pip')
      AND ep.status = 'active'
      AND ci.status NOT IN ('completed', 'cancelled')
      AND ci.scheduled_date < ${todayStr}
    ORDER BY ci.scheduled_date ASC
  `)).rows as any[];

  const findings: GovernanceFinding[] = [];

  for (const ci of overdueRows) {
    if (!ci.manager_id) continue;
    const daysOverdue = Math.max(1, daysBetween(String(ci.scheduled_date)));
    const mDay = milestoneDayFor(String(ci.start_date), String(ci.scheduled_date));
    const isMilestone = mDay != null;
    const planType = String(ci.plan_type);

    const entityType = isMilestone ? "probation_milestone" as const : "checkin" as const;

    const ctaPath = ci.plan_id
      ? `${portalBase}/admin/hr/my-team?tab=checkins&planId=${ci.plan_id}`
      : `${portalBase}/admin/hr/my-team?tab=checkins`;

    findings.push({
      entityType,
      entityId: String(ci.id),
      employeeId: String(ci.employee_id),
      managerId: ci.manager_id ? String(ci.manager_id) : null,
      skipManagerId: ci.skip_manager_id ? String(ci.skip_manager_id) : null,
      daysOverdue,
      ctaPath,
      entityTitle: mDay != null ? `Day ${mDay} milestone check-in` : (ci.check_in_type as string).replace(/_/g, " "),
      employeeName: String(ci.employee_name),
      employeeEmail: ci.employee_email ? String(ci.employee_email) : undefined,
      managerEmail: ci.mgr_email ? String(ci.mgr_email) : undefined,
      managerFirstName: ci.mgr_first_name ? String(ci.mgr_first_name) : undefined,
      planId: ci.plan_id ? String(ci.plan_id) : undefined,
      planType,
      milestoneDay: mDay,
      milestoneEscalateAfterDays: isMilestone ? milestoneEscalateAfterDays : undefined,
    });
  }

  // ── 2) Strike-threshold plans (3+ overdue check-ins) ─────────────────────
  // Governance control state + the 20-hour notification_sent dedup in applyEscalation()
  // are the sole authority for preventing re-escalation. The legacy
  // ep.strike_escalated_at column is reconciled once at startup via
  // reconcileLegacyEscalationState() and must not gate live detection here.
  const strikePlans = (await db.execute(sql`
    SELECT ep.id, ep.employee_id, ep.manager_id, ep.plan_type,
           COUNT(ci.id) AS overdue_count,
           emp.first_name || ' ' || emp.last_name AS employee_name,
           emp.email AS employee_email,
           mgr.first_name AS mgr_first_name, mgr.email AS mgr_email,
           mgr.manager_id AS skip_manager_id
    FROM employee_plans ep
    JOIN check_ins ci ON ci.plan_id = ep.id
    JOIN admin_users emp ON ep.employee_id = emp.id
    LEFT JOIN admin_users mgr ON ep.manager_id = mgr.id
    WHERE ep.plan_type IN ('probation', 'growth', 'pip')
      AND ep.status = 'active'
      AND ci.status NOT IN ('completed', 'cancelled')
      AND ci.scheduled_date < ${todayStr}
    GROUP BY ep.id, ep.employee_id, ep.manager_id, ep.plan_type,
             emp.first_name, emp.last_name, emp.email,
             mgr.first_name, mgr.email, mgr.manager_id
    HAVING COUNT(ci.id) >= ${strikeThreshold}
  `)).rows as any[];

  const portalPeople = `${portalBase}/admin/hr/people`;

  for (const plan of strikePlans) {
    findings.push({
      entityType: "probation_strike",
      entityId: String(plan.id),
      employeeId: String(plan.employee_id),
      managerId: plan.manager_id ? String(plan.manager_id) : null,
      skipManagerId: plan.skip_manager_id ? String(plan.skip_manager_id) : null,
      daysOverdue: Number(plan.overdue_count),
      ctaPath: portalPeople,
      entityTitle: `${plan.plan_type} plan — ${plan.overdue_count} overdue check-ins`,
      employeeName: String(plan.employee_name),
      employeeEmail: plan.employee_email ? String(plan.employee_email) : undefined,
      managerEmail: plan.mgr_email ? String(plan.mgr_email) : undefined,
      managerFirstName: plan.mgr_first_name ? String(plan.mgr_first_name) : undefined,
      planId: String(plan.id),
      planType: String(plan.plan_type),
    });
  }

  return findings;
}
