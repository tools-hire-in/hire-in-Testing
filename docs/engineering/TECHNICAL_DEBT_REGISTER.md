Status: Current-state practitioner reference
Generated from: docs/ai-governance-audit/GOVERNANCE-MVP-READINESS.md (NEEDS_EXTENSION and READY_WITH_MINOR_GAP items), all Phase 1 UNABLE_TO_CONFIRM items, and issues identified during Phase 2 work
Date: 2026-07-13
Human approval required: Yes — for all items marked "Requires owner decision"
Unresolved items: See individual entries

---

# Technical Debt Register

Every entry in this register links to a confirmed source. No speculative items are included.

**Severity key:**
- P0: Data loss risk, security risk, or blocks daily operations
- P1: Financial accuracy or legal defensibility risk
- P2: Operational risk or degraded user experience
- P3: Developer experience, observability, or non-urgent cleanup

**Decision key:**
- Fix: Should be resolved; has a clear resolution path
- Accept: Known limitation; accepted as current trade-off
- Monitor: Watch for impact; no action needed now
- Retire: Feature or behavior should be decommissioned

---

## TD-001: Audit Log Missing Old-Value Capture

**Issue:** The `check_in_updated` and `employee_plan_updated` audit events record new values only. Pre-update values are not captured. If a manager edits a check-in rating from 3 to 5, the sequence `3 → 5` cannot be reconstructed from the audit log.

**Affected feature:** Employee Plans (Probation / PIP / Growth), Performance Check-ins

**Impact if unaddressed:** Probation and PIP records are not forensically defensible against claims of post-hoc editing. Cannot prove whether values were changed after initial submission.

**Current workaround:** Cross-reference `check_in_updated` entries with the final stored value to detect anomalies. This is a manual query, not a reliable guard.

**Severity:** P1

**Proposed resolution:** In every `createAuditLog` call site in `server/performanceRoutes.ts`, load the pre-update row before the update and include `{ before: oldRow, after: newRow }` in the `changes` JSONB. The `createAuditLog` infrastructure is already in place. `CONFIRMED_IN_EXISTING_GUIDE`

**Owner role:** Engineering

**Status:** Scheduled (flagged as "must deliver in MVP" in `docs/ai-governance-audit/GOVERNANCE-MVP-READINESS.md` Section 4)

**Related code reference:** `server/performanceRoutes.ts` — all `createAuditLog` call sites

**Decision:** Fix

**Source:** `docs/ai-governance-audit/GOVERNANCE-MVP-READINESS.md` §4 — `NEEDS_EXTENSION`

---

## TD-002: SOP Acknowledgement Version History Not Retained

**Issue:** `sop_employee_progress` stores one row per (sopMasterId, userId). When a SOP is revised and re-published, `sopVersion` is updated in-place. A prior version's acknowledgement (e.g., v1) is overwritten when the employee acknowledges the revised version (v3). There is no record that v1 was separately acknowledged.

**Affected feature:** SOP Compliance, SOP Wave Rollout

**Impact if unaddressed:** Cannot prove "the employee acknowledged exactly v1 content before v3 was published" if this becomes a regulatory requirement.

**Current workaround:** The current single-row model is workable for compliance purposes — the employee must re-acknowledge every published revision. The hash stored at acknowledgement time identifies which content version was signed.

**Severity:** P2

**Proposed resolution:** Add a `sop_acknowledgement_history` append table that records each version's acknowledgement separately without overwriting the prior row.

**Owner role:** Engineering

**Status:** Known and accepted (post-MVP per `docs/ai-governance-audit/GOVERNANCE-MVP-READINESS.md` §2)

**Related code reference:** `server/storage.ts` — `setSopAcknowledged`, `sop_employee_progress` table

**Decision:** Monitor — accept for now, implement if regulatory requirement emerges

**Source:** `docs/ai-governance-audit/GOVERNANCE-MVP-READINESS.md` §2 — `READY_WITH_MINOR_GAP`

---

## TD-003: No Closed-Loop Action Record for Governance Check-ins

