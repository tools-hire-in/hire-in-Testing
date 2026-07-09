/**
 * One-time schema migration for salary structure templates.
 * Run with: npx tsx scripts/apply-salary-structure-schema.ts
 */
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function run() {
  console.log("Applying salary structure schema changes...");

  // 1. Add new columns to admin_users
  await db.execute(sql`
    ALTER TABLE admin_users
      ADD COLUMN IF NOT EXISTS salary_structure_id VARCHAR,
      ADD COLUMN IF NOT EXISTS pf_exempt BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS esi_disability BOOLEAN NOT NULL DEFAULT false
  `);
  console.log("✓ admin_users columns added");

  // 2. Create salary_structures table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS salary_structures (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR NOT NULL,
      description TEXT,
      effective_date DATE,
      is_active BOOLEAN NOT NULL DEFAULT true,
      pf_mode VARCHAR NOT NULL DEFAULT 'restricted',
      created_by VARCHAR REFERENCES admin_users(id),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log("✓ salary_structures table created");

  // 3. Create salary_structure_rules table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS salary_structure_rules (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      structure_id VARCHAR NOT NULL REFERENCES salary_structures(id),
      component_name VARCHAR NOT NULL,
      rule_type VARCHAR NOT NULL,
      value NUMERIC NOT NULL DEFAULT 0,
      reference_component VARCHAR,
      lop_mode VARCHAR NOT NULL DEFAULT 'proportional',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log("✓ salary_structure_rules table created");

  // 4. Add components jsonb column to salary_slips
  await db.execute(sql`
    ALTER TABLE salary_slips
      ADD COLUMN IF NOT EXISTS components JSONB
  `);
  console.log("✓ salary_slips.components column added");

  console.log("\nAll schema changes applied successfully!");
  process.exit(0);
}

run().catch((err) => {
  console.error("Schema migration failed:", err);
  process.exit(1);
});
