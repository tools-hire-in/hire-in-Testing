# QA Automation Audit — Living Reference Document

**Last updated:** 2026-07-16  
**Audience:** Developers, QA engineers, and team leads doing risk assessment before a release.  
**Purpose:** Single source of truth for what is tested, how tests work, what data they use, and what is still missing.

---

## Section 1 — Quick Reference Card

One row per test file. Scan this in 30 seconds before a release to know the current state.

| File | Tier | Tests | Run command | Infrastructure | Status |
|------|------|-------|-------------|----------------|--------|
| `tests/payrollEngine.test.ts` | A | 12 suites / ~20 tests | `npx tsx --test tests/payrollEngine.test.ts` | None (pure) | ✅ Passing |
| `server/sopGovernance.test.ts` | A | 1 suite / 22 tests | `npx tsx --test server/sopGovernance.test.ts` | None (pure) | ✅ Passing |
| `server/probationTemplates.test.ts` | A | 1 suite / 12 tests | `npx tsx --test server/probationTemplates.test.ts` | None (pure) | ✅ Passing |
| `server/tests/studioContent.test.ts` | A | 3 suites / 8 tests | `npx tsx --test server/tests/studioContent.test.ts` | None (pure) | ✅ Passing |
| `tests/aiPrivacyGuard.test.ts` | A | 1 suite / 7 tests | `npx tsx --test tests/aiPrivacyGuard.test.ts` | None (pure) | ✅ Passing |
| `server/governance.test.ts` | A | 1 suite / 22 tests | `npx tsx --test server/governance.test.ts` | None (pure) | ✅ Passing |
| `client/src/lib/control-tower-access.test.ts` | A | 1 suite / 5 tests | `npx tsx --test client/src/lib/control-tower-access.test.ts` | None (pure) | ✅ Passing |
| `client/src/lib/people-hr-tabs.test.ts` | A | 1 suite / 8 tests | `npx tsx --test client/src/lib/people-hr-tabs.test.ts` | None (pure) | ✅ Passing |
| `client/src/lib/settings-redirect.test.ts` | A | 1 suite / 7 tests | `npx tsx --test client/src/lib/settings-redirect.test.ts` | None (pure) | ✅ Passing |
| `server/tests/salaryAdvanceAccess.test.ts` | B | 1 suite / 5 tests | `npx tsx --test server/tests/salaryAdvanceAccess.test.ts` | None (middleware mock) | ✅ Passing |
| `server/tests/governance.test.ts` | C | 3 suites / 8 tests | `npx tsx --test server/tests/governance.test.ts` | Real DB | ✅ Passing |
| `server/tests/salaryAdvanceRecovery.test.ts` | C | 1 suite / 4 tests | `npx tsx --test server/tests/salaryAdvanceRecovery.test.ts` | Real DB | ✅ Passing |
| `server/tests/governancePulse.test.ts` | D | 3 suites / 12 tests | `npx tsx --test server/tests/governancePulse.test.ts` | Real DB + HTTP (supertest) | ✅ Passing |
| `server/tests/attendancePolicy.test.ts` | D | 7 suites / ~38 tests | `npx tsx --test server/tests/attendancePolicy.test.ts` | Real DB + HTTP (supertest) | ✅ Passing |

**Tier definitions:**

| Tier | Meaning |
|------|---------|
| A | Pure unit — no I/O; runs anywhere in milliseconds |
| B | Middleware unit — tests an Express middleware function with mock req/res objects; no DB |
| C | DB integration — calls service functions directly against the real dev database |
| D | API integration — spins up an Express sub-app with supertest; hits real DB via HTTP |

---

## Section 2 — Test Runner & Infrastructure Guide

### 2.1 How to run a single file

```bash
npx tsx --test <path-to-test-file>
```

**Examples:**

```bash
# Pure unit test (no DB required)
npx tsx --test tests/payrollEngine.test.ts

# DB-backed integration test
npx tsx --test server/tests/governance.test.ts

# Full API integration test
npx tsx --test server/tests/attendancePolicy.test.ts
```

### 2.2 How to run all files

There is currently no composite runner. Run files individually or write a simple shell script:

```bash
#!/usr/bin/env bash
set -e
FILES=(
  tests/payrollEngine.test.ts
  server/sopGovernance.test.ts
  server/probationTemplates.test.ts
  server/tests/studioContent.test.ts
  tests/aiPrivacyGuard.test.ts
  server/governance.test.ts
  client/src/lib/control-tower-access.test.ts
  client/src/lib/people-hr-tabs.test.ts
  client/src/lib/settings-redirect.test.ts
  server/tests/salaryAdvanceAccess.test.ts
  server/tests/governance.test.ts
  server/tests/salaryAdvanceRecovery.test.ts
  server/tests/governancePulse.test.ts
  server/tests/attendancePolicy.test.ts
)
for f in "${FILES[@]}"; do
  echo "=== $f ==="
  npx tsx --test "$f"
done
```

See Phase 1 of the roadmap (Section 5) for a plan to make this a first-class `npm test` target.

### 2.3 node:test vs vitest

The entire backend test suite uses **Node.js built-in test runner** (`node:test`), imported as:

```ts
import { describe, it, test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
```

The client-side test files (`client/src/lib/*.test.ts`) also use `node:test`, not vitest.

**Why this matters:** Running `npx vitest` or `npx vitest run` will pick up the wrong config (the Vite config for the React app) and will not find backend or library tests correctly. Always use `npx tsx --test <file>`.

### 2.4 Dev DB dependency

Tier C and D tests connect to the **real development database** using the `DATABASE_URL` environment variable. The database must be running and healthy before executing these tests. The tests:

- Read live shift records (SHIFT_A, SHIFT_B) from the `shifts` table
- Write and clean up governance, attendance, salary-advance, and notification records
- Require specific hardcoded UUIDs to exist in `admin_users` (see 2.6 below)

**To verify the DB connection:**

```bash
npx tsx -e "import { db } from './server/db.js'; db.execute(require('drizzle-orm').sql\`SELECT 1\`).then(() => console.log('ok'))"
```

### 2.5 Shared fixtures

The only shared fixture module is:

**`server/tests/helpers/governanceSeed.ts`**

Used by: `governance.test.ts` and `governancePulse.test.ts`

