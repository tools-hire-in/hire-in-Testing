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
import { buildCoachingPromptPayload } from "./contextualNotifications";
import { notifyUser } from "./notifications";

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
  const { getFeatureFlag, getAllFeatureFlags } = await import("./featureFlags");
  if (!(await getFeatureFlag("notifications_enabled"))) {
    console.log("[complianceSweep] Skipped — notifications_enabled is off");
    return;
  }

  const flags = await getAllFeatureFlags();
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
// Contextual digest sent to HR/admin: lists every overdue check-in by name,
// plan type, and days overdue — both in-app and via SendGrid email.
// Distinct from the per-employee governance escalation path.
registerCollector("checkin_overdue_digest", async (_flags) => {
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - 3);
  const thresholdStr = thresholdDate.toISOString().split("T")[0];
  const todayMs = Date.now();

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
      SELECT id, email, first_name, last_name FROM admin_users
      WHERE role IN ('hr', 'admin', 'super_admin') AND is_active = true AND deleted_at IS NULL
    `)
  ).rows as any[];

  const portalBase = getPortalBaseUrl();

  // Build a contextual line per overdue check-in showing who, what, and how late
  const display = overdueRows.slice(0, 20).map((r: any) => {
    const daysLate = Math.floor(
      (todayMs - new Date(String(r.scheduled_date) + "T12:00:00Z").getTime()) / 86400000
    );
    const planLabel = String(r.plan_type).replace(/_/g, " ");
    const ciLabel = String(r.check_in_type).replace(/_/g, " ");
    return {
      employeeName: String(r.employee_name),
      planType: planLabel,
      checkInType: ciLabel,
      scheduledDate: String(r.scheduled_date),
      daysLate,
      line: `— ${r.employee_name}: ${ciLabel} (${planLabel}) — ${daysLate} day${daysLate !== 1 ? "s" : ""} overdue`,
    };
  });

  const lineList = display.map(d => d.line).join("\n");
  const truncNote = overdueRows.length > 20 ? `\n…and ${overdueRows.length - 20} more.` : "";

  const digestMsg =
    `${overdueRows.length} check-in${overdueRows.length !== 1 ? "s" : ""} are 3+ days overdue:\n${lineList}${truncNote}`;

  const emailHtml = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#1F3A6E">Overdue Check-ins — ${overdueRows.length} Pending</h2>
  <p>${overdueRows.length} active-plan check-in${overdueRows.length !== 1 ? "s are" : " is"} 3+ days overdue:</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    <thead>
      <tr style="background:#1F3A6E;color:#fff">
        <th style="padding:8px;text-align:left">Employee</th>
        <th style="padding:8px;text-align:left">Check-in type</th>
        <th style="padding:8px;text-align:left">Plan</th>
        <th style="padding:8px;text-align:right">Days overdue</th>
      </tr>
    </thead>
    <tbody>
      ${display.map((d, i) => `
      <tr style="background:${i % 2 === 0 ? "#f9f9f9" : "#fff"}">
        <td style="padding:8px">${d.employeeName}</td>
        <td style="padding:8px">${d.checkInType}</td>
        <td style="padding:8px">${d.planType}</td>
        <td style="padding:8px;text-align:right;color:${d.daysLate >= 7 ? "#c0392b" : "#e67e22"}">${d.daysLate}d</td>
      </tr>`).join("")}
    </tbody>
  </table>
  ${overdueRows.length > 20 ? `<p style="color:#999">…and ${overdueRows.length - 20} more.</p>` : ""}
  <p><a href="${portalBase}/admin/hr/my-team?tab=checkins" style="color:#F47C20">→ View All Check-ins</a></p>
</div>`.trim();

  const sharedMetadata = {
    overdueCount: overdueRows.length,
    items: display.map(d => ({
      employeeName: d.employeeName,
      scheduledDate: d.scheduledDate,
      planType: d.planType,
      checkInType: d.checkInType,
      daysLate: d.daysLate,
    })),
  };

  console.log(
    `[complianceSweep] checkin_overdue_digest: ${overdueRows.length} overdue → ${hrAdmins.length} HR/admin users notified`
  );

  // Route email blast through blast-queue for admin review when >= threshold.
  // In-app notifications are always sent directly (per-user, no blast gating).
  const blastRecipients = hrAdmins
    .filter((hr: any) => !!hr.email)
    .map((hr: any) => ({
      userId: String(hr.id),
      name: [hr.first_name, hr.last_name].filter(Boolean).join(" ") || String(hr.email),
      email: String(hr.email),
    }));

  const blastSubject = `Overdue check-ins: ${overdueRows.length} pending — action needed`;

  const { queueBlast } = await import("./blastQueue");
  const blastResult = await queueBlast({
    triggerSource: "checkin_overdue_digest",
    subject: blastSubject,
    bodyHtml: emailHtml,
    recipients: blastRecipients,
  });

  for (const hr of hrAdmins) {
    // Always dispatch in-app notification (no email if blast was queued for review)
    await notifyUser({
      userId: String(hr.id),
      type: "checkin_overdue_digest",
      title: `Overdue check-ins: ${overdueRows.length} pending`,
      message: digestMsg,
      metadata: sharedMetadata,
      ...(blastResult.queued ? {} : {
        email: {
          subject: blastSubject,
          html: emailHtml,
          configType: "checkin_overdue_digest",
          sourceJob: "compliance_sweep",
        },
      }),
    });
  }

  if (blastResult.queued) {
    console.log(`[complianceSweep] checkin_overdue_digest: emailed queued as blast ${blastResult.blastId} (${blastResult.recipientCount} recipients pending review)`);
  } else {
    console.log(`[complianceSweep] checkin_overdue_digest: sent directly to ${hrAdmins.length} HR/admin (below blast threshold)`);
  }

  // Return [] — notifications already dispatched above via notifyUser
  return [];
});

