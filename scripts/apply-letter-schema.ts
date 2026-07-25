/**
 * Migration: Letter system schema foundation
 *
 * Adds to hr_letter_status enum: needs_revision, resubmitted, withdrawn
 * Adds to hr_letters table: draft_data, revision_round, revision_reason, cc_recipients
 * Creates letter_review_cycles table with action enum + indexes
 *
 * Idempotent: safe to run multiple times.
 */

import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function run() {
  console.log("=== apply-letter-schema: starting ===");

  // ── 1. Add new values to hr_letter_status enum ──────────────────────────────
  console.log("Step 1: Adding new values to hr_letter_status enum...");
  await db.execute(sql`ALTER TYPE hr_letter_status ADD VALUE IF NOT EXISTS 'needs_revision'`);
  await db.execute(sql`ALTER TYPE hr_letter_status ADD VALUE IF NOT EXISTS 'resubmitted'`);
  await db.execute(sql`ALTER TYPE hr_letter_status ADD VALUE IF NOT EXISTS 'withdrawn'`);
  console.log("  hr_letter_status enum updated.");

  // ── 2. Add new columns to hr_letters ────────────────────────────────────────
  console.log("Step 2: Adding new columns to hr_letters...");
  await db.execute(sql`ALTER TABLE hr_letters ADD COLUMN IF NOT EXISTS draft_data JSONB`);
  await db.execute(sql`ALTER TABLE hr_letters ADD COLUMN IF NOT EXISTS revision_round INTEGER NOT NULL DEFAULT 0`);
  await db.execute(sql`ALTER TABLE hr_letters ADD COLUMN IF NOT EXISTS revision_reason TEXT`);
  await db.execute(sql`ALTER TABLE hr_letters ADD COLUMN IF NOT EXISTS cc_recipients JSONB`);
  console.log("  hr_letters columns added.");

  // ── 3. Create letter_review_cycle_action enum ────────────────────────────────
  console.log("Step 3: Ensuring letter_review_cycle_action enum...");
  await db.execute(sql`DO $$ BEGIN
    CREATE TYPE letter_review_cycle_action AS ENUM (
      'approved',
      'needs_revision',
      'withdrawn',
      'resubmitted'
    );
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$`);
  console.log("  letter_review_cycle_action enum ensured.");

  // ── 4. Create letter_review_cycles table ─────────────────────────────────────
  console.log("Step 4: Creating letter_review_cycles table...");
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS letter_review_cycles (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      letter_id VARCHAR NOT NULL,
      letter_type VARCHAR NOT NULL,
      round INTEGER NOT NULL,
      action letter_review_cycle_action NOT NULL,
      reason TEXT,
      reviewed_by VARCHAR REFERENCES admin_users(id),
      reviewed_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  console.log("  letter_review_cycles table ensured.");

  // ── 5. Create indexes on letter_review_cycles ────────────────────────────────
  console.log("Step 5: Creating indexes on letter_review_cycles...");
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS letter_review_cycles_letter_idx
    ON letter_review_cycles(letter_id, letter_type)
  `);
  console.log("  Indexes ensured.");

  // ── 6. Verification: print columns from both tables ──────────────────────────
  console.log("Step 6: Verifying new columns on hr_letters...");
  const hrLettersCols = await db.execute(sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'hr_letters'
      AND column_name IN ('draft_data', 'revision_round', 'revision_reason', 'cc_recipients')
    ORDER BY column_name
  `);
  console.log("  hr_letters new columns:", hrLettersCols.rows);

  console.log("Step 7: Verifying letter_review_cycles table...");
  const reviewCyclesCols = await db.execute(sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'letter_review_cycles'
    ORDER BY column_name
  `);
  console.log("  letter_review_cycles columns:", reviewCyclesCols.rows);

  console.log("=== apply-letter-schema: complete ===");
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
