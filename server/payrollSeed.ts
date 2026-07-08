/**
 * Payroll Engine — Idempotent startup seed (#854-A)
 *
 * Seeds:
 *  1. Default "Standard" salary structure + rules
 *  2. Establishment coverage defaults (EPF not_applicable, ESI not_applicable)
 *  3. State deductions (Punjab PSDT, selected zero-PT states, exposure-only states)
 *  4. Statutory rates (EPF/EPS/EDLI/ESI — CA must confirm before live run)
 *
 * All seeds are idempotent; safe to call on every server restart.
 */

import { db } from "./db";
import { salaryStructures, salaryStructureRules, establishmentCoverage, stateDeductions, statutoryRates } from "@shared/schema";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";

export async function seedPayrollDefaults(): Promise<void> {
  try {
    await seedStandardStructure();
    await seedEstablishmentCoverage();
    await seedStateDeductions();
    await seedStatutoryRates();
    console.log("[payrollSeed] Payroll defaults seeded successfully.");
  } catch (err) {
    console.error("[payrollSeed] Error seeding payroll defaults:", err);
  }
}

// ---------------------------------------------------------------------------
// 1. Standard salary structure
// ---------------------------------------------------------------------------

async function seedStandardStructure(): Promise<void> {
  // Upsert the structure (idempotent by unique name constraint)
  await db.execute(sql`
    INSERT INTO salary_structures (id, name, description, effective_date, is_active, pf_mode, jurisdiction)
    VALUES (
      gen_random_uuid(),
      'Standard',
      'Default structure: Basic 50%, HRA 50% of Basic, Conveyance ₹1,600 fixed, LTA 8.33% of Basic, Special Allowance residual',
      CURRENT_DATE,
      true,
      'restricted',
      'IN'
    )
    ON CONFLICT (name) DO NOTHING
  `);

  const [structure] = await db
    .select({ id: salaryStructures.id })
    .from(salaryStructures)
    .where(eq(salaryStructures.name, "Standard"))
    .limit(1);

  if (!structure) return;

  const structureId = structure.id;

  // Check if rules already exist
  const existingRules = await db
    .select({ id: salaryStructureRules.id })
    .from(salaryStructureRules)
    .where(eq(salaryStructureRules.structureId, structureId))
    .limit(1);

  if (existingRules.length > 0) return;

  const rules = [
    {
      structureId,
      componentName: "Basic",
      ruleType: "percent_of_gross" as const,
      valuePct: 5000,
      valueFixed: null,
      referenceComponent: null,
      lopMode: "proportional" as const,
      sortOrder: 1,
    },
    {
      structureId,
      componentName: "HRA",
      ruleType: "percent_of_component" as const,
      valuePct: 5000,
      valueFixed: null,
      referenceComponent: "Basic",
      lopMode: "proportional" as const,
      sortOrder: 2,
    },
    {
      structureId,
      componentName: "Conveyance",
      ruleType: "fixed" as const,
      valuePct: null,
      valueFixed: 160000,
      referenceComponent: null,
      lopMode: "fixed" as const,
      sortOrder: 3,
    },
    {
      structureId,
      componentName: "LTA",
      ruleType: "percent_of_component" as const,
      valuePct: 833,
      valueFixed: null,
      referenceComponent: "Basic",
      lopMode: "proportional" as const,
      sortOrder: 4,
    },
    {
      structureId,
      componentName: "Special Allowance",
      ruleType: "residual" as const,
      valuePct: null,
      valueFixed: null,
      referenceComponent: null,
      lopMode: "proportional" as const,
      sortOrder: 5,
    },
  ];

  for (const rule of rules) {
    await db.insert(salaryStructureRules).values(rule);
  }
}

// ---------------------------------------------------------------------------
// 2. Establishment coverage defaults
// ---------------------------------------------------------------------------

async function seedEstablishmentCoverage(): Promise<void> {
  await db.execute(sql`
    INSERT INTO establishment_coverage (id, scheme, status, threshold, applicable_from, is_latched, trigger_reason, jurisdiction)
    VALUES
      (gen_random_uuid(), 'EPF', 'not_applicable', 20, NULL, false, 'Below 20-employee threshold; seed default', 'IN'),
      (gen_random_uuid(), 'ESI', 'not_applicable', 10, NULL, false, 'Below 10-employee threshold; seed default', 'IN')
    ON CONFLICT (scheme, jurisdiction) DO NOTHING
  `);
}