Exports:
- `createGovernanceTestHierarchy()` / `teardownGovernanceTestHierarchy()` — full 5-level org chain (CEO → VP → Manager → 2 Recruiters + HR lead)
- `insertTestControl(opts)` — inserts a `governance_controls` row and returns its id
- `stampNotificationSent(controlId, step, hoursAgo)` — backdates a dedup event
- `countEvents(controlId, eventType, sinceMs)` — query helper
- `countNotifications(userId, sinceMs)` — query helper
- `getControl(controlId)` — reads `status` + `escalation_level`
- `enableNotificationsFlag()` / `restoreNotificationsFlag()` — toggles feature flag for the test run
- Exported UUID constants (`GC_CEO_ID`, `GC_VP_ID`, etc.)

All other tests use inline constants or query the DB directly. There is **no shared fixture for salary advance or attendance tests**.

### 2.6 Hardcoded UUIDs in attendance and salary-advance tests

`server/tests/attendancePolicy.test.ts` and `server/tests/salaryAdvanceRecovery.test.ts` use hardcoded UUIDs that **must exist in the dev database**:

| Constant | UUID | Used in |
|----------|------|---------|
| `MGR_ID` | `922352aa-6baa-49db-8e7d-358eb6654a3d` | Grace usage scoping |
| `MGR_TEAM[0]` | `e2c817b3-0921-4034-be9d-ec02642f125f` | Late record inserts |
| `MGR_TEAM[1]` | `a97336cb-65b9-450c-b021-769704f9e33a` | Late record inserts |
| `MGR_TEAM[2]` | `4a9dc086-da42-4e03-9785-95dfad6a5fc6` | Late record inserts |
| `LEAVE_TYPE_ID` | `aad652c5-ef0f-4cb3-834f-9c8f179ec947` | Leave request inserts |
| `PUNCH_USER_ID` | `e2c817b3-0921-4034-be9d-ec02642f125f` | Punch API tests |
| `REQUESTER_ID` (salary advance) | `e2c817b3-0921-4034-be9d-ec02642f125f` | Advance creation |
| `ACTOR_ID` (salary advance) | `922352aa-6baa-49db-8e7d-358eb6654a3d` | Audit trail |

If a test fails with "requester must have an email" or similar, it means one of these UUIDs is missing from the dev DB. These should be moved to `sharedSeed.ts` (Phase 1 roadmap item).

### 2.7 Common failure modes and remediation

| Failure | Likely cause | Remediation |
|---------|-------------|-------------|
| `AssertionError: requester must have an email` | Hardcoded UUID not in dev DB | Seed the user or use `sharedSeed.ts` |
| `ForeignKeyViolationError` during teardown | Test leaked a row referencing a test user | Add missing table to `teardownGovernanceTestHierarchy`'s cleanup loop |
| `Error: connect ECONNREFUSED` | DB not running | Start the database service |
| Suite hangs with no output | `before()` threw and `node:test` swallowed it | Add a try/catch in `before()` and log the error |
| `TypeError: Cannot read properties of undefined` in pulse tests | Baseline capture before hierarchy was seeded | Ensure `createGovernanceTestHierarchy()` runs before `request(hrApp).get(...)` |
| Tier A test fails importing from `../../shared/...` | Working directory wrong | Always run from project root: `npx tsx --test <path>` |
| `no-objection` gate test fails intermittently | Clock drift on CI — `Date.now()` crossing the SLA boundary mid-test | Pin dates relative to a fixed anchor, not `Date.now()` |

---

## Section 3 — Current Suite Catalogue

Files are listed in tier order (A → B → C → D).

---

### [Tier A] `tests/payrollEngine.test.ts`

**Type:** Pure unit  
**Run:** `npx tsx --test tests/payrollEngine.test.ts`  
**Suites / Tests:** 12 suites, ~20 tests  
**Infrastructure:** None

**What it covers:**
- `endOfContributionPeriod` — correct ESI/EPF window boundaries for all 12 calendar months
- `computeComponentsFromGross` — LOP proration, component sum integrity, residual computation
- `IndiaStatutoryEngine.compute` — EPF ceiling, EPS cap, ESI threshold, ESI round-up vs EPF nearest-rounding divergence
- `applyWaterfall` — net pay floor (cannot go below ₹0), advance recovery oldest-first, shortfall carry-forward
- Flat levy (PSDT) — not prorated by LOP days

**Test data:**
- All test data is defined inline in the file as TypeScript constants (no DB, no fixtures)
- Golden vectors (`GV1`–`GV10`) encode known input → expected output pairs; any engine change that breaks a vector is immediately visible
- `STANDARD_RULES`, `INDIA_RATES_EPF_OFF`, `PUNJAB_PSDT` are module-level constants

**How it executes:**
1. Imports pure functions from `server/payrollEngine.ts`
2. Constructs input objects inline
3. Calls the function and asserts exact paise values using `assert.equal`
4. No side effects; no setup or teardown needed

**Architect's honest note:**
Solid. The golden-vector approach makes regressions immediately obvious and the paise-integer representation means no floating-point ambiguity. **Gap:** There are no tests for the `lop_mode: "fixed"` path (flat components under LOP), the `pfExempt: true` branch, the `esiDailyWageExempt` flag, or the `PSDT.deductionMonths` conditional. Adding these would complete the engine contract.

---

### [Tier A] `server/sopGovernance.test.ts`

**Type:** Pure unit  
**Run:** `npx tsx --test server/sopGovernance.test.ts`  
**Suites / Tests:** 1 suite / 22 tests  
**Infrastructure:** None

**What it covers:**
- `canTransition` — legal forward transitions and rejection of backwards/illegal moves across the full SOP lifecycle (draft → in_review → approved → published → training_assigned → acknowledged → active → under_revision / retired)
- `addBusinessDays` / `businessDaysBetween` — SLA math with weekend skipping
- `reviewerActionToStatus` / `actionRequiresComment` — reviewer decision mapping
- `evaluateApprovalGate` — strict approval, no-objection override, blocking veto, pending-within-SLA, empty-set
- `latestRound` — multi-round review scoping (resubmission after changes_requested)
- `isSopLockEligible` — per-user compliance lock gate (enforcement mode, operational status, overdue, acked)

**Test data:**
- All inline. Reviewer assignment objects are constructed with `{ status, dueAt, decisionAt }` literals
- Date anchors use `new Date(Date.now() ± N * 86400000)` relative offsets (mild clock-sensitivity)

**How it executes:**
1. Imports pure functions from `server/sopGovernance.ts` and `server/sopRollout.ts`
2. Calls each function with a hand-crafted input and asserts on the return value
3. The critical regression test ("lock fires WITHOUT waiting for doc lifecycle 'active'") verifies a previously broken invariant

