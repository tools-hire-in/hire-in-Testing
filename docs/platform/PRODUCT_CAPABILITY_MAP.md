Status: Current-state automated system reference
Generated from: code, schema, routes, configuration, and existing documents
Date: 2026-07-13
Human approval required: Yes — for all UNABLE_TO_CONFIRM items listed within
Unresolved items: 0

---

# Product Capability Map

All status values reflect what is present and active in the codebase as of the generation date.

Status key: **Live** = feature is accessible and functional. **Partial** = feature exists but some parts are incomplete or behind flags. **Hidden** = exists in code but not surfaced in normal navigation. **Deprecated** = code exists but is replaced by a newer path.

---

## My Desk / Command Center

| Capability Area | Feature | Primary User Roles | Business Purpose | Current Status | Entry Route | Main Actions | Primary Database Tables | Known Limitation |
|---|---|---|---|---|---|---|---|---|
| Dashboard | Role-specific command center | All roles | Single entry point to daily work | Live `CONFIRMED_IN_CODE` | `/admin/my-desk` | View attendance status, punch in/out, view team pulse, access quick links | `attendance`, `leave_requests`, `admin_users` | Employee and manager/HR views are different layouts within the same page |
| Attendance (employee) | Time card — punch in/out | employee | Self-service attendance recording | Live `CONFIRMED_IN_CODE` | `/admin/my-desk` (Attendance tab) | Punch in, punch out, start/end breaks, view month summary, view recent records | `attendance`, `break_records` | No calendar view; action-first design |
| Break Tracking | Lunch and tea break timer | employee | Compliance with break policy | Live `CONFIRMED_IN_CODE` | Dashboard BreakWidget / Attendance tab | Start Lunch break (1x30min), start Tea break (2x15min), end break | `break_records` | Soft warnings only; policy not hard-enforced at server level |
| Leave Management (self) | Submit and track leave requests | All roles | Employee self-service for time off | Live `CONFIRMED_IN_CODE` | `/admin/my-desk` (Leaves tab) | Apply for leave, view balance, view history, view accrual log | `leave_requests`, `leave_balances`, `leave_accruals` | Leave application for LWP-split requests is calculated automatically |
| Holiday Calendar | View company holidays | All roles | Reference for planning | Live `CONFIRMED_IN_CODE` | `/admin/my-desk` (Holidays tab) | View holidays, mark optional regional holidays | `holidays`, `regional_holiday_selections` | |

---

## HR and People Management

