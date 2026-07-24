/**
 * Adds columns needed for SOP wave compliance goals:
 *   performance_goals.source     — tags goals as 'sop_compliance'
 *   performance_goals.parent_goal_id — manager roll-up FK (self-referential)
 * Also adds 'compliance' and 'operational' to the performance_goal_category enum.
 *
 * Run once: npx tsx scripts/add-sop-compliance-goals-schema.ts
 * Idempotent — safe to re-run.
 */

import { pool } from "../server/db";

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Add enum values (IF NOT EXISTS guard uses DO block)
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum
          WHERE enumlabel = 'compliance'
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'performance_goal_category')
        ) THEN
          ALTER TYPE performance_goal_category ADD VALUE 'compliance';
        END IF;
      END$$;
    `);
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum
          WHERE enumlabel = 'operational'
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'performance_goal_category')
        ) THEN
          ALTER TYPE performance_goal_category ADD VALUE 'operational';
        END IF;
      END$$;
    `);

    // 2. Add source column to performance_goals
    await client.query(`
      ALTER TABLE performance_goals
        ADD COLUMN IF NOT EXISTS source VARCHAR(64),
        ADD COLUMN IF NOT EXISTS parent_goal_id VARCHAR REFERENCES performance_goals(id) ON DELETE SET NULL;
    `);

    // 3. Index for fast lookup of compliance goals per user
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pg_source ON performance_goals(source)
        WHERE source IS NOT NULL;
    `);

    await client.query("COMMIT");
    console.log("[schema] SOP compliance goal columns applied successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[schema] Migration failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
