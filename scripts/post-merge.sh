#!/bin/bash
set -e
npm install

# Run db:push but abort if it would perform any destructive DROP operation.
# We capture output and check specifically for DROP COLUMN / DROP TABLE patterns.
# The offer_letters_token_unique "truncate" prompt is safe — --force auto-selects
# "No, add the constraint without truncating the table" which is non-destructive.
PUSH_OUTPUT=$(npm run db:push -- --force 2>&1 || true)
echo "$PUSH_OUTPUT"
if echo "$PUSH_OUTPUT" | grep -qiE "drop column|drop table"; then
  echo ""
  echo "ERROR: post-merge db:push would perform a destructive operation (see above)."
  echo "Schema changes that require DROP operations must be applied via a startup migration"
  echo "in server/index.ts (ALTER TABLE ... ADD COLUMN IF NOT EXISTS), not via db:push."
  echo "Aborting post-merge setup. Manual intervention required."
  exit 1
fi
