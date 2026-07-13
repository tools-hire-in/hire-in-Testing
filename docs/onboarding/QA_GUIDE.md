# QA Guide — Hire'in Solutions

This guide is the operational reference for the QA Engineer. It covers the existing test suite, coverage gaps, manual smoke test procedures, bug severity classification, the regression checklist, and the day-by-day quick-start plan. Read `ONBOARDING.md` first, then this document.

---

## 1. Running the Test Suite

All backend tests use `node:test`. Do not use `vitest` — it picks up the Vite client configuration and will behave incorrectly for server tests.

The correct command for any backend test file:

```
npx tsx --test <path-to-test-file>
```

Example:

```
npx tsx --test server/tests/attendancePolicy.test.ts
npx tsx --test server/tests/salaryAdvanceRecovery.test.ts
npx tsx --test tests/payrollEngine.test.ts
```

The client-side test file uses the same runner:

```
npx tsx --test client/src/lib/control-tower-access.test.ts
```

Tests that hit the database (all backend integration tests) require a live PostgreSQL connection. They create and clean up their own test fixtures using known user IDs and test-scoped dates (typically far-future years like 2099 to avoid collisions with real data).

**Known pre-existing constraints that are not bugs:**
- `tsc` reports hundreds of pre-existing type errors. This is not a build failure. The build uses tsx/esbuild.
- The dev backend has no watch mode. After any route change, the `Start application` workflow must be restarted or the API will return the SPA HTML instead of JSON.
- `drizzle-kit push` stalls on constraint name prompts in non-TTY environments. This is expected behavior in CI.

---

## 2. Existing Test Coverage Map

| Test file | Run command | What it covers | What it does NOT cover | P-tier of tested features |
|---|---|---|---|---|
| `server/tests/attendancePolicy.test.ts` | `npx tsx --test server/tests/attendancePolicy.test.ts` | Late status computation, day completion status, regularization eligibility, working-days-back counting, grace usage, punch API flows, absent sweep trigger, team attendance range queries | Break tracking is not tested; no test for the monthly accrual interaction with attendance hours | P0 (sweep), P1 (punch, regularization) |
| `server/tests/salaryAdvanceRecovery.test.ts` | `npx tsx --test server/tests/salaryAdvanceRecovery.test.ts` | Recovery reconciliation: when net pay is insufficient the capped run-row amount is used (not the full scheduled installment); outstanding balance decrements correctly; advances never close prematurely | Happy-path full recovery not explicitly tested; overpayment path not tested; manual backfill recording not tested | P0 (recovery reconciliation) |
| `server/tests/salaryAdvanceAccess.test.ts` | `npx tsx --test server/tests/salaryAdvanceAccess.test.ts` | RBAC access control for salary advance endpoints: which roles can create, view, approve (manager / final), and access accounts | Does not test the advance recovery integration with a payroll run; does not test the self-service flag interaction | P2 (access gating) |
| `server/tests/studioContent.test.ts` | `npx tsx --test server/tests/studioContent.test.ts` | Studio content creation, review pipeline state transitions, AI draft generation access | Social card generation not tested; BD Agent not tested; occasion preferences not tested | P3 |
| `server/sopGovernance.test.ts` | `npx tsx --test server/sopGovernance.test.ts` | SOP status state machine (legal forward transitions, illegal backwards transitions), business-day SLA math (addBusinessDays, businessDaysBetween, 5-day reviewer SLA), reviewer action to status mapping, comment-required actions, approval gate evaluation, wave lock eligibility | Wave rollout scheduling not tested; SOP-goal KPI linkage not tested; actual DB-persisted SOP operations not tested; soft/hard enforcement paths not tested | P2 (SOP governance) |
| `tests/payrollEngine.test.ts` | `npx tsx --test tests/payrollEngine.test.ts` | Pure computation: EPF/EPS/EDLI rates, ESI applicability and rounding (rounds UP to nearest paise), PT computation, TDS, waterfall order, LOP proportional and fixed modes, salary component breakdown from gross, paise/rupee conversion | Payroll run orchestration not tested (only the pure engine); slip PDF rendering not tested; salary structure assignment to an employee not tested; multi-employee run not tested | P0 (engine correctness) |
| `client/src/lib/control-tower-access.test.ts` | `npx tsx --test client/src/lib/control-tower-access.test.ts` | Control Tower tab access by role: super_admin sees all tabs; hr sees only data-maintenance; other roles (admin, operations, manager, employee) are denied; legacy system-settings deep-link redirect | Does not test the full admin access control registry; does not test runtime DB-driven matrix overrides | P1 (role gating for Control Tower) |
| `client/src/lib/people-hr-tabs.test.ts` | `npx tsx --test client/src/lib/people-hr-tabs.test.ts` | People & HR tab routing: valid tab parsing, legacy aliases (exceptions → escalations, risk-summary → escalations, reports → salary), relocated tabs (training and plans moved to Growth & Learning), role-based tab visibility gating (hr-gated vs admin-gated vs open), visibleTabDefsForRole output | Does not test actual page navigation outcomes; does not test full RBAC for sub-page content or query param forwarding | P1 (HR tab routing) |
| `client/src/lib/settings-redirect.test.ts` | `npx tsx --test client/src/lib/settings-redirect.test.ts` | Settings page tab redirect routing: retained tabs mapped to new group paths (organization, leave-attendance), legacy aliases (attendance → attendance-policy), relocated tabs forwarded to their new pages (balance-adjustments → People & HR, letter-templates → HR Tools, whats-new / release-notes → Communications), Control Tower redirects (feature-flags, access-control, audit-logs, data-maintenance) | Does not test actual page load or auth gating after redirect; does not test tabs introduced after the settings restructure | P1 (settings navigation) |

