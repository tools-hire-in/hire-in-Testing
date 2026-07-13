/**
 * Unit tests for AI Privacy Guard
 *
 * Asserts no prohibited PII fields reach the AI prompt after sanitization.
 * Run with: npx tsx --test tests/aiPrivacyGuard.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeObjectForAI,
  auditPromptForPII,
  sanitizeEmployee,
  buildAnonymizedControlSummary,
} from "../server/services/aiPrivacyGuard";

test("sanitizeObjectForAI strips prohibited top-level fields", () => {
  const input = {
    id: "abc-123",
    firstName: "Alice",
    lastName: "Smith",
    email: "alice@example.com",
    phone: "+919876543210",
    salary: "120000",
    role: "manager",
    departmentName: "Engineering",
  };
  const result = sanitizeObjectForAI(input) as any;
  assert.equal(result.firstName, "[REDACTED]", "firstName must be redacted");
  assert.equal(result.lastName, "[REDACTED]", "lastName must be redacted");
  assert.equal(result.email, "[REDACTED]", "email must be redacted");
  assert.equal(result.phone, "[REDACTED]", "phone must be redacted");
  assert.equal(result.salary, "[REDACTED]", "salary must be redacted");
  assert.equal(result.role, "manager", "non-PII field must pass through");
  assert.equal(result.id, "abc-123", "id must pass through");
  assert.equal(result.departmentName, "Engineering", "departmentName must pass through");
});

test("sanitizeObjectForAI strips nested PII fields", () => {
  const input = {
    employee: { firstName: "Bob", role: "employee", salary: "50000" },
    stats: { daysOverdue: 3, escalationLevel: 1 },
  };
  const result = sanitizeObjectForAI(input) as any;
  assert.equal(result.employee.firstName, "[REDACTED]");
  assert.equal(result.employee.salary, "[REDACTED]");
  assert.equal(result.employee.role, "employee");
  assert.equal(result.stats.daysOverdue, 3);
});

test("sanitizeObjectForAI strips PII inside arrays", () => {
  const input = [
    { firstName: "Alice", email: "a@b.com", role: "hr" },
    { firstName: "Bob", email: "b@c.com", role: "employee" },
  ];
  const result = sanitizeObjectForAI(input) as any[];
  assert.equal(result[0].firstName, "[REDACTED]");
  assert.equal(result[0].email, "[REDACTED]");
  assert.equal(result[0].role, "hr");
  assert.equal(result[1].firstName, "[REDACTED]");
});

test("auditPromptForPII detects email addresses in prompt text", () => {
  const prompt = "Please summarize the status of employee alice@hire.in who is overdue by 3 days.";
  const found = auditPromptForPII(prompt);
  assert.ok(found.includes("__email_address__"), "should detect email in prompt");
});

test("auditPromptForPII returns empty array for clean prompt", () => {
  const prompt = "EMP-001 (manager, Engineering) has a check_in obligation overdue by 3 days at escalation level 1.";
  const found = auditPromptForPII(prompt);
  assert.deepEqual(found, [], "clean anonymized prompt should have no PII findings");
});

test("sanitizeEmployee produces opaque reference code", () => {
  const emp = { id: "real-uuid", role: "employee", designation: "Associate Recruiter", departmentName: "Recruiting" };
  const sanitized = sanitizeEmployee(emp, 42);
  assert.equal(sanitized.ref, "EMP-042");
  assert.equal(sanitized.roleCategory, "staff");
  assert.equal(sanitized.department, "Recruiting");
  assert.ok(!(sanitized as any).id, "original id must not appear");
  assert.ok(!(sanitized as any).designation, "designation must not appear");
});

test("buildAnonymizedControlSummary computes daysOverdue without PII", () => {
  const yesterday = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
  const summary = buildAnonymizedControlSummary({
    controlType: "check_in",
    roleCategory: "manager",
    department: "Engineering",
    dueDate: yesterday,
    escalationLevel: 1,
    status: "overdue",
    requiredAction: "Complete weekly check-in",
  });
  assert.ok(summary.daysOverdue >= 1, "daysOverdue should be >= 1 for yesterday's due date");
  assert.equal(summary.controlType, "check_in");
  assert.equal(summary.roleCategory, "manager");
  assert.ok(!(summary as any).name, "name must not appear in summary");
  assert.ok(!(summary as any).email, "email must not appear in summary");
});

test("auditPromptForPII detects prohibited field names in prompt text", () => {
  const prompt = "The employee's firstName is Alice and their salary is 80000.";
  const found = auditPromptForPII(prompt);
  assert.ok(found.includes("firstName"), "should detect firstName in prompt");
  assert.ok(found.includes("salary"), "should detect salary in prompt");
});
