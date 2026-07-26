import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("[apply-contract-billing-schema] Starting...");

  await db.execute(sql`
    ALTER TABLE contracts
      ADD COLUMN IF NOT EXISTS billing_start_date DATE,
      ADD COLUMN IF NOT EXISTS next_billing_date DATE,
      ADD COLUMN IF NOT EXISTS billing_reminder_days_before INTEGER DEFAULT 2,
      ADD COLUMN IF NOT EXISTS escalation_config JSONB,
      ADD COLUMN IF NOT EXISTS billing_type VARCHAR DEFAULT 'recurring',
      ADD COLUMN IF NOT EXISTS timesheet_confirmed_at TIMESTAMP
  `);
  console.log("[apply-contract-billing-schema] contracts columns added.");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS contract_reminder_log (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      contract_id VARCHAR NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
      reminder_type VARCHAR NOT NULL,
      sent_to VARCHAR NOT NULL,
      sent_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  console.log("[apply-contract-billing-schema] contract_reminder_log table created.");

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_contract_reminder_log_lookup
    ON contract_reminder_log(contract_id, reminder_type, sent_at)
  `);
  console.log("[apply-contract-billing-schema] index created.");

  console.log("[apply-contract-billing-schema] Done.");
  process.exit(0);
}

main().catch((e) => {
  console.error("[apply-contract-billing-schema] Error:", e);
  process.exit(1);
});
