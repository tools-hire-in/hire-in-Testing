---
name: Payroll tables bootstrap
description: How to create payroll schema tables when db:push is blocked; enum pitfalls.
---

# Payroll Tables Bootstrap

## The rule
`db:push` stalls on an interactive `offer_letters_reference_number_unique` prompt that cannot be bypassed with `--force` or piped newlines. When you need to create payroll tables in a fresh dev DB, use `psql $DATABASE_URL -f /tmp/migration.sql` with raw `CREATE TABLE IF NOT EXISTS` statements.

**Why:** The drizzle prompt asks whether to truncate `offer_letters` before adding the unique constraint, and requires a TTY to select an option. There is no non-interactive flag that skips all prompts including this one.

## Enum pitfalls
- `lop_mode` enum must be `('proportional', 'fixed')` — NOT `'flat'`. Schema uses `'fixed'`; payrollSeed seeds `lopMode: "fixed"`.
- Create all custom enums (`pf_mode`, `rule_type`, `lop_mode`, `coverage_status`, `rounding_mode`) before the tables that reference them, using `DO $$ BEGIN IF NOT EXISTS ... END $$` guards.

## Column gaps between schema.ts and raw SQL create
`payroll_settings` in schema.ts needs: `lop_basis`, `default_jurisdiction`, `updated_by` — not just the simpler columns.
`headcount_history` needs: `jurisdiction` column.
`admin_users` payroll flags: `salary_structure_id`, `pf_exempt`, `pt_state`, `esi_applicable`, `esi_disability`, `esi_daily_wage_exempt`, `esi_covered_until`.

## How to apply
1. Write a `/tmp/create_payroll_tables.sql` that creates all tables + enums + seeds coverage defaults + payroll_settings row.
2. Run `psql $DATABASE_URL -f /tmp/create_payroll_tables.sql`.
3. If lop_mode already exists with wrong values: `ALTER TYPE lop_mode ADD VALUE IF NOT EXISTS 'fixed';`
4. Restart the workflow — payrollSeed should print `Payroll defaults seeded successfully.`
