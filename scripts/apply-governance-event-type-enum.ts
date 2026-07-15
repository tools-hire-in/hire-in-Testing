/**
 * Adds missing governance_event_type enum values to the live DB.
 * Safe to run multiple times (IF NOT EXISTS pattern).
 */
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    // Add notification_sent if it isn't already present
    const existing = await client.query(
      "SELECT enum_range(null::governance_event_type) AS vals"
    );
    const vals: string[] = existing.rows[0].vals
      .replace(/[{}]/g, "")
      .split(",")
      .filter(Boolean);

    const toAdd = ["notification_sent"];
    for (const val of toAdd) {
      if (!vals.includes(val)) {
        console.log(`Adding '${val}' to governance_event_type enum…`);
        await client.query(
          `ALTER TYPE governance_event_type ADD VALUE '${val}'`
        );
        console.log(`  ✓ Added '${val}'`);
      } else {
        console.log(`  '${val}' already present — skipping`);
      }
    }
    console.log("Done.");
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((e) => {
  console.error("Migration failed:", e.message);
  process.exit(1);
});