**Architect's honest note:**
One of the strongest test files in the codebase. The regression guard for the lock-before-active invariant is especially valuable. **Gap:** The approval gate tests are not exhaustive for the `approve_with_comments` path (it is tested via `reviewerActionToStatus` but not via `evaluateApprovalGate` in combination). The `measured` enforcement level is tested in `isSopLockEligible` but the `soft` enforcement auto-coaching email path has no test coverage at all.

---

### [Tier A] `server/probationTemplates.test.ts`

**Type:** Pure unit  
**Run:** `npx tsx --test server/probationTemplates.test.ts`  
**Suites / Tests:** 1 suite / 12 tests  
**Infrastructure:** None

**What it covers:**
- `parseProbationKey` — correct role/level/department resolution for 10+ job title patterns (Delivery Specialist, Senior Recruiter, Account Manager, Team Lead, Lead Recruiter, Assistant Manager - Recruitment, Content Writer, HR Executive, Sourcing Associate)
- Fallback behaviour: unknown title in a known department falls back to recruiter/associate
- `normalizeGoalCategory` — maps legacy `"production"` to `"individual"`, passes through valid enum values, defaults null/unknown to `"individual"`

**Test data:**
- All inline literal strings (job title, department, expected key)
- No fixtures or DB access

**How it executes:**
1. Imports `parseProbationKey` from `server/probationTemplates.ts` and `normalizeGoalCategory` from `server/performanceRoutes.ts`
2. Calls each function with a string pair and asserts exact field values on the returned key object

**Architect's honest note:**
Good regression guard for the most common title-to-template resolution paths, motivated by a real production bug (Delivery Specialist was mis-routing to account_manager). **Gap:** The healthcare-department universal fallback is tested, but IT department fallback is not. The template resolver itself (which looks up the template object by key) has no test — only the key parser is covered.

---

### [Tier A] `server/tests/studioContent.test.ts`

**Type:** Pure unit  
**Run:** `npx tsx --test server/tests/studioContent.test.ts`  
**Suites / Tests:** 3 suites / 8 tests  
**Infrastructure:** None

**What it covers:**
- `articleBylineRequired` — returns true for editorial types, false for social-family types, true for null/undefined/unknown (fail-safe default)
- `isValidArticleContentType` — accepts legacy article + editorial subtypes + social-family values, rejects unknown/empty
- `VALID_ARTICLE_CONTENT_TYPES` — uniqueness invariant (no duplicate entries)
- `isValidIdeaTransition` — review decisions only from `in_review`, approved ideas can enter production/scheduling, done cannot revert to idea

**Test data:**
- All inline constants and literals
- `STUDIO_CONTENT_TYPES` and `VALID_ARTICLE_CONTENT_TYPES` are imported from shared config

**How it executes:**
1. Imports functions and constants from `shared/studioContent.ts`
2. Asserts exact boolean return values and set uniqueness

**Architect's honest note:**
Covers the critical content-type contract that gates the Social Kit promote bridge. **Gap:** The full idea state machine has more transitions than tested (e.g. `suggested → in_review`, `changes_requested → in_review` re-submission). The `getPipelineContentType` function is tested indirectly via `bylineRequired` but not directly for all pipeline types.

---

### [Tier A] `tests/aiPrivacyGuard.test.ts`

**Type:** Pure unit  
**Run:** `npx tsx --test tests/aiPrivacyGuard.test.ts`  
**Suites / Tests:** 1 suite / 7 tests  
**Infrastructure:** None

**What it covers:**
- `sanitizeObjectForAI` — strips PII fields (firstName, lastName, email, phone, salary) from flat objects, nested objects, and arrays; non-PII fields pass through
- `auditPromptForPII` — detects email addresses via regex, detects prohibited field names (`firstName`, `salary`) in raw prompt text; returns empty array for clean prompts
- `sanitizeEmployee` — produces an opaque `EMP-N` reference code, preserves department and roleCategory, strips id and designation
- `buildAnonymizedControlSummary` — computes `daysOverdue` without including any PII fields in the output

**Test data:**
- All inline literal objects and strings

**How it executes:**
1. Imports functions from `server/services/aiPrivacyGuard.ts`
2. Calls each function and asserts on field presence/absence and exact values

**Architect's honest note:**
Good PII guard function coverage. **Critical gap:** These tests verify the sanitizer function in isolation — they do NOT verify that the function is actually called by the AI chat route handlers. A separate route-level test (Phase 2 roadmap: `server/tests/aiRoutePrivacy.test.ts`) is needed to close that gap. The `auditPromptForPII` regex patterns are not exhaustive (phone numbers, Aadhaar-like patterns are not tested).

---

### [Tier A] `server/governance.test.ts`

**Type:** Pure unit  
**Run:** `npx tsx --test server/governance.test.ts`  
**Suites / Tests:** 1 suite / 22 tests  
**Infrastructure:** None

**What it covers:**
- `buildAllowlistedCeoPayload` — CEO report payload contains only an approved field allowlist; `requiredAction` free-text (which may contain names) is stripped from `highPriorityItems`; the function passes `auditPromptForPII` for clean payloads
- `redactFreeTextForAI` — email addresses and phone number patterns are replaced with safe tokens
- `buildAnonymizedControlSummary` — `requiredAction` field is redacted when it contains PII (email in free text), output is truncated to 120 chars
- `DEFAULT_ESCALATION_POLICIES` — all 6 control types have policies; probation and PIP escalate at least as fast as goal; PIP and probation first-escalation recipient is `"hr"`; PIP `ceoReportThresholdLevel` is 0; all required config fields are present
- `resolveRoles` (from `shared/accessControl`) — `governance.manager` allows manager/hr/admin/super_admin; `governance.hr` excludes plain manager; `governance.ceo` is restricted to super_admin/admin/executive
- CEO report semantic corrections — `confirmedNonCompliance` excludes disputed controls and never goes negative; `exceptionCategories` labels disputed controls separately; `employeesWithExplicitBlockers` is tracked independently from `employeesWithMultipleOverdueObligations`
- Control identity conventions — `reference_id` format is type-prefixed (`goal:`, `ci:`, `sop:`, etc.)
- Event type and source completeness — all required event types and 4 source types are defined

**Test data:**
- All inline literal objects constructed in each test
- No DB, no network, no fixtures

