Status: Current-state practitioner reference
Generated from: replit.md, package.json, drizzle.config.ts, scripts/ directory, server/index.ts, Phase 1 memory notes (confirmed)
Date: 2026-07-13
Human approval required: Yes — for all UNABLE_TO_CONFIRM items listed within
Unresolved items: 2

---

# Engineering Runbook

This document covers only confirmed operational procedures. Every step is either confirmed directly in code, in `replit.md`, or in the Phase 1 memory notes (which record behavior confirmed during live debugging). Nothing speculative is included.

---

## Environment: Replit

The application runs on Replit. All development, deployment, and schema operations are performed within the Replit environment. `CONFIRMED_IN_EXISTING_GUIDE`

- Deployed via Replit's built-in deployment. Published version runs in a separate production environment.
- Checkpoints (codebase + database snapshots) are created automatically. Rollback is possible to any checkpoint via the Replit interface.
- All environment variables are managed via Replit Secrets (never hardcoded). See Environment Variables section below.

---

## Development Commands

All commands confirmed from `package.json`. `CONFIRMED_IN_CODE`

| Command | Purpose |
|---|---|
| `npm run dev` | Start development server. Runs `NODE_ENV=development tsx server/index.ts`. Starts Express backend and Vite frontend together on the same port. |
| `npm run build` | Production build. Runs `tsx script/build.ts`. |
| `npm run start` | Start production server. Runs `NODE_ENV=production node dist/index.cjs`. |
| `npm run check` | TypeScript type check. See warning below — this is NOT a build gate. |
| `npm run db:push` | Push schema to the database via Drizzle Kit. See full procedure below. |

---

## Critical Warning: TypeScript Compilation Is Not a Build Gate

`CONFIRMED_IN_CODE` — The repository contains pre-existing TypeScript errors that have accumulated over development. `npm run check` (`tsc`) will fail with these pre-existing errors. This is the current state of the codebase and does not prevent the application from building or running.

**The build uses `tsx` and `esbuild`, not `tsc`.** Verify code correctness through manual testing, not through a clean `tsc` run. Do not attempt to fix all tsc errors in a batch — the impact on the running application is not guaranteed to be zero.

---

## Critical Warning: Backend Watch Is Not Enabled

`CONFIRMED_IN_EXISTING_GUIDE` — The development server runs `tsx` without a `--watch` flag. Backend route changes (new endpoints, modified middleware) are NOT reflected in the running server until the workflow is restarted.

**After any backend change: restart the `Start application` workflow.** Frontend changes (React components, client-side logic) are hot-reloaded by Vite without a restart.

---

## Schema Management Procedure

The single source of truth for the database schema is `shared/schema.ts`. `CONFIRMED_IN_EXISTING_GUIDE`

### Normal Schema Change Procedure (New Column or Table)

1. Add the new table or column declaration to `shared/schema.ts`. This is the required first step.
2. Add a matching `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` or `CREATE TABLE IF NOT EXISTS` block to the relevant startup ensure-block in `server/index.ts`. Ensure-blocks must be kept in parity with `shared/schema.ts` — a column owned by an ensure-block but not declared in `schema.ts` will be deleted by the next `db:push`.
3. Run `npm run db:push` in a TTY (terminal). Drizzle Kit uses an arrow-key terminal UI that requires an interactive terminal. It cannot be piped or run non-interactively. `CONFIRMED_IN_CODE`
4. Read every prompt that Drizzle Kit presents. Answer as follows:
   - For new tables or new columns: select "Yes" to apply.
   - For prompts that say "is created or renamed": **always answer "No, abort"**. This prompt indicates Drizzle cannot tell if a table was renamed or created. Answering "Yes" (as a rename) drops the original table and its data. See Critical Warning below.
   - For unrelated `_key` vs `_unique` constraint name prompts: answer "No, abort" and investigate. `CONFIRMED_IN_EXISTING_GUIDE`

### Critical Warning: Never Answer "Yes" to a "Created or Renamed" Prompt

