// One-time migration: add social_captions JSONB column to jobs table.
// Run via: npx tsx scripts/add-social-captions.ts
import { pool } from "../server/db";

async function run() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE jobs
      ADD COLUMN IF NOT EXISTS social_captions JSONB;
    `);
    console.log("[migration] social_captions column added to jobs table (or already existed).");
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error("[migration] Failed:", err);
  process.exit(1);
});
