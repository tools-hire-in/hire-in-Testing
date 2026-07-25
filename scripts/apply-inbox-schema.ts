/**
 * Creates the manager inbox tables and required enums.
 * Safe to run multiple times (IF NOT EXISTS / DO $$ guards).
 * Run: npx tsx scripts/apply-inbox-schema.ts
 */
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ── Enums ──────────────────────────────────────────────────────────────
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE inbox_assignee_tier AS ENUM ('manager', 'hr_admin', 'super_admin');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE inbox_item_type AS ENUM (
          'leave_approval', 'offer_letter', 'probation_checkin',
          'attendance_correction', 'pip_checkin', 'training_compliance'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE inbox_item_status AS ENUM ('new', 'deferred', 'escalated', 'resolved');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE inbox_audit_action AS ENUM (
          'deferred', 'escalated', 'auto_escalated', 'act_clicked', 'resolved'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // ── Tables ─────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS manager_action_due_dates (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        assignee_id varchar NOT NULL REFERENCES admin_users(id),
        assignee_tier inbox_assignee_tier NOT NULL,
        item_type inbox_item_type NOT NULL,
        item_id varchar NOT NULL,
        defer_until timestamp,
        escalated_at timestamp,
        escalation_reason text,
        original_assigned_at timestamp DEFAULT now(),
        status inbox_item_status NOT NULL DEFAULT 'new',
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now(),
        UNIQUE(assignee_id, item_type, item_id)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS manager_inbox_audit (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        action_due_date_id varchar NOT NULL REFERENCES manager_action_due_dates(id) ON DELETE CASCADE,
        actor_id varchar NOT NULL REFERENCES admin_users(id),
        action inbox_audit_action NOT NULL,
        note text,
        created_at timestamp DEFAULT now()
      );
    `);

    await client.query("COMMIT");
    console.log("✓ Inbox schema applied successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error applying inbox schema:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
