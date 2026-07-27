-- =============================================================================
-- Idempotent schema migration — safe for manual emergency application
-- =============================================================================
-- Source: attached_assets/Pasted-CREATE-TYPE-public-contract-type-AS-ENUM-contract-hourl_1785175290479.txt
-- Plus schema.ts fixes from task #1708:
--   • scheduled_nudges.sent_at — no DEFAULT (NULL until nudge fires)
--   • recognition_certificates.superseded_by_id — self-referential FK added
--
-- Idempotency guarantees applied:
--   • CREATE TYPE         → wrapped in DO $$ BEGIN … EXCEPTION WHEN duplicate_object THEN null; END $$
--   • ALTER TYPE ADD VALUE '…' → ADD VALUE IF NOT EXISTS '…'
--   • CREATE TABLE        → CREATE TABLE IF NOT EXISTS
--   • ALTER TABLE ADD COLUMN → ADD COLUMN IF NOT EXISTS
--   • ALTER TABLE ADD CONSTRAINT → wrapped in DO $$ BEGIN … EXCEPTION WHEN duplicate_object THEN null; END $$
--   • CREATE [UNIQUE] INDEX → CREATE [UNIQUE] INDEX IF NOT EXISTS
--
-- Run:  psql $DATABASE_URL -f scripts/apply-schema-migration-safe.sql
-- =============================================================================

-- ── Enum types ────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "public"."contract_type" AS ENUM('contract_hourly', 'permanent_placement', 'contract_to_hire');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."inbox_assignee_tier" AS ENUM('manager', 'hr_admin', 'super_admin');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."inbox_audit_action" AS ENUM('deferred', 'escalated', 'auto_escalated', 'act_clicked', 'resolved');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."inbox_item_status" AS ENUM('new', 'deferred', 'escalated', 'resolved');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."inbox_item_type" AS ENUM('leave_approval', 'offer_letter', 'probation_checkin', 'attendance_correction', 'pip_checkin', 'training_compliance');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."letter_review_cycle_action" AS ENUM('approved', 'needs_revision', 'withdrawn', 'resubmitted');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."plan_meeting_type" AS ENUM('check_in', 'coaching', 'pip_review', 'probation_review', 'informal');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── Enum value additions ──────────────────────────────────────────────────────
ALTER TYPE "public"."contract_status" ADD VALUE IF NOT EXISTS 'pending_review';
ALTER TYPE "public"."contract_status" ADD VALUE IF NOT EXISTS 'needs_revision';
ALTER TYPE "public"."hr_letter_status" ADD VALUE IF NOT EXISTS 'needs_revision';
ALTER TYPE "public"."hr_letter_status" ADD VALUE IF NOT EXISTS 'resubmitted';
ALTER TYPE "public"."hr_letter_status" ADD VALUE IF NOT EXISTS 'withdrawn';
ALTER TYPE "public"."performance_goal_category" ADD VALUE IF NOT EXISTS 'compliance';
ALTER TYPE "public"."performance_goal_category" ADD VALUE IF NOT EXISTS 'operational';

-- ── New tables ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "zoom_ai_insights" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"insight_type" varchar NOT NULL,
	"subject_id" varchar,
	"subject_type" varchar,
	"content" jsonb NOT NULL,
	"generated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "recognition_certificate_views" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"certificate_id" varchar NOT NULL,
	"reference_number" varchar NOT NULL,
	"viewed_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" varchar,
	"user_agent" text
);

CREATE TABLE IF NOT EXISTS "zoom_sms_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"zoom_session_id" varchar,
	"user_id" varchar,
	"zoom_user_id" varchar,
	"peer_number" varchar,
	"session_start" timestamp,
	"session_end" timestamp,
	"message_count" integer DEFAULT 0,
	"sanitized_thread" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "zoom_sms_sessions_zoom_session_id_unique" UNIQUE("zoom_session_id")
);

CREATE TABLE IF NOT EXISTS "zoom_sms_digests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"date" varchar NOT NULL,
	"digest_text" text,
	"generated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "zoom_sms_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"zoom_message_id" varchar,
	"body" text,
	"direction" varchar,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "zoom_sms_messages_zoom_message_id_unique" UNIQUE("zoom_message_id")
);

