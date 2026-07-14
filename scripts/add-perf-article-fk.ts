import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'studio_post_performance_article_id_fkey'
        ) THEN
          ALTER TABLE studio_post_performance
            ADD CONSTRAINT studio_post_performance_article_id_fkey
            FOREIGN KEY (article_id) REFERENCES studio_articles(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);
    console.log("✓ article_id FK constraint ensured");
  } catch (e: any) {
    console.error("Error:", e.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
