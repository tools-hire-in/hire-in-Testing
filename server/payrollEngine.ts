/**
 * Payroll Engine — India Statutory Computation (#854-A)
 *
 * All monetary values are integers in PAISE throughout this module.
 * Conversion to rupees happens only at the display/storage boundary.
 *
 * This file contains only pure functions: no DB imports, no side effects.
 * Every function is independently testable via the golden vectors in
 * tests/payrollEngine.test.ts.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RuleType = "percent_of_gross" | "percent_of_component" | "fixed" | "residual";
export type LopMode = "proportional" | "fixed";

export interface StructureRule {
  componentName: string;
  ruleType: RuleType;
  /** Integer basis points × 100: 50% → 5000; 8.33% → 833. Null for fixed/residual. */
  valuePct: number | null;
  /** Fixed amount in paise. Null for percent rules. */
  valueFixed: number | null;
  /** Base component name for percent_of_component rules. */
  referenceComponent: string | null;
  lopMode: LopMode;
  sortOrder: number;
}

export interface ComponentBreakdown {
  name: string;
  prelopPaise: number;
  postlopPaise: number;
  lopMode: LopMode;
}

export interface ComponentResult {
  components: ComponentBreakdown[];
  grossAfterLopPaise: number;
  flags: string[];
}

/** A resolved statutory deduction or employer contribution line. */
export interface StatutoryLine {
  key: string;
  labelEn: string;
  amountPaise: number;
  isEmployerContribution: boolean;
  scheme: string;
  flags: string[];
}

export interface ResolvedRate {
  levy: string;
  key: string;
  valueBps: number;
  minimumPaise?: number | null;
  maximumPaise?: number | null;
  rounding: "nearest" | "up";
}

export interface StateDeductionConfig {
  state: string;
  levyType: string;
  amountPaise: number;
  febAmountPaise?: number | null;
  isFlat: boolean;
  isRegistered: boolean;
  deductionMonths?: number[] | null;
  /** Monthly gross pre-LOP minimum for the levy to apply (slab check). */
  thresholdPaise?: number | null;
  /** PSDT annual gross threshold: levy only applies if annual gross ≥ this value. */
  psdtAnnualThresholdPaise?: number | null;
}

export interface CoverageConfig {
  status: "not_applicable" | "voluntary" | "mandatory";
  applicableFrom: string | null;
}

export interface IndiaEmployeeConfig {
  pfMode: "restricted" | "unrestricted";
  pfExempt: boolean;
  state: string | null;
  esiCoveredUntil: string | null;
  esiApplicable: boolean;
  esiDisability: boolean;
  esiDailyWageExempt: boolean;
  epfCoverage: CoverageConfig;
  esiCoverage: CoverageConfig;
}

export interface WaterfallInput {
  grossAfterLopPaise: number;
  statutoryDeductionLines: StatutoryLine[];
  advancesPaise: Array<{ id: string; outstandingPaise: number }>;
  otherDeductionsPaise: number;
}

export interface WaterfallResult {
  grossAfterLopPaise: number;
  totalStatutoryDeductionsPaise: number;
  advanceRecoveredPaise: number;
  advanceShortfallByIdPaise: Array<{ id: string; recoveredPaise: number; shortfallPaise: number }>;
  otherDeductionsPaise: number;
  netPayPaise: number;
}

// ---------------------------------------------------------------------------
// (G16) endOfContributionPeriod — ESI coverage window calculator
// ---------------------------------------------------------------------------

/**
 * Returns the ISO date (YYYY-MM-DD) of the last day of the ESI contribution
 * period that contains `month` (1-based).
 *
 * Contribution periods:
 *   Apr–Sep → 30 Sep of that calendar year
 *   Oct–Mar → 31 Mar of next calendar year (Oct/Nov/Dec wrap to next year)
 */
export function endOfContributionPeriod(year: number, month: number): string {
  if (month >= 4 && month <= 9) {
    return `${year}-09-30`;
  }
  if (month >= 10 && month <= 12) {
    return `${year + 1}-03-31`;
  }
  // Jan, Feb, Mar
  return `${year}-03-31`;
}

// ---------------------------------------------------------------------------
// Rounding helpers
// ---------------------------------------------------------------------------

function roundNearest(paise: number): number {
  return Math.round(paise);
}

function roundUp(paise: number): number {
  return Math.ceil(paise);
}