`CONFIRMED_IN_EXISTING_GUIDE` — If Drizzle Kit asks "is created or renamed", this is a rename detection prompt. Answering "Yes" treats the change as a rename, which silently drops the original table and all its data. **The correct answer is always "No, abort".**

When this prompt appears: add the missing column or table as a new declaration in `schema.ts`, not as a rename. Then re-run `db:push`.

### Special Case: Payroll Tables and Other Tables That Stall db:push

`CONFIRMED_IN_EXISTING_GUIDE` — Drizzle Kit `db:push` stalls and cannot complete in non-interactive mode for some schema additions, particularly when unique constraint name prompts appear for unrelated existing constraints. In these cases:

1. Do NOT attempt to work around by adding startup DDL that schema.ts doesn't know about.
2. Apply the new tables via a direct SQL script: create a TypeScript script in the `scripts/` directory that calls `db.execute(sql`...`)` directly.
3. Register the new columns/tables in `schema.ts` so that future `db:push` runs recognize them and do not flag them as orphans.

---

## Drift Guard

**Script:** `scripts/check-schema-drift.sh`

This script detects destructive or ambiguous drift between the live database and `shared/schema.ts`. It answers "No, abort" to every Drizzle prompt — it never applies any changes. It only reports.

```bash
bash scripts/check-schema-drift.sh
```

**Run before every production release.** The script fails (exit 1) when:
- A column or table exists in the live database but not in `schema.ts` (drizzle would delete it on next push).
- Drizzle cannot determine if a change is a creation or a rename.

**Critical wording note:** Drizzle's data-loss message is `"delete <x> column"` — NOT `"drop column"`. The drift guard grep is aligned to this exact phrase. `CONFIRMED_IN_CODE`

---

## Merge Guard

**Script:** `scripts/post-merge.sh`

Runs the same drift pre-flight as the drift guard, then applies `db:push --force` if the pre-flight passes. The merge guard aborts on any destructive or ambiguous change.

This script runs automatically after task merges. `CONFIRMED_IN_EXISTING_GUIDE`

---

## Test Commands

`CONFIRMED_IN_EXISTING_GUIDE` — Server-side tests use the Node.js built-in `node:test` runner.

**Correct command:**
```bash
npx tsx --test
```

**Do NOT use Vitest for server-side tests.** Vitest picks up the client-side Vite configuration and produces incorrect or empty results for backend test files. `CONFIRMED_IN_EXISTING_GUIDE`

**Current test coverage:** 0 automated tests confirmed passing as of Phase 1 audit date. All decision point verification is currently manual-only or governance-doc-based. See `docs/qa/DECISION_COVERAGE_MAP.md` for priority test targets.

---

## Environment Variables

All variables confirmed from Phase 1 `docs/architecture/INTEGRATIONS_AND_DEPENDENCIES.md` and `docs/platform/SYSTEM_LANDSCAPE.md`. `CONFIRMED_IN_CODE`

Names only — never store values in code or documentation. Manage via Replit Secrets.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Express session signing secret |
| `COOKIE_DOMAIN` | Session cookie domain |
| `SENDGRID_API_KEY_NEW` | SendGrid email delivery |
| `CEIPAL_EMAIL` | Ceipal ATS authentication email |
| `CEIPAL_PASSWORD` | Ceipal ATS authentication password |
| `CEIPAL_API_KEY` | Ceipal ATS API key |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | Replit AI Integrations API key (OpenAI-compatible) |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | Replit AI Integrations base URL |
| `PORTAL_BASE_URL` | Portal base URL used in email deep-links |
| `NODE_ENV` | `development` or `production` (controls TOTP enforcement and other prod-only behaviors) |
| `RUN_MIGRATIONS` | Set to `true` only to apply dormant migration files. Not used in normal deployments. |

`UNABLE_TO_CONFIRM — OWNER REVIEW REQUIRED`: The complete list of environment variables set in the production Replit Secrets may differ from this list. This list covers all variables found in code reading; undocumented variables may exist.

---

## Startup Behavior

`CONFIRMED_IN_EXISTING_GUIDE` — Boot stability notes:

