#!/bin/bash
# ---------------------------------------------------------------------------
# Schema drift guard.
#
# Fails (exit 1) when the live database diverges from shared/schema.ts in a
# DESTRUCTIVE or AMBIGUOUS way:
#   - a column or table exists in the DB but not in schema.ts (db:push would
#     DELETE it -> data loss), or
#   - drizzle-kit cannot tell whether a table was created or RENAMED (the
#     create-vs-rename trap, which can silently drop a table + its data).
#
# It is non-destructive for those cases: it answers "No, abort" to every
# drizzle prompt, so nothing destructive is ever applied. Purely additive
# changes (new columns/tables that only exist in schema.ts) ARE applied, which
# is the desired "keep DB in sync" behaviour.
#
# IMPORTANT: drizzle-kit's data-loss wording is "delete <x> column", NOT
# "drop column". The old guard grepped for "drop column" and therefore never
# caught a real drop. Keep this grep aligned with drizzle's actual output.
# ---------------------------------------------------------------------------
set -uo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ DRIFT CHECK: DATABASE_URL not set — cannot verify schema drift. Failing."
  exit 1
fi

OUT=$(printf 'No, abort\n' | npm run db:push 2>&1 || true)
echo "$OUT" | grep -vE "Pulling schema from database"

if echo "$OUT" | grep -qiE "data.loss|delete .* (column|table)|drop (column|table)|is created or renamed|renamed from"; then
  echo ""
  echo "❌ SCHEMA DRIFT DETECTED (destructive or ambiguous)."
  echo "A column/table exists in the database but not in shared/schema.ts,"
  echo "or a create-vs-rename is ambiguous."
  echo "Fix: reconcile shared/schema.ts with the DB so the change is purely"
  echo "additive (add the missing column/table to schema.ts), then re-run."
  exit 1
fi

echo "✅ No destructive schema drift between shared/schema.ts and the database."
