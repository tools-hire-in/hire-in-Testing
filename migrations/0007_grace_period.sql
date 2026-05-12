ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "grace_period_minutes" integer DEFAULT 15;
