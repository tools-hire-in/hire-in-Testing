/**
 * India Payroll Computation Engine
 *
 * Two pure functions:
 *   computeComponentsFromGross   — splits gross into earnings components per structure rules
 *   computeIndiaStatutory        — calculates EPF, ESI, PT deductions per Indian law
 *
 * Both functions are side-effect free and depend only on their arguments.
 * They are wired into slip generation (routes.ts) and the live preview API.
 */

import type { ComponentBreakdown, StatutoryResult, SlipComponents } from "@shared/salaryEngineTypes";
export type { ComponentBreakdown, StatutoryResult, SlipComponents };

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StructureRule {
  componentName: string;
  ruleType: "percent_of_gross" | "percent_of_component" | "fixed" | "residual";
  value: number;
  referenceComponent?: string | null;
  lopMode: "proportional" | "fixed";
  sortOrder: number;
}

export interface ComponentsResult {
  components: ComponentBreakdown[];
  grossAfterLOP: number;
  lopFactor: number; // presentDays / workingDays
}

// ── Professional Tax default slab table ───────────────────────────────────────

export interface PtSlab {
  minGross: number;
  amount: number;
  februaryAmount?: number;
}

export const DEFAULT_PT_SLABS: Record<string, PtSlab[]> = {
  maharashtra: [{ minGross: 10000, amount: 200, februaryAmount: 300 }],
  karnataka: [{ minGross: 15000, amount: 200 }],
  telangana: [{ minGross: 20000, amount: 200 }],
  andhra_pradesh: [{ minGross: 20000, amount: 200 }],
  // Tamil Nadu: annual income > ₹75,000 → ~₹208/month
  tamil_nadu: [{ minGross: 6251, amount: 208 }],
  west_bengal: [{ minGross: 25000, amount: 200 }],
  // No PT in these states
  delhi: [],
  haryana: [],
  rajasthan: [],
  uttar_pradesh: [],
  gujarat: [],
  punjab: [],
};

export const PT_STATE_LABELS: Record<string, string> = {
  maharashtra: "Maharashtra",
  karnataka: "Karnataka",
  telangana: "Telangana",
  andhra_pradesh: "Andhra Pradesh",
  tamil_nadu: "Tamil Nadu",
  west_bengal: "West Bengal",
  delhi: "Delhi (No PT)",
  haryana: "Haryana (No PT)",
  rajasthan: "Rajasthan (No PT)",
  uttar_pradesh: "Uttar Pradesh (No PT)",
  gujarat: "Gujarat (No PT)",
  punjab: "Punjab (No PT)",
  none: "None / Not Applicable",
};

// ── Display name mapping ───────────────────────────────────────────────────────

export const COMPONENT_DISPLAY_NAMES: Record<string, string> = {
  basic: "Basic Salary",
  hra: "House Rent Allowance (HRA)",
  conveyance: "Conveyance Allowance",
  lta: "Leave Travel Allowance (LTA)",
  special_allowance: "Special Allowance",
  medical: "Medical Allowance",
  other: "Other Allowance",
};

function displayName(componentName: string): string {
  return COMPONENT_DISPLAY_NAMES[componentName] || toTitleCase(componentName);
}

function toTitleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function ruleDescription(rule: StructureRule): string {
  if (rule.ruleType === "percent_of_gross") return `${rule.value}% of Gross`;
  if (rule.ruleType === "percent_of_component")
    return `${rule.value}% of ${displayName(rule.referenceComponent || "")}`;
  if (rule.ruleType === "fixed") return `Fixed ₹${rule.value.toLocaleString("en-IN")}`;
  if (rule.ruleType === "residual") return "Residual (Gross − other components)";
  return "";
}

// ── computeComponentsFromGross ────────────────────────────────────────────────

