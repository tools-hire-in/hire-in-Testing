export interface TravelCalcInput {
  w2Hourly: number;
  totalHours: number;
  otMultiplier: number;
  masterBillRate: number;
  otBillRate: number;
  clientOtMultiplier: number;
  vmsFeePct: number;
  weeksInAssignment: number;
  awayDays: number;
  dailyLodging: number;
  dailyMie: number;
  firstLastDayMie: number;
  decreasedStipendOverride: number | null;
  orientationHoursTotal: number;
  orientationHoursBillable: number;
  orientationPayRate: number;
  orientationOtMultiplier: number;
  completionBonus: number;
  payrollBurdenPct: number;
  onCallRate: number;
  callbackRate: number;
  holidayRate: number;
  roleType: string;
  marginFloors: { roleType: string; redThresholdPct: number; yellowThresholdPct: number } | null;
}

export interface TravelCalcOutput {
  billAfterVms: number;
  orientationRevenue: number;
  orientationCandidateCost: number;
  orientationNet: number;
  regularBilling: number;
  otBilling: number;
  totalBillingWeekly: number;
  totalBillingContract: number;
  wagePayableWeekly: number;
  payrollTaxesWeekly: number;
  weeklyNonTaxable: number;
  gsaCapWeekly: number;
  stipendCompliance: "compliant" | "over_cap";
  stipendProposedWeekly: number;
  totalExpenseWeekly: number;
  totalExpenseContract: number;
  grossProfitWeekly: number;
  netMarginPct: number;
  netMarginPerHour: number;
  netMarginPerWeek: number;
  netMarginPerContract: number;
  marginStatus: "green" | "yellow" | "red";
  weeklyGross: number;
  weeklyTaxable: number;
  weeklyNonTaxableOut: number;
  hourlyTaxable: number;
  hourlyBlended: number;
  otRate: number;
  callbackRateOut: number;
  holidayRateOut: number;
  onCallRateOut: number;
  regularHours: number;
  otHours: number;
}

const DEFAULT_FLOORS: Record<string, { red: number; yellow: number }> = {
  healthcare_travel: { red: 10, yellow: 17 },
  it_engineering: { red: 20, yellow: 27 },
  professional_services: { red: 14, yellow: 21 },
};