| Capability Area | Feature | Primary User Roles | Business Purpose | Current Status | Entry Route | Main Actions | Primary Database Tables | Known Limitation |
|---|---|---|---|---|---|---|---|---|
| Employee Directory | User list and profile management | super_admin, admin, hr, manager | Manage workforce records | Live `CONFIRMED_IN_CODE` | `/admin/users`, `/admin/hr/people` | Create, edit, deactivate employees; bulk upload via CSV; manage roles, departments, shifts | `admin_users`, `departments` | manager_id lacks DB-level FK constraint (ORM-only) |
| Soft Delete | Remove employee records | super_admin | Permanent data removal for terminated employees | Live `CONFIRMED_IN_CODE` | People & HR > Users | Soft-delete (sets `deleted_at`), restore | `admin_users` | Only super_admin can soft-delete |
| My Team | Manager view of direct reports | super_admin, admin, hr, manager, operations | Team oversight | Live `CONFIRMED_IN_CODE` | `/admin/hr/my-team` | View team roster, attendance, leave, profile, corrections, audit trail, plans | `admin_users`, `attendance`, `leave_requests`, `employee_plans` | |
| Employee Profile | Personal and employment details | All roles | Employee self-service profile | Live `CONFIRMED_IN_CODE` | `/admin/profile` | View/update LinkedIn, photo, preferences | `admin_users` | |
| Org Chart | Visual hierarchy display | All roles | Understand reporting structure | Live `CONFIRMED_IN_CODE` | `/admin/hr/org-chart` | Browse hierarchy | `admin_users` | managerId has no DB FK constraint; orphan nodes possible |
| Department Management | Create and manage departments | super_admin, admin, hr | Organizational structure | Live `CONFIRMED_IN_CODE` | Settings | CRUD departments, assign department head | `departments` | |
| Shift Management | Define and assign work shifts | super_admin, admin, hr | Attendance policy enforcement | Live `CONFIRMED_IN_CODE` | Settings | Create shifts with IST start/end times, assign to employees | `shifts`, `shift_assignment_log` | |
| Post-Onboarding Documents | Employee document checklist | super_admin, admin, hr | Compliance document collection | Live `CONFIRMED_IN_CODE` | My Documents, HR tools | Upload, verify, mark required/optional; send reminder | `employee_documents` | |
| Bank Details | Employee payment information | super_admin, admin, hr | Payroll disbursement | Live `CONFIRMED_IN_CODE` | HR profile / My Documents | Add/update bank account and IFSC | `employee_bank_details` | No application-layer encryption confirmed |
| Emergency Contacts | Next-of-kin registry | super_admin, admin, hr | HR compliance | Live `CONFIRMED_IN_CODE` | HR profile | Add/update emergency contacts | `employee_emergency_contacts` | |
| Night Shift Consents | Legal consent for non-standard hours | super_admin, admin, hr | Labour law compliance | Live `CONFIRMED_IN_CODE` | HR tools | Record consent, track expiry, send alerts | `night_shift_consents` | |

---

## Letters and Documents

| Capability Area | Feature | Primary User Roles | Business Purpose | Current Status | Entry Route | Main Actions | Primary Database Tables | Known Limitation |
|---|---|---|---|---|---|---|---|---|
| HR Letters | Experience, internship, relieving letters | super_admin, admin, hr | Formal employment documentation | Live `CONFIRMED_IN_CODE` | `/admin/hr/tools` | Generate, issue, re-issue, revoke, email, download PDF | `hr_letters` | |
| Amendment Letters | Salary revision, designation change, combined, device allocation | super_admin, admin, hr | Post-hire contract amendments | Live `CONFIRMED_IN_CODE` | `/admin/hr/tools` | Generate DOCX via addendum engine, optional email delivery | `hr_letters`, `offer_letter_addendums` | |
| Public Verification | Verify HR letter authenticity | Public | Anti-fraud for issued letters | Live `CONFIRMED_IN_CODE` | `/verify` | Enter reference number and auth code; see letter status and basic details | `hr_letters` | Rate-limited; covers hr_letter and contract types only |
| Offer Letters | Employment offer generation and lifecycle | super_admin, admin, hr, manager | Recruitment to hire pipeline | Live `CONFIRMED_IN_CODE` | `/admin/new-hire` (Offer Letters tab) | Generate, approve, send to candidate, track acceptance, countersign | `offer_letters` | Non-super_admin creators require approval before sending |
| Offer Letter Addendums | Post-hire addendum clauses (growth, device, salary) | super_admin, admin, hr | Supplement to offer letter | Live `CONFIRMED_IN_CODE` | New Hire / My Team | Generate addendum, send to employee, track countersign | `offer_letter_addendums` | |
| Policy Documents | Company policy publication and signing | super_admin, admin, hr | Employee acknowledgement compliance | Live `CONFIRMED_IN_CODE` | `/admin/hr/documents/policy/:signingId` | Publish policy, assign for signing, track acknowledgement | `policy_documents`, `policy_signing_requests`, `policy_signatures` | |

---

## Attendance and Payroll

