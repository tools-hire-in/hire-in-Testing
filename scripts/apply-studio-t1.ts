// Studio T1 (Task #906): apply planning-pipeline schema additively via direct
// SQL (drizzle-kit push requires a TTY). Idempotent — safe to re-run.
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  await db.execute(sql`ALTER TABLE studio_articles ADD COLUMN IF NOT EXISTS generation_brief text`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "studio_import_batches" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "project_id" varchar NOT NULL REFERENCES studio_projects(id),
      "file_name" varchar,
      "row_count_valid" integer DEFAULT 0 NOT NULL,
      "row_count_invalid" integer DEFAULT 0 NOT NULL,
      "created_by_user_id" varchar,
      "rolled_back_at" timestamp,
      "created_at" timestamp DEFAULT now() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "studio_content_ideas" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "project_id" varchar NOT NULL REFERENCES studio_projects(id),
      "campaign_id" varchar,
      "group_id" varchar,
      "parent_idea_id" varchar,
      "import_batch_id" varchar,
      "origin" varchar DEFAULT 'manual' NOT NULL,
      "content_type" varchar NOT NULL,
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
      "archived_at" timestamp,
      "created_by_user_id" varchar,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "studio_idea_comments" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "idea_id" varchar NOT NULL REFERENCES studio_content_ideas(id),
      "user_id" varchar NOT NULL,
      "message" text NOT NULL,
      "resolved_at" timestamp,
      "created_at" timestamp DEFAULT now() NOT NULL
    )
  `);

  await db.execute(sql`CREATE INDEX IF NOT EXISTS studio_content_ideas_project_idx ON studio_content_ideas(project_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS studio_content_ideas_status_idx ON studio_content_ideas(status)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS studio_content_ideas_scheduled_idx ON studio_content_ideas(scheduled_date)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS studio_content_ideas_batch_idx ON studio_content_ideas(import_batch_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS studio_idea_comments_idea_idx ON studio_idea_comments(idea_id)`);

  const check = await db.execute(sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_name IN ('studio_content_ideas','studio_idea_comments','studio_import_batches')
  `);
  console.log("Tables present:", (check.rows as any[]).map((r) => r.table_name).sort());
  const col = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'studio_articles' AND column_name = 'generation_brief'
  `);
  console.log("studio_articles.generation_brief:", (col.rows as any[]).length === 1 ? "OK" : "MISSING");
  process.exit(0);
}

main().catch((err) => {
  console.error("apply-studio-t1 failed:", err);
  process.exit(1);
});