export function runTravelCalc(input: TravelCalcInput): TravelCalcOutput {
  const {
    w2Hourly, totalHours, otMultiplier, masterBillRate, otBillRate, clientOtMultiplier,
    vmsFeePct, weeksInAssignment, awayDays, dailyLodging, dailyMie,
    decreasedStipendOverride, orientationHoursTotal, orientationHoursBillable,
    orientationPayRate, completionBonus, payrollBurdenPct, onCallRate, callbackRate,
    holidayRate, roleType, marginFloors,
  } = input;

  const burdenFactor = payrollBurdenPct / 100;
  const vmsDecimal = vmsFeePct / 100;

  const gsaCapDailyFull = dailyLodging + dailyMie;
  const gsaCapWeekly = gsaCapDailyFull * awayDays;

  // --- Stipend compliance ---
  // Keep RAW proposed value separate from clamped paid amount.
  // over_cap is determined BEFORE clamping so the compliance flag is reachable.
  const stipendProposedWeekly = (decreasedStipendOverride !== null && decreasedStipendOverride >= 0)
    ? decreasedStipendOverride
    : gsaCapWeekly;

  const stipendCompliance: "compliant" | "over_cap" =
    stipendProposedWeekly > gsaCapWeekly ? "over_cap" : "compliant";

  // Paid non-taxable: capped at GSA limit (overage is not paid non-taxable)
  const weeklyNonTaxable = Math.min(stipendProposedWeekly, gsaCapWeekly);

  // --- Billing ---
  // Spreadsheet model: ALL contracted hours bill at the master rate (no 40-hr split on
  // regular billing). OT billing is an ADDITIVE premium for hours above 40, not a
  // replacement rate. This matches the source-of-truth Excel formulas.
  const billAfterVms = masterBillRate * (1 - vmsDecimal);

  const regularHours = totalHours;                      // all scheduled hours at base rate
  const otHours = Math.max(0, totalHours - 40);         // hours above 40 (for additive OT premium)

  // Regular billing covers ALL hours at the base rate
  const regularBilling = billAfterVms * totalHours;

  // OT billing is ADDITIVE: the premium per OT hour above the base rate.
  // If an explicit otBillRate is supplied we use (otBillRate - base) as the premium.
  // If not supplied, we use base × (clientOtMultiplier - 1) as the per-hour premium.
  // This avoids double-billing the base rate for OT hours.
  const otPremiumPerHour = otBillRate > 0
    ? Math.max(0, otBillRate - billAfterVms)
    : billAfterVms * Math.max(0, clientOtMultiplier - 1);
  const otBillingAmount = otPremiumPerHour * otHours;

  const orientationRevenue = billAfterVms * orientationHoursBillable;
  const orientationCandidateCost = orientationPayRate * orientationHoursTotal * (1 + burdenFactor);
  const orientationNet = orientationRevenue - orientationCandidateCost;

  const totalBillingWeekly = regularBilling + otBillingAmount + orientationRevenue;
  const totalBillingContract = totalBillingWeekly * weeksInAssignment;

  // --- Wages ---
  // Spreadsheet model: wage is a flat rate for ALL contracted hours.
  // Travel-nurse pay packages do not carry an OT wage uplift in W2 calculations —
  // the schedule is fixed and OT is an agency-level billing item only.
  const wagePayableWeekly = w2Hourly * totalHours;
  const payrollTaxesWeekly = wagePayableWeekly * burdenFactor;

  // --- Expenses ---
  const totalExpenseWeekly = wagePayableWeekly + payrollTaxesWeekly + weeklyNonTaxable + orientationCandidateCost + completionBonus;
  const totalExpenseContract = totalExpenseWeekly * weeksInAssignment;

  // --- Margin ---
  const grossProfitWeekly = totalBillingWeekly - totalExpenseWeekly;
  const netMarginPct = totalBillingWeekly > 0 ? (grossProfitWeekly / totalBillingWeekly) * 100 : 0;
  const netMarginPerHour = totalHours > 0 ? grossProfitWeekly / totalHours : 0;
  const netMarginPerWeek = grossProfitWeekly;
  const netMarginPerContract = grossProfitWeekly * weeksInAssignment;

  const floors = marginFloors
    ? { red: Number(marginFloors.redThresholdPct), yellow: Number(marginFloors.yellowThresholdPct) }
    : (DEFAULT_FLOORS[roleType] ?? DEFAULT_FLOORS.healthcare_travel);

  let marginStatus: "green" | "yellow" | "red";
  if (netMarginPct < floors.red) {
    marginStatus = "red";
  } else if (netMarginPct < floors.yellow) {
    marginStatus = "yellow";
  } else {
    marginStatus = "green";
  }

  // --- Candidate pay summary ---
  const weeklyTaxable = wagePayableWeekly;
  const weeklyGross = weeklyTaxable + weeklyNonTaxable;
  const hourlyTaxable = totalHours > 0 ? weeklyTaxable / totalHours : w2Hourly;
  const hourlyBlended = totalHours > 0 ? weeklyGross / totalHours : 0;
  const otRate = w2Hourly * otMultiplier;

  return {
    billAfterVms,
    orientationRevenue,
    orientationCandidateCost,
    orientationNet,
    regularBilling,
    otBilling: otBillingAmount,
    totalBillingWeekly,
    totalBillingContract,
    wagePayableWeekly,
    payrollTaxesWeekly,
    weeklyNonTaxable,
    gsaCapWeekly,
    stipendCompliance,
    stipendProposedWeekly,
    totalExpenseWeekly,
    totalExpenseContract,
    grossProfitWeekly,
    netMarginPct,
    netMarginPerHour,
    netMarginPerWeek,
    netMarginPerContract,
    marginStatus,
    weeklyGross,
    weeklyTaxable,
    weeklyNonTaxableOut: weeklyNonTaxable,
    hourlyTaxable,
    hourlyBlended,
    otRate,
    callbackRateOut: callbackRate,
    holidayRateOut: holidayRate,
    onCallRateOut: onCallRate,
    regularHours,
    otHours,
  };
}
