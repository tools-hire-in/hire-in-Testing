Status: Training track source material — reviewed and version-controlled
Generated from: docs/training/TRAINING_GAP_MAP.md, docs/engineering/ENGINEERING_RUNBOOK.md, docs/architecture/DATABASE_ARCHITECTURE.md, replit.md, memory notes (confirmed)
Date: 2026-07-13
Human approval required: Yes — this document is source material for human review before being committed to the live training track in the platform.
Unresolved items: 0

---

# Developer Onboarding — Training Track Source Material

**Purpose of this document:** This file is the reviewed, corrected, and version-controlled source material for the "Developer Onboarding" training track seeded in the platform under Task #1014. The content in this file should be used to update the `body` fields of the existing `track_sections` rows if the seeded content needs correction after human review.

**Training track target audience:** New engineers joining the project.
**Track priority:** HIGH — confirmed in `docs/training/TRAINING_GAP_MAP.md`.

Each section below covers one identified training gap. Each section follows the standard format: Purpose → Who uses it → Where to find it → How to use it → Important rules → [Scenario / Common mistake / Practical exercise for high-risk topics] → Knowledge check → Where to get help.

---

## Topic 1: Platform Architecture Overview

**Purpose:** Understand the system structure before writing any code so you can navigate the codebase confidently and place new code in the right location.

**Who uses this knowledge:** All engineers.

**Where to find it:**
- Architecture overview: `docs/platform/SYSTEM_LANDSCAPE.md`
- Database architecture: `docs/architecture/DATABASE_ARCHITECTURE.md`
- Route list: `client/src/App.tsx`

### How to Use It

The application is a single monorepo:
- **`shared/`** — types, schema, and Zod validators used by both frontend and backend. Start here to understand the data model.
- **`server/`** — Express backend. `server/index.ts` is the entry point. `server/routes.ts` contains all route definitions. `server/storage.ts` contains all database queries.
- **`client/src/`** — React frontend. `client/src/App.tsx` registers all routes. Pages are in `client/src/pages/`.

The application starts with `npm run dev` (runs `NODE_ENV=development tsx server/index.ts`). Backend and frontend share the same port.

### Important Rules

- Backend file changes require a workflow restart to take effect — there is no backend watch mode.
- Frontend changes (React components) are hot-reloaded by Vite automatically.
- `npm run check` (`tsc`) will fail with pre-existing errors. The build uses `tsx`/`esbuild`, not `tsc`. Do not chase a clean tsc run.
- The single source of truth for all database tables is `shared/schema.ts`.

### Knowledge Check

1. Which command starts the development server?
2. If you change a file in `server/routes.ts`, what must you do before the change takes effect in the browser?
3. What is the single source of truth for all database tables?
4. Where are all frontend page routes registered?
5. Why does a clean `npm run check` output not guarantee the application will build?

*(Answers: 1 — `npm run dev`; 2 — restart the workflow; 3 — `shared/schema.ts`; 4 — `client/src/App.tsx`; 5 — The build uses esbuild/tsx, not tsc; pre-existing tsc errors do not block the build)*

### Where to Get Help

Ask the engineering team lead. Reference `docs/engineering/ENGINEERING_RUNBOOK.md` for operational procedures.

---

## Topic 2: Schema Mutations — Adding a Table or Column (HIGH RISK)

**Purpose:** Understand the exact safe procedure for adding new database tables and columns to avoid silently dropping data in production.

**Who uses this knowledge:** All engineers making schema changes.

**Where to find it:**
- `shared/schema.ts` — the schema file to edit
- `server/index.ts` — the startup ensure-blocks to update in parallel
- `scripts/check-schema-drift.sh` — the drift guard
- `docs/engineering/ENGINEERING_RUNBOOK.md` — §Schema Management Procedure

### How to Use It

**Step 1:** Add the new table or column to `shared/schema.ts`. This is always the first step.

**Step 2:** Add a matching `CREATE TABLE IF NOT EXISTS` or `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` block to the relevant startup ensure-block in `server/index.ts`. Every ensure-block column must also be in `schema.ts`.

**Step 3:** Run `npm run db:push` in an interactive terminal (TTY). Drizzle Kit shows a terminal UI — it cannot be piped or automated.

**Step 4:** Read every prompt carefully. New tables and columns: select "Yes" to apply. "Is created or renamed" prompt: **always select "No, abort"** (see Common Mistake below).

### Important Rules

- Every column owned by a startup ensure-block must also be declared in `schema.ts`. A column in an ensure-block but NOT in `schema.ts` will be silently deleted by the next `db:push`.
- Drizzle's data-loss message is `"delete <x> column"` — NOT `"drop column"`. The drift guard script greps for this exact phrase.
- When `db:push` stalls due to unrelated constraint prompts, apply the table via a direct SQL script in `scripts/` and still register the table in `schema.ts`.
- Run `bash scripts/check-schema-drift.sh` before every production release to detect orphan columns.