| Capability Area | Feature | Primary User Roles | Business Purpose | Current Status | Entry Route | Main Actions | Primary Database Tables | Known Limitation |
|---|---|---|---|---|---|---|---|---|
| Team Attendance | Manager view of team daily attendance | super_admin, admin, hr, manager, operations | Attendance oversight | Live `CONFIRMED_IN_CODE` | `/admin/hr/team-attendance` | View today's attendance, break status badges (on_lunch/on_tea), range reports | `attendance`, `break_records` | |
| Attendance Correction | Correct punch records | super_admin, admin, hr, manager | Fix incorrect attendance | Live `CONFIRMED_IN_CODE` | My Team > Corrections | Edit punch in/out, add notes, audit record created | `attendance`, `audit_logs` | |
| Regularization | Employee-submitted attendance correction requests | All roles | Self-service punch correction | Live `CONFIRMED_IN_CODE` | My Desk (tickets) | Submit request with requested times and reason, manager/HR reviews | `attendance_regularizations`, `tickets` | 3-day window enforced |
| Leave Approvals | Manager/HR approve or reject leave | super_admin, admin, hr, manager | Leave governance | Live `CONFIRMED_IN_CODE` | `/admin/hr/leave-approvals` | Approve, reject leave requests; add review comment | `leave_requests`, `leave_balances` | |
| Leave Accrual Engine | Monthly EL and SL accrual | System (cron) | Accurate leave balance maintenance | Live `CONFIRMED_IN_CODE` | Automatic (1st of month, 00:00 IST) | Accrue EL (conditional on 128h threshold), accrue SL (unconditional after 30 days), apply year-end carry-forward/lapse | `leave_accruals`, `leave_balances` | |
| Salary Slip Generator | Generate monthly pay slips | super_admin, admin, hr, finance, executive | Payroll evidence and compliance | Live `CONFIRMED_IN_CODE` | Reports & Compliance | Generate PDF slip, includes India statutory breakdown if salary structure assigned | `salary_slips` | |
| Payroll Run | Monthly payroll batch processing | super_admin, admin, hr, executive | Bulk payroll computation and approval | Live `CONFIRMED_IN_CODE` | `/admin/payroll/run` | Validate, generate, adjust, approve, execute, disburse per-employee slips | `salary_report_runs`, `salary_slips`, `salary_run_payments` | Requires salary structure assignment for India statutory compute |
| India Statutory Payroll | PF, ESI, PT computation | super_admin, admin, hr, finance, executive | Regulatory compliance | Live `CONFIRMED_IN_CODE` | `/admin/payroll/run`, `/admin/payroll/setup` | Compute and display PF, ESI, PT per employee; generate statutory export | `salary_structures`, `salary_slips` | paise-precision engine; ESI rounds UP |
| Salary Structures | Define component breakdowns | super_admin, admin, hr, executive | Payroll configuration | Live `CONFIRMED_IN_CODE` | `/admin/payroll/setup` | Create/edit structure rules (percent_of_gross, percent_of_component, fixed, residual) | `salary_structures`, `salary_structure_rules` | |
| Salary Advance | Self-service advance requests | All roles | Employee financial support | Live `CONFIRMED_IN_CODE` | `/admin/salary-advance` | Request, manager approve, final approve (super_admin), disburse, auto-recovery | `salary_advance_requests`, `salary_advance_repayments` | Final approval locked to super_admin only |
| Salary Advance (Manual Recording) | HR records backfill advances and overpayments | super_admin, admin, hr | Correct historical payroll | Live `CONFIRMED_IN_CODE` | Active Advances > Record for Employee | Record advance or overpayment directly as disbursed; recovery auto-applies | `salary_advance_requests`, `salary_advance_repayments` | Works even when self-service flag is OFF |
| Salary Changes Ledger | Audit trail of compensation changes | super_admin, admin, hr, manager | Compensation governance | Live `CONFIRMED_IN_CODE` | My Team | View salary change history with proof and approvals | `salary_changes` | Maker-checker required; manager can only adjust own direct reports |
| Attendance Report | Monthly attendance summary | super_admin, admin, hr, executive | Payroll gate and compliance | Live `CONFIRMED_IN_CODE` | Reports & Compliance | Generate, review, approve, notify; additive auto-sync on open runs | `attendance_report_runs`, `attendance_report_entries` | Multiple active rows possible (no month/year unique constraint); reads must filter is_active |
| Executive Dashboard | Payroll overview for finance leadership | executive, super_admin | Financial oversight | Live `CONFIRMED_IN_CODE` | `/admin/payroll/executive` | View payroll stats, statutory export, headcount history | `salary_report_runs`, `headcount_history` | |

