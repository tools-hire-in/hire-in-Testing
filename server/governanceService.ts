/**
 * Governance Service
 *
 * Core logic for creating, escalating, and closing governance control records.
 * All write operations go through here so that the escalation engine and the
 * route handlers stay thin. The notifyUser() gateway is used for all alerts
 * so per-user channel preferences are respected.
 */

import { db } from "./db";
import { sql } from "drizzle-orm";
import { notifyUser } from "./notifications";

export type GovernanceControlType = "goal" | "check_in" | "training" | "sop" | "probation" | "pip";
export type GovernanceControlStatus = "pending" | "in_progress" | "completed" | "overdue" | "escalated" | "closed" | "disputed";

export interface CreateControlOpts {
  controlType: GovernanceControlType;
  referenceId?: string | null;
  ownerId: string;
  managerId?: string | null;
  dueDate: string;
  requiredAction: string;
  evidenceRequired?: boolean;
}

/**
 * Insert a governance control record.
 * Idempotent by (control_type, reference_id, owner_id): returns the existing
 * record id when one already exists so hooks can call this safely on re-runs.
 */
export async function createGovernanceControl(opts: CreateControlOpts): Promise<string> {
  if (opts.referenceId) {
    const existing = await db.execute(sql`
      SELECT id FROM governance_controls
      WHERE control_type = ${opts.controlType}::governance_control_type
        AND reference_id = ${opts.referenceId}
        AND owner_id = ${opts.ownerId}
        AND status NOT IN ('closed', 'completed')
      LIMIT 1
    `);
    if (existing.rows.length > 0) {
      return (existing.rows[0] as any).id as string;
    }
  }

  const result = await db.execute(sql`
    INSERT INTO governance_controls
      (control_type, reference_id, owner_id, manager_id, due_date, required_action, evidence_required, status)
    VALUES
      (${opts.controlType}::governance_control_type,
       ${opts.referenceId ?? null},
       ${opts.ownerId},
       ${opts.managerId ?? null},
       ${opts.dueDate}::date,
       ${opts.requiredAction},
       ${opts.evidenceRequired ?? false},
       'pending'::governance_control_status)
    RETURNING id
  `);
  return (result.rows[0] as any).id as string;
}

/**
 * Escalation sweep — called daily by the scheduler.
 * Step 1 (past due date): mark status=overdue, notify manager.
 * Step 2 (past due + 48h): mark status=escalated, notify skip-level manager.
 *
 * Returns counts for logging.
 */