// ─── Built-in collector: PIP / plan coaching entry prompt (manager) ──────────
// When a manager hasn't logged a coaching note for an active plan in ≥ 5 days,
// send a contextual prompt listing the employee's current goal status.
// Deduped: one nudge per plan per day via system_settings marker.
registerCollector("pip_coaching_prompt", async (_flags) => {
  const THRESHOLD_DAYS = 5;
  const nowMs = Date.now();
  const todayStr = new Date().toISOString().slice(0, 10);

  // Find active plans where the plan has a manager and the most recent
  // coaching log entry is older than THRESHOLD_DAYS (or no entry exists).
  const planRows = (await db.execute(sql`
    SELECT ep.id AS plan_id, ep.employee_id, ep.manager_id, ep.plan_type,
           ep.start_date, ep.end_date,
           emp.first_name || ' ' || emp.last_name AS employee_name,
           MAX(cle.created_at) AS last_note_at
    FROM employee_plans ep
    JOIN admin_users emp ON emp.id = ep.employee_id
    LEFT JOIN coaching_log_entries cle ON cle.plan_id = ep.id
    WHERE ep.status = 'active'
      AND ep.manager_id IS NOT NULL
    GROUP BY ep.id, ep.employee_id, ep.manager_id, ep.plan_type,
             ep.start_date, ep.end_date, employee_name
    HAVING MAX(cle.created_at) IS NULL
        OR MAX(cle.created_at) < NOW() - INTERVAL '5 days'
    ORDER BY ep.updated_at ASC
    LIMIT 50
  `)).rows as any[];

  let dispatched = 0;

  for (const row of planRows) {
    // Dedup: only one prompt per plan per calendar day
    const dedupKey = `coaching_prompt_${String(row.plan_id)}_${todayStr}`;
    const alreadySent = await storage.getSystemSetting(dedupKey);
    if (alreadySent) continue;

    const daysSince = row.last_note_at
      ? Math.floor((nowMs - new Date(row.last_note_at).getTime()) / 86400000)
      : 999;

    if (daysSince < THRESHOLD_DAYS) continue;

    try {
      const payload = await buildCoachingPromptPayload(
        { id: String(row.plan_id), plan_type: String(row.plan_type), employee_id: String(row.employee_id) },
        String(row.manager_id),
        String(row.employee_name),
        daysSince === 999 ? THRESHOLD_DAYS : daysSince,
      );

      // Dispatch directly via notifyUser so both in-app AND SendGrid email are sent
      await notifyUser({
        userId: String(row.manager_id),
        type: "pip_coaching_prompt_contextual",
        title: payload.inAppTitle,
        message: payload.inAppMessage,
        metadata: payload.metadata,
        email: {
          subject: payload.emailSubject,
          html: payload.emailHtml,
          configType: "pip_coaching_prompt_contextual",
          sourceJob: "compliance_sweep",
        },
      });

      // Mark as sent for today so the sweep doesn't re-fire
      await storage.upsertSystemSetting(dedupKey, new Date().toISOString());
      dispatched++;
    } catch (err) {
      console.error(`[complianceSweep] coaching prompt build/dispatch failed for plan ${row.plan_id}:`, err);
    }
  }

  console.log(`[complianceSweep] pip_coaching_prompt: ${dispatched} manager nudges dispatched`);
  // Return [] — notifications already dispatched above via notifyUser
  return [];
});