---

## 3. Coverage Gap Analysis

The following critical paths have no automated test coverage. They are the highest regression risk after any merge.

| Feature | P-tier | Gap type | Risk if untested |
|---|---|---|---|
| Offer letter e-sign chain (generate → approve → candidate sign → countersign) | P0 | Integration / E2E | A broken e-sign step goes undetected until a real candidate tries to sign. Legal agreements are unenforceable. |
| Letter cryptographic hash and `/verify` lookup | P0 | Integration | A tampered or incorrectly hashed document passes public verification. Compliance and legal risk. |
| Leave accrual engine (monthly accrual, year-end carry-forward and lapse) | P0 | Unit | Incorrect accrual silently produces wrong leave balances, leading to incorrect payroll LOP. |
| Salary slip PDF generation (render, computation snapshot write) | P0 | Integration | PDF generation fails silently; employees receive no payslip; computation snapshot is missing. |
| TOTP 2FA enforcement on login | P0 | Integration | An auth bypass could go undetected — any account becomes accessible without the second factor. |
| Leave application → balance deduction → LWP split | P0 | Integration | Incorrect balance deductions; LWP not recorded; payroll deducts wrong LOP days. |
| Payroll run orchestration (generate → adjust → execute → disburse) | P1 | Integration | Run lifecycle state machine breaks without notice; disbursement does not trigger. |
| Attendance absent sweep — monthly LOP accumulation | P0 | Integration | Sweep correctness (unit-tested) is separate from the integration with the monthly payroll LOP counter. |
| Role-gated API endpoints (beyond Control Tower tabs) | P1 | Integration | A role regression grants an employee access to manager or HR APIs. |
| Feature flag defaults on clean seed | P1 | Integration | `notifications` could be seeded OFF, silently disabling all in-app alerts. |
| Email delivery via SendGrid (letter, payslip, invite) | P1 | Integration | Email paths may not check `notified_at` before sending, causing duplicate emails or silent failures. |
| Salary advance manual recording (backfill and overpayment) | P2 | Integration | Manually recorded advances are not recovered correctly by the payroll engine. |
| SOP compliance lock activation and lift | P2 | Integration | Hard enforcement locks employees incorrectly, or the lock never lifts after completion. |
| New hire guided onboarding checklist creation on countersign | P2 | Integration | Onboarding checklist is not created when HR countersigns; new hire has no tasks to complete. |

