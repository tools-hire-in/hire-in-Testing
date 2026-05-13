#!/bin/bash
set -e
npm install

# Run db:push but abort if it would perform any destructive operation (DROP TABLE, DROP COLUMN, TRUNCATE).
# Drizzle --force bypasses interactive prompts but also auto-approves destructive changes, which is
# dangerous when the Drizzle snapshot is out of sync with startup-migration-applied columns.
# Strategy: capture the plan output, grep for destructive keywords, and refuse to proceed if found.
PUSH_OUTPUT=$(npm run db:push -- --force 2>&1 || true)
echo "$PUSH_OUTPUT"
if echo "$PUSH_OUTPUT" | grep -qiE "drop column|drop table|truncate|delete.*column|remove.*column"; then
  echo ""
  echo "ERROR: post-merge db:push would perform a destructive operation (see above)."
  echo "Schema changes that require DROP operations must be applied via a startup migration"
  echo "in server/index.ts (ALTER TABLE ... ADD COLUMN IF NOT EXISTS), not via db:push."
  echo "Aborting post-merge setup. Manual intervention required."
  exit 1
fi
