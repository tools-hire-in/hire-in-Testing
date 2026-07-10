/**
 * One-time schema migration for per-employee salary run disbursement tracking.
 * Run with: npx tsx scripts/apply-payroll-disbursement.ts
 */
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function run() {
  console.log("Applying payroll disbursement schema changes...");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS salary_run_payments (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      run_id VARCHAR NOT NULL REFERENCES salary_report_runs(id),
      email VARCHAR NOT NULL,
      user_id VARCHAR REFERENCES admin_users(id),
      status VARCHAR NOT NULL DEFAULT 'pending',
      note TEXT,
      marked_by VARCHAR REFERENCES admin_users(id),
      marked_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log("✓ salary_run_payments table created");

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS salary_run_payments_run_email_unique
      ON salary_run_payments (run_id, email)
  `);
  console.log("✓ unique index (run_id, email) created");

  console.log("Done.");
  process.exit(0);
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
