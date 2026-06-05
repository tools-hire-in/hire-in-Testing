-- Migration: Multi-candidate contract support
-- Safe, idempotent — every statement is guarded so it can be run on a DB
-- that already received this schema via direct SQL.

---------------------------------------------------------------------------
-- 1. Add candidates JSONB column to contracts (array of candidate objects)
---------------------------------------------------------------------------
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "candidates" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint

---------------------------------------------------------------------------
-- 2. Add agreement_date column (formatted string e.g. "04 May 2026")
---------------------------------------------------------------------------
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "agreement_date" varchar;--> statement-breakpoint
