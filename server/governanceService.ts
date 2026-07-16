/**
 * Governance Service
 *
 * Core logic for creating, escalating, and closing governance control records.
 * All write operations go through here so that the escalation engine and the
 * route handlers stay thin. The notifyUser() gateway is used for all alerts
 * so per-user channel preferences are respected.
 *
 * After the centralization refactor, this file is the SOLE WRITE AUTHORITY for
 * all governance state. applyEscalation() is the central method — every
 * escalation transition, every notification trigger flows through it.
 */

import { db } from "./db";
import { sql } from "drizzle-orm";
import { storage } from "./storage";
import { notifyUser } from "./notifications";
import { emitGovernanceEvent } from "./governanceEvents";
import { buildSopNudgePayload } from "./contextualNotifications";
import type { GovernanceFinding, GovernanceRunResult } from "@shared/governanceTypes";

export type GovernanceControlType = "goal" | "check_in" | "training" | "sop" | "probation" | "pip" | "manager_checkin_obligation" | "manager_coaching_obligation";
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
      WHERE control_type::text = ${opts.controlType}
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
      (${opts.controlType}::text::governance_control_type,
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
  managerObligations: number;
}> {
  const today = new Date().toISOString().slice(0, 10);
  const lookahead7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const counters = { training: 0, sop: 0, checkIn: 0, probation: 0, pip: 0, goal: 0, managerObligations: 0 };

  // ── SOP concurrent timer ceiling + mass-lockout circuit breaker ────────────
  // MAX_CONCURRENT_TIMERS: how many SOPs each employee can have actively "on the
  // clock" at the same time. Excess SOPs are queued in sop_timer_queue.
  // MAX_LOCKOUT_PCT: if more than this % of active employees currently have at
  // least one EXPIRED-and-unacknowledged timer (compliance lock applied), the
  // circuit breaker trips — no new timers are STARTED this cycle, preventing
  // the sweep from adding to an already-overloaded compliance debt.
  const ceilingSetting = await db.execute(sql`
    SELECT key, value FROM system_settings WHERE key IN ('max_concurrent_sop_timers', 'max_concurrent_lockout_pct')
  `).catch(() => ({ rows: [] }));
  const settingMap = Object.fromEntries((ceilingSetting.rows as any[]).map(r => [r.key, r.value]));
  const MAX_CONCURRENT_TIMERS = Number(settingMap["max_concurrent_sop_timers"] ?? 3);
  const MAX_LOCKOUT_PCT = Number(settingMap["max_concurrent_lockout_pct"] ?? 15);

  // Predict employees who would be NEWLY locked within the next 24 hours:
  // active (running, unacknowledged) timers whose deadline falls in [NOW, NOW+24h).
  // This forward-looking measurement lets the circuit breaker pause new timer
  // STARTS before the lock wave lands, rather than after the damage is done.
  const lockoutCheck = await db.execute(sql`
    SELECT
      COUNT(DISTINCT au.id) FILTER (
        WHERE about_to_lock.cnt > 0
      )::int AS would_be_newly_locked,
      COUNT(DISTINCT au.id)::int AS total_active
    FROM admin_users au
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS cnt
      FROM sop_employee_progress sep
      JOIN wave_sops ws ON ws.sop_master_id = sep.sop_master_id
      WHERE sep.user_id = au.id
        AND sep.timer_started_at IS NOT NULL
        AND sep.acknowledged_at IS NULL
        AND COALESCE(
              sep.deadline_at,
              CASE WHEN sep.timer_started_at IS NOT NULL
                   THEN (sep.timer_started_at::date + INTERVAL '15 days')::timestamp
                   ELSE (ws.operational_at::date + INTERVAL '15 days')::timestamp END
            ) >= NOW()
        AND COALESCE(
              sep.deadline_at,
              CASE WHEN sep.timer_started_at IS NOT NULL
                   THEN (sep.timer_started_at::date + INTERVAL '15 days')::timestamp
                   ELSE (ws.operational_at::date + INTERVAL '15 days')::timestamp END
            ) < NOW() + INTERVAL '24 hours'
    ) about_to_lock ON TRUE
    WHERE au.is_active = true AND au.deleted_at IS NULL
  `).catch(() => ({ rows: [{ would_be_newly_locked: 0, total_active: 1 }] }));
  const { would_be_newly_locked, total_active } = (lockoutCheck.rows[0] as any) ?? { would_be_newly_locked: 0, total_active: 1 };
  const currentLockoutPct = total_active > 0 ? (would_be_newly_locked / total_active) * 100 : 0;
  const circuitBreakerTripped = currentLockoutPct >= MAX_LOCKOUT_PCT;
  // Persist the circuit-breaker state so the compliance enforcement path (lock
  // activation in getEnforceableOverdueSopsForUser) can gate new lock activations.
  // Written ON EVERY sweep so it self-clears on the next cycle that doesn't trip.
  await storage.upsertSystemSetting(
    "sop_circuit_breaker_active",
    circuitBreakerTripped ? "true" : "false"
  ).catch(() => {});

  if (circuitBreakerTripped) {
    console.warn(
      `[governanceSync] ⚡ SOP lockout circuit breaker TRIPPED: ${would_be_newly_locked}/${total_active} employees would enter compliance-lock within 24 h (${currentLockoutPct.toFixed(1)}% ≥ ${MAX_LOCKOUT_PCT}%). New timer activations and new lock activations suspended this cycle.`
    );
    // Dispatch a deduplicated HR alert so the team can act before the wave lands.
    const cbDedupKey = `circuit_breaker_alert_${new Date().toISOString().slice(0, 10)}`;
    const alreadyAlerted = await storage.getSystemSetting(cbDedupKey).catch(() => null);
    if (!alreadyAlerted) {
      const hrUsers = await db.execute(sql`
        SELECT id FROM admin_users
        WHERE role IN ('super_admin', 'hr') AND is_active = true AND deleted_at IS NULL
      `).catch(() => ({ rows: [] }));
      for (const hr of hrUsers.rows as any[]) {
        await notifyUser({
          userId: String(hr.id),
          type: "sop_lockout_circuit_breaker" as any,
          title: "⚡ SOP lockout circuit breaker tripped",
          message: `${would_be_newly_locked} employee${would_be_newly_locked !== 1 ? "s" : ""} (${currentLockoutPct.toFixed(1)}% of active workforce) would enter compliance-lock within the next 24 hours. New SOP timer activations are paused this cycle. Review the wave rollout cadence.`,
          metadata: { wouldBeNewlyLocked: would_be_newly_locked, totalActive: total_active, lockoutPct: currentLockoutPct, maxPct: MAX_LOCKOUT_PCT },
        }).catch(console.error);
      }
      await storage.upsertSystemSetting(cbDedupKey, new Date().toISOString()).catch(() => {});
    }
  }

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

  // ── 2. SOP acknowledgements — two-phase: activation then obligation creation ─
  //
  // PHASE 1: Activate timers for ALL operational, unacked SOPs that have no timer
  // yet. Timer activation is decoupled from deadline proximity — timers start at
  // wave-activation time, subject to ceiling / circuit-breaker / wave-approval
  // gates. No deadline lookahead filter here, so we don't delay timer start to
  // day-8 of a 15-day window (which was the previous bug).
  //
  // PHASE 2: Create governance controls only for SOPs whose timer IS already
  // running AND whose deadline falls within the lookahead window. This way the
  // obligation appears when it is actionable, not when the timer first starts.

  // Build per-user active-timer counts from the full live DB (not just in-scope rows).
  const activeTimerCountRows = await db.execute(sql`
    SELECT sep.user_id, COUNT(*) AS cnt
    FROM sop_employee_progress sep
    JOIN wave_sops ws ON ws.sop_master_id = sep.sop_master_id
    WHERE sep.acknowledged_at IS NULL
      AND sep.timer_started_at IS NOT NULL
      AND ws.operational_at IS NOT NULL
    GROUP BY sep.user_id
  `);
  const timerCountByUser = new Map<string, number>();
  for (const row of activeTimerCountRows.rows as any[]) {
    timerCountByUser.set(String(row.user_id), Number(row.cnt));
  }

  // ── Phase 1: Activate timers ───────────────────────────────────────────────
  const sopTimerCandidates = await db.execute(sql`
    SELECT sep.id AS ref_id,
           sep.user_id AS owner_id,
           sep.sop_timer_queue,
           ws.wave_number
    FROM sop_employee_progress sep
    JOIN wave_sops ws ON ws.sop_master_id = sep.sop_master_id
    JOIN admin_users au ON au.id = sep.user_id
    WHERE sep.acknowledged_at IS NULL
      AND ws.operational_at IS NOT NULL
      AND sep.timer_started_at IS NULL
      AND au.is_active = true
      AND au.deleted_at IS NULL
    LIMIT 200
  `);

  for (const r of sopTimerCandidates.rows as any[]) {
    const userTimerCount = timerCountByUser.get(String(r.owner_id)) ?? 0;

    // Wave ≥ 3 approval gate: unapproved waves hold timer activation
    if (r.wave_number >= 3) {
      const approval = await db.execute(sql`
        SELECT id FROM sop_wave_approvals WHERE wave_number = ${r.wave_number} LIMIT 1
      `).catch(() => ({ rows: [] }));
      if (approval.rows.length === 0) {
        await db.execute(sql`
          UPDATE sop_employee_progress
          SET sop_timer_queue = COALESCE(sop_timer_queue, '[]'::jsonb) || to_jsonb(now())
          WHERE id = ${r.ref_id}
            AND (sop_timer_queue IS NULL OR NOT sop_timer_queue @> to_jsonb(id))
        `).catch(() => {});
        const alertKey = `wave_held_approval_alert_${r.wave_number}_${today}`;
        const alreadyAlerted = await storage.getSystemSetting(alertKey).catch(() => null);
        if (!alreadyAlerted) {
          await storage.upsertSystemSetting(alertKey, "sent").catch(() => {});
          const hrAdmins = await db.execute(sql`
            SELECT id FROM admin_users
            WHERE role IN ('super_admin', 'hr')
              AND is_active = true AND deleted_at IS NULL
            LIMIT 50
          `).catch(() => ({ rows: [] }));
          for (const u of hrAdmins.rows as any[]) {
            notifyUser({
              userId: u.id,
              type: "governance_wave_held",
              title: `⏸ Wave ${r.wave_number} held — approval required`,
              message: `SOP Wave ${r.wave_number} has not been approved. New SOP timer activations for this wave are paused until a super_admin approves it. Review the wave and its risk snapshot before approving.`,
              metadata: { waveNumber: r.wave_number },
            }).catch(() => {});
          }
        }
        continue;
      }
    }

    // Concurrent ceiling: queue if user already at max active timers
    if (userTimerCount >= MAX_CONCURRENT_TIMERS) {
      await db.execute(sql`
        UPDATE sop_employee_progress
        SET sop_timer_queue = COALESCE(sop_timer_queue, '[]'::jsonb) || jsonb_build_object('queued_at', now()::text, 'ref_id', ${r.ref_id})
        WHERE id = ${r.ref_id}
      `).catch(() => {});
      continue;
    }

    // Circuit breaker: pause new timer activations when lockout % too high
    if (circuitBreakerTripped) continue;

    // Activate the timer now
    await db.execute(sql`
      UPDATE sop_employee_progress SET timer_started_at = NOW() WHERE id = ${r.ref_id}
    `).catch(() => {});
    timerCountByUser.set(String(r.owner_id), userTimerCount + 1);
  }

  // ── Phase 2: Create governance controls for SOPs with running timers approaching deadline ─
  // Only SOPs with timer_started_at IS NOT NULL are eligible — queued SOPs
  // (no timer) cannot be overdue and must not generate a governance obligation.
  const sopControlRows = await db.execute(sql`
    SELECT sep.id AS ref_id,
           sep.user_id AS owner_id,
           au.manager_id,
           COALESCE(sep.deadline_at::date, sep.timer_started_at::date + INTERVAL '15 days')::text AS due_date,
           ws.wave_number
    FROM sop_employee_progress sep
    JOIN wave_sops ws ON ws.sop_master_id = sep.sop_master_id
    JOIN admin_users au ON au.id = sep.user_id
    WHERE sep.acknowledged_at IS NULL
      AND ws.operational_at IS NOT NULL
      AND sep.timer_started_at IS NOT NULL
      AND COALESCE(sep.deadline_at::date, sep.timer_started_at::date + INTERVAL '15 days') <= ${lookahead7}::date
      AND au.is_active = true
      AND au.deleted_at IS NULL
    LIMIT 200
  `);

  for (const r of sopControlRows.rows as any[]) {
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
      AND ci.scheduled_date::date <= ${lookahead7}::date
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

    // ── Manager Obligation Tracking (Task #1107) ──────────────────────────
    // For every employee check-in obligation, create a symmetric manager
    // obligation due 3 days after the check-in date. This ensures managers
    // are held accountable for facilitating the meeting AND completing their
    // notes / coaching entry within 3 working days.
    if (r.manager_id) {
      const ciDate = new Date(r.due_date);
      ciDate.setDate(ciDate.getDate() + 3);
      const managerDueDate = ciDate.toISOString().slice(0, 10);
      await createGovernanceControl({
        controlType: "manager_checkin_obligation" as any,
        referenceId: `mgr_ci:${r.ref_id}`,
        ownerId: r.manager_id,
        managerId: null,
        dueDate: managerDueDate,
        requiredAction: "Facilitate and document the scheduled employee check-in within 3 days.",
        evidenceRequired: true,
      });
      counters.managerObligations++;
    }
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
      AND ci.scheduled_date::date <= ${lookahead7}::date
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

    // Manager coaching obligation: due 3 days after the milestone
    if (r.manager_id) {
      const mDate = new Date(r.due_date);
      mDate.setDate(mDate.getDate() + 3);
      const mDue = mDate.toISOString().slice(0, 10);
      await createGovernanceControl({
        controlType: "manager_coaching_obligation" as any,
        referenceId: `mgr_ms:${r.ref_id}`,
        ownerId: r.manager_id,
        managerId: null,
        dueDate: mDue,
        requiredAction: "Log coaching notes after the probation milestone review within 3 days.",
        evidenceRequired: true,
      });
      counters.managerObligations++;
    }
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

  // ── 5b. Manager coaching obligations from PIP coaching gaps ──────────────
  // Distinct from milestone-triggered coaching obligations (4a above).
  // For active PIP plans where the manager has not logged a coaching entry in
  // ≥ coaching_gap_days (or ever), create a manager_coaching_obligation so the
  // governance sweep can escalate if ignored.  The threshold is configurable via
  // the 'coaching_gap_days' system setting (fallback: 5 days) and intentionally
  // mirrors the pip_coaching_prompt compliance collector so the two signals stay aligned.
  const coachingGapSetting = await db.execute(sql`
    SELECT value FROM system_settings WHERE key = 'coaching_gap_days' LIMIT 1
  `).catch(() => ({ rows: [] }));
  const COACHING_GAP_DAYS = Math.max(1, Number((coachingGapSetting.rows[0] as any)?.value ?? 5));

  // Only manager-authored entries count — HR/admin notes do not satisfy the
  // manager's coaching obligation. Filter cle.author_id = ep.manager_id.
  const pipCoachingGapRows = await db.execute(sql`
    SELECT ep.id AS ref_id,
           ep.employee_id,
           ep.manager_id,
           (NOW()::date + INTERVAL '3 days')::text AS due_date,
           EXTRACT(EPOCH FROM (NOW() - COALESCE(MAX(cle.created_at), ep.start_date::timestamp))) / 86400 AS gap_days
    FROM employee_plans ep
    LEFT JOIN coaching_log_entries cle ON cle.plan_id = ep.id AND cle.author_id = ep.manager_id
    WHERE ep.plan_type = 'pip'::employee_plan_type
      AND ep.status = 'active'::employee_plan_status
      AND ep.manager_id IS NOT NULL
      AND ep.employee_id IS NOT NULL
    GROUP BY ep.id, ep.employee_id, ep.manager_id, ep.start_date
    HAVING EXTRACT(EPOCH FROM (NOW() - COALESCE(MAX(cle.created_at), ep.start_date::timestamp))) / 86400 >= ${COACHING_GAP_DAYS}
    LIMIT 100
  `).catch(() => ({ rows: [] }));
  for (const r of pipCoachingGapRows.rows as any[]) {
    const gapDays = Math.round(Number(r.gap_days ?? 5));
    await createGovernanceControl({
      controlType: "manager_coaching_obligation" as any,
      referenceId: `mgr_pip:${r.ref_id}`,
      ownerId: r.manager_id,
      managerId: null,
      dueDate: r.due_date,
      requiredAction: `Log a coaching note for PIP employee — ${gapDays} day${gapDays !== 1 ? "s" : ""} since last coaching entry.`,
      evidenceRequired: true,
    });
    counters.managerObligations++;
  }

  // ── 6. Growth plans ───────────────────────────────────────────────────────
  const growthPlanRows = await db.execute(sql`
    SELECT ep.id AS ref_id,
           ep.employee_id AS owner_id,
           ep.manager_id,
           COALESCE(ep.end_date, ${today}) AS due_date
    FROM employee_plans ep
    WHERE ep.plan_type = 'growth'::employee_plan_type
      AND ep.status = 'active'::employee_plan_status
      AND ep.employee_id IS NOT NULL
    LIMIT 200
  `);
  for (const r of growthPlanRows.rows as any[]) {
    await createGovernanceControl({
      controlType: "probation",
      referenceId: `growth:${r.ref_id}`,
      ownerId: r.owner_id,
      managerId: r.manager_id ?? null,
      dueDate: r.due_date ?? today,
      requiredAction: "Meet all growth plan milestones and check-in cadence.",
      evidenceRequired: false,
    });
  }

  // ── 7. Goals ──────────────────────────────────────────────────────────────
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
    manager_checkin_obligation: "manager check-in facilitation",
    manager_coaching_obligation: "manager coaching log",
  };
  return labels[t] ?? t;
}

