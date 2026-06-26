import test from "node:test";
import assert from "node:assert/strict";
import {
  isTabVisibleForRole,
  parsePeopleHrTab,
  resolvePeopleHrTab,
  visibleTabDefsForRole,
} from "./people-hr-tabs.ts";

test("parsePeopleHrTab resolves valid tabs regardless of role", () => {
  assert.equal(parsePeopleHrTab("?tab=balance-adjustments"), "balance-adjustments");
  assert.equal(parsePeopleHrTab("?tab=salary"), "salary");
  assert.equal(parsePeopleHrTab("?tab=compliance"), "compliance");
  assert.equal(parsePeopleHrTab("?tab=audit"), "audit");
  assert.equal(parsePeopleHrTab("?tab=exceptions"), "exceptions");
  assert.equal(parsePeopleHrTab("?tab=risk-summary"), "risk-summary");
});

test("parsePeopleHrTab maps the legacy reports alias to salary", () => {
  assert.equal(parsePeopleHrTab("?tab=reports"), "salary");
});

test("parsePeopleHrTab returns null for missing or unknown tabs", () => {
  assert.equal(parsePeopleHrTab(""), null);
  assert.equal(parsePeopleHrTab("?foo=bar"), null);
  assert.equal(parsePeopleHrTab("?tab=nonexistent"), null);
});

test("isTabVisibleForRole enforces gating", () => {
  // hr-gated
  assert.equal(isTabVisibleForRole("balance-adjustments", "hr"), true);
  assert.equal(isTabVisibleForRole("balance-adjustments", "operations"), false);
  assert.equal(isTabVisibleForRole("balance-adjustments", "manager"), false);
  // admin-gated
  assert.equal(isTabVisibleForRole("audit", "admin"), true);
  assert.equal(isTabVisibleForRole("audit", "hr"), false);
  // open to all
  assert.equal(isTabVisibleForRole("users", "operations"), true);
  assert.equal(isTabVisibleForRole("training", "manager"), true);
});

test("resolvePeopleHrTab keeps a deep-linked tab the role can see", () => {
  assert.equal(resolvePeopleHrTab("?tab=balance-adjustments", "hr"), "balance-adjustments");
  assert.equal(resolvePeopleHrTab("?tab=salary", "super_admin"), "salary");
  assert.equal(resolvePeopleHrTab("?tab=audit", "admin"), "audit");
  assert.equal(resolvePeopleHrTab("?tab=reports", "hr"), "salary");
});

test("resolvePeopleHrTab falls back to users when the role cannot see the tab", () => {
  assert.equal(resolvePeopleHrTab("?tab=balance-adjustments", "operations"), "users");
  assert.equal(resolvePeopleHrTab("?tab=audit", "hr"), "users");
  assert.equal(resolvePeopleHrTab("?tab=nonexistent", "super_admin"), "users");
  assert.equal(resolvePeopleHrTab("", "hr"), "users");
});

test("visibleTabDefsForRole returns the right tab sets", () => {
  const opsTabs = visibleTabDefsForRole("operations").map((t) => t.value);
  assert.deepEqual(opsTabs, ["users", "training", "regularizations"]);

  const hrTabs = visibleTabDefsForRole("hr").map((t) => t.value);
  assert.ok(hrTabs.includes("balance-adjustments"));
  assert.ok(hrTabs.includes("salary"));
  assert.ok(!hrTabs.includes("audit"));

  const adminTabs = visibleTabDefsForRole("admin").map((t) => t.value);
  assert.ok(adminTabs.includes("audit"));
});