**Issue:** There is no first-class record that links "this check-in became due", "a notification was sent", and "the action was completed by user X at time T". Closed-loop traceability must be constructed at query time by joining `check_ins.notified_at` with `check_ins.completedAt`. The data exists, but not as a purpose-built ledger.

**Affected feature:** Employee Plans, Performance Check-ins, Governance Controls

**Impact if unaddressed:** Governance reporting requires complex multi-table joins to answer "was this check-in completed after being reminded?" Increases query complexity and risk of reporting errors.

**Current workaround:** Derive action status by joining `check_ins.notified_at` (notification sent) with `check_ins.completedAt` (action done). Both columns exist. `CONFIRMED_IN_CODE`

**Severity:** P2

**Proposed resolution:** Introduce a `governance_actions` table with an explicit open/close lifecycle per required action.

**Owner role:** Engineering

**Status:** Known and accepted (recommended for MVP in `docs/ai-governance-audit/GOVERNANCE-MVP-READINESS.md` §3)

**Related code reference:** `shared/schema.ts` — `check_ins` table; `server/performanceRoutes.ts`

**Decision:** Fix — prioritize when governance reporting becomes a requirement

**Source:** `docs/ai-governance-audit/GOVERNANCE-MVP-READINESS.md` §3 — `READY_WITH_MINOR_GAP`

---

## TD-004: manager_id Has No Database-Level FK Constraint on admin_users

**Issue:** `admin_users.manager_id` is declared as `varchar("manager_id")` with no PostgreSQL foreign key constraint. If a manager's account is deleted (soft-deleted), their former direct reports retain a stale `manager_id` pointing to a now-inaccessible record. The database will not detect or prevent this.

**Affected feature:** My Team, Employee Plans, Leave Approvals, Attendance

**Impact if unaddressed:** Corrupt or stale `manager_id` values cause team filters (`WHERE manager_id = $1`) to silently exclude affected employees. Those employees fall out of all team-scoped views.

**Current workaround:** Application-layer enforcement via `storage.getTeamMembers(managerId)`. Governance tables (`employee_plans`, `check_ins`, `performance_goals`) carry properly constrained FKs. `CONFIRMED_IN_CODE`

**Severity:** P2

**Proposed resolution:** Add a database-level FK constraint with `ON DELETE SET NULL` on `admin_users.manager_id`. Requires a schema migration; must be applied via direct SQL (not `db:push` which may stall).

**Owner role:** Engineering

**Status:** Known and accepted (READY classification in governance audit — operational risk, not blocking)

**Related code reference:** `shared/schema.ts` — `adminUsers` table definition

**Decision:** Fix — schedule for next schema maintenance window

**Source:** `docs/ai-governance-audit/GOVERNANCE-MVP-READINESS.md` §1; `docs/platform/PRODUCT_CAPABILITY_MAP.md` — HR and People Management limitations

---

## TD-005: No Automated Test Coverage

**Issue:** Zero automated tests confirmed passing across the full decision point map. All 59 decision points reviewed in Phase 1 are covered by manual testing, governance documents, or not at all. The test runner (`npx tsx --test`) is confirmed but no test files with passing cases are confirmed.

**Affected feature:** Entire platform

**Impact if unaddressed:** Regressions in financial computation (PF, ESI, LOP), leave rules, authorization gates, and state machine transitions go undetected until manually discovered.

**Current workaround:** Code review, governance audit, and manual QA on every change.

**Severity:** P1

**Proposed resolution:** Begin with pure-function unit tests on `server/payrollEngine.ts` (ESI rounding UP, PF cap, net pay floor at ₹0) and `server/scheduler.ts` (leave accrual 128h threshold, SL 30-day eligibility). These carry the highest financial risk. See `docs/qa/DECISION_COVERAGE_MAP.md` — Recommended Automated Test Targets.

**Owner role:** Engineering

**Status:** Under investigation (no schedule confirmed)

**Related code reference:** `server/payrollEngine.ts`, `server/scheduler.ts`, `server/salaryEngine.ts`

