-- Migration: Standalone addendum support for legacy employees
-- Idempotent — safe to run on a DB that already has these changes via direct SQL.

-- Make offer_letter_id nullable (standalone addendums have no parent offer letter)
ALTER TABLE "offer_letter_addendums" ALTER COLUMN "offer_letter_id" DROP NOT NULL;--> statement-breakpoint

-- Add is_standalone flag
ALTER TABLE "offer_letter_addendums" ADD COLUMN IF NOT EXISTS "is_standalone" boolean NOT NULL DEFAULT false;--> statement-breakpoint

-- Add manual employee data for standalone addendums (name, email, designation, etc.)
ALTER TABLE "offer_letter_addendums" ADD COLUMN IF NOT EXISTS "manual_employee_data" jsonb;--> statement-breakpoint

-- Add annexures (Annexure A-E support, same as offer letters; column name matches incoming schema)
ALTER TABLE "offer_letter_addendums" ADD COLUMN IF NOT EXISTS "annexures" jsonb;--> statement-breakpoint
