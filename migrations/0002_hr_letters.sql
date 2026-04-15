DO $$ BEGIN
  CREATE TYPE "hr_letter_template_type" AS ENUM ('experience', 'internship_completion', 'internship_certificate', 'relieving');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "hr_letter_status" AS ENUM ('draft', 'pending_approval', 'approved', 'issued', 'reissued', 'revoked');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "hr_letter_performance_band" AS ENUM ('factual_only', 'standard', 'good', 'very_good', 'excellent');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "hr_letter_conduct_band" AS ENUM ('standard', 'good', 'very_good');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "hr_letter_completion_band" AS ENUM ('successfully_completed', 'completed', 'served_during_period');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

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
        "closing_line" varchar DEFAULT 'wish_success',
        "include_responsibilities" boolean DEFAULT false,
        "responsibilities_summary" text,
        "include_project" boolean DEFAULT false,
        "project_name" varchar,
        "include_seal" boolean DEFAULT false,
        "signatory_id" varchar,
        "signatory_name" varchar,
        "signatory_designation" varchar,
        "issue_date" varchar,
        "reference_number" varchar UNIQUE,
        "auth_code" varchar,
        "document_hash" varchar,
        "pdf_path" varchar,
        "custom_override_text" text,
        "custom_override_by" varchar,
        "custom_override_at" timestamp,
        "created_by" varchar NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "approved_by" varchar,
        "approved_at" timestamp,
        "issued_by" varchar,
        "issued_at" timestamp,
        "revoked_by" varchar,
        "revoked_at" timestamp,
        "revoke_reason" text,
        "reissued_from_letter_id" varchar,
        "reissue_reason" text
);