**Decision:** Fix — priority P1 for payroll and leave computation; remaining decisions P2

**Source:** `docs/qa/DECISION_COVERAGE_MAP.md` — Summary table; zero AUTOMATED_TEST entries confirmed

---

## TD-006: attendance_report_runs Has No (month, year) Unique Constraint

**Issue:** Multiple rows in `salary_report_runs` (attendance report runs) can have `is_active = true` for the same month and year. All reads against this table must explicitly filter `is_active = true` or they may return stale/superseded data.

**Affected feature:** Attendance Report, Payroll Run (depends on attendance report)

**Impact if unaddressed:** Reads without the `is_active` filter return duplicate or superseded rows, producing incorrect attendance summaries and potentially incorrect payroll gating.

**Current workaround:** All confirmed active read paths filter `is_active = true`. Additive auto-sync on open runs is designed to work with the multi-row model. `CONFIRMED_IN_CODE`

**Severity:** P1

**Proposed resolution:** Either add a partial unique index (`UNIQUE (month, year) WHERE is_active = true`) or audit all read paths to enforce the filter. Adding the unique index requires a migration via direct SQL.

**Owner role:** Engineering

**Status:** Known and accepted — monitor for unfiltered reads

**Related code reference:** `shared/schema.ts` — `salary_report_runs` table; `server/routes.ts` — attendance report endpoints

**Decision:** Monitor — add unique index in next maintenance window

**Source:** Memory note `attendance-report-versioning.md`; `docs/platform/PRODUCT_CAPABILITY_MAP.md` — Attendance Report limitations

---

## TD-007: Bank Account Details Not Encrypted at Application Layer

**Issue:** Employee bank account details are stored in the `employee_bank_details` table with no confirmed application-layer encryption. Database-level column encryption cannot be confirmed from application code alone.

**Affected feature:** Post-Onboarding Documents, Payroll (bank details used for disbursement)

**Impact if unaddressed:** Bank account details (account number, IFSC code) are stored as plaintext in the database. A database breach exposes all bank details in cleartext.

**Current workaround:** None confirmed at application layer. Database access is restricted to the application connection pool; direct DB access requires credentials.

**Severity:** P1

**Proposed resolution:** Add application-layer encryption (AES-256) for `account_number` and `ifsc_code` fields in `employee_bank_details` before storage. Decryption key must be stored in environment variables (Replit Secrets), not in the codebase.

**Owner role:** Engineering / Security

**Status:** Requires owner decision

**Related code reference:** `shared/schema.ts` — `employee_bank_details` table

**Decision:** Requires owner decision — Fix or Accept with compensating controls

**Source:** `docs/architecture/AUTH_RBAC_SECURITY.md` §PII Field Handling — `UNABLE_TO_CONFIRM — OWNER REVIEW REQUIRED`

---

## TD-008: Executive Cockpit Route Uses Client-Side Guard Only

**Issue:** The `/admin/executive-cockpit` route uses a `RequireRoles` React component (client-side only) to restrict access to `executive` and `super_admin` roles. Backend data endpoints for the executive cockpit additionally enforce `requirePermission`, but a complete audit of whether every data endpoint called from executive-only pages enforces the role server-side has not been completed.

**Affected feature:** Executive Cockpit, Payroll Executive Dashboard

**Impact if unaddressed:** A non-executive user who bypasses the client-side route guard (e.g., by directly calling an API endpoint) may access executive-level data if any backend endpoint lacks the role check.

**Current workaround:** The `requirePermission` middleware is applied to confirmed executive-specific data endpoints. Client-side guard prevents accidental UI navigation.

**Severity:** P1

**Proposed resolution:** Complete a backend route audit for all endpoints called from `/admin/executive-cockpit` and `/admin/payroll/executive`. Confirm each has `requirePermission` with appropriate roles.

**Owner role:** Engineering / Security

**Status:** Under investigation — audit not completed

**Related code reference:** `client/src/App.tsx` — `RequireRoles` component; `server/routes.ts` — executive-scoped endpoints