---

## 4. Manual Smoke Test Checklist

Run this checklist after every significant merge. Mark each item pass or fail. A single P0 or P1 failure is a production blocker.

### Module: Authentication

| # | Step | Expected result | Pass / Fail |
|---|---|---|---|
| A1 | Navigate to `/admin/login` without a session | Login page appears, redirect to original path is preserved in `?next=` | |
| A2 | Log in with a valid email and password | TOTP prompt appears | |
| A3 | Enter correct TOTP code | Dashboard loads for the user's role | |
| A4 | Wait 31 minutes without interacting | Session timeout warning dialog appears | |
| A5 | Attempt to access `/admin/hr/people` as an employee account | Access denied or redirect to own dashboard | |
| A6 | Attempt to access the payroll run page as a manager account | Access denied | |

### Module: Attendance (Employee)

| # | Step | Expected result | Pass / Fail |
|---|---|---|---|
| B1 | As employee, navigate to My Desk | Time Card view appears with Punch In button | |
| B2 | Click Punch In | Button changes to Punch Out; punch-in time is recorded and displayed | |
| B3 | Click Start Lunch Break | Lunch timer starts; Lunch button shows running state | |
| B4 | Click End Lunch Break | Lunch duration is recorded; Punch Out button is accessible | |
| B5 | Click Punch Out | Punch-out time recorded; daily total hours computed and displayed | |
| B6 | Verify the attendance record in the database | `attendance` row for today has `punchIn`, `punchOut`, and `totalHours` | |

### Module: Leave Management

| # | Step | Expected result | Pass / Fail |
|---|---|---|---|
| C1 | As employee, navigate to Leaves tab and apply for 1 day EL | Leave request created with status `pending`; balance not yet decremented | |
| C2 | As manager, open Leave Approvals | Pending request appears; notification badge is visible on the page | |
| C3 | Manager approves the request | Status changes to `approved`; employee's EL balance decrements by 1 | |
| C4 | Employee views the approved request | Reviewer name and approval timestamp are displayed | |
| C5 | Apply for leave exceeding remaining balance | System splits into paid days and LWP days, or rejects if no balance | |

### Module: Offer Letters

| # | Step | Expected result | Pass / Fail |
|---|---|---|---|
| D1 | As manager, open New Hire > Offer Letters and generate an offer | Offer letter created with status `pending_approval` | |
| D2 | As admin, open the pending offer letter and approve | Status changes to `approved`; candidate email sent | |
| D3 | Open the candidate acceptance link | Offer letter content is displayed; e-signature field is present | |
| D4 | Candidate submits e-signature | `accepted_at` timestamp and hash recorded; status moves toward countersign | |
| D5 | As HR, countersign the offer letter | Status changes to `countersigned`; onboarding checklist created | |
| D6 | As manager, check rejected offer letter | Rejection reason from admin is visible on the offer letter row | |

### Module: HR Letters and `/verify`

| # | Step | Expected result | Pass / Fail |
|---|---|---|---|
| E1 | As HR, generate an experience letter for an employee | PDF is produced; reference number and auth code are assigned | |
| E2 | Navigate to `/verify` as an unauthenticated user | Verification form appears (no letter content visible) | |
| E3 | Enter the correct reference number and auth code | "Valid" response with document metadata (no full content) | |
| E4 | Enter an incorrect auth code | "Invalid" response | |
| E5 | Revoke the letter in the admin portal, then verify again | "Revoked" response | |

### Module: Payroll