**How it executes:**
1. Imports pure functions and constants from `server/services/aiPrivacyGuard.ts`, `server/governanceService.ts`, and `shared/accessControl.ts`
2. Constructs input objects inline, calls each function, asserts on field presence/absence, string content, and exact values
3. Some tests exercise the interaction between two functions (e.g. `buildAllowlistedCeoPayload` output passed to `auditPromptForPII`)

**Architect's honest note:**
This file fills the gap between the generic sanitizer tests in `tests/aiPrivacyGuard.test.ts` and the governance-specific trust-hardening requirements. The `buildAllowlistedCeoPayload` tests are particularly valuable — they guard the exact payload shape sent to the AI for the CEO report. **Gap:** `redactFreeTextForAI` is tested for email and phone, but not for Indian Aadhaar-pattern numbers or Replit-specific identifiers. The escalation policy tests verify structure but not the timing values (e.g. that `firstEscalationHours` for PIP is actually faster than goal by a meaningful margin). Note: this file sits at `server/governance.test.ts` (not `server/tests/`), which breaks the convention of all DB-or-HTTP tests living under `server/tests/`. Since this file is pure unit, consider moving it to `server/tests/` in a future cleanup pass.

---

### [Tier A] `client/src/lib/control-tower-access.test.ts`

**Type:** Pure unit (client-side library)  
**Run:** `npx tsx --test client/src/lib/control-tower-access.test.ts`  
**Suites / Tests:** 1 suite / 5 tests  
**Infrastructure:** None

**What it covers:**
- `allowedTowerTabs("super_admin")` — returns the full tab list
- `allowedTowerTabs("hr")` — returns only `["data-maintenance"]`
- `allowedTowerTabs` for all other roles — returns `[]`
- `canAccessControlTower` — boolean gate consistent with `allowedTowerTabs`
- `towerLegacyTabRedirect` — `"system-settings"` → `/admin/settings`, non-relocated tabs → null

**Test data:**
- Inline role strings; `SUPER_ADMIN_TOWER_TABS` imported from the module under test

**How it executes:**
1. Imports pure functions from `client/src/lib/control-tower-access.ts`
2. Asserts on exact array equality and boolean values

**Architect's honest note:**
Compact and complete for the current tab set. **Gap:** There are no tests for the `"executive"` role (read-only role added later). If new tabs are added to Control Tower, this test file must be updated or it will silently pass while the UI is wrong.

---

### [Tier A] `client/src/lib/people-hr-tabs.test.ts`

**Type:** Pure unit (client-side library)  
**Run:** `npx tsx --test client/src/lib/people-hr-tabs.test.ts`  
**Suites / Tests:** 1 suite / 8 tests  
**Infrastructure:** None

**What it covers:**
- `parsePeopleHrTab` — resolves valid tab query strings, merges `exceptions`/`risk-summary` → `escalations`, maps legacy `reports` → `salary`, returns null for missing/unknown/relocated tabs
- `relocatedGrowthTab` — identifies tabs that moved to My Growth and returns their new value
- `isTabVisibleForRole` — enforces HR-gated, admin-gated, and open tab visibility
- `externalRedirectForTab` — sends `regularizations` to `/admin/hr/my-team?tab=corrections`
- `resolvePeopleHrTab` — keeps a deep-linked tab the role can see; falls back to `users` when the role cannot see the tab
- `visibleTabDefsForRole` — returns correct tab sets per role

**Test data:**
- Inline query strings and role names

**How it executes:**
1. Imports functions from `client/src/lib/people-hr-tabs.ts`
2. Asserts on exact string return values and array membership

**Architect's honest note:**
Good regression guard for the tab routing refactor. **Gap:** The `super_admin` role is not tested for `visibleTabDefsForRole`. The test verifies `regularizations` redirects to `my-team?tab=corrections` but does not verify that the tab ALSO still 404-resolves to `users` for direct navigation (two separate code paths).

---

### [Tier A] `client/src/lib/settings-redirect.test.ts`

**Type:** Pure unit (client-side library)  
**Run:** `npx tsx --test client/src/lib/settings-redirect.test.ts`  
**Suites / Tests:** 1 suite / 7 tests  
**Infrastructure:** None

**What it covers:**
- `resolveSettingsRedirect` — retained tabs (departments, company-profile, leave-types, shifts, salary-advance-policy), legacy alias (`attendance` → `attendance-policy`), relocated tabs to Control Tower, relocated tabs to My Growth, relocated tabs to People & HR, relocated tabs to Communications, unknown tab → default path, missing tab → default path
- `relocatedSettingsTabTarget` — resolves specific relocated tabs and returns null for unaffected tabs

**Test data:**
- Inline query strings; `DEFAULT_SETTINGS_PATH` imported from the module

**How it executes:**
1. Imports functions from `client/src/lib/settings-redirect.ts`
2. Asserts on exact string return values

**Architect's honest note:**
Comprehensive for the settings nav refactor. This file should be updated whenever a settings tab is added or moved — it is the only thing preventing silent broken deep-links from bookmarks. **Gap:** The `"training"` alias is tested (maps to `feature-flags`), but the rationale for this surprising mapping is not documented in the test or the source. Future engineers will find it confusing.

---

### [Tier B] `server/tests/salaryAdvanceAccess.test.ts`

**Type:** Middleware unit  
**Run:** `npx tsx --test server/tests/salaryAdvanceAccess.test.ts`  
**Suites / Tests:** 1 suite / 5 tests  
**Infrastructure:** None (mock req/res)

**What it covers:**
- Final approval (`salaryAdvance.finalApprove`) allows `super_admin` only
- Final approval rejects `admin` — regression guard against privilege escalation via `requirePermission` auto-injection
- Final approval rejects all other elevated roles (hr, finance, manager, operations, recruiter, employee)
- Manager approval allows all declared roles (`super_admin`, `admin`, `hr`, `manager`) and rejects `employee`
- Unauthenticated request (no session userId) → 401

**Test data:**
- Inline role strings
- Mock req/res objects constructed with a `mockRes()` factory that captures `statusCode` and `body`

**How it executes:**
1. Imports `requirePermission` from `server/salaryAdvanceRoutes.ts`
2. Constructs a minimal mock Express request with a session `{ userId, role }`
3. Calls the middleware with a `next` spy
4. Asserts on whether `next` was called (pass) or `res.statusCode` was set to 403/401 (deny)

**Architect's honest note:**
The regression guard for "admin must not pass final-approval" is the most important thing in this file — it was motivated by a real RBAC gap in the access registry. **Gap:** The test exercises `requirePermission` as imported from `salaryAdvanceRoutes.ts` (a local export) rather than from `server/auth.ts` (the shared middleware). If the local export diverges from the shared one, this test could pass while the shared middleware fails. Consider importing from `server/auth.ts` directly.