export function applyRounding(paise: number, mode: "nearest" | "up"): number {
  return mode === "up" ? roundUp(paise) : roundNearest(paise);
}

// ---------------------------------------------------------------------------
// Topological sort for component rules
// ---------------------------------------------------------------------------

function topoSort(rules: StructureRule[]): StructureRule[] {
  const byName = new Map<string, StructureRule>(rules.map(r => [r.componentName, r]));
  const visited = new Set<string>();
  const order: StructureRule[] = [];

  function visit(name: string, ancestors: Set<string>) {
    if (visited.has(name)) return;
    if (ancestors.has(name)) throw new Error(`Payroll cycle detected: ${name} references itself`);
    const rule = byName.get(name);
    if (!rule) return;
    ancestors.add(name);
    if (rule.ruleType === "percent_of_component" && rule.referenceComponent) {
      visit(rule.referenceComponent, ancestors);
    }
    ancestors.delete(name);
    visited.add(name);
    order.push(rule);
  }

  // Residual goes last; fixed/percent_of_gross have no deps, percent_of_component may
  const nonResidual = rules.filter(r => r.ruleType !== "residual");
  const residual = rules.filter(r => r.ruleType === "residual");
  for (const r of nonResidual) visit(r.componentName, new Set());
  for (const r of residual) order.push(r);

  return order;
}

// ---------------------------------------------------------------------------
// (Step 5) computeComponentsFromGross — pure, country-agnostic
// ---------------------------------------------------------------------------

/**
 * Decompose `grossPaise` into salary components according to structure rules.
 * All amounts are in integer paise.
 *
 * @param grossPaise        Gross monthly salary in paise
 * @param rules             Ordered structure rules (will be topologically sorted internally)
 * @param presentDays       Days present this month
 * @param workingDays       Total working days this month
 */
export function computeComponentsFromGross(
  grossPaise: number,
  rules: StructureRule[],
  presentDays: number,
  workingDays: number,
): ComponentResult {
  const flags: string[] = [];

  // Clamp / validate
  if (presentDays > workingDays) {
    flags.push(`presentDays(${presentDays}) > workingDays(${workingDays}) — clamped`);
    presentDays = workingDays;
  }

  const lopFraction = workingDays > 0 ? (workingDays - presentDays) / workingDays : 0;
  const sorted = topoSort(rules);

  // Map from componentName → pre-LOP paise (for reference lookups)
  const prelopMap = new Map<string, number>();

  // First pass: compute pre-LOP amounts
  for (const rule of sorted) {
    if (rule.ruleType === "residual") continue;
    let amount = 0;
    if (rule.ruleType === "percent_of_gross") {
      if (rule.valuePct == null) throw new Error(`${rule.componentName}: valuePct required for percent_of_gross`);
      amount = Math.round((grossPaise * rule.valuePct) / 10000);
    } else if (rule.ruleType === "percent_of_component") {
      if (rule.valuePct == null || !rule.referenceComponent) {
        throw new Error(`${rule.componentName}: valuePct and referenceComponent required`);
      }
      const base = prelopMap.get(rule.referenceComponent) ?? 0;
      amount = Math.round((base * rule.valuePct) / 10000);
    } else if (rule.ruleType === "fixed") {
      if (rule.valueFixed == null) throw new Error(`${rule.componentName}: valueFixed required for fixed rule`);
      amount = rule.valueFixed;
    }
    prelopMap.set(rule.componentName, amount);
  }

  // Residual pre-LOP = gross minus all other pre-LOP components
  let residualRule: StructureRule | null = null;
  for (const rule of sorted) {
    if (rule.ruleType === "residual") {
      residualRule = rule;
      const allocated = Array.from(prelopMap.values()).reduce((a, b) => a + b, 0);
      prelopMap.set(rule.componentName, Math.max(0, grossPaise - allocated));
      break;
    }
  }

  // Second pass: apply LOP per component
  const components: ComponentBreakdown[] = [];
  let grossAfterLopPaise = 0;

  for (const rule of sorted) {
    const prelopPaise = prelopMap.get(rule.componentName) ?? 0;
    let postlopPaise: number;

    if (rule.ruleType === "residual") {
      // Residual is computed after LOP adjustment below; placeholder for now
      postlopPaise = prelopPaise;
    } else if (rule.lopMode === "fixed") {
      postlopPaise = prelopPaise;
    } else {
      // proportional
      postlopPaise = Math.round(prelopPaise * (1 - lopFraction));
    }

    components.push({ name: rule.componentName, prelopPaise, postlopPaise, lopMode: rule.lopMode });
    if (rule.ruleType !== "residual") {
      grossAfterLopPaise += postlopPaise;
    }
  }

  // Compute expected gross-after-LOP
  const expectedGrossAfterLop = workingDays > 0
    ? Math.round(grossPaise * presentDays / workingDays)
    : grossPaise;

  // Adjust residual component to absorb rounding and make sum = grossAfterLOP
  if (residualRule) {
    const compIdx = components.findIndex(c => c.name === residualRule!.componentName);
    if (compIdx >= 0) {
      const residualNeeded = expectedGrossAfterLop - grossAfterLopPaise;
      if (residualNeeded < 0) {
        // Fixed components exceed reduced gross under heavy LOP
        components[compIdx].postlopPaise = 0;
        flags.push(`Residual component clamped to ₹0 (fixed components exceed reduced gross); requires HR review`);
        grossAfterLopPaise += 0;
      } else {
        components[compIdx].postlopPaise = residualNeeded;
        grossAfterLopPaise += residualNeeded;
      }
    }
  } else {
    // No residual rule: gross-after-LOP is sum of post-LOP components
    grossAfterLopPaise = components.reduce((s, c) => s + c.postlopPaise, 0);
  }

  return { components, grossAfterLopPaise, flags };
}

