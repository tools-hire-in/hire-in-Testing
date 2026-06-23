/**
 * Salary Advance — access control (final approval must be Super Admin only)
 * Run: npx tsx --test server/tests/salaryAdvanceAccess.test.ts
 *
 * Regression guard: requirePermission must NOT auto-inject super_admin/admin
 * into the fallback roles. Final-approval routes are declared as
 * salaryAdvance.finalApprove -> ["super_admin"] in the access registry, so
 * `admin` (and every non-super_admin role) must be rejected with 403.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { requirePermission } from "../salaryAdvanceRoutes.js";

type MockRes = {
  statusCode: number | null;
  body: unknown;
  status: (code: number) => MockRes;
  json: (b: unknown) => MockRes;
};

function mockRes(): MockRes {
  const res: MockRes = {
    statusCode: null,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(b: unknown) {
      this.body = b;
      return this;
    },
  };
  return res;
}

// Exercise the middleware as a given role and report the outcome.
function run(featureKey: string, fallback: string[], role: string | undefined) {
  const mw = requirePermission(featureKey, ...fallback);
  const req: any = role ? { session: { userId: "u1", role } } : { session: {} };
  const res = mockRes();
  let nextCalled = false;
  mw(req, res as any, () => {
    nextCalled = true;
  });
  return { nextCalled, status: res.statusCode };
}

describe("salary advance access control", () => {
  it("final approval allows super_admin only", () => {
    const allowed = run("salaryAdvance.finalApprove", ["super_admin"], "super_admin");
    assert.equal(allowed.nextCalled, true, "super_admin should pass final approval");
    assert.equal(allowed.status, null);
  });

  it("final approval rejects admin (no privilege escalation)", () => {
    const denied = run("salaryAdvance.finalApprove", ["super_admin"], "admin");
    assert.equal(denied.nextCalled, false, "admin must NOT pass final approval");
    assert.equal(denied.status, 403);
  });

  it("final approval rejects other elevated roles", () => {
    for (const role of ["hr", "finance", "manager", "operations", "recruiter", "employee"]) {
      const denied = run("salaryAdvance.finalApprove", ["super_admin"], role);
      assert.equal(denied.nextCalled, false, `${role} must NOT pass final approval`);
      assert.equal(denied.status, 403);
    }
  });

  it("manager approval allows the declared roles and rejects employee", () => {
    const fallback = ["super_admin", "admin", "hr", "manager"];
    for (const role of fallback) {
      const ok = run("salaryAdvance.managerApprove", fallback, role);
      assert.equal(ok.nextCalled, true, `${role} should pass manager approval`);
    }
    const denied = run("salaryAdvance.managerApprove", fallback, "employee");
    assert.equal(denied.nextCalled, false, "employee must NOT pass manager approval");
    assert.equal(denied.status, 403);
  });

  it("rejects unauthenticated requests with 401", () => {
    const out = run("salaryAdvance.finalApprove", ["super_admin"], undefined);
    assert.equal(out.nextCalled, false);
    assert.equal(out.status, 401);
  });
});
