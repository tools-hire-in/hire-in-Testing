/**
 * One-time script: applies the ceipal_update_logs table and
 * ceipal_update_prompt_enabled column to admin_users.
 * Safe to run multiple times (all statements use IF NOT EXISTS / idempotent DDL).
 */
import { db } from "../server/db";
import { sql } from "drizzle-orm";

export async function applyCeipalComplianceSchema() {
  try {
    await db.execute(sql`
      ALTER TABLE admin_users
      ADD COLUMN IF NOT EXISTS ceipal_update_prompt_enabled BOOLEAN NOT NULL DEFAULT TRUE
    `);
    console.log("[ceipal-schema] ceipal_update_prompt_enabled column ensured on admin_users");
  } catch (e: any) {
    console.error("[ceipal-schema] column error:", e.message);
  }

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ceipal_update_logs (
        id                    VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id               VARCHAR NOT NULL REFERENCES admin_users(id),
        log_date              DATE NOT NULL,
        status                VARCHAR NOT NULL,
        deferred_reason       VARCHAR,
        commitment_time       TIMESTAMPTZ,
        verified_count        INTEGER,
        jobs_count            INTEGER,
        verified_at           TIMESTAMPTZ,
        manager_flagged_at    TIMESTAMPTZ,
        manager_acknowledged_at TIMESTAMPTZ,
        manager_acknowledged_by VARCHAR REFERENCES admin_users(id),
        exemption_reason      TEXT,
        created_at            TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, log_date)
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_ceipal_update_logs_user ON ceipal_update_logs(user_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_ceipal_update_logs_date ON ceipal_update_logs(log_date)
    `);
    console.log("[ceipal-schema] ceipal_update_logs table ensured");
  } catch (e: any) {
    console.error("[ceipal-schema] table error:", e.message);
  }
}
