Status: Updated — reflects platform state as of July 2026
Last updated: 2026-07-21 (BA & Architect audit task — added 12 new training guides)
Original date: 2026-07-13
Unresolved items: 1 — see OWNER_REVIEW_REQUIRED section at end

---

# Existing Guides Index

This document is a comprehensive catalogue of all documentation and reference materials that exist within the `docs/` directory of the repository. It covers audience, purpose, coverage, and assessed quality of each document.

---

## Document Inventory

### docs/ai-governance-audit/GOVERNANCE-MVP-READINESS.md

**Title:** Governance MVP — Readiness Scan
**Type:** Code inspection audit report
**Date:** 2026-07-13
**Audience:** Technical leads, product managers, governance owners

**What it covers:** Employee-manager hierarchy; workflow status fields; notification vs. action completion; auditability of probation, PIP, and manager check-ins; AI Privacy.

**Overall verdict:** CLEARED TO BUILD MVP — no blocker items.

**Coverage quality:** High. All claims traced to specific files and line numbers.

**Gaps:** Does not cover the performance management module added after the audit date.

---

### docs/ops/sendgrid-sender-verification.md

**Title:** SendGrid Sender Verification — alina.carter@hire-in.com
**Type:** Operations runbook / verification record
**Date:** 2026-05-01
**Audience:** Operations, IT administrators

**What it covers:** Domain authentication status for `hire-in.com` on SendGrid; confirmed sender `alina.carter@hire-in.com`; DKIM records; test send evidence.

**Coverage quality:** High for its narrow scope.

**Gaps:** Does not document `SENDGRID_API_KEY_NEW` env var, API key rotation procedure, or domain authentication expiry.

---

### docs/training/rayo-academy-blueprint.md

**Title:** Rayo Academy — Architecture Blueprint & Build Plan
**Type:** Technical architecture specification / integration design
**Version:** 1.0 | April 2026
**Audience:** Rayo Academy development team, Hire'in integration engineers

**What it covers:** System separation architecture; source-of-truth boundaries; authentication and linking; recommended tech stack; capability matrix; auth flow; data model; public API spec; certificate engine; manager capabilities; learner experience; content structure; phased build roadmap.

**Coverage quality:** High for its purpose as a design specification.

**Gaps:** Reflects planned state of Rayo Academy, not actual current implementation state. The thin-client integration in `server/rayoAcademyClient.ts` implements only a subset.

---

### docs/platform/SYSTEM_LANDSCAPE.md

**Title:** System Landscape
**Type:** Platform reference
**Date:** 2026-07-13
**Audience:** Technical leads, developers, operations
**Coverage:** Technology stack, service verticals, external integrations, system context diagram.

---

### docs/platform/PRODUCT_CAPABILITY_MAP.md

**Title:** Product Capability Map
**Type:** Feature reference
**Date:** 2026-07-13
**Audience:** Product managers, developers, business analysts
**Coverage:** All platform capabilities organized by domain, with access roles, routes, database tables, and status.

---

### docs/architecture/AUTH_RBAC_SECURITY.md

**Title:** Authentication, RBAC & Security Reference
**Type:** Technical reference
**Date:** 2026-07-13
**Audience:** Developers, security reviewers
**Coverage:** Role capability matrix, login flows, session management, TOTP, password handling, centralized access control flag, v2 UI gate.

---

### docs/architecture/DATABASE_ARCHITECTURE.md

**Title:** Database Architecture
**Type:** Technical reference
**Date:** 2026-07-13
**Audience:** Developers
**Coverage:** Platform, ORM, connection approach, migration system, domain table groups with full table roster.

---

### docs/architecture/DATABASE_DATA_DICTIONARY.md

**Title:** Database Data Dictionary
**Type:** Technical reference
**Date:** 2026-07-13
**Audience:** Developers, business analysts
**Coverage:** All platform enums with value definitions, key table field definitions with business meaning, notable schema constraints.

---

### docs/architecture/INTEGRATIONS_AND_DEPENDENCIES.md

**Title:** Integrations and External Dependencies
**Type:** Technical reference
**Date:** 2026-07-13
**Audience:** Developers, operations
**Coverage:** Ceipal ATS, SendGrid, Google Cloud Storage, Rayo Academy, Replit Auth, Replit AI Integrations, PostgreSQL. Auth methods, failure behavior, data sensitivity, retry behavior.

