Status: Current-state automated system reference
Generated from: code, schema, routes, configuration, and existing documents
Date: 2026-07-13
Human approval required: Yes — for all UNABLE_TO_CONFIRM items listed within
Unresolved items: 1 — see OWNER_REVIEW_REQUIRED sections within

---

# Existing Guides Index

This document is a comprehensive catalogue of all documentation and reference materials that exist within the `docs/` directory of the repository as of the generation date. It covers audience, purpose, coverage, and assessed quality of each document.

---

## Document Inventory

### docs/ai-governance-audit/GOVERNANCE-MVP-READINESS.md

**Title:** Governance MVP — Readiness Scan  
**Type:** Code inspection audit report  
**Date:** 2026-07-13  
**Author:** AI Agent (pre-build audit)  
**Audience:** Technical leads, product managers, governance owners  
**Status:** Current — verified against commit `e5d21b2`

**What it covers:**
1. Employee-manager hierarchy: schema design, ORM relations, server-side enforcement, limitations of the ORM-only `managerId` FK.
2. Workflow status fields for goals, check-ins, training, SOPs, probation, and PIP — including field names, enum values, and completion evidence columns.
3. Notification vs. action completion: how notification delivery and action completion are tracked as structurally separate states, and the absence of a closed-loop action record.
4. Auditability of probation, PIP, and manager check-ins: what can and cannot be reconstructed from `audit_logs`. Identifies the critical gap: old values are not captured on update.
5. AI Privacy — employee PII in prompts: confirms no automatic PII injection into AI call sites; documents the two minor residual risks (git commit messages, chat guardrail).

**Classification per section:**

| Section | Classification |
|---|---|
| Employee-Manager Hierarchy | READY |
| Workflow Status | READY_WITH_MINOR_GAP |
| Notification vs. Action | READY_WITH_MINOR_GAP |
| Auditability | NEEDS_EXTENSION |
| AI Privacy | READY_WITH_MINOR_GAP |

**Overall verdict:** CLEARED TO BUILD MVP — no blocker items.

**Coverage quality:** High. All claims are traced to specific files and line numbers. Four prioritized action items are produced with implementation guidance.

**Gaps:** Does not cover the performance management module added after the audit date; audit scope was governance-specific and does not cover payroll, leave, or recruitment decision logic.

---

### docs/ops/sendgrid-sender-verification.md

**Title:** SendGrid Sender Verification — alina.carter@hire-in.com  
**Type:** Operations runbook / verification record  
**Date:** 2026-05-01  
**Author:** AI Agent  
**Audience:** Operations, IT administrators  
**Status:** Current — verification confirmed as of 2026-05-01

**What it covers:**
- Confirmation that domain authentication is active for `hire-in.com` on SendGrid (subdomain `em8882`, DKIM s1 and s2, automatic security).
- Evidence of successful email delivery (`alina.carter@hire-in.com` → `delivered`).
- SendGrid domain ID and CNAME values.
- Evidence of a successful test send.

**Coverage quality:** High for its narrow scope. Sufficient as a verification record for `alina.carter@hire-in.com` as an authorized sender. Does not cover other aspects of SendGrid configuration (suppression lists, event webhooks, API key rotation policy).

**Gaps:** Does not document the `SENDGRID_API_KEY_NEW` environment variable name, API key rotation procedure, or what happens if domain authentication expires.

---

### docs/training/rayo-academy-blueprint.md

**Title:** Rayo Academy — Architecture Blueprint & Build Plan  
**Type:** Technical architecture specification / integration design  
**Version:** 1.0 | April 2026  
**Audience:** Rayo Academy development team, Hire'in integration engineers  
**Status:** Current for integration specification; build roadmap sections may be partially complete