---

### [Tier C] `server/tests/governance.test.ts`

**Type:** DB-backed service integration  
**Run:** `npx tsx --test server/tests/governance.test.ts`  
**Suites / Tests:** 3 suites / 8 tests  
**Infrastructure:** Real DB

**What it covers:**
- Suite 1: Escalation state machine — Day 1 overdue goal fires `employee_nudge` and advances level 0 → 1; Day 3 fires `manager_escalation` (manager notified, employee NOT re-notified); Day 6 fires `skip_escalation` (VP notified, employee and manager NOT re-notified); duplicate call within 20h is a no-op; in-flight migration (level=1 + day=1 below threshold) does not reset; closed control is always a no-op
- Suite 2: Full sweep idempotency — running `runGovernanceSyncSweep` twice within 20h does not double-fire notifications for already-escalated controls
- Suite 3: Email CTA paths — `notification_sent` events record the correct `ctaPath` per escalation type (goal tab, not check-in tab)

**Test data:**
- Created by `createGovernanceTestHierarchy()` from `server/tests/helpers/governanceSeed.ts`
- Fixed UUIDs (CEO: `cc000001-…`, VP: `cc000002-…`, Manager: `cc000003-…`, RecruiterA: `cc000004-…`, RecruiterB: `cc000005-…`, HR: `cc000006-…`)
- `beforeEach` in Suites 1 and 3 deletes all `governance_controls` and `governance_events` for test users before each test
- `after` calls `teardownGovernanceTestHierarchy()` which deletes all test data in FK-safe order

**How it executes:**
1. `before`: enables notifications flag (saving original state), seeds the hierarchy
2. For each test: inserts a specific `governance_controls` row, calls `applyEscalation(finding)` or `runGovernanceSyncSweep()`
3. Asserts on the return value (`changed`, `notificationSent`), re-reads `governance_controls` to check `status` and `escalation_level`, queries `governance_events` and `notifications` tables
4. `after`: tears down all test data, restores notifications flag

**Architect's honest note:**
The strongest Tier C test in the codebase. The deduplication test (Suite 1, Test 4) and the in-flight migration test (Test 5) cover genuinely tricky edge cases. **Gap:** Probation milestone escalation is tested at level 0, but the manager_escalation and skip_escalation steps for probation are not. The `ctaPath` assertion (Suite 3) verifies the event metadata but not that the email actually sends with that path.

---

### [Tier C] `server/tests/salaryAdvanceRecovery.test.ts`

**Type:** DB-backed service integration  
**Run:** `npx tsx --test server/tests/salaryAdvanceRecovery.test.ts`  
**Suites / Tests:** 1 suite / 4 tests  
**Infrastructure:** Real DB

**What it covers:**
- Capped recovery: when net pay covers only ₹500 of a ₹2,000 installment, `outstandingBalance` drops by ₹500 (not ₹2,000), advance stays in `repaying` state, and the ₹1,500 remainder is carried forward as a new `scheduled` installment in a later month
- Multi-month recovery: two successive capped months fully recover the outstanding balance; advance closes on the second run
- Full recovery: when net pay covers the full installment, totals update correctly
- Auto-close: when recovery exactly clears the outstanding balance, status becomes `closed` and `closedAt` is set

**Test data:**
- `REQUESTER_ID = "e2c817b3-…"` and `ACTOR_ID = "922352aa-…"` — must exist in dev DB
- `makeAdvance()` helper creates a `salary_advance_requests` row and one `salary_advance_repayments` installment in year `2099` month `6` (far future to avoid collision with real payroll runs)
- `cleanup()` deletes all `[Test]`-prefixed advance rows, audit logs, and repayment rows before and after

**How it executes:**
1. `before`: looks up the requester's email (asserts it exists), calls `cleanup()`
2. `beforeEach`: calls `cleanup()` to isolate each test (carry-forward rows from prior tests would pollute the oldest-first allocation)
3. Each test: creates an advance via `makeAdvance()`, calls `applyAdvanceRecoveriesForRun()` with a specific `advanceRecovery` value, asserts on `outstandingBalance`, `totalRepaid`, `status`, `closedAt`, and repayment row states

**Architect's honest note:**
Directly targets the most dangerous bug class in the payroll module: incorrect outstanding balance leading to double-recovery or premature close. **Gap:** Oldest-first allocation across multiple active advances is not tested — the test has only one advance per run. The overpayment path (full-next-cycle, remainder-carries-forward) is not tested here. There is no test for what happens if `advanceRecovery` exceeds `outstanding` (over-recovery prevention).

---

### [Tier D] `server/tests/governancePulse.test.ts`

**Type:** API integration (supertest)  
**Run:** `npx tsx --test server/tests/governancePulse.test.ts`  
**Suites / Tests:** 3 suites / 12 tests  
**Infrastructure:** Real DB + HTTP (supertest)

**What it covers:**
- Suite 1: `GET /api/governance/pulse` — response shape (goals, checkins, pip, probation, sop keys present), `goals.overdueCount` increases by at least 2 after seeding 2 test controls, `pip.overdue` increases by at least 1, `pip.byManager` groups correctly by manager ID, `checkins.overdueCount` reflects probation check-in overdue, unauthenticated request → 401
- Suite 2: `GET /api/governance/action-required` — returns 200 array, includes test controls, higher `escalation_level` items appear before lower ones (urgency order), employee role → 403
- Suite 3: `GET /api/governance/manager/:id/breakdown` — returns 200 with breakdown data, includes `totalControls`/`overdueCount` summary fields, reports at least 2 overdue controls for the test manager, HR role can access any manager's breakdown, employee role → 403/401

**Test data:**
- Built on `createGovernanceTestHierarchy()` from `governanceSeed.ts`
- Baseline pulse captured via an HTTP call BEFORE test controls are seeded; all count assertions use delta-from-baseline to avoid sensitivity to pre-existing DB state
- Test control IDs tracked in `testControlIds[]` and cleaned up by `cleanTestControls()`

**How it executes:**
1. Two Express sub-apps built via `buildApp(userId, role)`: `hrApp` (GC_HR_ID, "hr") and `mgrApp` (GC_MGR_ID, "manager")
2. `before`: enables notifications flag, seeds hierarchy, captures baseline, inserts test controls
3. Each test: `supertest` GET to the sub-app URL, asserts on status code, response shape, and count deltas
4. `after`: cleans test controls, tears down hierarchy, restores notifications flag

