/**
 * scripts/ensure-enum-values.ts
 *
 * Idempotent pre-push guard for PostgreSQL ENUM additions.
 *
 * WHY THIS EXISTS
 * ───────────────
 * drizzle-kit generates `ALTER TYPE ... ADD VALUE 'x'` without an
 * `IF NOT EXISTS` clause.  If that value already exists in the target DB
 * (e.g. prod already received a partial push) the statement throws
 * "ERROR: enum label already exists" and aborts the migration.
 *
 * Additionally, `ALTER TYPE ... ADD VALUE` cannot run inside a transaction
 * on PostgreSQL < 12, so these statements must always be issued outside
 * any BEGIN/COMMIT block.
 *
 * This script runs BEFORE `db:push` in post-merge.sh.  By the time
 * drizzle runs, every value declared here already exists in the DB, so
 * drizzle silently skips its own ADD VALUE statements.
 *
 * HOW TO ADD A NEW ENUM VALUE
 * ───────────────────────────
 * When a future migration adds a new enum value, append a call to
 * addValue() below — one line per value, in the section for its type.
 * Never remove existing entries; this file is append-only.
 *
 * HOW TO ADD A NEW ENUM TYPE
 * ──────────────────────────
 * When a migration creates a brand-new ENUM type, add a createType()
 * call in the "New enum types" section below.
 */

import pg from "pg";

const { Client } = pg;

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    // ── helpers ────────────────────────────────────────────────────────────────

    /**
     * Create a new ENUM type if it does not already exist.
     * Uses a DO block so it is safe to run repeatedly.
     */
    async function createType(typeName: string, values: string[]) {
      const valueList = values.map((v) => `'${v}'`).join(", ");
      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_type WHERE typname = '${typeName}'
          ) THEN
            CREATE TYPE "public"."${typeName}" AS ENUM(${valueList});
          END IF;
        END
        $$;
      `);
      console.log(`[ensure-enum] type ${typeName}: ensured`);
    }

    /**
     * Add a single value to an existing ENUM type using IF NOT EXISTS.
     * Must run outside a transaction — this client has autocommit=true.
     */
    async function addValue(typeName: string, value: string) {
      await client.query(
        `ALTER TYPE "public"."${typeName}" ADD VALUE IF NOT EXISTS '${value}';`
      );
      console.log(`[ensure-enum] ${typeName} += '${value}': ensured`);
    }

    // ── New enum types ─────────────────────────────────────────────────────────
    // Add createType() calls here when a migration introduces a brand-new ENUM.

    await createType("integration_status", [
      "connected",
      "error",
      "unconfigured",
    ]);

    // ── governance_control_type additions ──────────────────────────────────────
    await addValue("governance_control_type", "manager_checkin_obligation");
    await addValue("governance_control_type", "manager_coaching_obligation");

    // ── governance_event_type additions ────────────────────────────────────────
    await addValue("governance_event_type", "notification_sent");

    // ── attendance_status additions ────────────────────────────────────────────
    // short_day was also added post-initial-schema; keep it here as belt-and-
    // suspenders alongside the ensure block in server/index.ts.
    await addValue("attendance_status", "short_day");

    // ── user_role additions ────────────────────────────────────────────────────
    await addValue("user_role", "executive");

    console.log("[ensure-enum] All enum values ensured successfully.");
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error("[ensure-enum] FATAL:", err.message);
  process.exit(1);
});