---

## Performance Management

| Capability Area | Feature | Primary User Roles | Business Purpose | Current Status | Entry Route | Main Actions | Primary Database Tables | Known Limitation |
|---|---|---|---|---|---|---|---|---|
| Performance Goals | Individual and team goal setting | All roles | OKR-style goal tracking | Live (behind feature flag) `CONFIRMED_IN_CODE` | `/admin/performance/goals` | Create, update progress, add milestones, link to SOPs | `performance_goals`, `goal_milestones` | Feature flag `performance_management_enabled` must be ON |
| Check-ins | Recurring manager-employee 1:1 meetings | super_admin, admin, hr, manager | Continuous performance dialogue | Live (behind feature flag) `CONFIRMED_IN_CODE` | `/admin/performance/check-ins` | Schedule, complete, rate, add notes | `check_ins` | Audit log does not capture old values on update |
| Review Cycles | Annual/semi-annual/quarterly performance periods | super_admin, admin, hr | Formal appraisal governance | Live (behind feature flag) `CONFIRMED_IN_CODE` | `/admin/performance/review-cycles` | Create, activate, close cycles | `review_cycles` | |
| Reviews | Self-assessment and manager review | All roles | Structured appraisal | Live (behind feature flag) `CONFIRMED_IN_CODE` | `/admin/performance/reviews` | Submit self-review, submit manager review | `reviews` | |
| Feedback | Peer and 360-degree feedback | All roles | Continuous development | Live (behind feature flag) `CONFIRMED_IN_CODE` | `/admin/performance/feedback` | Give praise, constructive, or general feedback | `performance_feedback` | |
| Employee Plans | Probation, Growth, PIP lifecycle | super_admin, admin, hr, manager | Formal development and accountability | Live `CONFIRMED_IN_CODE` | My Team > Plans | Create plan, generate check-ins, track milestones, record outcome | `employee_plans`, `check_ins`, `plan_acknowledgements` | Probation plans seeded at offer acceptance with NULL employee_id |
| Probation Framework | 8-milestone cadence with scoring | super_admin, admin, hr, manager | New hire confirmation process | Live `CONFIRMED_IN_CODE` | My Team > Plans | Auto-generate cadence check-ins at Days 1/7/15/30/45/60/75/90 | `check_ins`, `probation_scoring_bands`, `probation_final_weights` | |
| Growth Plans | Post-probation development track | super_admin, admin, hr, manager | Career development | Live `CONFIRMED_IN_CODE` | My Growth / My Team | View plan goals, submit weekly updates, acknowledge plan | `employee_plans`, `performance_goals` | Activated by signed growth-clause addendum |
| Coaching Log | Ad-hoc manager notes | super_admin, admin, hr, manager | Informal performance record | Live `CONFIRMED_IN_CODE` | My Team | Add coaching notes; not part of probation cadence | `coaching_log_entries` | |
| Governance Controls | Obligation tracking and escalation | All roles (varied access) | Compliance monitoring | Live `CONFIRMED_IN_CODE` | Control Tower | Track obligations, escalate, report to CEO level | `governance_controls` | |

---

## Training and SOPs

