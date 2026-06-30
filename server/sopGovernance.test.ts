import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canTransition,
  addBusinessDays,
  businessDaysBetween,
  REVIEWER_SLA_BUSINESS_DAYS,
  reviewerActionToStatus,
  actionRequiresComment,
  evaluateApprovalGate,
  latestRound,
} from "./sopGovernance";

// ---- Transition legality ----
test("legal forward transitions are allowed", () => {
  assert.ok(canTransition("draft", "in_review"));
  assert.ok(canTransition("in_review", "approved"));
  assert.ok(canTransition("in_review", "changes_requested"));
  assert.ok(canTransition("approved", "published"));
  assert.ok(canTransition("published", "training_assigned"));
  assert.ok(canTransition("published", "acknowledged")); // no-track SOP path
  assert.ok(canTransition("training_assigned", "acknowledged"));
  assert.ok(canTransition("acknowledged", "active"));
  assert.ok(canTransition("active", "under_revision"));
  assert.ok(canTransition("active", "retired"));
});

test("illegal/backwards transitions are rejected", () => {
  assert.ok(!canTransition("draft", "published"));
  assert.ok(!canTransition("draft", "active"));
  assert.ok(!canTransition("retired", "active"));
  assert.ok(!canTransition("approved", "in_review"));
  assert.ok(!canTransition("published", "draft"));
});

// ---- Business-day SLA math ----
test("reviewer SLA is 5 business days", () => {
  assert.equal(REVIEWER_SLA_BUSINESS_DAYS, 5);
});

test("addBusinessDays skips weekends", () => {
  // Mon 2026-06-29 + 5 business days = Mon 2026-07-06
  const mon = new Date("2026-06-29T09:00:00Z");
  const due = addBusinessDays(mon, 5);
  assert.equal(due.getUTCFullYear(), 2026);
  assert.equal(due.getUTCMonth(), 6); // July (0-indexed)
  assert.equal(due.getUTCDate(), 6);
});

test("businessDaysBetween excludes weekends", () => {
  // Fri 2026-07-03 → Mon 2026-07-06 should be 1 business day apart
  const fri = new Date("2026-07-03T09:00:00Z");
  const mon = new Date("2026-07-06T09:00:00Z");
  assert.equal(businessDaysBetween(fri, mon), 1);
});

// ---- Reviewer action mapping ----
test("reviewer action → status mapping", () => {
  assert.equal(reviewerActionToStatus("approve"), "approved");
  assert.equal(reviewerActionToStatus("approve_with_comments"), "approved_with_comments");
  assert.equal(reviewerActionToStatus("request_changes"), "changes_requested");
  assert.equal(reviewerActionToStatus("reject"), "rejected");
});

test("blocking/comment-requiring actions need a comment", () => {
  assert.ok(actionRequiresComment("request_changes"));
  assert.ok(actionRequiresComment("reject"));
  assert.ok(actionRequiresComment("approve_with_comments"));
  assert.ok(!actionRequiresComment("approve"));
});

// ---- Approval gate ----
test("strict approval clears when all reviewers approve", () => {
  const gate = evaluateApprovalGate([
    { status: "approved", dueAt: null, decisionAt: new Date() },
    { status: "approved_with_comments", dueAt: null, decisionAt: new Date() },
  ]);
  assert.ok(gate.strictApprove);
  assert.ok(!gate.noObjectionEligible);
  assert.ok(!gate.hasBlocking);
});

test("gate blocks when any reviewer requests changes", () => {
  const gate = evaluateApprovalGate([
    { status: "approved", dueAt: null, decisionAt: new Date() },
    { status: "changes_requested", dueAt: null, decisionAt: new Date() },
  ]);
  assert.ok(!gate.strictApprove);
  assert.ok(!gate.noObjectionEligible);
  assert.ok(gate.hasBlocking);
});

test("gate stays pending while reviewers are within SLA", () => {
  const future = new Date(Date.now() + 3 * 86400000);
  const gate = evaluateApprovalGate([{ status: "pending", dueAt: future, decisionAt: null }]);
  assert.ok(!gate.strictApprove);
  assert.ok(!gate.noObjectionEligible);
  assert.ok(!gate.hasBlocking);
  assert.equal(gate.pendingCount, 1);
});

test("no-objection: overdue-only pending reviewers are override-eligible but NOT strict", () => {
  const past = new Date(Date.now() - 86400000);
  const gate = evaluateApprovalGate([{ status: "pending", dueAt: past, decisionAt: null }]);
  // Critical: overdue reviewers must NOT count as a strict approval — strict is
  // the only signal that may auto-advance to `approved`. They are only eligible
  // for the override-gated no-objection publish.
  assert.ok(!gate.strictApprove);
  assert.ok(gate.noObjectionEligible);
  assert.ok(!gate.hasBlocking);
  assert.equal(gate.overdueCount, 1);
});

test("partial sign-off with an overdue pending reviewer is override-only, not strict", () => {
  const past = new Date(Date.now() - 86400000);
  const gate = evaluateApprovalGate([
    { status: "approved", dueAt: null, decisionAt: new Date() },
    { status: "pending", dueAt: past, decisionAt: null },
  ]);
  assert.ok(!gate.strictApprove);
  assert.ok(gate.noObjectionEligible);
});

test("no-objection blocked if even one reviewer is still within SLA", () => {
  const past = new Date(Date.now() - 86400000);
  const future = new Date(Date.now() + 86400000);
  const gate = evaluateApprovalGate([
    { status: "pending", dueAt: past, decisionAt: null },
    { status: "pending", dueAt: future, decisionAt: null },
  ]);
  assert.ok(!gate.strictApprove);
  assert.ok(!gate.noObjectionEligible);
});

test("empty reviewer set cannot approve", () => {
  const gate = evaluateApprovalGate([]);
  assert.ok(!gate.strictApprove);
  assert.ok(!gate.noObjectionEligible);
});

// ---- Review-round scoping (resubmission after changes_requested) ----
test("latestRound returns only the highest round's assignments", () => {
  const all = [
    { id: "a", round: 1, status: "changes_requested" },
    { id: "b", round: 1, status: "approved" },
    { id: "c", round: 2, status: "pending" },
    { id: "d", round: 2, status: "approved" },
  ];
  const latest = latestRound(all);
  assert.deepEqual(latest.map((r) => r.id).sort(), ["c", "d"]);
});

test("latestRound treats missing round as 1", () => {
  const all = [{ id: "a", status: "approved" }, { id: "b", status: "pending" }];
  assert.equal(latestRound(all).length, 2);
});

test("resubmitted version is not blocked by a prior round's changes_requested", () => {
  // Round 1 had a blocking decision; round 2 is a clean re-review.
  const all = [
    { id: "r1", round: 1, status: "changes_requested", dueAt: null, decisionAt: new Date() },
    { id: "r2", round: 2, status: "approved", dueAt: null, decisionAt: new Date() },
  ];
  const gate = evaluateApprovalGate(
    latestRound(all).map((r) => ({ status: r.status, dueAt: r.dueAt ?? null, decisionAt: r.decisionAt ?? null })),
  );
  assert.ok(gate.strictApprove);
  assert.ok(!gate.hasBlocking);
});

test("latestRound empty input returns empty", () => {
  assert.deepEqual(latestRound([]), []);
});
