/**
 * One-time DDL script: create attendance_deficit_pool table.
 * Run with: npx tsx scripts/create-deficit-pool-table.ts
 * Safe to re-run (uses IF NOT EXISTS).
 */
import { pool } from "../server/db";

async function main() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS attendance_deficit_pool (
        id           VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id  VARCHAR NOT NULL REFERENCES admin_users(id),
        month        VARCHAR(7) NOT NULL,
        deficit_minutes INTEGER NOT NULL DEFAULT 0,
        settled_at   TIMESTAMP,
        settled_lwp_days NUMERIC,
        settled_leave_type VARCHAR,
        created_at   TIMESTAMP DEFAULT NOW(),
        updated_at   TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_deficit_pool_employee_month
        ON attendance_deficit_pool(employee_id, month)
    `);
    console.log("attendance_deficit_pool table created (or already exists).");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
