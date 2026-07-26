// Apply BD Pipeline tables (Task #1699) via direct SQL.
// Run once: npx tsx scripts/apply-bd-pipeline-tables.ts
// Idempotent — uses CREATE TABLE IF NOT EXISTS / CREATE TYPE IF NOT EXISTS.

import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("[bd-pipeline-tables] Applying BD pipeline tables…");

  // bd_prospects — companies being cultivated pre-contract
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bd_prospects (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      company_name VARCHAR(300) NOT NULL,
      contact_name VARCHAR(200),
      contact_email VARCHAR(200),
      contact_phone VARCHAR(50),
      industry VARCHAR(100),
      source VARCHAR(100),
      status VARCHAR(50) NOT NULL DEFAULT 'new',
      icp_score INTEGER,
      assigned_to VARCHAR REFERENCES admin_users(id) ON DELETE SET NULL,
      linked_client_id VARCHAR,
      notes TEXT,
      last_activity_at TIMESTAMP,
      created_by VARCHAR REFERENCES admin_users(id) ON DELETE SET NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`CREATE INDEX IF NOT EXISTS bd_prospects_status_idx ON bd_prospects(status)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS bd_prospects_assigned_to_idx ON bd_prospects(assigned_to)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS bd_prospects_last_activity_idx ON bd_prospects(last_activity_at)`);

  // bd_deals — deals associated with a prospect
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bd_deals (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      prospect_id VARCHAR NOT NULL REFERENCES bd_prospects(id) ON DELETE CASCADE,
      title VARCHAR(300) NOT NULL,
      stage VARCHAR(50) NOT NULL DEFAULT 'discovery',
      deal_value NUMERIC(15,2),
      headcount INTEGER,
      specialty VARCHAR(100),
      probability INTEGER,
      expected_close_date DATE,
      won_at TIMESTAMP,
      lost_at TIMESTAMP,
      lost_reason TEXT,
      assigned_to VARCHAR REFERENCES admin_users(id) ON DELETE SET NULL,
      created_by VARCHAR REFERENCES admin_users(id) ON DELETE SET NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`CREATE INDEX IF NOT EXISTS bd_deals_prospect_id_idx ON bd_deals(prospect_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS bd_deals_stage_idx ON bd_deals(stage)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS bd_deals_assigned_to_idx ON bd_deals(assigned_to)`);

  // bd_activities — logged interactions against a prospect or deal
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bd_activities (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      prospect_id VARCHAR REFERENCES bd_prospects(id) ON DELETE CASCADE,
      deal_id VARCHAR REFERENCES bd_deals(id) ON DELETE SET NULL,
      activity_type VARCHAR(50) NOT NULL,
      subject VARCHAR(300) NOT NULL,
      body TEXT,
      duration_minutes INTEGER,
      outcome VARCHAR(50),
      activity_date DATE NOT NULL,
      logged_by VARCHAR REFERENCES admin_users(id) ON DELETE SET NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`CREATE INDEX IF NOT EXISTS bd_activities_prospect_id_idx ON bd_activities(prospect_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS bd_activities_deal_id_idx ON bd_activities(deal_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS bd_activities_activity_date_idx ON bd_activities(activity_date)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS bd_activities_logged_by_idx ON bd_activities(logged_by)`);

  // Add FK from bd_prospects.linked_client_id → contract_clients.id (idempotent)
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'bd_prospects_linked_client_id_fkey'
      ) THEN
        ALTER TABLE bd_prospects
          ADD CONSTRAINT bd_prospects_linked_client_id_fkey
          FOREIGN KEY (linked_client_id) REFERENCES contract_clients(id) ON DELETE SET NULL;
      END IF;
    END $$
  `);

  console.log("[bd-pipeline-tables] Tables created successfully.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[bd-pipeline-tables] Error:", err);
  process.exit(1);
});
