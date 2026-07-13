# Feature Tiers — P0 to P3

This document is the authoritative prioritization reference for Hire'in Solutions. Every feature is assigned a tier that governs regression priority, release gate decisions, and QA regression scope. Refer to this document when writing acceptance criteria, planning a sprint, or deciding what to test after a merge.

---

## Tier Definitions

**P0 — System Integrity.** Broken means data loss, payroll errors, or compliance failure. A P0 defect is a production blocker. No release ships with a known P0 regression.

**P1 — Daily Critical.** Used by most personas every working day. A P1 defect is a high-severity bug requiring a hotfix within one business day.

**P2 — Important but not daily.** Core to the product but used weekly or monthly. A P2 defect is scheduled in the next sprint.

**P3 — Valuable but non-critical.** Nice to have, used occasionally or by power users. A P3 defect is backlogged.

---

## MLP — Minimum Loveable Product

The MLP is the irreducible core. If any MLP feature is broken, the platform is unusable or embarrassing to operate. QA must execute a full MLP regression before every production release.

The MLP consists of exactly five capabilities:

1. **Employee attendance** — punch in, punch out, break tracking. Employees cannot record their working time without this.
2. **Leave management** — apply for leave, manager approve or reject, balance deduction. Core HR compliance.
3. **Payslip generation** — monthly salary slip PDF with statutory deductions. Payroll is a legal obligation.
4. **Offer letter flow** — generate, manager submit, CEO/admin approve, candidate e-sign, HR countersign, onboarding trigger. This is the entry gate for every new hire.
5. **Public job board** — live job listings synced from Ceipal ATS. This is the external face of the business.

---

## Feature Tier Table

| Feature | Module | Tier | Primary Personas | Breaks what if down | Owner role |
|---|---|---|---|---|---|
| Payroll computation engine (India statutory: PF/ESI/PT/TDS) | Payroll | P0 | hr, executive, finance | Incorrect statutory deductions, compliance violation | hr, executive |
| Salary advance recovery in payroll run | Payroll | P0 | hr, executive | Over- or under-recovery from net pay; financial data corruption | hr, executive |
| Attendance absent sweep (nightly cron at 01:30 IST) | Attendance | P0 | hr | Employees never marked absent; LWP never applied; payroll LOP wrong | hr |
| Session authentication (email/password + bcrypt) | Auth | P0 | all | No one can log in | super_admin |
| Mandatory TOTP 2FA | Auth | P0 | all | Auth bypass vulnerability | super_admin |
| Schema drift guard (`scripts/check-schema-drift.sh`) | Infrastructure | P0 | engineering | Silent column deletion on `db:push`; data loss in production | super_admin |
| Offer letter e-sign + countersign chain | Letters & Documents | P0 | manager, hr, candidate | Legally unenforceable employment agreements | hr, admin |
| Cryptographic hash on letter PDF (`/verify`) | Letters & Documents | P0 | hr, public | Tampered letters pass verification; compliance and legal risk | hr |
| Salary structure assignment and slip PDF generation | Payroll | P0 | hr, executive | Employees receive no payslip; payroll records missing | hr, executive |
| Leave balance deduction after approval | Leave | P0 | hr, manager | Balances go negative silently; payroll LOP incorrect | hr, manager |
| Punch in / punch out (attendance time card) | Attendance | P1 | employee | Employees cannot record attendance | employee |
| Break tracking (Lunch 30 min, Tea 2x15 min) | Attendance | P1 | employee | Break time unrecorded; no manager break visibility | employee |
| Leave application (employee self-service) | Leave | P1 | employee | Employees cannot take leave through the system | employee |
| Leave approval / rejection (manager) | Leave | P1 | manager, hr | Leave requests pile up unapproved; employees blocked | manager |
| Manager team attendance view | Attendance | P1 | manager | Managers cannot monitor team presence | manager |
| Salary slip download (employee) | Payroll | P1 | employee | Employees cannot access pay records | employee |
| In-app notifications (unread badge + list) | Notifications | P1 | all | Users miss time-sensitive alerts | admin, hr |
| HR Letter Generator (experience, internship, relieving) | Letters & Documents | P1 | hr | HR cannot issue employee documentation | hr |
| Email delivery via SendGrid | Email | P1 | all | No transactional emails sent (invites, leave decisions, letters) | super_admin |
| 30-minute auto session timeout with warning | Auth | P1 | all | Sessions never expire; security risk | super_admin |
| New Hire section — Offer Letters dashboard | New Hire | P1 | hr, manager, admin | Offer pipeline invisible to approvers | hr |
| New Hire section — Onboarding status tab | New Hire | P1 | hr, admin | Onboarding progress not tracked | hr |
| Employee exit statuses (Relieved / Left Company) | People | P1 | hr, admin | Termination workflow broken; system treats leavers as active | hr |
| Payroll run draft → send → disburse flow | Payroll | P1 | hr, executive | Monthly salary cannot be processed or distributed | hr, executive |
| Attendance regularization tickets | Attendance | P1 | employee, hr | Employees cannot correct wrong records | hr |
| Role-based page access gating | Auth / RBAC | P1 | all | Wrong roles see or can modify data they should not | super_admin |
| SOP library (view, manage, wave rollout) | SOPs | P2 | hr, operations, manager | SOPs unavailable; compliance tracking breaks | hr |
| Performance goals and milestones | Performance | P2 | employee, manager, hr | Goal tracking stops; no performance data for reviews | hr, manager |
| Probation 8-milestone cadence (Day 1/7/15/30/45/60/75/90) | Performance | P2 | manager, hr | Probation check-ins missed; no audit trail | manager |
| Check-ins and review cycles | Performance | P2 | manager, hr, employee | Review process stalls | hr |
| Coaching log entries | Performance | P2 | manager, hr | Ad-hoc manager notes lost | manager |
| Growth plans (signed addendum → tracked plan) | Performance | P2 | employee, manager, hr | Employee development plans not activated | hr |
| Onboarding training catalog and compliance lock | Training | P2 | employee, hr | New hires cannot complete required training | hr |
| Training due-date extension requests | Training | P2 | manager, hr | Extensions not tracked; compliance lock not lifted | hr |
| SOP-goal KPI linkage | SOPs / Performance | P2 | hr, operations | SOP progress cannot be tied to goals | hr |
| Pay report dashboard (LOP summary, statutory exports) | Payroll | P2 | hr, finance, executive | Payroll reporting and export unavailable | hr, executive |
| Salary advance — self-service request and approval flow | Salary Advance | P2 | employee, manager, hr | Advance requests cannot be raised or approved | hr |
| Salary advance — manual recording (backfill/overpayment) | Salary Advance | P2 | hr, admin | Backfill advances cannot be created; recovery engine has gaps | hr |
| Employee document management (post-onboarding) | People | P2 | hr | Document compliance tracking breaks | hr |
| Guided onboarding checklist | New Hire | P2 | employee, hr | New hire checklist unavailable; onboarding not tracked | hr |
| Vault (read, manage, secrets) | Vault | P2 | all | Shared credential store unavailable | admin |
| Help Desk / internal tickets | Help Desk | P2 | all | Internal support requests cannot be raised | hr, operations |
| Finance contracts — client registry, MSA/SOW, invoices | Finance | P2 | hr, operations, finance | Client contract tracking and invoicing broken | operations |
| Attendance report versioning and salary gate | Attendance | P2 | hr, executive | Monthly attendance report not generated; payroll gate broken | hr |
| Ceipal ATS job sync and applicant push | Recruitment | P2 | recruiter, operations | Job listings stale; applicants not pushed to ATS | operations |
| Addendum letters (salary revision, designation, device allocation) | Letters & Documents | P2 | hr, manager | Amendment letters cannot be generated or countersigned | hr |
| HIS Academy LMS (backlog) | Academy | P3 | employee | Learning platform unavailable | hr |
| Content Studio — AI content generation and review pipeline | Studio | P3 | marketing_manager, content_creator | Content pipeline stalls; affects marketing output | marketing_manager |
| Content Studio — BD Agent | Studio | P3 | hr, admin | Business development document generation unavailable | admin |
| Social card generator (branded PNGs) | Studio | P3 | marketing_manager | Automated social cards not produced | marketing_manager |
| LinkedIn cover page generator | Studio | P3 | marketing_manager | LinkedIn branding asset unavailable | marketing_manager |
| IT Staffing marketing page (`/it-staffing`) | Public Site | P3 | public | One vertical landing page unavailable | admin |
| Capability decks (IT + Healthcare slide viewer and download) | Public Site | P3 | public | Capability deck download unavailable | admin |
| Travel quotes and margin floors | Travel | P3 | employee, hr | Travel request feature unavailable | hr |
| Executive cockpit / analytics | Finance | P3 | executive | Executive reporting unavailable | executive |
| Release notes generator | Admin | P3 | hr, admin | Internal release notes cannot be generated | admin |
| Performance analytics dashboard | Performance | P3 | hr, manager | Analytics cards unavailable | hr |
| Occasion preferences and idea card gallery | Studio | P3 | marketing_manager | Studio occasion curation unavailable | marketing_manager |

