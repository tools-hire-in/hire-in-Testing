---
name: Apply simple schema additions without db:push
description: Decision rule for adding a column when db:push would prompt on unrelated diffs
---

**Rule:** In this repo, do not rely on `npm run db:push` for a small additive schema
change. Add the column with an idempotent migration (`ALTER TABLE ... ADD COLUMN IF
NOT EXISTS ...`) committed to `migrations/` plus a matching `_journal.json` entry,
and apply it directly via `psql "$DATABASE_URL"` if needed for the dev DB.

**Why:** db:push applies ALL pending schema diffs at once and this repo carries
standing diffs that trigger a destructive interactive TUI prompt; that prompt reads
the raw TTY, so it cannot be answered via piped stdin and the command hangs. The repo
convention is hand-authored idempotent migrations, not push-driven snapshots.

**How to apply:** when a task only adds a column/table, author the migration file +
journal entry to match existing numbering, keep it `IF NOT EXISTS`, and avoid db:push.