---

### docs/workflows/BUSINESS_RULES_CATALOGUE.md

**Title:** Business Rules Catalogue
**Type:** Business reference
**Date:** 2026-07-13
**Audience:** Developers, business analysts, HR admins
**Coverage:** Leave rules, attendance rules, India statutory payroll rules, salary advance rules, offer letter rules, SOP compliance rules, session/security rules, feature flag rules, notification gateway rules.

---

### docs/workflows/WORKFLOW_STATE_MACHINES.md

**Title:** Workflow State Machines
**Type:** Business reference
**Date:** 2026-07-13
**Audience:** Developers, business analysts
**Coverage:** 15 state machines including offer letter, leave request, attendance, salary advance, payroll run, SOP, SOP employee progress, employee plan, performance goal, training assignment, check-in, HR letter, contract, governance control, and help desk ticket.

---

### docs/qa/DECISION_COVERAGE_MAP.md

**Title:** Decision Coverage Map
**Type:** QA reference
**Date:** 2026-07-13
**Audience:** QA engineers, developers
**Coverage:** 59 decision points across 9 domains mapped against test coverage. Current state: 0 automated tests confirmed, 11 decisions covered by governance documents, 43 manual-only.

---

### docs/training/TRAINING_GAP_MAP.md

**Title:** Training Gap Map (V1)
**Type:** Training gap analysis
**Date:** 2026-07-13
**Audience:** HR, product managers, architects
**Coverage:** Gaps in documentation coverage mapped to onboarding role personas.
**Note:** Superseded by `TRAINING_GAP_MAP_V2.md` (2026-07-21).

---

### docs/training/TRAINING_GAP_MAP_V2.md *(NEW — 2026-07-21)*

**Title:** Training Gap Map V2
**Type:** Training gap analysis (updated)
**Date:** 2026-07-21
**Audience:** HR, product managers, architects

**What it covers:** Re-audit of all role training needs against July 2026 platform state. Marks all gaps filled by new guides. Records employee onboarding doc review findings (all sections current). Identifies remaining developer-facing gaps for future runbooks.

**Summary of changes from V1:**
- HR Admin severity reduced from HIGH → MEDIUM (all core workflows now documented)
- Manager severity reduced from MEDIUM-HIGH → LOW (all primary task guides written)
- Executive severity reduced from MEDIUM → NONE (all executive gaps filled)
- Employee severity remains LOW (onboarding doc reviewed and confirmed current)
- Candidate severity: NONE (all gaps addressed)
- Developer severity remains HIGH (schema mutation, test runner, deployment gaps unchanged)

---

### docs/training/employee-onboarding-track-source.md

**Title:** Employee Onboarding — Training Track Source Material
**Type:** Training track source
**Date:** 2026-07-13 | Reviewed 2026-07-21 (no updates required)
**Audience:** All employees (role: `employee`)

**What it covers:** Login and 2FA setup; leave rules and LWP; training compliance lock; punch-in/break tracking; salary advance request.

**Review status (2026-07-21):** All 5 topics confirmed current. LWP rules, break allowances, session timeout (30min), and compliance lock grace period (15 days) are accurate.

---

### docs/training/manager-onboarding-track-source.md

**Title:** Manager Onboarding — Training Track Source Material
**Type:** Training track source
**Date:** 2026-07-13
**Audience:** Managers (role: `manager`)

**What it covers:** My Team navigation; approving leave requests; employee plans (probation/PIP/growth); attendance correction; generating offer letters.

---

### docs/training/hr-admin-onboarding-track-source.md

**Title:** HR Administrator Onboarding — Training Track Source Material
**Type:** Training track source
**Date:** 2026-07-13
**Audience:** HR administrators (roles: `hr`, `admin`, `super_admin`)

**What it covers:** Offer letter lifecycle; monthly payroll run; HR letters; SOP compliance management; manual salary advance recording; feature flags.

---

### docs/training/executive-onboarding-track-source.md

**Title:** Executive / Finance Onboarding — Training Track Source Material
**Type:** Training track source
**Date:** 2026-07-13
**Audience:** Finance and executive users (role: `executive`)

**What it covers:** Executive Cockpit navigation; reading payroll reports; governance controls and Control Tower; generating statutory reports.

---

### docs/training/candidate-onboarding-track-source.md