// ─── Centralized escalation engine ───────────────────────────────────────────

/**
 * Map a GovernanceFinding entityType to its governance_controls reference_id prefix.
 */
function referenceIdFor(finding: GovernanceFinding): string {
  if (finding.entityType === "probation_strike") {
    // syncGovernanceObligations creates plan-level controls with planType-based prefixes:
    //   probation → prob:<planId>
    //   pip       → pip:<planId>
    //   growth    → growth:<planId> (no plan-level control exists yet — applyEscalation will skip gracefully)
    const prefix = finding.planType === "pip" ? "pip" : finding.planType === "growth" ? "growth" : "prob";
    return `${prefix}:${finding.entityId}`;
  }
  // manager_coaching_obligation: entityId IS the full reference_id (mgr_pip:... or mgr_ms:...)
  // as stored in governance_controls.reference_id — return it directly to avoid prefix mangling.
  if (finding.entityType === "manager_coaching_obligation") {
    return finding.entityId;
  }
  // manager_checkin_obligation reference IDs use the mgr_ci: prefix established
  // in syncGovernanceObligations manager obligation tracking block.
  if (finding.entityType === "manager_checkin_obligation") {
    return `mgr_ci:${finding.entityId}`;
  }
  const prefixMap: Record<Exclude<GovernanceFinding["entityType"], "probation_strike" | "manager_coaching_obligation" | "manager_checkin_obligation">, string> = {
    goal: "goal",
    sop: "sop",
    checkin: "ci",
    probation_milestone: "ci",
  };
  return `${prefixMap[finding.entityType]}:${finding.entityId}`;
}

