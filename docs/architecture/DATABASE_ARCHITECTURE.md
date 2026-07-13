Status: Current-state automated system reference
Generated from: code, schema, routes, configuration, and existing documents
Date: 2026-07-13
Human approval required: Yes — for all UNABLE_TO_CONFIRM items listed within
Unresolved items: 0

---

# Database Architecture

## Platform and ORM

**Database platform:** PostgreSQL `CONFIRMED_IN_EXISTING_GUIDE`  
**ORM:** Drizzle ORM v0.39.3 `CONFIRMED_IN_CODE` — `package.json`  
**ORM toolkit:** Drizzle Kit v0.31.8 (schema push tooling) `CONFIRMED_IN_CODE`  
**Schema validation:** drizzle-zod v0.7.1 `CONFIRMED_IN_CODE`  
**PostgreSQL client:** `pg` v8.16.3 `CONFIRMED_IN_CODE`

---

## Connection Approach

`CONFIRMED_IN_CODE` — `server/db.ts`:
- Single bounded connection pool shared across the entire application.
- The session store (`connect-pg-simple`) reuses this same pool — no separate unbounded pool is opened.
- Connection string is read from the `DATABASE_URL` environment variable.
- Session table is `sessions` (created by `connect-pg-simple` with `createTableIfMissing: false` — table must pre-exist).

---

## Migration System

