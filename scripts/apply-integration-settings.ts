/**
 * Creates the integration_settings table and integration_status enum.
 * Run with: npx tsx scripts/apply-integration-settings.ts
 */
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("[apply-integration-settings] Starting...");

  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE integration_status AS ENUM ('connected', 'error', 'unconfigured');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS integration_settings (
      key          VARCHAR PRIMARY KEY,
      status       integration_status NOT NULL DEFAULT 'unconfigured',
      last_checked_at TIMESTAMP,
      last_error   TEXT,
      meta         JSONB,
      updated_at   TIMESTAMP DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    INSERT INTO integration_settings (key, status) VALUES ('ceipal', 'unconfigured')
    ON CONFLICT (key) DO NOTHING
  `);

  await db.execute(sql`
    INSERT INTO integration_settings (key, status) VALUES ('zoom', 'unconfigured')
    ON CONFLICT (key) DO NOTHING
  `);

  console.log("[apply-integration-settings] integration_settings table created and seeded.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[apply-integration-settings] Failed:", err);
  process.exit(1);
});