| Capability Area | Feature | Primary User Roles | Business Purpose | Current Status | Entry Route | Main Actions | Primary Database Tables | Known Limitation |
|---|---|---|---|---|---|---|---|---|
| Onboarding Training | Structured learning tracks with sections, quizzes, acknowledgements | All roles | Ensure new hire competency | Live `CONFIRMED_IN_CODE` | `/admin/hr/my-training` | Complete sections, pass quizzes, acknowledge content | `learning_tracks`, `track_sections`, `track_assignments`, `section_progress` | |
| Training Compliance Lock | Block system access for overdue training | All roles | Enforce training completion | Live `CONFIRMED_IN_CODE` | `/admin/policy-gate` | System enforces lock when overdue; exception by HR | `track_assignments` | Only applies when track has due date passed and no exception |
| Training Progress | Manager/HR view of team training | super_admin, admin, hr, manager, operations, executive | Workforce compliance tracking | Live `CONFIRMED_IN_CODE` | `/admin/hr/training-progress` | View per-employee progress, export CSV | `track_assignments`, `section_progress` | |
| SOP Library | Standard Operating Procedure document management | super_admin, admin, hr, operations, manager | Process governance | Live `CONFIRMED_IN_CODE` | `/admin/sops` | Create, review, publish, retire SOPs; manage role assignments | `sop_documents`, `sop_role_assignments` | |
| SOP Compliance | Employee SOP acknowledgement tracking | All roles | Regulatory evidence | Live `CONFIRMED_IN_CODE` | `/admin/sops/compliance` | View assigned SOPs, acknowledge, view progress | `sop_employee_progress` | One row per (sopMasterId, userId); no version history per acknowledgement |
| SOP Wave Rollout | Phased SOP enforcement (soft → measured → full) | super_admin, admin | Controlled compliance rollout | Live `CONFIRMED_IN_CODE` | Admin settings (sops.rollout) | Configure wave membership, monitor enforcement level | `rollout_waves`, `wave_sops` | 6-wave model; Wave 5 triggers full compliance lock |
| Training Catalog | Browse and assign available learning tracks | super_admin, admin, hr, manager, operations | Training management | Live `CONFIRMED_IN_CODE` | `/admin/training/catalog` | Browse tracks, assign to employees, track completion | `learning_tracks`, `track_assignments` | |
| Rayo Academy Integration | External training platform sync | super_admin, admin, hr, manager, operations | Extended training catalog | Partial `CONFIRMED_IN_CODE` | Training Catalog / My Training | Provision employee, assign external track, view progress summary | `admin_users` (linked by email) | Thin-client with graceful fallback; content owned by Rayo Academy |
| Policy Signing | Employee acknowledgement of company policies | All roles | Legal compliance | Live `CONFIRMED_IN_CODE` | `/admin/hr/documents/policy/:signingId` | View and e-sign company policies | `policy_signing_requests`, `policy_signatures` | |

---

## Recruitment

| Capability Area | Feature | Primary User Roles | Business Purpose | Current Status | Entry Route | Main Actions | Primary Database Tables | Known Limitation |
|---|---|---|---|---|---|---|---|---|
| Job Board (public) | Public job listing site | Public (candidates) | Talent acquisition | Live `CONFIRMED_IN_CODE` | `/jobs` | Browse listings, view detail, apply | `jobs` | |
| Job Management | Internal job posting management | super_admin, admin, operations, recruiter, manager | Requisition management | Live `CONFIRMED_IN_CODE` | Recruitment (Jobs) | Create, edit, bulk-update, bulk-delete, mark hot | `jobs` | |
| Ceipal Job Sync | Import jobs from Ceipal ATS | super_admin, admin, operations, recruiter, manager | ATS integration | Live `CONFIRMED_IN_CODE` | Recruitment (Jobs) | Sync jobs from Ceipal, match by job code | `jobs` | Token refresh every 55 min; failures logged |
| CSV/Excel Upload | Bulk job import from spreadsheet | super_admin, admin, operations, recruiter, manager | Rapid job loading | Live `CONFIRMED_IN_CODE` | Recruitment (Jobs) | Upload CSV/XLSX, map columns, import | `jobs` | |
| Applications | Candidate application management | super_admin, admin, hr, operations, recruiter, manager | Applicant tracking | Live `CONFIRMED_IN_CODE` | Recruitment (Applications) | View, filter, push to Ceipal, retry failed pushes | `applications` | |
| New Hire Section | Pre-employment pipeline management | super_admin, admin, hr, operations, manager | Unified new hire view | Live `CONFIRMED_IN_CODE` | `/admin/new-hire` | Manage offer letters, onboarding status, users across three tabs | `offer_letters`, `admin_users` | Not accessible to employee role |
| Contacts | Client and staffing inquiry management | super_admin, admin, hr, operations, recruiter, manager | Lead management | Live `CONFIRMED_IN_CODE` | Admin Contacts | View, filter, respond to form inquiries | `contacts` | |

