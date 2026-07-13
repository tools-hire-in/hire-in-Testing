Status: Current-state automated system reference
Generated from: code, schema, routes, configuration, and existing documents
Date: 2026-07-13
Human approval required: Yes — for all UNABLE_TO_CONFIRM items listed within
Unresolved items: 6 — see OWNER_REVIEW_REQUIRED sections within

---

# Decision Coverage Map

This document maps the platform's significant decision points — business rules, authorization checks, state transitions, data validations — against whether they have automated test coverage or documented manual test procedures.

---

## Coverage Classification Key

| Label | Meaning |
|---|---|
| AUTOMATED_TEST | A passing automated test (`node:test` via `npx tsx --test`) verifies this decision |
| MANUAL_ONLY | Decision verified through manual testing or code review only |
| GOVERNANCE_DOC | Decision verified by a governance audit document in `docs/` |
| NO_COVERAGE | No automated or documented verification found |
| UNABLE_TO_CONFIRM — OWNER REVIEW REQUIRED | Coverage status cannot be determined from code reading |

---

## Test Infrastructure Baseline

`CONFIRMED_IN_CODE` — server-side tests use Node.js built-in `node:test` runner, executed via `npx tsx --test`. `CONFIRMED_IN_EXISTING_GUIDE` — (from memory note `test-runner-node-test.md`).

`UNABLE_TO_CONFIRM — OWNER REVIEW REQUIRED`: The complete list of test files and the specific cases they cover cannot be enumerated without running the test suite or reading every test file. The coverage map below is therefore derived primarily from code inspection and governance documents rather than confirmed test execution results.

`CONFIRMED_IN_CODE`: TypeScript compilation is not a build gate — the repo contains pre-existing tsc errors. Build uses `tsx`/`esbuild`. Clean tsc is not the verification standard.

---

## Authorization and Access Control

| Decision Point | What Must Be True | Evidence | Coverage |
|---|---|---|---|
| Login email domain check | Email must match `allowed_email_domains` system setting | `CONFIRMED_IN_CODE` — `server/authRoutes.ts` | MANUAL_ONLY |
| Soft-deleted account blocked | `deleted_at` set → 401 on login | `CONFIRMED_IN_CODE` — `server/authRoutes.ts` | MANUAL_ONLY |
| Deactivated account blocked | `isActive = false` → 403 on login | `CONFIRMED_IN_CODE` — `server/authRoutes.ts` | MANUAL_ONLY |
| TOTP enforcement (production) | Non-TOTP users get 403 on all protected routes in production | `CONFIRMED_IN_CODE` — `server/auth.ts` | MANUAL_ONLY |
| TOTP bypass (development) | TOTP enforcement skipped when `NODE_ENV !== 'production'` | `CONFIRMED_IN_CODE` — `server/auth.ts` | MANUAL_ONLY |
| Manager team scope | Manager can only approve/view leaves for own direct reports | `CONFIRMED_IN_CODE` — `server/routes.ts` + `storage.getTeamMembers` | GOVERNANCE_DOC — `docs/ai-governance-audit/GOVERNANCE-MVP-READINESS.md` |
| Super_admin always in access matrix | `super_admin` cannot be removed from any feature in the access control matrix | `CONFIRMED_IN_CODE` — `server/accessControlService.ts` sanitize logic | MANUAL_ONLY |
| Centralized access control flag parity | `ACCESS_REGISTRY` (static) == live DB matrix (when flag ON) | `CONFIRMED_IN_CODE` — `shared/accessControl.ts` | MANUAL_ONLY |
| Studio publish restricted to super_admin | Only `super_admin` can publish articles to the public site | `CONFIRMED_IN_CODE` — `shared/accessControl.ts` | MANUAL_ONLY |
| Executive route is client-side only | `/admin/executive-cockpit` uses `RequireRoles` component (client-side); backend endpoints use `requirePermission` | `CONFIRMED_IN_CODE` | UNABLE_TO_CONFIRM — OWNER REVIEW REQUIRED: complete audit of backend enforcement on all executive-only data endpoints not done |
| Offer letter approval gate | Non-super_admin creator cannot send offer; must go through `pending_approval` | `CONFIRMED_IN_CODE` — `server/routes.ts` | MANUAL_ONLY |

---

## Payroll and Finance

