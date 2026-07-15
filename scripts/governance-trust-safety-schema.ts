/**
 * Governance Trust & Safety Layer — Schema Additions
 * Applied via direct SQL (drizzle-kit push needs TTY).
 */
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function run() {
  console.log("[schema] Applying Governance Trust & Safety Layer schema additions...");

  // ── 1. performance_goals additions ────────────────────────────────────────
  await db.execute(sql`
    ALTER TABLE performance_goals
      ADD COLUMN IF NOT EXISTS suggested_progress INTEGER,
      ADD COLUMN IF NOT EXISTS progress_pending_review BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS progress_anomaly_flagged BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS suggested_progress_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS progress_confirmed_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS progress_confirmed_by VARCHAR
  `);
  console.log("[schema] ✓ performance_goals columns added");

  // ── 2. sop_employee_progress: timer queue ─────────────────────────────────
  await db.execute(sql`
    ALTER TABLE sop_employee_progress
      ADD COLUMN IF NOT EXISTS sop_timer_queue JSONB,
      ADD COLUMN IF NOT EXISTS timer_started_at TIMESTAMP
  `);
  console.log("[schema] ✓ sop_employee_progress timer_queue column added");

  // ── 3. sop_wave_approvals table ───────────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS sop_wave_approvals (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      wave_number INTEGER NOT NULL UNIQUE,
      approved_by VARCHAR NOT NULL REFERENCES admin_users(id),
      approved_at TIMESTAMP NOT NULL DEFAULT NOW(),
      risk_snapshot_json JSONB,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log("[schema] ✓ sop_wave_approvals table created");

  // ── 4. governance_control_type enum: new values ───────────────────────────
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TYPE governance_control_type ADD VALUE IF NOT EXISTS 'manager_checkin_obligation';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `);
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TYPE governance_control_type ADD VALUE IF NOT EXISTS 'manager_coaching_obligation';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `);
  console.log("[schema] ✓ governance_control_type enum extended");

  // ── 5. system_settings seed: new keys ────────────────────────────────────
  await db.execute(sql`
    INSERT INTO system_settings (key, value) VALUES ('max_concurrent_sop_timers', '3')
    ON CONFLICT (key) DO NOTHING
  `);
  await db.execute(sql`
    INSERT INTO system_settings (key, value) VALUES ('max_concurrent_lockout_pct', '15')
    ON CONFLICT (key) DO NOTHING
  `);
  console.log("[schema] ✓ system_settings seeded");

  console.log("[schema] All schema additions applied successfully.");
  process.exit(0);
}

run().catch(err => {
  console.error("[schema] FATAL:", err);
  process.exit(1);
});