---

## Finance and Contracts

| Capability Area | Feature | Primary User Roles | Business Purpose | Current Status | Entry Route | Main Actions | Primary Database Tables | Known Limitation |
|---|---|---|---|---|---|---|---|---|
| Contracts | Client contract lifecycle | super_admin, admin, hr, operations, manager | Revenue documentation | Live `CONFIRMED_IN_CODE` | `/admin/finance` | Create, dispatch, client sign, countersign | `contracts` (via contractRoutes) | |
| Invoices | Client invoice management | super_admin, admin, hr, operations, finance | Revenue tracking | Live `CONFIRMED_IN_CODE` | Finance hub | View and manage invoices | `contracts` (invoice-linked) | |
| Travel Calculator | Healthcare recruiter blended rate tool | All roles | Quote generation | Live `CONFIRMED_IN_CODE` | `/admin/travel-calculator` | Enter job parameters, compute blended pay and margin | `travel_quotes`, `travel_quote_outputs`, `gsa_rate_snapshots` | Uses cached GSA rates |

---

## Content Studio

| Capability Area | Feature | Primary User Roles | Business Purpose | Current Status | Entry Route | Main Actions | Primary Database Tables | Known Limitation |
|---|---|---|---|---|---|---|---|---|
| Article Pipeline | AI-assisted content creation and publication | super_admin, admin, marketing_manager, content_editor | Brand content production | Live `CONFIRMED_IN_CODE` | `/studio/articles` | Draft, review, approve, schedule, publish articles | `studio_articles`, `studio_article_versions` | Final publish restricted to super_admin only |
| Idea Board | Content ideation management | studio roles | Content planning | Live `CONFIRMED_IN_CODE` | Studio Calendar / Pipeline views | Create, comment on, watch content ideas | `studio_content_ideas`, `studio_idea_comments` | |
| Campaigns | Marketing campaign management | super_admin, admin, marketing_manager | Campaign planning | Live `CONFIRMED_IN_CODE` | `/studio/campaigns` | Create and track campaigns | `studio_campaigns` | |
| BD Agent | AI-powered business development chat | super_admin, admin, hr | Client proposal generation | Live `CONFIRMED_IN_CODE` | `/studio/bd-agent` | Chat with AI agent, generate BD templates, manage decks | `bd_conversations`, `bd_messages`, `bd_decks` | |
| Social Cards | AI-generated social media assets | super_admin, admin | Brand visual content | Live `CONFIRMED_IN_CODE` | Studio (auto-trigger on article approve) | Generate PNG cards for LinkedIn, Twitter, etc. using Puppeteer + Chromium | `card_templates` | Requires Chromium/Puppeteer at runtime |
| Brand Voice | AI generation rules and settings | super_admin, admin, marketing_manager | Consistent brand tone | Live `CONFIRMED_IN_CODE` | `/studio/settings/brand-voice` | Configure brand voice parameters | `studio_brand_settings` | |
| Newsletter Subscribers | Email list management | super_admin, admin | Marketing distribution | Live `CONFIRMED_IN_CODE` | `/studio/subscribers` | View subscribers, send newsletter | `studio_newsletter_subscribers` | |
| Analytics | Content performance metrics | super_admin, admin, marketing_manager | Content ROI | Partial `CONFIRMED_IN_CODE` | `/studio/analytics` | View engagement data | `studio_engagement_events`, `studio_audit_events` | Self-contained cards; no external analytics integration confirmed |

