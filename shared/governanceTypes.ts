/**
 * Shared governance types used across governanceService, complianceSweep,
 * and probationEngine. Centralizes the GovernanceFinding contract so every
 * collector speaks the same language as applyEscalation.
 */

/**
 * Entity types that can trigger governance escalation.
 *   goal              — performance_goals row
 *   sop               — sop_employee_progress row (acknowledgement overdue)
 *   checkin           — non-milestone check_ins row (weekly / pip_review)
 *   probation_milestone — milestone-type check_ins row (Day 30/60/90)
 *   probation_strike  — employee_plans row that has hit the strike threshold
 */
export type GovernanceEntityType =
  | "goal"
  | "sop"
  | "checkin"
  | "probation_milestone"
  | "probation_strike"
  | "manager_coaching_obligation"
  | "manager_checkin_obligation";

/**
 * Escalation steps — the ordered stages a governance obligation progresses through.
 * `none` is the starting state (no action yet needed).
 */
export type EscalationStep = "none" | "overdue" | "escalated" | "strike";

/**
 * A single overdue governance obligation detected by a collector.
 * The `entityId` is always the raw DB row id (goal.id, sop_progress.id, etc.)
 * NOT the prefixed reference_id used in governance_controls.
 */
export interface GovernanceFinding {
  entityType: GovernanceEntityType;
  entityId: string;
  employeeId: string;
  managerId: string | null;
  skipManagerId: string | null;
  daysOverdue: number;
  currentControlStatus?: string | null;

  /** Deep-link for email CTA button (relative path, no origin). */
  ctaPath?: string;

  /** Human-readable label for the obligation (e.g. goal title, SOP name). */
  entityTitle?: string;

  /** Denormalized names / emails for notifications (avoids extra DB round-trips). */
  employeeName?: string;
  employeeEmail?: string;
  managerEmail?: string;
  managerFirstName?: string;

  /** Plan context (for check-in / milestone findings). */
  planId?: string;
  planType?: string;

  /** Milestone day number (Day 30, 60, 90 …) for probation_milestone findings. */
  milestoneDay?: number | null;

  /**
   * Days overdue threshold before a probation_milestone triggers a skip/HR escalation.
   * Loaded from system_settings 'probation_escalation'.milestoneEscalateAfterDays.
   * Defaults to 3 when not provided.
   */
  milestoneEscalateAfterDays?: number;
}

/**
 * Summary returned by runGovernanceSyncSweep for logging.
 */
export interface GovernanceRunResult {
  findingsCollected: number;
  escalationsApplied: number;
  escalationsSkipped: number;
  notificationsSent: number;
}