`CONFIRMED_IN_CODE` — `drizzle.config.ts`, `replit.md`:
- Schema source of truth: `shared/schema.ts`. All tables and columns must be declared here.
- Schema is pushed to the database via `drizzle-kit push` (`npm run db:push`).
- `drizzle-kit push` uses an arrow-key terminal UI that requires a TTY. It cannot be piped or automated without special handling.
- The `migrations/` directory exists but migration files are dormant — they are applied only when `RUN_MIGRATIONS=true` is set. Normal deployments use `db:push`.
- Drift guard: `scripts/check-schema-drift.sh` answers "No, abort" to every drizzle prompt to detect but never apply destructive changes. Registered as the `schema-drift` validation.
- Merge guard: `scripts/post-merge.sh` runs the same preflight before applying `db:push --force`.
- Critical wording: drizzle says "delete `<x>` column" (not "drop column") for columns removed from schema — guards must match that exact phrase.
- Startup ensure-blocks (`server/index.ts`) use `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for idempotent bootstrapping. These must be kept in sync with `shared/schema.ts` declarations; columns owned by ensure-blocks but missing from schema.ts will be deleted on the next `db:push`.

---

## Schema Organization

`CONFIRMED_IN_CODE` — `shared/schema.ts` (4,528 lines as of generation date):
- Single file exports all table definitions, enum declarations, insert schemas, and Drizzle relations.
- The file also re-exports from `shared/models/auth.ts` for authentication-related models.
- All `pgEnum` declarations are in this file; no enum is defined elsewhere.

---

## Environment Separation

`UNABLE_TO_CONFIRM — OWNER REVIEW REQUIRED`: Whether separate development and production databases are used, and how schema changes are promoted between them, cannot be confirmed from code alone beyond what `replit.md` states.

The drift guard and merge guard exist precisely to prevent unreviewed destructive changes from reaching the production database.

---

## Domain Groups and Tables

### Identity and Access

| Table | Purpose | Key Relationships |
|---|---|---|
| `admin_users` | Core user/employee record. Stores credentials, role, profile, salary, shift, and preferences. | References `departments`, `salary_structures`. Self-referencing `manager_id` (ORM-only, no DB FK). |
| `audit_logs` | Generic system-wide action audit trail. | References `admin_users` (actor, target). |
| `notifications` | In-app notification delivery. | References `admin_users`. |
| `notification_preferences` | Per-user per-type channel preferences (in-app, email). | References `admin_users`. |
| `internal_request_audit_log` | Audit trail for help desk request state transitions. | References `admin_users`, `internal_requests`. |
| `vault_audit_logs` | Access log for the Systems Vault (reveal, copy, create, edit, archive events). | References `admin_users`, `vaults`. |
| `sessions` | PostgreSQL-backed session store for `express-session`. | Managed by `connect-pg-simple`. |
| `system_settings` | JSONB key-value store for all platform configuration (feature flags, access control matrix, payroll settings, etc.). | No FK constraints. |

### Employee Management

| Table | Purpose | Key Relationships |
|---|---|---|
| `departments` | Organizational units. | Self-referencing `head_id`. |
| `employee_documents` | Post-onboarding document checklist and upload metadata. | References `admin_users` (user, verifier). |
| `employee_bank_details` | Bank account information for payroll disbursement. | References `admin_users` (unique per user). |
| `employee_emergency_contacts` | Next-of-kin contact registry. | References `admin_users`. |
| `night_shift_consents` | Legal consent tracking for non-standard working hours. | References `admin_users`. |
| `onboarding_audit_events` | Bulk training assignment audit milestones. | References `admin_users`. |
| `hr_letters` | HR letter lifecycle (experience, internship, relieving, amendment types). | References `admin_users` (employee, signatories, approvers). |
| `policy_documents` | Company policy publications. | — |
| `policy_signing_requests` | Assignment of a policy to an employee for signing. | References `admin_users`, `policy_documents`. |
| `policy_signatures` | Employee e-signature evidence for policies. | References `admin_users`, `policy_signing_requests`. |
| `signature_records` | General-purpose cryptographic signature evidence. | References `admin_users`. |
| `shifts` | Work schedule definitions (IST start/end times, shift type). | — |
| `dst_config` | Daylight savings time adjustment configuration. | — |
| `shift_assignment_log` | Historical record of employee shift assignments. | References `admin_users`, `shifts`. |

### Attendance and Leave

| Table | Purpose | Key Relationships |
|---|---|---|
| `attendance` | Daily punch-in/out records and computed hours. | References `admin_users` (user, corrector, exception resolver). |
| `attendance_regularizations` | Employee-submitted requests to correct attendance. | References `admin_users`, `attendance`. |
| `attendance_report_runs` | Monthly attendance report batches. | — |
| `attendance_report_entries` | Per-employee rows within a report run. | References `admin_users`, `attendance_report_runs`. |
| `attendance_escalation_log` | Log of automated late-arrival notification escalations. | References `admin_users`. |
| `holidays` | Company holiday calendar. | — |
| `regional_holiday_selections` | Employee-selected optional regional holidays. | References `admin_users`, `holidays`. Unique index on (user, holiday, year). |
| `leave_types` | Leave category definitions (EL, SL, EML, Maternity, etc.) with accrual rules. | — |
| `leave_balances` | Current leave entitlement per employee per year. | References `admin_users`, `leave_types`. |
| `leave_requests` | Employee leave applications and approval workflow. | References `admin_users` (user, reviewer), `leave_types`. |
| `leave_accruals` | Monthly accrual calculation log. | References `admin_users`, `leave_types`. |
| `leave_adjustments` | Manual HR corrections to leave balances. | References `admin_users` (user, adjuster), `leave_types`. |
| `break_records` | Lunch and tea break start/end tracking. | References `admin_users`. |
| `tickets` | Internal regularization and correction tickets. | References `admin_users` (user, reviewer), `attendance`. |

### Payroll and Finance

| Table | Purpose | Key Relationships |
|---|---|---|
| `salary_slips` | Generated payroll records with earnings, deductions, and India statutory breakdown. | References `admin_users`, `salary_report_runs`. Unique index on (user, year, month, version). |
| `salary_report_runs` | Monthly payroll batch tracking (pending_approval → approved → sent → executed). | — |
| `salary_run_payments` | Per-employee payment unlock within a payroll run. | References `admin_users`, `salary_report_runs`. |
| `salary_advance_requests` | Full lifecycle of employee salary advances and overpayment records. | References `admin_users`. |
| `salary_advance_repayments` | Scheduled monthly recovery installments for active advances. | References `salary_advance_requests`. |
| `salary_changes` | Ledger of all compensation changes with proof and maker-checker. | References `admin_users`. |
| `salary_structures` | Component breakdown templates for gross-to-net calculation. | — |
| `salary_structure_rules` | Component rules (percent_of_gross, percent_of_component, fixed, residual). | References `salary_structures`. |
| `salary_structure_history` | Timeline of which structure was assigned to an employee. | References `admin_users`, `salary_structures`. |
| `state_deductions` | State-specific Professional Tax slabs. | — |
| `establishment_coverage` | Company eligibility tracking for PF/ESI statutory schemes. | — |
| `headcount_history` | Monthly headcount snapshots for statutory compliance. | — |
| `payroll_settings` | Global payroll configuration (LOP mode, default jurisdiction). | — |
| `gsa_rate_snapshots` | Cached GSA federal travel rates for healthcare recruiter tool. | — |
| `travel_margin_floors` | Margin guidelines for travel quote calculations. | — |
| `travel_quotes` | Travel compensation quote records. | References `admin_users`. |
| `travel_quote_outputs` | Computed quote line items. | References `travel_quotes`. |

### Training and Growth

| Table | Purpose | Key Relationships |
|---|---|---|
| `learning_tracks` | Training curricula (tracks with sections). | — |
| `track_sections` | Individual modules within a track. | References `learning_tracks`. |
| `section_quiz_questions` | Quiz questions for training sections. | References `track_sections`. |
| `section_quiz_options` | Answer options for quiz questions. | References `section_quiz_questions`. |
| `track_assignments` | Employee training assignment and progress tracking. | References `admin_users`, `learning_tracks`. |
| `track_completions` | Completion records. | References `admin_users`, `learning_tracks`. |
| `section_progress` | Granular per-section dwell time and progress. | References `track_assignments`. |
| `section_acknowledgements` | Per-section acknowledgement records. | References `admin_users`, `track_sections`. |
| `training_extension_requests` | Workflow for requesting and approving training deadline extensions. | References `track_assignments`, `admin_users`. |
| `role_training_rules` | Mapping of required learning tracks to specific job roles. | References `learning_tracks`. |
| `training_sop_links` | Association between SOPs and training tracks. | References `sop_documents`, `learning_tracks`. |

### Performance and Governance

| Table | Purpose | Key Relationships |
|---|---|---|
| `performance_goals` | Employee SMART goals with progress and milestone tracking. | References `admin_users`. |
| `goal_milestones` | Deliverable milestones within a goal. | References `performance_goals`. |
| `check_ins` | Manager-employee recurring review meetings with scoring. | References `admin_users`, `performance_goals`, `employee_plans`. |
| `review_cycles` | Named performance review periods. | References `admin_users` (creator). |
| `reviews` | Self and manager appraisal submissions within a cycle. | References `review_cycles`, `admin_users` (employee, reviewer). |
| `performance_feedback` | Praise, constructive, and general feedback. | References `admin_users` (from, to), `performance_goals`. |
| `employee_plans` | Probation, Growth, and PIP plan lifecycle. | References `admin_users`. |
| `plan_goal_templates` | Seeded goal templates for plan types by department/role/level. | — |
| `plan_acknowledgements` | Employee digital countersignature of a plan. | References `admin_users`, `employee_plans`. |
| `probation_scoring_bands` | Scoring thresholds for probation milestones. | — |
| `probation_final_weights` | Weighting rules for probation outcome calculation. | — |
| `probation_pass_rule` | Pass/fail threshold for probation outcome. | — |
| `coaching_log_entries` | Ad-hoc manager notes on employee performance. | References `admin_users`. |
| `governance_controls` | Centralized obligation and compliance tracking. | References `admin_users`. |
| `sop_documents` | Standard Operating Procedure repository with lifecycle status. | — |
| `sop_role_assignments` | Which roles are assigned to which SOPs. | References `sop_documents`. |
| `sop_employee_progress` | Per-employee SOP acknowledgement with cryptographic hash. Unique on (sopMasterId, userId). | References `admin_users`, `sop_documents`. |
| `sop_audit_records` | Weekly SOP audit scoring records. | References `sop_documents`. |
| `sop_audit_findings` | Individual findings within an audit record. | References `sop_audit_records`. |
| `sop_review_assignments` | Reviewer assignments for SOP drafts. | References `sop_documents`, `admin_users`. |
| `sop_comments` | Comments on SOP drafts during review. | References `sop_documents`, `admin_users`. |
| `rollout_waves` | Wave configuration for phased SOP enforcement. | — |
| `wave_sops` | SOP-to-wave membership. | References `rollout_waves`, `sop_documents`. |

### Recruitment and Offers

| Table | Purpose | Key Relationships |
|---|---|---|
| `jobs` | Job postings (manual or Ceipal-synced). | — |
| `applications` | Candidate applications with Ceipal sync status. | References `jobs`. |
| `offer_letters` | Employment offer lifecycle (draft/pending/sent/accepted/countersigned/onboarded). | References `admin_users` (resulting employee). |
| `offer_letter_addendums` | Post-hire amendments (growth clause, device allocation, salary revision). | References `offer_letters`, `admin_users`. |
| `role_summary_templates` | Templates for role-specific offer verbiage. | — |

### Content Studio

| Table | Purpose | Key Relationships |
|---|---|---|
| `studio_projects` | Top-level content project containers. | — |
| `studio_author_profiles` | Author bios and consent records. | References `admin_users`, `studio_projects`. |
| `studio_articles` | AI-assisted article drafts and publication records. | References `studio_projects`, `studio_author_profiles`. |
| `studio_article_versions` | Version history for article edits. | References `studio_articles`. |
| `studio_content_ideas` | Ideation board entries. | — |
| `studio_idea_comments` | Comments on content ideas. | References `admin_users`, `studio_content_ideas`. |
| `studio_idea_watchers` | Subscriptions to idea updates. | References `admin_users`, `studio_content_ideas`. |
| `studio_campaigns` | Marketing campaign management. | — |
| `studio_outreach_sequences` | Outreach email sequences. | References `studio_campaigns`. |
| `studio_generations` | AI generation task records and outputs. | — |
| `studio_prompt_templates` | Reusable AI prompt templates. | — |
| `studio_brand_settings` | Brand voice and AI generation configuration. | — |
| `studio_import_batches` | Tracking of bulk content imports. | — |
| `studio_newsletter_subscribers` | Email list for Insights newsletter. | — |
| `studio_audit_events` | Studio user action log. | References `admin_users`. |
| `studio_engagement_events` | Article view and reaction events. | References `studio_articles`. |
| `studio_occasions` | Calendar of occasions for content scheduling. | — |
| `card_templates` | Visual templates for AI-generated social media cards. | — |
| `bd_conversations` | BD Agent conversation sessions. | References `admin_users`. |
| `bd_messages` | Individual messages within BD Agent conversations. | References `bd_conversations`. |
| `bd_decks` | Business development pitch decks. | References `admin_users`. |
| `bd_deck_audit_log` | Version history for BD decks. | References `bd_decks`, `admin_users`. |

### Shared Services

| Table | Purpose | Key Relationships |
|---|---|---|
| `contacts` | Public contact form submissions. | — |
| `internal_requests` | Help desk tickets with approval workflow (HIRD). | References `admin_users`. |
| `internal_request_comments` | Thread comments on help desk tickets. | References `admin_users`, `internal_requests`. |
| `internal_request_approvals` | Approval records for HIRD decisions. | References `admin_users`, `internal_requests`. |
| `vaults` | Named credential vault containers. | References `admin_users`. |
| `vault_secrets` | Individual secrets within a vault. | References `vaults`, `admin_users`. |
| `vault_secret_grants` | Access grants for specific users to specific secrets. | References `admin_users`, `vault_secrets`. |
| `vault_access_requests` | Employee requests for access to a vault secret. | References `admin_users`, `vault_secrets`. |
| `praise_posts` | Public employee recognition posts. | References `admin_users`. |
| `praise_badge_types` | Badge definitions for recognition. | — |
| `praise_reactions` | Emoji reactions on praise posts. | References `admin_users`, `praise_posts`. |
| `praise_comments` | Comments on praise posts. | References `admin_users`, `praise_posts`. |
| `pinned_praise_posts` | Admin-pinned recognition posts. | References `admin_users`, `praise_posts`. |
| `release_notes` | Platform version history entries. | References `admin_users`. |

---

## Mermaid ERD — Simplified Domain View

```mermaid
erDiagram
    IDENTITY_ACCESS {
        admin_users
        audit_logs
        system_settings
        sessions
    }
    EMPLOYEE_MANAGEMENT {
        departments
        employee_documents
        employee_bank_details
        hr_letters
        shifts
    }
    ATTENDANCE_LEAVE {
        attendance
        leave_requests
        leave_balances
        leave_accruals
        holidays
    }
    PAYROLL_FINANCE {
        salary_slips
        salary_report_runs
        salary_advance_requests
        salary_structures
        payroll_settings
    }
    TRAINING_GROWTH {
        learning_tracks
        track_assignments
        sop_documents
        employee_plans
    }
    PERFORMANCE_GOVERNANCE {
        performance_goals
        check_ins
        review_cycles
        governance_controls
    }
    RECRUITMENT_OFFERS {
        jobs
        applications
        offer_letters
        offer_letter_addendums
    }
    CONTENT_STUDIO {
        studio_articles
        studio_content_ideas
        bd_conversations
    }
    SHARED_SERVICES {
        contacts
        internal_requests
        vaults
        notifications
    }

    IDENTITY_ACCESS ||--o{ EMPLOYEE_MANAGEMENT : "admin_users owns"
    IDENTITY_ACCESS ||--o{ ATTENDANCE_LEAVE : "admin_users records"
    IDENTITY_ACCESS ||--o{ PAYROLL_FINANCE : "admin_users earns"
    IDENTITY_ACCESS ||--o{ TRAINING_GROWTH : "admin_users assigned to"
    IDENTITY_ACCESS ||--o{ PERFORMANCE_GOVERNANCE : "admin_users reviewed in"
    RECRUITMENT_OFFERS ||--o{ IDENTITY_ACCESS : "offer accepted creates admin_user"
    CONTENT_STUDIO }o--|| SHARED_SERVICES : "notifications, contacts"
```

---

## Key Schema Conventions

These conventions are confirmed and must be followed by all future schema additions. `CONFIRMED_IN_EXISTING_GUIDE`

1. `shared/schema.ts` is the single source of truth. Every column must be declared here before it exists in a production database.
2. Ensure-block columns (added via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in `server/index.ts`) must be declared in `shared/schema.ts` or they will be flagged as orphans and deleted by the next `db:push`.
3. `db:push` uses the phrase "delete `<x>` column" not "drop column" — drift guards must match that exact wording.
4. The `db:push` command requires a TTY. For new tables needed in production without a TTY, use a direct SQL script.
5. Never resolve a drizzle "is created or renamed" prompt as a rename — it is data-destructive.
6. Migration files in `migrations/` are dormant. Do not run them manually against production.