**What it covers:**
1. System separation architecture: two independent apps (Hire'in and Rayo Academy) communicating via REST API. Neither has direct DB access to the other.
2. Source-of-truth boundaries: Hire'in owns employee records, plans, goals; Rayo Academy owns training content, quizzes, certificates, progress.
3. Authentication and linking: employees linked by email address across systems. Rayo Academy uses email/password auth after initial provisioning from Hire'in.
4. Recommended technology stack for Rayo Academy (React 18, TypeScript, Vite, Tailwind, Drizzle, PostgreSQL, SendGrid).
5. Capability matrix: what each system does and does not do.
6. Auth flow specification: how API key authentication works between the systems.
7. Data model: Rayo Academy schema recommendations (courses, tracks, modules, quizzes, attempts, certificates).
8. Public API specification for the Hire'in integration (provision-user, assign-track, get-progress, deactivate endpoints).
9. Certificate engine requirements.
10. Manager capabilities in Rayo Academy.
11. Learner experience design.
12. Content structure and migration mapping.
13. Phased build roadmap.

**Coverage quality:** High for its purpose as a design specification. Very detailed API surface and data model. Serves as both a requirements document and an integration contract.

**Gaps:** Document reflects the planned/designed state of Rayo Academy, not the actual current implementation state of Rayo Academy (which is an external system). The thin-client integration in Hire'in (`server/rayoAcademyClient.ts`) implements only a subset of the API described in this blueprint. The blueprint's API spec may have evolved since April 2026.

---

### docs/platform/SYSTEM_LANDSCAPE.md (NEW — this session)

**Title:** System Landscape  
**Type:** Platform reference  
**Date:** 2026-07-13  
**Coverage:** Technology stack, service verticals, external integrations, system context diagram. See file for details.

---

### docs/platform/PRODUCT_CAPABILITY_MAP.md (NEW — this session)

**Title:** Product Capability Map  
**Type:** Feature reference  
**Date:** 2026-07-13  
**Coverage:** All platform capabilities organized by domain, with access roles, routes, database tables, and status. See file for details.

---

### docs/architecture/AUTH_RBAC_SECURITY.md (NEW — this session)

**Title:** Authentication, RBAC & Security Reference  
**Type:** Technical reference  
**Date:** 2026-07-13  
**Coverage:** Role capability matrix, login flows, session management, TOTP, password handling, centralized access control flag, v2 UI gate. See file for details.

---

### docs/architecture/DATABASE_ARCHITECTURE.md (NEW — this session)

**Title:** Database Architecture  
**Type:** Technical reference  
**Date:** 2026-07-13  
**Coverage:** Platform, ORM, connection approach, migration system, domain table groups with full table roster. See file for details.

---

### docs/architecture/DATABASE_DATA_DICTIONARY.md (NEW — this session)

**Title:** Database Data Dictionary  
**Type:** Technical reference  
**Date:** 2026-07-13  
**Coverage:** All platform enums with value definitions, key table field definitions with business meaning, notable schema constraints. See file for details.

---

### docs/architecture/INTEGRATIONS_AND_DEPENDENCIES.md (NEW — this session)

**Title:** Integrations and External Dependencies  
**Type:** Technical reference  
**Date:** 2026-07-13  
**Coverage:** Ceipal ATS, SendGrid, Google Cloud Storage, Rayo Academy, Replit Auth, Replit AI Integrations, PostgreSQL. Auth methods, failure behavior, data sensitivity, retry behavior. See file for details.

---

### docs/workflows/BUSINESS_RULES_CATALOGUE.md (NEW — this session)

**Title:** Business Rules Catalogue  
**Type:** Business reference  
**Date:** 2026-07-13  
**Coverage:** Leave rules, attendance rules, India statutory payroll rules, salary advance rules, offer letter rules, SOP compliance rules, session/security rules, feature flag rules, notification gateway rules. See file for details.

---

### docs/workflows/WORKFLOW_STATE_MACHINES.md (NEW — this session)

**Title:** Workflow State Machines  
**Type:** Business reference  
**Date:** 2026-07-13  
**Coverage:** 15 state machines including offer letter, leave request, attendance, salary advance, payroll run, SOP, SOP employee progress, employee plan, performance goal, training assignment, check-in, HR letter, contract, governance control, and help desk ticket. See file for details.

---

### docs/qa/DECISION_COVERAGE_MAP.md (NEW — this session)

**Title:** Decision Coverage Map  
**Type:** QA reference  
**Date:** 2026-07-13  
**Coverage:** 59 decision points across 9 domains mapped against test coverage. Current state: 0 automated tests confirmed, 11 decisions covered by governance documents, 43 manual-only. Priority test targets identified. See file for details.

---

### docs/training/EXISTING_GUIDES_INDEX.md (THIS DOCUMENT)

**Title:** Existing Guides Index  
**Type:** Training and onboarding reference  
**Date:** 2026-07-13

---

### docs/training/TRAINING_GAP_MAP.md (NEW — this session)

**Title:** Training Gap Map  
**Type:** Training and onboarding reference  
**Date:** 2026-07-13  
**Coverage:** Gaps in documentation coverage mapped to onboarding role personas. See file for details.

---

## Coverage Summary

| Domain | Existing Document | Coverage Level |
|---|---|---|
| AI governance and privacy | GOVERNANCE-MVP-READINESS.md | Good — narrow scope (governance MVP only) |
| Email delivery operations | sendgrid-sender-verification.md | Good — narrow scope (sender verification only) |
| Rayo Academy integration design | rayo-academy-blueprint.md | Good — design spec; actual implementation state unclear |
| System architecture overview | SYSTEM_LANDSCAPE.md (new) | Now covered |
| Product features and capabilities | PRODUCT_CAPABILITY_MAP.md (new) | Now covered |
| Authentication and security | AUTH_RBAC_SECURITY.md (new) | Now covered |
| Database schema | DATABASE_ARCHITECTURE.md + DATA_DICTIONARY.md (new) | Now covered |
| External integrations | INTEGRATIONS_AND_DEPENDENCIES.md (new) | Now covered |
| Business rules | BUSINESS_RULES_CATALOGUE.md (new) | Now covered |
| State machines | WORKFLOW_STATE_MACHINES.md (new) | Now covered |
| QA and test coverage | DECISION_COVERAGE_MAP.md (new) | Now covered (gap analysis) |
| Developer onboarding | None | Gap — see TRAINING_GAP_MAP.md |
| HR/manager user guides | None | Gap — see TRAINING_GAP_MAP.md |
| API reference | None | Gap — see TRAINING_GAP_MAP.md |
| Incident response / runbooks | sendgrid-sender-verification.md only | Large gap |
| Data migration procedures | None (only replit.md notes) | Gap |
| Security incident response | None | Gap |

---

## Pre-existing Documents — Notes and Caveats

`UNABLE_TO_CONFIRM — OWNER REVIEW REQUIRED`: Beyond the files catalogued above, there may be additional documentation in external systems (Notion, Confluence, Google Drive, Jira) that was not discoverable from the repository alone. This index covers only files present in the `docs/` directory of the codebase.

The `replit.md` file (project root) serves as a high-level architecture reference and is also treated as a documentation source; it is not catalogued here as a training document because it is a living internal spec, not a human-facing guide.