/**
 * Splits gross salary into earnings components according to structure rules,
 * applying LOP proportionally per component's lop_mode setting.
 *
 * @param gross        Full monthly gross (pre-LOP)
 * @param rules        Structure rules sorted by sort_order
 * @param presentDays  Effective present days (present + paid leaves)
 * @param workingDays  Total working days in the month
 * @returns            Per-component breakdown + post-LOP gross
 */
export function computeComponentsFromGross(
  gross: number,
  rules: StructureRule[],
  presentDays: number,
  workingDays: number,
): ComponentsResult {
  const lopFactor = workingDays > 0 ? Math.min(presentDays / workingDays, 1) : 1;
  const grossAfterLOP = round2(gross * lopFactor);

  // Sort rules by sortOrder
  const sorted = [...rules].sort((a, b) => a.sortOrder - b.sortOrder);

  // First pass: compute raw (pre-LOP) amounts for all non-residual rules
  const rawAmounts = new Map<string, number>();
  for (const rule of sorted) {
    if (rule.ruleType === "residual") continue;
    let raw = 0;
    if (rule.ruleType === "percent_of_gross") {
      raw = (rule.value / 100) * gross;
    } else if (rule.ruleType === "percent_of_component") {
      raw = (rule.value / 100) * (rawAmounts.get(rule.referenceComponent || "") ?? 0);
    } else if (rule.ruleType === "fixed") {
      raw = rule.value;
    }
    rawAmounts.set(rule.componentName, round2(raw));
  }

  // Compute residual raw = gross − sum of other raws
  const residualRule = sorted.find((r) => r.ruleType === "residual");
  if (residualRule) {
    const sumNonRes = Array.from(rawAmounts.values()).reduce((a, b) => a + b, 0);
    rawAmounts.set(residualRule.componentName, Math.max(0, round2(gross - sumNonRes)));
  }

  // Second pass: apply LOP per component, build result array
  const components: ComponentBreakdown[] = [];
  let runningPostLop = 0;
  // Residual rule (if any) absorbs rounding — it is the "Special Allowance" that
  // must always equal gross − other components. If no residual rule exists, fall
  // back to making the last component absorb rounding for backward compatibility.
  const hasResidualRule = sorted.some((r) => r.ruleType === "residual");
  for (let i = 0; i < sorted.length; i++) {
    const rule = sorted[i];
    const rawAmount = rawAmounts.get(rule.componentName) ?? 0;
    let amount: number;

    const isRoundingAbsorber =
      rule.ruleType === "residual" || (!hasResidualRule && i === sorted.length - 1);
    if (isRoundingAbsorber) {
      // This component absorbs any floating-point rounding so the component
      // sum === grossAfterLOP exactly.
      amount = Math.max(0, round2(grossAfterLOP - runningPostLop));
    } else if (rule.lopMode === "fixed") {
      // Fixed components: cap at grossAfterLOP to avoid overshoot on severe LOP
      amount = Math.min(rawAmount, grossAfterLOP - runningPostLop);
      amount = Math.max(0, round2(amount));
    } else {
      // proportional
      amount = round2(rawAmount * lopFactor);
    }

    components.push({
      componentName: rule.componentName,
      displayName: displayName(rule.componentName),
      rawAmount,
      amount,
      ruleDescription: ruleDescription(rule),
    });
    runningPostLop += amount;
  }

  return { components, grossAfterLOP, lopFactor };
}

// ── computeIndiaStatutory ─────────────────────────────────────────────────────

/**
 * Computes India statutory deductions and employer contributions for a pay period.
 *
 * Implements EPF & MP Act 1952 and ESI Act 1948 exactly:
 *   - Employee PF: 12% of PF basis (capped at ₹15,000 in restricted mode)
 *   - Employer PF split: 3.67% EPF + 8.33% EPS (hard-capped ₹1,250) + 0.5% EDLI (cap ₹75)
 *   - Admin charges: 0.5% of PF basis, capped at ₹75 (employer cost only)
 *   - Employee ESI: 0.75% of gross (applicable if gross ≤ ₹21,000 / ₹25,000 disability)
 *   - Employer ESI: 3.25% of gross
 *   - PT: looked up from configurable slab table
 *
 * All amounts rounded to nearest rupee.
 */
