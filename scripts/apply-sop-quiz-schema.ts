// Apply SOP knowledge-check & attestation tables — merged Tasks #1419 + #1420.
// Run once: npx tsx scripts/apply-sop-quiz-schema.ts
// Idempotent — uses CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.

import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("[sop-quiz-schema] Applying SOP knowledge check & attestation tables…");

  // 1. sop_knowledge_checks — normalized question bank keyed by sopMasterId (Task #1420)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS sop_knowledge_checks (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      sop_master_id VARCHAR NOT NULL,
      question_text TEXT NOT NULL,
      correct_option_index INTEGER,
      explanation TEXT,
      position INTEGER NOT NULL DEFAULT 0,
      archived_at TIMESTAMP,
      created_by VARCHAR REFERENCES admin_users(id),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS sop_knowledge_checks_master_idx
    ON sop_knowledge_checks(sop_master_id)
  `);

  // Migration: add new columns if upgrading from Task #1419's JSONB schema
  await db.execute(sql`ALTER TABLE sop_knowledge_checks ADD COLUMN IF NOT EXISTS correct_option_index INTEGER`);
  await db.execute(sql`ALTER TABLE sop_knowledge_checks ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP`);
  await db.execute(sql`ALTER TABLE sop_knowledge_checks ADD COLUMN IF NOT EXISTS created_by VARCHAR REFERENCES admin_users(id)`);
  await db.execute(sql`ALTER TABLE sop_knowledge_checks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW()`);

  // Backfill correct_option_index from old correct_index column for existing rows
  await db.execute(sql`
    UPDATE sop_knowledge_checks
    SET correct_option_index = correct_index
    WHERE correct_option_index IS NULL AND correct_index IS NOT NULL
  `);

  // 2. sop_knowledge_check_options — normalized per-question options (Task #1420)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS sop_knowledge_check_options (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      question_id VARCHAR NOT NULL REFERENCES sop_knowledge_checks(id) ON DELETE CASCADE,
      option_text TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS sop_knowledge_check_options_question_idx
    ON sop_knowledge_check_options(question_id)
  `);

  // 3. sop_employee_quiz_responses — every attempt per employee per SOP (Task #1419)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS sop_employee_quiz_responses (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      sop_id VARCHAR NOT NULL REFERENCES sop_documents(id),
      user_id VARCHAR NOT NULL REFERENCES admin_users(id),
      attempt_number INTEGER NOT NULL,
      answers JSONB NOT NULL,
      score_pct INTEGER NOT NULL,
      passed BOOLEAN NOT NULL,
      attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      cooldown_until TIMESTAMPTZ
    )
  `);

  await db.execute(sql`CREATE INDEX IF NOT EXISTS sop_quiz_responses_sop_user_idx ON sop_employee_quiz_responses(sop_id, user_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS sop_quiz_responses_user_idx ON sop_employee_quiz_responses(user_id)`);

  // 4. sop_wave_attestations — auto-created when employee completes a full wave (Task #1419)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS sop_wave_attestations (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR NOT NULL REFERENCES admin_users(id),
      wave_number INTEGER NOT NULL,
      attested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      signature_hash TEXT NOT NULL,
      ref_number TEXT NOT NULL,
      cheat_sheet_content TEXT,
      CONSTRAINT sop_wave_attestations_user_wave_unique UNIQUE (user_id, wave_number)
    )
  `);

  await db.execute(sql`CREATE INDEX IF NOT EXISTS sop_wave_attestations_user_wave_idx ON sop_wave_attestations(user_id, wave_number)`);

  console.log("[sop-quiz-schema] Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[sop-quiz-schema] Error:", err);
  process.exit(1);
});
