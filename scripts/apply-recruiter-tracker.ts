/**
 * Task #1115 — Recruiter Activity & Conversion Tracker
 * Apply via: npx tsx scripts/apply-recruiter-tracker.ts
 */
import { pool } from "../server/db";

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Add new columns to applications table
    await client.query(`
      ALTER TABLE applications
        ADD COLUMN IF NOT EXISTS recruiter_id VARCHAR REFERENCES admin_users(id),
        ADD COLUMN IF NOT EXISTS stage VARCHAR NOT NULL DEFAULT 'submitted',
        ADD COLUMN IF NOT EXISTS stage_updated_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS stage_updated_by VARCHAR REFERENCES admin_users(id),
        ADD COLUMN IF NOT EXISTS placement_date DATE
    `);
    console.log("✓ applications columns added");

    // 2. Create recruiter_activity_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS recruiter_activity_logs (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        recruiter_id VARCHAR NOT NULL REFERENCES admin_users(id),
        log_date DATE NOT NULL,
        calls_made INTEGER NOT NULL DEFAULT 0,
        screens_conducted INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (recruiter_id, log_date)
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_recruiter_activity_recruiter ON recruiter_activity_logs(recruiter_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_recruiter_activity_date ON recruiter_activity_logs(log_date)`);
    console.log("✓ recruiter_activity_logs table created");

    // 3. Create application_stage_history table
    await client.query(`
      CREATE TABLE IF NOT EXISTS application_stage_history (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        application_id VARCHAR NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
        from_stage VARCHAR,
        to_stage VARCHAR NOT NULL,
        changed_by VARCHAR REFERENCES admin_users(id),
        changed_at TIMESTAMP DEFAULT NOW(),
        notes TEXT
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_stage_history_application ON application_stage_history(application_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_stage_history_changed_at ON application_stage_history(changed_at)`);
    console.log("✓ application_stage_history table created");

    // 4. One-time backfill: set recruiter_id from audit_logs ONLY when exactly
    //    one distinct actor is associated with the application (deterministic single-owner).
    //    Applications touched by multiple actors (e.g., submitted by one, reassigned by another)
    //    are left NULL and must be assigned manually.
    await client.query(`
      UPDATE applications a
      SET recruiter_id = sub.actor_id
      FROM (
        SELECT target_id, MAX(actor_id) AS actor_id
        FROM audit_logs
        WHERE action IN ('create_application', 'submit_application', 'push_to_ceipal')
          AND target_id IS NOT NULL
          AND actor_id IS NOT NULL
        GROUP BY target_id
        HAVING COUNT(DISTINCT actor_id) = 1
      ) sub
      JOIN admin_users u ON u.id = sub.actor_id
      WHERE a.id = sub.target_id
        AND a.recruiter_id IS NULL
    `);
    console.log("✓ recruiter_id backfill: single-actor applications attributed");

    await client.query("COMMIT");
    console.log("✅ All recruiter tracker migrations applied successfully");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
