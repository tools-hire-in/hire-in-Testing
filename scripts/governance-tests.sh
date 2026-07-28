#!/usr/bin/env bash
# Run governance test suites sequentially so they don't race over shared test data.
# Both files use the same fixed test user UUIDs and must not overlap in the DB.

set -o pipefail

npx tsx --test server/tests/governance.test.ts
RESULT1=$?

npx tsx --test server/tests/governancePulse.test.ts
RESULT2=$?

exit $((RESULT1 | RESULT2))
