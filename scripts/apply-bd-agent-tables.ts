// Apply BD Agent tables (Task #942) via direct SQL.
// Run once: npx tsx scripts/apply-bd-agent-tables.ts
// Idempotent — uses CREATE TABLE IF NOT EXISTS.

import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("[bd-agent-tables] Applying BD agent tables…");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bd_conversations (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR NOT NULL REFERENCES admin_users(id),
      title VARCHAR(200) NOT NULL DEFAULT 'New conversation',
      domain VARCHAR(50) NOT NULL DEFAULT 'general',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  // Idempotent backfill — add domain column if the table was created before this column existed
  await db.execute(sql`
    ALTER TABLE bd_conversations ADD COLUMN IF NOT EXISTS domain VARCHAR(50) NOT NULL DEFAULT 'general'
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS bd_conversations_user_idx ON bd_conversations(user_id)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS bd_conversations_created_at_idx ON bd_conversations(created_at)
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bd_messages (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id VARCHAR NOT NULL REFERENCES bd_conversations(id) ON DELETE CASCADE,
      role VARCHAR(20) NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS bd_messages_conversation_idx ON bd_messages(conversation_id)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS bd_messages_created_at_idx ON bd_messages(created_at)
  `);

  console.log("[bd-agent-tables] Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[bd-agent-tables] Error:", err);
  process.exit(1);
});
