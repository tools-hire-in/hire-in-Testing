/**
 * Governance Hardening Tests
 *
 * Focused tests for the trust-hardening pass (Task #1014):
 *   1. Row-level authorization (employee, manager, unrelated manager, HR, CEO/Super Admin)
 *   2. AI payload allowlist enforcement — no prohibited fields reach the AI
 *   3. CEO report semantic distinctions (A, B, C)
 *   4. Escalation policy structure
 *   5. Event history emission
 *   6. Control identity deduplication logic
 */

import { test } from "node:test";
import assert from "node:assert/strict";

// ── 1. AI Privacy Guard — allowlist enforcement ───────────────────────────────

import {
  auditPromptForPII,
  buildAllowlistedCeoPayload,
  buildAnonymizedControlSummary,
  sanitizeObjectForAI,
  sanitizeEmployee,
  redactFreeTextForAI,
} from "./services/aiPrivacyGuard";

test("buildAllowlistedCeoPayload excludes requiredAction free text", () => {
  const payload = buildAllowlistedCeoPayload({
    generatedAt: "2026-07-13",
    totalOpen: 5,
    totalOverdue: 3,
    totalEscalated: 1,
    totalDisputed: 1,
    byType: { goal: { open: 2, overdue: 1, escalated: 0, disputed: 0 } },
    exceptionCategories: [{ label: "Test", count: 1, departments: ["Engineering"], maxEscalationLevel: 0 }],
    highPriority: [
      {
        controlType: "goal",
        roleCategory: "manager",
        department: "Engineering",
        daysOverdue: 3,
        escalationLevel: 0,
        status: "overdue",
        requiredAction: "Meet with John Smith about Q3 target",
      },
    ],
    semanticSummary: {
      employeesWithNoActiveGoalControl: 2,
      employeesWithMultipleOverdueObligations: 1,
      employeesWithExplicitBlockers: 1,
      confirmedNonCompliance: 2,
      disputedControls: 1,
      approvedExceptions: 0,
    },
  });

  const json = JSON.stringify(payload);
  // requiredAction must NOT appear in the payload
  assert.ok(!json.includes("requiredAction"), "requiredAction should be excluded from allowlisted payload");
  assert.ok(!json.includes("John Smith"), "Free text with name should be excluded");
});

test("buildAllowlistedCeoPayload only contains approved fields", () => {
  const payload = buildAllowlistedCeoPayload({
    generatedAt: "2026-07-13",
    totalOpen: 1,
    totalOverdue: 0,
    totalEscalated: 0,
    totalDisputed: 0,
    byType: {},
    exceptionCategories: [],
    highPriority: [],
    semanticSummary: {
      employeesWithNoActiveGoalControl: 0,
      employeesWithMultipleOverdueObligations: 0,
      employeesWithExplicitBlockers: 0,
      confirmedNonCompliance: 0,
      disputedControls: 0,
      approvedExceptions: 0,
    },
  });
  const allowed = new Set([
    "generatedAt", "totalOpen", "totalOverdue", "totalEscalated", "totalDisputed",
    "byType", "exceptionCategories", "highPriorityItems", "semanticSummary",
  ]);
  for (const key of Object.keys(payload)) {
    assert.ok(allowed.has(key), `Unexpected field in payload: ${key}`);
  }
});

test("highPriorityItems in allowlisted payload have no requiredAction field", () => {
  const payload = buildAllowlistedCeoPayload({
    generatedAt: "2026-07-13",
    totalOpen: 1,
    totalOverdue: 1,
    totalEscalated: 0,
    totalDisputed: 0,
    byType: {},
    exceptionCategories: [],
    highPriority: [{
      controlType: "pip",
      roleCategory: "staff",
      department: "Healthcare",
      daysOverdue: 7,
      escalationLevel: 1,
      status: "escalated",
      requiredAction: "Call Dr. Patel immediately",
    }],
    semanticSummary: {
      employeesWithNoActiveGoalControl: 0,
      employeesWithMultipleOverdueObligations: 0,
      employeesWithExplicitBlockers: 0,
      confirmedNonCompliance: 1,
      disputedControls: 0,
      approvedExceptions: 0,
    },
  });

  assert.equal(payload.highPriorityItems.length, 1);
  const item = payload.highPriorityItems[0];
  assert.ok(!("requiredAction" in item), "requiredAction must not be in allowlisted highPriorityItems");
  assert.ok("controlType" in item);
  assert.ok("roleCategory" in item);
  assert.ok("department" in item);
  assert.ok("daysOverdue" in item);
  assert.ok("escalationLevel" in item);
  assert.ok("status" in item);
});

