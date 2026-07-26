/**
 * Contract Margin Service — unit tests
 *
 * Covers calculateMargins() correctness and validateMarginInputs() enforcement
 * for all contract types.
 *
 * Run: npx tsx --test server/tests/contractMargins.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  calculateMargins,
  validateMarginInputs,
  MarginValidationError,
} from "../services/contractMarginService.js";

// ── Helper ──────────────────────────────────────────────────────────────────

function assertThrowsValidation(fn: () => void, msgFragment: string) {
  try {
    fn();
    assert.fail(`Expected MarginValidationError containing "${msgFragment}"`);
  } catch (e) {
    if (!(e instanceof MarginValidationError)) throw e;
    assert.ok(
      e.message.toLowerCase().includes(msgFragment.toLowerCase()),
      `Expected error message to include "${msgFragment}", got: "${e.message}"`
    );
  }
}

// ── calculateMargins — contract_hourly ──────────────────────────────────────

describe("calculateMargins — contract_hourly", () => {
  it("computes all three margins correctly", () => {
    const result = calculateMargins({
      contractType: "contract_hourly",
      billRate: 100,
      payRate: 70,
      passthroughFee: 5,
      businessMarketingCost: 3,
    });
    assert.equal(result.grossMargin, 30);     // 100 - 70
    assert.equal(result.referralFee, 25);    // 30 - 5
    assert.equal(result.netMargin, 22);      // 25 - 3
  });

  it("returns nulls when bill/pay are missing (live preview path)", () => {
    const result = calculateMargins({ contractType: "contract_hourly" });
    assert.equal(result.grossMargin, null);
    assert.equal(result.referralFee, null);
    assert.equal(result.netMargin, null);
  });

  it("treats absent optional fees as zero", () => {
    const result = calculateMargins({
      contractType: "contract_hourly",
      billRate: 80,
      payRate: 60,
    });
    assert.equal(result.grossMargin, 20);
    assert.equal(result.referralFee, 20); // no passthrough
    assert.equal(result.netMargin, 20);   // no BMC
  });
});

// ── calculateMargins — permanent_placement flat ─────────────────────────────

describe("calculateMargins — permanent_placement (flat)", () => {
  it("computes referralFee and netMargin from flat input", () => {
    const result = calculateMargins({
      contractType: "permanent_placement",
      referralFeeFlat: 15000,
      passthroughFee: 1000,
      businessMarketingCost: 500,
    });
    assert.equal(result.grossMargin, null); // not applicable for perm
    assert.equal(result.referralFee, 15000);
    assert.equal(result.netMargin, 13500); // 15000 - 1000 - 500
  });

  it("returns null netMargin when referralFee is not yet entered", () => {
    const result = calculateMargins({ contractType: "permanent_placement" });
    assert.equal(result.referralFee, null);
    assert.equal(result.netMargin, null);
  });
});

// ── calculateMargins — permanent_placement pct+salary ──────────────────────

describe("calculateMargins — permanent_placement (pct + salary)", () => {
  it("derives referralFee from pct × salary", () => {
    const result = calculateMargins({
      contractType: "permanent_placement",
      referralFeePct: 20,
      candidateAnnualSalary: 75000,
      businessMarketingCost: 500,
    });
    assert.equal(result.referralFee, 15000);  // 20% of 75000
    assert.equal(result.netMargin, 14500);    // 15000 - 500
  });

  it("returns null when pct is given but salary is absent (partial preview)", () => {
    const result = calculateMargins({
      contractType: "permanent_placement",
      referralFeePct: 20,
    });
    assert.equal(result.referralFee, null);
    assert.equal(result.netMargin, null);
  });
});

// ── validateMarginInputs — contract_hourly ──────────────────────────────────

describe("validateMarginInputs — contract_hourly", () => {
  it("passes with valid bill and pay rates", () => {
    assert.doesNotThrow(() => validateMarginInputs({
      contractType: "contract_hourly",
      billRate: 100,
      payRate: 70,
    }));
  });

  it("rejects missing billRate", () => {
    assertThrowsValidation(
      () => validateMarginInputs({ contractType: "contract_hourly", payRate: 70 }),
      "Bill Rate and Pay Rate"
    );
  });

  it("rejects missing payRate", () => {
    assertThrowsValidation(
      () => validateMarginInputs({ contractType: "contract_hourly", billRate: 100 }),
      "Bill Rate and Pay Rate"
    );
  });

  it("rejects payRate > billRate", () => {
    assertThrowsValidation(
      () => validateMarginInputs({ contractType: "contract_hourly", billRate: 50, payRate: 60 }),
      "Pay Rate cannot exceed"
    );
  });

  it("rejects negative rates", () => {
    assertThrowsValidation(
      () => validateMarginInputs({ contractType: "contract_hourly", billRate: -10, payRate: -20 }),
      "non-negative"
    );
  });
});

// ── validateMarginInputs — contract_to_hire ─────────────────────────────────

describe("validateMarginInputs — contract_to_hire", () => {
  it("passes with valid bill and pay rates", () => {
    assert.doesNotThrow(() => validateMarginInputs({
      contractType: "contract_to_hire",
      billRate: 90,
      payRate: 65,
    }));
  });

  it("rejects missing rates", () => {
    assertThrowsValidation(
      () => validateMarginInputs({ contractType: "contract_to_hire" }),
      "Bill Rate and Pay Rate"
    );
  });
});

// ── validateMarginInputs — permanent_placement ──────────────────────────────

describe("validateMarginInputs — permanent_placement", () => {
  it("passes with flat referral fee", () => {
    assert.doesNotThrow(() => validateMarginInputs({
      contractType: "permanent_placement",
      referralFeeFlat: 15000,
    }));
  });

  it("passes with pct + salary", () => {
    assert.doesNotThrow(() => validateMarginInputs({
      contractType: "permanent_placement",
      referralFeePct: 20,
      candidateAnnualSalary: 75000,
    }));
  });

  it("rejects when neither flat nor pct is given", () => {
    assertThrowsValidation(
      () => validateMarginInputs({ contractType: "permanent_placement" }),
      "Referral Fee"
    );
  });

  it("rejects when both flat AND pct are given (mutual exclusivity)", () => {
    assertThrowsValidation(
      () => validateMarginInputs({
        contractType: "permanent_placement",
        referralFeeFlat: 15000,
        referralFeePct: 20,
        candidateAnnualSalary: 75000,
      }),
      "not both"
    );
  });

  it("rejects pct without salary", () => {
    assertThrowsValidation(
      () => validateMarginInputs({
        contractType: "permanent_placement",
        referralFeePct: 20,
      }),
      "Candidate Annual Salary"
    );
  });

  it("rejects pct out of range", () => {
    assertThrowsValidation(
      () => validateMarginInputs({
        contractType: "permanent_placement",
        referralFeePct: 150,
        candidateAnnualSalary: 75000,
      }),
      "between 0 and 100"
    );
  });

  it("rejects negative flat fee", () => {
    assertThrowsValidation(
      () => validateMarginInputs({
        contractType: "permanent_placement",
        referralFeeFlat: -500,
      }),
      "non-negative"
    );
  });
});