CREATE TABLE IF NOT EXISTS "recognition_certificate_audit" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"certificate_id" varchar NOT NULL,
	"actor_id" varchar NOT NULL,
	"action" varchar NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "zoom_call_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"zoom_call_id" varchar,
	"user_id" varchar,
	"zoom_user_id" varchar,
	"direction" varchar,
	"duration" integer,
	"caller_number" varchar,
	"callee_number" varchar,
	"start_time" timestamp,
	"end_time" timestamp,
	"status" varchar,
	"raw_data" jsonb,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "zoom_call_logs_zoom_call_id_unique" UNIQUE("zoom_call_id")
);

CREATE TABLE IF NOT EXISTS "zoom_sync_meta" (
	"id" text PRIMARY KEY NOT NULL,
	"last_synced_at" timestamp,
	"last_synced_date" date,
	"synced_user_count" integer DEFAULT 0,
	"status" text DEFAULT 'idle' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "recognition_certificates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"praise_post_id" varchar,
	"certificate_id" varchar NOT NULL,
	"recipient_id" varchar NOT NULL,
	"approver_id" varchar NOT NULL,
	"badge_type_id" varchar NOT NULL,
	"recognition_description" text NOT NULL,
	"contribution_summary" text NOT NULL,
	"public_citation" text NOT NULL,
	"recognition_context" varchar,
	"reference_number" varchar NOT NULL,
	"auth_code" varchar NOT NULL,
	"document_hash" varchar NOT NULL,
	"pdf_storage_path" varchar,
	"pdf_url" varchar,
	"status" varchar DEFAULT 'issued' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"superseded_by_id" varchar,
	"issued_at" timestamp DEFAULT now(),
	"revoked_at" timestamp,
	"revoked_by_id" varchar,
	"correction_reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "recognition_certificates_certificate_id_unique" UNIQUE("certificate_id"),
	CONSTRAINT "recognition_certificates_reference_number_unique" UNIQUE("reference_number")
);

CREATE TABLE IF NOT EXISTS "training_evidence_submissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"track_assignment_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"sop_code" text NOT NULL,
	"training_id" varchar,
	"evidence_type" text NOT NULL,
	"evidence_notes" text,
	"evidence_url" text,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"review_status" text DEFAULT 'pending' NOT NULL,
	"review_notes" text
);

CREATE TABLE IF NOT EXISTS "manager_inbox_audit" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action_due_date_id" varchar NOT NULL,
	"actor_id" varchar NOT NULL,
	"action" "inbox_audit_action" NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "letter_review_cycles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"letter_id" varchar NOT NULL,
	"letter_type" varchar NOT NULL,
	"round" integer NOT NULL,
	"action" "letter_review_cycle_action" NOT NULL,
	"reason" text,
	"reviewed_by" varchar,
	"reviewed_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "letter_templates" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "letter_templates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar NOT NULL,
	"description" text,
	"letter_type" varchar NOT NULL,
	"template_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"usage_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "letter_templates_name_type_unique" UNIQUE("name","letter_type")
);

CREATE TABLE IF NOT EXISTS "plan_meetings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" varchar NOT NULL,
	"logged_by" varchar NOT NULL,
	"meeting_date" varchar NOT NULL,
	"duration_minutes" integer,
	"meeting_type" "plan_meeting_type" DEFAULT 'check_in' NOT NULL,
	"attendees" jsonb,
	"check_in_id" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"deleted_at" timestamp
);

CREATE TABLE IF NOT EXISTS "manager_action_due_dates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignee_id" varchar NOT NULL,
	"assignee_tier" "inbox_assignee_tier" NOT NULL,
	"item_type" "inbox_item_type" NOT NULL,
	"item_id" varchar NOT NULL,
	"defer_until" timestamp,
	"escalated_at" timestamp,
	"escalation_reason" text,
	"original_assigned_at" timestamp DEFAULT now(),
	"status" "inbox_item_status" DEFAULT 'new' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "designation_changes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" varchar NOT NULL,
	"old_designation" varchar,
	"new_designation" varchar NOT NULL,
	"old_department" varchar,
	"new_department" varchar,
	"effective_date" varchar NOT NULL,
	"source_type" varchar DEFAULT 'manual' NOT NULL,
	"source_document_id" varchar,
	"source_document_type" varchar,
	"reason" text,
	"initiated_by" varchar,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "contract_reminder_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" varchar NOT NULL,
	"reminder_type" varchar NOT NULL,
	"sent_to" varchar NOT NULL,
	"sent_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "bd_deals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prospect_id" varchar NOT NULL,
	"title" varchar(300) NOT NULL,
	"stage" varchar(50) DEFAULT 'discovery' NOT NULL,
	"deal_value" numeric(15, 2),
	"headcount" integer,
	"specialty" varchar(100),
	"probability" integer,
	"expected_close_date" date,
	"won_at" timestamp,
	"lost_at" timestamp,
	"lost_reason" text,
	"assigned_to" varchar,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- scheduled_nudges: sent_at has NO DEFAULT — NULL until the nudge actually fires.