**Title:** Candidate: What Happens After Offer Acceptance — Training Track Source Material
**Type:** Training track source
**Date:** 2026-07-13
**Audience:** New hire candidates (post-acceptance, pre-Day 1)

**What it covers:** Post-acceptance sequence; first login and 2FA setup; required documents and bank details; offer letter verification; first week in the system.

---

## New Guides — HR Admin (Produced 2026-07-21)

### docs/training/hr-admin-guide-offer-letters.md *(NEW)*

**Title:** HR Admin Guide — Offer Letters
**Audience:** hr, admin, super_admin, manager (generation only)
**Summary:** Complete offer letter workflow — generate, pending_approval, approve, countersign, onboard. Status reference table. Common mistakes including why HR offers are not sent immediately.

---

### docs/training/hr-admin-guide-payroll-run.md *(NEW)*

**Title:** HR Admin Guide — Monthly Payroll Run
**Audience:** hr, admin, super_admin, executive
**Summary:** Full payroll run cycle: attendance finalization → generate → review → approve → send slips → confirm payments. LOP mode explanation. Advance recovery lock point. Error handling before and after approval.

---

### docs/training/hr-admin-guide-leave-balance.md *(NEW)*

**Title:** HR Admin Guide — Leave Balance Configuration and Management
**Audience:** hr, admin, super_admin
**Summary:** Leave type configuration, EL/SL accrual rates (EL: 15/yr, 128hr trigger; SL: 8/yr, after day 30), LWP mechanics and salary impact, year-end carry-forward and lapse rules, manual balance adjustments with audit trail.

---

### docs/training/hr-admin-guide-hr-letters.md *(NEW)*

**Title:** HR Admin Guide — HR Letters and Amendment Letters
**Audience:** hr, admin, super_admin
**Summary:** All letter types (Experience, Internship, Relieving; Amendment: Salary Revision, Designation/Promotion, Combined, Device Allocation). Controlled-wording restriction explanation. Issue/revoke/re-issue steps. Public verification at `/verify`. Reference number and auth code explained.

---

### docs/training/hr-admin-guide-sop-wave.md *(NEW)*

**Title:** HR Admin Guide — SOP Publishing and Wave Rollout
**Audience:** hr, admin, super_admin, operations, manager
**Summary:** Creating and publishing SOPs, wave assignment, enforcement levels (soft/measured/full), compliance lock mechanics, granting exceptions vs. extending due dates, 2-SOP/week cadence limit.

---

### docs/training/hr-admin-guide-feature-flags.md *(NEW)*

**Title:** HR Admin Guide — Feature Flags
**Audience:** super_admin (toggle), hr and admin (read/understand)
**Summary:** All 8 platform feature flags with what each one controls, what OFF does, what data is preserved, and when to use each toggle. Pre-toggle checklist. Quick reference table.

---

## New Guides — Manager (Produced 2026-07-21)

### docs/training/manager-guide-leave-approval.md *(NEW)*

**Title:** Manager Guide — Leave Approvals
**Audience:** manager, hr, admin, super_admin
**Summary:** Leave approval flow step-by-step. LWP split explanation with table examples. Half-day approvals. Weekend/holiday exclusion. Rejection with mandatory reason. 3-day reversal window (contact HR). Scope: own direct reports only.

---

### docs/training/manager-guide-employee-plans.md *(NEW)*

**Title:** Manager Guide — Employee Plans (Probation, PIP, Growth)
**Audience:** manager, hr, admin, super_admin
**Summary:** Probation 8-milestone cadence (Day 1/7/15/30/45/60/75/90). Formal milestone reviews at Day 30/60/90. PIP weekly cadence. Growth plan activation. Check-in completion steps. Outcome recording (passed/extended/failed/converted/terminated). Coaching log vs. check-in distinction. 3-strike escalation.

---

### docs/training/manager-guide-attendance-correction.md *(NEW)*

**Title:** Manager Guide — Attendance Correction
**Audience:** manager, hr, admin, super_admin
**Summary:** Team attendance view and status badges. Direct punch correction within 3-day window. Step-by-step correction form. Correction vs. regularization distinction. Help Desk path for out-of-window corrections. Audit trail behavior.

---

### docs/training/manager-guide-my-team-nav.md *(NEW)*

