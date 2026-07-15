import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function apply() {
  console.log("[ceo-schema] Applying CEO intelligence layer schema changes...");

  // Add specialty, bill_rate, pay_rate to contracts table
  await db.execute(sql`
    ALTER TABLE contracts
      ADD COLUMN IF NOT EXISTS specialty VARCHAR,
      ADD COLUMN IF NOT EXISTS bill_rate NUMERIC,
      ADD COLUMN IF NOT EXISTS pay_rate NUMERIC
  `);
  console.log("[ceo-schema] contracts: specialty, bill_rate, pay_rate added");

  // Create index on contracts.specialty
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_contracts_specialty ON contracts (specialty)
    WHERE specialty IS NOT NULL
  `);
  console.log("[ceo-schema] contracts: idx_contracts_specialty created");

  // Create rate_targets table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS rate_targets (
      id          VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      specialty   VARCHAR NOT NULL,
      target_bill_rate_usd NUMERIC NOT NULL,
      period_type VARCHAR NOT NULL,
      period_label VARCHAR NOT NULL,
      set_by      VARCHAR REFERENCES admin_users(id),
      notes       TEXT,
      created_at  TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log("[ceo-schema] rate_targets table created");

  console.log("[ceo-schema] Done.");
  process.exit(0);
}

apply().catch((e) => { console.error(e); process.exit(1); });