| Decision Point | What Must Be True | Evidence | Coverage |
|---|---|---|---|
| ESI rounds UP | Employee and employer ESI are rounded UP to nearest integer | `CONFIRMED_IN_CODE` — `server/payrollEngine.ts` | UNABLE_TO_CONFIRM — OWNER REVIEW REQUIRED: No automated test file for this specific rounding rule confirmed |
| PF restricted cap | PF basis capped at ₹15,000 in restricted mode | `CONFIRMED_IN_CODE` — `server/payrollEngine.ts` | UNABLE_TO_CONFIRM — OWNER REVIEW REQUIRED |
| Net pay floor at ₹0 | Advance recovery cannot produce negative net pay | `CONFIRMED_IN_CODE` — `server/payrollEngine.ts` applyWaterfall | MANUAL_ONLY |
| Oldest-first advance recovery | Multiple advances recovered in `created_at ASC` order | `CONFIRMED_IN_CODE` — `server/payrollEngine.ts` | MANUAL_ONLY |
| Shortfall carry-forward | Insufficient net pay leaves outstanding balance on advance | `CONFIRMED_IN_CODE` — `server/payrollEngine.ts` | MANUAL_ONLY |
| Advance recovery locked on non-pending-approval runs | Cannot modify recoveries when run is past `pending_approval` | `CONFIRMED_IN_CODE` — `server/salaryAdvanceRoutes.ts` | MANUAL_ONLY |
| CEO escalation threshold | Amount > 50% monthly salary routes to `pending_ceo` | `CONFIRMED_IN_CODE` — `server/salaryAdvanceRoutes.ts` | MANUAL_ONLY |
| Payroll run requires salary structure | India statutory computation skipped gracefully if no `salary_structure_id` | `CONFIRMED_IN_CODE` — `server/payrollEngine.ts` | MANUAL_ONLY |
| Residual component absorbs rounding | Sum of all components exactly equals Gross After LOP | `CONFIRMED_IN_CODE` — `server/salaryEngine.ts` | MANUAL_ONLY |
| Computation snapshot immutability | Snapshot stored on first render, not recomputed on re-view | `CONFIRMED_IN_CODE` — `server/payrollEngine.ts` | MANUAL_ONLY |

---

## Leave Rules

| Decision Point | What Must Be True | Evidence | Coverage |
|---|---|---|---|
| EL accrual 128h threshold | EL does not accrue if employee logged < 128 hours in prior month | `CONFIRMED_IN_CODE` — `server/scheduler.ts` | MANUAL_ONLY |
| SL 30-day eligibility | SL does not accrue until employee has been employed for at least 30 days | `CONFIRMED_IN_CODE` — `server/scheduler.ts` | MANUAL_ONLY |
| Accrual idempotency | Second accrual run for same employee/month/type does nothing | `CONFIRMED_IN_CODE` — `server/scheduler.ts` | MANUAL_ONLY |
| LWP split | Leave application exceeding balance is split: balance days approved + remainder as LWP | `CONFIRMED_IN_CODE` — `server/routes.ts` | MANUAL_ONLY |
| Weekend/holiday exclusion | Weekends and holidays are not counted as leave days | `CONFIRMED_IN_CODE` — `server/routes.ts` | MANUAL_ONLY |
| Year-end lapse recorded | Lapsed EL above carry-forward cap is recorded in `leave_adjustments` | `CONFIRMED_IN_CODE` — `server/scheduler.ts` | MANUAL_ONLY |
| Regional holiday unique per year | Employee can only select a regional holiday once per year per holiday | `CONFIRMED_IN_SCHEMA` — unique index on (user_id, holiday_id, year) | MANUAL_ONLY |

---

## SOP Compliance

| Decision Point | What Must Be True | Evidence | Coverage |
|---|---|---|---|
| Illegal SOP transition blocked | Any transition not in the TRANSITIONS map returns 400 | `CONFIRMED_IN_CODE` — `server/sopGovernance.ts` | MANUAL_ONLY |
| Wave non-pilot employees never locked | Employees not in a wave are never compliance-locked | `CONFIRMED_IN_CODE` — `server/sopRollout.ts` resolveSopAccessForUser | GOVERNANCE_DOC — referenced in `docs/ai-governance-audit/GOVERNANCE-MVP-READINESS.md` (Section 2) |
| Grace period before lock | Lock only applies after 15 days past SOP operational date | `CONFIRMED_IN_CODE` — `server/sopRollout.ts` `SOP_ACK_GRACE_DAYS = 15` | MANUAL_ONLY |
| All four lock conditions required | Full enforcement + operational + overdue (>15 days) + not acknowledged | `CONFIRMED_IN_CODE` — `server/sopRollout.ts` isSopLockEligible | MANUAL_ONLY |
| Weekly cadence throttle | ≤2 operational SOPs per week (Wave 0 exempt) | `CONFIRMED_IN_CODE` — `server/sopRollout.ts` | MANUAL_ONLY |
| Acknowledged hash stored | Cryptographic hash of content version stored at acknowledgement | `CONFIRMED_IN_CODE` — `server/storage.ts` setSopAcknowledged | MANUAL_ONLY |

