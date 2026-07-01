import { test } from "node:test";
import assert from "node:assert/strict";
import {
  allowedTowerTabs,
  canAccessControlTower,
  towerLegacyTabRedirect,
  SUPER_ADMIN_TOWER_TABS,
} from "./control-tower-access";

test("super_admin can access every Control Tower tab", () => {
  assert.deepEqual(allowedTowerTabs("super_admin"), SUPER_ADMIN_TOWER_TABS);
  assert.equal(canAccessControlTower("super_admin"), true);
});

test("hr can access only Data Maintenance in Control Tower", () => {
  assert.deepEqual(allowedTowerTabs("hr"), ["data-maintenance"]);
  assert.equal(canAccessControlTower("hr"), true);
});

test("other roles cannot access Control Tower", () => {
  for (const role of ["admin", "operations", "manager", "employee", undefined, null]) {
    assert.deepEqual(allowedTowerTabs(role), [], `role ${role} should have no tabs`);
    assert.equal(canAccessControlTower(role), false, `role ${role} should be denied`);
  }
});

test("hr is denied super-admin-only tabs", () => {
  const hrTabs = allowedTowerTabs("hr");
  for (const t of ["access-control", "audit-logs", "user-management", "communications"] as const) {
    assert.equal(hrTabs.includes(t), false, `hr must not reach ${t}`);
  }
});

test("legacy system-settings deep-link redirects to /admin/settings", () => {
  assert.equal(towerLegacyTabRedirect("system-settings"), "/admin/settings");
  assert.equal(towerLegacyTabRedirect("data-maintenance"), null);
  assert.equal(towerLegacyTabRedirect(null), null);
  assert.equal(towerLegacyTabRedirect(undefined), null);
});