/**
 * Map a GovernanceFinding entityType to its governance_control_type.
 */
function controlTypeFor(finding: GovernanceFinding): GovernanceControlType {
  const typeMap: Record<GovernanceFinding["entityType"], GovernanceControlType> = {
    goal: "goal",
    sop: "sop",
    checkin: "check_in",
    probation_milestone: "probation",
    probation_strike: "probation",
    manager_coaching_obligation: "manager_coaching_obligation",
    manager_checkin_obligation: "manager_checkin_obligation",
  };
  return typeMap[finding.entityType];
}

/**
 * Central escalation method — sole authority for governance state transitions.
 *
 * Accepts a GovernanceFinding detected by a collector, looks up the corresponding
 * governance_control, determines the correct escalation step based on daysOverdue
 * and current status, applies a 20-hour idempotency guard, updates
 * governance_controls, writes a governance_events row, and calls notifyUser once.
 *
 * Returns { changed, newStatus, notificationSent }.
 */
export async function applyEscalation(finding: GovernanceFinding): Promise<{
  changed: boolean;
  newStatus?: string;
  notificationSent: boolean;
}> {
  // Respect the global notifications_enabled feature flag.
  // When disabled, bail early with no state change — escalation state should only
  // advance alongside a notification being sent (the two are coupled by design).
  // The sweep will retry on the next run when notifications are re-enabled.
  try {
    const _neFlagRow = await db.execute(sql`SELECT value FROM system_settings WHERE key = 'feature_flags' LIMIT 1`);
    if (_neFlagRow.rows.length > 0) {
      const _neFlags = _neFlagRow.rows[0] as any;
      const _neFlagVal = typeof _neFlags.value === "object" ? _neFlags.value : JSON.parse(_neFlags.value ?? "{}");
      if (_neFlagVal.notifications_enabled === false) {
        return { changed: false, notificationSent: false };
      }
    }
  } catch (_) { /* fail-open — don't suppress escalations on a transient DB error */ }

  const referenceId = referenceIdFor(finding);

  // Fetch the existing governance_control for this entity
  const ctrl = await db.execute(sql`
    SELECT id, status, escalation_level
    FROM governance_controls
    WHERE reference_id = ${referenceId}
      AND status NOT IN ('closed', 'completed')
    LIMIT 1
  `);

  if (ctrl.rows.length === 0) {
    // No control record yet — will be created by syncGovernanceObligations on next pass
    return { changed: false, notificationSent: false };
  }

  const c = ctrl.rows[0] as any;
  const controlId = c.id as string;
  const currentStatus = c.status as string;
  const escalationLevel = Number(c.escalation_level ?? 0);

  // Determine which escalation step should fire for this finding
  const step = resolveEscalationStep(finding, currentStatus, escalationLevel);
  if (step === "none") return { changed: false, notificationSent: false };

  // 20-hour idempotency guard — keyed on 'notification_sent' events for this control+step.
  // Using notification_sent (not 'escalated') means:
  //   • If notifications failed last run → no notification_sent row → retry is allowed.
  //   • If notifications succeeded last run → notification_sent row blocks re-send for 20h.
  // State advancement (escalation_level) only occurs AFTER successful notification below,
  // so resolveEscalationStep() will also return "none" for already-advanced levels.
  const recent = await db.execute(sql`
    SELECT id FROM governance_events
    WHERE control_id = ${controlId}
      AND event_type = 'notification_sent'
      AND metadata->>'step' = ${step}
      AND created_at > NOW() - INTERVAL '20 hours'
    LIMIT 1
  `);
  if (recent.rows.length > 0) {
    return { changed: false, notificationSent: false };
  }

  // Dispatch notifications FIRST — before advancing state.
  // This ensures recipients are notified before escalation_level is incremented.
  // If all deliveries fail, state is not advanced and the next sweep can retry.
  const { successCount, recipients } = await dispatchEscalationNotifications(finding, step, controlId);

  if (successCount === 0) {
    // All deliveries failed — do not advance state so the next sweep can retry.
    return { changed: false, notificationSent: false };
  }

  // Every step advances escalation_level by 1 so the sequential ladder progresses correctly:
  //   goal: employee_nudge (L0→1) → manager_escalation (L1→2) → skip_escalation (L2→3)
  //   check-in/milestone: manager_remind (L0→1) → milestone_escalation (L1→2)
  //   sop: employee_nudge (L0→1) → none
  //   strike: strike (L0→1) → none
  // The 20h notification_sent dedup guards against same-sweep re-fire for the same step.
  // Once level advances, resolveEscalationStep returns the next step (or none), preventing
  // the prior step from re-firing and driving the ladder forward naturally.
  const newStatus = stepToControlStatus(step);
  const newLevel = escalationLevel + 1;

  await db.execute(sql`
    UPDATE governance_controls
    SET status = ${newStatus}::governance_control_status,
        escalation_level = ${newLevel},
        updated_at = NOW()
    WHERE id = ${controlId}
  `);

  await emitGovernanceEvent({
    controlId,
    eventType: "escalated",
    source: "scheduler",
    metadata: {
      step,
      entityType: finding.entityType,
      daysOverdue: finding.daysOverdue,
      employeeId: finding.employeeId,
      managerId: finding.managerId,
      newStatus,
      newLevel,
    },
  }).catch(console.error);

  // Record notification evidence — the 20h dedup guard above keys on this row.
  // recipients[] is the complete per-delivery audit ledger: userId/email, channel, type, success.
  await emitGovernanceEvent({
    controlId,
    eventType: "notification_sent",
    source: "scheduler",
    metadata: {
      step,
      entityType: finding.entityType,
      daysOverdue: finding.daysOverdue,
      employeeId: finding.employeeId,
      managerId: finding.managerId ?? undefined,
      successCount,
      recipients: recipients as unknown as Record<string, unknown>[],
      ctaPath: finding.ctaPath,
    },
  }).catch(console.error);

  return { changed: true, newStatus, notificationSent: true };
}

