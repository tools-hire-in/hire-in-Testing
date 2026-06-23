/**
 * Salary Advance — payroll recovery reconciliation tests
 * Run: npx tsx --test server/tests/salaryAdvanceRecovery.test.ts
 *
 * Focus: when a month's net pay is insufficient, salaryReport.ts caps the
 * advanceRecovery taken from the run row. applyAdvanceRecoveriesForRun must
 * reconcile against that ACTUAL capped figure — not the full scheduled
 * installment — so outstanding balances stay accurate and advances never
 * close prematurely.
 */

import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";

import { applyAdvanceRecoveriesForRun } from "../salaryAdvanceRoutes.js";
import { storage } from "../storage.js";
import { db } from "../db.js";
import { sql } from "drizzle-orm";

const REQUESTER_ID = "e2c817b3-0921-4034-be9d-ec02642f125f";
const ACTOR_ID = "922352aa-6baa-49db-8e7d-358eb6654a3d";
const YEAR = 2099;
const MONTH = 6;

let requesterEmail = "";
let userEmailMap: Map<string, string>;

async function cleanup() {
  await db.execute(sql`
    DELETE FROM salary_advance_audit_log WHERE advance_id IN (
      SELECT id FROM salary_advance_requests WHERE requester_id = ${REQUESTER_ID} AND reason LIKE '[Test]%'
    )`);
  await db.execute(sql`
    DELETE FROM salary_advance_repayments WHERE advance_id IN (
      SELECT id FROM salary_advance_requests WHERE requester_id = ${REQUESTER_ID} AND reason LIKE '[Test]%'
    )`);
  await db.execute(sql`DELETE FROM salary_advance_requests WHERE requester_id = ${REQUESTER_ID} AND reason LIKE '[Test]%'`);
}

async function makeAdvance(outstanding: number, scheduledAmount: number) {
  const advance = await storage.createSalaryAdvanceWithNumber({
    requesterId: REQUESTER_ID,
    managerId: ACTOR_ID,
    requestedAmount: outstanding.toFixed(2),
    reason: "[Test] recovery reconciliation",
    status: "disbursed",
    approvedAmount: outstanding.toFixed(2),
    repaymentMonths: 5,
    monthlyDeduction: scheduledAmount.toFixed(2),
    outstandingBalance: outstanding.toFixed(2),
    totalRepaid: "0.00",
  } as any);
  await storage.createSalaryAdvanceRepayments([{
    advanceId: advance.id,
    userId: REQUESTER_ID,
    installmentNo: 1,
    year: YEAR,
    month: MONTH,
    scheduledAmount: scheduledAmount.toFixed(2),
  } as any]);
  return advance;
}

describe("applyAdvanceRecoveriesForRun — capped recovery reconciliation", () => {
  before(async () => {
    const user = await storage.getAdminUser(REQUESTER_ID);
    requesterEmail = user?.email || "";
    assert.ok(requesterEmail, "requester must have an email for the run row mapping");
    userEmailMap = new Map([[requesterEmail, REQUESTER_ID]]);
    await cleanup();
  });

  beforeEach(async () => {
    // Isolate each test — otherwise carry-forward rows from prior tests share a
    // month and the oldest-first allocation recovers a different advance.
    await cleanup();
  });

  after(async () => {
    await cleanup();
  });

  it("deducts the ACTUAL capped amount and carries the remainder forward", async () => {
    const advance = await makeAdvance(10000, 2000);
    // Low net-pay month: only ₹500 recoverable instead of the scheduled ₹2000.
    const applied = await applyAdvanceRecoveriesForRun({
      year: YEAR, month: MONTH, salaryRunId: "test-run-capped",
      rows: [{ email: requesterEmail, advanceRecovery: 500 }],
      userEmailMap, actorId: ACTOR_ID,
    });
    assert.equal(applied, 1);

    const updated = await storage.getSalaryAdvance(advance.id);
    assert.equal(Number(updated!.totalRepaid), 500, "repaid should be the capped 500");
    assert.equal(Number(updated!.outstandingBalance), 9500, "outstanding must drop by 500, not 2000");
    assert.equal(updated!.status, "repaying", "must NOT close — outstanding remains");

    const reps = await storage.getSalaryAdvanceRepayments(advance.id);
    const deducted = reps.find(r => r.status === "deducted");
    assert.ok(deducted, "the recovered installment is marked deducted");
    assert.equal(Number(deducted!.deductedAmount), 500, "repayment records the actual partial amount");

    // The unrecovered ₹1500 remainder must be carried forward as a fresh row.
    const carry = reps.find(r => r.status === "scheduled" && Number(r.scheduledAmount) === 1500);
    assert.ok(carry, "remainder of the partial installment is rescheduled forward");
    assert.ok(carry!.year * 12 + carry!.month > YEAR * 12 + MONTH, "carry-forward lands in a later month");
  });

  it("eventually recovers the full balance across multiple capped months", async () => {
    const advance = await makeAdvance(1000, 1000); // single ₹1000 installment
    // Month 1: only ₹400 recoverable.
    await applyAdvanceRecoveriesForRun({
      year: YEAR, month: MONTH, salaryRunId: "test-multi-1",
      rows: [{ email: requesterEmail, advanceRecovery: 400 }],
      userEmailMap, actorId: ACTOR_ID,
    });
    let cur = await storage.getSalaryAdvance(advance.id);
    assert.equal(Number(cur!.outstandingBalance), 600);
    assert.equal(cur!.status, "repaying");

    // The ₹600 remainder is now scheduled in a later month — recover it fully.
    const carry = (await storage.getSalaryAdvanceRepayments(advance.id))
      .find(r => r.status === "scheduled");
    assert.ok(carry, "remainder is scheduled for a future month");
    await applyAdvanceRecoveriesForRun({
      year: carry!.year, month: carry!.month, salaryRunId: "test-multi-2",
      rows: [{ email: requesterEmail, advanceRecovery: 600 }],
      userEmailMap, actorId: ACTOR_ID,
    });
    cur = await storage.getSalaryAdvance(advance.id);
    assert.equal(Number(cur!.outstandingBalance), 0, "balance is fully recovered");
    assert.equal(cur!.status, "closed", "advance auto-closes once outstanding hits zero");
  });

  it("deducts the full installment when net pay covers it", async () => {
    const advance = await makeAdvance(10000, 2000);
    const applied = await applyAdvanceRecoveriesForRun({
      year: YEAR, month: MONTH, salaryRunId: "test-run-full",
      rows: [{ email: requesterEmail, advanceRecovery: 2000 }],
      userEmailMap, actorId: ACTOR_ID,
    });
    assert.equal(applied, 1);

    const updated = await storage.getSalaryAdvance(advance.id);
    assert.equal(Number(updated!.totalRepaid), 2000);
    assert.equal(Number(updated!.outstandingBalance), 8000);
    assert.equal(updated!.status, "repaying");
  });

  it("closes the advance when recovery clears the outstanding balance", async () => {
    const advance = await makeAdvance(1500, 2000);
    const applied = await applyAdvanceRecoveriesForRun({
      year: YEAR, month: MONTH, salaryRunId: "test-run-close",
      // capped at outstanding (1500) even though installment is 2000
      rows: [{ email: requesterEmail, advanceRecovery: 1500 }],
      userEmailMap, actorId: ACTOR_ID,
    });
    assert.equal(applied, 1);

    const updated = await storage.getSalaryAdvance(advance.id);
    assert.equal(Number(updated!.outstandingBalance), 0);
    assert.equal(updated!.status, "closed");
    assert.ok(updated!.closedAt, "closedAt must be set when the advance closes");
  });
});
