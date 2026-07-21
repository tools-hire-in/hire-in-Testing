Status: Updated gap map — reflects platform state as of July 2026
Based on: original TRAINING_GAP_MAP.md (2026-07-13) + re-audit against replit.md, memory notes, onboarding track source docs
Date: 2026-07-21
Produced by: BA & Architect audit task (Task #1436)

---

# Training Gap Map V2

This document supersedes `TRAINING_GAP_MAP.md`. It re-audits every role's training needs against the current state of the platform (July 2026) and marks all gaps that have been filled by the new guides produced in this task.

---

## How to Read This Document

**Gap status key:**

| Status | Meaning |
|---|---|
| COVERED | Sufficient documentation exists in `docs/` |
| NEWLY_COVERED | Gap identified in V1 map; covered by a new guide produced in this audit |
| PARTIALLY_COVERED | Some documentation exists but is incomplete, outdated, or too narrow |
| GAP | No adequate documentation exists for this need |
| OUT_OF_SCOPE | Not a documentation gap; handled by another mechanism |

---

## Changes Since V1 (2026-07-13)

The following platform changes occurred between V1 and this audit that affect documentation coverage:

1. **Executive role** — the `executive` role was added after V1. `executive-onboarding-track-source.md` was already written, and `executive-guide-dashboards.md` is now produced.
2. **Salary advance manual recording** — the "Record for Employee" flow was confirmed in `hr-admin-onboarding-track-source.md` Topic 5 and is now also covered in `hr-admin-guide-payroll-run.md`.
3. **My Team sidebar navigation** — V1 noted this as a gap. Now covered in `manager-guide-my-team-nav.md` and `manager-onboarding-track-source.md` Topic 1.
4. **Offer letter manager guide** — V1 noted manager-specific offer letter guidance was missing. Now covered in `manager-guide-offer-letters.md`.
5. **Feature flag `studio_v2_enabled`** — added after V1. Now covered in `hr-admin-guide-feature-flags.md`.
6. **Employee onboarding doc review** — `employee-onboarding-track-source.md` was reviewed. LWP rules, break policy, session timeout, and compliance lock grace period are all current and accurate. No stale sections found.

---

## Persona 1: New Developer (Backend / Full-Stack)

| Need | Documentation Available | Gap Status | Notes |
|---|---|---|---|
| System architecture overview | `docs/platform/SYSTEM_LANDSCAPE.md` | COVERED | |
| Database schema understanding | `docs/architecture/DATABASE_ARCHITECTURE.md`, `DATABASE_DATA_DICTIONARY.md` | COVERED | |
| Authentication and RBAC implementation | `docs/architecture/AUTH_RBAC_SECURITY.md` | COVERED | |
| How to add a new database table | None | GAP | High-risk gap unchanged. Schema mutation workflow (add table / add column / db:push safely) still lacks a developer runbook. |
| How to add a new feature flag | None | GAP — partial mitigation | `hr-admin-guide-feature-flags.md` covers the HR perspective. The three-place engineering rule is documented in memory notes and `replit.md` but no developer runbook exists. |
| How to add a new notification type | None | GAP | No guide for `shared/notificationTypes.ts` registration pattern. |
| How to run the server locally | `replit.md` | PARTIALLY_COVERED | `npm run dev` documented. No troubleshooting guide. |
| How to run tests | None | GAP | `node:test` vs. vitest confusion risk unchanged. |
| External integrations | `docs/architecture/INTEGRATIONS_AND_DEPENDENCIES.md` | COVERED | |
| State machines for core workflows | `docs/workflows/WORKFLOW_STATE_MACHINES.md` | COVERED | |
| Business rules for payroll computation | `docs/workflows/BUSINESS_RULES_CATALOGUE.md` | COVERED | |
| Centralized access control flag | `docs/architecture/AUTH_RBAC_SECURITY.md` | COVERED | |
| Production deployment process | None | GAP | No guide for safe promotion to production. |
| Content Studio AI pipeline | None | GAP | No developer-facing guide for AI generation service. |
| Codebase navigation / module structure | None | GAP | No guide for where to find routes or how services are organized. |

**Developer gap severity: HIGH — unchanged.** Schema mutation workflow and test runner gaps remain the highest-risk unresolved items.

---

## Persona 2: HR Administrator

| Need | Documentation Available | Gap Status | Notes |
|---|---|---|---|
| Generating an offer letter | `hr-admin-guide-offer-letters.md` (NEW) | NEWLY_COVERED | Full workflow: generate → approve → send → countersign → onboard |
| Approving / rejecting offer letters | `hr-admin-guide-offer-letters.md` (NEW) | NEWLY_COVERED | Approval flow, status meanings, countersign |
| Processing a salary advance (manual record) | `hr-admin-onboarding-track-source.md` Topic 5 | COVERED | Advance vs. overpayment, disbursed status, audit trail |
| Generating a monthly payroll run | `hr-admin-guide-payroll-run.md` (NEW) | NEWLY_COVERED | Full cycle: attendance → generate → review → approve → dispatch → confirm |
| Configuring leave types and accrual | `hr-admin-guide-leave-balance.md` (NEW) | NEWLY_COVERED | Leave type config, EL/SL accrual rates, LWP rules, year-end |
| Issuing HR letters and amendment letters | `hr-admin-guide-hr-letters.md` (NEW) | NEWLY_COVERED | All letter types, controlled wording, verification, revocation |
| Managing SOP compliance | `hr-admin-guide-sop-wave.md` (NEW) | NEWLY_COVERED | Publishing, wave rollout, soft/measured/full enforcement, compliance lock |
| Understanding feature flags | `hr-admin-guide-feature-flags.md` (NEW) | NEWLY_COVERED | Every flag, what OFF does, risks |
| Configuring Rayo Academy credentials | `docs/training/rayo-academy-blueprint.md` | PARTIALLY_COVERED | Blueprint describes Rayo Academy; admin-facing config guide for API URL/key still missing |
| Leave balance adjustments | `hr-admin-guide-leave-balance.md` (NEW) | NEWLY_COVERED | Manual adjustment, LWP recording, year-end carry-forward/lapse |
| Attendance report generation and approval | None | GAP | No guide for the attendance report run workflow, is_active flag, additive auto-sync. PARTIALLY covered by payroll run prerequisite in `hr-admin-guide-payroll-run.md`. |
| SendGrid sender configuration | `docs/ops/sendgrid-sender-verification.md` | PARTIALLY_COVERED | Technical verification record; not an HR-facing operational guide |

**HR administrator gap severity: MEDIUM** (reduced from HIGH). All core operational workflows now have dedicated guides. Remaining gaps are Rayo Academy configuration and attendance report workflow.

---

## Persona 3: Manager

| Need | Documentation Available | Gap Status | Notes |
|---|---|---|---|
| Approving team leave requests | `manager-guide-leave-approval.md` (NEW) | NEWLY_COVERED | Full approval flow, LWP implications, half-day, rejection, 3-day window |
| Managing employee plans (probation, growth, PIP) | `manager-guide-employee-plans.md` (NEW) | NEWLY_COVERED | 8-milestone cadence, check-in types, outcomes, escalation |
| Creating an offer letter | `manager-guide-offer-letters.md` (NEW) | NEWLY_COVERED | Generation, pending_approval reason, tracking, post-acceptance |
| Viewing and correcting team attendance | `manager-guide-attendance-correction.md` (NEW) | NEWLY_COVERED | Team view, correction vs. regularization, 3-day window |
| Understanding team training compliance | `hr-admin-onboarding-track-source.md` Topic 4 | PARTIALLY_COVERED | SOP compliance in HR source. No dedicated manager-facing guide for training progress tracking. |
| Requesting salary advance approvals | None | GAP — low priority | Manager approval flow from the manager's perspective. Candidate for a future guide. |
| Understanding My Team tab structure | `manager-guide-my-team-nav.md` (NEW) | NEWLY_COVERED | Sidebar sub-nav, Team/Corrections/Plans, status badges |

**Manager gap severity: LOW** (reduced from MEDIUM-HIGH). All primary task guides are now written. Remaining gaps are low-priority edge cases.

---

## Persona 4: Employee (Self-Service)

| Need | Documentation Available | Gap Status | Notes |
|---|---|---|---|
| How to punch in and out | `employee-onboarding-track-source.md` Topic 4 | COVERED | Time Card UI — action-first |
| Break tracking policy | `employee-onboarding-track-source.md` Topic 4 | COVERED | 1 lunch (30min), 2 tea (15min each), soft warnings |
| Leave application and LWP | `employee-onboarding-track-source.md` Topic 2 | COVERED | EL/SL/LWP rules, scenario, knowledge check |
| Training and SOP compliance lock | `employee-onboarding-track-source.md` Topic 3 | COVERED | Lock conditions, grace period, resolution, exceptions |
| Understanding the Rayo Academy integration | `docs/training/rayo-academy-blueprint.md` | PARTIALLY_COVERED | Blueprint is technical spec; no employee-facing guide. Low risk. |
| Salary advance request | `employee-onboarding-track-source.md` Topic 5 | COVERED | Request flow, approval timeline, recovery, manual recording fallback |

**Employee gap severity: LOW** (unchanged). The employee onboarding doc was reviewed and found to be current and accurate. No stale sections identified.

### Employee Onboarding Doc Review Findings (2026-07-21)

Reviewed `employee-onboarding-track-source.md` against current system behavior:

| Section | Assessment | Notes |
|---|---|---|
| Topic 1: Login / 2FA | CURRENT | 30-minute session timeout confirmed; 2FA mandatory confirmed |
| Topic 2: Leave Rules / LWP | CURRENT | 128-hour accrual trigger confirmed; LWP split behavior confirmed |
| Topic 3: Compliance Lock | CURRENT | 15-day grace period confirmed; `full` enforcement requirement confirmed |
| Topic 4: Punch In / Break Tracking | CURRENT | 1 lunch × 30min, 2 tea × 15min confirmed; 3-day correction window confirmed |
| Topic 5: Salary Advance | CURRENT | One active advance at a time confirmed; super_admin escalation at 50% confirmed; manual recording fallback confirmed |

No updates required to `employee-onboarding-track-source.md`.

---

## Persona 5: New Hire Candidate

| Need | Documentation Available | Gap Status | Notes |
|---|---|---|---|
| How to accept an offer letter | `candidate-onboarding-track-source.md` Topic 1 | COVERED | Post-acceptance sequence documented |
| What happens after acceptance | `candidate-onboarding-track-source.md` Topics 1–5 | COVERED | Full pre-start timeline covered |
| Document verification for issued letters | `candidate-onboarding-track-source.md` Topic 4 | COVERED | `/verify` page documented |

**Candidate gap severity: NONE** — all candidate gaps from V1 have been addressed.

---

## Persona 6: Executive / Finance

| Need | Documentation Available | Gap Status | Notes |
|---|---|---|---|
| Executive dashboard navigation | `executive-guide-dashboards.md` (NEW) | NEWLY_COVERED | Cockpit panels, navigation, read-only scope |
| Reading payroll reports | `executive-guide-dashboards.md` (NEW) | NEWLY_COVERED | Deduction types, approval flow, dispatch rules |
| Governance controls and obligations | `executive-guide-dashboards.md` (NEW) | NEWLY_COVERED | Control Tower, status meanings, automated changes tab |
| Statutory report generation | `executive-guide-dashboards.md` (NEW) | NEWLY_COVERED | Statutory export, timing, filing preconditions |

**Executive gap severity: NONE** — all executive gaps from V1 have been addressed.

---

## Remaining High-Priority Gaps

The following gaps from V1 remain open. They are **developer-facing** and are out of scope for this task (content-only, no code changes).

| Priority | Persona | Gap | Risk | Recommended next step |
|---|---|---|---|---|
| 1 | Developer | Schema mutation workflow (add table / add column / db:push safely) | Production data loss if done incorrectly | Developer runbook — schema safety |
| 2 | Developer | How to add a feature flag correctly (three-place rule) | Feature silently OFF with no error | Developer runbook — feature flags and notification types |
| 3 | Developer | How to run tests (node:test vs. vitest) | Wrong test runner gives false results | Developer runbook — test runner |
| 4 | Developer | Production deployment process | Schema drift to prod | Developer runbook — production release |
| 5 | Developer | Codebase navigation / module structure | Slow onboarding | Developer onboarding guide |
| 6 | HR Admin | Attendance report generation workflow | LOP discrepancies in payroll | Attendance report operations guide |

---

## New Documents Produced (This Task)

| File | Audience | Coverage |
|---|---|---|
| `hr-admin-guide-offer-letters.md` | hr, admin, manager | Full offer letter lifecycle, approval flow, countersign, onboard, status meanings |
| `hr-admin-guide-payroll-run.md` | hr, admin, executive | Full payroll run cycle, LOP mode, advance recovery, error handling |
| `hr-admin-guide-leave-balance.md` | hr, admin | Leave type config, EL/SL accrual, LWP mechanics, year-end, manual adjustments |
| `hr-admin-guide-hr-letters.md` | hr, admin, manager | All letter types, controlled wording, issue/revoke/re-issue, public verification |
| `hr-admin-guide-sop-wave.md` | hr, admin, manager | SOP publishing, wave assignment, enforcement levels, compliance lock management |
| `hr-admin-guide-feature-flags.md` | super_admin, hr | All 8 feature flags, toggle risks, checklist |
| `manager-guide-leave-approval.md` | manager, hr, admin | Approval flow, LWP split, half-day, rejection, 3-day reversal window |
| `manager-guide-employee-plans.md` | manager, hr, admin | Probation 8-milestone cadence, check-in types, outcomes, PIP, growth plans, escalation |
| `manager-guide-attendance-correction.md` | manager, hr, admin | Team attendance view, correction vs. regularization, 3-day window, audit trail |
| `manager-guide-my-team-nav.md` | manager | Sidebar sub-nav structure, Team/Corrections/Plans views, status badges, scope |
| `manager-guide-offer-letters.md` | manager | Creating offers, pending_approval reason, tracking, post-acceptance, cancellation |
| `executive-guide-dashboards.md` | executive, finance | Cockpit navigation, payroll run reading, statutory deductions, Control Tower |