| # | Step | Expected result | Pass / Fail |
|---|---|---|---|
| F1 | As HR or executive, generate a payroll run for the current month | Run row created with status `draft` | |
| F2 | Review the run — check PF, ESI, and PT deductions for one employee | Deductions match the India statutory rates (12% EPF, 0.75% ESI employee) | |
| F3 | Check that a salary advance recovery appears in the run for an employee with an active advance | Advance recovery amount appears, capped to net pay | |
| F4 | Execute the run | Run status moves to executed; per-employee payslip rows created | |
| F5 | As employee, download their salary slip | PDF is downloaded with correct gross, deductions, and net pay | |

### Module: Role Access

| # | Step | Expected result | Pass / Fail |
|---|---|---|---|
| G1 | As employee, attempt `GET /api/hr/users` | 403 Forbidden | |
| G2 | As manager, attempt `GET /api/hr/salary-structures` | 403 Forbidden | |
| G3 | As executive, open payroll run page | Page loads; payroll run is accessible | |
| G4 | As finance, attempt to approve an offer letter | 403 Forbidden | |

### Module: Feature Flags

| # | Step | Expected result | Pass / Fail |
|---|---|---|---|
| H1 | Verify `notifications` flag is ON in System Settings | In-app notification bell appears in the nav | |
| H2 | Verify `performance_management` flag is OFF | Performance module pages are not accessible / not in nav | |
| H3 | Turn `salary_advance_enabled` ON | Employee sees Salary Advance option in their menu | |
| H4 | Turn `salary_advance_enabled` OFF | Employee's Salary Advance option is hidden | |

---

## 5. Bug Severity Guide and Report Template

### Severity Levels

**P0 — Critical.** Data loss, payroll error, auth bypass, or the feature is completely broken for all users. Production blocker. Requires immediate hotfix. Examples: payroll computation produces wrong statutory deductions, punch-in creates no DB record, TOTP can be bypassed, salary advance balance goes negative.

**P1 — High.** A specific role's core workflow is broken, or a critical flow fails for a subset of users. Requires a hotfix within one business day. Examples: manager cannot approve leave requests, offer letter approval email not sent, employee payslip download fails for one department.

**P2 — Medium.** Wrong output, broken UI element, or missing data — but the system is still usable. Scheduled in the next sprint. Examples: balance shown on leave form is off by 0.5 days, incorrect date format in letter PDF, attendance correction note not displaying.

**P3 — Low.** Cosmetic defect, edge case, or minor inconsistency. Backlogged. Examples: button misalignment on mobile, incorrect tooltip text, wrong avatar initials for a non-Latin name.

### Bug Report Template

```
Title: [Severity] Short description of the defect

Severity: P0 / P1 / P2 / P3

Given:
  [The precondition — user role, data state, feature flag setting, page]

When:
  [The exact action taken — button clicked, form submitted, API called]

Then (actual):
  [What actually happened — error message, wrong value, nothing happening]

Expected:
  [What should have happened]

Environment:
  - URL / route:
  - User role and email:
  - Date and time (IST):
  - Browser and version (if frontend):
  - Relevant feature flags:

Evidence:
  - Screenshot or screen recording:
  - Browser console errors (if frontend):
  - Server log excerpt (if backend — copy from workflow logs):
  - Relevant database row (if data issue):
```

### Known Constraints (Do Not File as Bugs)

- `tsc` reporting type errors is not a bug. The build uses tsx/esbuild.
- The dev backend does not hot-reload after route changes. Restart the workflow before reporting a "route not found" or "returns HTML instead of JSON" issue.
- `drizzle-kit push` stalling on an arrow-key prompt in a non-TTY shell is expected behavior, not a bug.
- Pre-existing schema drift between the dev database and `shared/schema.ts` may cause false positives in the drift guard output. Check the memory file `schema-db-drift-guard.md` for known benign stalls.

---

## 6. Regression Checklist

Run this checklist after every merge before the release is promoted to production. It maps directly to the MLP and P0 feature tier.

