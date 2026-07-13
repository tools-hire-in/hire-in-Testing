Status: Current-state automated system reference
Generated from: code, schema, routes, configuration, and existing documents
Date: 2026-07-13
Human approval required: Yes — for all UNABLE_TO_CONFIRM items listed within
Unresolved items: 0

---

# Training Gap Map

This document identifies gaps between the documentation that currently exists and the documentation that would be required to onboard and train new platform users or contributors effectively. Gaps are organized by audience persona.

---

## How to Read This Document

**Gap status key:**

| Status | Meaning |
|---|---|
| COVERED | Sufficient documentation exists in `docs/` |
| PARTIALLY_COVERED | Some documentation exists but is incomplete, outdated, or too narrow |
| GAP | No adequate documentation exists for this need |
| OUT_OF_SCOPE | Not a documentation gap; handled by another mechanism (e.g., the product UI itself guides users) |

All coverage assessments are `CONFIRMED_IN_EXISTING_GUIDE` for items marked COVERED, and confirmed by the absence of matching documents in the `docs/` directory scan for items marked GAP.

---

## Persona 1: New Developer (Backend / Full-Stack)

A developer joining the engineering team who needs to set up a local environment, understand the architecture, make schema changes, and contribute features.

| Need | Documentation Available | Gap Status | Notes |
|---|---|---|---|
| System architecture overview | `docs/platform/SYSTEM_LANDSCAPE.md` (new) | COVERED | Technology stack, external services, system context |
| Database schema understanding | `docs/architecture/DATABASE_ARCHITECTURE.md`, `docs/architecture/DATABASE_DATA_DICTIONARY.md` (new) | COVERED | Domain groups, table purposes, key fields, enum values |
| Authentication and RBAC implementation | `docs/architecture/AUTH_RBAC_SECURITY.md` (new) | COVERED | Full login flows, middleware, session management |
| How to add a new database table | None | GAP | No developer guide exists for the safe schema → ensure-block → db:push workflow. The policy is described in `replit.md` but not as a step-by-step guide for developers. A mistake here can cause data loss in production. |
| How to add a new feature flag | None | GAP | The three-place rule (ALLOWED_FLAGS + flagDefs + FLAG_DEFAULTS) is described in memory notes but not in any developer-facing guide. A flag missing one of the three registrations is permanently OFF with no warning. |
| How to add a new notification type | None | GAP | No guide for the `shared/notificationTypes.ts` preference-key registration + `notifyUser()` call pattern. |
| How to run the server locally | `replit.md` (scripts section) | PARTIALLY_COVERED | `npm run dev` is documented. No troubleshooting guide for common startup errors, port conflicts, or DB connection issues. |
| How to run tests | None | GAP | No developer guide documents that tests use `node:test`, are run via `npx tsx --test`, and must not use vitest. A developer would likely use the wrong test runner. |
| External integrations: how they work | `docs/architecture/INTEGRATIONS_AND_DEPENDENCIES.md` (new) | COVERED | Auth methods, env vars, failure behavior, data sensitivity |
| State machines for core workflows | `docs/workflows/WORKFLOW_STATE_MACHINES.md` (new) | COVERED | All 15 state machines with transition tables and guards |
| Business rules for payroll computation | `docs/workflows/BUSINESS_RULES_CATALOGUE.md` (new) | COVERED | PF, ESI, PT, LOP, waterfall rules |
| How the centralized access control flag works | `docs/architecture/AUTH_RBAC_SECURITY.md` (new) | COVERED | |
| Production deployment process | None | GAP | No developer guide for how to promote schema changes to production, how to run `db:push` safely, or the merge guard behavior. |
| How the Content Studio AI pipeline works | None | GAP | No developer-facing guide for the AI generation service, model tiers, prompt composition, or brand voice injection. The governance audit touches AI privacy but not the engineering design. |
| Codebase navigation / module structure | None | GAP | No guide for where to find routes (split across `routes.ts`, `*Routes.ts` files), how services are organized, or the relationship between `shared/`, `server/`, and `client/`. |

**Developer onboarding gap severity: HIGH.** The schema mutation workflow gap is particularly high-risk — incorrect `db:push` interactions are the most documented source of production data-loss incidents in the existing memory notes.

---

## Persona 2: HR Administrator

An HR team member who manages employees, leave, payroll assists, letters, and settings within the admin portal. Does not write code.