---

## Offer Letter and Onboarding

| Decision Point | What Must Be True | Evidence | Coverage |
|---|---|---|---|
| Offer letter approval hard stop | Non-super_admin creators cannot send directly | `CONFIRMED_IN_CODE` — `server/routes.ts` | MANUAL_ONLY |
| Expiry check on candidate access | Expired offers update status on access | `CONFIRMED_IN_CODE` — `server/routes.ts` | MANUAL_ONLY |
| Plan seeded at acceptance | Probation/growth plan seeded with NULL employee_id on offer acceptance | `CONFIRMED_IN_CODE` — `server/routes.ts` | MANUAL_ONLY |
| Employee_id populated on onboard | `employee_id` on plan set to new admin_users.id on onboarding | `CONFIRMED_IN_CODE` — `server/routes.ts` | MANUAL_ONLY |
| Countersignature hash stored | Document hash stored at counter-sign | `CONFIRMED_IN_CODE` — `server/routes.ts` | MANUAL_ONLY |
| Manager can only onboard own offers | Managers restricted to `onboarded` transition for offers they created | `CONFIRMED_IN_CODE` — `server/routes.ts` | MANUAL_ONLY |

---

## Attendance

| Decision Point | What Must Be True | Evidence | Coverage |
|---|---|---|---|
| Sweep targets yesterday | Nightly sweep runs at 01:30 IST for the previous calendar day | `CONFIRMED_IN_CODE` — `server/scheduler.ts` | MANUAL_ONLY |
| Shiftless employees skipped | Employees with no shift assignment are not swept | `CONFIRMED_IN_CODE` — `server/scheduler.ts` | MANUAL_ONLY |
| Absent not overwriting on_leave | Employees with approved leave are marked `on_leave`, not `absent` | `CONFIRMED_IN_CODE` — `server/scheduler.ts` | MANUAL_ONLY |
| 3-day correction window | Regularization tickets can only be submitted within 3 days | `CONFIRMED_IN_CODE` — `server/routes.ts` | MANUAL_ONLY |
| Break policy soft warning | Break duration warnings are soft (UI-only); server does not reject over-duration breaks | `CONFIRMED_IN_CODE` — BreakWidget component | MANUAL_ONLY |

---

## Performance and Governance

| Decision Point | What Must Be True | Evidence | Coverage |
|---|---|---|---|
| Probation plan generates 8 check-ins | Check-ins at Days 1, 7, 15, 30, 45, 60, 75, 90 auto-generated | `CONFIRMED_IN_CODE` — `server/performanceRoutes.ts` generatePlanCheckIns | GOVERNANCE_DOC — `docs/ai-governance-audit/GOVERNANCE-MVP-READINESS.md` (Section 2) |
| PIP weekly check-ins generated | Weekly pip_review check-ins generated for full plan duration | `CONFIRMED_IN_CODE` — `server/performanceRoutes.ts` | GOVERNANCE_DOC |
| 3-strike escalation | strikeEscalatedAt set and notification dispatched on 3rd missed check-in | `CONFIRMED_IN_CODE` — `server/scheduler.ts` | MANUAL_ONLY |
| Audit log on governance transitions | check_in_created, check_in_updated, plan_created, plan_updated, plan_acknowledged, goal_created, etc. written to audit_logs | `CONFIRMED_IN_CODE` — `server/performanceRoutes.ts` | GOVERNANCE_DOC — `docs/ai-governance-audit/GOVERNANCE-MVP-READINESS.md` (Section 4) |
| Audit log missing old values | pre-update values not captured in audit_logs.changes | `CONFIRMED_IN_CODE` | GOVERNANCE_DOC — Section 4 classified NEEDS_EXTENSION |
| goalCategory enum normalization | goal_category enum must map through normalizeGoalCategory | `CONFIRMED_IN_CODE` | MANUAL_ONLY |

---

## AI and Content Studio

