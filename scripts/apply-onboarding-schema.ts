/**
 * One-time schema migration for the interactive onboarding flow tables.
 * Run with: npx tsx scripts/apply-onboarding-schema.ts
 *
 * Creates:
 *   - onboarding_track  (pgEnum)
 *   - onboarding_steps
 *   - user_onboarding_progress
 *
 * All statements are idempotent (IF NOT EXISTS / DO $$ … END $$).
 */
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function run() {
  console.log("Applying onboarding flow schema...");

  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE onboarding_track AS ENUM ('employee', 'manager', 'hr', 'executive', 'admin');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$
  `);
  console.log("✓ onboarding_track enum ensured");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS onboarding_steps (
      id          VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      track       onboarding_track NOT NULL,
      step_number INTEGER NOT NULL,
      title       VARCHAR(300) NOT NULL,
      purpose     TEXT,
      where_to_find TEXT,
      nav_route   TEXT,
      how_to_use  TEXT,
      important_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
      is_high_risk BOOLEAN NOT NULL DEFAULT false,
      common_mistake TEXT,
      scenario    TEXT,
      practical_exercise TEXT,
      knowledge_check JSONB,
      where_to_get_help TEXT,
      is_active   BOOLEAN NOT NULL DEFAULT true,
      created_at  TIMESTAMP DEFAULT NOW(),
      updated_at  TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log("✓ onboarding_steps table created");

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS onboarding_steps_track_step_unique
      ON onboarding_steps (track, step_number)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_onboarding_steps_track_active
      ON onboarding_steps (track, is_active)
  `);
  console.log("✓ onboarding_steps indexes ensured");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS user_onboarding_progress (
      id                    VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id               VARCHAR NOT NULL REFERENCES admin_users(id),
      role                  VARCHAR NOT NULL,
      completed_step_ids    JSONB NOT NULL DEFAULT '[]'::jsonb,
      knowledge_check_passed JSONB NOT NULL DEFAULT '{}'::jsonb,
      started_at            TIMESTAMP DEFAULT NOW(),
      completed_at          TIMESTAMP,
      snoozed               BOOLEAN NOT NULL DEFAULT false
    )
  `);
  console.log("✓ user_onboarding_progress table created");

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS user_onboarding_progress_user_role_unique
      ON user_onboarding_progress (user_id, role)
  `);
  console.log("✓ user_onboarding_progress unique index ensured");

  console.log("Onboarding schema applied successfully.");
  process.exit(0);
}

run().catch((err) => {
  console.error("Error applying onboarding schema:", err);
  process.exit(1);
});