| Need | Documentation Available | Gap Status | Notes |
|---|---|---|---|
| Generating an offer letter | None | GAP | No step-by-step guide. Approval workflow (why non-super_admin letters go to pending_approval) is not documented for HR users. |
| Approving / rejecting offer letters | None | GAP | No guide for the countersign workflow or what each offer status means. |
| Processing a salary advance (manual record) | None | GAP | The difference between advance, overpayment, and salary_credit types; when to use each; how recovery works automatically. |
| Generating a monthly payroll run | None | GAP | No step-by-step HR guide for the payroll run workflow (generate → adjust → approve → execute). |
| Configuring leave types and accrual | None | GAP | No guide for HR settings — leave type creation, accrual rate configuration, LWP rules. |
| Issuing HR letters and amendment letters | None | GAP | No guide on which letter types are available, the controlled-wording restriction, or how verification works. |
| Managing SOP compliance | None | GAP | No HR guide for publishing SOPs, configuring wave rollout, or understanding soft/measured/full enforcement. |
| Understanding feature flags | None | GAP | HR admins can toggle feature flags in HRSettings. No guide explains what each flag does or the consequences of toggling. |
| Configuring Rayo Academy credentials | `docs/training/rayo-academy-blueprint.md` | PARTIALLY_COVERED | Blueprint describes what Rayo Academy is, but no admin-facing guide for configuring the API URL and API key in system settings. |
| Leave balance adjustments | None | GAP | No guide for manual leave adjustment use cases, LWP recording, or year-end processing. |
| Attendance report generation and approval | None | GAP | No guide for the attendance report run workflow, the is_active flag, or how additive auto-sync works. |
| SendGrid sender configuration | `docs/ops/sendgrid-sender-verification.md` | PARTIALLY_COVERED | Verification record exists but is technical; not an HR-facing operational guide. |

**HR administrator gap severity: HIGH.** Core HR workflows (offer letters, payroll, letters, SOP management) have zero HR-facing guides. New HR staff would need significant in-person training or would need to learn purely through the UI.

---

## Persona 3: Manager

A team manager who uses the portal to view team attendance, approve leave, run check-ins, manage plans, and initiate offer letters.

| Need | Documentation Available | Gap Status | Notes |
|---|---|---|---|
| Approving team leave requests | None | GAP | No guide explaining the leave approval flow, LWP implications, or the 3-day correction window. |
| Managing employee plans (probation, growth, PIP) | None | GAP | No manager guide for creating plans, understanding the 8-milestone probation cadence, what each check-in type means, or how to record outcomes. |
| Creating an offer letter | None | GAP | No manager guide for offer letter creation, why letters enter pending_approval, or what happens after candidate acceptance. |
| Viewing and correcting team attendance | None | GAP | No guide for team attendance view, correction vs. regularization, or the 3-day window. |
| Understanding team training compliance | None | GAP | No guide for managers on how to read training progress, the compliance lock mechanism, or how to request training extensions. |
| Requesting salary advance approvals | None | GAP | No guide for the approval workflow from a manager's perspective, the CEO escalation rule, or how to handle overpayments. |
| Understanding My Team tab structure | None | GAP | The four-tab My Team layout (Team/Corrections/Plans and sub-navigation) is complex and not documented. |

**Manager gap severity: MEDIUM-HIGH.** Managers who are new to the system or new to management have no written reference for their most important tasks.

---

## Persona 4: Employee (Self-Service)

A regular employee who uses the portal for attendance, leave, training, and profile management.

| Need | Documentation Available | Gap Status | Notes |
|---|---|---|---|
| How to punch in and out | None (UI guides itself) | OUT_OF_SCOPE | The Time Card UI is action-first and self-explanatory. |
| Break tracking policy | None | GAP | No written policy document for Lunch (1×30min) and Tea (2×15min) break rules, or what the soft warnings mean. |
| Leave application and LWP | None | GAP | Employees benefit from understanding when their leave will result in LWP (balance exhausted) and how that affects their salary. |
| Training and SOP compliance lock | None | GAP | Employees need to understand why they might be blocked from accessing the portal (compliance lock), how to resolve it, and what the grace period is. |
| Understanding the Rayo Academy integration | `docs/training/rayo-academy-blueprint.md` | PARTIALLY_COVERED | Blueprint is a technical spec, not an employee-facing guide. Employees need a simple explanation of what Rayo Academy is and how it connects to their portal experience. |
| Salary advance request | None | GAP | No employee-facing guide for how to submit an advance, what information is needed, what the approval timeline looks like, and recovery implications. |

