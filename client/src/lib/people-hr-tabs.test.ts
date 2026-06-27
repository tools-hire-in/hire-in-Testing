import test from "node:test";
import assert from "node:assert/strict";
import {
  externalRedirectForTab,
  isTabVisibleForRole,
  parsePeopleHrTab,
  relocatedGrowthTab,
  resolvePeopleHrTab,
  visibleTabDefsForRole,
} from "./people-hr-tabs.ts";

test("parsePeopleHrTab resolves valid tabs regardless of role", () => {
  assert.equal(parsePeopleHrTab("?tab=balance-adjustments"), "balance-adjustments");
  assert.equal(parsePeopleHrTab("?tab=salary"), "salary");
  assert.equal(parsePeopleHrTab("?tab=compliance"), "compliance");
  assert.equal(parsePeopleHrTab("?tab=audit"), "audit");
  assert.equal(parsePeopleHrTab("?tab=escalations"), "escalations");
});

test("parsePeopleHrTab merges exceptions + risk-summary into escalations", () => {
  assert.equal(parsePeopleHrTab("?tab=exceptions"), "escalations");
  assert.equal(parsePeopleHrTab("?tab=risk-summary"), "escalations");
});

test("parsePeopleHrTab maps the legacy reports alias to salary", () => {
  assert.equal(parsePeopleHrTab("?tab=reports"), "salary");
});

test("parsePeopleHrTab returns null for missing, unknown, or relocated tabs", () => {
  assert.equal(parsePeopleHrTab(""), null);
  assert.equal(parsePeopleHrTab("?foo=bar"), null);
  assert.equal(parsePeopleHrTab("?tab=nonexistent"), null);
  // training + plans moved to Growth & Learning — no longer People & HR tabs.
  assert.equal(parsePeopleHrTab("?tab=training"), null);
  assert.equal(parsePeopleHrTab("?tab=plans"), null);
});

test("relocatedGrowthTab points moved tabs at the Growth equivalents", () => {
  assert.equal(relocatedGrowthTab("?tab=training"), "training-mgmt");
  assert.equal(relocatedGrowthTab("?tab=plans"), "employee-plans");
  assert.equal(relocatedGrowthTab("?tab=salary"), null);
  assert.equal(relocatedGrowthTab(""), null);
});

test("isTabVisibleForRole enforces gating", () => {
  // hr-gated
  assert.equal(isTabVisibleForRole("balance-adjustments", "hr"), true);
  assert.equal(isTabVisibleForRole("balance-adjustments", "operations"), false);
  assert.equal(isTabVisibleForRole("balance-adjustments", "manager"), false);
  // admin-gated
  assert.equal(isTabVisibleForRole("audit", "admin"), true);
  assert.equal(isTabVisibleForRole("audit", "hr"), false);
  // escalations is hr-gated
  assert.equal(isTabVisibleForRole("escalations", "hr"), true);
  assert.equal(isTabVisibleForRole("escalations", "operations"), false);
  // open to all
  assert.equal(isTabVisibleForRole("users", "operations"), true);
  // regularizations moved out of People & HR (now My Team → Corrections)
  assert.equal(isTabVisibleForRole("regularizations" as any, "operations"), false);
});

test("externalRedirectForTab sends relocated tabs to their new route", () => {
  assert.equal(
    externalRedirectForTab("?tab=regularizations"),
    "/admin/hr/my-team?tab=corrections",
  );
  assert.equal(externalRedirectForTab("?tab=users"), null);
  assert.equal(externalRedirectForTab(""), null);
});

test("resolvePeopleHrTab keeps a deep-linked tab the role can see", () => {
  assert.equal(resolvePeopleHrTab("?tab=balance-adjustments", "hr"), "balance-adjustments");
  assert.equal(resolvePeopleHrTab("?tab=salary", "super_admin"), "salary");
  assert.equal(resolvePeopleHrTab("?tab=audit", "admin"), "audit");
  assert.equal(resolvePeopleHrTab("?tab=reports", "hr"), "salary");
  assert.equal(resolvePeopleHrTab("?tab=exceptions", "hr"), "escalations");
});

test("resolvePeopleHrTab falls back to users when the role cannot see the tab", () => {
  assert.equal(resolvePeopleHrTab("?tab=balance-adjustments", "operations"), "users");
  assert.equal(resolvePeopleHrTab("?tab=audit", "hr"), "users");
  assert.equal(resolvePeopleHrTab("?tab=nonexistent", "super_admin"), "users");
  assert.equal(resolvePeopleHrTab("", "hr"), "users");
});

test("visibleTabDefsForRole returns the right tab sets", () => {
  const opsTabs = visibleTabDefsForRole("operations").map((t) => t.value);
  assert.deepEqual(opsTabs, ["users"]);

  const hrTabs = visibleTabDefsForRole("hr").map((t) => t.value);
  assert.ok(hrTabs.includes("balance-adjustments"));
  assert.ok(hrTabs.includes("salary"));
  assert.ok(hrTabs.includes("escalations"));
  assert.ok(!hrTabs.includes("audit"));
  // moved out of People & HR
  assert.ok(!hrTabs.includes("training" as any));
  assert.ok(!hrTabs.includes("plans" as any));

  const adminTabs = visibleTabDefsForRole("admin").map((t) => t.value);
  assert.ok(adminTabs.includes("audit"));
});
