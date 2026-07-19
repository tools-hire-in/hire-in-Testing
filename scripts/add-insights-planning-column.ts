/**
 * Idempotent migration: add insights_planning JSONB column to studio_articles.
 * Run via: npx tsx scripts/add-insights-planning-column.ts
 */
import { pool } from "../server/db";

async function main() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE studio_articles
        ADD COLUMN IF NOT EXISTS insights_planning jsonb DEFAULT NULL
    `);
    console.log("[migration] insights_planning column ensured on studio_articles");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[migration] Failed:", err);
  process.exit(1);
});
