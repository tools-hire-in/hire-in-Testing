---
name: Addendum ensure-block column parity
description: Why offer_letter_addendums queries can 500 in prod/dev and how the startup ensure block must mirror schema.ts.
---

# offer_letter_addendums missing columns → SELECT * crash

Drizzle `db.select().from(offerLetterAddendums)` emits SQL naming **every** column
declared in `shared/schema.ts`. If the live DB is missing any of them, the query
throws Postgres `errorMissingColumn` and **every addendum listing 500s** — which
silently breaks unrelated features that fan out through addendums (e.g. the salary
proof-options dropdown at `/api/hr/salary-changes/proof-options`, which surfaces as
an *empty* dropdown, not an error, because the client falls back to `[]`).

**The trap:** the startup ensure block `ensureOfferLetterAddendumsTable()` in
`server/index.ts` added `reference_number` (UNIQUE) and `verify_auth_code` only to
`offer_letters`, never to `offer_letter_addendums`, even though schema.ts declares
them on both. `db:push` never applied them either (stalls on the unique-constraint
prompt), so both dev AND prod lacked the columns.

**Why:** the addendum ensure block must add *every* column schema.ts declares for
that table, in BOTH branches — the existing-table ALTER branch (`ADD COLUMN IF NOT
EXISTS`) and the fresh `CREATE TABLE` branch. Adding to only one branch leaves a gap
(fresh DBs on first boot, or existing DBs that never re-run).

**How to apply:** when adding a column to a table in `shared/schema.ts` that the app
reconciles via an ensure block (offer_letters, offer_letter_addendums, contracts,
hr_letters, etc.), add a matching `ADD COLUMN IF NOT EXISTS` to that table's ensure
ALTER branch *and* its CREATE TABLE branch. UNIQUE on a nullable column is fine in
Postgres (multiple NULLs allowed). Dev picks it up on workflow restart; **prod only
gets it on re-publish** (deploy runs the ensure block at startup).