-- On fresh installs this column is nullable with no default, matching shared/schema.ts.
-- On existing installs the ALTER below drops the default if it was previously set.
CREATE TABLE IF NOT EXISTS "scheduled_nudges" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" varchar NOT NULL,
	"nudge_type" varchar NOT NULL,
	"nudge_date" varchar NOT NULL,
	"check_in_id" varchar,
	"sent_at" timestamp
);
-- Drop the legacy DEFAULT now() if the column was created with it
ALTER TABLE "scheduled_nudges" ALTER COLUMN "sent_at" DROP DEFAULT;

CREATE TABLE IF NOT EXISTS "bd_activities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prospect_id" varchar,
	"deal_id" varchar,
	"activity_type" varchar(50) NOT NULL,
	"subject" varchar(300) NOT NULL,
	"body" text,
	"duration_minutes" integer,
	"outcome" varchar(50),
	"activity_date" date NOT NULL,
	"logged_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "bd_prospects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" varchar(300) NOT NULL,
	"contact_name" varchar(200),
	"contact_email" varchar(200),
	"contact_phone" varchar(50),
	"industry" varchar(100),
	"source" varchar(100),
	"status" varchar(50) DEFAULT 'new' NOT NULL,
	"icp_score" integer,
	"assigned_to" varchar,
	"linked_client_id" varchar,
	"notes" text,
	"last_activity_at" timestamp,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- ── Column additions (all idempotent with IF NOT EXISTS) ──────────────────────