export async function runGovernanceEscalationSweep(): Promise<{ markedOverdue: number; escalated: number }> {
  const now = new Date();
  const nowIso = now.toISOString().slice(0, 10);

  // Escalation threshold is configurable. Read from system_settings key
  // `governance_escalation_hours`, fall back to env var, then default 48h.
  let escalationHours = parseInt(process.env.GOVERNANCE_ESCALATION_HOURS ?? "48", 10);
  try {
    const setting = await db.execute(sql`
      SELECT value FROM system_settings
      WHERE key = 'governance_escalation_hours' LIMIT 1
    `);
    if (setting.rows.length > 0) {
      const parsed = parseInt((setting.rows[0] as any).value, 10);
      if (!isNaN(parsed) && parsed > 0) escalationHours = parsed;
    }
  } catch { /* system_settings may not exist — use default */ }

  const thresholdMs = now.getTime() - escalationHours * 60 * 60 * 1000;
  const thresholdIso = new Date(thresholdMs).toISOString().slice(0, 10);

  let markedOverdue = 0;
  let escalated = 0;

  // Step 1: pending/in_progress past due date → overdue
  const overdueRows = await db.execute(sql`
    UPDATE governance_controls
    SET status = 'overdue'::governance_control_status,
        updated_at = NOW()
    WHERE status IN ('pending'::governance_control_status, 'in_progress'::governance_control_status)
      AND due_date < ${nowIso}::date
    RETURNING id, owner_id, manager_id, control_type, required_action, due_date
  `);
  markedOverdue = overdueRows.rows.length;

  for (const row of overdueRows.rows as any[]) {
    if (row.manager_id) {
      await notifyUser({
        userId: row.manager_id,
        type: "governance_overdue",
        title: "Action Required: Governance Obligation Overdue",
        message: `A ${formatControlType(row.control_type)} obligation for one of your team members is overdue (due ${row.due_date}). Please complete: ${row.required_action}`,
        metadata: { controlId: row.id, controlType: row.control_type, ownerId: row.owner_id, dueDate: row.due_date },
      }).catch(console.error);
    }
    await notifyUser({
      userId: row.owner_id,
      type: "governance_overdue_employee",
      title: "You have an overdue obligation",
      message: `Your ${formatControlType(row.control_type)} obligation was due on ${row.due_date} and is now marked overdue. Please take action: ${row.required_action}`,
      metadata: { controlId: row.id, controlType: row.control_type, dueDate: row.due_date },
    }).catch(console.error);
  }

  // Step 2: already overdue + past 48h → escalated, notify skip-level manager
  const escalatedRows = await db.execute(sql`
    UPDATE governance_controls
    SET status = 'escalated'::governance_control_status,
        escalation_level = escalation_level + 1,
        updated_at = NOW()
    WHERE status = 'overdue'::governance_control_status
      AND due_date < ${thresholdIso}::date
    RETURNING id, owner_id, manager_id, control_type, required_action, due_date, escalation_level
  `);
  escalated = escalatedRows.rows.length;

  for (const row of escalatedRows.rows as any[]) {
    const skipManager = row.manager_id ? await getSkipLevelManager(row.manager_id) : null;
    if (skipManager) {
      await notifyUser({
        userId: skipManager,
        type: "governance_escalated",
        title: "Governance Escalation — Skip-Level Action Required",
        message: `A ${formatControlType(row.control_type)} obligation has escalated (${row.due_date} — now escalation level ${row.escalation_level + 1}). The direct manager has not resolved it. Your attention is required.`,
        metadata: { controlId: row.id, controlType: row.control_type, managerId: row.manager_id, ownerId: row.owner_id, escalationLevel: row.escalation_level + 1 },
      }).catch(console.error);
    }
    if (row.manager_id) {
      await notifyUser({
        userId: row.manager_id,
        type: "governance_escalated_warning",
        title: "Governance Escalation Sent to Skip-Level",
        message: `The unresolved ${formatControlType(row.control_type)} obligation (due ${row.due_date}) has been escalated to your skip-level manager because it remains unresolved.`,
        metadata: { controlId: row.id, controlType: row.control_type, dueDate: row.due_date },
      }).catch(console.error);
    }
  }

  return { markedOverdue, escalated };
}

async function getSkipLevelManager(managerId: string): Promise<string | null> {
  const r = await db.execute(sql`
    SELECT manager_id FROM admin_users WHERE id = ${managerId} AND deleted_at IS NULL LIMIT 1
  `);
  return r.rows.length > 0 ? (r.rows[0] as any).manager_id ?? null : null;
}

/**
 * Close a governance control (manager action). Notifies the owner.
 */
