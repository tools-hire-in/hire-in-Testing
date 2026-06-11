-- Migration: Release prep — cover all schema additions previously only in the startup ensure block.
-- Fully idempotent (IF NOT EXISTS / ADD VALUE IF NOT EXISTS) — safe to run on a DB that
-- already received these changes via the ensure block.

---------------------------------------------------------------------------
-- 1. Contract status: pending_dispatch_approval
---------------------------------------------------------------------------
ALTER TYPE contract_status ADD VALUE IF NOT EXISTS 'pending_dispatch_approval';--> statement-breakpoint

---------------------------------------------------------------------------
-- 2. offer_letters: annexure support
---------------------------------------------------------------------------
ALTER TABLE "offer_letters" ADD COLUMN IF NOT EXISTS "annexure_data" jsonb;--> statement-breakpoint

---------------------------------------------------------------------------
-- 3. hr_letters: annexure support
---------------------------------------------------------------------------
ALTER TABLE "hr_letters" ADD COLUMN IF NOT EXISTS "annexure_data" jsonb;--> statement-breakpoint

---------------------------------------------------------------------------
-- 4. performance_goals: Rayo Academy integration + source tracking
---------------------------------------------------------------------------
ALTER TABLE "performance_goals" ADD COLUMN IF NOT EXISTS "rayo_academy_track_id" varchar;--> statement-breakpoint
ALTER TABLE "performance_goals" ADD COLUMN IF NOT EXISTS "source_ref" varchar;--> statement-breakpoint

---------------------------------------------------------------------------
-- 5. contract_templates: default flag
---------------------------------------------------------------------------
ALTER TABLE "contract_templates" ADD COLUMN IF NOT EXISTS "is_default" boolean NOT NULL DEFAULT false;--> statement-breakpoint

---------------------------------------------------------------------------
-- 6. contracts: dispatch and tracking columns
---------------------------------------------------------------------------
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "cc_recipients" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "dispatch_method" varchar;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "reference_number" varchar;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "signed_at" timestamp;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "dispatch_recipient_email" varchar;--> statement-breakpoint

---------------------------------------------------------------------------
-- 7. contracts: unique reference number (via unique index — idempotent)
---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS "contracts_reference_number_key" ON "contracts"("reference_number");--> statement-breakpoint

---------------------------------------------------------------------------
-- 8. policy_acknowledgements: composite lookup index
---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "idx_policy_ack_user_type" ON "policy_acknowledgements" USING btree ("user_id","policy_type");--> statement-breakpoint
