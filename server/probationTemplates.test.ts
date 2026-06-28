import { test } from "node:test";
import assert from "node:assert/strict";
import { parseProbationKey } from "./probationTemplates";
import { normalizeGoalCategory } from "./performanceRoutes";

// Regression guard: legacy probation templates carry goal categories like
// "production" that are NOT in the performance_goals.category enum
// (individual|team|company|development). Every probation goal insert must run
// its category through normalizeGoalCategory or the INSERT fails at runtime.
test("normalizeGoalCategory maps legacy 'production' to a valid enum bucket", () => {
  assert.equal(normalizeGoalCategory("production"), "individual");
});

test("normalizeGoalCategory passes through valid enum values unchanged", () => {
  for (const c of ["individual", "team", "company", "development"]) {
    assert.equal(normalizeGoalCategory(c), c);
  }
});

test("normalizeGoalCategory defaults null/unknown to individual", () => {
  assert.equal(normalizeGoalCategory(null), "individual");
  assert.equal(normalizeGoalCategory(undefined), "individual");
  assert.equal(normalizeGoalCategory("totally_unknown"), "individual");
});

test("Delivery Specialist maps to recruiter, not account_manager", () => {
  const k = parseProbationKey("Delivery Specialist", "IT Staffing");
  assert.equal(k.role, "recruiter");
  assert.equal(k.level, "associate");
  assert.equal(k.department, "it");
});

test("Senior Recruiter maps to recruiter/senior", () => {
  const k = parseProbationKey("Senior Recruiter", "Healthcare");
  assert.equal(k.role, "recruiter");
  assert.equal(k.level, "senior");
  assert.equal(k.department, "healthcare");
});

test("Account Manager maps to account_manager/manager", () => {
  const k = parseProbationKey("Account Manager", "Sales");
  assert.equal(k.role, "account_manager");
  assert.equal(k.level, "manager");
  assert.equal(k.department, "sales_bd");
});

test("Delivery Manager maps to account_manager", () => {
  const k = parseProbationKey("Delivery Manager", "IT");
  assert.equal(k.role, "account_manager");
  assert.equal(k.level, "manager");
});

test("Team Lead maps to lead_recruiter", () => {
  const k = parseProbationKey("Team Lead", "IT");
  assert.equal(k.role, "lead_recruiter");
  assert.equal(k.level, "lead");
});

test("Lead Recruiter maps to lead_recruiter/lead (not recruiter/senior)", () => {
  const k = parseProbationKey("Lead Recruiter", "IT");
  assert.equal(k.role, "lead_recruiter");
  assert.equal(k.level, "lead");
});

test("Assistant Manager - Recruitment maps to lead_recruiter", () => {
  const k = parseProbationKey("Assistant Manager - Recruitment", "Healthcare");
  assert.equal(k.role, "lead_recruiter");
  assert.equal(k.level, "lead");
});

test("Content Writer maps to marketing", () => {
  const k = parseProbationKey("Content Writer", "Marketing");
  assert.equal(k.role, "marketing");
  assert.equal(k.level, "all");
});

test("HR Executive maps to hr_ops", () => {
  const k = parseProbationKey("HR Executive", "HR Operations");
  assert.equal(k.role, "hr_ops");
  assert.equal(k.level, "all");
  assert.equal(k.department, "hr_ops");
});

test("Unknown title in healthcare falls back to recruiter/associate", () => {
  const k = parseProbationKey("Specialist", "Healthcare");
  assert.equal(k.role, "recruiter");
  assert.equal(k.level, "associate");
  assert.equal(k.department, "healthcare");
});

test("Sourcing Associate maps to recruiter", () => {
  const k = parseProbationKey("Sourcing Associate", "IT");
  assert.equal(k.role, "recruiter");
  assert.equal(k.level, "associate");
});
