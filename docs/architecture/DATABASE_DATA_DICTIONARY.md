Status: Current-state automated system reference
Generated from: code, schema, routes, configuration, and existing documents
Date: 2026-07-13
Human approval required: Yes — for all UNABLE_TO_CONFIRM items listed within
Unresolved items: 0

---

# Database Data Dictionary

This document catalogues all platform enums, the key columns of the most critical tables, and field-level business meaning. For the full column-by-column schema, consult `shared/schema.ts` directly — that file is the authoritative source. This dictionary covers meaning and business context rather than repeating Drizzle syntax.

All values in this document are `CONFIRMED_IN_SCHEMA` unless otherwise noted.

---

## Platform-Wide Enums

### user_role

Enum used in `admin_users.role`.

| Value | Meaning |
|---|---|
| `super_admin` | Full platform authority. Only role that can soft-delete users, disable TOTP, perform final salary advance approvals, and publish content to the public site. |
| `admin` | Broad administrative access. Cannot soft-delete users or disable TOTP on themselves. |
| `executive` | Read-only financial and payroll overview. Access to executive dashboard and payroll executive view. |
| `hr` | Human Resources operations. Full leave, letter, payroll assist, and people management within configured role limits. |
| `finance` | Finance team access. View salary slips and reports; no payroll write access confirmed beyond viewing. |
| `manager` | Direct people management. Can approve leave, apply attendance corrections, and view team performance for own direct reports only. |
| `operations` | Operational access similar to manager scope. Access to recruitment, jobs, applications, team views. |
| `recruiter` | Recruitment-focused access. Jobs, applications, Ceipal sync. No HR write access. |
| `employee` | Most restricted role. Self-service only: own attendance, leave, training, profile. Cannot access New Hire section. |

### hierarchy_level

Supplemental level field on `admin_users` for display and routing (org chart, probation templates).

| Value | Meaning |
|---|---|
| `ceo` | Chief Executive Officer |
| `vp` | Vice President |
| `director` | Director level |
| `manager` | Manager level |
| `team_lead` | Team Lead |
| `delivery_manager` | Delivery Manager (healthcare/staffing operations context) |
| `team_member` | Individual contributor |

### employment_status

`admin_users.employment_status`. Controls whether the employee is active in the system.

| Value | Meaning |
|---|---|
| `active` | Currently employed; full access per role |
| `relieved` | Involuntary exit (e.g., termination). Set by HR. |
| `left_company` | Voluntary exit (resignation). Set by HR. |

### attendance_status

`attendance.status`. Set by the nightly sweep cron for past days; set in real time on punch-out.

| Value | Meaning |
|---|---|
| `present` | Employee punched in and out with hours meeting threshold |
| `absent` | No punch record for a working day |
| `half_day` | Punch hours above short_day threshold but below half_day threshold |
| `short_day` | Punch hours below short_day threshold (shift-specific) |
| `late` | Punch-in time exceeded grace period |
| `on_leave` | Approved leave existed for this day |
| `holiday` | Company holiday |
| `weekend` | Scheduled non-working day per the employee's shift |

### leave_status

`leave_requests.status`. Drives the leave approval workflow.

| Value | Meaning |
|---|---|
| `pending` | Submitted; awaiting manager or HR decision |
| `approved` | Approved; balance deducted |
| `rejected` | Denied; balance not affected |
| `cancelled` | Withdrawn by employee or cancelled by HR; balance restored if previously approved |

### ticket_status

`tickets.status`. Help desk and regularization ticket workflow.

| Value | Meaning |
|---|---|
| `open` | Submitted; in queue |
| `in_review` | HR/Ops has picked up and is reviewing |
| `resolved` | Issue addressed and closed |
| `rejected` | Request denied |

### performance_goal_status

`performance_goals.status`. Individual goal lifecycle.

| Value | Meaning |
|---|---|
| `not_started` | Goal created; no progress recorded |
| `in_progress` | Active; progress > 0 |
| `completed` | Progress at 100% and status confirmed |
| `cancelled` | Removed or invalidated before completion |

