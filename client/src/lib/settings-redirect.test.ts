import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveSettingsRedirect, DEFAULT_SETTINGS_PATH } from "./settings-redirect.ts";

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

test("falls back to default page for relocated/removed and unknown tabs", () => {
  for (const tab of [
    "balance-adjustments",
    "performance",
    "whats-new",
    "release-notes",
    "letter-templates",
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
