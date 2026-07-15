import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Adding linked_idea_id and idea_context columns to studio_articles...");
  await db.execute(sql`
    ALTER TABLE studio_articles
    ADD COLUMN IF NOT EXISTS linked_idea_id varchar;
  `);
  await db.execute(sql`
    ALTER TABLE studio_articles
    ADD COLUMN IF NOT EXISTS idea_context jsonb;
  `);
  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