1. The HTTP server **must open its port before any database ensure-work starts**. `server/index.ts` calls `app.listen()` first, then runs database ensure-blocks asynchronously. If the DB work is awaited before `listen()`, the process times out before any request can be served.
2. There is one shared bounded connection pool. The session store reuses this pool — no separate unbounded pool is opened.
3. `uncaughtException` handler: graceful shutdown. `unhandledRejection` handler: keep-alive (logs and continues). `CONFIRMED_IN_EXISTING_GUIDE`

---

## Feature Flags

All feature flags are managed in three required locations. Missing any one of the three causes the flag to be permanently OFF with no error or warning. `CONFIRMED_IN_CODE`

| Location | What to add |
|---|---|
| `ALLOWED_FLAGS` in `server/routes.ts` | Register the flag key string |
| `flagDefs` array in `client/src/pages/admin/hr/HRSettings.tsx` | Add UI label and description for HR settings |
| `FLAG_DEFAULTS` seed block in `server/index.ts` | Set the default ON/OFF value |

All three must be present. Adding a flag to only one or two locations leaves it silently disabled.

Current flags: `salary_advance_enabled`, `notifications_enabled`, `onboarding_training_enabled`, `performance_management_enabled`, `document_reminder_emails`, `new_look`, `studio_v2_enabled`, `process_governance`. `CONFIRMED_IN_CODE`

---

## Production Change Checklist

Before any production release or schema change:

1. Run `bash scripts/check-schema-drift.sh` and confirm it exits 0 (no destructive drift).
2. If adding a new feature flag: confirm it is registered in all three required locations.
3. Confirm the SendGrid sender (`alina.carter@hire-in.com`) is active and the domain (`hire-in.com`) remains authenticated. See `docs/ops/sendgrid-sender-verification.md`.
4. If the change involves new tables applied via direct SQL scripts: confirm the tables are also declared in `shared/schema.ts` so the drift guard does not flag them on the next run.
5. `UNABLE_TO_CONFIRM — OWNER REVIEW REQUIRED`: The exact production deployment promotion process (who approves, which Replit workflow triggers the prod build, and how environment variables are promoted) cannot be confirmed from code alone. Owner should document this process.

---

## Rollback

Rollback is checkpoint-based via the Replit interface. Replit creates checkpoints of the codebase and database state automatically. Rolling back to a checkpoint restores both the code and the database to the checkpoint state.

`CONFIRMED_IN_EXISTING_GUIDE` — When a rollback is needed: navigate to the Replit checkpoint browser, identify the last known-good checkpoint, and roll back. No manual git operation is required.

---

## Cron Jobs and Scheduler

All scheduled jobs run via `node-cron` in `server/scheduler.ts`. `CONFIRMED_IN_CODE`

| Job | Schedule (IST) | Purpose |
|---|---|---|
| Absence sweep | 01:30 daily | Marks employees as `absent` for the previous calendar day |
| Leave accrual | 1st of month, 00:00 | Accrues EL (128h threshold) and SL (30-day eligibility) |
| Year-end lapse | December batch | Lapses excess EL above carry-forward cap |
| Overdue reminders | Daily | Check-in and plan overdue nudges |
| SOP compliance sweep | Daily | Evaluates compliance lock conditions |
| Ceipal token refresh | Every 55 minutes | Refreshes Bearer token for Ceipal ATS integration |

The scheduler runs within the same Node.js process as the Express server. If the server restarts, cron jobs resume on the next scheduled interval.

---

## Content Studio AI Models

`CONFIRMED_IN_EXISTING_GUIDE` — AI calls go through the Replit AI Integrations proxy (`AI_INTEGRATIONS_OPENAI_*` env vars), not a direct OpenAI API key.

| Model tier | Model name | Use case |
|---|---|---|
| Economy | `gpt-5-mini` | Draft generation, lower-cost tasks |
| Standard / Strong | `gpt-5.4` | Review, approval, BD agent |

If `max_completion_tokens` is set too small for `gpt-5*` variants, the response returns empty. Set a sufficiently large value. `CONFIRMED_IN_EXISTING_GUIDE`
