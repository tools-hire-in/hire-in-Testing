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
    "/admin/settings/people-access?tab=departments",
  );
  assert.equal(
    resolveSettingsRedirect("?tab=feature-flags"),
    "/admin/settings/features?tab=feature-flags",
  );
  assert.equal(
    resolveSettingsRedirect("?tab=leave-types"),
    "/admin/settings/leave-attendance?tab=leave-types",
  );
  assert.equal(
    resolveSettingsRedirect("?tab=data-maintenance"),
    "/admin/settings/system?tab=data-maintenance",
  );
  assert.equal(
    resolveSettingsRedirect("?tab=company-profile"),
    "/admin/settings/company?tab=company-profile",
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

test("relocatedSettingsTabTarget resolves relocated tabs and ignores others", () => {
  // Used by grouped HRSettings (e.g. /admin/settings/leave-attendance?tab=...)
  assert.equal(
    relocatedSettingsTabTarget("balance-adjustments"),
    "/admin/hr/people?tab=balance-adjustments",
  );
  assert.equal(
    relocatedSettingsTabTarget("letter-templates"),
    "/admin/hr/tools?tab=templates",
  );
  assert.equal(
    relocatedSettingsTabTarget("whats-new"),
    "/admin/communications?tab=whats-new",
  );
  assert.equal(
    relocatedSettingsTabTarget("release-notes"),
    "/admin/communications?tab=release-notes",
  );
  assert.equal(relocatedSettingsTabTarget("leave-types"), null);
  assert.equal(relocatedSettingsTabTarget("departments"), null);
  assert.equal(relocatedSettingsTabTarget(null), null);
  assert.equal(relocatedSettingsTabTarget(undefined), null);
  assert.equal(relocatedSettingsTabTarget(""), null);
});

test("falls back to default page for removed and unknown tabs", () => {
  for (const tab of [
    "performance",
    "goal-templates",
    "nonexistent",
  ]) {
    assert.equal(resolveSettingsRedirect(`?tab=${tab}`), DEFAULT_SETTINGS_PATH);
  }
});

test("falls back to default page when no tab is present", () => {
  assert.equal(resolveSettingsRedirect(""), DEFAULT_SETTINGS_PATH);
  assert.equal(resolveSettingsRedirect("?foo=bar"), DEFAULT_SETTINGS_PATH);
});