**Architect's honest note:**
The delta-from-baseline strategy is smart — it makes tests resilient to real data in the dev DB. **Gap:** The `governance-pulse` cache (noted in memory as `governance-pulse-cache.md`) is a 5-minute in-memory cache. These tests may get stale cache hits if run shortly after other governance tests. The `sop` and `probation` keys in the pulse response are not asserted on beyond shape. The urgency ordering test has a known fragility: it skips the assertion if there are fewer than 2 items (which can happen if the baseline already has controls).

---

### [Tier D] `server/tests/attendancePolicy.test.ts`

**Type:** API integration (supertest) + mixed (some Tier A/C suites in the same file)  
**Run:** `npx tsx --test server/tests/attendancePolicy.test.ts`  
**Suites / Tests:** 7 suites / ~38 tests  
**Infrastructure:** Real DB + HTTP (supertest) for Suites 6–7; real DB only for Suites 1–5

**What it covers:**
- Suite 1: `computeLateStatus` with SHIFT_A — punch before/after/at grace end, unknown shift, null `grace_period_minutes` falls back to 15-min default
- Suite 2: `computeDayCompletionStatus` with SHIFT_A — half_day / short_day / present tiers, leave/absent/holiday statuses not overridden, unknown shift → status unchanged
- Suite 3: Overnight midnight-wrap — shift 23:50 IST with 15-min grace; graceEnd = 00:05 next day; punch within grace → present, 1 min past → late; notes show `00:05` not `24:05`
- Suite 4: `isRegularisationAllowed` / `countWorkingDaysBack` — 3 working-day window, weekend counting, future date rejection
- Suite 5: `runAbsentSweep` — Saturday → skippedWeekend; public holiday → skippedHoliday; approved leave → user skipped; attendance-exempt user excluded; Monday skipGuards=true creates absent record; re-run same date is idempotent; result shape validation
- Suite 6: `queryGraceUsage` — HR sees all late records, manager sees only own direct reports, manager not in their own results, results sorted by lateCount DESC, each row has required fields, empty month returns `[]`
- Suite 7: Grace-usage HTTP — `requirePermission` correctly gates the endpoint (unauthenticated → 401, employee → 403, manager → 200 own team, HR → 200 full org)

**Test data:**
- `TEST_DATE = "2020-01-06"` (Monday), `PUNCH_TEST_DATE = "2020-02-03"` (Monday) — historic dates that will never collide with real attendance records
- Hardcoded UUIDs for MGR_ID and 3 team members (must exist in dev DB — see Section 2.6)
- `findEligibleUser()` queries for any active, non-exempt, shift-assigned user — this makes the absent-sweep test somewhat non-deterministic if the dev DB has no eligible users
- Test shift rows (`TEST_OVERNIGHT_2359`, `TEST_NULL_GRACE_SHIFT`) are created in `before` and deleted in `after`

**How it executes:**
1. Suite 1–4: import pure/semi-pure functions, call with constructed inputs, assert on results
2. Suite 5: calls `runAbsentSweep()` directly against the real DB; inserts and cleans attendance, holiday, and leave_request rows
3. Suite 6: inserts late attendance records for 3 specific UUIDs, calls `queryGraceUsage()`, asserts on results
4. Suite 7: builds a minimal Express app with `requirePermission`, uses supertest to test the auth gate

**Architect's honest note:**
The most comprehensive test file in the repo — covers 7 different concerns across multiple tiers in a single file. The overnight midnight-wrap tests are critical (they caught a real clock-wrap bug). **Gaps:** Half-day leave (LWP) counting in the absent sweep is not tested; shiftless employee exclusion from the sweep is referenced in comments but has no test. The Tier D HTTP tests only cover the grace-usage endpoint — the punch, regularisation, and team-attendance endpoints have no API-level tests.

---

## Section 4 — Coverage Heat Map

**Key:** ✅ Strong | 🟡 Good | 🟠 Partial | ❌ None

| Domain | Coverage | Notes |
|--------|----------|-------|
| Payroll engine (computation) | ✅ Strong | 10 golden vectors; ESI/EPF/PSDT/LOP all covered |
| Governance escalation state machine | ✅ Strong | All ladder steps, dedup, in-flight, closed controls |
| Governance API (pulse, action-required, breakdown) | 🟡 Good | Delta-baseline strategy; cache sensitivity gap |
| Attendance policy (late/completion/regularisation) | 🟡 Good | Core paths covered; half-day leave, shiftless exclusion gaps |
| Absent sweep | 🟡 Good | Core cases covered; half-day leave + pending leave gaps |
| SOP lifecycle | ✅ Strong | All transition, SLA, gate, round, lock tests present |
| Salary advance recovery | 🟡 Good | Capped recovery, multi-month, close; missing multi-advance, overpayment |
| Salary advance access control | 🟡 Good | Final-approve RBAC covered; local export vs shared middleware gap |
| Studio content type contract | 🟡 Good | Byline, type validity, idea state machine; not all transitions covered |
| AI Privacy (guard function) | 🟡 Good | Sanitizer covered; route-level enforcement not tested |
| Navigation RBAC (Control Tower) | 🟡 Good | super_admin + hr; executive role missing |
| Navigation routing (People & HR tabs) | 🟡 Good | All aliases and fallbacks; super_admin role not tested |
| Navigation routing (Settings redirects) | ✅ Strong | All retained, relocated, and aliased tabs covered |
| Probation templates | 🟡 Good | Key parsing, normalizeGoalCategory; template resolver not tested |
| Leave accrual engine | ❌ None | Monthly accrual, LWP gating, year-end carry-forward — zero tests |
| Salary slip PDF | ❌ None | Component sum, LOP deduction display, net floor — zero tests |
| Offer letter flow | ❌ None | Acceptance hash, counter-sign, /verify — zero tests |
| HR letter generation | ❌ None | Template rendering, reference number, auth code — zero tests |
| Leave approval | ❌ None | Balance deduction, weekend exclusion, idempotency — zero tests |
| Break tracking | ❌ None | Start/end breaks, policy enforcement — zero tests |
| Notification gateway | ❌ None | pref-gated delivery, digest logic — zero tests |
| Authentication | ❌ None | Replit Auth OIDC, email/password, session — zero tests |
| Ceipal ATS sync | ❌ None | JWT, job sync, push — zero tests |
| Object storage | ❌ None | Upload, presigned URL, auth gate — zero tests |
| Training acknowledgement | ❌ None | SOP wave enforcement, lock trigger — zero tests |
| Performance management API | ❌ None | Goals CRUD, check-ins, reviews — zero tests |
| Frontend rendering | ❌ None | No component tests, no Playwright — zero tests |