### Common Mistake — The Rename Trap

Drizzle Kit sometimes cannot tell if a new table was created or if an existing table was renamed. It shows:

```
Is "new_table" a table that was created or renamed from another table?
```

**The correct answer is always "No, abort."**

If you answer "Yes" and select an existing table as the original, Drizzle will silently drop that original table and all its data. There is no confirmation step. The data is permanently gone.

When this prompt appears: abort, add the new table as a fresh declaration in `schema.ts` without any rename mapping, then re-run.

### Scenario

You need to add a `notes` text column to the `attendance` table.

1. Open `shared/schema.ts`, find the `attendance` table definition, add `notes: text("notes")`.
2. Open `server/index.ts`, find the attendance ensure-block, add: `ALTER TABLE attendance ADD COLUMN IF NOT EXISTS notes TEXT`.
3. Run `npm run db:push` in the terminal.
4. Drizzle prompts "Apply changes to attendance table?" → Select "Yes".
5. Run `bash scripts/check-schema-drift.sh` → confirm exit 0.
6. Restart the workflow.

### Practical Exercise

Before touching any production schema, practice this sequence in the development environment:
1. Add a dummy column `_test_col text` to any small table in `shared/schema.ts`.
2. Add the matching `ALTER TABLE ... ADD COLUMN IF NOT EXISTS _test_col TEXT` to the ensure-block.
3. Run `db:push` and approve the change.
4. Run the drift guard and confirm it passes.
5. Remove the dummy column from both `schema.ts` and the ensure-block, then re-run `db:push` and approve the removal.

### Knowledge Check

1. What is the first thing you must do before running `db:push` for a new column?
2. What does it mean when Drizzle asks "is created or renamed?" — and what is the correct response?
3. A column is in a startup ensure-block but NOT in `schema.ts`. What happens on the next `db:push`?
4. What command verifies that the live database has not drifted from `schema.ts`?
5. Why can't `db:push` be piped or run non-interactively?

*(Answers: 1 — Add the column to `shared/schema.ts`; 2 — Drizzle cannot tell if the table is new or renamed; always answer "No, abort"; 3 — Drizzle deletes that column and its data; 4 — `bash scripts/check-schema-drift.sh`; 5 — Drizzle Kit uses an arrow-key terminal UI that requires a TTY)*

### Where to Get Help

Consult `docs/engineering/ENGINEERING_RUNBOOK.md` §Schema Management Procedure. For any schema change touching production data, discuss with the engineering team lead before running `db:push`.

---

## Topic 3: Adding a Feature Flag

**Purpose:** Learn the three-place rule so a new feature flag is always properly registered. A flag missing any one of the three registrations is silently permanently OFF with no warning or error.

**Who uses this knowledge:** All engineers adding new optional features.

**Where to find it:**
- `ALLOWED_FLAGS` list: `server/routes.ts`
- Flag UI definitions: `client/src/pages/admin/hr/HRSettings.tsx` (`flagDefs` array)
- Default values: `server/index.ts` (`FLAG_DEFAULTS` seed block)

### How to Use It

When adding any new feature flag:

1. Add the flag key string to `ALLOWED_FLAGS` in `server/routes.ts`.
2. Add an entry to the `flagDefs` array in `client/src/pages/admin/hr/HRSettings.tsx` with a display label and description.
3. Add a default value entry to `FLAG_DEFAULTS` in `server/index.ts`.

All three must be present. Missing step 2 means HR cannot see the flag in Settings and cannot toggle it. Missing step 3 means the flag defaults to `undefined` (falsy), permanently OFF.

### Important Rules

- The flag key string must be identical in all three locations — case-sensitive.
- Existing flags: `salary_advance_enabled`, `notifications_enabled`, `onboarding_training_enabled`, `performance_management_enabled`, `document_reminder_emails`, `new_look`, `studio_v2_enabled`, `process_governance`.
- There is no validation that a flag exists in all three places. The failure is silent.

### Knowledge Check

1. Name the three files where a new feature flag must be registered.
2. What happens if you add a flag to `ALLOWED_FLAGS` and `FLAG_DEFAULTS` but forget `flagDefs`?
3. What is the consequence of omitting the `FLAG_DEFAULTS` entry for a new flag?
4. Where can an HR administrator view and toggle feature flags?
5. Are flag key strings case-sensitive?

*(Answers: 1 — `server/routes.ts`, `client/src/pages/admin/hr/HRSettings.tsx`, `server/index.ts`; 2 — The flag works server-side but HR cannot see or toggle it in settings UI; 3 — The flag is permanently OFF (undefined/falsy) with no error; 4 — `/admin/settings/feature-flags`; 5 — Yes)*

### Where to Get Help

The three-place rule is documented in `docs/engineering/ENGINEERING_RUNBOOK.md` §Feature Flags.

---

## Topic 4: Running Tests

