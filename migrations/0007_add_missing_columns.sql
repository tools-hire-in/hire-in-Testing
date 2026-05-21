-- Safe, idempotent migration capturing all schema drift since snapshot 0001.
-- Every statement is guarded (IF NOT EXISTS / DO…EXCEPTION) so it is safe to
-- run on a production database that already has some or all of these objects.

---------------------------------------------------------------------------
-- 1. Enum types (PostgreSQL lacks CREATE TYPE IF NOT EXISTS — use DO blocks)
---------------------------------------------------------------------------
DO $$ BEGIN CREATE TYPE "public"."break_type" AS ENUM('lunch', 'tea'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."contract_source" AS ENUM('generated', 'imported'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."contract_status" AS ENUM('draft', 'sent', 'client_signed', 'countersigned', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."employment_status" AS ENUM('active', 'relieved', 'left_company'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."hr_letter_completion_band" AS ENUM('successfully_completed', 'completed', 'served_during_period'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."hr_letter_conduct_band" AS ENUM('standard', 'good', 'very_good'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."hr_letter_performance_band" AS ENUM('factual_only', 'standard', 'good', 'very_good', 'excellent'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."hr_letter_status" AS ENUM('draft', 'pending_approval', 'approved', 'issued', 'reissued', 'revoked'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."hr_letter_template_type" AS ENUM('experience', 'internship_completion', 'internship_certificate', 'relieving', 'salary_revision', 'role_change', 'combined', 'device_allocation'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."invoice_status" AS ENUM('scheduled', 'sent', 'paid', 'overdue', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."offer_letter_addendum_status" AS ENUM('draft', 'sent', 'accepted', 'countersigned', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."offer_letter_addendum_type" AS ENUM('salary_revision', 'role_change', 'probation_extension', 'combined', 'custom', 'device_allocation'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint

---------------------------------------------------------------------------
-- 2. Enum value additions (PostgreSQL supports ADD VALUE IF NOT EXISTS)
---------------------------------------------------------------------------
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'finance' BEFORE 'operations';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'recruiter' BEFORE 'employee';--> statement-breakpoint

---------------------------------------------------------------------------
-- 3. New tables (all guarded with IF NOT EXISTS)
---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "break_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attendance_id" varchar,
	"user_id" varchar NOT NULL,
	"date" varchar NOT NULL,
	"break_type" "break_type" NOT NULL,
	"started_at" timestamp NOT NULL,
	"ended_at" timestamp,
	"duration_minutes" numeric,
	"created_at" timestamp DEFAULT now()
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contract_clients" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"address" text,
	"signatory_name" varchar,
	"signatory_title" varchar,
	"email" varchar,
	"phone" varchar,
	"website" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contract_invoices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" varchar NOT NULL,
	"invoice_number" varchar,
	"period_start" date,
	"period_end" date,
	"due_date" date,
	"amount" numeric,
	"currency" varchar DEFAULT 'USD' NOT NULL,
	"status" "invoice_status" DEFAULT 'scheduled' NOT NULL,
	"sent_at" timestamp,
	"paid_at" timestamp,
	"reminder_sent_at" timestamp,
	"notes" text,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contract_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"file_path" varchar NOT NULL,
	"placeholder_list" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"uploaded_by" varchar,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contracts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "contract_source" DEFAULT 'generated' NOT NULL,
	"template_id" varchar,
	"client_id" varchar,
	"template_name" varchar,
	"client_name" varchar NOT NULL,
	"candidate_name" varchar,
	"candidate_role" varchar,
	"variable_values" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"docx_path" varchar,
	"uploaded_doc_path" varchar,
	"contract_start_date" date,
	"contract_end_date" date,
	"margin_per_hour" varchar,
	"payment_terms_days" integer,
	"billing_frequency" varchar,
	"notes" text,
	"status" "contract_status" DEFAULT 'draft' NOT NULL,
	"signing_token" varchar,
	"document_hash" varchar,
	"auth_code" varchar,
	"client_signed_at" timestamp,
	"client_signed_ip" varchar,
	"countersigned_by" varchar,
	"countersigned_at" timestamp,
	"sent_at" timestamp,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "contracts_signing_token_unique" UNIQUE("signing_token")
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dst_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year" integer NOT NULL,
	"spring_forward_date" varchar NOT NULL,
	"fall_back_date" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "dst_config_year_unique" UNIQUE("year")
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hr_letters" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_type" "hr_letter_template_type" NOT NULL,
	"status" "hr_letter_status" DEFAULT 'draft' NOT NULL,
	"employee_id" varchar,
	"employee_name" varchar NOT NULL,
	"employee_code" varchar,
	"designation" varchar NOT NULL,
	"department" varchar,
	"employment_type" varchar,
	"location" varchar,
	"reporting_manager" varchar,
	"start_date" varchar NOT NULL,
	"end_date" varchar,
	"last_working_day" varchar,
	"performance_band" "hr_letter_performance_band",
	"conduct_band" "hr_letter_conduct_band",
	"completion_band" "hr_letter_completion_band",
	"closing_line" varchar,
	"include_responsibilities" boolean DEFAULT false,
	"responsibilities_summary" text,
	"include_project" boolean DEFAULT false,
	"project_name" varchar,
	"include_seal" boolean DEFAULT false,
	"signatory_id" varchar,
	"signatory_name" varchar,
	"signatory_designation" varchar,
	"issue_date" varchar,
	"reference_number" varchar,
	"auth_code" varchar,
	"document_hash" varchar,
	"custom_override_text" text,
	"custom_override_by" varchar,
	"custom_override_at" timestamp,
	"reissued_from_letter_id" varchar,
	"reissue_reason" text,
	"pdf_path" varchar,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"approved_by" varchar,
	"approved_at" timestamp,
	"issued_by" varchar,
	"issued_at" timestamp,
	"revoked_by" varchar,
	"revoked_at" timestamp,
	"revoke_reason" text,
	"cc_emails" text,
	"metadata" jsonb,
	"manual_employee_email" varchar,
	CONSTRAINT "hr_letters_reference_number_unique" UNIQUE("reference_number")
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "letter_template_sentences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar NOT NULL,
	"category" varchar NOT NULL,
	"label" varchar NOT NULL,
	"sentence" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "night_shift_consents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"signed_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"typed_name" varchar NOT NULL,
	"ip_address" varchar,
	"is_active" boolean DEFAULT true NOT NULL,
	"document_hash" varchar,
	"created_at" timestamp DEFAULT now(),
	"status" varchar DEFAULT 'active' NOT NULL,
	"withdrawn_at" timestamp,
	"version" integer DEFAULT 1 NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "offer_letter_addendums" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_letter_id" varchar NOT NULL,
	"token" varchar NOT NULL,
	"addendum_type" "offer_letter_addendum_type" NOT NULL,
	"status" "offer_letter_addendum_status" DEFAULT 'draft' NOT NULL,
	"old_designation" varchar,
	"new_designation" varchar,
	"old_department" varchar,
	"new_department" varchar,
	"old_salary" varchar,
	"new_salary" varchar,
	"old_salary_in_words" varchar,
	"new_salary_in_words" varchar,
	"old_confirmation_date" varchar,
	"new_confirmation_date" varchar,
	"custom_clause_title" varchar,
	"custom_clause_text" text,
	"device_items" jsonb,
	"cc_emails" text,
	"effective_date" varchar,
	"reason" text,
	"hr_manager_name" varchar,
	"issued_by" varchar,
	"issued_at" timestamp,
	"candidate_name" varchar NOT NULL,
	"accepted_at" timestamp,
	"accepted_ip" varchar,
	"accepted_name" varchar,
	"auth_code" varchar,
	"document_hash" varchar,
	"counter_signed_by" varchar,
	"counter_signed_at" timestamp,
	"counter_auth_code" varchar,
	"counter_document_hash" varchar,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "offer_letter_addendums_token_unique" UNIQUE("token")
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "role_summary_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_key" varchar NOT NULL,
	"role_family" varchar NOT NULL,
	"vertical" varchar NOT NULL,
	"level" varchar NOT NULL,
	"role_label" varchar NOT NULL,
	"default_summary" text NOT NULL,
	"alternate_summary" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "role_summary_templates_role_key_unique" UNIQUE("role_key")
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shift_assignment_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"changed_by_id" varchar NOT NULL,
	"old_shift_id" varchar,
	"new_shift_id" varchar,
	"reason" text NOT NULL,
	"changed_at" timestamp DEFAULT now()
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shifts" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"display_label" varchar NOT NULL,
	"us_coverage" varchar NOT NULL,
	"ist_start_dst" varchar NOT NULL,
	"ist_end_dst" varchar NOT NULL,
	"ist_start_std" varchar NOT NULL,
	"ist_end_std" varchar NOT NULL,
	"scheduled_hours" integer DEFAULT 9 NOT NULL,
	"grace_period_minutes" integer DEFAULT 15,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now()
);--> statement-breakpoint

---------------------------------------------------------------------------
-- 4. New columns on existing tables (all IF NOT EXISTS)
---------------------------------------------------------------------------
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "gender" varchar;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "employment_status" "employment_status" DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "shift_id" varchar;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "attendance_exempt" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "training_exempt" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "maternity_leave_eligible" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "employment_type" varchar;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "employee_category" varchar DEFAULT 'experienced';--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "is_corrected" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "correction_source" varchar;--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "corrected_by_id" varchar;--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "correction_note" text;--> statement-breakpoint
ALTER TABLE "learning_tracks" ADD COLUMN IF NOT EXISTS "is_policy_track" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "learning_tracks" ADD COLUMN IF NOT EXISTS "is_universal" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "learning_tracks" ADD COLUMN IF NOT EXISTS "version_number" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "learning_tracks" ADD COLUMN IF NOT EXISTS "published_at" timestamp;--> statement-breakpoint
ALTER TABLE "leave_accruals" ADD COLUMN IF NOT EXISTS "accrual_type" varchar DEFAULT 'monthly' NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_accruals" ADD COLUMN IF NOT EXISTS "skip_reason" text;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "half_day" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "half_day_part" varchar;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "split_paid_days" numeric;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "split_lwp_days" numeric;--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN IF NOT EXISTS "is_conditional" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN IF NOT EXISTS "carry_forward_cap" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN IF NOT EXISTS "occurrence_based" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "offer_letters" ADD COLUMN IF NOT EXISTS "gender" varchar;--> statement-breakpoint
ALTER TABLE "offer_letters" ADD COLUMN IF NOT EXISTS "attendance_exempt" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "offer_letters" ADD COLUMN IF NOT EXISTS "training_exempt" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "offer_letters" ADD COLUMN IF NOT EXISTS "maternity_leave_eligible" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "offer_letters" ADD COLUMN IF NOT EXISTS "approved_by" varchar;--> statement-breakpoint
ALTER TABLE "offer_letters" ADD COLUMN IF NOT EXISTS "approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "offer_letters" ADD COLUMN IF NOT EXISTS "approval_rejection_reason" text;--> statement-breakpoint
ALTER TABLE "offer_letters" ADD COLUMN IF NOT EXISTS "cc_emails" text;--> statement-breakpoint
ALTER TABLE "salary_slips" ADD COLUMN IF NOT EXISTS "lop_leaves" numeric DEFAULT '0';--> statement-breakpoint
ALTER TABLE "section_acknowledgements" ADD COLUMN IF NOT EXISTS "signed_version" integer;--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "grace_period_minutes" integer DEFAULT 15;--> statement-breakpoint
ALTER TABLE "track_assignments" ADD COLUMN IF NOT EXISTS "exception_granted_by_id" varchar;--> statement-breakpoint
ALTER TABLE "track_assignments" ADD COLUMN IF NOT EXISTS "exception_granted_at" timestamp;--> statement-breakpoint
ALTER TABLE "track_assignments" ADD COLUMN IF NOT EXISTS "exception_reason" text;--> statement-breakpoint
ALTER TABLE "track_completions" ADD COLUMN IF NOT EXISTS "signed_version" integer;--> statement-breakpoint
ALTER TABLE "training_extension_requests" ADD COLUMN IF NOT EXISTS "request_type" varchar DEFAULT 'extension' NOT NULL;--> statement-breakpoint

---------------------------------------------------------------------------
-- 5. Foreign key constraints (DO blocks so they skip if already present)
---------------------------------------------------------------------------
DO $$ BEGIN ALTER TABLE "break_records" ADD CONSTRAINT "break_records_attendance_id_attendance_id_fk" FOREIGN KEY ("attendance_id") REFERENCES "public"."attendance"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "break_records" ADD CONSTRAINT "break_records_user_id_admin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "contract_invoices" ADD CONSTRAINT "contract_invoices_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "contract_invoices" ADD CONSTRAINT "contract_invoices_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "contract_templates" ADD CONSTRAINT "contract_templates_uploaded_by_admin_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "contracts" ADD CONSTRAINT "contracts_template_id_contract_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."contract_templates"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "contracts" ADD CONSTRAINT "contracts_client_id_contract_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."contract_clients"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "contracts" ADD CONSTRAINT "contracts_countersigned_by_admin_users_id_fk" FOREIGN KEY ("countersigned_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "contracts" ADD CONSTRAINT "contracts_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "hr_letters" ADD CONSTRAINT "hr_letters_employee_id_admin_users_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "hr_letters" ADD CONSTRAINT "hr_letters_signatory_id_admin_users_id_fk" FOREIGN KEY ("signatory_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "hr_letters" ADD CONSTRAINT "hr_letters_custom_override_by_admin_users_id_fk" FOREIGN KEY ("custom_override_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "hr_letters" ADD CONSTRAINT "hr_letters_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "hr_letters" ADD CONSTRAINT "hr_letters_approved_by_admin_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "hr_letters" ADD CONSTRAINT "hr_letters_issued_by_admin_users_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "hr_letters" ADD CONSTRAINT "hr_letters_revoked_by_admin_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "night_shift_consents" ADD CONSTRAINT "night_shift_consents_user_id_admin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "offer_letter_addendums" ADD CONSTRAINT "offer_letter_addendums_offer_letter_id_offer_letters_id_fk" FOREIGN KEY ("offer_letter_id") REFERENCES "public"."offer_letters"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "offer_letter_addendums" ADD CONSTRAINT "offer_letter_addendums_issued_by_admin_users_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "offer_letter_addendums" ADD CONSTRAINT "offer_letter_addendums_counter_signed_by_admin_users_id_fk" FOREIGN KEY ("counter_signed_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "shift_assignment_log" ADD CONSTRAINT "shift_assignment_log_user_id_admin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "shift_assignment_log" ADD CONSTRAINT "shift_assignment_log_changed_by_id_admin_users_id_fk" FOREIGN KEY ("changed_by_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "shift_assignment_log" ADD CONSTRAINT "shift_assignment_log_old_shift_id_shifts_id_fk" FOREIGN KEY ("old_shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "shift_assignment_log" ADD CONSTRAINT "shift_assignment_log_new_shift_id_shifts_id_fk" FOREIGN KEY ("new_shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "attendance" ADD CONSTRAINT "attendance_corrected_by_id_admin_users_id_fk" FOREIGN KEY ("corrected_by_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "offer_letters" ADD CONSTRAINT "offer_letters_approved_by_admin_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "track_assignments" ADD CONSTRAINT "track_assignments_exception_granted_by_id_admin_users_id_fk" FOREIGN KEY ("exception_granted_by_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint

---------------------------------------------------------------------------
-- 6. Unique indexes (IF NOT EXISTS supported in PostgreSQL 9.5+)
---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS "uq_letter_template_key_category" ON "letter_template_sentences" USING btree ("key","category");