**Summary:** 13 domains have some coverage; 14+ domains have none. The uncovered domains include several P0 risk areas (leave accrual, offer letter, salary slip) that interact with financial and legal data.

> **Note:** The repo contains 14 test files in total. The heat map above reflects coverage across all 14 files.

---

## Section 5 — P0/P1 Coverage Roadmap

---

### Phase 1 — Hardening (2–3 days)

These items are infrastructure work that makes all subsequent phases faster and more reliable.

#### P1.1 — Shared portable fixture (`server/tests/helpers/sharedSeed.ts`)

**File to create:** `server/tests/helpers/sharedSeed.ts`  
**Pattern:** Extend `governanceSeed.ts` pattern with a general-purpose seed for salary advance and attendance tests  
**Effort:** ~4 hours

**What to build:**
- Two seeded admin users (`SEED_USER_A_ID`, `SEED_USER_B_ID`) with known emails and a manager relationship
- A seeded leave type (`SEED_LEAVE_TYPE_ID`)
- A seeded shift assigned to both users
- `createSharedTestUsers()` / `teardownSharedTestUsers()` exported functions
- All UUIDs deterministic (e.g., `dd000001-0000-0000-0000-000000000000`)

**Why it is P0:** Currently `salaryAdvanceRecovery.test.ts` and `attendancePolicy.test.ts` depend on hardcoded UUIDs that must exist in the dev DB. In a fresh environment (CI, new developer), these tests fail before they even run. The fixture makes the test suite self-contained.

#### P1.2 — Composite test runner (`scripts/run-tests.sh` + `npm test`)

**File to create:** `scripts/run-tests.sh`  
**Pattern:** Shell script iterating over the 14 test files listed in Section 1  
**Effort:** ~1 hour

**What to build:**
- Run Tier A tests first (no DB required; fastest feedback)
- Run Tier B next
- Run Tier C and D only if DB is available (detect via `DATABASE_URL`)
- Exit non-zero on any failure
- Register as the `full-test-suite` validation

**Why it is P0:** Without a single entry point, tests are skipped before releases. Engineers do not know which files to run.

#### P1.3 — Register missing validations

**Files to update:** `.local/skills/validation/SKILL.md` (or validation registry)  
**Effort:** ~30 minutes

Register the following as named validations:
- `attendance-policy-tests` → `npx tsx --test server/tests/attendancePolicy.test.ts`
- `payroll-engine-tests` → `npx tsx --test tests/payrollEngine.test.ts`
- `salary-advance-tests` → `npx tsx --test server/tests/salaryAdvanceRecovery.test.ts server/tests/salaryAdvanceAccess.test.ts`

---

### Phase 2 — P0 Guards (1–2 weeks)

Each item is a new test file targeting a domain with zero current coverage and high financial/legal risk.

#### P2.1 — Leave accrual engine

**File to create:** `server/tests/leaveAccrual.test.ts`  
**Tier:** C (DB-backed service integration)  
**Pattern:** Follow `salaryAdvanceRecovery.test.ts` — create seeded users, call the accrual function, assert on `leave_balances` table  
**Effort:** 2–3 days

**Scenarios to cover:**
- Monthly accrual: EL accrues 1.25 days/month (15/year), SL accrues 0.67 days/month (8/year)
- LWP gating: if LWP days > threshold for the month, accrual is skipped or reduced
- Bonus month accrual: Jan and Jul emit the EL bonus increment
- Year-end carry-forward: EL balance above the carry cap lapses; amount below cap rolls over
- Year-end lapse: the lapsed amount is recorded in the audit trail
- Idempotency: running accrual twice for the same month does not double-accrue

**Why P0:** Leave accrual errors directly affect employee pay (LWP) and statutory leave entitlements. A bug here may not be visible until year-end, at which point correction requires manual audit.

#### P2.2 — Salary slip component integrity

**File to create:** `server/tests/salarySlip.test.ts`  
**Tier:** C (DB-backed service integration)  
**Pattern:** Follow `payrollEngine.test.ts` golden-vector style, but call the slip-generation service with a seeded payroll run  
**Effort:** 2–3 days

**Scenarios to cover:**
- Component sum = gross (all components add up to the declared gross salary)
- LOP deduction: net pay for a half-month employee is ≤ 50% of full-month net (not exactly 50% due to flat deductions)
- Net pay floor: a month with advance recovery exceeding net does not produce a negative slip
- Snapshot replay: rendering a slip twice produces the same numbers (idempotent)
- Missing salary structure: slip generation for an employee with no `salary_structure_id` fails gracefully (no 500)

**Why P0:** Incorrect salary slips are a compliance and employee-trust issue. PDF rendering errors can block payroll for an entire cycle.

#### P2.3 — Salary advance recovery: oldest-first allocation and no over-recovery

**File to extend:** `server/tests/salaryAdvanceRecovery.test.ts`  
**Effort:** 1 day

**Scenarios to add:**
- Two active advances: recovery is applied to the older advance first (oldest-first allocation)
- Over-recovery prevention: if `advanceRecovery` row value exceeds `outstanding`, the excess is not deducted
- Overpayment path: overpayment records recover the full balance next cycle; remainder carries forward

**Why P0:** Multi-advance employees are common. Incorrect allocation order can close the wrong advance prematurely.

#### P2.4 — AI route privacy gate

**File to create:** `server/tests/aiRoutePrivacy.test.ts`  
**Tier:** D (API integration, supertest)  
**Pattern:** Follow `governancePulse.test.ts` — build a mini Express app with the AI route, send a request with employee data, verify the response does not echo PII  
**Effort:** 1–2 days

**Scenarios to cover:**
- Prompt sent to the AI route contains no raw `firstName`, `email`, or `salary` values
- The `auditPromptForPII` function is called and its findings are logged (verified via a test-injected logger)
- A request that somehow bypasses the guard returns a 500 (fail-closed, not fail-open)
- Unauthenticated request → 401 before any AI call is made

**Why P0:** A PII leak to an external AI provider is a data-privacy incident. The guard function tests (Phase A) only prove the function works; they do not prove the function is called.

#### P2.5 — Access control: requirePermission on high-risk endpoint groups