// ---------------------------------------------------------------------------
// 3. State deductions
// ---------------------------------------------------------------------------

async function seedStateDeductions(): Promise<void> {
  type StateDeductionRow = {
    state: string;
    levyType: string;
    conditionType: string;
    thresholdPaise: number | null;
    amountPaise: number;
    isFlat: boolean;
    cadence: string;
    isRegistered: boolean;
    psdtAnnualThresholdPaise: number | null;
  };

  const rows: StateDeductionRow[] = [
    // Punjab PSDT: ₹200/month flat, registered. Annual threshold ₹250,000 (CA must confirm).
    {
      state: "Punjab",
      levyType: "PSDT",
      conditionType: "flat",
      thresholdPaise: null,
      amountPaise: 20000,
      isFlat: true,
      cadence: "monthly",
      isRegistered: true,
      psdtAnnualThresholdPaise: 25000000,
    },
    // Zero-PT states — no PT levied
    { state: "Delhi", levyType: "PT", conditionType: "flat", thresholdPaise: null, amountPaise: 0, isFlat: true, cadence: "monthly", isRegistered: false, psdtAnnualThresholdPaise: null },
    { state: "Uttar Pradesh", levyType: "PT", conditionType: "flat", thresholdPaise: null, amountPaise: 0, isFlat: true, cadence: "monthly", isRegistered: false, psdtAnnualThresholdPaise: null },
    { state: "Bihar", levyType: "PT", conditionType: "flat", thresholdPaise: null, amountPaise: 0, isFlat: true, cadence: "monthly", isRegistered: false, psdtAnnualThresholdPaise: null },
    { state: "Jammu & Kashmir", levyType: "PT", conditionType: "flat", thresholdPaise: null, amountPaise: 0, isFlat: true, cadence: "monthly", isRegistered: false, psdtAnnualThresholdPaise: null },
    { state: "Ladakh", levyType: "PT", conditionType: "flat", thresholdPaise: null, amountPaise: 0, isFlat: true, cadence: "monthly", isRegistered: false, psdtAnnualThresholdPaise: null },
    // Exposure-only states (PT applicable, company not yet registered)
    { state: "Maharashtra", levyType: "PT", conditionType: "flat", thresholdPaise: null, amountPaise: 0, isFlat: true, cadence: "monthly", isRegistered: false, psdtAnnualThresholdPaise: null },
    { state: "Karnataka", levyType: "PT", conditionType: "flat", thresholdPaise: null, amountPaise: 0, isFlat: true, cadence: "monthly", isRegistered: false, psdtAnnualThresholdPaise: null },
    { state: "Tamil Nadu", levyType: "PT", conditionType: "flat", thresholdPaise: null, amountPaise: 0, isFlat: true, cadence: "monthly", isRegistered: false, psdtAnnualThresholdPaise: null },
    { state: "West Bengal", levyType: "PT", conditionType: "flat", thresholdPaise: null, amountPaise: 0, isFlat: true, cadence: "monthly", isRegistered: false, psdtAnnualThresholdPaise: null },
    { state: "Telangana", levyType: "PT", conditionType: "flat", thresholdPaise: null, amountPaise: 0, isFlat: true, cadence: "monthly", isRegistered: false, psdtAnnualThresholdPaise: null },
  ];

  for (const row of rows) {
    await db.execute(sql`
      INSERT INTO state_deductions (
        id, state, levy_type, condition_type, threshold_paise, amount_paise,
        is_flat, cadence, is_registered, psdt_annual_threshold_paise, jurisdiction
      ) VALUES (
        gen_random_uuid(),
        ${row.state},
        ${row.levyType},
        ${row.conditionType},
        ${row.thresholdPaise},
        ${row.amountPaise},
        ${row.isFlat},
        ${row.cadence},
        ${row.isRegistered},
        ${row.psdtAnnualThresholdPaise},
        'IN'
      )
      ON CONFLICT (state, levy_type, jurisdiction) DO NOTHING
    `);
  }
}

// ---------------------------------------------------------------------------
// 4. Statutory rates (CA must confirm values before live run)
// ---------------------------------------------------------------------------

