/**
 * Payroll Engine — Golden Vector Tests (#854-A)
 *
 * Tests the pure computation functions in server/payrollEngine.ts
 * against spec-defined expected outputs.
 *
 * Run: npx tsx --test tests/payrollEngine.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeComponentsFromGross,
  IndiaStatutoryEngine,
  applyWaterfall,
  endOfContributionPeriod,
  rupeesToPaise,
  paiseToRupees,
  type StructureRule,
  type IndiaEmployeeConfig,
  type ResolvedRate,
  type StateDeductionConfig,
} from "../server/payrollEngine";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function R(rupees: number): number {
  return rupeesToPaise(rupees);
}

const NOT_APPLICABLE_COVERAGE = {
  status: "not_applicable" as const,
  applicableFrom: null,
};

const STANDARD_RULES: StructureRule[] = [
  { componentName: "Basic", ruleType: "percent_of_gross", valuePct: 5000, valueFixed: null, referenceComponent: null, lopMode: "proportional", sortOrder: 1 },
  { componentName: "HRA", ruleType: "percent_of_component", valuePct: 5000, valueFixed: null, referenceComponent: "Basic", lopMode: "proportional", sortOrder: 2 },
  { componentName: "Conveyance", ruleType: "fixed", valuePct: null, valueFixed: 160000, referenceComponent: null, lopMode: "fixed", sortOrder: 3 },
  { componentName: "LTA", ruleType: "percent_of_component", valuePct: 833, valueFixed: null, referenceComponent: "Basic", lopMode: "proportional", sortOrder: 4 },
  { componentName: "Special Allowance", ruleType: "residual", valuePct: null, valueFixed: null, referenceComponent: null, lopMode: "proportional", sortOrder: 5 },
];

const INDIA_RATES_EPF_OFF: ResolvedRate[] = [
  { levy: "EPF", key: "employee", valueBps: 1200, minimumPaise: null, maximumPaise: null, rounding: "nearest" },
  { levy: "EPF", key: "ceiling_paise", valueBps: 0, minimumPaise: null, maximumPaise: 1500000, rounding: "nearest" },
  { levy: "EPS", key: "employer", valueBps: 833, minimumPaise: null, maximumPaise: 125000, rounding: "nearest" },
  { levy: "EDLI", key: "employer", valueBps: 50, minimumPaise: null, maximumPaise: 7500, rounding: "nearest" },
  { levy: "ESI", key: "employee", valueBps: 75, minimumPaise: null, maximumPaise: null, rounding: "up" },
  { levy: "ESI", key: "employer", valueBps: 325, minimumPaise: null, maximumPaise: null, rounding: "up" },
  { levy: "ESI", key: "gross_threshold_paise", valueBps: 0, minimumPaise: null, maximumPaise: 2100000, rounding: "nearest" },
  { levy: "ESI", key: "disability_threshold_paise", valueBps: 0, minimumPaise: null, maximumPaise: 2500000, rounding: "nearest" },
];

const PUNJAB_PSDT: StateDeductionConfig = {
  state: "Punjab",
  levyType: "PSDT",
  amountPaise: 20000,
  febAmountPaise: null,
  isFlat: true,
  isRegistered: true,
  deductionMonths: null,
  psdtAnnualThresholdPaise: 25000000,
};

// ---------------------------------------------------------------------------
// endOfContributionPeriod tests
// ---------------------------------------------------------------------------

describe("endOfContributionPeriod", () => {
  it("April is in Apr-Sep window", () => assert.equal(endOfContributionPeriod(2025, 4), "2025-09-30"));
  it("September is in Apr-Sep window", () => assert.equal(endOfContributionPeriod(2025, 9), "2025-09-30"));
  it("October wraps to next year Mar 31", () => assert.equal(endOfContributionPeriod(2025, 10), "2026-03-31"));
  it("December wraps to next year Mar 31", () => assert.equal(endOfContributionPeriod(2025, 12), "2026-03-31"));
  it("January is in Jan-Mar window current year", () => assert.equal(endOfContributionPeriod(2026, 1), "2026-03-31"));
  it("March is in Jan-Mar window current year", () => assert.equal(endOfContributionPeriod(2026, 3), "2026-03-31"));
});

// ---------------------------------------------------------------------------
// GV1: ₹22,000 Punjab JR — EPF off, ESI off (gross > ₹21,000), PSDT ₹200
//      Net = ₹21,800
// ---------------------------------------------------------------------------

describe("GV1: ₹22,000 Punjab JR, full month", () => {
  it("net = ₹21,800", () => {
    const grossPaise = R(22000);
    const workingDays = 22;
    const presentDays = 22;

    const { grossAfterLopPaise } = computeComponentsFromGross(grossPaise, STANDARD_RULES, presentDays, workingDays);
    assert.equal(grossAfterLopPaise, grossPaise, "gross-after-LOP equals gross when full month");

    const employeeConfig: IndiaEmployeeConfig = {
      pfMode: "restricted",
      pfExempt: false,
      state: "Punjab",
      esiCoveredUntil: "2025-09-30",
      esiApplicable: true,
      esiDisability: false,
      esiDailyWageExempt: false,
      epfCoverage: NOT_APPLICABLE_COVERAGE,
      esiCoverage: NOT_APPLICABLE_COVERAGE,
    };

    const lines = IndiaStatutoryEngine.compute(
      { year: 2025, month: 6 },
      [],
      grossAfterLopPaise,
      employeeConfig,
      INDIA_RATES_EPF_OFF,
      PUNJAB_PSDT,
    );

    const employeePF = lines.find(l => l.key === "epf_employee")!;
    const employeeESI = lines.find(l => l.key === "esi_employee")!;
    const psdt = lines.find(l => l.key === "state_deduction")!;

    assert.equal(employeePF.amountPaise, 0, "EPF = 0 (establishment not_applicable)");
    assert.equal(employeeESI.amountPaise, 0, "ESI = 0 (establishment not_applicable)");
    assert.equal(psdt.amountPaise, R(200), "PSDT = ₹200");

    const result = applyWaterfall({
      grossAfterLopPaise,
      statutoryDeductionLines: lines,
      advancesPaise: [],
      otherDeductionsPaise: 0,
    });

    assert.equal(result.netPayPaise, R(21800), `net = ₹21,800 (got ₹${result.netPayPaise / 100})`);
  });
});

// ---------------------------------------------------------------------------
// GV2: ESI boundary — gross = ₹21,000 exactly (covered) vs ₹21,001 (not covered)
// For ESI to apply, establishment must be active AND esiCoveredUntil must cover period.
// We test ESI-active establishment scenario for this vector.
// ---------------------------------------------------------------------------

describe("GV2: ESI boundary", () => {
  const ESI_ACTIVE_COVERAGE = {
    status: "mandatory" as const,
    applicableFrom: "2020-01-01",
  };

  const RATES = INDIA_RATES_EPF_OFF;

  it("gross = ₹21,000 with esiCoveredUntil covering period → ESI deducted", () => {
    const grossPaise = R(21000);
    const config: IndiaEmployeeConfig = {
      pfMode: "restricted", pfExempt: false, state: null,
      esiCoveredUntil: "2025-09-30",
      esiApplicable: true, esiDisability: false, esiDailyWageExempt: false,
      epfCoverage: NOT_APPLICABLE_COVERAGE,
      esiCoverage: ESI_ACTIVE_COVERAGE,
    };
    const lines = IndiaStatutoryEngine.compute({ year: 2025, month: 6 }, [], grossPaise, config, RATES, null);
    const empESI = lines.find(l => l.key === "esi_employee")!;
    // 0.75% of ₹21,000 = ₹157.50 = 15,750 paise exactly → ceil(15750) = 15750 paise
    // (ESI rounds up to nearest paise; 15750 is already an exact integer paise)
    assert.equal(empESI.amountPaise, 15750, `expected 15750 paise, got ${empESI.amountPaise}`);
    assert.ok(empESI.amountPaise > 0, "ESI is deducted when covered");
  });

  it("gross = ₹21,001 with esiCoveredUntil expired → ESI = 0 (not covered)", () => {
    const grossPaise = R(21001);
    const config: IndiaEmployeeConfig = {
      pfMode: "restricted", pfExempt: false, state: null,
      esiCoveredUntil: "2025-03-31",
      esiApplicable: true, esiDisability: false, esiDailyWageExempt: false,
      epfCoverage: NOT_APPLICABLE_COVERAGE,
      esiCoverage: ESI_ACTIVE_COVERAGE,
    };
    const lines = IndiaStatutoryEngine.compute({ year: 2025, month: 6 }, [], grossPaise, config, RATES, null);
    const empESI = lines.find(l => l.key === "esi_employee")!;
    assert.equal(empESI.amountPaise, 0, "ESI = 0 when esiCoveredUntil is before period end");
  });
});

// ---------------------------------------------------------------------------
// GV3: 50% wage floor trigger — Basic 40% of gross → pfBasis bumped to 50%
// ---------------------------------------------------------------------------

describe("GV3: 50% wage floor", () => {
  it("Basic 40% of gross with EPF active → pfBasis = 50% of gross", () => {
    const EPF_ACTIVE = { status: "mandatory" as const, applicableFrom: "2020-01-01" };
    const grossPaise = R(50000);
    const RULES_40: StructureRule[] = [
      { componentName: "Basic", ruleType: "percent_of_gross", valuePct: 4000, valueFixed: null, referenceComponent: null, lopMode: "proportional", sortOrder: 1 },
      { componentName: "HRA", ruleType: "percent_of_component", valuePct: 5000, valueFixed: null, referenceComponent: "Basic", lopMode: "proportional", sortOrder: 2 },
      { componentName: "Special Allowance", ruleType: "residual", valuePct: null, valueFixed: null, referenceComponent: null, lopMode: "proportional", sortOrder: 3 },
    ];

    const { components, grossAfterLopPaise } = computeComponentsFromGross(grossPaise, RULES_40, 22, 22);
    const config: IndiaEmployeeConfig = {
      pfMode: "restricted", pfExempt: false, state: null,
      esiCoveredUntil: null, esiApplicable: false, esiDisability: false, esiDailyWageExempt: false,
      epfCoverage: EPF_ACTIVE,
      esiCoverage: NOT_APPLICABLE_COVERAGE,
    };

    const lines = IndiaStatutoryEngine.compute({ year: 2025, month: 6 }, components, grossAfterLopPaise, config, INDIA_RATES_EPF_OFF, null);
    const empPF = lines.find(l => l.key === "epf_employee")!;

    // Basic = 40% of ₹50,000 = ₹20,000; floor = 50% = ₹25,000; restricted cap ₹15,000
    // pfBasis = min(max(₹20,000, ₹25,000), ₹15,000) = ₹15,000
    // EPF = 12% × ₹15,000 = ₹1,800
    assert.equal(empPF.amountPaise, R(1800), `EPF = ₹1,800 (got ₹${empPF.amountPaise / 100})`);
  });
});

// ---------------------------------------------------------------------------
// GV4: EPS cap — unrestricted mode, Basic > ₹15,000 → EPS = ₹1,250
// ---------------------------------------------------------------------------

describe("GV4: EPS cap in unrestricted mode", () => {
  it("unrestricted, Basic = ₹30,000 → EPS capped at ₹1,250", () => {
    const EPF_ACTIVE = { status: "mandatory" as const, applicableFrom: "2020-01-01" };
    const grossPaise = R(60000);
    const RULES: StructureRule[] = [
      { componentName: "Basic", ruleType: "percent_of_gross", valuePct: 5000, valueFixed: null, referenceComponent: null, lopMode: "proportional", sortOrder: 1 },
      { componentName: "Special Allowance", ruleType: "residual", valuePct: null, valueFixed: null, referenceComponent: null, lopMode: "proportional", sortOrder: 2 },
    ];
    const { components, grossAfterLopPaise } = computeComponentsFromGross(grossPaise, RULES, 22, 22);
    const config: IndiaEmployeeConfig = {
      pfMode: "unrestricted", pfExempt: false, state: null,
      esiCoveredUntil: null, esiApplicable: false, esiDisability: false, esiDailyWageExempt: false,
      epfCoverage: EPF_ACTIVE,
      esiCoverage: NOT_APPLICABLE_COVERAGE,
    };
    const lines = IndiaStatutoryEngine.compute({ year: 2025, month: 6 }, components, grossAfterLopPaise, config, INDIA_RATES_EPF_OFF, null);
    const eps = lines.find(l => l.key === "eps_employer")!;
    // Basic = ₹30,000; pfBasis = max(₹30,000, 50%×₹60,000=₹30,000) = ₹30,000 (no cap in unrestricted)
    // EPS = min(8.33% × ₹30,000, ₹1,250) = min(₹2,499, ₹1,250) = ₹1,250
    assert.equal(eps.amountPaise, R(1250), `EPS = ₹1,250 (got ₹${eps.amountPaise / 100})`);
  });
});

// ---------------------------------------------------------------------------
// GV5: ESI round-up vs EPF nearest diverge
// ---------------------------------------------------------------------------

describe("GV5: ESI round-up vs EPF nearest", () => {
  it("ESI rounds up; EPF rounds to nearest", () => {
    const EPF_ACTIVE = { status: "mandatory" as const, applicableFrom: "2020-01-01" };
    const ESI_ACTIVE = { status: "mandatory" as const, applicableFrom: "2020-01-01" };
    // Gross = ₹18,001 in paise; 0.75% = 135.0075 paise → round up → 136 paise (≠ nearest 135)
    const grossPaise = 1800100;
    const config: IndiaEmployeeConfig = {
      pfMode: "restricted", pfExempt: false, state: null,
      esiCoveredUntil: "2025-09-30",
      esiApplicable: true, esiDisability: false, esiDailyWageExempt: false,
      epfCoverage: EPF_ACTIVE,
      esiCoverage: ESI_ACTIVE,
    };
    const lines = IndiaStatutoryEngine.compute({ year: 2025, month: 6 }, [], grossPaise, config, INDIA_RATES_EPF_OFF, null);
    const empESI = lines.find(l => l.key === "esi_employee")!;
    const empPF = lines.find(l => l.key === "epf_employee")!;

    // ESI: 0.75% × 1,800,100 = 13,500.75 paise → ceil → 13,501
    assert.equal(empESI.amountPaise, Math.ceil(1800100 * 75 / 10000), "ESI rounds up");

    // EPF: pfBasis = max(basic, 50% gross) → but with no components passed, basic = 0
    // pfBasis = 50% × 1,800,100 = 900,050 → cap at 1,500,000 (restricted) → 900,050
    // EPF = 12% × 900,050 = 108,006 paise → nearest → 108,006
    assert.equal(empPF.amountPaise, Math.round(900050 * 1200 / 10000), "EPF rounds to nearest");
    assert.notEqual(empESI.amountPaise % 1, 0.5, "ESI is not a half-paise value");
  });
});

// ---------------------------------------------------------------------------
// GV6: LOP half-month — Earnings sum == grossAfterLOP exactly
// ---------------------------------------------------------------------------

describe("GV6: LOP half-month earnings sum", () => {
  it("11 of 22 days present: sum of components = grossAfterLOP", () => {
    const grossPaise = R(22000);
    const { components, grossAfterLopPaise } = computeComponentsFromGross(grossPaise, STANDARD_RULES, 11, 22);

    const sum = components.reduce((s, c) => s + c.postlopPaise, 0);
    assert.equal(sum, grossAfterLopPaise, `component sum (${sum}) must equal grossAfterLOP (${grossAfterLopPaise})`);
    // grossAfterLOP = 11/22 × ₹22,000 × 100 = ₹11,000 = 1,100,000 paise
    assert.equal(grossAfterLopPaise, R(11000), "grossAfterLOP = ₹11,000");
  });
});

// ---------------------------------------------------------------------------
// GV7: Flat levy not prorated under LOP
// ---------------------------------------------------------------------------

describe("GV7: Flat levy (PSDT ₹200) not prorated by LOP", () => {
  it("10 of 22 days present: PSDT still ₹200", () => {
    const grossPaise = R(22000);
    const { grossAfterLopPaise } = computeComponentsFromGross(grossPaise, STANDARD_RULES, 10, 22);

    const config: IndiaEmployeeConfig = {
      pfMode: "restricted", pfExempt: false, state: "Punjab",
      esiCoveredUntil: null, esiApplicable: false, esiDisability: false, esiDailyWageExempt: false,
      epfCoverage: NOT_APPLICABLE_COVERAGE,
      esiCoverage: NOT_APPLICABLE_COVERAGE,
    };
    const lines = IndiaStatutoryEngine.compute({ year: 2025, month: 6 }, [], grossAfterLopPaise, config, INDIA_RATES_EPF_OFF, PUNJAB_PSDT);
    const psdt = lines.find(l => l.key === "state_deduction")!;
    assert.equal(psdt.amountPaise, R(200), "PSDT ₹200 is never prorated by LOP");
  });
});

// ---------------------------------------------------------------------------
// GV8: EPF = not_applicable: PF = 0 regardless of Basic; ESI evaluates independently
// ---------------------------------------------------------------------------

describe("GV8: EPF not_applicable, ESI evaluates independently", () => {
  it("EPF not_applicable → PF = 0 for everyone; ESI = 0 also (also not_applicable)", () => {
    const grossPaise = R(15000);
    const config: IndiaEmployeeConfig = {
      pfMode: "restricted", pfExempt: false, state: null,
      esiCoveredUntil: "2025-09-30", esiApplicable: true, esiDisability: false, esiDailyWageExempt: false,
      epfCoverage: NOT_APPLICABLE_COVERAGE,
      esiCoverage: NOT_APPLICABLE_COVERAGE,
    };
    const lines = IndiaStatutoryEngine.compute({ year: 2025, month: 6 }, [], grossPaise, config, INDIA_RATES_EPF_OFF, null);
    const empPF = lines.find(l => l.key === "epf_employee")!;
    const empESI = lines.find(l => l.key === "esi_employee")!;
    assert.equal(empPF.amountPaise, 0, "PF = 0 (establishment not covered)");
    assert.equal(empESI.amountPaise, 0, "ESI = 0 (establishment not covered)");
  });
});

// ---------------------------------------------------------------------------
// GV9: Net pay floor — deductions > gross → Net = ₹0
// ---------------------------------------------------------------------------

describe("GV9: Net pay floor", () => {
  it("statutory deductions > gross → net = ₹0", () => {
    const grossAfterLopPaise = R(1000);
    const lines = [
      { key: "epf_employee", labelEn: "EPF", amountPaise: R(1200), isEmployerContribution: false, scheme: "EPF", flags: [] },
    ];
    const result = applyWaterfall({ grossAfterLopPaise, statutoryDeductionLines: lines, advancesPaise: [], otherDeductionsPaise: 0 });
    assert.equal(result.netPayPaise, 0, "net = ₹0 when deductions exceed gross");
  });
});

// ---------------------------------------------------------------------------
// GV10: Advance carry-forward
// ---------------------------------------------------------------------------

describe("GV10: Advance carry-forward and ₹0-gross month", () => {
  it("advance recovery capped at remaining; shortfall recorded", () => {
    const grossAfterLopPaise = R(5000);
    const result = applyWaterfall({
      grossAfterLopPaise,
      statutoryDeductionLines: [],
      advancesPaise: [
        { id: "adv-1", outstandingPaise: R(3000) },
        { id: "adv-2", outstandingPaise: R(4000) },
      ],
      otherDeductionsPaise: 0,
    });
    assert.equal(result.advanceRecoveredPaise, R(5000), "total recovery capped at gross");
    const a1 = result.advanceShortfallByIdPaise.find(a => a.id === "adv-1")!;
    const a2 = result.advanceShortfallByIdPaise.find(a => a.id === "adv-2")!;
    assert.equal(a1.recoveredPaise, R(3000), "advance 1 fully recovered");
    assert.equal(a1.shortfallPaise, 0);
    assert.equal(a2.recoveredPaise, R(2000), "advance 2 partially recovered");
    assert.equal(a2.shortfallPaise, R(2000), "shortfall = ₹2,000");
    assert.equal(result.netPayPaise, 0, "net = ₹0");
  });

  it("₹0-gross month: advance recovery = ₹0, balance unchanged", () => {
    const result = applyWaterfall({
      grossAfterLopPaise: 0,
      statutoryDeductionLines: [],
      advancesPaise: [{ id: "adv-3", outstandingPaise: R(10000) }],
      otherDeductionsPaise: 0,
    });
    assert.equal(result.advanceRecoveredPaise, 0, "no recovery on ₹0-gross month");
    const a = result.advanceShortfallByIdPaise.find(a => a.id === "adv-3")!;
    assert.equal(a.shortfallPaise, R(10000), "full outstanding carries forward");
  });
});

// ---------------------------------------------------------------------------
// Additional: Standard structure LTA = 8.33% (fraction rounding)
// ---------------------------------------------------------------------------

describe("Standard structure component values at full month", () => {
  it("₹22,000 gross: components and residual are non-negative and sum to gross", () => {
    const grossPaise = R(22000);
    const { components, grossAfterLopPaise, flags } = computeComponentsFromGross(grossPaise, STANDARD_RULES, 22, 22);

    assert.equal(flags.length, 0, "no flags for clean full-month computation");
    const byName = new Map(components.map(c => [c.name, c]));
    const basic = byName.get("Basic")!;
    const hra = byName.get("HRA")!;
    const conv = byName.get("Conveyance")!;
    const lta = byName.get("LTA")!;
    const special = byName.get("Special Allowance")!;

    assert.equal(basic.postlopPaise, R(11000), "Basic = ₹11,000");
    assert.equal(hra.postlopPaise, R(5500), "HRA = ₹5,500 (50% of Basic)");
    assert.equal(conv.postlopPaise, R(1600), "Conveyance = ₹1,600 (fixed)");
    // LTA = 8.33% of ₹11,000 = ₹916.3 → round → ₹916 (91600 paise)
    assert.equal(lta.postlopPaise, Math.round(1100000 * 833 / 10000), `LTA = ${Math.round(1100000 * 833 / 10000)} paise`);
    assert.ok(special.postlopPaise >= 0, "Special Allowance is non-negative");

    const sum = components.reduce((s, c) => s + c.postlopPaise, 0);
    assert.equal(sum, grossAfterLopPaise, "components sum equals grossAfterLOP");
  });
});
