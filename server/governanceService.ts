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
import { emitGovernanceEvent } from "./governanceEvents";

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

// ── Per-control-type escalation configuration ─────────────────────────────────
// Each entry configures the escalation behaviour for one control type.
// Override a field for a specific type via system_settings key:
//   governance_escalation_{type}_{field}
//   e.g. governance_escalation_pip_grace_hours = 24

export interface EscalationPolicy {
  controlType: GovernanceControlType;
  graceHours: number;
  firstEscalationHours: number;
  firstEscalationRecipient: "manager" | "hr";
  secondEscalationHours: number;
  secondEscalationRecipient: "skip_manager" | "hr";
  ceoReportThresholdLevel: number;
  disputePausesEscalation: boolean;
  approvedExceptionClosesControl: boolean;
  active: boolean;
}

export const DEFAULT_ESCALATION_POLICIES: Record<GovernanceControlType, EscalationPolicy> = {
  goal: {
    controlType: "goal",
    graceHours: 0,
    firstEscalationHours: 48,
    firstEscalationRecipient: "manager",
    secondEscalationHours: 120,
    secondEscalationRecipient: "skip_manager",
    ceoReportThresholdLevel: 1,
    disputePausesEscalation: false,
    approvedExceptionClosesControl: true,
    active: true,
  },
  training: {
    controlType: "training",
    graceHours: 0,
    firstEscalationHours: 48,
    firstEscalationRecipient: "manager",
    secondEscalationHours: 120,
    secondEscalationRecipient: "skip_manager",
    ceoReportThresholdLevel: 1,
    disputePausesEscalation: false,
    approvedExceptionClosesControl: true,
    active: true,
  },
  sop: {
    controlType: "sop",
    graceHours: 0,
    firstEscalationHours: 48,
    firstEscalationRecipient: "manager",
    secondEscalationHours: 96,
    secondEscalationRecipient: "hr",
    ceoReportThresholdLevel: 1,
    disputePausesEscalation: false,
    approvedExceptionClosesControl: true,
    active: true,
  },
  check_in: {
    controlType: "check_in",
    graceHours: 0,
    firstEscalationHours: 48,
    firstEscalationRecipient: "manager",
    secondEscalationHours: 120,
    secondEscalationRecipient: "skip_manager",
    ceoReportThresholdLevel: 1,
    disputePausesEscalation: false,
    approvedExceptionClosesControl: false,
    active: true,
  },
  probation: {
    controlType: "probation",
    graceHours: 0,
    firstEscalationHours: 24,
    firstEscalationRecipient: "hr",
    secondEscalationHours: 72,
    secondEscalationRecipient: "hr",
    ceoReportThresholdLevel: 1,
    disputePausesEscalation: false,
    approvedExceptionClosesControl: false,
    active: true,
  },
  pip: {
    controlType: "pip",
    graceHours: 0,
    firstEscalationHours: 24,
    firstEscalationRecipient: "hr",
    secondEscalationHours: 48,
    secondEscalationRecipient: "hr",
    ceoReportThresholdLevel: 0,
    disputePausesEscalation: false,
    approvedExceptionClosesControl: false,
    active: true,
  },
};

/**
 * Load per-type escalation policy, applying system_settings overrides.
 * Falls back to the static default if DB is unavailable.
 */
async function loadEscalationPolicy(controlType: GovernanceControlType): Promise<EscalationPolicy> {
  const base = { ...DEFAULT_ESCALATION_POLICIES[controlType] };
  try {
    const rows = await db.execute(sql`
      SELECT key, value FROM system_settings
      WHERE key LIKE ${"governance_escalation_" + controlType + "_%"}
    `);
    for (const row of rows.rows as any[]) {
      const field = (row.key as string).replace(`governance_escalation_${controlType}_`, "");
      const val = row.value;
      if (field === "grace_hours") base.graceHours = parseInt(val, 10) || base.graceHours;
      else if (field === "first_escalation_hours") base.firstEscalationHours = parseInt(val, 10) || base.firstEscalationHours;
      else if (field === "second_escalation_hours") base.secondEscalationHours = parseInt(val, 10) || base.secondEscalationHours;
      else if (field === "ceo_report_threshold_level") base.ceoReportThresholdLevel = parseInt(val, 10);
      else if (field === "dispute_pauses_escalation") base.disputePausesEscalation = val === "true";
      else if (field === "approved_exception_closes") base.approvedExceptionClosesControl = val === "true";
      else if (field === "active") base.active = val !== "false";
    }
  } catch { /* use static default */ }
  return base;
}

