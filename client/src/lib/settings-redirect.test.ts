import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveSettingsRedirect,
  relocatedSettingsTabTarget,
  DEFAULT_SETTINGS_PATH,
} from "./settings-redirect.ts";

test("maps retained tabs to their new group + tab", () => {
  assert.equal(
    resolveSettingsRedirect("?tab=departments"),
    "/admin/settings/organization?tab=departments",
  );
  assert.equal(
    resolveSettingsRedirect("?tab=company-profile"),
    "/admin/settings/organization?tab=company-profile",
  );
  assert.equal(
    resolveSettingsRedirect("?tab=leave-types"),
    "/admin/settings/leave-attendance?tab=leave-types",
  );
  assert.equal(
    resolveSettingsRedirect("?tab=shifts"),
    "/admin/settings/leave-attendance?tab=shifts",
  );
  assert.equal(
    resolveSettingsRedirect("?tab=salary-advance-policy"),
    "/admin/settings/leave-attendance?tab=salary-advance-policy",
  );
});

test("resolves legacy aliases", () => {
  assert.equal(
    resolveSettingsRedirect("?tab=attendance"),
    "/admin/settings/leave-attendance?tab=attendance-policy",
  );
});

test("redirects relocated tabs to their new home", () => {
  assert.equal(
    resolveSettingsRedirect("?tab=balance-adjustments"),
    "/admin/hr/people?tab=balance-adjustments",
  );
  assert.equal(
    resolveSettingsRedirect("?tab=letter-templates"),
    "/admin/hr/tools?tab=templates",
  );
  assert.equal(
    resolveSettingsRedirect("?tab=whats-new"),
    "/admin/communications?tab=whats-new",
  );
  assert.equal(
    resolveSettingsRedirect("?tab=release-notes"),
    "/admin/communications?tab=release-notes",
  );
});

test("redirects governance + maintenance tabs to Control Tower", () => {
  assert.equal(
    resolveSettingsRedirect("?tab=feature-flags"),
    "/admin/control-tower?tab=feature-flags",
  );
  assert.equal(
    resolveSettingsRedirect("?tab=access-control"),
    "/admin/control-tower?tab=access-control",
  );
  assert.equal(
    resolveSettingsRedirect("?tab=data-maintenance"),
    "/admin/control-tower?tab=data-maintenance",
  );
  assert.equal(
    resolveSettingsRedirect("?tab=training"),
    "/admin/control-tower?tab=feature-flags",
  );
});

test("redirects training + performance config tabs to My Growth", () => {
  assert.equal(
    resolveSettingsRedirect("?tab=rayo-academy"),
    "/admin/growth?tab=training-mgmt",
  );
  assert.equal(
    resolveSettingsRedirect("?tab=performance"),
    "/admin/growth?tab=settings",
  );
  assert.equal(
    resolveSettingsRedirect("?tab=goal-templates"),
    "/admin/growth?tab=settings",
  );
});

test("relocatedSettingsTabTarget resolves relocated tabs and ignores others", () => {
  // Used by grouped HRSettings (e.g. /admin/settings/leave-attendance?tab=...)
  assert.equal(
    relocatedSettingsTabTarget("balance-adjustments"),
    "/admin/hr/people?tab=balance-adjustments",
  );
  assert.equal(
    relocatedSettingsTabTarget("feature-flags"),
    "/admin/control-tower?tab=feature-flags",
  );
  assert.equal(
    relocatedSettingsTabTarget("access-control"),
    "/admin/control-tower?tab=access-control",
  );
  assert.equal(
    relocatedSettingsTabTarget("data-maintenance"),
    "/admin/control-tower?tab=data-maintenance",
  );
  assert.equal(
    relocatedSettingsTabTarget("rayo-academy"),
    "/admin/growth?tab=training-mgmt",
  );
  assert.equal(relocatedSettingsTabTarget("leave-types"), null);
  assert.equal(relocatedSettingsTabTarget("departments"), null);
  assert.equal(relocatedSettingsTabTarget(null), null);
  assert.equal(relocatedSettingsTabTarget(undefined), null);
  assert.equal(relocatedSettingsTabTarget(""), null);
});

test("falls back to default page for unknown tabs", () => {
  for (const tab of ["nonexistent", "made-up-tab"]) {
    assert.equal(resolveSettingsRedirect(`?tab=${tab}`), DEFAULT_SETTINGS_PATH);
  }
});

test("falls back to default page when no tab is present", () => {
  assert.equal(resolveSettingsRedirect(""), DEFAULT_SETTINGS_PATH);
  assert.equal(resolveSettingsRedirect("?foo=bar"), DEFAULT_SETTINGS_PATH);
});