async function seedStatutoryRates(): Promise<void> {
  const rates = [
    // EPF employee: 12% of pfBasis, round nearest
    { levy: "EPF", key: "employee", valueBps: 1200, minimumPaise: null, maximumPaise: null, rounding: "nearest", effectiveFrom: "2020-04-01" },
    // EPF wage ceiling for restricted mode: ₹15,000/month
    { levy: "EPF", key: "ceiling_paise", valueBps: 0, minimumPaise: null, maximumPaise: 1500000, rounding: "nearest", effectiveFrom: "2014-09-01" },
    // EPS employer: 8.33%, capped at ₹1,250/month
    { levy: "EPS", key: "employer", valueBps: 833, minimumPaise: null, maximumPaise: 125000, rounding: "nearest", effectiveFrom: "2020-04-01" },
    // EDLI employer: 0.5%, capped at ₹75/month
    { levy: "EDLI", key: "employer", valueBps: 50, minimumPaise: null, maximumPaise: 7500, rounding: "nearest", effectiveFrom: "2020-04-01" },
    // EPF admin fee: 0.5%, minimum ₹500/month
    { levy: "EPF_ADMIN", key: "employer", valueBps: 50, minimumPaise: 50000, maximumPaise: null, rounding: "nearest", effectiveFrom: "2020-04-01" },
    // ESI employee: 0.75%, round UP (ESI Central Rules Rule 51)
    { levy: "ESI", key: "employee", valueBps: 75, minimumPaise: null, maximumPaise: null, rounding: "up", effectiveFrom: "2020-01-01" },
    // ESI employer: 3.25%, round UP
    { levy: "ESI", key: "employer", valueBps: 325, minimumPaise: null, maximumPaise: null, rounding: "up", effectiveFrom: "2020-01-01" },
    // ESI gross threshold: ₹21,000/month
    { levy: "ESI", key: "gross_threshold_paise", valueBps: 0, minimumPaise: null, maximumPaise: 2100000, rounding: "nearest", effectiveFrom: "2019-01-01" },
    // ESI disability gross threshold: ₹25,000/month
    { levy: "ESI", key: "disability_threshold_paise", valueBps: 0, minimumPaise: null, maximumPaise: 2500000, rounding: "nearest", effectiveFrom: "2019-01-01" },
  ];

  for (const rate of rates) {
    await db.execute(sql`
      INSERT INTO statutory_rates (
        id, jurisdiction, levy, key, value_bps, minimum_paise, maximum_paise, rounding, effective_from
      ) VALUES (
        gen_random_uuid(),
        'IN',
        ${rate.levy},
        ${rate.key},
        ${rate.valueBps},
        ${rate.minimumPaise ?? null},
        ${rate.maximumPaise ?? null},
        ${rate.rounding},
        ${rate.effectiveFrom}
      )
      ON CONFLICT (jurisdiction, levy, key, effective_from) DO NOTHING
    `);
  }

  // ---------------------------------------------------------------------------
  // Payroll Settings — typed engine config (lop_basis, visibility, jurisdiction)
  // ---------------------------------------------------------------------------
  await db.execute(sql`
    INSERT INTO payroll_settings (id, jurisdiction, lop_basis, show_employer_contribution_on_slip, default_jurisdiction)
    VALUES (gen_random_uuid(), 'IN', 'actual_working_days', true, 'IN')
    ON CONFLICT (jurisdiction) DO NOTHING
  `);

  // ---------------------------------------------------------------------------
  // System-settings payroll config — published key-value interface consumed by
  // the engine and future UI settings pages.
  // ---------------------------------------------------------------------------
  await db.execute(sql`
    INSERT INTO system_settings (key, value, updated_at) VALUES
      ('payroll_lop_basis',                        '"actual_working_days"', NOW()),
      ('payroll_show_employer_contribution_on_slip', 'true',                NOW()),
      ('payroll_default_jurisdiction',               '"IN"',                NOW())
    ON CONFLICT (key) DO NOTHING
  `);

  // ---------------------------------------------------------------------------
  // Salary Structure History — seed baseline rows so period-start resolution
  // works for all existing employees immediately after first deploy.
  // ON CONFLICT DO NOTHING is safe; only inserts if no row yet for the user.
  // ---------------------------------------------------------------------------
  await db.execute(sql`
    INSERT INTO salary_structure_history (id, user_id, structure_id, effective_from, assigned_by)
    SELECT gen_random_uuid(), id, salary_structure_id, '2020-01-01', 'system'
    FROM admin_users
    WHERE salary_structure_id IS NOT NULL
    ON CONFLICT DO NOTHING
  `);
}