/**
 * Escalation ladder by entity type and level:
 *
 *  goal:              0 → employee_nudge (Day 1+)
 *                     1 → manager_escalation (Day 3+)
 *                     2 → skip_escalation (Day 6+, fires ONCE at level 2)
 *                     3+ → none (already fully escalated)
 *
 *  sop:               0 → employee_nudge (Day 1+)
 *                     1 → manager_escalation (Day 5+)
 *                     2+ → none
 *
 *  checkin /          0 → manager_remind (Day 1+)
 *  probation_         1 → milestone_escalation (Day milestoneEscalateAfterDays+, milestone only)
 *  milestone:         2+ → none
 *
 *  probation_strike:  0 → strike (once, any daysOverdue)
 *                     1+ → none
 *
 * IMPORTANT: every step increments escalation_level by 1 in applyEscalation, so
 * the exact-level checks here are the single source of truth for "already done".
 */
function resolveEscalationStep(
  finding: GovernanceFinding,
  currentStatus: string,
  escalationLevel: number
): string {
  const { entityType, daysOverdue } = finding;
  const inactive = (s: string) => !["pending", "in_progress", "overdue", "escalated"].includes(s);
  if (inactive(currentStatus)) return "none";

  if (entityType === "goal") {
    if (escalationLevel === 0 && daysOverdue >= 1) return "employee_nudge";
    if (escalationLevel === 1 && daysOverdue >= 3) return "manager_escalation";
    // skip_escalation fires EXACTLY ONCE at level 2 — level 3+ means it already fired
    if (escalationLevel === 2 && daysOverdue >= 6) return "skip_escalation";
    return "none";
  }

  if (entityType === "sop") {
    // SOP nudge is recurring: fire whenever daysOverdue >= 1 regardless of escalation_level.
    // The 20h notification_sent dedup guard (not the level check) controls repeat cadence.
    // manager_escalation for SOPs is excluded as policy-scope (beyond this refactor).
    if (daysOverdue >= 1) return "employee_nudge";
    return "none";
  }

  if (entityType === "checkin" || entityType === "probation_milestone") {
    if (escalationLevel === 0 && daysOverdue >= 1) return "manager_remind";
    // milestone_escalation fires EXACTLY ONCE at level 1, using the per-finding threshold
    if (entityType === "probation_milestone" && escalationLevel === 1) {
      const threshold = finding.milestoneEscalateAfterDays ?? 3;
      if (daysOverdue >= threshold) return "milestone_escalation";
    }
    return "none";
  }

  if (entityType === "probation_strike") {
    // Strike fires EXACTLY ONCE at level 0
    if (escalationLevel === 0) return "strike";
    return "none";
  }

  // manager_coaching_obligation: owner IS the manager — escalation ladder is:
  //   L0 → employee_nudge  (nudges the manager, who is the "owner")
  //   L1 → manager_escalation (nudges the manager's own manager / skip-level)
  if (entityType === "manager_coaching_obligation") {
    if (escalationLevel === 0 && daysOverdue >= 1) return "employee_nudge";
    if (escalationLevel === 1 && daysOverdue >= 3) return "manager_escalation";
    return "none";
  }

  // manager_checkin_obligation: same ladder as manager_coaching_obligation.
  // The owner is the manager who must facilitate the check-in.
  if (entityType === "manager_checkin_obligation") {
    if (escalationLevel === 0 && daysOverdue >= 1) return "employee_nudge";
    if (escalationLevel === 1 && daysOverdue >= 3) return "manager_escalation";
    return "none";
  }

  return "none";
}