**Title:** Manager Guide — My Team Navigation
**Audience:** manager
**Summary:** Sidebar sub-navigation structure (not horizontal tabs). Three views: Team (roster + real-time status badges), Corrections (punch corrections), Plans (development plans). Scope explanation (manager_id field). Why zero employees appears and how to fix it.

---

### docs/training/manager-guide-offer-letters.md *(NEW)*

**Title:** Manager Guide — Offer Letters
**Audience:** manager
**Summary:** Creating an offer letter step-by-step. Why offers enter pending_approval (not sent immediately). Status tracking reference. What happens after candidate accepts (HR handles all post-acceptance steps). Cannot cancel sent offer — super_admin required. Rejected offer revision flow.

---

## New Guide — Executive (Produced 2026-07-21)

### docs/training/executive-guide-dashboards.md *(NEW)*

**Title:** Executive Guide — Dashboards, Payroll Reports, and Governance Controls
**Audience:** executive, finance
**Summary:** Executive Cockpit panels and navigation. Payroll run review and approval. Deduction type explanations (EPF, ESI, PT, LOP, Advance Recovery). Payroll Executive Dashboard for trends and statutory export. Governance Control Tower read-only navigation. Status meanings. Filing timing requirements.

---

## Coverage Summary (Updated 2026-07-21)

| Domain | Document | Coverage Level |
|---|---|---|
| AI governance and privacy | GOVERNANCE-MVP-READINESS.md | Good — narrow scope |
| Email delivery operations | sendgrid-sender-verification.md | Good — narrow scope |
| Rayo Academy integration design | rayo-academy-blueprint.md | Good — design spec only |
| System architecture overview | SYSTEM_LANDSCAPE.md | Covered |
| Product features and capabilities | PRODUCT_CAPABILITY_MAP.md | Covered |
| Authentication and security | AUTH_RBAC_SECURITY.md | Covered |
| Database schema | DATABASE_ARCHITECTURE.md + DATA_DICTIONARY.md | Covered |
| External integrations | INTEGRATIONS_AND_DEPENDENCIES.md | Covered |
| Business rules | BUSINESS_RULES_CATALOGUE.md | Covered |
| State machines | WORKFLOW_STATE_MACHINES.md | Covered |
| QA and test coverage | DECISION_COVERAGE_MAP.md | Covered (gap analysis) |
| HR Admin — offer letters | hr-admin-guide-offer-letters.md (NEW) | Now covered |
| HR Admin — payroll run | hr-admin-guide-payroll-run.md (NEW) | Now covered |
| HR Admin — leave balance | hr-admin-guide-leave-balance.md (NEW) | Now covered |
| HR Admin — HR letters | hr-admin-guide-hr-letters.md (NEW) | Now covered |
| HR Admin — SOP wave rollout | hr-admin-guide-sop-wave.md (NEW) | Now covered |
| HR Admin — feature flags | hr-admin-guide-feature-flags.md (NEW) | Now covered |
| Manager — leave approvals | manager-guide-leave-approval.md (NEW) | Now covered |
| Manager — employee plans | manager-guide-employee-plans.md (NEW) | Now covered |
| Manager — attendance correction | manager-guide-attendance-correction.md (NEW) | Now covered |
| Manager — My Team navigation | manager-guide-my-team-nav.md (NEW) | Now covered |
| Manager — offer letters | manager-guide-offer-letters.md (NEW) | Now covered |
| Executive — dashboards and governance | executive-guide-dashboards.md (NEW) | Now covered |
| Developer onboarding | None | Gap — see TRAINING_GAP_MAP_V2.md |
| Attendance report operations | None | Gap — see TRAINING_GAP_MAP_V2.md |
| API reference | None | Gap — see TRAINING_GAP_MAP_V2.md |
| Incident response / runbooks | sendgrid-sender-verification.md only | Large gap |
| Data migration procedures | None (replit.md notes only) | Gap |

---

## Pre-existing Documents — Notes and Caveats

`UNABLE_TO_CONFIRM — OWNER REVIEW REQUIRED`: Beyond the files catalogued above, there may be additional documentation in external systems (Notion, Confluence, Google Drive, Jira) that was not discoverable from the repository alone. This index covers only files present in the `docs/` directory of the codebase.

The `replit.md` file (project root) serves as a high-level architecture reference and is also treated as a documentation source; it is not catalogued here as a training document because it is a living internal spec, not a human-facing guide.
