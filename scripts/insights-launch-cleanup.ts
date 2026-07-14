/**
 * Insights Launch Cleanup Script
 *
 * Idempotent cleanup for the Hire'in Insights launch batch:
 * 1. Archives any junk/test articles with null or empty slugs
 * 2. Verifies all 13 seed articles (hirein-insights-launch-v1) are present with expanded content
 * 3. Reports distribution by category and word count sufficiency
 *
 * Run: npx tsx scripts/insights-launch-cleanup.ts
 */

import { db } from "../server/db";
import { studioArticles } from "../shared/schema";
import { sql, isNull, or, eq, ne } from "drizzle-orm";

async function main() {
  console.log("=== Hire'in Insights Launch Cleanup ===\n");

  // Step 1: Archive null/blank-slug articles that are not already archived
  const archiveResult = await db
    .update(studioArticles)
    .set({ status: "archived" } as any)
    .where(
      sql`(slug IS NULL OR slug = '') AND status != 'archived'`
    )
    .returning({ id: studioArticles.id, title: studioArticles.title });

  if (archiveResult.length > 0) {
    console.log(`Archived ${archiveResult.length} junk/null-slug articles:`);
    archiveResult.forEach((r) => console.log(`  - ${r.title} (${r.id})`));
  } else {
    console.log("No junk articles to archive (already clean).");
  }

  // Step 2: Verify the 13 seed articles
  const seeds = await db.execute(sql`
    SELECT slug, status, char_length(body_markdown) as body_chars
    FROM studio_articles
    WHERE seed_batch_id = 'hirein-insights-launch-v1'
    ORDER BY created_at ASC
  `);

  console.log(`\nSeed batch articles: ${seeds.rows.length} (expected 13)`);
  if (seeds.rows.length !== 13) {
    console.error("ERROR: Expected exactly 13 seed articles!");
    process.exit(1);
  }

  let allGood = true;
  seeds.rows.forEach((row: any) => {
    const chars = parseInt(row.body_chars ?? "0", 10);
    // 600 words * ~5 chars/word ≈ 3000 chars minimum
    const ok = chars >= 3000;
    if (!ok) allGood = false;
    console.log(`  ${ok ? "OK" : "FAIL"} ${row.slug}: ${chars} chars (${row.status})`);
  });

  // Step 3: Category distribution
  const dist = await db.execute(sql`
    SELECT category, COUNT(*) as cnt
    FROM studio_articles
    WHERE seed_batch_id = 'hirein-insights-launch-v1'
    GROUP BY category
    ORDER BY cnt DESC
  `);

  console.log("\nCategory distribution:");
  dist.rows.forEach((r: any) => console.log(`  ${r.category}: ${r.cnt} article(s)`));

  // Step 4: Confirm no non-archived null slugs remain
  const remaining = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM studio_articles WHERE (slug IS NULL OR slug = '') AND status != 'archived'
  `);
  const nullRemaining = parseInt((remaining.rows[0] as any).cnt, 10);
  console.log(`\nNon-archived null-slug articles remaining: ${nullRemaining} (expected 0)`);

  if (!allGood || nullRemaining > 0) {
    console.error("\nCleanup completed with issues. See above.");
    process.exit(1);
  }

  console.log("\nAll checks passed. Launch batch is clean and ready for editorial review.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
