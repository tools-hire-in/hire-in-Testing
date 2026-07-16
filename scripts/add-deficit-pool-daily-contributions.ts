import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  await db.execute(sql`
    ALTER TABLE attendance_deficit_pool
    ADD COLUMN IF NOT EXISTS daily_contributions JSONB NOT NULL DEFAULT '{}'::jsonb
  `);
  console.log("attendance_deficit_pool.daily_contributions column added (or already exists).");
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