### employee_plan_status / employee_plan_outcome

`employee_plans.status` / `employee_plans.outcome`.

Status values:

| Value | Meaning |
|---|---|
| `pending` | Plan seeded (typically at offer acceptance); employee may not yet be onboarded |
| `active` | Plan running; check-ins scheduled |
| `completed` | Plan period ended with a positive or neutral outcome |
| `extended` | Plan duration extended by manager/HR |
| `closed` | Plan closed administratively without standard completion |

Outcome values (set at plan conclusion):

| Value | Meaning |
|---|---|
| `confirmed` | Probation passed; employee confirmed |
| `extended` | Probation period extended |
| `released` | Employee released during probation (involuntary) |
| `passed` | Growth or PIP target achieved |
| `terminated` | Employee terminated during PIP |
| `rolled_over` | Plan objectives rolled to a new plan |

### contract_status

`contracts.status`. Client contract lifecycle.

| Value | Meaning |
|---|---|
| `draft` | Being prepared |
| `pending_dispatch_approval` | Submitted for approval before sending to client |
| `sent` | Dispatched to client for signature |
| `client_signed` | Client has signed |
| `countersigned` | Hire'in has countersigned; contract is fully executed |
| `cancelled` | Voided |

### salary_advance_status

`salary_advance_requests.status`. Full advance and overpayment lifecycle.

| Value | Meaning |
|---|---|
| `pending_manager` | Awaiting direct manager approval |
| `pending_final` | Manager approved (≤50% salary); awaiting super_admin |
| `pending_ceo` | Manager approved (>50% salary); escalated for super_admin review |
| `pending_review` | HR-recorded advance or overpayment; awaiting super_admin verification |
| `approved` | Fully approved; not yet disbursed |
| `disbursed` | Funds released; repayment schedule active |
| `repaying` | First recovery applied (used interchangeably with `disbursed` in some logic) |
| `applied` | `salary_credit` type; credit processed in a salary run |
| `closed` | Outstanding balance fully recovered |
| `rejected` | Request denied at any approval stage |
| `cancelled` | Voided by requester before disbursement |
| `returned` | Sent back for correction; no recovery has occurred yet |

### salary_advance_kind

`salary_advance_requests.kind`. Distinguishes the type of financial record.

| Value | Meaning |
|---|---|
| `advance` | Standard employee-requested salary advance with multi-stage approval |
| `overpayment` | HR-recorded recovery of funds paid in error; bypasses standard approval chain |
| `salary_credit` | One-time HR-recorded payment (bonus, reimbursement); not recovered |

### salary_report_status (payroll run)

`salary_report_runs.status`. Monthly payroll batch.

| Value | Meaning |
|---|---|
| `pending_approval` | Run generated; pending approval by super_admin or executive |
| `approved` | Approved; salary slips locked for the period |
| `sent` | Salary slips dispatched to employees |
| `executed` | Payments confirmed as deposited |

### governance_control_status

`governance_controls.status`. Compliance obligation tracking.

| Value | Meaning |
|---|---|
| `pending` | Registered; not yet started |
| `in_progress` | Active work on the obligation |
| `completed` | Obligation fulfilled |
| `overdue` | Past due date without completion |
| `escalated` | Escalated to senior management or CEO |
| `closed` | Closed administratively |
| `disputed` | Obligation scope under dispute |

---

## Key Table Field Definitions

### admin_users — Selected Fields