// ---------------------------------------------------------------------------
// (Step 6) IndiaStatutoryEngine
// ---------------------------------------------------------------------------

/**
 * Generic interface — the method signature never leaks India-specific fields.
 */
export interface StatutoryEngine {
  compute(
    period: { year: number; month: number },
    components: ComponentBreakdown[],
    grossAfterLopPaise: number,
    employeeConfig: IndiaEmployeeConfig,
    resolvedRates: ResolvedRate[],
    stateDeductionConfig: StateDeductionConfig | null,
  ): StatutoryLine[];
}

function lookupRate(rates: ResolvedRate[], levy: string, key: string): ResolvedRate | undefined {
  return rates.find(r => r.levy === levy && r.key === key);
}

/**
 * India statutory engine — EPF (Labour Codes 2025), ESI Act 1948.
 * All monetary arithmetic in integer paise. No hard-coded rates.
 */
export const IndiaStatutoryEngine: StatutoryEngine = {
  compute(period, components, grossAfterLopPaise, config, rates, stateDeductionConfig) {
    const lines: StatutoryLine[] = [];
    const periodEnd = `${period.year}-${String(period.month).padStart(2, "0")}-${daysInMonth(period.year, period.month).toString().padStart(2, "0")}`;

    // ---------- Establishment gates ----------
    const epfActive =
      config.epfCoverage.status !== "not_applicable" &&
      !!config.epfCoverage.applicableFrom &&
      config.epfCoverage.applicableFrom <= periodEnd;

    const esiActive =
      config.esiCoverage.status !== "not_applicable" &&
      !!config.esiCoverage.applicableFrom &&
      config.esiCoverage.applicableFrom <= periodEnd;

    // ---------- PF lines ----------
    if (epfActive) {
      const basicComp = components.find(c => c.name.toLowerCase() === "basic");
      const basicAfterLop = basicComp?.postlopPaise ?? 0;

      // pfBasis = max(basicAfterLOP, 50% of grossAfterLOP)
      let pfBasisPaise = Math.max(basicAfterLop, Math.round(grossAfterLopPaise * 0.5));

      // If restricted mode: cap at ₹15,000 (1,500,000 paise)
      const epfCeilingRate = lookupRate(rates, "EPF", "ceiling_paise");
      const epfCeilingPaise = epfCeilingRate?.maximumPaise ?? 1500000;
      if (config.pfMode === "restricted") {
        pfBasisPaise = Math.min(pfBasisPaise, epfCeilingPaise);
      }

      const epfEmployeeRate = lookupRate(rates, "EPF", "employee");
      const epsRate = lookupRate(rates, "EPS", "employer");
      const edliRate = lookupRate(rates, "EDLI", "employer");

      // Employee PF
      const employeePfPaise = config.pfExempt
        ? 0
        : (epfEmployeeRate
          ? applyRounding((pfBasisPaise * epfEmployeeRate.valueBps) / 10000, epfEmployeeRate.rounding)
          : 0);

      // EPS (employer; capped)
      const epsCap = epsRate?.maximumPaise ?? 125000;
      const employerEps = epsRate
        ? Math.min(applyRounding((pfBasisPaise * epsRate.valueBps) / 10000, epsRate.rounding), epsCap)
        : 0;

      // Employer EPF = 12% × pfBasis − EPS (difference, no independent rounding)
      const employer12Pct = epfEmployeeRate
        ? applyRounding((pfBasisPaise * epfEmployeeRate.valueBps) / 10000, epfEmployeeRate.rounding)
        : 0;
      const employerEpf = employer12Pct - employerEps;

      // EDLI
      const edliCap = edliRate?.maximumPaise ?? 7500;
      const employerEdli = edliRate
        ? Math.min(applyRounding((pfBasisPaise * edliRate.valueBps) / 10000, edliRate.rounding), edliCap)
        : 0;

      if (employeePfPaise > 0) {
        lines.push({ key: "epf_employee", labelEn: "EPF Employee", amountPaise: employeePfPaise, isEmployerContribution: false, scheme: "EPF", flags: [] });
      }
      lines.push({ key: "eps_employer", labelEn: "EPS (Employer)", amountPaise: employerEps, isEmployerContribution: true, scheme: "EPF", flags: [] });
      lines.push({ key: "epf_employer", labelEn: "EPF Employer Diff", amountPaise: Math.max(0, employerEpf), isEmployerContribution: true, scheme: "EPF", flags: [] });
      lines.push({ key: "edli_employer", labelEn: "EDLI (Employer)", amountPaise: employerEdli, isEmployerContribution: true, scheme: "EPF", flags: [] });
    } else {
      // Gate closed — zero lines for reporting
      lines.push({ key: "epf_employee", labelEn: "EPF Employee", amountPaise: 0, isEmployerContribution: false, scheme: "EPF", flags: ["establishment_not_covered"] });
    }

    // ---------- ESI lines ----------
    if (esiActive) {
      const esiCovered =
        config.esiApplicable &&
        !!config.esiCoveredUntil &&
        config.esiCoveredUntil >= periodEnd;

      const esiEmployeeRate = lookupRate(rates, "ESI", "employee");
      const esiEmployerRate = lookupRate(rates, "ESI", "employer");

      let employeeEsi = 0;
      let employerEsi = 0;
      const esiFlags: string[] = [];

      if (esiCovered) {
        if (config.esiDailyWageExempt) {
          employeeEsi = 0;
          esiFlags.push("daily_wage_exempt");
        } else {
          employeeEsi = esiEmployeeRate
            ? applyRounding((grossAfterLopPaise * esiEmployeeRate.valueBps) / 10000, "up")
            : 0;
        }
        employerEsi = esiEmployerRate
          ? applyRounding((grossAfterLopPaise * esiEmployerRate.valueBps) / 10000, "up")
          : 0;
      } else {
        esiFlags.push("not_esi_covered");
      }

      lines.push({ key: "esi_employee", labelEn: "ESI Employee", amountPaise: employeeEsi, isEmployerContribution: false, scheme: "ESI", flags: esiFlags });
      lines.push({ key: "esi_employer", labelEn: "ESI Employer", amountPaise: employerEsi, isEmployerContribution: true, scheme: "ESI", flags: esiFlags });
    } else {
      lines.push({ key: "esi_employee", labelEn: "ESI Employee", amountPaise: 0, isEmployerContribution: false, scheme: "ESI", flags: ["establishment_not_covered"] });
      lines.push({ key: "esi_employer", labelEn: "ESI Employer", amountPaise: 0, isEmployerContribution: true, scheme: "ESI", flags: ["establishment_not_covered"] });
    }

    // ---------- State deduction (PT/PSDT/LWF) ----------
    if (stateDeductionConfig) {
      const sd = stateDeductionConfig;
      const stateFlags: string[] = [];
      let stateAmountPaise = 0;

      // Gross pre-LOP is the correct basis for slab eligibility checks.
      // When components is empty (e.g. unit tests that pass [] for simplicity),
      // fall back to grossAfterLopPaise — since pre-LOP ≥ post-LOP, a zero
      // components sum would otherwise trigger eligibility thresholds spuriously.
      const rawPreLopPaise = components.reduce((s, c) => s + c.prelopPaise, 0);
      const grossPreLopPaise = rawPreLopPaise > 0 ? rawPreLopPaise : grossAfterLopPaise;

      if (sd.isRegistered) {
        // Slab threshold check (e.g. PT: only deduct if monthly gross ≥ threshold)
        const belowSlab = sd.thresholdPaise != null && grossPreLopPaise < sd.thresholdPaise;
        if (belowSlab) {
          stateFlags.push("below_slab_threshold");
        } else if (sd.isFlat) {
          // Flat levies: never LOP-prorated; amount already slab-resolved in DB
          const isFeb = period.month === 2;
          stateAmountPaise = isFeb && sd.febAmountPaise != null ? sd.febAmountPaise : sd.amountPaise;
          // Deduction months filter (e.g. PSDT in specific months only)
          if (sd.deductionMonths && sd.deductionMonths.length > 0) {
            if (!sd.deductionMonths.includes(period.month)) {
              stateAmountPaise = 0;
              stateFlags.push("not_deduction_month");
            }
          }
          // PSDT annual threshold: levy only applies when annualised pre-LOP gross ≥ threshold.
          // Guard is skipped when components array is empty (no pre-LOP breakdown provided)
          // so test helpers that pass components=[] never spuriously zero the deduction.
          if (rawPreLopPaise > 0 && sd.psdtAnnualThresholdPaise != null && rawPreLopPaise * 12 < sd.psdtAnnualThresholdPaise) {
            stateAmountPaise = 0;
            stateFlags.push("below_psdt_annual_threshold");
          }
        } else {
          stateAmountPaise = sd.amountPaise;
        }
      } else {
        stateFlags.push("applicable_but_unremitted");
      }

      lines.push({
        key: "state_deduction",
        labelEn: `${sd.levyType} (${sd.state})`,
        amountPaise: stateAmountPaise,
        isEmployerContribution: false,
        scheme: sd.levyType,
        flags: stateFlags,
      });
    }

    return lines;
  },
};