**File to create:** `server/tests/accessControl.test.ts`  
**Tier:** D (API integration, supertest)  
**Pattern:** Follow `salaryAdvanceAccess.test.ts` middleware-unit pattern but at HTTP level  
**Effort:** 2–3 days

**Endpoint groups to cover:**
1. Salary run finalization (super_admin only)
2. User deletion / soft-delete (super_admin only)
3. Leave balance manual adjustment (hr, super_admin, admin)
4. Offer letter countersign (hr, super_admin, admin)
5. Governance control override (hr, super_admin)

**Scenarios per group:**
- Allowed role → 200 or redirect to handler
- Disallowed role → 403
- Unauthenticated → 401

**Why P0:** These are the 5 endpoint groups where a permission bypass would have immediate financial, legal, or data-integrity consequences.

---

### Phase 3 — P1 Guards (2–3 weeks)

#### P3.1 — Extend absent sweep tests

**File to extend:** `server/tests/attendancePolicy.test.ts`  
**Effort:** 1 day

**Scenarios to add:**
- Half-day approved leave: employee with a half-day leave on `TEST_DATE` gets a `half_day` attendance record, not an `absent` record
- Pending leave (not approved): employee with a pending leave request still gets an `absent` record (only approved leave exempts)
- Shiftless employee: employee with `shift_id = NULL` is skipped by the sweep

#### P3.2 — SOP compliance lock boundary

**File to create:** `server/tests/sopLock.test.ts`  
**Tier:** C (DB-backed)  
**Pattern:** Follow `governance.test.ts` — seed SOP records, call the lock-check service, assert on per-user lock state  
**Effort:** 2–3 days

**Scenarios to cover:**
- User who has acknowledged the current version is never locked, even if the SOP is in `operational` and `overdue` state
- User who has NOT acknowledged the current version IS locked when `enforcement = "full"`, `operational = true`, `overdue = true`
- User is locked for their specific SOP, not for all SOPs (per-SOP boundary)
- Non-pilot user (not in the wave rollout) is never locked regardless of enforcement mode

#### P3.3 — Governance escalation: recipient correctness anti-regression

**File to extend:** `server/tests/governance.test.ts`  
**Effort:** 1–2 days

**Scenarios to add:**
- `manager_escalation`: manager is notified, employee is NOT re-notified (already covered), but also verify the notification body contains the manager's `ctaPath` (not the employee's)
- `skip_escalation`: VP notified (already covered), verify the HR lead is also notified when `hrLeadId` is in the finding
- Probation milestone at level 1 → manager_escalation → manager notified (currently only level 0 is tested)

#### P3.4 — Offer letter acceptance and /verify

**File to create:** `server/tests/offerLetterAcceptance.test.ts`  
**Tier:** D (API integration, supertest)  
**Pattern:** Follow `governancePulse.test.ts` — build an Express sub-app, seed an offer letter, drive it through the acceptance flow  
**Effort:** 3–4 days

**Scenarios to cover:**
- Candidate acceptance: `POST /api/offer-letters/:id/accept` sets status, stores document hash
- HR counter-sign: `POST /api/offer-letters/:id/countersign` requires hr/admin role
- `/verify` page: `GET /verify?ref=...&code=...` returns the document data for a valid reference+auth code pair
- `/verify` rejects tampered documents (hash mismatch)
- Unauthenticated candidate acceptance → 401

#### P3.5 — Leave approval: balance deduction and weekend exclusion

**File to create:** `server/tests/leaveApproval.test.ts`  
**Tier:** C (DB-backed)  
**Pattern:** Follow `salaryAdvanceRecovery.test.ts` — seed user + leave balance, call approval function, assert on balance table  
**Effort:** 2–3 days

**Scenarios to cover:**
- Approving a 3-day leave request (Mon–Wed) deducts 3 days from the balance
- A 5-day leave request spanning Sat–Sun deducts only 3 working days (weekend exclusion)
- Approving the same request twice is idempotent (balance not double-deducted)
- Rejecting an approved leave restores the deducted balance
- Approval fails when the balance is insufficient

---

### Phase 4 — Playwright E2E (1 week setup)

#### P4.1 — Setup

**Directory:** `tests/e2e/`  
**Install:** `npm install -D @playwright/test` + `npx playwright install chromium`  
**Config:** `playwright.config.ts` at project root; `baseURL` from `VITE_DEV_SERVER_URL` or `PORT`  
**Seeded test user:** A dedicated `e2e-test@hire-in.com` user with `super_admin` role, password seeded via `scripts/seed-e2e-user.ts`, TOTP disabled for CI via a feature flag  

#### P4.2 — Suite structure

```
tests/e2e/
  auth.spec.ts              # login, session timeout warning, logout
  attendance.spec.ts        # punch in, punch out, break start/end
  leave.spec.ts             # apply leave, manager approval, balance update
  payslip.spec.ts           # generate payslip, verify component display
  offer-letter.spec.ts      # generate, approve, candidate accept, /verify
  access-smoke.spec.ts      # employee cannot reach /admin/hr/people, etc.
```

#### P4.3 — Scope per spec

| Spec | Scenarios | Why |
|------|-----------|-----|
| `auth.spec.ts` | Login success, wrong password → error, session timeout warning at 25min | Auth is gated by TOTP in prod; E2E is the only way to test the full flow |
| `attendance.spec.ts` | Punch in shows timer, punch out records hours, break widget updates status | The Punch In/Out button has historically broken silently (missing `today` variable bug) |
| `leave.spec.ts` | Apply → pending, manager approve → balance deducts, employee sees approved | Multi-role flow impossible to test at unit level |
| `payslip.spec.ts` | Generate slip shows correct gross, LOP section appears when LOP > 0 | PDF generation is the hardest layer to unit-test |
| `offer-letter.spec.ts` | Generate → approve → candidate acceptance page → /verify returns correct data | The acceptance hash chain is only meaningful end-to-end |
| `access-smoke.spec.ts` | Employee navigates to /admin/hr/people → redirected; manager cannot reach /admin/control-tower | RBAC regressions are silent without browser-level smoke |

#### P4.4 — Estimated effort

- Environment setup and config: 1 day  
- `auth.spec.ts` + `access-smoke.spec.ts`: 1 day  
- `attendance.spec.ts` + `leave.spec.ts`: 1–2 days  
- `payslip.spec.ts` + `offer-letter.spec.ts`: 2 days  
- CI integration (GitHub Actions or Replit workflow): 1 day  

**Total:** ~6–7 days for a functional E2E suite covering the highest-risk user journeys.
