// Studio T2 (Task #907) — direct SQL apply for new tables + column.
// drizzle-kit push needs a TTY, so schema reaches the DB via this script.
// Idempotent: CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS studio_campaigns (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id varchar NOT NULL REFERENCES studio_projects(id),
      name varchar NOT NULL,
      brief text,
      icp varchar,
      goal varchar,
      funnel_stage varchar,
      primary_cta varchar,
      channels jsonb,
      start_date date,
      end_date date,
      status varchar NOT NULL DEFAULT 'draft',
      contributor_user_ids jsonb,
      created_by_user_id varchar,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS studio_outreach_sequences (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id varchar NOT NULL REFERENCES studio_projects(id),
      campaign_id varchar,
      name varchar NOT NULL,
      sequence_type varchar NOT NULL DEFAULT 'linkedin',
      audience_type varchar,
      steps_jsonb jsonb,
      status varchar NOT NULL DEFAULT 'draft',
      created_by_user_id varchar,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    ALTER TABLE studio_projects ADD COLUMN IF NOT EXISTS brand_voice_config jsonb
  `);
  console.log("Studio T2 schema applied.");
  process.exit(0);
}

main().catch((err) => {
  console.error("apply-studio-t2 failed:", err);
  process.exit(1);
});