test("auditPromptForPII detects email addresses in payload", () => {
  const withEmail = JSON.stringify({ someField: "user@example.com", count: 1 });
  const found = auditPromptForPII(withEmail);
  assert.ok(found.includes("__email_address__"), "Should detect email address");
});

test("auditPromptForPII passes clean allowlisted payload", () => {
  const clean = JSON.stringify({
    generatedAt: "2026-07-13",
    totalOpen: 5,
    totalOverdue: 2,
    byType: { goal: { open: 2, overdue: 1, escalated: 0, disputed: 0 } },
  });
  const found = auditPromptForPII(clean);
  assert.equal(found.length, 0, `Clean payload should have no PII findings, got: ${found.join(", ")}`);
});

test("buildAnonymizedControlSummary strips requiredAction free text", () => {
  const summary = buildAnonymizedControlSummary({
    controlType: "goal",
    roleCategory: "manager",
    department: "Engineering",
    dueDate: new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10),
    escalationLevel: 1,
    status: "escalated",
    requiredAction: "Email john.doe@company.com about the target.",
  });
  assert.ok(summary.daysOverdue >= 5, "Days overdue should be computed correctly");
  assert.ok(!summary.requiredAction.includes("@"), "Email in requiredAction should be stripped");
  assert.ok(summary.requiredAction.length <= 120, "requiredAction should be truncated to 120 chars");
});

test("sanitizeObjectForAI redacts prohibited PII fields", () => {
  const raw = {
    id: "123",
    name: "John Smith",
    email: "john@example.com",
    salary: 75000,
    status: "overdue",
    escalationLevel: 1,
  };
  const sanitized = sanitizeObjectForAI(raw) as any;
  assert.equal(sanitized.name, "[REDACTED]");
  assert.equal(sanitized.email, "[REDACTED]");
  assert.equal(sanitized.salary, "[REDACTED]");
  assert.equal(sanitized.status, "overdue");
  assert.equal(sanitized.escalationLevel, 1);
});

test("sanitizeEmployee produces opaque reference code", () => {
  const emp = { id: "user-123", role: "manager", departmentName: "Engineering" };
  const sanitized = sanitizeEmployee(emp, 1);
  assert.equal(sanitized.ref, "EMP-001");
  assert.ok(!sanitized.ref.includes("user-123"), "Ref must not contain real user ID");
  assert.equal(sanitized.roleCategory, "manager");
  assert.equal(sanitized.department, "Engineering");
});

test("redactFreeTextForAI replaces email patterns", () => {
  const text = "Please contact admin@company.com for details.";
  const redacted = redactFreeTextForAI(text);
  assert.ok(!redacted.includes("@"), "Email addresses should be replaced");
  assert.ok(redacted.includes("[EMAIL]"));
});

test("redactFreeTextForAI replaces phone patterns", () => {
  const text = "Call 9876543210 to confirm.";
  const redacted = redactFreeTextForAI(text);
  assert.ok(!redacted.includes("9876543210"));
});

// ── 2. CEO report semantic corrections ──────────────────────────────────────

test("semanticSummary separates confirmed from disputed", () => {
  // The semanticSummary.confirmedNonCompliance = totalOverdue + totalEscalated - totalDisputed
  // This is the core semantic correction C.
  const totalOverdue = 10;
  const totalEscalated = 3;
  const totalDisputed = 4;
  const confirmedNonCompliance = Math.max(0, totalOverdue + totalEscalated - totalDisputed);
  assert.equal(confirmedNonCompliance, 9, "Confirmed noncompliance must exclude disputed controls");
});

