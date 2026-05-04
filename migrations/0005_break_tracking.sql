DO $$ BEGIN
  CREATE TYPE "public"."break_type" AS ENUM('lunch', 'tea');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "break_records" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "attendance_id" varchar REFERENCES "attendance"("id"),
  "user_id" varchar NOT NULL REFERENCES "admin_users"("id"),
  "date" varchar NOT NULL,
  "break_type" "break_type" NOT NULL,
  "started_at" timestamp NOT NULL,
  "ended_at" timestamp,
  "duration_minutes" numeric,
  "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "break_records_user_date_idx" ON "break_records" ("user_id", "date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "break_records_attendance_idx" ON "break_records" ("attendance_id");
