// Studio T3 (Task #908) — direct SQL apply for new tables.
// drizzle-kit push needs a TTY, so schema reaches the DB via this script.
// Idempotent: CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS.
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS notification_preferences (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar NOT NULL REFERENCES admin_users(id),
      notification_type varchar NOT NULL,
      in_app_enabled boolean NOT NULL DEFAULT true,
      email_enabled boolean NOT NULL DEFAULT true,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT notification_preferences_user_type_unique UNIQUE (user_id, notification_type)
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS studio_engagement_events (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      article_id varchar NOT NULL REFERENCES studio_articles(id),
      campaign_id varchar,
      content_idea_id varchar,
      event_name varchar NOT NULL,
      cta_label varchar,
      source_channel varchar,
      referrer varchar,
      session_hash varchar,
      metadata jsonb,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS studio_engagement_events_article_event_idx
      ON studio_engagement_events (article_id, event_name, created_at)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS studio_engagement_events_campaign_idx
      ON studio_engagement_events (campaign_id, created_at)
  `);
  console.log("Studio T3 schema applied.");
  process.exit(0);
}

main().catch((err) => {
  console.error("apply-studio-t3 failed:", err);
  process.exit(1);
});