| Column | Type | Business Meaning |
|---|---|---|
| `id` | varchar | UUID. Primary key. |
| `email` | varchar | Login email. Must match allowed domain. |
| `role` | user_role enum | System role determining access |
| `first_name`, `last_name` | varchar | Display name |
| `password` | varchar | bcrypt hash (12 rounds). Never returned in API responses. |
| `totp_secret` | varchar | Base32 TOTP secret. Never returned in API responses. |
| `totp_enabled` | boolean | Whether TOTP 2FA is active for this user |
| `is_active` | boolean | If false, login is blocked (403). Distinct from soft-delete. |
| `deleted_at` | timestamp | Soft-delete timestamp. If set, login returns 401. |
| `manager_id` | varchar | Pointer to the employee's direct manager. No DB-level FK constraint — ORM-only. |
| `department_id` | integer | FK to `departments`. |
| `hierarchy_level` | hierarchy_level enum | Seniority for display and routing |
| `employment_status` | employment_status enum | `active`, `relieved`, or `left_company` |
| `salary` | numeric | Base salary (single source via `salary_changes` ledger) |
| `salary_structure_id` | integer | FK to `salary_structures`. Required for India statutory computation. |
| `shift_id` | integer | FK to `shifts`. Determines grace period and weekend days. |
| `joining_date` | date | First day of employment. NULL until formally set post-offer. |
| `studio_add_on` | varchar | Content Studio role addition (`marketing_manager`, `content_creator`, `influencer`, or NULL) |
| `preferences` | jsonb | Per-user settings including `newLook` boolean for v2 UI opt-in |
| `password_reset_token` | varchar | One-time reset token. Expires after 1 hour. |
| `password_reset_expiry` | timestamp | Expiry for the reset token |

### offer_letters — Selected Fields

| Column | Type | Business Meaning |
|---|---|---|
| `id` | integer | Primary key |
| `token` | varchar | Unique token embedded in the candidate-facing acceptance URL |
| `status` | varchar | One of: `pending_approval`, `sent`, `viewed`, `accepted`, `countersigned`, `onboarded`, `rejected`, `cancelled`, `expired` |
| `candidate_name` | varchar | Recipient's full name |
| `candidate_personal_email` | varchar | Candidate email for delivery and login credential creation |
| `designation` | varchar | Job title offered |
| `salary` | numeric | Offered compensation (CTC) |
| `expires_at` | timestamp | Offer expiry. Checked on candidate access. |
| `accepted_at` | timestamp | Timestamp of candidate e-signature |
| `counter_signed_at` | timestamp | Timestamp of HR counter-signature |
| `resulting_user_id` | varchar | FK to `admin_users.id` — populated when the offer leads to account creation |
| `document_hash` | varchar | Cryptographic hash of the offer document at time of counter-signature |

### salary_advance_requests — Selected Fields

| Column | Type | Business Meaning |
|---|---|---|
| `request_number` | varchar | Human-readable reference (e.g., ADV-2026-001) |
| `requester_id` | varchar | FK to `admin_users` |
| `status` | salary_advance_status enum | Lifecycle status |
| `kind` | salary_advance_kind enum | `advance`, `overpayment`, or `salary_credit` |
| `requested_amount` | numeric | Amount requested by employee |
| `approved_amount` | numeric | Amount approved (may differ from requested) |
| `repayment_months` | integer | Number of monthly installments |
| `monthly_deduction` | numeric | Per-installment recovery amount |
| `total_repaid` | numeric | Running total of amounts recovered |
| `outstanding_balance` | numeric | Remaining amount to be recovered |
| `is_manually_recorded` | boolean | True if created by HR bypassing self-service flow |
| `acting_user_id` | varchar | Audit: who performed the last status change |

### salary_report_runs — Selected Fields

| Column | Type | Business Meaning |
|---|---|---|
| `month` | integer | Payroll period month (1–12) |
| `year` | integer | Payroll period year |
| `status` | salary_report_status enum | `pending_approval`, `approved`, `sent`, `executed` |
| `generated_by` | varchar | FK to `admin_users` — who triggered the run |
| `approved_by` | varchar | FK to `admin_users` — approver |
| `executed_at` | timestamp | When payment execution was confirmed |
| `is_active` | boolean | Multiple runs per month/year can exist; only one should be active. All reads must filter `is_active = true`. |

**Important:** There is no unique constraint on (month, year). Multiple rows can exist for the same period. The `is_active` flag is the discriminator. `CONFIRMED_IN_CODE` — `CONFIRMED_IN_EXISTING_GUIDE` (from memory note `attendance-report-versioning.md` and `BUSINESS_RULES_CATALOGUE.md`).