/**
 * Map a step name to the governance_control_status value it transitions to.
 */
function stepToControlStatus(step: string): string {
  switch (step) {
    case "employee_nudge":
    case "manager_remind":
      return "overdue";
    case "manager_escalation":
    case "milestone_escalation":
    case "skip_escalation":
    case "strike":
      return "escalated";
    default:
      return "overdue";
  }
}

/**
 * Dispatch notification(s) for an escalation step.
 * Each step fires exactly ONE notifyUser call per recipient role.
 * Email is sent for manager/skip-level escalations.
 *
 * Returns successCount: how many individual notification deliveries succeeded.
 * The caller emits a `notification_sent` governance_event ONLY when successCount > 0,
 * so transient failures leave no audit record and allow retries on the next sweep.
 */
/** Per-delivery record used in notification_sent event metadata for the audit ledger. */
type NotifRecipient = { userId?: string; email?: string; channel: "in_app" | "email"; notificationType: string; success: boolean };

async function dispatchEscalationNotifications(
  finding: GovernanceFinding,
  step: string,
  controlId: string
): Promise<{ successCount: number; recipients: NotifRecipient[] }> {
  const {
    entityType,
    employeeId,
    managerId,
    skipManagerId,
    daysOverdue,
    entityTitle,
    employeeName,
    employeeEmail,
    managerEmail,
    managerFirstName,
    planType,
    ctaPath,
  } = finding;

  const { sendPlanOverdueReminderEmail, sendPlanEscalationEmail } = await import("./email");

  const empLabel = employeeName ?? "Employee";
  const titleLabel = entityTitle ?? formatControlType(controlTypeFor(finding));
  const portalCta = ctaPath ?? "/admin/hr";

  // Per-recipient delivery records — included in notification_sent event metadata for
  // the complete audit ledger (to whom, which channel, notification type, success/failure).
  const recipients: NotifRecipient[] = [];
  let successCount = 0;

  // Notification to the employee — records in-app delivery to recipient audit list
  const notifyEmployee = async (type: string, title: string, message: string): Promise<boolean> => {
    if (!employeeId) return false;
    let ok = false;
    try {
      await notifyUser({ userId: employeeId, type, title, message, metadata: { controlId, entityType, daysOverdue, ctaPath: portalCta } });
      ok = true;
    } catch (e) {
      console.error("[applyEscalation] notifyEmployee failed:", e);
    }
    recipients.push({ userId: employeeId, channel: "in_app", notificationType: type, success: ok });
    return ok;
  };

  // Notification to the manager — records in-app delivery to recipient audit list
  const notifyManager = async (type: string, title: string, message: string): Promise<boolean> => {
    if (!managerId) return false;
    let ok = false;
    try {
      await notifyUser({ userId: managerId, type, title, message, metadata: { controlId, entityType, daysOverdue, employeeId, ctaPath: portalCta } });
      ok = true;
    } catch (e) {
      console.error("[applyEscalation] notifyManager failed:", e);
    }
    recipients.push({ userId: managerId, channel: "in_app", notificationType: type, success: ok });
    return ok;
  };

  // Notification to skip-level manager — records in-app delivery to recipient audit list
  const notifySkip = async (type: string, title: string, message: string): Promise<boolean> => {
    if (!skipManagerId) return false;
    let ok = false;
    try {
      await notifyUser({ userId: skipManagerId, type, title, message, metadata: { controlId, entityType, daysOverdue, employeeId, managerId, ctaPath: portalCta } });
      ok = true;
    } catch (e) {
      console.error("[applyEscalation] notifySkip failed:", e);
    }
    recipients.push({ userId: skipManagerId, channel: "in_app", notificationType: type, success: ok });
    return ok;
  };

  // Notify all HR/admin users — records each delivery; returns count of successes
  const notifyHrAdmins = async (type: string, title: string, message: string): Promise<number> => {
    const hrAdmins = (await db.execute(sql`
      SELECT id FROM admin_users
      WHERE role IN ('hr', 'admin', 'super_admin') AND is_active = true AND deleted_at IS NULL
    `)).rows as any[];
    let sent = 0;
    for (const hr of hrAdmins) {
      let ok = false;
      try {
        await notifyUser({ userId: String(hr.id), type, title, message, metadata: { controlId, entityType, daysOverdue, employeeId, ctaPath: portalCta } });
        ok = true;
        sent++;
      } catch (e) {
        console.error("[applyEscalation] notifyHrAdmins failed for user:", hr.id, e);
      }
      recipients.push({ userId: String(hr.id), channel: "in_app", notificationType: type, success: ok });
    }
    return sent;
  };

  switch (step) {
    case "employee_nudge": {
      if (entityType === "goal") {
        if (await notifyEmployee(
          "goal_overdue_nudge",
          `Overdue goal: "${titleLabel}"`,
          `Your goal "${titleLabel}" was due ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""} ago and needs a progress update.`
        )) successCount++;
        if (employeeEmail) {
          // CTA links to employee's own goals tab, scoped to their goal via entityId
          const portalBase = portalCta.replace(/\/admin\/.*$/, "");
          const empGoalsCta = `${portalBase}/admin/hr?tab=goals${employeeId ? `&employeeId=${employeeId}` : ""}`;
          let emailOk = false;
          try {
            await sendPlanOverdueReminderEmail({
              to: employeeEmail,
              managerFirstName: empLabel.split(" ")[0] || "there",
              employeeName: empLabel,
              checkInLabel: `Goal: "${titleLabel}"`,
              scheduledDate: new Date().toISOString().slice(0, 10),
              daysOverdue,
              planType: planType as any,
              ctaUrl: empGoalsCta,
              ctaLabel: "Review Your Goals",
            });
            emailOk = true;
            successCount++;
          } catch (e) {
            console.error(`[applyEscalation] goal employee nudge email failed for ${finding.entityId}:`, e);
          }
          recipients.push({ email: employeeEmail, channel: "email", notificationType: "goal_overdue_nudge", success: emailOk });
        }
      } else if (entityType === "sop") {
        // Contextual SOP nudge: shows SOP code, title, days remaining, estimated read time
        try {
          const graceDays = 15; // default; governance_sop_grace_days may override
          const sopDetail = (await db.execute(sql`
            SELECT sd.code, sd.title, ws.operational_at,
                   COALESCE(sep.deadline_at::date, ws.operational_at::date + (${graceDays} || ' days')::interval)::date AS lock_date
            FROM sop_employee_progress sep
            JOIN wave_sops ws ON ws.sop_master_id = sep.sop_master_id
            JOIN sop_documents sd ON sd.sop_master_id = sep.sop_master_id AND sd.is_current = true
            WHERE sep.id = ${finding.entityId}
            LIMIT 1
          `)).rows[0] as any;

          if (sopDetail) {
            const todayStr = new Date().toISOString().slice(0, 10);
            const lockDateStr = String(sopDetail.lock_date).slice(0, 10);
            const calendarDaysRemaining = Math.max(0, Math.ceil(
              (new Date(lockDateStr + "T12:00:00Z").getTime() - new Date(todayStr + "T12:00:00Z").getTime()) / 86400000
            ));
            const nudgePayload = await buildSopNudgePayload({
              progressId: finding.entityId,
              sopMasterId: String(sopDetail.code),
              sopCode: String(sopDetail.code),
              title: String(sopDetail.title),
              calendarDaysRemaining,
              workingDaysRemaining: calendarDaysRemaining, // approx; precise value from countdown endpoint
            });
            if (await notifyEmployee("sop_overdue_contextual", nudgePayload.inAppTitle, nudgePayload.inAppMessage)) successCount++;
          } else {
            // Fallback to generic if lookup fails
            if (await notifyEmployee(
              "sop_overdue_nudge",
              `SOP acknowledgement overdue`,
              `You have an SOP that is ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""} past its acknowledgement deadline. Please review and acknowledge it.`
            )) successCount++;
          }
        } catch (sopErr) {
          console.error("[applyEscalation] SOP contextual nudge build failed:", sopErr);
          if (await notifyEmployee(
            "sop_overdue_nudge",
            `SOP acknowledgement overdue`,
            `You have an SOP that is ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""} past its acknowledgement deadline.`
          )) successCount++;
        }
      }
      break;
    }

    case "manager_escalation": {
      // manager_escalation is a goal-only step; SOP manager escalation is policy-excluded
      if (entityType === "goal") {
        if (await notifyManager(
          "goal_overdue_manager_escalation",
          `Action needed: ${empLabel}'s goal is overdue`,
          `"${titleLabel}" is ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""} overdue with no progress update.`
        )) successCount++;
        if (managerEmail) {
          // Explicit URL construction — avoids brittle chained .replace() on ctaPath
          const portalBase = portalCta.replace(/\/admin\/.*$/, "");
          const managerGoalsCta = employeeId
            ? `${portalBase}/admin/hr/my-team?tab=goals&employeeId=${employeeId}`
            : `${portalBase}/admin/hr/my-team?tab=goals`;
          try {
            await sendPlanOverdueReminderEmail({
              to: managerEmail,
              managerFirstName: managerFirstName || "Manager",
              employeeName: empLabel,
              checkInLabel: `Goal: "${titleLabel}"`,
              scheduledDate: new Date().toISOString().slice(0, 10),
              daysOverdue,
              planType: planType as any,
              ctaUrl: managerGoalsCta,
              ctaLabel: "Review Employee Goals",
            });
            successCount++;
          } catch (e) {
            console.error(`[applyEscalation] goal manager escalation email failed for ${finding.entityId}:`, e);
          }
        }
      }
      break;
    }

    case "skip_escalation": {
      // CTA for HR/skip-level → people dashboard filtered to the specific employee
      const portalBase = portalCta.replace(/\/admin\/.*$/, "");
      const hrPeopleCta = employeeId
        ? `${portalBase}/admin/hr/people?employeeId=${employeeId}`
        : `${portalBase}/admin/hr/people`;
      if (await notifySkip(
        "goal_overdue_hr_escalation",
        `Escalation: ${empLabel}'s goal ${daysOverdue}d overdue`,
        `"${titleLabel}" has no progress update after ${daysOverdue} days. Manager was notified — further intervention may be needed.`
      )) successCount++;
      successCount += await notifyHrAdmins(
        "goal_overdue_hr_escalation",
        `Escalation: ${empLabel}'s goal ${daysOverdue}d overdue`,
        `"${titleLabel}" has no progress update after ${daysOverdue} days. Manager was notified — further intervention may be needed.`
      );
      const hrEmailRows = (await db.execute(sql`
        SELECT email FROM admin_users
        WHERE role IN ('hr', 'admin', 'super_admin') AND is_active = true AND deleted_at IS NULL
      `)).rows as any[];
      const toEmailsRaw: string[] = hrEmailRows.map(r => String(r.email).toLowerCase()).filter(Boolean);
      if (skipManagerId) {
        const skipRow = (await db.execute(sql`SELECT email FROM admin_users WHERE id = ${skipManagerId} AND is_active = true LIMIT 1`)).rows[0] as any;
        if (skipRow?.email) toEmailsRaw.push(String(skipRow.email).toLowerCase());
      }
      const toEmails = Array.from(new Set(toEmailsRaw));
      if (toEmails.length > 0) {
        try {
          await sendPlanEscalationEmail({
            to: toEmails,
            employeeName: empLabel,
            managerName: managerFirstName ?? "Unassigned",
            reason: `Goal "${titleLabel}" is ${daysOverdue} days overdue with no progress`,
            detail: `The employee's manager was notified on Day 3 — intervention may be needed.`,
            planType: planType as any,
            ctaUrl: hrPeopleCta,
            ctaLabel: "View Employee in People Dashboard",
          });
          successCount++;
        } catch (e) {
          console.error(`[applyEscalation] skip escalation email failed for ${finding.entityId}:`, e);
        }
      }
      break;
    }

    case "manager_remind": {
      const planWord = planType === "pip" ? "PIP" : planType === "growth" ? "growth" : "probation";
      if (await notifyManager(
        `${planType ?? "checkin"}_overdue_reminder`,
        `Overdue: ${empLabel}'s ${titleLabel} check-in`,
        `The ${titleLabel} ${planWord} check-in was due ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""} ago.`
      )) successCount++;
      if (managerEmail) {
        try {
          await sendPlanOverdueReminderEmail({
            to: managerEmail,
            managerFirstName: managerFirstName || "there",
            employeeName: empLabel,
            checkInLabel: titleLabel,
            scheduledDate: new Date().toISOString().slice(0, 10),
            daysOverdue,
            planType: planType as any,
            ctaUrl: portalCta,
            ctaLabel: "Complete the Check-In",
          });
          successCount++;
        } catch (e) {
          console.error(`[applyEscalation] manager remind email failed for ${finding.entityId}:`, e);
        }
      }
      break;
    }

    case "milestone_escalation": {
      const planWord = planType === "pip" ? "PIP" : planType === "growth" ? "growth" : "probation";
      const milDay = finding.milestoneDay;
      const milLabel = milDay != null ? `Day ${milDay} milestone` : titleLabel;
      const recipientIds = new Set<string>();
      if (skipManagerId) recipientIds.add(skipManagerId);
      const hrOps = (await db.execute(sql`
        SELECT id FROM admin_users
        WHERE role IN ('hr', 'admin', 'super_admin', 'operations') AND is_active = true AND deleted_at IS NULL
      `)).rows as any[];
      for (const hr of hrOps) recipientIds.add(String(hr.id));
      for (const rid of recipientIds) {
        try {
          await notifyUser({
            userId: rid,
            type: `${planType ?? "probation"}_milestone_escalation`,
            title: `${planWord.charAt(0).toUpperCase() + planWord.slice(1)} milestone overdue: ${empLabel}`,
            message: `${empLabel}'s ${milLabel} review is ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""} overdue.`,
            metadata: { controlId, entityType, daysOverdue, employeeId, planId: finding.planId, milestoneDay: milDay, ctaPath: portalCta },
          });
          successCount++;
        } catch (e) {
          console.error("[applyEscalation] milestone notify failed for user:", rid, e);
        }
      }
      const hrEmailRows2 = (await db.execute(sql`
        SELECT email FROM admin_users
        WHERE role IN ('hr', 'admin', 'super_admin', 'operations') AND is_active = true AND deleted_at IS NULL
      `)).rows as any[];
      const mgrNameLabel = managerFirstName || "the assigned manager";
      const escEmails: string[] = hrEmailRows2.map(r => String(r.email)).filter(Boolean);
      if (skipManagerId) {
        const sr = (await db.execute(sql`SELECT email FROM admin_users WHERE id = ${skipManagerId} AND is_active = true LIMIT 1`)).rows[0] as any;
        if (sr?.email) escEmails.push(String(sr.email));
      }
      if (escEmails.length > 0) {
        try {
          await sendPlanEscalationEmail({
            to: Array.from(new Set(escEmails)),
            employeeName: empLabel,
            managerName: mgrNameLabel,
            reason: `${milLabel} ${planWord} milestone review is ${daysOverdue} days overdue.`,
            detail: `This formal milestone scorecard has not been completed. Please follow up with the owning manager.`,
            planType: planType as any,
            ctaUrl: portalCta,
            ctaLabel: "Review Check-Ins",
          });
          successCount++;
        } catch (e) {
          console.error(`[applyEscalation] milestone escalation email failed for ${finding.entityId}:`, e);
        }
      }
      break;
    }

    case "strike": {
      const planWord = planType === "pip" ? "PIP" : planType === "growth" ? "growth" : "probation";
      const recipientIds = new Set<string>();
      if (skipManagerId) recipientIds.add(skipManagerId);
      const hrOps2 = (await db.execute(sql`
        SELECT id FROM admin_users
        WHERE role IN ('hr', 'admin', 'super_admin', 'operations') AND is_active = true AND deleted_at IS NULL
      `)).rows as any[];
      for (const hr of hrOps2) recipientIds.add(String(hr.id));
      for (const rid of recipientIds) {
        try {
          await notifyUser({
            userId: rid,
            type: `${planType ?? "probation"}_strike_escalation`,
            title: `${planWord.charAt(0).toUpperCase() + planWord.slice(1)} at risk: ${empLabel}`,
            message: `${empLabel}'s ${planWord} plan has ${daysOverdue} overdue check-in${daysOverdue !== 1 ? "s" : ""}.`,
            metadata: { controlId, entityType, daysOverdue, employeeId, planId: finding.planId, ctaPath: portalCta },
          });
          successCount++;
        } catch (e) {
          console.error("[applyEscalation] strike notify failed for user:", rid, e);
        }
      }
      // NOTE: employee_plans.strike_escalated_at is no longer written here.
      // The governance_events audit row (step='strike') is the new source of truth.
      // The legacy column is reconciled at sweep-start in reconcileLegacyEscalationState().
      const hrEmails3 = (await db.execute(sql`
        SELECT email FROM admin_users
        WHERE role IN ('hr', 'admin', 'super_admin', 'operations') AND is_active = true AND deleted_at IS NULL
      `)).rows as any[];
      const strikeEmails: string[] = hrEmails3.map(r => String(r.email)).filter(Boolean);
      if (skipManagerId) {
        const sr2 = (await db.execute(sql`SELECT email FROM admin_users WHERE id = ${skipManagerId} AND is_active = true LIMIT 1`)).rows[0] as any;
        if (sr2?.email) strikeEmails.push(String(sr2.email));
      }
      if (strikeEmails.length > 0) {
        try {
          await sendPlanEscalationEmail({
            to: Array.from(new Set(strikeEmails)),
            employeeName: empLabel,
            managerName: managerFirstName || "the assigned manager",
            reason: `${daysOverdue} ${planWord} check-in${daysOverdue !== 1 ? "s" : ""} are overdue on this plan.`,
            detail: `The owning manager has missed ${daysOverdue} or more ${planWord} check-ins. Please intervene to bring the plan back on cadence.`,
            planType: planType as any,
            ctaUrl: portalCta,
            ctaLabel: "View Plan Details",
          });
          successCount++;
        } catch (e) {
          console.error(`[applyEscalation] strike escalation email failed for ${finding.planId}:`, e);
        }
      }
      break;
    }

    default:
      break;
  }

  return { successCount, recipients };
}

