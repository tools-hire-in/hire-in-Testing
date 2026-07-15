/**
 * Governance Pulse API Tests
 *
 * Verifies that:
 *  - GET /api/governance/pulse  returns accurate aggregated counts matching seed data
 *  - GET /api/governance/action-required  returns overdue items with correct urgency ranking
 *  - GET /api/governance/manager/:id/breakdown  returns per-manager compliance data
 *
 * Tests use the shared GovernanceTestHierarchy seed and assert on relative counts
 * (delta from baseline) so they don't depend on whatever pre-existing data lives in the DB.
 *
 * Run: npx tsx --test server/tests/governancePulse.test.ts
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import request from "supertest";

import { db } from "../db.js";
import { sql } from "drizzle-orm";
import { registerGovernanceRoutes } from "../governanceRoutes.js";

import {
  createGovernanceTestHierarchy,
  teardownGovernanceTestHierarchy,
  insertTestControl,
  enableNotificationsFlag,
  restoreNotificationsFlag,
  GC_CEO_ID,
  GC_VP_ID,
  GC_MGR_ID,
  GC_REC_A_ID,
  GC_REC_B_ID,
  GC_HR_ID,
  GC_GOAL_A_ID,
  GC_GOAL_B_ID,
  GC_PIP_PLAN_ID,
  GC_PROB_PLAN_ID,
  GC_CHECKIN_ID,
} from "./helpers/governanceSeed.js";

// ── Build a test Express app with governance routes and a fake HR session ─────

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

// HR app — has access to pulse/action-required/admin endpoints
const hrApp = buildApp(GC_HR_ID, "hr");

// Manager app — can access manager breakdown endpoint
const mgrApp = buildApp(GC_MGR_ID, "manager");

// ── Shared state ──────────────────────────────────────────────────────────────

let notificationsWereEnabled = true;

// Governance control IDs created per test
const testControlIds: string[] = [];

async function cleanTestControls(): Promise<void> {
  if (testControlIds.length > 0) {
    await db.execute(sql`
      DELETE FROM governance_events WHERE control_id IN (
        SELECT id FROM governance_controls
        WHERE owner_id IN (${GC_REC_A_ID}, ${GC_REC_B_ID})
      )
    `);
    await db.execute(sql`
      DELETE FROM governance_controls
      WHERE owner_id IN (${GC_REC_A_ID}, ${GC_REC_B_ID})
    `);
    testControlIds.length = 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite 1: Governance Pulse API
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/governance/pulse — accurate aggregated counts", () => {
  let baselinePulse: any = null;

  before(async () => {
    notificationsWereEnabled = await enableNotificationsFlag();
    await createGovernanceTestHierarchy();

    // Capture baseline BEFORE inserting test controls
    const res = await request(hrApp).get("/api/governance/pulse");
    if (res.status === 200) baselinePulse = res.body;

    // Insert overdue goal controls for RecruiterA (2 goals)
    const cA = await insertTestControl({
      controlType: "goal",
      referenceId: `goal:${GC_GOAL_A_ID}`,
      ownerId: GC_REC_A_ID,
      managerId: GC_MGR_ID,
      dueDate: new Date(Date.now() - 4 * 86_400_000).toISOString().slice(0, 10),
      status: "overdue",
      escalationLevel: 0,
    });
    testControlIds.push(cA);

    const cB = await insertTestControl({
      controlType: "goal",
      referenceId: `goal:${GC_GOAL_B_ID}`,
      ownerId: GC_REC_A_ID,
      managerId: GC_MGR_ID,
      dueDate: new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10),
      status: "overdue",
      escalationLevel: 1,
    });
    testControlIds.push(cB);

    // Insert a check_in type control (overdue milestone check-in)
    const cCI = await insertTestControl({
      controlType: "check_in",
      referenceId: `ci:${GC_CHECKIN_ID}`,
      ownerId: GC_REC_B_ID,
      managerId: GC_MGR_ID,
      dueDate: new Date(Date.now() - 45 * 86_400_000).toISOString().slice(0, 10),
      status: "overdue",
      escalationLevel: 0,
    });
    testControlIds.push(cCI);

    // Insert PIP controls
    const cPIP = await insertTestControl({
      controlType: "pip",
      referenceId: `pip:${GC_PIP_PLAN_ID}`,
      ownerId: GC_REC_A_ID,
      managerId: GC_MGR_ID,
      dueDate: new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10),
      status: "overdue",
      escalationLevel: 0,
    });
    testControlIds.push(cPIP);
  });

  after(async () => {
    await cleanTestControls();
    await teardownGovernanceTestHierarchy();
    await restoreNotificationsFlag(notificationsWereEnabled);
  });

  it("returns 200 with the correct pulse response shape", async () => {
    const res = await request(hrApp).get("/api/governance/pulse");
    assert.equal(res.status, 200, `expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);

    const body = res.body;
    assert.ok(body && typeof body === "object", "response must be an object");
    assert.ok("goals"     in body, "response must have goals key");
    assert.ok("checkins"  in body, "response must have checkins key");
    assert.ok("pip"       in body, "response must have pip key");
    assert.ok("probation" in body, "response must have probation key");
    assert.ok("sop"       in body, "response must have sop key");
  });

  it("goals.overdueCount reflects at least the 2 test overdue goal controls", async () => {
    const res = await request(hrApp).get("/api/governance/pulse");
    assert.equal(res.status, 200);

    const baselineOverdue = baselinePulse?.goals?.overdueCount ?? 0;
    const currentOverdue  = res.body.goals?.overdueCount ?? 0;

    assert.ok(
      currentOverdue >= baselineOverdue + 2,
      `goals.overdueCount must have increased by at least 2 (baseline ${baselineOverdue}, got ${currentOverdue})`
    );
  });

  it("pip.overdue reflects at least the 1 test PIP overdue control", async () => {
    const res = await request(hrApp).get("/api/governance/pulse");
    assert.equal(res.status, 200);

    const baselineOverdue = baselinePulse?.pip?.overdue ?? 0;
    const currentOverdue  = res.body.pip?.overdue ?? 0;

    assert.ok(
      currentOverdue >= baselineOverdue + 1,
      `pip.overdue must have increased by at least 1 (baseline ${baselineOverdue}, got ${currentOverdue})`
    );
  });

  it("pip.byManager groups overdue controls by manager correctly", async () => {
    const res = await request(hrApp).get("/api/governance/pulse");
    assert.equal(res.status, 200);

    const byManager: any[] = res.body.pip?.byManager ?? [];
    const testEntry = byManager.find((e: any) => e.managerId === GC_MGR_ID);
    assert.ok(testEntry, "byManager must contain an entry for the test manager");
    assert.ok(testEntry.count >= 1, "test manager must have at least 1 PIP overdue control");
  });

  it("checkins.overdueCount reflects the probation check-in overdue control", async () => {
    const res = await request(hrApp).get("/api/governance/pulse");
    assert.equal(res.status, 200);

    const baselineOverdue = baselinePulse?.checkins?.overdueCount ?? 0;
    const currentOverdue  = res.body.checkins?.overdueCount ?? 0;

    assert.ok(
      currentOverdue >= baselineOverdue + 1,
      `checkins.overdueCount must have increased by at least 1 (baseline ${baselineOverdue}, got ${currentOverdue})`
    );
  });

  it("returns 401 for unauthenticated request", async () => {
    const publicApp = express();
    publicApp.use(express.json());
    publicApp.use((req: Request, _res: Response, next: NextFunction) => {
      (req as any).session = {};
      next();
    });
    registerGovernanceRoutes(publicApp);

    const res = await request(publicApp).get("/api/governance/pulse");
    assert.equal(res.status, 401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 2: Action-Required endpoint
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/governance/action-required — urgency-ranked overdue items", () => {
  before(async () => {
    await createGovernanceTestHierarchy();

    // Insert overdue controls at different escalation levels (urgency)
    const c1 = await insertTestControl({
      controlType: "goal",
      referenceId: `goal:${GC_GOAL_A_ID}`,
      ownerId: GC_REC_A_ID,
      managerId: GC_MGR_ID,
      dueDate: new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10),
      status: "overdue",
      escalationLevel: 0,
    });
    testControlIds.push(c1);

    const c2 = await insertTestControl({
      controlType: "goal",
      referenceId: `goal:${GC_GOAL_B_ID}`,
      ownerId: GC_REC_A_ID,
      managerId: GC_MGR_ID,
      dueDate: new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10),
      status: "escalated",
      escalationLevel: 2,
    });
    testControlIds.push(c2);
  });

  after(async () => {
    await cleanTestControls();
    await teardownGovernanceTestHierarchy();
  });

  it("returns 200 with an array of overdue/escalated controls", async () => {
    const res = await request(hrApp).get("/api/governance/action-required");
    assert.equal(res.status, 200, `expected 200, got ${res.status}`);
    assert.ok(Array.isArray(res.body), "response must be an array");
  });

  it("includes test controls in the action-required list", async () => {
    const res = await request(hrApp).get("/api/governance/action-required");
    assert.equal(res.status, 200);

    const items: any[] = res.body;
    const testItems = items.filter((i: any) =>
      i.ownerId === GC_REC_A_ID || i.owner_id === GC_REC_A_ID
    );
    assert.ok(testItems.length >= 2, `must include at least 2 test controls; got ${testItems.length}`);
  });

  it("higher escalation_level items appear before lower ones (urgency order)", async () => {
    const res = await request(hrApp).get("/api/governance/action-required");
    assert.equal(res.status, 200);

    const items: any[] = res.body;
    if (items.length < 2) return; // insufficient data to verify order

    let prevLevel = Infinity;
    let prevDate  = "";
    let orderOk   = true;

    for (const item of items) {
      const level = Number(item.escalationLevel ?? item.escalation_level ?? 0);
      const date  = String(item.dueDate ?? item.due_date ?? "");
      if (level > prevLevel) { orderOk = false; break; }
      prevLevel = level;
      prevDate  = date;
    }

    assert.ok(orderOk, "action-required list must be ordered by escalation_level DESC");
  });

  it("returns 403 for employee role", async () => {
    const empApp = buildApp(GC_REC_A_ID, "employee");
    const res = await request(empApp).get("/api/governance/action-required");
    assert.ok(res.status === 403 || res.status === 401, `expected 403 or 401; got ${res.status}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 3: Manager breakdown endpoint
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/governance/manager/:id/breakdown — per-manager compliance breakdown", () => {
  before(async () => {
    await createGovernanceTestHierarchy();

    // Insert controls for both of the manager's direct reports
    const c1 = await insertTestControl({
      controlType: "goal",
      referenceId: `goal:${GC_GOAL_A_ID}`,
      ownerId: GC_REC_A_ID,
      managerId: GC_MGR_ID,
      dueDate: new Date(Date.now() - 4 * 86_400_000).toISOString().slice(0, 10),
      status: "overdue",
      escalationLevel: 0,
    });
    testControlIds.push(c1);

    const c2 = await insertTestControl({
      controlType: "probation",
      referenceId: `ci:${GC_CHECKIN_ID}`,
      ownerId: GC_REC_B_ID,
      managerId: GC_MGR_ID,
      dueDate: new Date(Date.now() - 45 * 86_400_000).toISOString().slice(0, 10),
      status: "overdue",
      escalationLevel: 0,
    });
    testControlIds.push(c2);
  });

  after(async () => {
    await cleanTestControls();
    await teardownGovernanceTestHierarchy();
  });

  it("returns 200 with breakdown data for the test manager", async () => {
    const res = await request(mgrApp).get(`/api/governance/manager/${GC_MGR_ID}/breakdown`);
    assert.equal(res.status, 200, `expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.ok(res.body && typeof res.body === "object", "response must be an object");
  });

  it("breakdown includes summary counts (totalControls, overdueCount)", async () => {
    const res = await request(mgrApp).get(`/api/governance/manager/${GC_MGR_ID}/breakdown`);
    assert.equal(res.status, 200);

    const body = res.body;
    assert.ok("totalControls" in body || "total" in body || "controls" in body,
      "breakdown must include a total controls count field");
    assert.ok(
      "overdueCount" in body || "overdue" in body,
      "breakdown must include an overdue count field"
    );
  });

  it("breakdown reports at least 2 overdue controls for the test manager", async () => {
    const res = await request(mgrApp).get(`/api/governance/manager/${GC_MGR_ID}/breakdown`);
    assert.equal(res.status, 200);

    const overdueCount = Number(
      res.body.overdueCount ?? res.body.overdue ?? 0
    );
    assert.ok(overdueCount >= 2,
      `manager must have at least 2 overdue controls; got ${overdueCount}`
    );
  });

  it("HR role can also access any manager's breakdown", async () => {
    const res = await request(hrApp).get(`/api/governance/manager/${GC_MGR_ID}/breakdown`);
    assert.equal(res.status, 200);
  });

  it("returns 403 or 401 for employee role trying to view manager breakdown", async () => {
    const empApp = buildApp(GC_REC_A_ID, "employee");
    const res = await request(empApp).get(`/api/governance/manager/${GC_MGR_ID}/breakdown`);
    assert.ok(res.status === 403 || res.status === 401,
      `expected 403 or 401; got ${res.status}`
    );
  });
});