// ─── REMOVED: manager_coaching_obligation_sweep ───────────────────────────────
// Previously dispatched direct notifyUser calls for overdue manager coaching
// obligations, bypassing the shared applyEscalation() state machine.
// Replaced by collectOverdueItems() section 4) which feeds these findings
// through the standard governance escalation pipeline (same audit semantics,
// 20-hour dedup guard, governance_events log, escalation_level ladder).
// The block below is intentionally commented out so it is no longer registered.
/* REMOVED registerCollector("manager_coaching_obligation_sweep", async (_flags) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const portalBase = getPortalBaseUrl();

  // Find overdue manager_coaching_obligation controls whose due_date has passed
  // and that have not yet been escalated today.
  const overdueControls = (await db.execute(sql`
    SELECT
      gc.id AS control_id,
      gc.owner_id AS manager_id,
      gc.required_action,
      gc.due_date,
      gc.reference_id,
      au.first_name || ' ' || au.last_name AS manager_name,
      au.manager_id AS skip_manager_id
    FROM governance_controls gc
    JOIN admin_users au ON au.id = gc.owner_id
    WHERE gc.control_type::text = 'manager_coaching_obligation'
      AND gc.status IN ('pending', 'overdue')
      AND gc.due_date IS NOT NULL
      AND gc.due_date::date <= ${todayStr}::date
      AND au.is_active = true
      AND au.deleted_at IS NULL
    ORDER BY gc.due_date ASC
    LIMIT 50
  `)).rows as any[];

  let dispatched = 0;

  for (const ctrl of overdueControls) {
    const dedupKey = `mgr_coaching_nudge_${String(ctrl.control_id)}_${todayStr}`;
    const alreadySent = await storage.getSystemSetting(dedupKey).catch(() => null);
    if (alreadySent) continue;

    const daysOverdue = Math.max(0, Math.floor(
      (Date.now() - new Date(String(ctrl.due_date) + "T00:00:00Z").getTime()) / 86400000
    ));

    const planRef = String(ctrl.reference_id ?? "").replace("mgr_pip:", "");
    const inAppMsg = `Coaching note required: ${daysOverdue > 0 ? `${daysOverdue} day${daysOverdue !== 1 ? "s" : ""} overdue — ` : ""}${String(ctrl.required_action ?? "Log a coaching entry for your PIP employee.")}`;

    try {
      // Direct nudge to the manager
      await notifyUser({
        userId: String(ctrl.manager_id),
        type: "manager_coaching_obligation_overdue" as any,
        title: "Coaching note overdue",
        message: inAppMsg,
        metadata: {
          controlId: String(ctrl.control_id),
          planRef,
          daysOverdue,
          ctaPath: `${portalBase}/admin/hr/my-team?tab=plans`,
        },
      });

      // Skip-level escalation: notify the manager's manager
      if (ctrl.skip_manager_id) {
        await notifyUser({
          userId: String(ctrl.skip_manager_id),
          type: "manager_coaching_obligation_overdue" as any,
          title: `Coaching obligation overdue for ${String(ctrl.manager_name)}`,
          message: `${String(ctrl.manager_name)} has a coaching note ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""} overdue for a PIP employee.`,
          metadata: {
            controlId: String(ctrl.control_id),
            managerId: String(ctrl.manager_id),
            managerName: String(ctrl.manager_name),
            daysOverdue,
            ctaPath: `${portalBase}/admin/hr/my-team?tab=plans`,
          },
        }).catch(console.error);
      }

      await storage.upsertSystemSetting(dedupKey, new Date().toISOString());
      dispatched++;
    } catch (err) {
      console.error(`[complianceSweep] manager_coaching_obligation_sweep failed for control ${ctrl.control_id}:`, err);
    }
  }

  console.log(`[complianceSweep] manager_coaching_obligation_sweep: ${dispatched} manager nudges dispatched`);
  return [];
}); */

// ─── Pure detector: collectOverdueItems ──────────────────────────────────────
/**
 * Detect all overdue governance obligations for goals, SOP acknowledgements,
 * and non-probation plan check-ins. Returns typed GovernanceFinding[].
 *
 * PURE READ — writes nothing, sends no notifications. All side-effects are
 * handled by governanceService.applyEscalation().
 */
