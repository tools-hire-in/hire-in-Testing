/**
 * RBAC Phase 1 — Access Control Tests
 *
 * Verifies that every protected route in governanceRoutes.ts correctly
 * enforces the ACCESS_REGISTRY role gate (via checkPermission) rather than
 * any inline role array.
 *
 * Tests use a minimal Express app with a fake session (no DB) to keep the
 * suite fast and isolated from data concerns.
 *
 * Run: npx tsx --test server/tests/rbac.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import request from "supertest";

import { ACCESS_REGISTRY, resolveRoles } from "../../shared/accessControl.js";
import { registerGovernanceRoutes } from "../governanceRoutes.js";

// ── Helper: build a minimal Express app with a fake session ──────────────────

function buildApp(userId: string, role: string) {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).session = { userId, role };
    next();
  });
  registerGovernanceRoutes(app);
  return app;
}

const FAKE_USER = "00000000-0000-0000-0000-000000000001";

// ── Suite 1: Registry key coverage ────────────────────────────────────────────

describe("ACCESS_REGISTRY — governance key coverage", () => {
  it("governance.hr covers super_admin, admin, hr", () => {
    const roles = resolveRoles("governance.hr", []);
    assert.ok(roles.includes("super_admin"), "governance.hr must include super_admin");
    assert.ok(roles.includes("admin"), "governance.hr must include admin");
    assert.ok(roles.includes("hr"), "governance.hr must include hr");
    assert.ok(!roles.includes("employee"), "governance.hr must NOT include employee");
    assert.ok(!roles.includes("manager"), "governance.hr must NOT include manager");
  });

  it("governance.manager covers super_admin, admin, hr, operations, manager", () => {
    const roles = resolveRoles("governance.manager", []);
    assert.ok(roles.includes("super_admin"), "governance.manager must include super_admin");
    assert.ok(roles.includes("admin"), "governance.manager must include admin");
    assert.ok(roles.includes("hr"), "governance.manager must include hr");
    assert.ok(roles.includes("operations"), "governance.manager must include operations");
    assert.ok(roles.includes("manager"), "governance.manager must include manager");
    assert.ok(!roles.includes("employee"), "governance.manager must NOT include employee");
  });

  it("hr.checkIns covers super_admin, admin, hr, manager", () => {
    const roles = resolveRoles("hr.checkIns", []);
    assert.ok(roles.includes("super_admin"), "hr.checkIns must include super_admin");
    assert.ok(roles.includes("admin"), "hr.checkIns must include admin");
    assert.ok(roles.includes("hr"), "hr.checkIns must include hr");
    assert.ok(roles.includes("manager"), "hr.checkIns must include manager");
    assert.ok(!roles.includes("employee"), "hr.checkIns must NOT include employee");
  });

  it("governance.ceo covers super_admin, admin", () => {
    const roles = resolveRoles("governance.ceo", []);
    assert.ok(roles.includes("super_admin"), "governance.ceo must include super_admin");
    assert.ok(roles.includes("admin"), "governance.ceo must include admin");
    assert.ok(!roles.includes("hr"), "governance.ceo must NOT include hr alone");
    assert.ok(!roles.includes("employee"), "governance.ceo must NOT include employee");
    assert.ok(!roles.includes("manager"), "governance.ceo must NOT include manager");
  });

  it("admin.myTeam covers super_admin, admin, hr, operations, manager", () => {
    const roles = resolveRoles("admin.myTeam", []);
    assert.ok(roles.includes("super_admin"));
    assert.ok(roles.includes("admin"));
    assert.ok(roles.includes("hr"));
    assert.ok(roles.includes("operations"));
    assert.ok(roles.includes("manager"));
    assert.ok(!roles.includes("employee"));
  });

  it("companyProfile covers only super_admin and admin", () => {
    const roles = resolveRoles("companyProfile", []);
    assert.deepEqual(roles.slice().sort(), ["admin", "super_admin"].sort());
  });

  it("system.allowedDomains covers only super_admin", () => {
    const roles = resolveRoles("system.allowedDomains", []);
    assert.deepEqual(roles, ["super_admin"]);
  });

  it("salaryAdvance.managerApprove covers super_admin, admin, hr, manager", () => {
    const roles = resolveRoles("salaryAdvance.managerApprove", []);
    assert.ok(roles.includes("super_admin"));
    assert.ok(roles.includes("admin"));
    assert.ok(roles.includes("hr"));
    assert.ok(roles.includes("manager"));
    assert.ok(!roles.includes("employee"));
    assert.ok(!roles.includes("operations"));
  });
});

// ── Suite 2: Route-level RBAC enforcement (no DB) ────────────────────────────
// These tests verify that checkPermission correctly rejects unauthorized roles.
// The routes will fail at DB access after the auth check passes — we only care
// about the HTTP status code from the permission layer.

describe("GET /api/governance/pulse — governance.hr gate", () => {
  it("returns 403 for employee role", async () => {
    const app = buildApp(FAKE_USER, "employee");
    const res = await request(app).get("/api/governance/pulse");
    assert.equal(res.status, 403, "employee must be denied");
  });

  it("returns 403 for manager role", async () => {
    const app = buildApp(FAKE_USER, "manager");
    const res = await request(app).get("/api/governance/pulse");
    assert.equal(res.status, 403, "manager must be denied for pulse (governance.hr only)");
  });

  it("returns 403 for operations role", async () => {
    const app = buildApp(FAKE_USER, "operations");
    const res = await request(app).get("/api/governance/pulse");
    assert.equal(res.status, 403, "operations must be denied for pulse");
  });

  it("does NOT return 403 for hr role", async () => {
    const app = buildApp(FAKE_USER, "hr");
    const res = await request(app).get("/api/governance/pulse");
    assert.notEqual(res.status, 403, "hr must be allowed past the permission gate");
  });

  it("does NOT return 403 for admin role", async () => {
    const app = buildApp(FAKE_USER, "admin");
    const res = await request(app).get("/api/governance/pulse");
    assert.notEqual(res.status, 403, "admin must be allowed past the permission gate");
  });

  it("does NOT return 403 for super_admin role", async () => {
    const app = buildApp(FAKE_USER, "super_admin");
    const res = await request(app).get("/api/governance/pulse");
    assert.notEqual(res.status, 403, "super_admin must be allowed past the permission gate");
  });
});

describe("GET /api/governance/my-manager-obligations — governance.manager gate", () => {
  it("returns 403 for employee role", async () => {
    const app = buildApp(FAKE_USER, "employee");
    const res = await request(app).get("/api/governance/my-manager-obligations");
    assert.equal(res.status, 403, "employee must be denied");
  });

  it("does NOT return 403 for manager role", async () => {
    const app = buildApp(FAKE_USER, "manager");
    const res = await request(app).get("/api/governance/my-manager-obligations");
    assert.notEqual(res.status, 403, "manager must be allowed past the permission gate");
  });

  it("does NOT return 403 for operations role", async () => {
    const app = buildApp(FAKE_USER, "operations");
    const res = await request(app).get("/api/governance/my-manager-obligations");
    assert.notEqual(res.status, 403, "operations must be allowed past the permission gate");
  });

  it("does NOT return 403 for hr role", async () => {
    const app = buildApp(FAKE_USER, "hr");
    const res = await request(app).get("/api/governance/my-manager-obligations");
    assert.notEqual(res.status, 403, "hr must be allowed past the permission gate");
  });
});

describe("GET /api/governance/manager-obligations — governance.hr gate", () => {
  it("returns 403 for manager role", async () => {
    const app = buildApp(FAKE_USER, "manager");
    const res = await request(app).get("/api/governance/manager-obligations");
    assert.equal(res.status, 403, "manager must be denied (HR-only view of all managers)");
  });

  it("returns 403 for employee role", async () => {
    const app = buildApp(FAKE_USER, "employee");
    const res = await request(app).get("/api/governance/manager-obligations");
    assert.equal(res.status, 403, "employee must be denied");
  });

  it("does NOT return 403 for hr role", async () => {
    const app = buildApp(FAKE_USER, "hr");
    const res = await request(app).get("/api/governance/manager-obligations");
    assert.notEqual(res.status, 403, "hr must be allowed");
  });
});

describe("GET /api/governance/manager-kpis — governance.hr gate", () => {
  it("returns 403 for manager role", async () => {
    const app = buildApp(FAKE_USER, "manager");
    const res = await request(app).get("/api/governance/manager-kpis");
    assert.equal(res.status, 403, "manager must be denied");
  });

  it("does NOT return 403 for admin role", async () => {
    const app = buildApp(FAKE_USER, "admin");
    const res = await request(app).get("/api/governance/manager-kpis");
    assert.notEqual(res.status, 403, "admin must be allowed");
  });
});

describe("PATCH /api/hr/plans/checkins/:id/cosign — hr.checkIns gate", () => {
  it("returns 403 for employee role", async () => {
    const app = buildApp(FAKE_USER, "employee");
    const res = await request(app).patch("/api/hr/plans/checkins/nonexistent/cosign").send({});
    assert.equal(res.status, 403, "employee must be denied");
  });

  it("does NOT return 403 for manager role", async () => {
    const app = buildApp(FAKE_USER, "manager");
    const res = await request(app).patch("/api/hr/plans/checkins/nonexistent/cosign").send({});
    assert.notEqual(res.status, 403, "manager must be allowed past the permission gate");
  });

  it("does NOT return 403 for hr role", async () => {
    const app = buildApp(FAKE_USER, "hr");
    const res = await request(app).patch("/api/hr/plans/checkins/nonexistent/cosign").send({});
    assert.notEqual(res.status, 403, "hr must be allowed past the permission gate");
  });
});

// ── Suite 3: Unauthenticated access ──────────────────────────────────────────

describe("Unauthenticated requests — 401 for all governance endpoints", () => {
  function buildUnauthApp() {
    const app = express();
    app.use(express.json());
    app.use((req: Request, _res: Response, next: NextFunction) => {
      (req as any).session = {};
      next();
    });
    registerGovernanceRoutes(app);
    return app;
  }

  const unauthApp = buildUnauthApp();

  it("GET /api/governance/pulse returns 401", async () => {
    const res = await request(unauthApp).get("/api/governance/pulse");
    assert.equal(res.status, 401);
  });

  it("GET /api/governance/manager-obligations returns 401", async () => {
    const res = await request(unauthApp).get("/api/governance/manager-obligations");
    assert.equal(res.status, 401);
  });

  it("GET /api/governance/my-manager-obligations returns 401", async () => {
    const res = await request(unauthApp).get("/api/governance/my-manager-obligations");
    assert.equal(res.status, 401);
  });

  it("GET /api/governance/manager-kpis returns 401", async () => {
    const res = await request(unauthApp).get("/api/governance/manager-kpis");
    assert.equal(res.status, 401);
  });
});
