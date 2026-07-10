// Studio T4 — apply occasions + content-ideas schema via direct SQL.
// (drizzle-kit push needs a TTY and stalls on unrelated prompts; per repo policy
// new tables/columns are applied with a direct SQL script that exactly mirrors
// shared/schema.ts.)
// Run: npx tsx scripts/apply-t4-tables.ts
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "studio_occasions" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "name" varchar NOT NULL,
      "date" date NOT NULL,
      "region" varchar NOT NULL,
      "category" varchar NOT NULL,
      "content_angle" text,
      "project_id" varchar REFERENCES studio_projects(id),
      "is_active" boolean DEFAULT true NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS studio_occasions_global_name_date_idx
    ON studio_occasions(name, date)
    WHERE project_id IS NULL
  `);

  await db.execute(sql`ALTER TABLE studio_projects ADD COLUMN IF NOT EXISTS occasion_preferences jsonb`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "studio_content_ideas" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "project_id" varchar NOT NULL REFERENCES studio_projects(id),
      "campaign_id" varchar,
      "group_id" varchar,
      "parent_idea_id" varchar,
      "import_batch_id" varchar,
      "origin" varchar DEFAULT 'manual' NOT NULL,
      "content_type" varchar DEFAULT 'social_post' NOT NULL,
      "channels" jsonb,
      "pillar" varchar,
      "topic" varchar NOT NULL,
      "brief" text,
      "generation_brief" text,
      "reference_link" varchar,
      "caption_copy" text,
      "requirement" text,
      "creative_link" varchar,
      "story_content" text,
      "story_reference" varchar,
      "story_creative_link" varchar,
      "scheduled_date" date,
      "due_date" date,
      "assigned_to_user_id" varchar,
      "status" varchar DEFAULT 'idea' NOT NULL,
      "linked_article_id" varchar,
      "social_cards_jsonb" jsonb,
      "created_by_user_id" varchar,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    )
  `);
  // If T1 landed first and created the table without T4's column, add it.
  await db.execute(sql`ALTER TABLE studio_content_ideas ADD COLUMN IF NOT EXISTS social_cards_jsonb jsonb`);

  console.log("T4 tables/columns applied");
  process.exit(0);
}

main().catch((err) => {
  console.error("apply-t4-tables failed:", err);
  process.exit(1);
});
