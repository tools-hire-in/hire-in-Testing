/**
 * Creates the studio_post_performance table and enum.
 * Run via: npx tsx scripts/apply-studio-post-performance.ts
 *
 * Safe to re-run — uses IF NOT EXISTS guards throughout.
 */
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE studio_post_platform AS ENUM (
          'linkedin', 'instagram', 'facebook', 'x', 'website', 'twitter', 'other'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    console.log("✓ Enum studio_post_platform ensured");

    await client.query(`
      CREATE TABLE IF NOT EXISTS studio_post_performance (
        id                VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        idea_id           VARCHAR NOT NULL REFERENCES studio_content_ideas(id) ON DELETE CASCADE,
        article_id        VARCHAR,
        platform          TEXT NOT NULL,
        measured_at       DATE NOT NULL,
        impressions       INTEGER,
        reactions         INTEGER,
        comments          INTEGER,
        shares            INTEGER,
        clicks            INTEGER,
        reach             INTEGER,
        what_worked       TEXT,
        logged_by_user_id VARCHAR NOT NULL REFERENCES admin_users(id),
        created_at        TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✓ Table studio_post_performance ensured");

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_spp_idea_id ON studio_post_performance(idea_id, created_at DESC);
    `);
    console.log("✓ Indexes ensured");

    await client.query("COMMIT");
    console.log("Done.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
