// Apply SOP Knowledge Check tables (Task #1420) via direct SQL.
// Run once: npx tsx scripts/apply-sop-quiz-schema.ts
// Idempotent — uses CREATE TABLE IF NOT EXISTS.

import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("[sop-quiz-schema] Applying SOP knowledge check tables…");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS sop_knowledge_checks (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      sop_master_id VARCHAR NOT NULL,
      question_text TEXT NOT NULL,
      correct_option_index INTEGER NOT NULL,
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

  console.log("[sop-quiz-schema] Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[sop-quiz-schema] Error:", err);
  process.exit(1);
});