export function computeIndiaStatutory(opts: {
  basicAfterLOP: number;
  grossAfterLOP: number;
  pfMode: "restricted" | "unrestricted";
  pfExempt: boolean;
  ptState: string | null | undefined;
  ptCustomSlabs: Record<string, PtSlab[]> | null | undefined;
  isDisability: boolean;
  isFebruary?: boolean;
  /** Gross amount to use for PT slab check. Defaults to grossAfterLOP.
   *  Pass grossBeforeLOP when pt_basis setting = "gross_before_lop". */
  ptGrossBasis?: number;
}): StatutoryResult {
  const { basicAfterLOP, grossAfterLOP, pfMode, pfExempt, ptState, ptCustomSlabs, isDisability, isFebruary = false, ptGrossBasis } = opts;

  // ── PF ──────────────────────────────────────────────────────────────────────
  let pfBasis = 0;
  let employeePf = 0;
  let employerEpf = 0;
  let employerEps = 0;
  let employerEdli = 0;
  let employerAdminCharges = 0;

  if (!pfExempt && basicAfterLOP > 0) {
    pfBasis = pfMode === "restricted" ? Math.min(basicAfterLOP, 15000) : basicAfterLOP;
    pfBasis = round0(pfBasis);

    employeePf = round0(0.12 * pfBasis);

    const totalEmployerPf = round0(0.12 * pfBasis);
    employerEps = Math.min(round0(0.0833 * pfBasis), 1250);
    employerEpf = Math.max(0, totalEmployerPf - employerEps);
    employerEdli = Math.min(round0(0.005 * pfBasis), 75);
    employerAdminCharges = Math.min(round0(0.005 * pfBasis), 75);
  }

  // ── ESI ─────────────────────────────────────────────────────────────────────
  const esiThreshold = isDisability ? 25000 : 21000;
  const esiApplicable = grossAfterLOP > 0 && grossAfterLOP <= esiThreshold;
  let employeeEsi = 0;
  let employerEsi = 0;
  if (esiApplicable) {
    employeeEsi = round0(0.0075 * grossAfterLOP);
    employerEsi = round0(0.0325 * grossAfterLOP);
  }

  // ── Professional Tax ─────────────────────────────────────────────────────────
  // ptGrossBasis lets callers opt in to checking slabs against gross-before-LOP.
  // Default (undefined) falls back to grossAfterLOP.
  const ptCheckGross = ptGrossBasis !== undefined ? ptGrossBasis : grossAfterLOP;
  let professionalTax = 0;
  if (ptState && ptState !== "none" && ptCheckGross > 0) {
    // Sort descending by minGross so the first match is the highest applicable slab.
    const slabs = [...((ptCustomSlabs?.[ptState]) || DEFAULT_PT_SLABS[ptState] || [])]
      .sort((a, b) => b.minGross - a.minGross);
    for (const slab of slabs) {
      if (ptCheckGross > slab.minGross) {
        professionalTax = isFebruary && slab.februaryAmount !== undefined
          ? slab.februaryAmount
          : slab.amount;
        break;
      }
    }
  }

  const totalEmployeeDeductions = employeePf + employeeEsi + professionalTax;
  const totalEmployerCost = employerEpf + employerEps + employerEdli + employerAdminCharges + employerEsi;

  return {
    employeePf,
    employerEpf,
    employerEps,
    employerEdli,
    employerAdminCharges,
    employeeEsi,
    employerEsi,
    professionalTax,
    pfBasis,
    esiApplicable,
    totalEmployeeDeductions,
    totalEmployerCost,
  };
}

// ── helpers ───────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round0(n: number): number {
  return Math.round(n);
}
