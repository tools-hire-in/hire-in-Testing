-- Migration: Attendance Regularization System
-- Safe, idempotent — every statement is guarded so it can be run on a DB
-- that already received this schema via direct SQL (drizzle-kit was interactive).

---------------------------------------------------------------------------
-- 1. Enum types
---------------------------------------------------------------------------
DO $$ BEGIN CREATE TYPE "public"."regularization_request_type" AS ENUM('missed_punch_in','missed_punch_out','wrong_absent','correction'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."regularization_status" AS ENUM('pending','approved','rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint

---------------------------------------------------------------------------
-- 2. New tables
---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "attendance_regularizations" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "employee_id" varchar NOT NULL,
        "attendance_date" varchar NOT NULL,
        "requested_punch_in" timestamp,
        "requested_punch_out" timestamp,
        "request_type" "regularization_request_type" NOT NULL,
        "reason" text NOT NULL,
        "status" "regularization_status" DEFAULT 'pending' NOT NULL,
        "reviewed_by" varchar,
        "reviewer_comment" text,
        "reviewed_at" timestamp,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "policy_acknowledgements" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "policy_type" varchar NOT NULL,
        "policy_version" varchar NOT NULL,
        "accepted_at" timestamp DEFAULT now()
);--> statement-breakpoint

---------------------------------------------------------------------------
-- 3. Indexes for common access patterns
---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "idx_att_reg_employee_id" ON "attendance_regularizations"("employee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_att_reg_status" ON "attendance_regularizations"("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_att_reg_date" ON "attendance_regularizations"("attendance_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_policy_ack_user_type" ON "policy_acknowledgements"("user_id", "policy_type");--> statement-breakpoint

---------------------------------------------------------------------------
-- 4. Foreign key constraints (DO blocks so they skip if already present)
---------------------------------------------------------------------------
DO $$ BEGIN ALTER TABLE "attendance_regularizations" ADD CONSTRAINT "attendance_regularizations_employee_id_admin_users_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "attendance_regularizations" ADD CONSTRAINT "attendance_regularizations_reviewed_by_admin_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "policy_acknowledgements" ADD CONSTRAINT "policy_acknowledgements_user_id_admin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint

---------------------------------------------------------------------------
-- 5. Default system settings for the regularization policy
---------------------------------------------------------------------------
INSERT INTO "system_settings" ("key", "value", "description", "updated_by")
VALUES
  ('regularization_employee_window_days', '7', 'Number of working days (excluding weekends and public holidays) within which an employee can submit a regularization request', 'migration'),
  ('regularization_manager_cutoff_day', '20', 'Day of the month after which pending regularization requests for that month are automatically escalated from manager to HR', 'migration'),
  ('regularization_policy_version', '1', 'Current policy version — increment this to require all employees to re-acknowledge the policy', 'migration')
ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint
