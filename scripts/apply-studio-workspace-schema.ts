import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function apply() {
  console.log("[studio-workspace-schema] Applying schema additions...");

  // Add new columns to studio_content_ideas
  await db.execute(sql`
    ALTER TABLE studio_content_ideas
      ADD COLUMN IF NOT EXISTS creative_done boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS story_creative_done boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS story_publish_date date;
  `);
  console.log("[studio-workspace-schema] Added columns to studio_content_ideas");

  // Create studio_idea_watchers join table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS studio_idea_watchers (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      idea_id varchar NOT NULL REFERENCES studio_content_ideas(id),
      user_id varchar NOT NULL REFERENCES admin_users(id),
      created_at timestamp DEFAULT now() NOT NULL
    );
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_studio_idea_watcher_idea_user
      ON studio_idea_watchers(idea_id, user_id);
  `);
  console.log("[studio-workspace-schema] Created studio_idea_watchers table");

  console.log("[studio-workspace-schema] Done.");
  process.exit(0);
}

apply().catch((err) => {
  console.error("[studio-workspace-schema] FAILED:", err);
  process.exit(1);
});
