// BD Decks v2 migration: add description/changes_summary/approval columns + audit log table
// Run once: npx tsx scripts/apply-bd-decks-v2.ts
// Idempotent — uses IF NOT EXISTS / IF NOT COLUMN guards.

import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("[bd-decks-v2] Starting migration…");

  // ── Extend bd_decks table ─────────────────────────────────────────────────
  await db.execute(sql`
    ALTER TABLE bd_decks
      ADD COLUMN IF NOT EXISTS description TEXT,
      ADD COLUMN IF NOT EXISTS changes_summary TEXT,
      ADD COLUMN IF NOT EXISTS approved_by VARCHAR,
      ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP
  `);
  console.log("[bd-decks-v2] bd_decks columns extended.");

  // ── Audit log table ───────────────────────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bd_deck_audit_log (
      id           VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      deck_id      VARCHAR NOT NULL REFERENCES bd_decks(id) ON DELETE CASCADE,
      action       VARCHAR(50) NOT NULL,
      actor_id     VARCHAR,
      actor_email  VARCHAR(200),
      note         TEXT,
      created_at   TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS bd_deck_audit_deck_idx ON bd_deck_audit_log(deck_id, created_at DESC)
  `);
  console.log("[bd-decks-v2] bd_deck_audit_log table ensured.");

  console.log("[bd-decks-v2] Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[bd-decks-v2] Error:", err);
  process.exit(1);
});