### sop_documents — Selected Fields

| Column | Type | Business Meaning |
|---|---|---|
| `code` | varchar | SOPs master identifier (e.g., `GOV-001`, `HR-001`). The "sopMasterId" used in cross-table joins. |
| `version` | integer | Incremented on each approved revision |
| `status` | varchar | SOP lifecycle status (see state machine document) |
| `title` | varchar | Human-readable SOP name |
| `content` | text | SOP body (may be rich text or markdown) |
| `category` | varchar | Domain category for wave assignment |
| `is_operational` | boolean | Whether the SOP has passed its activation date and cadence check |

### sop_employee_progress — Selected Fields

| Column | Type | Business Meaning |
|---|---|---|
| `sop_master_id` | varchar | The SOP's master code (`sop_documents.code`) |
| `user_id` | varchar | FK to `admin_users` |
| `training_completed_at` | timestamp | When linked training track was completed |
| `quiz_passed_at` | timestamp | When linked quiz was passed |
| `acknowledged_at` | timestamp | Formal acknowledgement timestamp |
| `acknowledgment_hash` | varchar | Cryptographic proof of the content version acknowledged |
| `sop_version` | integer | SOP version number at time of acknowledgement |
| `evidence_text` | text | Supporting free-text evidence |
| `evidence_file_url` | varchar | Supporting evidence file attachment URL |
| `overdue_nudge_sent_date` | date | Dedup guard: date of last overdue nudge (prevents re-sending daily) |

**Unique index:** (sop_master_id, user_id) — one row per employee per SOP. Version history is not retained per this table.

### employee_plans — Selected Fields