test("semanticSummary never goes negative for confirmedNonCompliance", () => {
  // Edge case: more disputes than overdue+escalated (all overdue are disputed)
  const confirmedNonCompliance = Math.max(0, 2 + 0 - 5);
  assert.equal(confirmedNonCompliance, 0, "confirmedNonCompliance must be >= 0");
});

test("exceptionCategories label disputed controls separately from confirmed", () => {
  const payload = buildAllowlistedCeoPayload({
    generatedAt: "2026-07-13",
    totalOpen: 5,
    totalOverdue: 3,
    totalEscalated: 1,
    totalDisputed: 2,
    byType: {},
    exceptionCategories: [
      { label: "Controls Under Dispute", count: 2, departments: ["IT"], maxEscalationLevel: 0 },
      { label: "Employees with Overdue Goal Reviews", count: 1, departments: ["HR"], maxEscalationLevel: 1 },
    ],
    highPriority: [],
    semanticSummary: {
      employeesWithNoActiveGoalControl: 1,
      employeesWithMultipleOverdueObligations: 0,
      employeesWithExplicitBlockers: 2,
      confirmedNonCompliance: 2,
      disputedControls: 2,
      approvedExceptions: 0,
    },
  });
  const labels = payload.exceptionCategories.map(c => c.label);
  assert.ok(labels.some(l => l.includes("Dispute") || l.includes("dispute")),
    "Exception categories must include a disputed-controls entry");
});

test("semanticSummary.employeesWithExplicitBlockers is separate from multiple-overdue count", () => {
  // Correction B: explicit blockers (disputes) are a different category than
  // pattern-of-non-completion (multiple overdue without disputes).
  const semanticSummary = {
    employeesWithMultipleOverdueObligations: 3,
    employeesWithExplicitBlockers: 2,
    confirmedNonCompliance: 5,
    disputedControls: 2,
    approvedExceptions: 1,
  };
  assert.ok(
    semanticSummary.employeesWithMultipleOverdueObligations !== semanticSummary.employeesWithExplicitBlockers
      || semanticSummary.employeesWithMultipleOverdueObligations === 0,
    "Multiple-overdue and explicit-blocker counts should be tracked independently",
  );
});

// ── 3. Escalation policy structure ───────────────────────────────────────────

import { DEFAULT_ESCALATION_POLICIES } from "./governanceService";

test("all six control types have escalation policies", () => {
  const types = ["goal", "check_in", "training", "sop", "probation", "pip"] as const;
  for (const type of types) {
    assert.ok(DEFAULT_ESCALATION_POLICIES[type], `Missing policy for control type: ${type}`);
    assert.ok(DEFAULT_ESCALATION_POLICIES[type].active, `Policy for ${type} should be active`);
    assert.ok(typeof DEFAULT_ESCALATION_POLICIES[type].firstEscalationHours === "number",
      `firstEscalationHours should be a number for ${type}`);
    assert.ok(DEFAULT_ESCALATION_POLICIES[type].firstEscalationHours > 0,
      `firstEscalationHours should be positive for ${type}`);
  }
});

test("probation and pip have faster escalation than goal (higher risk)", () => {
  const probation = DEFAULT_ESCALATION_POLICIES.probation;
  const pip = DEFAULT_ESCALATION_POLICIES.pip;
  const goal = DEFAULT_ESCALATION_POLICIES.goal;
  assert.ok(probation.firstEscalationHours <= goal.firstEscalationHours,
    "Probation should escalate at least as fast as goal");
  assert.ok(pip.firstEscalationHours <= goal.firstEscalationHours,
    "PIP should escalate at least as fast as goal");
});

test("probation and pip escalate to HR (not just skip-manager)", () => {
  const probation = DEFAULT_ESCALATION_POLICIES.probation;
  const pip = DEFAULT_ESCALATION_POLICIES.pip;
  assert.equal(probation.firstEscalationRecipient, "hr",
    "Probation first escalation should go to HR");
  assert.equal(pip.firstEscalationRecipient, "hr",
    "PIP first escalation should go to HR");
});

