---------------------------------------------------------------------------
-- salary_report_runs: approval gate for monthly salary reports
---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "salary_report_status" AS ENUM('pending_approval', 'approved', 'sent');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "salary_report_runs" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "year" integer NOT NULL,
  "month" integer NOT NULL,
  "status" "salary_report_status" NOT NULL DEFAULT 'pending_approval',
  "generated_at" timestamp DEFAULT now(),
  "approved_at" timestamp,
  "approved_by" varchar REFERENCES "admin_users"("id"),
  "report_data" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "adjustments" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "email_sent_at" timestamp,
  "created_at" timestamp DEFAULT now()
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "uq_salary_run_year_month" ON "salary_report_runs"("year", "month");--> statement-breakpoint