**Decision:** Fix — complete backend audit and add missing guards

**Source:** `docs/architecture/AUTH_RBAC_SECURITY.md` §Permission Enforcement — `UNABLE_TO_CONFIRM — OWNER REVIEW REQUIRED`; `docs/qa/DECISION_COVERAGE_MAP.md` — Authorization

---

## TD-009: AI Chat Endpoint Has No PII Warning

**Issue:** The conversational AI chat endpoint (`server/replit_integrations/chat/routes.ts`) passes user-provided message history to an external AI provider with no system prompt warning users not to paste restricted employee data (salary slips, medical information, personal details).

**Affected feature:** BD Agent, Conversational AI Chat

**Impact if unaddressed:** A user could inadvertently paste an employee's personal or compensation data into the chat, which would be transmitted to the external AI provider. No guardrail prevents this.

**Current workaround:** No automated HR database tables are injected into AI prompts. The risk is user-initiated, not system-initiated. `CONFIRMED_IN_CODE`

**Severity:** P2

**Proposed resolution:** Add a one-line system prompt to the conversational chat endpoint reminding users not to paste restricted employee data.

**Owner role:** Engineering

**Status:** Known and accepted for now (low priority per `docs/ai-governance-audit/GOVERNANCE-MVP-READINESS.md` §5)

**Related code reference:** `server/replit_integrations/chat/routes.ts`

**Decision:** Fix — low effort, add in next maintenance pass

**Source:** `docs/ai-governance-audit/GOVERNANCE-MVP-READINESS.md` §5 — `READY_WITH_MINOR_GAP`

---

## TD-010: Release Notes AI Receives Raw Commit Messages (May Include Employee Names)

**Issue:** The release notes AI generation feature passes raw git commit messages to the AI provider. Commit messages may contain employee names embedded in the commit text (e.g., "Fix bug reported by [Name]").

**Affected feature:** Content Studio — Release Notes

**Impact if unaddressed:** Low probability and low sensitivity. Employee names in release notes output are not a significant privacy violation, but it is a non-zero risk of exposing internal contributor names via the AI output.

**Current workaround:** The release notes system prompt instructs the AI not to include personal names in output, but this relies on model compliance rather than data scrubbing.

**Severity:** P3

**Proposed resolution:** Add a pre-processing step to strip email addresses and `Name <email>` patterns from commit messages before passing to the AI.

**Owner role:** Engineering

**Status:** Known and accepted for now (low priority per governance audit)

**Related code reference:** `server/services/aiDraftService.ts` — release notes generation

**Decision:** Monitor — fix opportunistically

**Source:** `docs/ai-governance-audit/GOVERNANCE-MVP-READINESS.md` §5 — `READY_WITH_MINOR_GAP`

---

## TD-011: Social Card Generation Requires Runtime Chromium

**Issue:** Social card PNG generation uses Puppeteer Core with `networkidle0` for Chromium rendering. Chromium availability at runtime in the Replit production environment is not confirmed from code alone.

**Affected feature:** Content Studio — Social Cards (auto-generated on article approval)

**Impact if unaddressed:** Social card generation silently fails if Chromium is not available at runtime. Article approval succeeds; only the social card step fails.

**Current workaround:** `UNABLE_TO_CONFIRM — OWNER REVIEW REQUIRED` — whether Chromium is provisioned in the production environment cannot be confirmed without a runtime test.

**Severity:** P2

**Proposed resolution:** Run a smoke test on the production environment to confirm Chromium availability. If unavailable, provision it or add a graceful fallback that logs the failure and continues without the social card.

**Owner role:** Engineering / DevOps

**Status:** Requires owner decision

**Related code reference:** `server/` — social card generation service (Puppeteer Core)

**Decision:** Requires owner decision — confirm or provision Chromium

**Source:** `docs/qa/DECISION_COVERAGE_MAP.md` — AI and Content Studio — `UNABLE_TO_CONFIRM`

---

## TD-012: No Schema Mutation Developer Guide

