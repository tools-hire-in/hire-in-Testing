---
name: Prod migration path
description: How DB migrations actually run on production deployment for this app.
---

# Production Migration Path

## How it works
1. Deploy target is `vm` (persistent DB, `.replit` `deploymentTarget = "vm"`).
2. On startup: `server/index.ts` line 1073 calls `runMigrations()` → `drizzle migrate()` over `migrations/` folder using `_journal.json`.
3. After runMigrations: idempotent startup ensure block runs (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `ALTER TYPE ... ADD VALUE IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`).
4. `db:push` (`drizzle-kit push`) is ONLY in `scripts/post-merge.sh` — runs in DEV after task merges, NEVER in prod.

## Critical: Drizzle drift preview ≠ prod migration
The output of `drizzle-kit generate` or `drizzle-kit push --dry-run` is a drift preview comparing `shared/schema.ts` to the journal snapshot. It is NON-idempotent (raw `ADD COLUMN` without `IF NOT EXISTS`, `DROP CONSTRAINT` of names that may not exist). **Do NOT run it directly against prod.**

## Fresh DB ordering (journal 0000-0012)
- `0007_add_missing_columns` creates `offer_letters`, `offer_letter_addendums`, `performance_goals`
- `0011_offer_letter_probation` alters `offer_letters` (safe: table exists from 0007)
- `0012_standalone_addendum` drops NOT NULL + adds columns on `offer_letter_addendums` (safe: table from 0007)
- `0009` / `0010` add contract candidates/agreement_date and contract_templates client_id

## Known drift (harmless but worth fixing)
- `attendance_regularizations.request_type` / `status`: `shared/schema.ts` declares as pgEnum, but runtime ensure block creates as VARCHAR. Harmless unless `db:push --force` ever hits prod.
- `0008_attendance_regularization.sql` exists but is NOT registered in journal (correct — it has a broken INSERT referencing non-existent `system_settings.description/updated_by` columns).