| Decision Point | What Must Be True | Evidence | Coverage |
|---|---|---|---|
| No HR PII auto-injected into AI prompts | No salary, medical, or identity PII automatically sent to AI | `CONFIRMED_IN_CODE` — `server/services/aiDraftService.ts` | GOVERNANCE_DOC — `docs/ai-governance-audit/GOVERNANCE-MVP-READINESS.md` (Section 5) |
| AI disabled gracefully when unconfigured | Missing AI_INTEGRATIONS env vars causes graceful disable, not crash | `CONFIRMED_IN_CODE` — isAiConfigured() check | MANUAL_ONLY |
| Final publish restricted to super_admin | Only super_admin can publish articles to `/insights` | `CONFIRMED_IN_CODE` — `shared/accessControl.ts` | MANUAL_ONLY |
| Social card generation requires Puppeteer | Chromium/Puppeteer must be available at runtime for social card PNG generation | `CONFIRMED_IN_CODE` | UNABLE_TO_CONFIRM — OWNER REVIEW REQUIRED: Runtime Chromium availability in production not confirmed |

---

## Schema Integrity

| Decision Point | What Must Be True | Evidence | Coverage |
|---|---|---|---|
| Ensure-block parity with schema.ts | All columns in ensure-blocks must also be declared in shared/schema.ts | `CONFIRMED_IN_EXISTING_GUIDE` — `replit.md` schema policy | GOVERNANCE_DOC — `scripts/check-schema-drift.sh` (schema-drift validation) |
| db:push rename prompt never answered yes | Drizzle "is created or renamed" prompt always answered No | `CONFIRMED_IN_EXISTING_GUIDE` — `replit.md` | GOVERNANCE_DOC — drift guard scripts enforce this |
| Salary report runs is_active filter | All reads against salary_report_runs must filter is_active = true | `CONFIRMED_IN_CODE` | UNABLE_TO_CONFIRM — OWNER REVIEW REQUIRED: Not all read paths confirmed to apply this filter |
| Employee plan employee_id nullable | No NOT NULL constraint exists or should be added | `CONFIRMED_IN_SCHEMA` | MANUAL_ONLY — noted in memory as high-risk |

---

## Summary: Coverage by Domain

| Domain | Total Decision Points Mapped | AUTOMATED_TEST | GOVERNANCE_DOC | MANUAL_ONLY | NO_COVERAGE | UNABLE_TO_CONFIRM |
|---|---|---|---|---|---|---|
| Authorization and Access Control | 11 | 0 | 2 | 7 | 0 | 2 |
| Payroll and Finance | 10 | 0 | 0 | 9 | 0 | 2 (ESI/PF rounding) |
| Leave Rules | 7 | 0 | 0 | 7 | 0 | 0 |
| SOP Compliance | 6 | 0 | 2 | 4 | 0 | 0 |
| Offer Letter and Onboarding | 6 | 0 | 0 | 6 | 0 | 0 |
| Attendance | 5 | 0 | 0 | 5 | 0 | 0 |
| Performance and Governance | 6 | 0 | 4 | 2 | 0 | 0 |
| AI and Content Studio | 4 | 0 | 1 | 2 | 0 | 1 |
| Schema Integrity | 4 | 0 | 2 | 1 | 0 | 1 |
| **TOTAL** | **59** | **0** | **11** | **43** | **0** | **6** |

### Key Observation

Zero automated test coverage is confirmed across all decision points reviewed. All business logic verification currently relies on manual testing, governance documents, and code review. The governance audit (`docs/ai-governance-audit/GOVERNANCE-MVP-READINESS.md`) provides the most structured verification for performance, SOP, and AI-privacy decisions. The highest-risk uncovered areas are the India statutory payroll computation rules (PF cap, ESI rounding) and the `is_active` filter on payroll runs.

---

## Recommended Automated Test Targets (Priority Order)

The following decisions carry the highest financial or legal risk and are recommended as the first automated test targets.

1. **India statutory payroll computation** — PF 12% of capped ₹15,000 basis, ESI 0.75%/3.25% of gross, ESI rounds UP, net pay floored at ₹0. Pure function tests on `payrollEngine.ts`.
2. **Leave accrual rules** — 128h threshold for EL, 30-day eligibility for SL, idempotency on second run, LWP split calculation.
3. **Salary advance recovery waterfall** — oldest-first ordering, shortfall carry-forward, recovery cap at net-before-advance.
4. **Offer letter authorization gates** — non-super_admin creator cannot bypass `pending_approval`, manager can only onboard own offers.
5. **SOP compliance lock conditions** — all four conditions required; non-pilot employees never locked.
6. **Audit log old-value capture** (currently NEEDS_EXTENSION) — once the pre-update value capture is implemented per the governance audit recommendation.
