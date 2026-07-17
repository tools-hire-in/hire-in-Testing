// Apply BD Decks governance lock (one-time migration).
// Run once: npx tsx scripts/apply-bd-decks-lock.ts
//
// This script:
//   1. Adds is_locked + locked_at columns to bd_decks (idempotent)
//   2. Hard-deletes all archived master rows
//   3. Hard-deletes any duplicate active masters beyond one per domain
//   4. UPDATEs the three surviving master rows with canonical slide content,
//      sets is_locked=true, status='active', version='v1'
//   5. Inserts audit log rows for each locked master

import { db } from "../server/db";
import { sql } from "drizzle-orm";
import { MASTER_DECK_SEEDS } from "../server/data/masterDeckSeeds";

async function main() {
  console.log("[bd-lock] Starting BD decks governance lock migration...");

  // ── Step 1: Add columns (idempotent) ────────────────────────────────────────
  await db.execute(sql`
    ALTER TABLE bd_decks
      ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP
  `);
  console.log("[bd-lock] Columns is_locked + locked_at ensured.");

  // ── Step 2: Hard-delete all archived master rows ────────────────────────────
  const archivedDelResult = await db.execute(sql`
    DELETE FROM bd_decks
    WHERE deck_type = 'master' AND status = 'archived'
    RETURNING id, domain, title
  `);
  for (const row of archivedDelResult.rows as any[]) {
    console.log(`[bd-lock] Hard-deleted archived master: ${row.domain} / ${row.title} (${row.id})`);
  }
  console.log(`[bd-lock] Archived masters deleted: ${archivedDelResult.rows.length}`);

  // ── Step 3: Hard-delete duplicate active masters (keep highest created_at) ──
  const domains = ["it", "general", "healthcare"];
  for (const domain of domains) {
    const allMasters = await db.execute(sql`
      SELECT id, created_at FROM bd_decks
      WHERE domain = ${domain} AND deck_type = 'master'
      ORDER BY created_at DESC
    `);
    const rows = allMasters.rows as any[];
    if (rows.length > 1) {
      const toDelete = rows.slice(1).map((r: any) => r.id as string);
      for (const dupId of toDelete) {
        await db.execute(sql`DELETE FROM bd_decks WHERE id = ${dupId}`);
        console.log(`[bd-lock] Hard-deleted duplicate master for domain="${domain}" id=${dupId}`);
      }
    }
  }

  // ── Step 4: Upsert canonical content and lock each master ───────────────────
  // Healthcare: preserve existing slides unchanged — only lock it in place.
  // IT + General: update slides to canonical seed content.
  const PRESERVE_SLIDES_DOMAINS = new Set(["healthcare"]);

  for (const domainKey of ["it", "general", "healthcare"] as const) {
    const seed = MASTER_DECK_SEEDS[domainKey];
    const slidesJson = JSON.stringify(seed.slides);
    const preserveSlides = PRESERVE_SLIDES_DOMAINS.has(seed.domain);

    // Find the surviving master row for this domain
    const existing = await db.execute(sql`
      SELECT id FROM bd_decks
      WHERE domain = ${seed.domain} AND deck_type = 'master'
      LIMIT 1
    `);

    let deckId: string;

    if (existing.rows.length === 0) {
      // No master exists at all — insert one with canonical seed content
      const inserted = await db.execute(sql`
        INSERT INTO bd_decks
          (title, domain, deck_type, version, status, slides, is_locked, locked_at)
        VALUES
          (${seed.title}, ${seed.domain}, 'master', 'v1', 'active',
           ${slidesJson}::jsonb, true, NOW())
        RETURNING id
      `);
      deckId = (inserted.rows[0] as any).id as string;
      console.log(`[bd-lock] Inserted new master for domain="${seed.domain}" id=${deckId}`);
    } else {
      deckId = (existing.rows[0] as any).id as string;
      if (preserveSlides) {
        // Healthcare: lock only — do NOT overwrite existing slides or title
        await db.execute(sql`
          UPDATE bd_decks
          SET
            is_locked  = true,
            locked_at  = NOW(),
            status     = 'active',
            version    = 'v1',
            updated_at = NOW()
          WHERE id = ${deckId}
        `);
        console.log(`[bd-lock] Locked (slides preserved) master for domain="${seed.domain}" id=${deckId}`);
      } else {
        // IT + General: apply canonical slides + title
        await db.execute(sql`
          UPDATE bd_decks
          SET
            title      = ${seed.title},
            slides     = ${slidesJson}::jsonb,
            is_locked  = true,
            locked_at  = NOW(),
            status     = 'active',
            version    = 'v1',
            updated_at = NOW()
          WHERE id = ${deckId}
        `);
        console.log(`[bd-lock] Locked & updated master for domain="${seed.domain}" id=${deckId}`);
      }
    }

    // ── Step 5: Insert audit log ─────────────────────────────────────────────
    await db.execute(sql`
      INSERT INTO bd_deck_audit_log (deck_id, action, actor_id, actor_email, note)
      VALUES (
        ${deckId},
        'master_locked',
        NULL,
        'system',
        'Hard lock applied via governance migration — apply-bd-decks-lock.ts'
      )
    `);
    console.log(`[bd-lock] Audit log written for domain="${seed.domain}"`);
  }

  console.log("[bd-lock] Migration complete. All three masters are now locked.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[bd-lock] Error:", err);
  process.exit(1);
});
