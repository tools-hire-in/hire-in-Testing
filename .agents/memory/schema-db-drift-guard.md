---
name: Schema/DB drift guard
description: Why db:push proposes to DROP live columns, and how the guards catch it
---

# Schema ↔ DB drift (ensure-blocks vs schema.ts)

This repo maintains schema three ways at once: `shared/schema.ts` (applied by
`drizzle-kit push`), idempotent "ensure" blocks in `server/index.ts` (run every
boot), and a dormant `migrations/` folder (only applied with
`RUN_MIGRATIONS=true`). The ensure-blocks are the de-facto mechanism, so an
ensure-block easily adds a column nobody mirrors into `schema.ts`.

**Rule:** every column/table an ensure-block creates MUST also be declared on the
matching `pgTable` in `schema.ts`, with the exact DB type/nullability.

**Why:** `db:push` treats `shared/schema.ts` as the single source of truth.
Anything in the live DB that schema.ts doesn't declare is a *deletion candidate*,
so `db:push` proposes to DELETE it (data loss). The fix is always purely additive
— add the missing column to schema.ts; never let push delete it.

**How to apply:** when reconciling, watch for a same-named column living on a
*different* table (e.g. `half_day` on `leave_requests` is unrelated to
`attendance.half_day`) — match the column to the table drizzle names in the
warning, not the first grep hit.

## Guard-wording gotcha (the core trap)
drizzle-kit's data-loss message is `You're about to delete <x> column ...` under a
`Found data-loss statements:` header — **never** `drop column`. A guard that greps
for `drop column` will never fire. Guards must match `data.loss`,
`delete .* (column|table)`, and the create-vs-rename prompt
(`is created or renamed` / `renamed from`).

## Guardrails in place
- `scripts/check-schema-drift.sh` — non-destructive (answers "No, abort"); exits 1
  on destructive/ambiguous drift or if `DATABASE_URL` is unset. Registered as the
  `schema-drift` validation; run before prod releases.
- `scripts/post-merge.sh` — pre-flight detect-then-apply: aborts the merge on
  destructive/ambiguous change instead of force-applying first.
- Never answer a drizzle "is created or renamed" prompt as a rename (destructive).
