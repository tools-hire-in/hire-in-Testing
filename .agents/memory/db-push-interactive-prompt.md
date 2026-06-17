---
name: db:push interactive prompt & schema drift
description: Why drizzle-kit push stalls/oscillates here, and the correct dev-DB-repair path for production readiness.
---

# db:push prompts, constraint-name drift, and FK oscillation

`npm run db:push` (drizzle-kit) here has two recurring quirks. Neither is fixed by editing
schema source alone; both are resolved by **repairing the dev DB directly** (non-destructive SQL).

## 1. Interactive truncate prompt on unique constraints  (was the "hang")
Drizzle's `.unique()` on a column expects a constraint named `<table>_<col>_unique`. The dev DB
often has the Postgres auto-name `<table>_<col>_key` instead (from inline UNIQUE / older state).
drizzle-kit sees the `_unique` missing and tries to ADD it, which on a populated table triggers an
interactive "Do you want to truncate <table>?" prompt. With no TTY (post-merge), it reads EOF and
**aborts that statement AND every later statement in the push** — so other pending additive changes
(e.g. a new nullable column) silently never apply.

**Fix:** rename the constraint on the dev DB so the names match — then db:push runs prompt-free:
`ALTER TABLE <t> RENAME CONSTRAINT <t>_<col>_key TO <t>_<col>_unique;`
Find all at once: parse `.unique()` columns from schema.ts, diff vs `pg_constraint` (contype='u');
rename every `_key` that has a matching schema `.unique()` and no existing `_unique`. Leave composite
uniques and any `_key` with no single-col `.unique()` declaration alone.

## 2. Long foreign-key names oscillate forever (benign)
FK names drizzle generates as `<table>_<col>_<reftable>_<refcol>_fk` can exceed Postgres's 63-char
identifier cap; Postgres truncates on storage, so drizzle-kit's full name never matches the stored
truncated name → it DROP+ADDs those FKs on **every** push (output: "[✓] Changes applied" every run,
never "No changes detected"). **Cosmetic, dev-only, non-destructive.** Do NOT chase it by renaming
FKs unless idempotent db:push output is explicitly required — it's an invasive multi-table refactor
with zero production benefit (see below).

## Why this matters for production / Publish
Replit Publish diffs the **dev DB against the prod DB via introspection** (NOT schema.ts). So:
- The dev DB must actually match schema.ts, or prod won't get the column/table either.
- Both dev & prod are real Postgres and truncate identifiers identically, so the long-FK names match
  on both sides → the oscillation causes **zero churn at Publish**.
- For a column already in schema.ts but missing from dev (drift): just add it to the dev DB
  (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`); schema source is already correct; first/next Publish
  carries it to prod. **Do NOT add startup DDL to server/index.ts to self-heal** — the codebase has
  many such ensure-blocks but the official guidance (database-migrations-on-publish) is against
  adding new ones; they run on prod boot too. Repair dev DB + rely on db:push + Publish instead.
