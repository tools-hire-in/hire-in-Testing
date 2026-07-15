/**
 * Governance State Machine Integration Tests
 *
 * Tests the escalation ladder, deduplication, in-flight migration, and notification
 * payload correctness using real DB calls against the test hierarchy.
 *
 * Run: npx tsx --test server/tests/governance.test.ts
 *
 * Key design decisions:
 *  - applyEscalation() is tested directly — it IS the state machine. runGovernanceSyncSweep
 *    delegates everything to applyEscalation, so testing applyEscalation is equivalent.
 *    The full sweep test (Suite 2) explicitly uses runGovernanceSyncSweep to verify
 *    deduplication across the complete pipeline.
 *  - Notifications are verified via the `notifications` table (no mock needed).
 *  - Deduplication is verified via the `governance_events` table (notification_sent events).
 *  - Each suite owns its test data; beforeEach wipes controls/events between tests.
 */

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { applyEscalation, runGovernanceSyncSweep } from "../governanceService.js";
import { db } from "../db.js";
import { sql } from "drizzle-orm";
import type { GovernanceFinding } from "@shared/governanceTypes.js";

import {
  createGovernanceTestHierarchy,
  teardownGovernanceTestHierarchy,
  insertTestControl,
  stampNotificationSent,
  countEvents,
  countNotifications,
  getControl,
  enableNotificationsFlag,
  restoreNotificationsFlag,
  GC_CEO_ID,
  GC_VP_ID,
  GC_MGR_ID,
  GC_REC_A_ID,
  GC_REC_B_ID,
  GC_GOAL_A_ID,
  GC_GOAL_B_ID,
  GC_PIP_PLAN_ID,
  GC_PROB_PLAN_ID,
  GC_CHECKIN_ID,
} from "./helpers/governanceSeed.js";

// ─────────────────────────────────────────────────────────────────────────────
// Suite 1: Escalation state machine — core ladder progression
// ─────────────────────────────────────────────────────────────────────────────

