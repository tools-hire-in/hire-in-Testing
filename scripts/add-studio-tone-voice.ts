/**
 * Migration: add tone_voice and content_goal columns to studio_articles.
 *
 * Run with:  npx tsx scripts/add-studio-tone-voice.ts
 *
 * Idempotent — uses ADD COLUMN IF NOT EXISTS so it is safe to re-run.
 * Both columns are nullable varchars with no default, so existing rows
 * are unaffected (they simply have NULL and will fall back to the
 * brand-default / auto-derived values at generation time).
 */

import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("[add-studio-tone-voice] Running migration…");

  await db.execute(sql`
    ALTER TABLE studio_articles
      ADD COLUMN IF NOT EXISTS tone_voice varchar,
      ADD COLUMN IF NOT EXISTS content_goal varchar
  `);

  console.log("[add-studio-tone-voice] Done — tone_voice and content_goal ensured on studio_articles.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[add-studio-tone-voice] Migration failed:", err);
  process.exit(1);
});
