---
name: India Statutory Payroll Engine
description: Architecture, rounding rules, and wiring for the India EPF/ESI/PT computation engine.
---

# India Statutory Payroll Engine

## Architecture
- **server/payrollEngine.ts** — pure computation (no DB). All money in integer paise throughout. Two main surfaces: `computeComponentsFromGross` (topo-sorted structure rules + LOP) and `IndiaStatutoryEngine.compute` (EPF/EPS/EDLI/ESI/state deductions).
- **server/payrollSeed.ts** — idempotent startup seed: Standard structure (Basic 50%, HRA 50% of Basic, Conveyance ₹1,600, LTA 8.33%, Special Allowance residual), establishment defaults (not_applicable), statutory rates, state deductions.
- **DB tables**: salary_structures, salary_structure_rules, state_deductions, establishment_coverage, headcount_history, statutory_rates, salary_slip_revisions — all created via direct SQL (db:push is blocked by offer_letters_reference_number_unique interactive prompt).
- **Schema columns**: adminUsers has salary_structure_id, pf_exempt, pt_state, esi_disability, esi_applicable, esi_covered_until, esi_daily_wage_exempt; salarySlips has computation_snapshot (jsonb) and jurisdiction.

## Key Rules
- **ESI rounding**: `Math.ceil(paise)` — rounds UP to nearest paise. For ₹21,000 × 0.75% = 15,750 paise exactly (no rounding needed). For sub-paise results like 13500.75, ceil gives 13501.
- **EPF rounding**: `Math.round(paise)` — nearest paise.
- **50% wage floor**: if Basic < 50% of gross, pfBasis = 50% of gross (not Basic).
- **EPS cap**: ₹1,250/month (15,000 × 8.33%). In unrestricted mode, EPS basis = min(pfBasis, 15,000/month).
- **PSDT (Punjab)**: flat ₹200/month, NOT prorated by LOP.
- **ESI window**: Apr–Sep covered until Sep 30; Oct–Dec/Jan–Mar covered until Mar 31 (next year for Oct–Dec).
- **Net floor**: ₹0 — statutory + advance deductions never push net below zero.

## Wiring
- `seedPayrollDefaults()` called from `runStartupTasks` in server/index.ts via dynamic import.
- `runEsiBackfill()` (defined at module top level in server/index.ts) runs once, gated by system_settings marker `esi_backfill_v1_done`. Sets esi_covered_until for active employees within ESI gross threshold.
- `buildComputationSnapshot()` in server/routes.ts loads structure rules + coverage + rates from DB and runs the engine. Called on first salary slip ledger write (when existingLedger is null). Returns null gracefully if employee has no salary_structure_id.

## Why
- All money in paise avoids floating-point drift; display layer converts via paiseToRupees().
- Graceful degradation: slips without a salary structure assigned still work, they just lack computation_snapshot.
- ESI backfill is one-time (system_settings marker) so it never re-fires on restart and flip fresh data.

## Test runner
`npx tsx --test tests/payrollEngine.test.ts` — 19 golden vectors, all must pass before any engine change ships.
