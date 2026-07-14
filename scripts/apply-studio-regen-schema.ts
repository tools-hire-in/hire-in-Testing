import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Applying studio regen schema...");

  // 1. Add columns to studio_article_versions (idempotent)
  await db.execute(sql`
    ALTER TABLE studio_article_versions
    ADD COLUMN IF NOT EXISTS superseded BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS regen_mode VARCHAR(20),
    ADD COLUMN IF NOT EXISTS feedback_note TEXT
  `);
  console.log("studio_article_versions columns added");

  // 2. Create studio_regen_requests table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS studio_regen_requests (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      article_id VARCHAR NOT NULL REFERENCES studio_articles(id),
      requested_by_user_id VARCHAR NOT NULL REFERENCES admin_users(id),
      reason TEXT NOT NULL,
      feedback_note TEXT,
      mode VARCHAR(20) NOT NULL DEFAULT 'full',
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      approved_by_user_id VARCHAR REFERENCES admin_users(id),
      approval_note TEXT,
      expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log("studio_regen_requests table ensured");

  // 3. Indexes
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS studio_regen_requests_article_idx
    ON studio_regen_requests(article_id)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS studio_regen_requests_status_idx
    ON studio_regen_requests(status)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS studio_regen_requests_user_idx
    ON studio_regen_requests(requested_by_user_id)
  `);
  console.log("Indexes ensured");

  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
