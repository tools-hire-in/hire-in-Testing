// Apply commercial intelligence schema additions.
// Adds bd_intel_metadata JSONB column to studio_content_ideas.
// Run once: npx tsx scripts/apply-commercial-intelligence-tables.ts
// Idempotent — uses ADD COLUMN IF NOT EXISTS.

import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("[commercial-intel] Applying commercial intelligence schema additions…");

  await db.execute(sql`
    ALTER TABLE studio_content_ideas
      ADD COLUMN IF NOT EXISTS bd_intel_metadata JSONB
  `);

  console.log("[commercial-intel] bd_intel_metadata column added (or already existed).");
  console.log("[commercial-intel] Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[commercial-intel] Error:", err);
  process.exit(1);
});