export async function collectOverdueItems(): Promise<GovernanceFinding[]> {
  const { getFeatureFlag } = await import("./featureFlags");
  if (!(await getFeatureFlag("notifications_enabled"))) return [];

  // Read DB-backed governance cadence settings (fall back to hardcoded defaults)
  let goalCoachingThresholdDays = 5;
  let sopGraceDays = 15;
  let nudgeSweepEnabled = true;
  try {
    const [threshSetting, sopGraceSetting, nudgeSetting] = await Promise.all([
      storage.getSystemSetting("governance_goal_coaching_threshold_days"),
      storage.getSystemSetting("governance_sop_grace_days"),
      storage.getSystemSetting("governance_nudge_sweep_enabled"),
    ]);
    const threshVal = threshSetting?.value !== undefined ? parseInt(String(threshSetting.value), 10) : NaN;
    if (!Number.isNaN(threshVal) && threshVal >= 0) goalCoachingThresholdDays = threshVal;
    const sopGraceVal = sopGraceSetting?.value !== undefined ? parseInt(String(sopGraceSetting.value), 10) : NaN;
    if (!Number.isNaN(sopGraceVal) && sopGraceVal > 0) sopGraceDays = sopGraceVal;
    if (nudgeSetting?.value !== undefined) nudgeSweepEnabled = String(nudgeSetting.value) !== "false";
  } catch { /* use defaults */ }

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
    if (daysOverdue < goalCoachingThresholdDays) continue;

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
  // Grace period: sopGraceDays after the employee's timer_started_at (DB-configurable).
  // Deferred/queued SOPs get a full grace window from when their clock actually starts,
  // not from the wave operational_at date. Uses deadline_at when explicitly set; otherwise
  // COALESCE(timer_started_at, operational_at) + grace as the deadline anchor.
  // Gated by governance_nudge_sweep_enabled setting.
  if (!nudgeSweepEnabled) {
    console.log("[complianceSweep] collectOverdueItems: SOP nudge sweep disabled by governance_nudge_sweep_enabled setting");
  }
  const sopRows = nudgeSweepEnabled
    ? (await db.execute(sql`
        SELECT
          sep.id AS progress_id,
          sep.user_id,
          sep.sop_master_id,
          au.first_name || ' ' || au.last_name AS user_name,
          au.email AS user_email,
          au.manager_id,
          m.first_name AS mgr_first_name, m.email AS mgr_email,
          m.manager_id AS skip_manager_id,
          COALESCE(
            sep.deadline_at::date,
            COALESCE(sep.timer_started_at, ws.operational_at)::date + (${sopGraceDays} * INTERVAL '1 day')
          )::date AS effective_deadline
        FROM sop_employee_progress sep
        JOIN wave_sops ws ON ws.sop_master_id = sep.sop_master_id
        JOIN admin_users au ON au.id = sep.user_id
        LEFT JOIN admin_users m ON m.id = au.manager_id
        WHERE sep.acknowledged_at IS NULL
          AND sep.timer_started_at IS NOT NULL
          AND ws.operational_at IS NOT NULL
          AND COALESCE(
            sep.deadline_at,
            COALESCE(sep.timer_started_at, ws.operational_at) + (${sopGraceDays} * INTERVAL '1 day')
          ) < NOW()
          AND au.is_active = true
          AND au.deleted_at IS NULL
        ORDER BY sep.user_id
      `)).rows as any[]
    : [];

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

  // ── 4) Overdue manager check-in facilitation obligations ──────────────────
  // Symmetric escalation for manager_checkin_obligation controls created in
  // syncGovernanceObligations (3 days after each employee check-in due date).
  // Feeds through the same applyEscalation pipeline as all other entity types.
  const mgrCheckinOverdueRows = (await db.execute(sql`
    SELECT
      gc.id AS control_id,
      gc.reference_id,
      gc.owner_id AS manager_id,
      gc.due_date,
      au.manager_id AS skip_manager_id,
      au.first_name || ' ' || au.last_name AS manager_name,
      au.email AS manager_email,
      sm.first_name AS skip_first_name,
      sm.email AS skip_email
    FROM governance_controls gc
    JOIN admin_users au ON au.id = gc.owner_id
    LEFT JOIN admin_users sm ON sm.id = au.manager_id
    WHERE gc.control_type::text = 'manager_checkin_obligation'
      AND gc.status NOT IN ('closed', 'completed')
      AND gc.due_date IS NOT NULL
      AND gc.due_date::date < ${todayStr}::date
      AND au.is_active = true
      AND au.deleted_at IS NULL
    ORDER BY gc.due_date ASC
    LIMIT 50
  `).catch(() => ({ rows: [] }))).rows as any[];

  for (const row of mgrCheckinOverdueRows) {
    const daysOverdue = Math.max(1, Math.floor(
      (Date.now() - new Date(String(row.due_date) + "T00:00:00Z").getTime()) / 86400000
    ));
    const entityId = String(row.reference_id ?? "").replace(/^mgr_ci:/, "");
    findings.push({
      entityType: "manager_checkin_obligation",
      entityId,
      employeeId: String(row.manager_id),
      managerId: row.skip_manager_id ? String(row.skip_manager_id) : null,
      skipManagerId: null,
      daysOverdue,
      ctaPath: `${portalBase}/admin/hr/my-team?tab=checkins`,
      entityTitle: "Manager check-in facilitation obligation",
      employeeName: row.manager_name ? String(row.manager_name) : undefined,
      employeeEmail: row.manager_email ? String(row.manager_email) : undefined,
      managerEmail: row.skip_email ? String(row.skip_email) : undefined,
      managerFirstName: row.skip_first_name ? String(row.skip_first_name) : undefined,
    });
  }

  // ── 5) Overdue manager coaching obligations ────────────────────────────────
  // Feeds manager_coaching_obligation controls through the same applyEscalation
  // pipeline as goal/SOP/checkin findings — symmetric escalation semantics,
  // shared audit trail, 20-hour dedup guard, governance_events audit log.
  // The "employee" in this context is the manager who owns the obligation;
  // the "manager" field is their skip-level so the ladder (L0=nudge owner,
  // L1=nudge skip) mirrors the standard goal/checkin ladder.
  const mgrCoachingOverdueRows = (await db.execute(sql`
    SELECT
      gc.id AS control_id,
      gc.reference_id,
      gc.owner_id AS manager_id,
      gc.due_date,
      au.manager_id AS skip_manager_id,
      au.first_name || ' ' || au.last_name AS manager_name,
      au.email AS manager_email,
      sm.first_name AS skip_first_name,
      sm.email AS skip_email
    FROM governance_controls gc
    JOIN admin_users au ON au.id = gc.owner_id
    LEFT JOIN admin_users sm ON sm.id = au.manager_id
    WHERE gc.control_type::text = 'manager_coaching_obligation'
      AND gc.status NOT IN ('closed', 'completed')
      AND gc.due_date IS NOT NULL
      AND gc.due_date::date < ${todayStr}::date
      AND au.is_active = true
      AND au.deleted_at IS NULL
    ORDER BY gc.due_date ASC
    LIMIT 50
  `).catch(() => ({ rows: [] }))).rows as any[];

  for (const row of mgrCoachingOverdueRows) {
    const daysOverdue = Math.max(1, Math.floor(
      (Date.now() - new Date(String(row.due_date) + "T00:00:00Z").getTime()) / 86400000
    ));
    // entityId = full reference_id (mgr_pip:... or mgr_ms:...) preserved so
    // referenceIdFor can return it directly without re-adding a prefix.
    const entityId = String(row.reference_id ?? "");
    findings.push({
      entityType: "manager_coaching_obligation",
      entityId,
      employeeId: String(row.manager_id),
      managerId: row.skip_manager_id ? String(row.skip_manager_id) : null,
      skipManagerId: null,
      daysOverdue,
      ctaPath: `${portalBase}/admin/hr/my-team?tab=plans`,
      entityTitle: "Manager coaching obligation",
      employeeName: row.manager_name ? String(row.manager_name) : undefined,
      employeeEmail: row.manager_email ? String(row.manager_email) : undefined,
      managerEmail: row.skip_email ? String(row.skip_email) : undefined,
      managerFirstName: row.skip_first_name ? String(row.skip_first_name) : undefined,
    });
  }

  console.log(
    `[complianceSweep] collectOverdueItems: ${findings.filter(f => f.entityType === "goal").length} goals, ` +
    `${findings.filter(f => f.entityType === "sop").length} SOPs, ` +
    `${findings.filter(f => f.entityType === "checkin").length} check-ins, ` +
    `${findings.filter(f => f.entityType === "manager_checkin_obligation").length} mgr-checkin, ` +
    `${findings.filter(f => f.entityType === "manager_coaching_obligation").length} mgr-coaching`
  );

  return findings;
}