| Column | Type | Business Meaning |
|---|---|---|
| `plan_type` | varchar | `probation`, `growth`, or `pip` |
| `status` | employee_plan_status enum | Lifecycle status |
| `outcome` | employee_plan_outcome enum | Final outcome value (set at completion or closure) |
| `employee_id` | varchar | FK to `admin_users`. Nullable — pending plans (seeded at offer acceptance) may have NULL. |
| `manager_id` | varchar | FK to `admin_users` (the employee's manager at plan creation) |
| `start_date`, `end_date` | date | Plan duration |
| `duration_days` | integer | Configured duration in days |
| `acknowledged_at` | timestamp | Employee e-signature timestamp |
| `acknowledged_by` | varchar | FK to `admin_users` — who performed the acknowledgement |
| `manager_briefed_at` | timestamp | When the manager formally received the plan brief |
| `strike_escalated_at` | timestamp | Timestamp of 3-strike escalation |

**IMPORTANT:** `employee_id` is nullable. Never add `.notNull()` or a SET NOT NULL migration — this breaks prod where pending plans exist with NULL employee_id. `CONFIRMED_IN_EXISTING_GUIDE` (from memory note `employee-plans-nullable-employee-id.md`).

### hr_letters — Selected Fields

| Column | Type | Business Meaning |
|---|---|---|
| `letter_type` | varchar | `experience`, `internship`, `relieving`, `salary_revision`, `designation_change`, `combined`, `device_allocation` |
| `reference_number` | varchar | Unique alphanumeric reference for verification |
| `auth_code` | varchar | Cryptographically random code required for public verification |
| `employee_id` | varchar | FK to `admin_users` |
| `issued_at` | timestamp | Issue date |
| `issued_by` | varchar | FK to `admin_users` |
| `is_revoked` | boolean | Whether the letter has been revoked |
| `document_hash` | varchar | Hash of the letter content for integrity |

### leave_balances — Selected Fields

| Column | Type | Business Meaning |
|---|---|---|
| `user_id` | varchar | FK to `admin_users` |
| `leave_type_id` | integer | FK to `leave_types` |
| `year` | integer | Leave year |
| `balance` | numeric | Current available days |
| `used` | numeric | Days consumed this year |
| `carried_forward` | numeric | Balance carried from previous year |
| `lwp_days` | numeric | LWP days accumulated this year |

### check_ins — Selected Fields

| Column | Type | Business Meaning |
|---|---|---|
| `plan_id` | integer | FK to `employee_plans` |
| `employee_id` | varchar | FK to `admin_users` |
| `manager_id` | varchar | FK to `admin_users` |
| `check_in_type` | varchar | `weekly`, `milestone`, `pip_review` |
| `status` | varchar | `scheduled`, `completed`, `cancelled` |
| `scheduled_date` | date | Due date |
| `completed_at` | timestamp | Completion timestamp |
| `rating` | integer | Manager rating (integer scale) |
| `review_scores` | jsonb | Full probation scorecard for Day 30/60/90 milestones |
| `employee_notes`, `manager_notes` | text | Meeting notes |
| `action_items` | jsonb | Action items agreed in the meeting |
| `notified_at` | timestamp | Day-before employee reminder sent |
| `manager_notified_at` | timestamp | Same-day manager reminder sent |
| `overdue_reminded_on` | date | Date of last overdue reminder (dedup guard) |
| `milestone_escalated_at` | timestamp | Escalation timestamp for missed milestone |

**Audit gap:** `check_in_updated` audit events record new values only, not old values. `CONFIRMED_IN_EXISTING_GUIDE` — `docs/ai-governance-audit/GOVERNANCE-MVP-READINESS.md`

### learning_tracks — Selected Fields

| Column | Type | Business Meaning |
|---|---|---|
| `title` | varchar | Track name |
| `description` | text | Track overview |
| `is_required` | boolean | Whether the track is mandatory for assigned roles |
| `due_days` | integer | Default days to complete from assignment date |

### track_assignments — Selected Fields

| Column | Type | Business Meaning |
|---|---|---|
| `user_id` | varchar | FK to `admin_users` |
| `track_id` | integer | FK to `learning_tracks` |
| `status` | varchar | `not_started`, `in_progress`, `completed`, `excepted` |
| `due_date` | timestamp | Completion deadline |
| `completed_at` | timestamp | Completion timestamp |
| `signed_version` | integer | Version of track content acknowledged at completion |
| `assigned_by` | varchar | FK to `admin_users` — who assigned |
| `exception_granted_by_id` | varchar | FK to `admin_users` — who granted the exception |
| `exception_granted_at` | timestamp | Exception grant timestamp |
| `exception_reason` | text | Reason for exception |

---

## Notable Schema Constraints and Quirks

All items `CONFIRMED_IN_SCHEMA` unless noted.

1. `admin_users.manager_id` — varchar FK pointer with **no DB-level foreign-key constraint**. Referential integrity enforced by ORM relations only. A stale or corrupt `manager_id` will not be caught by PostgreSQL. `CONFIRMED_IN_EXISTING_GUIDE` — `docs/ai-governance-audit/GOVERNANCE-MVP-READINESS.md`

2. `employee_plans.employee_id` — nullable. Plans are seeded at offer acceptance before the employee record is created. Do not add NOT NULL or SET NOT NULL. `CONFIRMED_IN_EXISTING_GUIDE`

3. `salary_report_runs` — no unique constraint on (month, year). Multiple rows with `is_active = true` can exist. All reads must filter `is_active`. `CONFIRMED_IN_CODE`

4. `offer_letters.status` — stored as plain `varchar`, not a `pgEnum`. Enum values are enforced in application code, not at the database level. `CONFIRMED_IN_SCHEMA`

5. `sop_employee_progress` — unique index on (sop_master_id, user_id). Only the most recent acknowledgement is stored. Historical version acknowledgements cannot be queried from this table. `CONFIRMED_IN_SCHEMA`

6. `notifications` table is gated by the `notifications_enabled` system flag. If the flag is OFF, no in-app notifications are created. `CONFIRMED_IN_CODE`

7. `audit_logs.changes` JSONB — records new values only, not old (pre-update) values. Post-hoc value changes cannot be detected from audit history alone. `CONFIRMED_IN_EXISTING_GUIDE`