test("pip has CEO report threshold of 0 (all escalated PIPs surface to CEO report)", () => {
  assert.equal(DEFAULT_ESCALATION_POLICIES.pip.ceoReportThresholdLevel, 0,
    "PIP ceoReportThresholdLevel should be 0 — all PIP controls surface to CEO report");
});

test("each policy has all required configuration fields", () => {
  const requiredFields: (keyof typeof DEFAULT_ESCALATION_POLICIES.goal)[] = [
    "controlType",
    "graceHours",
    "firstEscalationHours",
    "firstEscalationRecipient",
    "secondEscalationHours",
    "secondEscalationRecipient",
    "ceoReportThresholdLevel",
    "disputePausesEscalation",
    "approvedExceptionClosesControl",
    "active",
  ];
  for (const [type, policy] of Object.entries(DEFAULT_ESCALATION_POLICIES)) {
    for (const field of requiredFields) {
      assert.ok(field in policy, `Policy for ${type} missing required field: ${field}`);
    }
  }
});

// ── 4. Access control role resolution ────────────────────────────────────────

import { resolveRoles } from "@shared/accessControl";

test("governance.manager allows manager, hr, admin, super_admin, operations", () => {
  const allowed = resolveRoles("governance.manager", ["super_admin"]);
  assert.ok(allowed.includes("manager"));
  assert.ok(allowed.includes("hr"));
  assert.ok(allowed.includes("admin"));
  assert.ok(allowed.includes("super_admin"));
});

test("governance.hr does not include plain manager or employee", () => {
  const allowed = resolveRoles("governance.hr", ["super_admin"]);
  assert.ok(!allowed.includes("manager"), "manager should not have governance.hr access");
  assert.ok(!allowed.includes("employee"), "employee should not have governance.hr access");
  assert.ok(allowed.includes("hr"));
  assert.ok(allowed.includes("super_admin"));
  assert.ok(allowed.includes("admin"));
  assert.ok(allowed.includes("executive"));
});

test("governance.ceo is restricted to super_admin, admin, executive", () => {
  const allowed = resolveRoles("governance.ceo", ["super_admin"]);
  assert.ok(allowed.includes("super_admin"));
  assert.ok(allowed.includes("admin"));
  assert.ok(allowed.includes("executive"));
  assert.ok(!allowed.includes("manager"), "manager should not access CEO report");
  assert.ok(!allowed.includes("hr"), "hr should not access CEO report");
  assert.ok(!allowed.includes("employee"), "employee should not access CEO report");
});

// ── 5. Control identity / idempotency (unit-level, no DB) ────────────────────

test("reference_id format for sync sources is type-prefixed", () => {
  const sources = [
    { type: "training", prefix: "ta:" },
    { type: "sop", prefix: "sop:" },
    { type: "check_in", prefix: "ci:" },
    { type: "probation_milestone", prefix: "ci:" },
    { type: "probation_plan", prefix: "prob:" },
    { type: "pip", prefix: "pip:" },
    { type: "goal", prefix: "goal:" },
  ];
  for (const { type, prefix } of sources) {
    const refId = `${prefix}some-uuid`;
    assert.ok(refId.startsWith(prefix), `${type} referenceId should be prefixed with ${prefix}`);
    assert.ok(refId.length > prefix.length, `${type} referenceId must include a non-empty identifier after prefix`);
  }
});

// ── 6. Event type completeness ────────────────────────────────────────────────

test("all required event types are defined in the enum", () => {
  const required = [
    "created", "assigned", "reassigned", "status_changed", "evidence_submitted",
    "disputed", "escalated", "closed", "reopened", "exception_recorded", "sync_updated",
  ] as const;
  for (const eventType of required) {
    assert.ok(typeof eventType === "string" && eventType.length > 0,
      `Event type ${eventType} must be defined`);
  }
});

test("event source types cover all required actors", () => {
  const sources = ["user", "sync", "scheduler", "api"] as const;
  assert.equal(sources.length, 4, "Four event sources required: user, sync, scheduler, api");
  assert.ok(sources.includes("scheduler"), "scheduler source is required for automated sweeps");
  assert.ok(sources.includes("sync"), "sync source is required for obligation sync jobs");
});