**Purpose:** Know which test runner to use so automated tests produce correct results.

**Who uses this knowledge:** All engineers.

**Where to find it:** `docs/engineering/ENGINEERING_RUNBOOK.md` §Test Commands

### How to Use It

Run server-side tests with:

```bash
npx tsx --test
```

Do NOT use `vitest`. Vitest picks up the client-side Vite configuration and produces incorrect or empty results for backend test files.

### Important Rules

- There is currently no automated test coverage that passes. The correct command returns empty output — this is expected, not an error.
- The highest-priority test targets are `server/payrollEngine.ts` (PF, ESI, LOP computation) and `server/scheduler.ts` (leave accrual logic). See `docs/engineering/TECHNICAL_DEBT_REGISTER.md` §TD-005.
- New test files should be placed in `server/` and should import from `node:test`.

### Knowledge Check

1. What is the correct command to run server-side tests?
2. Why should you not use `vitest` for server-side tests?
3. Which two source files have the highest-priority test coverage gaps?
4. Which Node.js test module should server-side test files import?
5. Is a zero-output result from the test command a sign that the command is broken?

*(Answers: 1 — `npx tsx --test`; 2 — vitest picks up the Vite client config and gives wrong results for server files; 3 — `server/payrollEngine.ts` and `server/scheduler.ts`; 4 — `node:test`; 5 — No, it means no test files with passing cases exist yet)*

### Where to Get Help

See `docs/engineering/ENGINEERING_RUNBOOK.md` §Test Commands. For writing payroll tests, reference the business rules in `docs/workflows/BUSINESS_RULES_CATALOGUE.md` §India Statutory Payroll.

---

## Topic 5: Adding a New Route

**Purpose:** Correctly register a new route in both the public and employee router contexts to avoid the page 404-ing for some users.

**Who uses this knowledge:** All engineers adding new pages.

**Where to find it:** `client/src/App.tsx`

### How to Use It

`client/src/App.tsx` contains two router blocks — `PublicRouter` and `EmployeeRouter` — that are functionally identical for admin routes. A new admin route must be added to **both** blocks. If you add it to only one, the page will 404 for users served by the other router context.

For backend routes: add handlers in `server/routes.ts`. Use the thin-controller pattern: validation in the route handler, database queries in `server/storage.ts`.

### Important Rules

- Adding a frontend route to only one of the two router blocks causes a 404 in the other context. Always add to both.
- New admin page components go in `client/src/pages/admin/`.
- Use `lazy()` and `<Suspense>` for admin routes to avoid bloating the initial bundle.

### Knowledge Check

1. How many router blocks exist in `client/src/App.tsx`?
2. What happens if you add an admin route to only `PublicRouter` and forget `EmployeeRouter`?
3. Where should new admin page components be placed?
4. What pattern should backend route handlers follow for database queries?
5. What React utilities should new admin route components be wrapped with?

*(Answers: 1 — Two: PublicRouter and EmployeeRouter; 2 — The page 404s for users in the employee router context; 3 — `client/src/pages/admin/`; 4 — Thin controller: validation in route handler, queries in storage.ts; 5 — `lazy()` and `<Suspense>`)*

### Where to Get Help

See `docs/design/CURRENT_SCREEN_INVENTORY.md` for a complete route inventory and the legacy redirect table.

---

## Topic 6: Email Deep-Links and Portal vs. Marketing Site

**Purpose:** Ensure all portal email links send users to the correct domain (admin portal, not the marketing website).

**Who uses this knowledge:** Engineers adding email notifications.

**Where to find it:** `server/` — email notification service, `getPortalBaseUrl()` utility

### How to Use It

Always use `getPortalBaseUrl()` to construct the base URL in email deep-links. Never hardcode `hire-in.com` (the marketing site) in portal email links.

The marketing site (`hire-in.com`) and the admin portal are on different domains. Using the wrong base URL breaks all portal links delivered in email.

### Important Rules

- All transactional emails that link to the admin portal (plan notifications, check-in reminders, leave decisions) must use `getPortalBaseUrl()`.
- Protected pages that require authentication must include `?next=` so the login page can redirect after authentication.
- The `PORTAL_BASE_URL` environment variable sets the portal base URL in production.

### Knowledge Check

1. What function should you use to construct portal links in email?
2. Why should you not hardcode `hire-in.com` in portal notification emails?
3. What environment variable controls the portal base URL in production?
4. What query parameter should you include when deep-linking to a protected page?
5. Which notification file registers new notification types?

*(Answers: 1 — `getPortalBaseUrl()`; 2 — hire-in.com is the marketing site, not the admin portal — using it breaks portal links; 3 — `PORTAL_BASE_URL`; 4 — `?next=<target-path>`; 5 — `shared/notificationTypes.ts`)*

### Where to Get Help

See memory note on portal URL deep-links and `docs/engineering/ENGINEERING_RUNBOOK.md` §Environment Variables.
