---
name: Test runner is node:test, not vitest
description: How to actually run the server test suite in this repo
---

The server test suite (`server/tests/*.test.ts`) uses the **node:test** runner
(`import { describe, it, before, after } from "node:test"`), NOT vitest.

Run it with: `npx tsx --test server/tests/attendancePolicy.test.ts`

**Why:** `npx vitest run ...` resolves the only vite/vitest config in the repo
(`vite.config.ts`, scoped to the `client` workspace) and reports "No test files
found" / "No test suite found in file". There is no `test` script in
package.json and no vitest config.

**How to apply:** Always invoke server tests via `tsx --test`. Don't waste time
trying to coax vitest into running them.
