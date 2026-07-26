import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function apply() {
  console.log("[contract-financial-schema] Applying contract type enum & financial model...");

  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contract_type') THEN
        CREATE TYPE contract_type AS ENUM ('contract_hourly', 'permanent_placement', 'contract_to_hire');
      END IF;
    END $$;
  `);
  console.log("[contract-financial-schema] contract_type enum ensured");

  await db.execute(sql`
    ALTER TABLE contracts
      ADD COLUMN IF NOT EXISTS contract_type contract_type NOT NULL DEFAULT 'contract_hourly',
      ADD COLUMN IF NOT EXISTS passthrough_fee NUMERIC,
      ADD COLUMN IF NOT EXISTS referral_fee NUMERIC,
      ADD COLUMN IF NOT EXISTS gross_margin NUMERIC,
      ADD COLUMN IF NOT EXISTS business_marketing_cost NUMERIC,
      ADD COLUMN IF NOT EXISTS net_margin NUMERIC,
      ADD COLUMN IF NOT EXISTS currency VARCHAR DEFAULT 'USD',
      ADD COLUMN IF NOT EXISTS contract_to_hire_conversion_date DATE,
      ADD COLUMN IF NOT EXISTS conversion_fee NUMERIC
  `);
  console.log("[contract-financial-schema] contracts: financial columns added");

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_contracts_type
      ON contracts (contract_type)
  `);
  console.log("[contract-financial-schema] idx_contracts_type created");

  console.log("[contract-financial-schema] Done.");
  process.exit(0);
}

apply().catch((e) => { console.error(e); process.exit(1); });