describe("Governance escalation state machine", () => {
  let notificationsWereEnabled = true;

  before(async () => {
    notificationsWereEnabled = await enableNotificationsFlag();
    await createGovernanceTestHierarchy();
  });

  after(async () => {
    await teardownGovernanceTestHierarchy();
    await restoreNotificationsFlag(notificationsWereEnabled);
  });

  beforeEach(async () => {
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
  });

  // ── Test 1: Fresh escalation (Day 1 overdue goal → employee nudge) ─────────
  it("Day 1 overdue goal at level=0 → employee_nudge fires, level advances to 1", async () => {
    const controlId = await insertTestControl({
      controlType: "goal",
      referenceId: `goal:${GC_GOAL_A_ID}`,
      ownerId: GC_REC_A_ID,
      managerId: GC_MGR_ID,
      dueDate: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
      status: "pending",
      escalationLevel: 0,
    });

    const before_ts = Date.now();

    const finding: GovernanceFinding = {
      entityType: "goal",
      entityId: GC_GOAL_A_ID,
      employeeId: GC_REC_A_ID,
      managerId: GC_MGR_ID,
      skipManagerId: GC_VP_ID,
      daysOverdue: 1,
      ctaPath: "/admin/hr?tab=goals",
      entityTitle: "[GovTest] Goal A",
      employeeName: "GovTest RecruiterA",
      planId: GC_PIP_PLAN_ID,
      planType: "pip",
    };

    const result = await applyEscalation(finding);

    assert.ok(result.changed, "applyEscalation must report changed=true");
    assert.equal(result.notificationSent, true);

    const ctrl = await getControl(controlId);
    assert.ok(ctrl, "governance_control must still exist");
    assert.equal(ctrl!.status, "overdue");
    assert.equal(ctrl!.escalationLevel, 1, "escalation_level must advance from 0 to 1");

    const sentEvents = await countEvents(controlId, "notification_sent", before_ts);
    assert.ok(sentEvents >= 1, "notification_sent governance_event must be recorded");

    const empNotifs = await countNotifications(GC_REC_A_ID, before_ts);
    assert.ok(empNotifs >= 1, "employee must receive at least one in-app notification");
  });

  // ── Test 2: Day 3 escalation — manager notification ────────────────────────
  it("Day 3 overdue goal at level=1 → manager_escalation fires, level advances to 2", async () => {
    const controlId = await insertTestControl({
      controlType: "goal",
      referenceId: `goal:${GC_GOAL_A_ID}`,
      ownerId: GC_REC_A_ID,
      managerId: GC_MGR_ID,
      dueDate: new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10),
      status: "overdue",
      escalationLevel: 1,
    });

    const before_ts = Date.now();
    const mgrNotifsBefore = await countNotifications(GC_MGR_ID, 0);

    const finding: GovernanceFinding = {
      entityType: "goal",
      entityId: GC_GOAL_A_ID,
      employeeId: GC_REC_A_ID,
      managerId: GC_MGR_ID,
      skipManagerId: GC_VP_ID,
      daysOverdue: 3,
      ctaPath: "/admin/hr?tab=goals",
      entityTitle: "[GovTest] Goal A",
      employeeName: "GovTest RecruiterA",
      planId: GC_PIP_PLAN_ID,
      planType: "pip",
    };

    const result = await applyEscalation(finding);
    assert.ok(result.changed, "manager_escalation must fire");
    assert.equal(result.notificationSent, true);

    const ctrl = await getControl(controlId);
    assert.equal(ctrl!.escalationLevel, 2, "level must advance to 2");
    assert.equal(ctrl!.status, "escalated");

    const mgrNotifsAfter = await countNotifications(GC_MGR_ID, 0);
    assert.ok(mgrNotifsAfter > mgrNotifsBefore, "manager must receive a new notification");

    // Employee must NOT be re-notified at manager_escalation step
    const empNotifsNew = await countNotifications(GC_REC_A_ID, before_ts);
    assert.equal(empNotifsNew, 0, "employee must NOT be re-notified at manager_escalation step");
  });

  // ── Test 3: Day 6 escalation — skip-level + HR ─────────────────────────────
  it("Day 6 overdue goal at level=2 → skip_escalation fires, VP notified, employee/manager NOT re-notified", async () => {
    const controlId = await insertTestControl({
      controlType: "goal",
      referenceId: `goal:${GC_GOAL_A_ID}`,
      ownerId: GC_REC_A_ID,
      managerId: GC_MGR_ID,
      dueDate: new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10),
      status: "escalated",
      escalationLevel: 2,
    });

    const before_ts = Date.now();
    const vpNotifsBefore  = await countNotifications(GC_VP_ID, 0);
    const mgrNotifsBefore = await countNotifications(GC_MGR_ID, 0);
    const empNotifsBefore = await countNotifications(GC_REC_A_ID, 0);

    const finding: GovernanceFinding = {
      entityType: "goal",
      entityId: GC_GOAL_A_ID,
      employeeId: GC_REC_A_ID,
      managerId: GC_MGR_ID,
      skipManagerId: GC_VP_ID,
      daysOverdue: 6,
      ctaPath: "/admin/hr?tab=goals",
      entityTitle: "[GovTest] Goal A",
      employeeName: "GovTest RecruiterA",
      planId: GC_PIP_PLAN_ID,
      planType: "pip",
    };

    const result = await applyEscalation(finding);
    assert.ok(result.changed, "skip_escalation must fire");
    assert.equal(result.notificationSent, true);

    const ctrl = await getControl(controlId);
    assert.equal(ctrl!.escalationLevel, 3, "level must advance to 3");
    assert.equal(ctrl!.status, "escalated");

    const vpNotifsAfter = await countNotifications(GC_VP_ID, 0);
    assert.ok(vpNotifsAfter > vpNotifsBefore, "skip-level VP must be notified");

    // Employee and manager must NOT be re-notified at skip_escalation step
    const empNotifsNew = await countNotifications(GC_REC_A_ID, before_ts);
    const mgrNotifsNew = await countNotifications(GC_MGR_ID, before_ts);
    assert.equal(empNotifsNew, 0, "employee must NOT be re-notified at skip_escalation");
    assert.equal(mgrNotifsNew, 0, "manager must NOT be re-notified at skip_escalation");
  });

  // ── Test 4: Deduplication — same step within 20h ───────────────────────────
  it("Dedup: calling applyEscalation twice within 20h fires only one notification_sent event", async () => {
    const controlId = await insertTestControl({
      controlType: "goal",
      referenceId: `goal:${GC_GOAL_B_ID}`,
      ownerId: GC_REC_A_ID,
      managerId: GC_MGR_ID,
      dueDate: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
      status: "pending",
      escalationLevel: 0,
    });

    const before_ts = Date.now();

    const finding: GovernanceFinding = {
      entityType: "goal",
      entityId: GC_GOAL_B_ID,
      employeeId: GC_REC_A_ID,
      managerId: GC_MGR_ID,
      skipManagerId: GC_VP_ID,
      daysOverdue: 1,
      entityTitle: "[GovTest] Goal B",
      employeeName: "GovTest RecruiterA",
      planId: GC_PIP_PLAN_ID,
      planType: "pip",
    };

    const first  = await applyEscalation(finding);
    const second = await applyEscalation(finding);

    assert.ok(first.changed,   "first call must fire");
    assert.ok(!second.changed, "second call within 20h must be deduped (changed=false)");

    const sentEvents = await countEvents(controlId, "notification_sent", before_ts);
    assert.equal(sentEvents, 1, "exactly one notification_sent event must exist");

    const ctrl = await getControl(controlId);
    assert.equal(ctrl!.escalationLevel, 1, "level must be 1, not 2 (no double-advance)");
  });

  // ── Test 5: In-flight migration — existing level=1, daysOverdue < threshold ─
  it("In-flight migration: level=1 control with day=1 overdue is not reset or re-notified", async () => {
    const controlId = await insertTestControl({
      controlType: "goal",
      referenceId: `goal:${GC_GOAL_A_ID}`,
      ownerId: GC_REC_A_ID,
      managerId: GC_MGR_ID,
      dueDate: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
      status: "overdue",
      escalationLevel: 1,
    });

    // Simulate: employee_nudge fired 5 hours ago (pre-migration stamp)
    await stampNotificationSent(controlId, "employee_nudge", 5);

    const before_ts = Date.now();

    // Only 1 day overdue — manager_escalation threshold (3 days) not yet reached
    const finding: GovernanceFinding = {
      entityType: "goal",
      entityId: GC_GOAL_A_ID,
      employeeId: GC_REC_A_ID,
      managerId: GC_MGR_ID,
      skipManagerId: GC_VP_ID,
      daysOverdue: 1,
      entityTitle: "[GovTest] Goal A",
      employeeName: "GovTest RecruiterA",
      planId: GC_PIP_PLAN_ID,
      planType: "pip",
    };

    const result = await applyEscalation(finding);

    // resolveEscalationStep: goal + level=1 + daysOverdue=1 < 3 → 'none'
    assert.ok(!result.changed,
      "level=1 + day=1 is below manager_escalation threshold — must be a no-op");

    const ctrl = await getControl(controlId);
    assert.equal(ctrl!.escalationLevel, 1, "escalation_level must remain at 1 (not reset to 0)");
    assert.equal(ctrl!.status, "overdue",  "status must remain overdue (not reset)");

    const newEvents = await countEvents(controlId, "notification_sent", before_ts);
    assert.equal(newEvents, 0, "no new notification_sent events in the in-flight scenario");
  });

  // ── Test 6: Closed control — no re-escalation ──────────────────────────────
  it("Closed control: applyEscalation is a no-op (changed=false, level unchanged)", async () => {
    const controlId = await insertTestControl({
      controlType: "goal",
      referenceId: `goal:${GC_GOAL_A_ID}`,
      ownerId: GC_REC_A_ID,
      managerId: GC_MGR_ID,
      dueDate: new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10),
      status: "closed",
      escalationLevel: 2,
    });

    const before_ts = Date.now();

    const finding: GovernanceFinding = {
      entityType: "goal",
      entityId: GC_GOAL_A_ID,
      employeeId: GC_REC_A_ID,
      managerId: GC_MGR_ID,
      skipManagerId: GC_VP_ID,
      daysOverdue: 10,
      entityTitle: "[GovTest] Goal A",
      employeeName: "GovTest RecruiterA",
      planId: GC_PIP_PLAN_ID,
      planType: "pip",
    };

    const result = await applyEscalation(finding);
    assert.ok(!result.changed, "closed control must never be modified");
    assert.ok(!result.notificationSent);

    const newEvents = await countEvents(controlId, "notification_sent", before_ts);
    assert.equal(newEvents, 0, "no new events on a closed control");

    const ctrl = await getControl(controlId);
    assert.equal(ctrl!.status, "closed", "status must remain closed");
    assert.equal(ctrl!.escalationLevel, 2, "level must remain at 2");
  });

  // ── Test 7: Probation milestone — Day-45 check-in overdue ──────────────────
  it("Probation milestone Day-45 at level=0 → manager_remind fires, manager notified", async () => {
    const controlId = await insertTestControl({
      controlType: "probation",
      referenceId: `ci:${GC_CHECKIN_ID}`,
      ownerId: GC_REC_B_ID,
      managerId: GC_MGR_ID,
      dueDate: new Date(Date.now() - 45 * 86_400_000).toISOString().slice(0, 10),
      status: "pending",
      escalationLevel: 0,
    });

    const before_ts = Date.now();
    const mgrNotifsBefore = await countNotifications(GC_MGR_ID, 0);

    const finding: GovernanceFinding = {
      entityType: "probation_milestone",
      entityId: GC_CHECKIN_ID,
      employeeId: GC_REC_B_ID,
      managerId: GC_MGR_ID,
      skipManagerId: GC_VP_ID,
      daysOverdue: 45,
      milestoneDay: 45,
      milestoneEscalateAfterDays: 3,
      entityTitle: "Day-45 probation milestone",
      employeeName: "GovTest RecruiterB",
      planId: GC_PROB_PLAN_ID,
      planType: "probation",
    };

    const result = await applyEscalation(finding);
    assert.ok(result.changed, "manager_remind must fire for overdue probation milestone");
    assert.equal(result.notificationSent, true);

    const ctrl = await getControl(controlId);
    assert.equal(ctrl!.escalationLevel, 1, "level must advance to 1");
    assert.equal(ctrl!.status, "overdue");

    const mgrNotifsAfter = await countNotifications(GC_MGR_ID, 0);
    assert.ok(mgrNotifsAfter > mgrNotifsBefore, "manager must be notified about the missed check-in");

    const sentEvents = await countEvents(controlId, "notification_sent", before_ts);
    assert.ok(sentEvents >= 1, "notification_sent event must be recorded");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 2: Full sweep deduplication via runGovernanceSyncSweep
// ─────────────────────────────────────────────────────────────────────────────

describe("runGovernanceSyncSweep — full sweep idempotency", () => {
  let notificationsWereEnabled = true;

  before(async () => {
    notificationsWereEnabled = await enableNotificationsFlag();
    await createGovernanceTestHierarchy();
  });

  after(async () => {
    await teardownGovernanceTestHierarchy();
    await restoreNotificationsFlag(notificationsWereEnabled);
  });

  it("Running the full sweep twice within 20h does not double-fire notifications for controls already escalated", async () => {
    const controlId = await insertTestControl({
      controlType: "goal",
      referenceId: `goal:${GC_GOAL_A_ID}`,
      ownerId: GC_REC_A_ID,
      managerId: GC_MGR_ID,
      dueDate: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
      status: "pending",
      escalationLevel: 0,
    });

    // Manually fire the first escalation (applyEscalation is what the sweep delegates to).
    // This simulates the state after the first sweep has already fired the notification.
    const finding: GovernanceFinding = {
      entityType: "goal",
      entityId: GC_GOAL_A_ID,
      employeeId: GC_REC_A_ID,
      managerId: GC_MGR_ID,
      skipManagerId: GC_VP_ID,
      daysOverdue: 1,
      entityTitle: "[GovTest] Goal A",
      employeeName: "GovTest RecruiterA",
      planId: GC_PIP_PLAN_ID,
      planType: "pip",
    };
    const firstResult = await applyEscalation(finding);
    assert.ok(firstResult.changed, "initial escalation must fire");

    const eventsAfterFirst = await countEvents(controlId, "notification_sent", 0);
    assert.ok(eventsAfterFirst >= 1, "at least one notification_sent event after first escalation");

    // Now run the full sweep twice. Both sweeps process the same control, but the 20h
    // dedup guard must prevent re-firing (changed=false for this control).
    const r1 = await runGovernanceSyncSweep();
    const r2 = await runGovernanceSyncSweep();
    assert.ok(typeof r1.findingsCollected === "number", "sweep must return a structured result");
    assert.ok(typeof r2.findingsCollected === "number");

    const eventsAfterSweeps = await countEvents(controlId, "notification_sent", 0);
    assert.equal(
      eventsAfterSweeps,
      eventsAfterFirst,
      "notification_sent count must not increase after sweeps — dedup guard prevents re-fire within 20h"
    );

    // Cleanup this specific control
    await db.execute(sql`DELETE FROM governance_events WHERE control_id = ${controlId}`);
    await db.execute(sql`DELETE FROM governance_controls WHERE id = ${controlId}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 3: Email CTA payload — correct deep-link destinations (anti-regression)
// ─────────────────────────────────────────────────────────────────────────────

describe("Email CTA paths — correct per-escalation-type destinations", () => {
  let notificationsWereEnabled = true;

  before(async () => {
    notificationsWereEnabled = await enableNotificationsFlag();
    await createGovernanceTestHierarchy();
  });

  after(async () => {
    await teardownGovernanceTestHierarchy();
    await restoreNotificationsFlag(notificationsWereEnabled);
  });

  beforeEach(async () => {
    await db.execute(sql`
      DELETE FROM governance_events WHERE control_id IN (
        SELECT id FROM governance_controls WHERE owner_id IN (${GC_REC_A_ID}, ${GC_REC_B_ID})
      )
    `);
    await db.execute(sql`
      DELETE FROM governance_controls WHERE owner_id IN (${GC_REC_A_ID}, ${GC_REC_B_ID})
    `);
  });

  it("Goal escalation notification_sent event records a goals-tab ctaPath (never checkins)", async () => {
    const controlId = await insertTestControl({
      controlType: "goal",
      referenceId: `goal:${GC_GOAL_A_ID}`,
      ownerId: GC_REC_A_ID,
      managerId: GC_MGR_ID,
      dueDate: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
      status: "pending",
      escalationLevel: 0,
    });

    await applyEscalation({
      entityType: "goal",
      entityId: GC_GOAL_A_ID,
      employeeId: GC_REC_A_ID,
      managerId: GC_MGR_ID,
      skipManagerId: GC_VP_ID,
      daysOverdue: 1,
      ctaPath: "/admin/hr?tab=goals",
      entityTitle: "[GovTest] Goal A",
      employeeName: "GovTest RecruiterA",
      planId: GC_PIP_PLAN_ID,
      planType: "pip",
    });

    const r = await db.execute(sql`
      SELECT metadata FROM governance_events
      WHERE control_id = ${controlId}
        AND event_type = 'notification_sent'::governance_event_type
      LIMIT 1
    `);
    assert.ok(r.rows.length > 0, "notification_sent event must exist");
    const meta = (r.rows[0] as any).metadata as Record<string, unknown>;
    const ctaPath = String(meta?.ctaPath ?? "");

    assert.ok(
      ctaPath.includes("goals") || ctaPath.includes("/admin/hr"),
      `goal escalation ctaPath must point to goals area; got: ${ctaPath}`
    );
    assert.ok(
      !ctaPath.includes("checkins"),
      `anti-regression: goal escalation ctaPath must NOT link to checkins tab; got: ${ctaPath}`
    );
  });

  it("Probation milestone notification_sent event records a checkins-tab ctaPath", async () => {
    const controlId = await insertTestControl({
      controlType: "probation",
      referenceId: `ci:${GC_CHECKIN_ID}`,
      ownerId: GC_REC_B_ID,
      managerId: GC_MGR_ID,
      dueDate: new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10),
      status: "pending",
      escalationLevel: 0,
    });

    await applyEscalation({
      entityType: "probation_milestone",
      entityId: GC_CHECKIN_ID,
      employeeId: GC_REC_B_ID,
      managerId: GC_MGR_ID,
      skipManagerId: GC_VP_ID,
      daysOverdue: 3,
      milestoneDay: 45,
      milestoneEscalateAfterDays: 3,
      ctaPath: "/admin/hr/my-team?tab=checkins",
      entityTitle: "Day-45 milestone",
      employeeName: "GovTest RecruiterB",
      planId: GC_PROB_PLAN_ID,
      planType: "probation",
    });

    const r = await db.execute(sql`
      SELECT metadata FROM governance_events
      WHERE control_id = ${controlId}
        AND event_type = 'notification_sent'::governance_event_type
      LIMIT 1
    `);
    assert.ok(r.rows.length > 0, "notification_sent event must exist");
    const meta = (r.rows[0] as any).metadata as Record<string, unknown>;
    const ctaPath = String(meta?.ctaPath ?? "");

    assert.ok(
      ctaPath.includes("checkins"),
      `probation milestone ctaPath must point to checkins tab; got: ${ctaPath}`
    );
  });
});
