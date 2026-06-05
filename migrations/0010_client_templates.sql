-- Migration: Client-specific contract templates
-- Idempotent — safe to run on a DB that already has the column via direct SQL.

ALTER TABLE "contract_templates" ADD COLUMN IF NOT EXISTS "client_id" varchar REFERENCES "contract_clients"("id") ON DELETE SET NULL;--> statement-breakpoint
