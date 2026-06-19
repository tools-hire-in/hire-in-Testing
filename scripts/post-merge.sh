#!/bin/bash
set -e
npm install

# --- Schema drift guard ------------------------------------------------------
# Pre-flight: detect DESTRUCTIVE / AMBIGUOUS schema changes WITHOUT applying
# them, then apply only if safe.
#
# Why this changed: the previous guard ran `db:push --force` FIRST and then
# grepped the output for "drop column|drop table". But drizzle-kit's force mode
# applies data-loss changes immediately, AND its wording is "delete <x> column"
# (never "drop column"), so destructive drops were applied and never caught.
#
# Now we answer "No, abort" to every prompt (so nothing destructive is applied),
# scan for the real data-loss / rename wording, and abort the merge if found.
# Purely additive changes are applied by this same pre-flight pass.
PLAN_OUTPUT=$(printf 'No, abort\n' | npm run db:push 2>&1 || true)
echo "$PLAN_OUTPUT"
if echo "$PLAN_OUTPUT" | grep -qiE "data.loss|delete .* (column|table)|drop (column|table)|is created or renamed|renamed from"; then
  echo ""
  echo "ERROR: post-merge db:push detected a destructive or ambiguous schema change (see above)."
  echo "A column/table likely exists in the DB but is missing from shared/schema.ts."
  echo "Reconcile shared/schema.ts with the DB so the change is additive, then re-run."
  echo "NEVER resolve a drizzle 'is created or renamed' prompt as a rename — it is data-destructive."
  echo "Aborting post-merge setup. Manual intervention required."
  exit 1
fi
# Safe: settle any benign constraint/index naming non-destructively.
npm run db:push -- --force
# -----------------------------------------------------------------------------

# Seed the 22nd Century Healthcare SSA contract template (idempotent).
# This ensures prod deployments have the template even before the first server restart.
echo "Seeding contract templates..."
npx tsx server/contractTemplateSeed.ts || echo "[post-merge] Seeder note: will be applied on next server startup (non-fatal)"