ALTER TABLE "employee_plans" ALTER COLUMN "start_date" DROP NOT NULL;
ALTER TABLE "employee_plans" ALTER COLUMN "end_date" DROP NOT NULL;
ALTER TABLE "vault_secrets" ALTER COLUMN "login_url" SET DATA TYPE text;
ALTER TABLE "section_quiz_questions" ADD COLUMN IF NOT EXISTS "include_for_awareness" boolean DEFAULT false NOT NULL;
ALTER TABLE "section_quiz_questions" ADD COLUMN IF NOT EXISTS "question_type" text DEFAULT 'single_choice' NOT NULL;
ALTER TABLE "section_quiz_questions" ADD COLUMN IF NOT EXISTS "cognitive_level" text;
ALTER TABLE "section_quiz_questions" ADD COLUMN IF NOT EXISTS "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "section_quiz_questions" ADD COLUMN IF NOT EXISTS "auto_gradable" boolean DEFAULT true NOT NULL;
ALTER TABLE "section_quiz_questions" ADD COLUMN IF NOT EXISTS "points" integer DEFAULT 1 NOT NULL;
ALTER TABLE "section_quiz_questions" ADD COLUMN IF NOT EXISTS "options" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "section_quiz_questions" ADD COLUMN IF NOT EXISTS "correct_option" text;
ALTER TABLE "section_quiz_questions" ADD COLUMN IF NOT EXISTS "correct_answer_text" text;
ALTER TABLE "section_quiz_questions" ADD COLUMN IF NOT EXISTS "requires_human_review" boolean DEFAULT false NOT NULL;
ALTER TABLE "section_quiz_questions" ADD COLUMN IF NOT EXISTS "quiz_version" text;
ALTER TABLE "section_quiz_questions" ADD COLUMN IF NOT EXISTS "question_no" integer;
ALTER TABLE "section_quiz_questions" ADD COLUMN IF NOT EXISTS "question_id" text;
ALTER TABLE "track_assignments" ADD COLUMN IF NOT EXISTS "assignment_level" text DEFAULT 'required' NOT NULL;
ALTER TABLE "track_assignments" ADD COLUMN IF NOT EXISTS "assignment_reason" text;
ALTER TABLE "track_assignments" ADD COLUMN IF NOT EXISTS "source_sop_role_assignment_id" varchar;
ALTER TABLE "track_assignments" ADD COLUMN IF NOT EXISTS "resolved_role_group" text;
ALTER TABLE "track_assignments" ADD COLUMN IF NOT EXISTS "resolved_department" text;
ALTER TABLE "track_assignments" ADD COLUMN IF NOT EXISTS "required_question_count" integer DEFAULT 8 NOT NULL;
ALTER TABLE "track_assignments" ADD COLUMN IF NOT EXISTS "required_pass_score" integer DEFAULT 80 NOT NULL;
ALTER TABLE "track_assignments" ADD COLUMN IF NOT EXISTS "evidence_required" boolean DEFAULT false NOT NULL;
ALTER TABLE "track_assignments" ADD COLUMN IF NOT EXISTS "manager_signoff_required" boolean DEFAULT false NOT NULL;
ALTER TABLE "track_assignments" ADD COLUMN IF NOT EXISTS "manager_signoff_status" text;
ALTER TABLE "track_assignments" ADD COLUMN IF NOT EXISTS "sop_code" text;
ALTER TABLE "track_assignments" ADD COLUMN IF NOT EXISTS "sop_version" integer;
ALTER TABLE "hr_letters" ADD COLUMN IF NOT EXISTS "draft_data" jsonb;
ALTER TABLE "hr_letters" ADD COLUMN IF NOT EXISTS "revision_round" integer DEFAULT 0 NOT NULL;
ALTER TABLE "hr_letters" ADD COLUMN IF NOT EXISTS "revision_reason" text;
ALTER TABLE "hr_letters" ADD COLUMN IF NOT EXISTS "cc_recipients" jsonb;
ALTER TABLE "hr_letters" ADD COLUMN IF NOT EXISTS "from_template_id" integer;
ALTER TABLE "hr_letters" ADD COLUMN IF NOT EXISTS "amendment_subtype" varchar;
ALTER TABLE "learning_tracks" ADD COLUMN IF NOT EXISTS "passing_score" integer DEFAULT 80;
ALTER TABLE "learning_tracks" ADD COLUMN IF NOT EXISTS "acknowledgment_required" boolean DEFAULT true;
ALTER TABLE "praise_posts" ADD COLUMN IF NOT EXISTS "visibility" varchar DEFAULT 'public' NOT NULL;
ALTER TABLE "praise_posts" ADD COLUMN IF NOT EXISTS "certificate_requested" boolean DEFAULT false NOT NULL;
ALTER TABLE "praise_posts" ADD COLUMN IF NOT EXISTS "certificate_status" varchar;
ALTER TABLE "praise_posts" ADD COLUMN IF NOT EXISTS "recognition_description" text;
ALTER TABLE "praise_posts" ADD COLUMN IF NOT EXISTS "contribution_summary" text;
ALTER TABLE "praise_posts" ADD COLUMN IF NOT EXISTS "public_citation_draft" text;
ALTER TABLE "praise_posts" ADD COLUMN IF NOT EXISTS "public_citation_approved" text;
ALTER TABLE "praise_posts" ADD COLUMN IF NOT EXISTS "recognition_context" varchar;
ALTER TABLE "plan_goal_templates" ADD COLUMN IF NOT EXISTS "due_day_offset" integer;
ALTER TABLE "employee_plans" ADD COLUMN IF NOT EXISTS "pip_hr_acknowledged_at" timestamp;
ALTER TABLE "sop_role_assignments" ADD COLUMN IF NOT EXISTS "assignment_level" text DEFAULT 'required' NOT NULL;
ALTER TABLE "sop_role_assignments" ADD COLUMN IF NOT EXISTS "assignment_reason" text;
ALTER TABLE "sop_role_assignments" ADD COLUMN IF NOT EXISTS "role_group_key" text;
ALTER TABLE "sop_role_assignments" ADD COLUMN IF NOT EXISTS "department_key" text;
ALTER TABLE "sop_role_assignments" ADD COLUMN IF NOT EXISTS "applies_to_all" boolean DEFAULT false NOT NULL;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "ceipal_pay_rates" jsonb;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "ceipal_industry" text;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "ceipal_client" text;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "ceipal_primary_recruiter" text;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "remote_opportunities" text;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "closing_date" date;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "primary_recruiter" varchar;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "assigned_recruiter" varchar;
ALTER TABLE "check_ins" ADD COLUMN IF NOT EXISTS "prompt_key" varchar;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "contract_type" "contract_type" DEFAULT 'contract_hourly' NOT NULL;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "currency" varchar DEFAULT 'USD' NOT NULL;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "passthrough_fee" numeric;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "referral_fee" numeric;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "gross_margin" numeric;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "business_marketing_cost" numeric;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "net_margin" numeric;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "contract_to_hire_conversion_date" date;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "conversion_fee" numeric;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "contractor_details" jsonb;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "submission_revision_reason" text;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "billing_start_date" date;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "next_billing_date" date;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "billing_reminder_days_before" integer DEFAULT 2;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "escalation_config" jsonb;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "billing_type" varchar DEFAULT 'recurring';
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "timesheet_confirmed_at" timestamp;
ALTER TABLE "vaults" ADD COLUMN IF NOT EXISTS "scope" varchar(20) DEFAULT 'admin' NOT NULL;
ALTER TABLE "vault_shares" ADD COLUMN IF NOT EXISTS "can_edit" boolean DEFAULT false NOT NULL;
ALTER TABLE "performance_goals" ADD COLUMN IF NOT EXISTS "source" varchar(64);
ALTER TABLE "performance_goals" ADD COLUMN IF NOT EXISTS "parent_goal_id" varchar;
ALTER TABLE "performance_goals" ADD COLUMN IF NOT EXISTS "kpi_target" integer;

