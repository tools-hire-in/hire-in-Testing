import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Adding campaign day-planner columns...");
  // studio_campaigns: duration_days and daily_plan_jsonb (Task #1495)
  await db.execute(sql`
    ALTER TABLE studio_campaigns ADD COLUMN IF NOT EXISTS duration_days integer;
  `);
  await db.execute(sql`
    ALTER TABLE studio_campaigns ADD COLUMN IF NOT EXISTS daily_plan_jsonb jsonb;
  `);
  // studio_articles: campaign_id — links articles created from a campaign day plan
  await db.execute(sql`
    ALTER TABLE studio_articles ADD COLUMN IF NOT EXISTS campaign_id varchar;
  `);
  console.log("Done.");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
