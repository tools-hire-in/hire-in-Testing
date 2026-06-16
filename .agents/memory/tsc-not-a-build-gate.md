---
name: tsc is not a build gate
description: This repo has hundreds of pre-existing tsc errors; the build uses tsx/esbuild, not strict type-checking.
---

Running `npm run check` (= `tsc`) on this repo reports **hundreds of pre-existing errors** and is NOT a release gate. The dev workflow (`tsx server/index.ts`) and `npm run build` (`tsx script/build.ts`) transpile with esbuild, which does not type-check.

**Why:** The codebase has long-standing systemic patterns tsc flags but esbuild ignores: `req.query.x` typed `string | string[]`, `Set`/`Map` iteration needing `--downlevelIteration`, occasional missing imports (e.g. `adminUsers`), and `string`→enum assignments. These predate any single task.

**How to apply:** Do not try to "fix the build" by clearing tsc output, and do not treat a non-empty `tsc` run as your change being broken. To check whether YOUR change introduced a regression, run `tsc` and grep the output for only the files you touched, comparing against the pre-existing baseline. Real verification here is the targeted test suites (e.g. `npx tsx --test server/tests/attendancePolicy.test.ts`) plus the running workflow, not a clean `tsc`.