| # | Area | What to check | Test method |
|---|---|---|---|
| R1 | Payroll computation accuracy | PF (12% employee), ESI (0.75% employee up to ₹21,000 gross), PT (state-specific) for a known fixture employee | Automated: `tests/payrollEngine.test.ts` |
| R2 | Attendance punch flow | Punch In creates `attendance` row; Punch Out writes `punchOut` and `totalHours` | Manual: smoke test B1–B5 |
| R3 | Leave balance after approval | EL balance decrements by the approved paid days (not on submit, on approval) | Manual: smoke test C1–C4 |
| R4 | Offer letter PDF generation | PDF file is produced and the hash is written to the `offer_letters` record | Manual: smoke test D1–D4 |
| R5 | Letter hash on `/verify` | Valid reference number + auth code → "Valid" response; wrong code → "Invalid" | Manual: smoke test E2–E4 |
| R6 | 2FA enforcement on login | TOTP prompt appears for accounts with `totp_enabled = true`; login completes only after correct code | Manual: smoke test A2–A3 |
| R7 | Email delivery (SendGrid) | At least one transactional email sent during the smoke test run (leave approval, offer letter, or invite) | Manual: check SendGrid activity log |
| R8 | Salary advance recovery in payroll run | Outstanding balance decrements correctly after run; no premature close | Automated: `server/tests/salaryAdvanceRecovery.test.ts` |
| R9 | Role-gated page access | Employee cannot reach manager or HR API endpoints (403 returned) | Manual: smoke test G1–G2 |
| R10 | Feature flag defaults | `notifications` is ON; `performance_management` is OFF on a seed database | Manual: smoke test H1–H2 |

---

## 7. QA Day-by-Day Quick-Start Checklist

### Day 1

- [ ] Read `ONBOARDING.md` cover to cover.
- [ ] Read this document.
- [ ] Get admin portal access with at least one account per role (employee, manager, hr, admin, super_admin).
- [ ] Run all existing test files and record whether each passes or fails. Note any test requiring a specific database fixture that is absent in the dev environment.

```
npx tsx --test server/tests/attendancePolicy.test.ts
npx tsx --test server/tests/salaryAdvanceRecovery.test.ts
npx tsx --test server/tests/salaryAdvanceAccess.test.ts
npx tsx --test server/tests/studioContent.test.ts
npx tsx --test tests/payrollEngine.test.ts
npx tsx --test client/src/lib/control-tower-access.test.ts
```

- [ ] Document any failures in a shared log with the test file name, error message, and whether it appears to be a test setup issue or a real defect.

### Day 2

- [ ] Execute a full manual smoke test of every P0 feature from Section 4: authentication (A1–A6), attendance (B1–B6), offer letter (D1–D4), letters and verify (E1–E5), and payroll (F1–F5).
- [ ] Log the result (pass/fail) for each step.
- [ ] File a bug report for any P0 failure found using the template in Section 5.

### Day 3

- [ ] Execute a full manual smoke test of every P1 feature: leave management (C1–C5), role access (G1–G4), feature flags (H1–H4).
- [ ] Log results. File P1 bug reports for any failures.
- [ ] Walk through the Content Studio as a marketing_manager add-on user (P3 — lower priority, but confirms add-on access works).

### Day 4

- [ ] Review the coverage gap analysis in Section 3.
- [ ] Select the highest-risk untested path (recommended: offer letter e-sign chain — P0, no test).
- [ ] Write a test plan for it: describe the test setup (what fixture data is needed), the steps to exercise the path, the assertions to make, and the expected DB state after each step.
- [ ] Review the test plan with the engineering lead before writing any code.

### Day 5

- [ ] Write and submit one bug report using the template, even if no bugs were found during smoke testing. Pick an edge case or a known constraint to document as a P3 (e.g., a UI inconsistency or a missing data-testid attribute on a critical button).
- [ ] Review the MLP regression checklist items R1–R10 and confirm you can execute each one independently.

### Week 2

- [ ] Own the regression checklist for the next merge. Run all ten items, document results, and make a go/no-go recommendation before the release is promoted to production.
- [ ] Identify one gap from Section 3 and write the first test for it (unit or integration). Submit it as a contribution to the test suite.