/**
 * One-time-per-control migration guard: before the first unified sweep run processes
 * a control, check whether legacy source-table timestamps prove an escalation already
 * fired under the old engine. If so, advance escalation_level to the appropriate
 * value so the state machine's exact-level checks don't re-notify.
 *
 * Covered cases:
 *   - probation_strike: employee_plans.strike_escalated_at IS NOT NULL → level 1
 *   - any entity: existing governance_events with step recorded → level derived from count
 *
 * This function is idempotent — it only updates controls whose escalation_level is
 * lower than the observed legacy level, and it writes a governance_event so the
 * update is auditable.
 */
async function reconcileLegacyEscalationState(findings: GovernanceFinding[]): Promise<void> {
  for (const finding of findings) {
    const referenceId = referenceIdFor(finding);

    // Fetch the control (we only care about level=0 controls — higher means already unified)
    const ctrlRows = (await db.execute(sql`
      SELECT id, escalation_level FROM governance_controls
      WHERE reference_id = ${referenceId}
        AND status NOT IN ('closed', 'completed')
        AND escalation_level = 0
      LIMIT 1
    `)).rows as any[];
    if (ctrlRows.length === 0) continue;

    const controlId = ctrlRows[0].id as string;
    let legacyLevel = 0;

    // ── Per-entity-type legacy column reads ──────────────────────────────────
    if (finding.entityType === "goal") {
      // performance_goals columns written by the old engine before unification
      const gr = (await db.execute(sql`
        SELECT employee_nudged_at, last_escalated_at, skip_escalated_at
        FROM performance_goals WHERE id = ${finding.entityId} LIMIT 1
      `)).rows[0] as any;
      if (gr) {
        // Ladder: nudge→level1, manager_escalation→level2, skip_escalation→level3
        if (gr.skip_escalated_at) legacyLevel = Math.max(legacyLevel, 3);
        else if (gr.last_escalated_at) legacyLevel = Math.max(legacyLevel, 2);
        else if (gr.employee_nudged_at) legacyLevel = Math.max(legacyLevel, 1);
      }
    } else if (finding.entityType === "sop") {
      // sop_employee_progress.overdue_nudge_sent_date set by old nudge engine
      const sr = (await db.execute(sql`
        SELECT overdue_nudge_sent_date FROM sop_employee_progress
        WHERE id::text = ${finding.entityId} LIMIT 1
      `)).rows[0] as any;
      if (sr?.overdue_nudge_sent_date) legacyLevel = Math.max(legacyLevel, 1);
    } else if (finding.entityType === "checkin") {
      // check_ins.overdue_reminded_on set by old reminder engine
      const cr = (await db.execute(sql`
        SELECT overdue_reminded_on FROM check_ins
        WHERE id::text = ${finding.entityId} LIMIT 1
      `)).rows[0] as any;
      if (cr?.overdue_reminded_on) legacyLevel = Math.max(legacyLevel, 1);
    } else if (finding.entityType === "probation_milestone") {
      // check_ins has both overdue_reminded_on (remind step) and milestone_escalated_at (escalation step)
      const mr = (await db.execute(sql`
        SELECT overdue_reminded_on, milestone_escalated_at FROM check_ins
        WHERE id::text = ${finding.entityId} LIMIT 1
      `)).rows[0] as any;
      if (mr) {
        if (mr.milestone_escalated_at) legacyLevel = Math.max(legacyLevel, 2);
        else if (mr.overdue_reminded_on) legacyLevel = Math.max(legacyLevel, 1);
      }
    } else if (finding.entityType === "probation_strike" && finding.planId) {
      // employee_plans.strike_escalated_at written by old strike engine
      const planRow = (await db.execute(sql`
        SELECT strike_escalated_at FROM employee_plans
        WHERE id = ${finding.planId} AND strike_escalated_at IS NOT NULL LIMIT 1
      `)).rows[0] as any;
      if (planRow) legacyLevel = Math.max(legacyLevel, 1);
    }

    // Also check how many distinct escalation/notification steps have been recorded in
    // governance_events — covers partial runs of the new engine before this session.
    const evtRows = (await db.execute(sql`
      SELECT DISTINCT metadata->>'step' AS step
      FROM governance_events
      WHERE control_id = ${controlId}
        AND event_type IN ('escalated', 'notification_sent')
        AND metadata->>'step' IS NOT NULL
    `)).rows as any[];
    const stepCount = evtRows.length;
    if (stepCount > legacyLevel) legacyLevel = stepCount;

    if (legacyLevel === 0) continue;

    // Advance the control's escalation_level to reflect legacy state
    await db.execute(sql`
      UPDATE governance_controls
      SET escalation_level = ${legacyLevel},
          updated_at = NOW()
      WHERE id = ${controlId}
        AND escalation_level < ${legacyLevel}
    `);

    // Emit an audit event so this reconciliation is traceable
    await emitGovernanceEvent({
      controlId,
      eventType: "sync_updated",
      source: "scheduler",
      metadata: {
        reason: "legacy_state_migration",
        entityType: finding.entityType,
        legacyLevel,
        planId: finding.planId,
      },
    }).catch(console.error);

    console.log(`[governanceSync] Reconciled ${finding.entityType}:${finding.entityId} legacy level → ${legacyLevel}`);
  }
}

