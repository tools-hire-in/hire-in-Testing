// Apply SOP wave scheduling tables and director role enum (Task #1407).
// Run once: npx tsx scripts/apply-wave-scheduling-schema.ts
// Idempotent — uses CREATE TABLE IF NOT EXISTS and IF NOT EXISTS guards.

import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("[wave-scheduling-schema] Applying SOP wave scheduling schema…");

  // ── 1. director role enum value ──────────────────────────────────────────
  // Must be done via direct SQL — drizzle-kit push stalls on additive enum changes.
  await db.execute(sql`
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'director'
  `);
  console.log("[wave-scheduling-schema] user_role enum: 'director' value ensured");

  // ── 2. wave_scheduled_launch_status enum ─────────────────────────────────
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE wave_scheduled_launch_status AS ENUM (
        'pending_approval',
        'approved',
        'active',
        'cancelled'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$
  `);
  console.log("[wave-scheduling-schema] wave_scheduled_launch_status enum ensured");

  // ── 3. wave_scheduled_launches table ─────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS wave_scheduled_launches (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      wave_number INTEGER NOT NULL,
      scheduled_by_user_id VARCHAR NOT NULL REFERENCES admin_users(id),
      go_live_date DATE NOT NULL,
      grace_days INTEGER NOT NULL DEFAULT 0,
      status wave_scheduled_launch_status NOT NULL DEFAULT 'pending_approval',
      submitted_at TIMESTAMP NOT NULL DEFAULT NOW(),
      approved_by VARCHAR REFERENCES admin_users(id),
      approved_at TIMESTAMP,
      notes TEXT
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_wave_scheduled_launches_wave
      ON wave_scheduled_launches(wave_number)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_wave_scheduled_launches_status
      ON wave_scheduled_launches(status)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_wave_scheduled_launches_go_live
      ON wave_scheduled_launches(go_live_date)
  `);
  console.log("[wave-scheduling-schema] wave_scheduled_launches table ensured");

  // ── 4. wave_readiness_signals table ──────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS wave_readiness_signals (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      wave_number INTEGER NOT NULL,
      manager_id VARCHAR NOT NULL REFERENCES admin_users(id),
      signalled_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_wave_readiness_signals_wave
      ON wave_readiness_signals(wave_number)
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_wave_readiness_unique_wave_manager
      ON wave_readiness_signals(wave_number, manager_id)
  `);
  console.log("[wave-scheduling-schema] wave_readiness_signals table ensured");

  console.log("[wave-scheduling-schema] Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[wave-scheduling-schema] Error:", err);
  process.exit(1);
});