-- ── Foreign key constraints (all guarded against duplicate_object) ────────────
DO $$ BEGIN
  ALTER TABLE "recognition_certificate_views" ADD CONSTRAINT "recognition_certificate_views_certificate_id_recognition_certif" FOREIGN KEY ("certificate_id") REFERENCES "public"."recognition_certificates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "recognition_certificate_audit" ADD CONSTRAINT "recognition_certificate_audit_actor_id_admin_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "recognition_certificate_audit" ADD CONSTRAINT "recognition_certificate_audit_certificate_id_recognition_certif" FOREIGN KEY ("certificate_id") REFERENCES "public"."recognition_certificates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "recognition_certificates" ADD CONSTRAINT "recognition_certificates_approver_id_admin_users_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "recognition_certificates" ADD CONSTRAINT "recognition_certificates_badge_type_id_praise_badge_types_id_fk" FOREIGN KEY ("badge_type_id") REFERENCES "public"."praise_badge_types"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "recognition_certificates" ADD CONSTRAINT "recognition_certificates_praise_post_id_praise_posts_id_fk" FOREIGN KEY ("praise_post_id") REFERENCES "public"."praise_posts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "recognition_certificates" ADD CONSTRAINT "recognition_certificates_recipient_id_admin_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "recognition_certificates" ADD CONSTRAINT "recognition_certificates_revoked_by_id_admin_users_id_fk" FOREIGN KEY ("revoked_by_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Self-referential FK: superseded_by_id → recognition_certificates(id) ON DELETE SET NULL
DO $$ BEGIN
  ALTER TABLE "recognition_certificates" ADD CONSTRAINT "recognition_certificates_superseded_by_id_fk" FOREIGN KEY ("superseded_by_id") REFERENCES "public"."recognition_certificates"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "training_evidence_submissions" ADD CONSTRAINT "training_evidence_submissions_reviewed_by_admin_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "training_evidence_submissions" ADD CONSTRAINT "training_evidence_submissions_track_assignment_id_track_assignm" FOREIGN KEY ("track_assignment_id") REFERENCES "public"."track_assignments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "training_evidence_submissions" ADD CONSTRAINT "training_evidence_submissions_training_id_learning_tracks_id_fk" FOREIGN KEY ("training_id") REFERENCES "public"."learning_tracks"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "training_evidence_submissions" ADD CONSTRAINT "training_evidence_submissions_user_id_admin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "manager_inbox_audit" ADD CONSTRAINT "manager_inbox_audit_action_due_date_id_manager_action_due_dates" FOREIGN KEY ("action_due_date_id") REFERENCES "public"."manager_action_due_dates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "manager_inbox_audit" ADD CONSTRAINT "manager_inbox_audit_actor_id_admin_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "letter_review_cycles" ADD CONSTRAINT "letter_review_cycles_reviewed_by_admin_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "letter_templates" ADD CONSTRAINT "letter_templates_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "plan_meetings" ADD CONSTRAINT "plan_meetings_logged_by_admin_users_id_fk" FOREIGN KEY ("logged_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "manager_action_due_dates" ADD CONSTRAINT "manager_action_due_dates_assignee_id_admin_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "designation_changes" ADD CONSTRAINT "designation_changes_employee_id_admin_users_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "designation_changes" ADD CONSTRAINT "designation_changes_initiated_by_admin_users_id_fk" FOREIGN KEY ("initiated_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "contract_reminder_log" ADD CONSTRAINT "contract_reminder_log_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "bd_deals" ADD CONSTRAINT "bd_deals_assigned_to_admin_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "bd_deals" ADD CONSTRAINT "bd_deals_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "bd_deals" ADD CONSTRAINT "bd_deals_prospect_id_bd_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."bd_prospects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "bd_activities" ADD CONSTRAINT "bd_activities_deal_id_bd_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."bd_deals"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "bd_activities" ADD CONSTRAINT "bd_activities_logged_by_admin_users_id_fk" FOREIGN KEY ("logged_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "bd_activities" ADD CONSTRAINT "bd_activities_prospect_id_bd_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."bd_prospects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "bd_prospects" ADD CONSTRAINT "bd_prospects_assigned_to_admin_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "bd_prospects" ADD CONSTRAINT "bd_prospects_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "bd_prospects" ADD CONSTRAINT "bd_prospects_linked_client_id_contract_clients_id_fk" FOREIGN KEY ("linked_client_id") REFERENCES "public"."contract_clients"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "training_evidence_assignment_idx" ON "training_evidence_submissions" USING btree ("track_assignment_id");
CREATE INDEX IF NOT EXISTS "training_evidence_user_idx" ON "training_evidence_submissions" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "letter_review_cycles_letter_idx" ON "letter_review_cycles" USING btree ("letter_id","letter_type");
CREATE INDEX IF NOT EXISTS "idx_plan_meetings_date" ON "plan_meetings" USING btree ("meeting_date");
CREATE INDEX IF NOT EXISTS "idx_plan_meetings_plan_id" ON "plan_meetings" USING btree ("plan_id");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_inbox_assignee_item" ON "manager_action_due_dates" USING btree ("assignee_id","item_type","item_id");
CREATE INDEX IF NOT EXISTS "bd_deals_prospect_id_idx" ON "bd_deals" USING btree ("prospect_id");
CREATE INDEX IF NOT EXISTS "bd_deals_stage_idx" ON "bd_deals" USING btree ("stage");
CREATE INDEX IF NOT EXISTS "idx_scheduled_nudges_plan_id" ON "scheduled_nudges" USING btree ("plan_id");
CREATE INDEX IF NOT EXISTS "bd_activities_activity_date_idx" ON "bd_activities" USING btree ("activity_date");
CREATE INDEX IF NOT EXISTS "bd_activities_deal_id_idx" ON "bd_activities" USING btree ("deal_id");
CREATE INDEX IF NOT EXISTS "bd_activities_prospect_id_idx" ON "bd_activities" USING btree ("prospect_id");
CREATE INDEX IF NOT EXISTS "bd_prospects_assigned_to_idx" ON "bd_prospects" USING btree ("assigned_to");
CREATE INDEX IF NOT EXISTS "bd_prospects_last_activity_idx" ON "bd_prospects" USING btree ("last_activity_at");
CREATE INDEX IF NOT EXISTS "bd_prospects_status_idx" ON "bd_prospects" USING btree ("status");
CREATE UNIQUE INDEX IF NOT EXISTS "sop_role_assignments_master_group_unique" ON "sop_role_assignments" USING btree ("sop_master_id","role_group_key");
CREATE INDEX IF NOT EXISTS "vaults_scope_idx" ON "vaults" USING btree ("scope");
