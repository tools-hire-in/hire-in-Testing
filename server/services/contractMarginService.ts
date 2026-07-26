export type ContractType = "contract_hourly" | "permanent_placement" | "contract_to_hire";

export interface MarginInputs {
  contractType: ContractType;
  // Hourly / contract-to-hire
  billRate?: number | null;
  payRate?: number | null;
  passthroughFee?: number | null;
  // Permanent placement — flat OR % of annual salary (mutually exclusive)
  referralFeeFlat?: number | null;
  referralFeePct?: number | null;       // e.g. 20 → 20% of candidateAnnualSalary
  candidateAnnualSalary?: number | null; // required when referralFeePct is supplied
  // Both types
  businessMarketingCost?: number | null;
}

export interface MarginResult {
  grossMargin: number | null;
  referralFee: number | null;
  netMargin: number | null;
}

export class MarginValidationError extends Error {
  constructor(msg: string) { super(msg); this.name = "MarginValidationError"; }
}

function toNum(v: number | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  if (isNaN(n)) return null;
  return n;
}

function round4(n: number): number {
  return parseFloat(n.toFixed(4));
}

/**
 * calculateMargins — pure, no DB access.
 * Returns null for any derived field whose inputs are missing (safe for live preview).
 * Throws MarginValidationError only when called from a context that requires complete data.
 */
export function calculateMargins(inputs: MarginInputs): MarginResult {
  const { contractType } = inputs;

  if (contractType === "contract_hourly" || contractType === "contract_to_hire") {
    const billRate = toNum(inputs.billRate);
    const payRate = toNum(inputs.payRate);
    const passthrough = toNum(inputs.passthroughFee);
    const bmc = toNum(inputs.businessMarketingCost);

    const grossMargin = billRate != null && payRate != null
      ? round4(billRate - payRate)
      : null;

    const referralFee = grossMargin != null
      ? round4(grossMargin - (passthrough ?? 0))
      : null;

    const netMargin = referralFee != null
      ? round4(referralFee - (bmc ?? 0))
      : null;

    return { grossMargin, referralFee, netMargin };
  }

  if (contractType === "permanent_placement") {
    const passthrough = toNum(inputs.passthroughFee);
    const bmc = toNum(inputs.businessMarketingCost);
    let referralFee: number | null = null;

    const flat = toNum(inputs.referralFeeFlat);
    const pct = toNum(inputs.referralFeePct);
    const salary = toNum(inputs.candidateAnnualSalary);

    // Mutual exclusivity: flat and pct+salary are alternative modes, not additive.
    // calculateMargins prioritises flat when both are present (preview-safe), but
    // validateMarginInputs (called on saves) rejects ambiguous payloads.
    if (flat != null) {
      referralFee = flat;
    } else if (pct != null) {
      if (salary != null) {
        referralFee = round4((pct / 100) * salary);
      }
      // else: pct supplied but salary not yet entered → leave null (preview shows "—")
    }

    const netMargin = referralFee != null
      ? round4(referralFee - (passthrough ?? 0) - (bmc ?? 0))
      : null;

    return { grossMargin: null, referralFee, netMargin };
  }

  return { grossMargin: null, referralFee: null, netMargin: null };
}

/**
 * validateMarginInputs — call BEFORE saving to DB.
 * Throws MarginValidationError if required fields for the given contract type are missing.
 */
export function validateMarginInputs(inputs: MarginInputs): void {
  const { contractType } = inputs;

  if (contractType === "contract_hourly" || contractType === "contract_to_hire") {
    const bill = toNum(inputs.billRate);
    const pay = toNum(inputs.payRate);
    if (bill == null || pay == null) {
      throw new MarginValidationError(
        `Hourly / Contract-to-Hire contracts require both Bill Rate and Pay Rate.`
      );
    }
    if (bill < 0 || pay < 0) {
      throw new MarginValidationError("Bill Rate and Pay Rate must be non-negative.");
    }
    if (pay > bill) {
      throw new MarginValidationError("Pay Rate cannot exceed Bill Rate.");
    }
    return;
  }

  if (contractType === "permanent_placement") {
    const flat = toNum(inputs.referralFeeFlat);
    const pct = toNum(inputs.referralFeePct);
    const salary = toNum(inputs.candidateAnnualSalary);

    if (flat == null && pct == null) {
      throw new MarginValidationError(
        "Permanent Placement contracts require a Referral Fee (flat amount or percentage of candidate annual salary)."
      );
    }
    if (flat != null && pct != null) {
      throw new MarginValidationError(
        "Provide either a flat Referral Fee amount or a percentage — not both."
      );
    }
    if (pct != null && salary == null) {
      throw new MarginValidationError(
        "Candidate Annual Salary is required when Referral Fee is expressed as a percentage."
      );
    }
    if (pct != null && (pct <= 0 || pct > 100)) {
      throw new MarginValidationError("Referral Fee percentage must be between 0 and 100.");
    }
    if (flat != null && flat < 0) {
      throw new MarginValidationError("Referral Fee must be non-negative.");
    }
  }
}