---

## Feature Flag Dependencies

Features gated by `system_settings` flags. When a flag is OFF the tier of affected features is effectively degraded to P3 (the feature does not appear in the UI).

| Flag key | Controls | Default | P-tier of dependent features |
|---|---|---|---|
| `notifications` | In-app notifications system | ON | P1 |
| `document_reminder_emails` | Automated email reminders for pending employee documents | OFF | P2 |
| `onboarding_training` | Training catalog and compliance lock | ON | P2 |
| `performance_management` | Entire performance module (goals, check-ins, reviews) | OFF | P2 |
| `salary_advance_enabled` | Employee self-service advance requests | OFF | P2 |
| `process_governance` | SOP library two-tier gate | OFF | P2 |
| `new_look` | App v2 redesign (global kill-switch) | OFF | P3 (cosmetic) |

---

## MLP Regression Checklist Reference

Run this list after every significant merge before releasing to production. Each item maps to one or more P0/P1 features above.

1. Payroll calculation accuracy — check PF/ESI/PT deductions against a known fixture
2. Attendance punch in and punch out — record appears in attendance table
3. Leave balance after manager approval — balance decreases by correct number of days
4. Offer letter PDF generation — file is produced and hash is written to the letter record
5. Letter hash on `/verify` — public lookup returns valid match for a known reference/auth code pair
6. 2FA enforcement on login — TOTP prompt appears for all accounts with `totp_enabled = true`
7. Email delivery — SendGrid sends at least one transactional email (invite or leave decision)
8. Salary advance recovery in payroll run — outstanding balance decrements correctly after run
9. Role-gated page access — employee cannot reach manager or HR pages
10. Feature flag defaults — `notifications` is ON, `performance_management` is OFF on a clean seed