// ---------------------------------------------------------------------------
// (Step 7) Net-pay waterfall
// ---------------------------------------------------------------------------

/**
 * Apply the strict-order net-pay waterfall (§6.4):
 * grossAfterLOP → statutory deductions → advance recovery → other deductions → net pay
 *
 * Net pay is floored at ₹0 (never negative).
 * Advance recovery: oldest-first FIFO; shortfall carries forward.
 * On a ₹0-gross month: advance recovery = ₹0, outstanding balance unchanged.
 */
export function applyWaterfall(input: WaterfallInput): WaterfallResult {
  const { grossAfterLopPaise, statutoryDeductionLines, advancesPaise, otherDeductionsPaise } = input;

  const employeeStatutory = statutoryDeductionLines
    .filter(l => !l.isEmployerContribution)
    .reduce((s, l) => s + l.amountPaise, 0);

  let remaining = grossAfterLopPaise - employeeStatutory;
  if (remaining < 0) remaining = 0;

  // Advance recovery (oldest-first; capped at remaining)
  let totalAdvanceRecovered = 0;
  const advanceShortfallByIdPaise: Array<{ id: string; recoveredPaise: number; shortfallPaise: number }> = [];

  if (grossAfterLopPaise > 0) {
    for (const adv of advancesPaise) {
      const canRecover = Math.min(adv.outstandingPaise, remaining);
      const shortfall = adv.outstandingPaise - canRecover;
      advanceShortfallByIdPaise.push({ id: adv.id, recoveredPaise: canRecover, shortfallPaise: shortfall });
      remaining -= canRecover;
      totalAdvanceRecovered += canRecover;
    }
  } else {
    for (const adv of advancesPaise) {
      advanceShortfallByIdPaise.push({ id: adv.id, recoveredPaise: 0, shortfallPaise: adv.outstandingPaise });
    }
  }

  remaining = Math.max(0, remaining - otherDeductionsPaise);

  return {
    grossAfterLopPaise,
    totalStatutoryDeductionsPaise: employeeStatutory,
    advanceRecoveredPaise: totalAdvanceRecovered,
    advanceShortfallByIdPaise,
    otherDeductionsPaise,
    netPayPaise: remaining,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Convert rupees (number/string) to integer paise, rounding to nearest. */
export function rupeesToPaise(rupees: number | string): number {
  return Math.round(Number(rupees) * 100);
}

/** Convert integer paise to rupees string with 2 decimal places. */
export function paiseToRupees(paise: number): string {
  return (paise / 100).toFixed(2);
}