---

## Vault

| Capability Area | Feature | Primary User Roles | Business Purpose | Current Status | Entry Route | Main Actions | Primary Database Tables | Known Limitation |
|---|---|---|---|---|---|---|---|---|
| Secrets Vault | Secure shared credential storage | All roles (read), super_admin/admin (manage) | Centralized secret management | Live `CONFIRMED_IN_CODE` | `/admin/vault` | Store, retrieve, share, revoke access to credentials | `vaults`, `vault_secrets`, `vault_secret_grants` | |
| Vault Audit | Access audit trail | super_admin, admin | Security compliance | Live `CONFIRMED_IN_CODE` | `/admin/vault/audit` | View reveal/copy/edit/archive events | `vault_audit_logs` | |

---

## Help Desk

| Capability Area | Feature | Primary User Roles | Business Purpose | Current Status | Entry Route | Main Actions | Primary Database Tables | Known Limitation |
|---|---|---|---|---|---|---|---|---|
| Tickets (HIRD) | Internal help desk and request system | All roles | Issue tracking and resolution | Live `CONFIRMED_IN_CODE` | `/admin/help-desk` | Create tickets, view own tickets, HR/ops manage queue and resolve | `internal_requests`, `tickets` | |
| Regularization Tickets | Attendance correction requests | All roles | Correct attendance records | Live `CONFIRMED_IN_CODE` | My Desk | Submit punch correction, manager reviews | `tickets`, `attendance_regularizations` | 3-day window enforced |

---

## Notifications

| Capability Area | Feature | Primary User Roles | Business Purpose | Current Status | Entry Route | Main Actions | Primary Database Tables | Known Limitation |
|---|---|---|---|---|---|---|---|---|
| In-App Notifications | System alerts and action prompts | All roles | Real-time awareness | Live (behind feature flag) `CONFIRMED_IN_CODE` | Notification Centre (`/admin/notifications`), bell icon badge | Mark read, view all notifications | `notifications` | `notifications_enabled` system flag must be ON |
| Notification Preferences | Per-user channel preferences | All roles | Personalized notification control | Live `CONFIRMED_IN_CODE` | Settings | Toggle in-app and email per notification type | `notification_preferences` | Default: all channels ON (COALESCE semantics) |

---

## Public Site

| Capability Area | Feature | Primary User Roles | Business Purpose | Current Status | Entry Route | Main Actions | Primary Database Tables | Known Limitation |
|---|---|---|---|---|---|---|---|---|
| Job Board | Public job listings | Candidates | Talent sourcing | Live `CONFIRMED_IN_CODE` | `/jobs` | Browse, filter, apply | `jobs`, `applications` | |
| Document Verification | Verify HR letters | Public | Anti-fraud | Live `CONFIRMED_IN_CODE` | `/verify` | Enter reference + auth code | `hr_letters` | Rate-limited; covers hr_letter and contract only |
| Contact Form | Inquiries from candidates and clients | Public | Lead capture | Live `CONFIRMED_IN_CODE` | `/contact` | Submit inquiry | `contacts` | |
| Insights Blog | Published content articles | Public | Brand awareness | Live `CONFIRMED_IN_CODE` | `/insights` | Browse, read, subscribe | `studio_articles`, `studio_newsletter_subscribers` | Requires Studio article to be in `published` status |
| Capability Deck | Company capability presentation | Public | Business development | Live `CONFIRMED_IN_CODE` | `/capability-deck` | View | — | Static content |