/**
 * Insert a governance control record.
 * Idempotent by (control_type, reference_id): returns the existing record id
 * when one already exists so hooks can call this safely on re-runs.
 * When reference_id is provided, ownership is preserved from the existing record
 * (owner is mutable, source obligation defines identity).
 */
export async function createGovernanceControl(opts: CreateControlOpts): Promise<string> {
  if (opts.referenceId) {
    const existing = await db.execute(sql`
      SELECT id FROM governance_controls
      WHERE control_type = ${opts.controlType}::governance_control_type
        AND reference_id = ${opts.referenceId}
        AND status NOT IN ('closed', 'completed')
      LIMIT 1
    `);
    if (existing.rows.length > 0) {
      const existingId = (existing.rows[0] as any).id as string;
      emitGovernanceEvent({
        controlId: existingId,
        eventType: "sync_updated",
        source: "sync",
        metadata: { controlType: opts.controlType, referenceId: opts.referenceId },
      }).catch(console.error);
      return existingId;
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
  const newId = (result.rows[0] as any).id as string;

  emitGovernanceEvent({
    controlId: newId,
    eventType: "created",
    source: "sync",
    actorRef: opts.referenceId ?? undefined,
    metadata: {
      controlType: opts.controlType,
      ownerId: opts.ownerId,
      managerId: opts.managerId ?? null,
      dueDate: opts.dueDate,
    },
  }).catch(console.error);

  return newId;
}

/**
 * Reassign a governance control to a new owner/manager without creating a
 * duplicate. Preserves evidence, dispute notes, and escalation history.
 * Emits a "reassigned" event for the audit trail.
 */
export async function reassignGovernanceControl(opts: {
  controlId: string;
  newOwnerId: string;
  newManagerId?: string | null;
  actorId: string;
  reason?: string;
}): Promise<{ success: boolean; error?: string }> {
  const ctrl = await db.execute(sql`
    SELECT id, owner_id, manager_id, status FROM governance_controls
    WHERE id = ${opts.controlId} LIMIT 1
  `);
  if (!ctrl.rows.length) return { success: false, error: "not_found" };
  const c = ctrl.rows[0] as any;
  if (["closed", "completed"].includes(c.status)) {
    return { success: false, error: "already_closed" };
  }

  await db.execute(sql`
    UPDATE governance_controls
    SET owner_id = ${opts.newOwnerId},
        manager_id = COALESCE(${opts.newManagerId ?? null}, manager_id),
        updated_at = NOW()
    WHERE id = ${opts.controlId}
  `);

  emitGovernanceEvent({
    controlId: opts.controlId,
    eventType: "reassigned",
    actorId: opts.actorId,
    source: "user",
    metadata: {
      prevOwnerId: c.owner_id,
      newOwnerId: opts.newOwnerId,
      prevManagerId: c.manager_id,
      newManagerId: opts.newManagerId ?? null,
      reason: opts.reason ?? null,
    },
  }).catch(console.error);

  return { success: true };
}

/**
 * Escalation sweep — called daily by the scheduler.
 * Uses per-control-type policies loaded from DEFAULT_ESCALATION_POLICIES
 * with system_settings overrides.
 *
 * Step 1 (past due date + grace): mark status=overdue, notify manager.
 * Step 2 (past firstEscalationHours): mark status=escalated, notify skip-level.
 *
 * Returns counts for logging.
 */
export async function runGovernanceEscalationSweep(): Promise<{ markedOverdue: number; escalated: number }> {
  const now = new Date();
  const nowIso = now.toISOString().slice(0, 10);

  let markedOverdue = 0;
  let escalated = 0;

  const controlTypes: GovernanceControlType[] = ["goal", "check_in", "training", "sop", "probation", "pip"];

  for (const controlType of controlTypes) {
    const policy = await loadEscalationPolicy(controlType);
    if (!policy.active) continue;

    const thresholdMs = now.getTime() - policy.firstEscalationHours * 60 * 60 * 1000;
    const thresholdIso = new Date(thresholdMs).toISOString().slice(0, 10);

    // Step 1: pending/in_progress past due date → overdue
    const overdueRows = await db.execute(sql`
      UPDATE governance_controls
      SET status = 'overdue'::governance_control_status,
          updated_at = NOW()
      WHERE control_type = ${controlType}::governance_control_type
        AND status IN ('pending'::governance_control_status, 'in_progress'::governance_control_status)
        AND due_date < ${nowIso}::date
      RETURNING id, owner_id, manager_id, control_type, required_action, due_date
    `);
    markedOverdue += overdueRows.rows.length;

    for (const row of overdueRows.rows as any[]) {
      emitGovernanceEvent({
        controlId: row.id,
        eventType: "status_changed",
        source: "scheduler",
        metadata: { from: "pending_or_in_progress", to: "overdue", controlType: row.control_type },
      }).catch(console.error);

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

    // Step 2: overdue + past firstEscalationHours → escalated
    const escalatedRows = await db.execute(sql`
      UPDATE governance_controls
      SET status = 'escalated'::governance_control_status,
          escalation_level = escalation_level + 1,
          updated_at = NOW()
      WHERE control_type = ${controlType}::governance_control_type
        AND status = 'overdue'::governance_control_status
        AND due_date < ${thresholdIso}::date
      RETURNING id, owner_id, manager_id, control_type, required_action, due_date, escalation_level
    `);
    escalated += escalatedRows.rows.length;

    for (const row of escalatedRows.rows as any[]) {
      emitGovernanceEvent({
        controlId: row.id,
        eventType: "escalated",
        source: "scheduler",
        metadata: { escalationLevel: row.escalation_level + 1, controlType: row.control_type, policy: policy.firstEscalationHours },
      }).catch(console.error);

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

  emitGovernanceEvent({
    controlId: opts.controlId,
    eventType: "closed",
    actorId: opts.closedById,
    source: "user",
    metadata: { prevStatus: c.status, resolution: opts.resolution ?? null },
  }).catch(console.error);

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

  emitGovernanceEvent({
    controlId: opts.controlId,
    eventType: "evidence_submitted",
    actorId: opts.userId,
    source: "user",
    metadata: { prevStatus: c.status },
  }).catch(console.error);

  return { success: true };
}

/**
 * Flag a governance control as disputed by the employee.
 * Deliberately does NOT change the operational status so the escalation chain
 * continues unimpeded. Only the dispute metadata and flagged_for_hr_review flag
 * are updated, triggering HR review.
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

  await db.execute(sql`
    UPDATE governance_controls
    SET dispute_note = ${opts.disputeNote},
        disputed_at = NOW(),
        flagged_for_hr_review = true,
        updated_at = NOW()
    WHERE id = ${opts.controlId}
  `);

  emitGovernanceEvent({
    controlId: opts.controlId,
    eventType: "disputed",
    actorId: opts.userId,
    source: "user",
    metadata: { operationalStatus: c.status },
  }).catch(console.error);

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
 *
 * Semantic corrections applied:
 *   A. "Missing goal control" is distinguished from "missing active source goal"
 *   B. "Overdue obligations" are distinguished from "explicit blockers" (disputed controls)
 *   C. Disputed / data-incomplete / approved-exception / confirmed counts are separately tracked
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
  totalDisputed: number;
  byType: Record<string, { open: number; overdue: number; escalated: number; disputed: number }>;
  exceptionCategories: CeoReportExceptionCategory[];
  highPriority: Array<{
    controlType: string;
    roleCategory: string;
    department: string;
    daysOverdue: number;
    escalationLevel: number;
    status: string;
  }>;
  semanticSummary: {
    employeesWithNoActiveGoalControl: number;
    employeesWithMultipleOverdueObligations: number;
    employeesWithExplicitBlockers: number;
    confirmedNonCompliance: number;
    disputedControls: number;
    approvedExceptions: number;
  };
}> {
  const rows = await db.execute(sql`
    SELECT gc.control_type, gc.status, gc.due_date, gc.escalation_level,
           gc.dispute_note, gc.exception_reason,
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

  let totalOpen = 0, totalOverdue = 0, totalEscalated = 0, totalDisputed = 0;
  const byType: Record<string, { open: number; overdue: number; escalated: number; disputed: number }> = {};
  const highPriority: any[] = [];

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
      description: "Probation milestone controls that are overdue or escalated.",
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
      description: "Any governance obligation formally escalated (Level 1+).",
      types: ["goal", "check_in", "training", "sop", "probation", "pip"],
      statuses: ["escalated"],
      count: 0, depts: new Set(), maxLevel: 0,
    },
    // C: Disputed controls — separate from confirmed noncompliance
    disputed_controls: {
      label: "Controls Under Dispute",
      description: "Employee-raised disputes pending HR review. These are NOT confirmed noncompliance.",
      types: ["goal", "check_in", "training", "sop", "probation", "pip"],
      statuses: ["overdue", "escalated", "in_progress", "pending"],
      count: 0, depts: new Set(), maxLevel: 0,
    },
  };

  for (const c of controls) {
    totalOpen++;
    if (c.status === "overdue") totalOverdue++;
    if (c.status === "escalated") totalEscalated++;
    if (c.dispute_note) totalDisputed++;

    if (!byType[c.control_type]) byType[c.control_type] = { open: 0, overdue: 0, escalated: 0, disputed: 0 };
    byType[c.control_type].open++;
    if (c.status === "overdue") byType[c.control_type].overdue++;
    if (c.status === "escalated") byType[c.control_type].escalated++;
    if (c.dispute_note) byType[c.control_type].disputed++;

    const dept = c.department_name ?? "Unknown";
    for (const [key, bucket] of Object.entries(exceptionBuckets)) {
      if (key === "disputed_controls") {
        // C: Only count controls that have a dispute_note (explicit blocker)
        if (c.dispute_note && bucket.types.includes(c.control_type)) {
          bucket.count++;
          bucket.depts.add(dept);
          if (c.escalation_level > bucket.maxLevel) bucket.maxLevel = c.escalation_level;
        }
      } else {
        if (bucket.types.includes(c.control_type) && bucket.statuses.includes(c.status)) {
          bucket.count++;
          bucket.depts.add(dept);
          if (c.escalation_level > bucket.maxLevel) bucket.maxLevel = c.escalation_level;
        }
      }
    }

    if (c.status === "escalated" || c.escalation_level > 0) {
      const summary = buildAnonymizedControlSummary({
        controlType: c.control_type,
        roleCategory: (mapRoleToCategory as any)(c.role),
        department: dept,
        dueDate: c.due_date,
        escalationLevel: c.escalation_level,
        status: c.status,
        requiredAction: "",
      });
      highPriority.push({
        controlType: summary.controlType,
        roleCategory: summary.roleCategory,
        department: summary.department,
        daysOverdue: summary.daysOverdue,
        escalationLevel: summary.escalationLevel,
        status: summary.status,
      });
    }
  }

  const exceptionCategories: CeoReportExceptionCategory[] = Object.values(exceptionBuckets)
    .filter(b => b.count > 0)
    .map(b => ({
      label: b.label,
      description: b.description,
      count: b.count,
      departments: Array.from(b.depts).sort(),
      maxEscalationLevel: b.maxLevel,
    }));

  // ── Semantic correction A: Separate "no goal control" from "no active source goal" ──
  // Sub-A1: active employees with NO open goal governance control (coverage gap)
  const noGoalControlRows = await db.execute(sql`
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
  const noGoalControlCount = Number((noGoalControlRows.rows[0] as any)?.cnt ?? 0);
  const noGoalControlDepts: string[] = (noGoalControlRows.rows[0] as any)?.depts ?? [];

  // Sub-A2: active goals in performance_goals that have NO corresponding governance control
  const goalWithoutControlRows = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt
    FROM performance_goals pg
    JOIN admin_users au ON au.id = pg.employee_id
    WHERE pg.status NOT IN ('completed','cancelled')
      AND au.is_active = true
      AND au.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM governance_controls gc
        WHERE gc.reference_id = 'goal:' || pg.id::text
          AND gc.status NOT IN ('closed','completed')
      )
  `);
  const goalWithoutControlCount = Number((goalWithoutControlRows.rows[0] as any)?.cnt ?? 0);

  if (noGoalControlCount > 0) {
    exceptionCategories.push({
      label: "Employees without Active Goal Controls",
      description: `${noGoalControlCount} active employee(s) have no open goal governance control. This indicates a governance tracking gap, not necessarily that the employee has no goals.`,
      count: noGoalControlCount,
      departments: noGoalControlDepts.sort(),
      maxEscalationLevel: 0,
    });
  }
  if (goalWithoutControlCount > 0) {
    exceptionCategories.push({
      label: "Active Goals Missing Governance Controls",
      description: `${goalWithoutControlCount} active performance goal(s) have no corresponding governance control record. The obligation exists but is not being tracked.`,
      count: goalWithoutControlCount,
      departments: [],
      maxEscalationLevel: 0,
    });
  }

  // ── Semantic correction B: Overdue obligations vs explicit blockers ───────────
  // B1: employees with 2+ overdue/escalated obligations (pattern of non-completion)
  const multipleOverdueRows = await db.execute(sql`
    SELECT COUNT(*) AS employee_count,
           array_agg(DISTINCT COALESCE(d.name, 'Unknown')) FILTER (WHERE d.name IS NOT NULL) AS depts,
           MAX(gc.escalation_level) AS max_level
    FROM (
      SELECT gc.owner_id, MAX(gc.escalation_level) AS escalation_level
      FROM governance_controls gc
      WHERE gc.status IN ('overdue', 'escalated')
        AND gc.dispute_note IS NULL
      GROUP BY gc.owner_id
      HAVING COUNT(*) >= 2
    ) gc
    JOIN admin_users au ON au.id = gc.owner_id
    LEFT JOIN departments d ON d.id = au.department_id
  `);
  const multipleOverdueCount = Number((multipleOverdueRows.rows[0] as any)?.employee_count ?? 0);
  const multipleOverdueDepts: string[] = (multipleOverdueRows.rows[0] as any)?.depts ?? [];
  const multipleOverdueMaxLevel = Number((multipleOverdueRows.rows[0] as any)?.max_level ?? 0);

  // B2: employees with explicit blockers (dispute_note set)
  const explicitBlockerRows = await db.execute(sql`
    SELECT COUNT(DISTINCT gc.owner_id)::int AS cnt
    FROM governance_controls gc
    WHERE gc.dispute_note IS NOT NULL
      AND gc.status NOT IN ('closed','completed')
  `);
  const explicitBlockerCount = Number((explicitBlockerRows.rows[0] as any)?.cnt ?? 0);

  if (multipleOverdueCount > 0) {
    exceptionCategories.push({
      label: "Multiple Overdue Obligations (Pattern)",
      description: `${multipleOverdueCount} employee(s) have 2 or more overdue or escalated obligations with no dispute raised — indicating a pattern of non-completion. Distinct from employee-reported blockers.`,
      count: multipleOverdueCount,
      departments: multipleOverdueDepts.sort(),
      maxEscalationLevel: multipleOverdueMaxLevel,
    });
  }

  // B3: approved exceptions
  const approvedExceptionRows = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt
    FROM governance_controls gc
    WHERE gc.exception_reason IS NOT NULL
      AND gc.status NOT IN ('closed','completed')
  `);
  const approvedExceptionCount = Number((approvedExceptionRows.rows[0] as any)?.cnt ?? 0);

  // ── Semantic summary (C: confirmed vs disputed) ───────────────────────────
  const confirmedNonCompliance = totalOverdue + totalEscalated - totalDisputed;

  return {
    totalOpen,
    totalOverdue,
    totalEscalated,
    totalDisputed,
    byType,
    exceptionCategories,
    highPriority,
    semanticSummary: {
      employeesWithNoActiveGoalControl: noGoalControlCount,
      employeesWithMultipleOverdueObligations: multipleOverdueCount,
      employeesWithExplicitBlockers: explicitBlockerCount,
      confirmedNonCompliance: Math.max(0, confirmedNonCompliance),
      disputedControls: totalDisputed,
      approvedExceptions: approvedExceptionCount,
    },
  };
}

/**
 * Daily obligation sync — creates governance controls from ALL required live data sources.
 *
 * Uses a proactive 7-day lookahead window so controls exist BEFORE obligations
 * breach, giving owners and managers time to act. `createGovernanceControl`
 * is idempotent (by control_type + reference_id) so running this daily is safe.
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
  const lookahead7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const counters = { training: 0, sop: 0, checkIn: 0, probation: 0, pip: 0, goal: 0 };

  // ── 1. Training ───────────────────────────────────────────────────────────
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

  // ── 2. SOP acknowledgements ───────────────────────────────────────────────
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

  // ── 3. Weekly / PIP-review check-ins ─────────────────────────────────────
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

  // ── 4a. Probation milestone check-ins ────────────────────────────────────
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

  // ── 4b. Probation plans ───────────────────────────────────────────────────
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

  // ── 5. PIP plans ──────────────────────────────────────────────────────────
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

  // ── 6. Goals ──────────────────────────────────────────────────────────────
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