**Issue:** There is no developer-facing step-by-step guide for safely adding a new database table or column. The policy is described in `replit.md` but not as a guide with the specific Drizzle terminal prompts and correct responses. Incorrect `db:push` interactions are the most documented source of production data-loss incidents in the project's history.

**Affected feature:** Developer onboarding, all future schema changes

**Impact if unaddressed:** New developers make incorrect decisions at the `db:push` interactive terminal, causing data loss in production or development. The "created or renamed" prompt is the highest-risk decision point.

**Current workaround:** Institutional knowledge in `replit.md` and memory notes. Not accessible to new contributors.

**Severity:** P1

**Proposed resolution:** Create `docs/engineering/SCHEMA_MUTATION_GUIDE.md` with step-by-step instructions, exact prompt text, and correct responses. Covers: add column, add table, avoid rename trap, use direct SQL for payroll-type tables.

**Owner role:** Engineering

**Status:** Scheduled (Priority 1 in `docs/training/TRAINING_GAP_MAP.md`)

**Related code reference:** `scripts/check-schema-drift.sh`, `server/index.ts` ensure-blocks, `shared/schema.ts`

**Decision:** Fix — create the guide

**Source:** `docs/training/TRAINING_GAP_MAP.md` §Developer gaps — Priority 1

---

## TD-013: employee_plans.employee_id Is Nullable Without Explicit Documentation

**Issue:** `employee_plans.employee_id` is NULL for plans seeded at offer acceptance (before the candidate is formally onboarded). Adding a NOT NULL constraint or publishing a SET NOT NULL migration would fail on any plan row created before onboarding. This is expected behavior, but no in-code comment or schema-level note explains it.

**Affected feature:** Employee Plans, New Hire onboarding

**Impact if unaddressed:** A developer adding a NOT NULL constraint would cause a production migration failure if any pre-onboarding plan rows exist.

**Current workaround:** The nullable behavior is documented in memory notes. The correct approach is to never declare `.notNull()` on this column. `CONFIRMED_IN_EXISTING_GUIDE`

**Severity:** P2

**Proposed resolution:** Add a SQL comment or Drizzle column comment to `employee_plans.employee_id` in `shared/schema.ts` documenting the nullable intent and the reason.

**Owner role:** Engineering

**Status:** Known and accepted

**Related code reference:** `shared/schema.ts` — `employee_plans` table, `employee_id` column

**Decision:** Fix — add in-schema comment on next schema touch

**Source:** Memory note `employee-plans-nullable-employee-id.md`

---

## TD-014: ESI Rounding Mode Ambiguity Between Engine Paths

**Issue:** The India statutory payroll has two engine code paths: a pure-paise engine (`server/payrollEngine.ts`) and a float engine. ESI rounds UP to the nearest paise in the pure-paise engine and to the nearest rupee in the float engine. It is not confirmed from code reading alone which engine path is active for a given employee.

**Affected feature:** India Statutory Payroll, Salary Slips

**Impact if unaddressed:** ESI amounts may differ by up to ₹1 depending on which engine path is used. For employees near the ESI threshold, the difference could affect eligibility classification.

**Current workaround:** The computation_snapshot JSONB on `salary_slips` records which values were used, allowing post-hoc verification.

**Severity:** P1

**Proposed resolution:** Confirm the exact condition under which each engine path is selected. Document it in `docs/engineering/ENGINEERING_RUNBOOK.md`. Consider consolidating to a single engine path.

**Owner role:** Engineering / Finance

**Status:** Requires owner decision

**Related code reference:** `server/payrollEngine.ts`, `server/salaryEngine.ts`

**Decision:** Requires owner decision — confirm engine selection logic

**Source:** Phase 2 analysis; `docs/workflows/BUSINESS_RULES_CATALOGUE.md` §ESI Rounding

---

## TD-015: TOTP Secrets Stored Without Application-Layer Encryption

**Issue:** TOTP secrets are stored as base32 strings in `admin_users.totpSecret` without additional encryption at the application layer. A database breach exposes all TOTP secrets.