export async function closeGovernanceControl(opts: {
  controlId: string;
  closedById: string;
  evidenceRecord?: string | null;
  resolution?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  const ctrl = await db.execute(sql`
    SELECT id, owner_id, control_type, status, evidence_required
    FROM governance_controls
    WHERE id = ${opts.controlId}
    LIMIT 1
  `);
  if (ctrl.rows.length === 0) return { success: false, error: "not_found" };
  const c = ctrl.rows[0] as any;
  if (c.status === "closed") return { success: false, error: "already_closed" };

  // Server-side enforcement: if evidence is required, reject closure without it.
  if (c.evidence_required && !opts.evidenceRecord?.trim()) {
    return { success: false, error: "evidence_required" };
  }

  await db.execute(sql`
    UPDATE governance_controls
    SET status = 'closed'::governance_control_status,
        closure_date = NOW()::date,
        closed_by_id = ${opts.closedById},
        evidence_record = ${opts.evidenceRecord ?? null},
        resolution = ${opts.resolution ?? null},
        updated_at = NOW()
    WHERE id = ${opts.controlId}
  `);

  await notifyUser({
    userId: c.owner_id,
    type: "governance_closed",
    title: "Governance Obligation Closed",
    message: `Your ${formatControlType(c.control_type)} obligation has been marked as closed by your manager.`,
    metadata: { controlId: opts.controlId, closedById: opts.closedById },
  }).catch(console.error);

  return { success: true };
}

/**
 * Submit evidence for an employee's own governance control obligation.
 */
export async function submitEmployeeEvidence(opts: {
  controlId: string;
  userId: string;
  evidenceRecord: string;
}): Promise<{ success: boolean; error?: string }> {
  const ctrl = await db.execute(sql`
    SELECT id, owner_id, status FROM governance_controls
    WHERE id = ${opts.controlId} AND owner_id = ${opts.userId}
    LIMIT 1
  `);
  if (ctrl.rows.length === 0) return { success: false, error: "not_found" };
  const c = ctrl.rows[0] as any;
  if (c.status === "closed") return { success: false, error: "already_closed" };

  await db.execute(sql`
    UPDATE governance_controls
    SET evidence_record = ${opts.evidenceRecord},
        status = 'in_progress'::governance_control_status,
        updated_at = NOW()
    WHERE id = ${opts.controlId}
  `);
  return { success: true };
}

/**
 * Flag a governance control as disputed by the employee.
 * Deliberately does NOT change the operational status so the escalation chain
 * continues unimpeded (pending → overdue → escalated). Only the dispute metadata
 * and flagged_for_hr_review flag are updated, triggering HR review.
 */
export async function disputeGovernanceControl(opts: {
  controlId: string;
  userId: string;
  disputeNote: string;
}): Promise<{ success: boolean; error?: string }> {
  const ctrl = await db.execute(sql`
    SELECT id, owner_id, status FROM governance_controls
    WHERE id = ${opts.controlId} AND owner_id = ${opts.userId}
    LIMIT 1
  `);
  if (ctrl.rows.length === 0) return { success: false, error: "not_found" };
  const c = ctrl.rows[0] as any;
  if (c.status === "closed") return { success: false, error: "already_closed" };

  // Keep status unchanged — escalation sweep must still be able to advance it.
  await db.execute(sql`
    UPDATE governance_controls
    SET dispute_note = ${opts.disputeNote},
        disputed_at = NOW(),
        flagged_for_hr_review = true,
        updated_at = NOW()
    WHERE id = ${opts.controlId}
  `);
  return { success: true };
}

/**
 * Get all open governance controls for a manager's team view.
 */
export async function getManagerGovernanceControls(managerId: string): Promise<any[]> {
  const rows = await db.execute(sql`
    SELECT gc.*,
           o.first_name || ' ' || o.last_name AS owner_name,
           o.employee_id AS owner_employee_id,
           o.designation AS owner_designation
    FROM governance_controls gc
    JOIN admin_users o ON o.id = gc.owner_id
    WHERE gc.manager_id = ${managerId}
      AND gc.status NOT IN ('closed', 'completed')
    ORDER BY gc.due_date ASC, gc.escalation_level DESC
  `);
  return rows.rows;
}

/**
 * Get all open governance controls for an employee's own view.
 */
export async function getEmployeeGovernanceControls(userId: string): Promise<any[]> {
  const rows = await db.execute(sql`
    SELECT gc.*,
           m.first_name || ' ' || m.last_name AS manager_name
    FROM governance_controls gc
    LEFT JOIN admin_users m ON m.id = gc.manager_id
    WHERE gc.owner_id = ${userId}
      AND gc.status NOT IN ('closed', 'completed')
    ORDER BY gc.due_date ASC
  `);
  return rows.rows;
}

/**
 * Build anonymized data for CEO exception report.
 * Returns only control metadata — no names, emails, or salary figures.
 */
export interface CeoReportExceptionCategory {
  label: string;
  description: string;
  count: number;
  departments: string[];
  maxEscalationLevel: number;
}

export async function buildCeoReportData(): Promise<{
  totalOpen: number;
  totalOverdue: number;
  totalEscalated: number;
  byType: Record<string, { open: number; overdue: number; escalated: number }>;
  exceptionCategories: CeoReportExceptionCategory[];
  highPriority: Array<{
    controlType: string;
    roleCategory: string;
    department: string;
    daysOverdue: number;
    escalationLevel: number;
    status: string;
    requiredAction: string;
  }>;
}> {
  const rows = await db.execute(sql`
    SELECT gc.control_type, gc.status, gc.due_date, gc.escalation_level,
           gc.required_action,
           o.role, o.designation,
           d.name AS department_name
    FROM governance_controls gc
    JOIN admin_users o ON o.id = gc.owner_id
    LEFT JOIN departments d ON d.id = o.department_id
    WHERE gc.status NOT IN ('closed', 'completed')
    ORDER BY gc.escalation_level DESC, gc.due_date ASC
  `);

  const controls = rows.rows as any[];
  const { buildAnonymizedControlSummary, mapRoleToCategory } = await import("./services/aiPrivacyGuard");

  let totalOpen = 0, totalOverdue = 0, totalEscalated = 0;
  const byType: Record<string, { open: number; overdue: number; escalated: number }> = {};
  const highPriority: any[] = [];

  // Exception category accumulators — named categories the CEO report explicitly surfaces.
  // Each maps to a subset of control_type values so the report answers specific governance questions.
  const exceptionBuckets: Record<string, {
    label: string;
    description: string;
    types: string[];
    statuses: string[];
    count: number;
    depts: Set<string>;
    maxLevel: number;
  }> = {
    overdue_goals: {
      label: "Employees with Overdue Goal Reviews",
      description: "Goal review obligations that have passed their due date without completion.",
      types: ["goal"],
      statuses: ["overdue", "escalated"],
      count: 0, depts: new Set(), maxLevel: 0,
    },
    overdue_checkins: {
      label: "Managers with Overdue Check-Ins",
      description: "Manager check-in obligations that have passed their due date.",
      types: ["check_in"],
      statuses: ["overdue", "escalated"],
      count: 0, depts: new Set(), maxLevel: 0,
    },
    training_overdue: {
      label: "Training Completion Overdue",
      description: "Mandatory training or SOP acknowledgement obligations past their deadline.",
      types: ["training", "sop"],
      statuses: ["overdue", "escalated"],
      count: 0, depts: new Set(), maxLevel: 0,
    },
    probation_at_risk: {
      label: "Probation Milestones At Risk",
      description: "Probation milestone controls that are overdue or escalated, indicating at-risk new hires.",
      types: ["probation"],
      statuses: ["overdue", "escalated"],
      count: 0, depts: new Set(), maxLevel: 0,
    },
    pip_at_risk: {
      label: "PIP Checkpoints At Risk",
      description: "Performance Improvement Plan checkpoints that are overdue or escalated.",
      types: ["pip"],
      statuses: ["overdue", "escalated"],
      count: 0, depts: new Set(), maxLevel: 0,
    },
    escalated_any: {
      label: "All Escalated Obligations",
      description: "Any governance obligation that has been formally escalated (Level 1+).",
      types: ["goal", "check_in", "training", "sop", "probation", "pip"],
      statuses: ["escalated"],
      count: 0, depts: new Set(), maxLevel: 0,
    },
  };

  for (const c of controls) {
    totalOpen++;
    if (c.status === "overdue") totalOverdue++;
    if (c.status === "escalated") totalEscalated++;

    if (!byType[c.control_type]) byType[c.control_type] = { open: 0, overdue: 0, escalated: 0 };
    byType[c.control_type].open++;
    if (c.status === "overdue") byType[c.control_type].overdue++;
    if (c.status === "escalated") byType[c.control_type].escalated++;

    // Accumulate exception categories
    const dept = c.department_name ?? "Unknown";
    for (const bucket of Object.values(exceptionBuckets)) {
      if (bucket.types.includes(c.control_type) && bucket.statuses.includes(c.status)) {
        bucket.count++;
        bucket.depts.add(dept);
        if (c.escalation_level > bucket.maxLevel) bucket.maxLevel = c.escalation_level;
      }
    }

    if (c.status === "escalated" || c.escalation_level > 0) {
      highPriority.push(buildAnonymizedControlSummary({
        controlType: c.control_type,
        roleCategory: (mapRoleToCategory as any)(c.role),
        department: dept,
        dueDate: c.due_date,
        escalationLevel: c.escalation_level,
        status: c.status,
        requiredAction: c.required_action,
      }));
    }
  }

  // Materialise exception categories from the governance_controls loop (non-zero only)
  const exceptionCategories: CeoReportExceptionCategory[] = Object.values(exceptionBuckets)
    .filter(b => b.count > 0)
    .map(b => ({
      label: b.label,
      description: b.description,
      count: b.count,
      departments: Array.from(b.depts).sort(),
      maxEscalationLevel: b.maxLevel,
    }));

  // ── Additional exception dimensions requiring cross-table queries ──────────

  // 1. Employees without active goal controls — active employees who have NO
  //    open governance_control of type 'goal'. This surfaces the coverage gap.
  const noGoalRows = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt,
           array_agg(DISTINCT COALESCE(d.name, 'Unknown')) FILTER (WHERE d.name IS NOT NULL) AS depts
    FROM admin_users au
    LEFT JOIN departments d ON d.id = au.department_id
    WHERE au.is_active = true
      AND au.deleted_at IS NULL
      AND au.role NOT IN ('super_admin')
      AND NOT EXISTS (
        SELECT 1 FROM governance_controls gc
        WHERE gc.owner_id = au.id
          AND gc.control_type = 'goal'::governance_control_type
          AND gc.status NOT IN ('closed', 'completed')
      )
  `);
  const noGoalCount = Number((noGoalRows.rows[0] as any)?.cnt ?? 0);
  const noGoalDepts: string[] = (noGoalRows.rows[0] as any)?.depts ?? [];
  if (noGoalCount > 0) {
    exceptionCategories.push({
      label: "Employees without Active Goal Controls",
      description: `${noGoalCount} active employee(s) have no open goal-review governance control. This may indicate a tracking gap.`,
      count: noGoalCount,
      departments: noGoalDepts.sort(),
      maxEscalationLevel: 0,
    });
  }

  // 2. Repeated unresolved blockers — employees with 2 or more overdue/escalated
  //    controls, indicating systemic non-compliance rather than a one-off miss.
  const repeatRows = await db.execute(sql`
    SELECT COUNT(*) AS employee_count,
           array_agg(DISTINCT COALESCE(d.name, 'Unknown')) FILTER (WHERE d.name IS NOT NULL) AS depts,
           MAX(gc.escalation_level) AS max_level
    FROM (
      SELECT gc.owner_id, MAX(gc.escalation_level) AS escalation_level
      FROM governance_controls gc
      WHERE gc.status IN ('overdue', 'escalated')
      GROUP BY gc.owner_id
      HAVING COUNT(*) >= 2
    ) gc
    JOIN admin_users au ON au.id = gc.owner_id
    LEFT JOIN departments d ON d.id = au.department_id
  `);
  const repeatCount = Number((repeatRows.rows[0] as any)?.employee_count ?? 0);
  const repeatDepts: string[] = (repeatRows.rows[0] as any)?.depts ?? [];
  const repeatMaxLevel = Number((repeatRows.rows[0] as any)?.max_level ?? 0);
  if (repeatCount > 0) {
    exceptionCategories.push({
      label: "Repeated Unresolved Blockers",
      description: `${repeatCount} employee(s) have 2 or more overdue or escalated obligations — indicating a pattern of non-completion requiring escalation.`,
      count: repeatCount,
      departments: repeatDepts.sort(),
      maxEscalationLevel: repeatMaxLevel,
    });
  }

  return { totalOpen, totalOverdue, totalEscalated, byType, exceptionCategories, highPriority };
}

/**
 * Daily obligation sync — creates governance controls from ALL required live data sources.
 *
 * Uses a proactive 7-day lookahead window so controls exist BEFORE obligations
 * breach, giving owners and managers time to act. `createGovernanceControl`
 * is idempotent (ON CONFLICT by control_type + reference_id + owner_id) so
 * running this daily is safe.
 *
 * Sources (all 6 required categories):
 *   training   ← track_assignments due within 7 days or overdue (not completed/excepted)
 *   sop        ← sop_employee_progress with deadline_at within 7 days and unacknowledged
 *   check_in   ← weekly, pip_review, weekly_update check-ins scheduled within 7 days
 *   probation  ← milestone check-ins + active probation employee_plans
 *   pip        ← active pip employee_plans
 *   goal       ← performance_goals with target_date within 7 days or overdue
 */
export async function syncGovernanceObligations(): Promise<{
  training: number;
  sop: number;
  checkIn: number;
  probation: number;
  pip: number;
  goal: number;
}> {
  const today = new Date().toISOString().slice(0, 10);
  // Proactive 7-day lookahead: create controls when obligations are UPCOMING,
  // not just after they have breached. This gives owners time to act.
  const lookahead7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const counters = { training: 0, sop: 0, checkIn: 0, probation: 0, pip: 0, goal: 0 };

  // ── 1. Training: track_assignments due within 7 days or overdue ───────────
  const trainingRows = await db.execute(sql`
    SELECT ta.id AS ref_id,
           ta.user_id AS owner_id,
           au.manager_id,
           ta.due_date::text AS due_date
    FROM track_assignments ta
    JOIN admin_users au ON au.id = ta.user_id
    WHERE ta.status NOT IN ('completed', 'excepted')
      AND ta.due_date IS NOT NULL
      AND ta.due_date::date <= ${lookahead7}::date
      AND au.is_active = true
      AND au.deleted_at IS NULL
    LIMIT 200
  `);
  for (const r of trainingRows.rows as any[]) {
    await createGovernanceControl({
      controlType: "training",
      referenceId: `ta:${r.ref_id}`,
      ownerId: r.owner_id,
      managerId: r.manager_id ?? null,
      dueDate: r.due_date,
      requiredAction: "Complete assigned training track by the due date.",
      evidenceRequired: false,
    });
    counters.training++;
  }

  // ── 2. SOP acknowledgements: unacknowledged SOPs with deadline within 7 days ─
  const sopRows = await db.execute(sql`
    SELECT sep.id AS ref_id,
           sep.user_id AS owner_id,
           au.manager_id,
           sep.deadline_at::date::text AS due_date
    FROM sop_employee_progress sep
    JOIN admin_users au ON au.id = sep.user_id
    WHERE sep.acknowledged_at IS NULL
      AND sep.deadline_at IS NOT NULL
      AND sep.deadline_at::date <= ${lookahead7}::date
      AND au.is_active = true
      AND au.deleted_at IS NULL
    LIMIT 200
  `);
  for (const r of sopRows.rows as any[]) {
    await createGovernanceControl({
      controlType: "sop",
      referenceId: `sop:${r.ref_id}`,
      ownerId: r.owner_id,
      managerId: r.manager_id ?? null,
      dueDate: r.due_date ?? today,
      requiredAction: "Acknowledge the assigned SOP before the deadline.",
      evidenceRequired: false,
    });
    counters.sop++;
  }

  // ── 3. Weekly / PIP-review check-ins: scheduled within 7 days ────────────
  const weeklyRows = await db.execute(sql`
    SELECT ci.id AS ref_id,
           ci.employee_id AS owner_id,
           ci.manager_id,
           ci.scheduled_date::text AS due_date
    FROM check_ins ci
    WHERE ci.check_in_type IN ('weekly'::check_in_type, 'pip_review'::check_in_type, 'weekly_update'::check_in_type)
      AND ci.status = 'scheduled'::check_in_status
      AND ci.scheduled_date IS NOT NULL
      AND ci.scheduled_date <= ${lookahead7}::date
    LIMIT 200
  `);
  for (const r of weeklyRows.rows as any[]) {
    await createGovernanceControl({
      controlType: "check_in",
      referenceId: `ci:${r.ref_id}`,
      ownerId: r.owner_id,
      managerId: r.manager_id ?? null,
      dueDate: r.due_date,
      requiredAction: "Complete the scheduled check-in by the due date.",
      evidenceRequired: false,
    });
    counters.checkIn++;
  }

  // ── 4a. Probation milestone check-ins: due within 7 days ─────────────────
  const milestoneRows = await db.execute(sql`
    SELECT ci.id AS ref_id,
           ci.employee_id AS owner_id,
           ci.manager_id,
           ci.scheduled_date::text AS due_date
    FROM check_ins ci
    WHERE ci.check_in_type = 'milestone'::check_in_type
      AND ci.status = 'scheduled'::check_in_status
      AND ci.scheduled_date IS NOT NULL
      AND ci.scheduled_date <= ${lookahead7}::date
    LIMIT 200
  `);
  for (const r of milestoneRows.rows as any[]) {
    await createGovernanceControl({
      controlType: "probation",
      referenceId: `ci:${r.ref_id}`,
      ownerId: r.owner_id,
      managerId: r.manager_id ?? null,
      dueDate: r.due_date,
      requiredAction: "Complete the scheduled probation milestone review.",
      evidenceRequired: false,
    });
    counters.probation++;
  }

  // ── 4b. Probation plans: one control per active probation plan ────────────
  const probationPlanRows = await db.execute(sql`
    SELECT ep.id AS ref_id,
           ep.employee_id AS owner_id,
           ep.manager_id,
           COALESCE(ep.end_date, ${today}) AS due_date
    FROM employee_plans ep
    WHERE ep.plan_type = 'probation'::employee_plan_type
      AND ep.status = 'active'::employee_plan_status
      AND ep.employee_id IS NOT NULL
    LIMIT 200
  `);
  for (const r of probationPlanRows.rows as any[]) {
    await createGovernanceControl({
      controlType: "probation",
      referenceId: `prob:${r.ref_id}`,
      ownerId: r.owner_id,
      managerId: r.manager_id ?? null,
      dueDate: r.due_date ?? today,
      requiredAction: "Complete all probation milestones and pass the confirmation review.",
      evidenceRequired: true,
    });
    counters.probation++;
  }

  // ── 5. PIP plans: one control per active PIP plan ────────────────────────
  const pipRows = await db.execute(sql`
    SELECT ep.id AS ref_id,
           ep.employee_id AS owner_id,
           ep.manager_id,
           COALESCE(ep.end_date, ${today}) AS due_date
    FROM employee_plans ep
    WHERE ep.plan_type = 'pip'::employee_plan_type
      AND ep.status = 'active'::employee_plan_status
      AND ep.employee_id IS NOT NULL
    LIMIT 200
  `);
  for (const r of pipRows.rows as any[]) {
    await createGovernanceControl({
      controlType: "pip",
      referenceId: `pip:${r.ref_id}`,
      ownerId: r.owner_id,
      managerId: r.manager_id ?? null,
      dueDate: r.due_date ?? today,
      requiredAction: "Meet all Performance Improvement Plan checkpoints by the end of the plan period.",
      evidenceRequired: true,
    });
    counters.pip++;
  }

  // ── 6. Goals: performance goals due within 7 days or overdue ─────────────
  const goalRows = await db.execute(sql`
    SELECT pg.id AS ref_id,
           pg.employee_id AS owner_id,
           au.manager_id,
           pg.target_date AS due_date
    FROM performance_goals pg
    JOIN admin_users au ON au.id = pg.employee_id
    WHERE pg.status NOT IN ('completed', 'cancelled')
      AND pg.target_date IS NOT NULL
      AND pg.target_date <= ${lookahead7}
      AND au.is_active = true
      AND au.deleted_at IS NULL
    LIMIT 200
  `);
  for (const r of goalRows.rows as any[]) {
    await createGovernanceControl({
      controlType: "goal",
      referenceId: `goal:${r.ref_id}`,
      ownerId: r.owner_id,
      managerId: r.manager_id ?? null,
      dueDate: r.due_date ?? today,
      requiredAction: "Complete or update the performance goal by its target date.",
      evidenceRequired: false,
    });
    counters.goal++;
  }

  return counters;
}

function formatControlType(t: string): string {
  const labels: Record<string, string> = {
    goal: "goal review",
    check_in: "check-in",
    training: "training completion",
    sop: "SOP acknowledgement",
    probation: "probation milestone",
    pip: "PIP checkpoint",
  };
  return labels[t] ?? t;
}