/**
 * Orchestrated daily governance sync + escalation sweep.
 * Called by scheduler at 07:00 IST as the single governance cron entry.
 *
 * Sequence:
 *   1. backfillProbationCadence() — insert missing cadence check-ins (idempotent)
 *   2. syncGovernanceObligations() — create/refresh governance_controls (idempotent)
 *   3. collectOverdueItems() — pure detector for goals, SOPs, check-ins
 *   4. collectProbationMilestoneEvents() — pure detector for probation/PIP/growth
 *   4b. reconcileLegacyEscalationState() — advance controls with pre-existing escalations
 *   5. applyEscalation(finding) for each finding — central state machine
 *   6. runDailySweep() — HR check-in overdue digest (separate visibility path)
 *   7. Log summary with dedup stats
 */
export async function runGovernanceSyncSweep(): Promise<GovernanceRunResult> {
  const result: GovernanceRunResult = {
    findingsCollected: 0,
    escalationsApplied: 0,
    escalationsSkipped: 0,
    notificationsSent: 0,
  };

  // Step 1: Cadence backfill
  try {
    const { backfillProbationCadence } = await import("./probationEngine");
    const { inserted } = await backfillProbationCadence();
    if (inserted > 0) {
      console.log(`[governanceSync] Cadence backfill: ${inserted} check-in(s) inserted.`);
    }
  } catch (err) {
    console.error("[governanceSync] Cadence backfill failed (non-fatal):", err);
  }

  // Step 2: Obligation sync — create governance_controls for all live obligations
  try {
    const counts = await syncGovernanceObligations();
    console.log(
      `[governanceSync] Obligation sync: training=${counts.training} sop=${counts.sop} ` +
      `checkIn=${counts.checkIn} probation=${counts.probation} pip=${counts.pip} goal=${counts.goal}`
    );
  } catch (err) {
    console.error("[governanceSync] Obligation sync failed (non-fatal):", err);
  }

  // Step 3: Collect overdue items (goals, SOPs, standalone check-ins)
  let complianceFindings: GovernanceFinding[] = [];
  try {
    const { collectOverdueItems } = await import("./complianceSweep");
    complianceFindings = await collectOverdueItems();
  } catch (err) {
    console.error("[governanceSync] collectOverdueItems failed:", err);
  }

  // Step 4: Collect probation/PIP/growth findings
  let probationFindings: GovernanceFinding[] = [];
  try {
    const { collectProbationMilestoneEvents } = await import("./probationEngine");
    probationFindings = await collectProbationMilestoneEvents();
  } catch (err) {
    console.error("[governanceSync] collectProbationMilestoneEvents failed:", err);
  }

  const allFindings = [...complianceFindings, ...probationFindings];
  result.findingsCollected = allFindings.length;

  // Step 4b: Reconcile legacy source-table escalation state.
  // On the first governance sweep run (or when new controls are created for existing
  // already-escalated entities) escalation_level may be 0 while the legacy source table
  // already has timestamps proving an escalation already fired. Advancing the level here
  // prevents the state machine from re-notifying parties who were notified before the
  // unified engine took over.
  try {
    await reconcileLegacyEscalationState(allFindings);
  } catch (err) {
    console.error("[governanceSync] Legacy reconciliation failed (non-fatal):", err);
  }

  // Step 5: Apply escalation for each finding through the central state machine.
  // Top-level guard: check notifications_enabled before entering the loop.
  // applyEscalation() also checks internally, but the sweep-level guard gives a
  // clean log line and avoids N individual DB reads when the flag is off.
  let _sweepNotifEnabled = true;
  try {
    const _sweepFlagRow = await db.execute(sql`SELECT value FROM system_settings WHERE key = 'feature_flags' LIMIT 1`);
    if (_sweepFlagRow.rows.length > 0) {
      const _sweepFlags = _sweepFlagRow.rows[0] as any;
      const _sweepFlagVal = typeof _sweepFlags.value === "object" ? _sweepFlags.value : JSON.parse(_sweepFlags.value ?? "{}");
      if (_sweepFlagVal.notifications_enabled === false) _sweepNotifEnabled = false;
    }
  } catch (_) { /* fail-open */ }

  if (!_sweepNotifEnabled) {
    console.log(`[governanceSync] notifications_enabled=false — skipping escalation loop (${allFindings.length} findings deferred).`);
    result.escalationsSkipped += allFindings.length;
  } else {
    for (const finding of allFindings) {
      try {
        const out = await applyEscalation(finding);
        if (out.changed) {
          result.escalationsApplied++;
          if (out.notificationSent) result.notificationsSent++;
        } else {
          result.escalationsSkipped++;
        }
      } catch (err) {
        console.error(`[governanceSync] applyEscalation failed for ${finding.entityType}:${finding.entityId}:`, err);
        result.escalationsSkipped++;
      }
    }
  }

  // Step 6: HR check-in overdue digest (visibility path — separate from escalation)
  try {
    const { runDailySweep } = await import("./complianceSweep");
    await runDailySweep();
  } catch (err) {
    console.error("[governanceSync] HR checkin digest failed (non-fatal):", err);
  }

  // Step 7: Diagnostic log
  console.log(
    `[governanceSync] Sweep complete. ` +
    `Findings: ${result.findingsCollected} | ` +
    `Applied: ${result.escalationsApplied} | ` +
    `Skipped (deduped): ${result.escalationsSkipped} | ` +
    `Notifications sent: ${result.notificationsSent}`
  );

  return result;
}