**Affected feature:** TOTP 2FA, Security

**Impact if unaddressed:** If the database is compromised, an attacker with the TOTP secrets could bypass 2FA for all users. Combined with a password breach, this eliminates the second factor entirely.

**Current workaround:** Database access is restricted to the application connection pool. TOTP secrets are not returned in any API response.

**Severity:** P1

**Proposed resolution:** Encrypt `totpSecret` with AES-256 before storage. Store the encryption key in Replit Secrets (environment variable), not in the codebase.

**Owner role:** Engineering / Security

**Status:** Requires owner decision

**Related code reference:** `shared/schema.ts` — `adminUsers.totpSecret`; `server/auth.ts`

**Decision:** Requires owner decision — Fix or Accept with compensating database-level controls

**Source:** `docs/architecture/AUTH_RBAC_SECURITY.md` §PII Field Handling

---

## TD-016: Content Studio Analytics Is Partial (No External Integration)

**Issue:** The Studio Analytics page (`/studio/analytics`) renders self-contained metric cards from `studio_engagement_events` and `studio_audit_events`. No external analytics integration (Google Analytics, Mixpanel, etc.) is confirmed in the codebase.

**Affected feature:** Content Studio — Analytics

**Impact if unaddressed:** Analytics reflects only in-app engagement events, not actual external reader behavior (page views, time on page, referral sources).

**Current workaround:** Treat Studio analytics as an internal engagement proxy, not as a full content performance dashboard.

**Severity:** P3

**Proposed resolution:** Integrate an external analytics provider or expose the `studio_articles` published URL to a Google Analytics property.

**Owner role:** Engineering / Marketing

**Status:** Known and accepted

**Related code reference:** `client/src/pages/admin/studio/Analytics.tsx`

**Decision:** Monitor — accept as partial; extend when analytics becomes a priority

**Source:** `docs/platform/PRODUCT_CAPABILITY_MAP.md` — Content Studio Analytics limitations

---

## Summary Table

| ID | Issue | Severity | Decision | Status |
|---|---|---|---|---|
| TD-001 | Audit log missing old-value capture | P1 | Fix | Scheduled |
| TD-002 | SOP acknowledgement version history not retained | P2 | Monitor | Accepted |
| TD-003 | No closed-loop action record for check-ins | P2 | Fix | Accepted for now |
| TD-004 | manager_id has no DB FK constraint | P2 | Fix | Known and accepted |
| TD-005 | No automated test coverage | P1 | Fix | Under investigation |
| TD-006 | attendance_report_runs has no (month,year) unique constraint | P1 | Monitor | Known and accepted |
| TD-007 | Bank account details not encrypted at application layer | P1 | Requires owner decision | Requires owner decision |
| TD-008 | Executive cockpit route uses client-side guard only | P1 | Fix | Under investigation |
| TD-009 | AI chat endpoint has no PII warning | P2 | Fix | Accepted for now |
| TD-010 | Release notes AI receives raw commit messages | P3 | Monitor | Accepted |
| TD-011 | Social card generation requires runtime Chromium | P2 | Requires owner decision | Requires owner decision |
| TD-012 | No schema mutation developer guide | P1 | Fix | Scheduled |
| TD-013 | employee_plans.employee_id nullable without documentation | P2 | Fix | Known and accepted |
| TD-014 | ESI rounding mode ambiguity between engine paths | P1 | Requires owner decision | Requires owner decision |
| TD-015 | TOTP secrets stored without application-layer encryption | P1 | Requires owner decision | Requires owner decision |
| TD-016 | Content Studio analytics is partial | P3 | Monitor | Accepted |

---

## Appendix: Phase 1 UNABLE_TO_CONFIRM Reconciliation

This section lists every `UNABLE_TO_CONFIRM — OWNER REVIEW REQUIRED` item flagged in Phase 1 documents and records its disposition. Every item is either mapped to a TD entry or explicitly retired with rationale.

