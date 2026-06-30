// ─────────────────────────────────────────────────────────────────────────────
// SOP Governance lifecycle service (Task #661)
//
// Enforces the legal SOP lifecycle order and houses the reusable bits of the
// review/approval flow. This is NOT a new workflow engine — it sits on top of the
// existing sop_documents versioning, the sop_review_assignments table (mirrors the
// Studio review-assignment shape) and the signature ledger. The business-days SLA
// math mirrors the Studio analytics calculation.
// ─────────────────────────────────────────────────────────────────────────────

export type SopLifecycleStatus =
  | "draft"
  | "in_review"
  | "changes_requested"
  | "approved"
  | "published"
  | "training_assigned"
  | "acknowledged"
  | "active"
  | "under_revision"
  | "retired";

// Legal forward transitions. A transition not listed here is illegal and the
// service throws. Editing a published/active version is handled separately by
// storage.updateSopDocument (which clones a new draft) — not modeled here.
const TRANSITIONS: Record<SopLifecycleStatus, SopLifecycleStatus[]> = {
  draft: ["in_review"],
  in_review: ["changes_requested", "approved"],
  changes_requested: ["in_review", "draft"],
  approved: ["published"],
  published: ["training_assigned", "acknowledged", "active"],
  training_assigned: ["acknowledged", "active"],
  acknowledged: ["active"],
  active: ["under_revision", "retired"],
  under_revision: ["in_review", "retired"],
  retired: [],
};

export function canTransition(from: SopLifecycleStatus, to: SopLifecycleStatus): boolean {
  return (TRANSITIONS[from] ?? []).includes(to);
}

export function assertTransition(from: SopLifecycleStatus, to: SopLifecycleStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal SOP transition: ${from} → ${to}`);
  }
}

// Whole, inclusive business days between two dates (excludes Sat/Sun). Mirrors the
// Studio analytics businessDaysBetween implementation.
export function businessDaysBetween(start: Date, end: Date): number {
  if (end <= start) return 0;
  const totalDays = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
  const fullWeeks = Math.floor(totalDays / 7);
  let business = fullWeeks * 5;
  let remaining = totalDays - fullWeeks * 7;
  let cursor = new Date(start.getTime() + fullWeeks * 7 * 24 * 60 * 60 * 1000);
  while (remaining > 0) {
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) business += 1;
    remaining -= 1;
  }
  return business;
}

// Add N business days to a date (skips weekends). Used for the 5-business-day
// reviewer SLA when assigning reviews.
export function addBusinessDays(start: Date, days: number): Date {
  const cursor = new Date(start.getTime());
  let added = 0;
  while (added < days) {
    cursor.setDate(cursor.getDate() + 1);
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) added += 1;
  }
  return cursor;
}

export const REVIEWER_SLA_BUSINESS_DAYS = 5;

// Reviewer actions and the assignment status they resolve to. "comment" leaves a
// thread comment without a decision (handled by the comment side-table, not here).
export type ReviewerAction =
  | "mark_reviewed"
  | "approve"
  | "approve_with_comments"
  | "request_changes"
  | "reject";

export const REVIEWER_ACTIONS: ReviewerAction[] = [
  "mark_reviewed",
  "approve",
  "approve_with_comments",
  "request_changes",
  "reject",
];

const ACTION_TO_STATUS: Record<ReviewerAction, string> = {
  mark_reviewed: "reviewed",
  approve: "approved",
  approve_with_comments: "approved_with_comments",
  request_changes: "changes_requested",
  reject: "rejected",
};

export function reviewerActionToStatus(action: ReviewerAction): string {
  return ACTION_TO_STATUS[action];
}

// Actions that require an accompanying comment.
export function actionRequiresComment(action: ReviewerAction): boolean {
  return action === "request_changes" || action === "reject" || action === "approve_with_comments";
}

// An assignment counts as a positive sign-off (clears the path to approval) when
// the reviewer approved (with or without comments) or simply marked it reviewed.
export function isPositiveDecision(status: string): boolean {
  return status === "approved" || status === "approved_with_comments" || status === "reviewed";
}

export function isBlockingDecision(status: string): boolean {
  return status === "changes_requested" || status === "rejected";
}

export interface ReviewAssignmentLike {
  status: string;
  dueAt: Date | null;
  decisionAt: Date | null;
}

// Filter a mixed set of review assignments down to the latest review round only.
// The approval gate must ignore decisions from superseded rounds so a SOP that
// was resubmitted after changes_requested is not permanently blocked by the old
// round's blocking decision.
export function latestRound<T extends { round?: number | null }>(assignments: T[]): T[] {
  if (assignments.length === 0) return [];
  const max = assignments.reduce((m, a) => Math.max(m, a.round ?? 1), 0);
  return assignments.filter((a) => (a.round ?? 1) === max);
}

export interface ApprovalGate {
  // STRICT approval: every reviewer positively signed off, none still pending,
  // and nobody requested changes. This is the ONLY condition that may auto-
  // advance a SOP to `approved` (see /review-action). It never depends on the
  // SLA clock, so it cannot be triggered by reviewers simply going overdue.
  strictApprove: boolean;
  // NO-OBJECTION eligibility: no blocking decision, but the only outstanding
  // reviewers are all overdue. This is a privileged override path — it must be
  // gated on an override role (CEO/Super Admin) and consumed ONLY in /publish.
  // It must NEVER drive an auto-transition to `approved`.
  noObjectionEligible: boolean;
  // Any reviewer requested changes / rejected → must return to changes_requested.
  hasBlocking: boolean;
  // Reviewers still pending (no decision yet).
  pendingCount: number;
  // Pending reviewers whose due date has passed.
  overdueCount: number;
}

// Evaluate whether the set of reviewer assignments permits approval. `now` lets
// callers test deterministically.
export function evaluateApprovalGate(
  assignments: ReviewAssignmentLike[],
  now: Date = new Date(),
): ApprovalGate {
  let pendingCount = 0;
  let overdueCount = 0;
  let hasBlocking = false;
  let hasPositive = false;

  for (const a of assignments) {
    if (isBlockingDecision(a.status)) {
      hasBlocking = true;
      continue;
    }
    if (isPositiveDecision(a.status)) {
      hasPositive = true;
      continue;
    }
    // pending
    pendingCount += 1;
    if (a.dueAt && a.dueAt.getTime() < now.getTime()) overdueCount += 1;
  }

  // Strict: everyone has signed off positively, no one pending, none blocking.
  // This is SLA-independent and safe for automatic transitions.
  const strictApprove =
    assignments.length > 0 && !hasBlocking && pendingCount === 0 && hasPositive;

  // No-objection: nothing blocking, but there ARE outstanding reviewers and
  // every one of them is overdue. This is an override-only path, never automatic.
  const noObjectionEligible =
    assignments.length > 0 &&
    !hasBlocking &&
    pendingCount > 0 &&
    pendingCount === overdueCount;

  return { strictApprove, noObjectionEligible, hasBlocking, pendingCount, overdueCount };
}
