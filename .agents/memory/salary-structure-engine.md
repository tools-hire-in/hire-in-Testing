---
name: Salary structure engine
description: India payroll computation engine architecture — where things live and key design decisions.
---

# Salary Structure Engine

## Architecture
- **Pure computation**: `server/salaryEngine.ts` — `computeComponentsFromGross()` and `computeIndiaStatutory()`. No DB calls; side-effect free.
- **Shared types**: `shared/salaryEngineTypes.ts` — `ComponentBreakdown`, `StatutoryResult`, `SlipComponents`. Lives in `shared/` so `salarySlipHtml.ts` (used by both client and server) can import it.
- **DB tables**: `salary_structures` + `salary_structure_rules` (component rules per structure).
- **Employee flags**: `admin_users.salary_structure_id`, `pf_exempt`, `esi_disability`.
- **Slip storage**: `salary_slips.components` JSONB stores the `SlipComponents` snapshot at generation time.
- **CRUD routes**: `server/salaryStructureRoutes.ts` — list/create/update/delete structures, replace rules, preview, employee payroll profile GET/PUT, PT slabs.
- **PT state**: stored in `system_settings` key `pt_state`; custom slab overrides in `pt_slabs_custom`.

## Key design decisions
- `pfMode: 'restricted'` caps PF basis at ₹15,000 (default, legal minimum); `'unrestricted'` uses actual Basic (common for IT firms).
- `lopMode: 'proportional'` reduces component by `presentDays/workingDays`; `'fixed'` keeps component unchanged regardless of LOP.
- The **residual** rule type absorbs rounding: `grossAfterLOP − sum(other components post-LOP)`. Always put Special Allowance last as residual.
- `executive` role has full operational access to all salary structure routes (they run India payroll).

**Why:** Gross in salary run `reportData` rows comes from `generateMonthlySalaryReport` (post-attendance, pre-statutory). Engine adds statutory on top. Net = gross − statutory employee − advanceRecovery. Formula is consistent across render, PDF, generate, and regenerate paths.

## Historical reproducibility
- Render path queries the `salary_slips` ledger row FIRST; if `components` JSONB is stored, use it directly (snapshot from generation time).
- Fresh computation from current structure rules only on first render (no ledger row yet).
- Prevents slip values from drifting when HR edits structure rules after payroll is finalized.

## Employee payroll profile assignment
- `PayrollProfileCard` in `MyTeam.tsx` SalaryTab: shows structure, PF mode, PF exempt, ESI disability.
- Edit dialog uses `/api/hr/salary-structures` for dropdown and PUT `/api/hr/employees/:id/payroll-profile` to save.
- Roles that can edit: super_admin, admin, hr, executive.

## PT state configuration
- GET/PUT `/api/hr/payroll/pt-state` routes in salaryStructureRoutes.ts (canSettings middleware).
- `ProfessionalTaxSettingsCard` in HRSettings.tsx payroll section: dropdown for state, live slab preview.
- Stored in `system_settings.key = "pt_state"`. Validated against allowed state list.