**Source:** `docs/architecture/INTEGRATIONS_AND_DEPENDENCIES.md`

| # | Phase 1 Item | Disposition |
|---|---|---|
| I-01 | Ceipal test/sandbox environment availability | **Retired** — sandbox availability is an owner/ops decision, not an engineering code defect. No code change required. |
| I-02 | SendGrid sandbox mode configuration | **Retired** — sandbox mode is configured via environment variables (not code); owner decision. |
| I-03 | GCS upload failure retry behavior not fully confirmed | **Retired** — HTTP error responses on upload failure are confirmed in code; detailed retry policy is an owner ops config. |
| I-04 | Rayo Academy sandbox environment availability | **Retired** — external vendor decision; not a platform engineering debt item. |
| I-05 | Replit Auth OIDC callback error-path handling | **Retired** — Replit manages the OIDC provider; error path handling is platform-managed, not application code. |

**Source:** `docs/architecture/DATABASE_ARCHITECTURE.md`

| # | Phase 1 Item | Disposition |
|---|---|---|
| I-06 | Dev/prod database separation and schema promotion process | **Retired** — policy is documented in `replit.md` (single PostgreSQL per environment, `db:push` promotion). The `scripts/post-merge.sh` guard implements the promotion workflow. No code debt outstanding. |

**Source:** `docs/architecture/AUTH_RBAC_SECURITY.md`

| # | Phase 1 Item | Disposition |
|---|---|---|
| I-07 | Replit Auth — precise data sharing agreement and fields synced to admin_users | **Retired** — data sharing is governed by Replit's platform agreement, not application code. Engineering responsibility is limited to the session and `admin_users` upsert logic, which is confirmed. |
| I-08 | Executive cockpit backend endpoint audit not complete | **→ TD-008** (registered as P1 Fix — Under investigation) |
| I-09 | Bank account details application-layer encryption not confirmed | **→ TD-007** (registered as P1 — Requires owner decision) |

**Source:** `docs/platform/SYSTEM_LANDSCAPE.md`

| # | Phase 1 Item | Disposition |
|---|---|---|
| I-10 | Production domain names, staging URL, CDN configuration not confirmed | **Retired** — production domain configuration is an owner deployment decision, not an engineering code defect. Confirmed sender domain is `hire-in.com` per SendGrid setup. |
| I-11 | Google Fonts self-hosted vs CDN-fetched | **Retired** — font loading strategy is a performance/privacy preference, not a code defect. Owner can audit via browser network panel. |

**Source:** `docs/qa/DECISION_COVERAGE_MAP.md`

| # | Phase 1 Item | Disposition |
|---|---|---|
| I-12 | Complete test file list not enumerable without test run | **→ TD-005** (registered as P1 Fix — Under investigation) |
| I-13 | Executive route backend enforcement audit not done | **→ TD-008** (same as I-08) |
| I-14 | ESI rounding automated test not confirmed | **→ TD-005** (automated test coverage — same root cause) |
| I-15 | PF restricted cap automated test not confirmed | **→ TD-005** (automated test coverage — same root cause) |
| I-16 | Social card Chromium runtime availability not confirmed | **→ TD-011** (registered as P2 — Requires owner decision) |
| I-17 | salary_report_runs is_active filter not confirmed for all read paths | **→ TD-006** (registered as P1 Monitor — Known and accepted) |

**Source:** `docs/workflows/BUSINESS_RULES_CATALOGUE.md`

| # | Phase 1 Item | Disposition |
|---|---|---|
| I-18 | Shift clock times not hardcoded in BUSINESS_RULES_CATALOGUE (document-level caveat) | **Retired** — documentation artifact only; the authoritative values are in the database (corrected and seeded via `ON CONFLICT DO UPDATE`). No code debt outstanding. |
| I-19 | Feature flag default values not confirmed from code reading | **Retired** — `FLAG_DEFAULTS` seed block in `server/index.ts` is the authoritative source. The Phase 1 caveat was a reading-scope limitation, not a code gap. Owner can verify defaults by reading `server/index.ts` directly. |