**Employee gap severity: LOW-MEDIUM.** The UI handles most employee workflows well. The compliance lock and LWP scenarios are the highest-risk gaps because they have financial or access consequences that may surprise employees.

---

## Persona 5: New Hire Candidate

A candidate who has received an offer letter and needs to understand the acceptance process.

| Need | Documentation Available | Gap Status | Notes |
|---|---|---|---|
| How to accept an offer letter | None (email contains link) | OUT_OF_SCOPE | The acceptance flow is guided by the offer email and the `/onboard/:token` page. |
| What happens after acceptance | None | GAP | No candidate guide explaining what to expect post-acceptance: when credentials will be sent, what Rayo Academy provisioning means, what documents will be requested. |
| Document verification for issued letters | None (UI guides itself) | OUT_OF_SCOPE | The `/verify` page is self-guided. |

---

## Persona 6: Executive / Finance

An executive or finance team member who views payroll summaries, headcount data, and compliance obligations.

| Need | Documentation Available | Gap Status | Notes |
|---|---|---|---|
| Executive dashboard navigation | None | GAP | No guide for the executive dashboard and payroll executive view. |
| Reading payroll reports | None | GAP | No guide for interpreting payroll run outputs, statutory deductions, or the executive cockpit metrics. |
| Governance controls and obligations | None | GAP | No guide for the Control Tower and governance control lifecycle. |

**Executive gap severity: MEDIUM.** These users have read-only access; gaps are informational rather than operational.

---

## High-Priority Documentation Gaps (Ranked by Risk)

Rank is based on the combination of: how often the task occurs, the consequence of getting it wrong, and whether the UI provides sufficient inline guidance.

| Priority | Persona | Gap | Risk |
|---|---|---|---|
| 1 | Developer | Schema mutation workflow (add table / add column / db:push safely) | Production data loss if done incorrectly |
| 2 | Developer | How to add a feature flag correctly (three-place rule) | Feature silently OFF with no error; debugging is non-obvious |
| 3 | Developer | How to run tests (node:test vs. vitest) | Wrong test runner gives false results |
| 4 | HR Admin | Payroll run workflow (generate → approve → execute) | Incorrect run could produce erroneous salary disbursements |
| 5 | Employee | Training compliance lock — what it is and how to resolve it | Employee locked out of system with no explanation |
| 6 | HR Admin | Offer letter workflow including pending_approval for non-super_admin creators | HR doesn't understand why their offer is stuck |
| 7 | Manager | Employee plan (probation/PIP) — what check-in types mean, how to record outcomes | Incorrect probation management creates legal risk |
| 8 | HR Admin | Leave balance management — LWP calculation, year-end lapse | Employees paid incorrectly |
| 9 | Developer | API surface / module structure guide | Slow onboarding, code duplication |
| 10 | HR Admin / Manager | SOP wave enforcement — what soft/measured/full means, how to configure | HR inadvertently locks employees before appropriate rollout |

---

## Documentation Production Recommendations

The following document types are recommended to address the highest-priority gaps. All would be written by a human author familiar with both the system behavior and the target audience.

1. **Developer Runbook — Schema Safety** (audience: developer, priority: urgent). Covers the add-table, add-column, and db:push procedures step-by-step with the specific prompts that appear in the terminal UI and the correct responses. Includes the drift guard and merge guard context.

2. **Developer Runbook — Feature Flags and Notification Types** (audience: developer, priority: high). Step-by-step for registering a new flag in all three required locations, and registering a new notification type in `shared/notificationTypes.ts`.

3. **HR Admin Guide — Core Workflows** (audience: HR admin, priority: high). Covers: offer letter generation and approval, payroll run workflow, leave balance adjustments, HR letter issuance, and SOP management.

4. **Manager Guide — Team Management** (audience: manager, priority: medium-high). Covers: leave approval, employee plans and check-ins, offer letter creation, team attendance correction.

5. **Employee FAQ — Compliance and Leave** (audience: employee, priority: medium). Covers: what the compliance lock is, how to resolve it, when leave becomes LWP, and how to request a salary advance.

6. **API Reference** (audience: developer, integrator, priority: medium). Auto-generated or hand-curated reference for all REST endpoints with request/response shapes, authentication requirements, and error codes.
