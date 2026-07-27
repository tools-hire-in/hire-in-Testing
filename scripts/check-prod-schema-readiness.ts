/**
 * Production Schema Readiness Check
 *
 * Validates that the dev (or production) DB is safe to migrate before deploying.
 * Checks:
 *   1. No duplicate (sop_master_id, role_group_key) pairs in sop_role_assignments
 *      (would block CREATE UNIQUE INDEX sop_role_assignments_master_group_unique)
 *   2. No dangling recognition_certificates.superseded_by_id values
 *      (would block the self-referential FK addition)
 *
 * Run:
 *   npx tsx scripts/check-prod-schema-readiness.ts
 *
 * Exit codes:
 *   0 — all checks passed (or tables genuinely don't exist yet — safe first-time deploy)
 *   1 — at least one check FAILED, or an unexpected error occurred
 *
 * Error handling policy:
 *   SKIP (exit 0) only for PostgreSQL error code 42P01 (undefined_table) — the table
 *   does not exist on a first-time deploy and that is safe. ALL other errors (connection
 *   failures, auth errors, permission errors, unexpected SQL errors) → FAIL (exit 1).
 *
 * --- Dev DB baseline run (2026-07-27) ---
 * [CHECK 1] sop_role_assignments duplicates ... PASS (0 duplicates)
 * [CHECK 2] recognition_certificates dangling superseded_by_id ... PASS (0 dangling)
 * All readiness checks passed. Safe to migrate.
 */

import { db } from "../server/db";
import { sql } from "drizzle-orm";

/** Returns true if the error is a PostgreSQL "undefined_table" (42P01) error. */
function isUndefinedTable(err: unknown): boolean {
  if (err && typeof err === "object") {
    const pg = err as Record<string, unknown>;
    // node-postgres surfaces the SQLSTATE in err.code
    return pg["code"] === "42P01";
  }
  return false;
}

async function main() {
  let allPassed = true;

  // ── Check 1: sop_role_assignments (sop_master_id, role_group_key) duplicates ──
  // The migration adds a UNIQUE INDEX on (sop_master_id, role_group_key).
  // Only check rows where role_group_key IS NOT NULL (NULL values don't conflict in a unique index).
  process.stdout.write("[CHECK 1] sop_role_assignments duplicates ... ");
  try {
    const dupResult = await db.execute(sql`
      SELECT sop_master_id, role_group_key, COUNT(*) AS cnt
      FROM sop_role_assignments
      WHERE role_group_key IS NOT NULL
      GROUP BY sop_master_id, role_group_key
      HAVING COUNT(*) > 1
    `);
    const dups = dupResult.rows as Array<{ sop_master_id: string; role_group_key: string; cnt: string }>;
    if (dups.length === 0) {
      console.log("PASS (0 duplicates)");
    } else {
      console.log(`FAIL (${dups.length} duplicate group(s) found)`);
      console.error("  Duplicate (sop_master_id, role_group_key) pairs:");
      for (const row of dups) {
        console.error(`    sop_master_id=${row.sop_master_id}  role_group_key=${row.role_group_key}  count=${row.cnt}`);
      }
      console.error(
        "  Action required: deduplicate these rows before applying the migration\n" +
        "  (e.g. DELETE the older duplicate keeping only the most recent per pair)."
      );
      allPassed = false;
    }
  } catch (err) {
    if (isUndefinedTable(err)) {
      // Table does not exist yet — this is a first-time deploy; no data to check.
      console.log("SKIP (sop_role_assignments table does not exist yet — first-time deploy is safe)");
    } else {
      console.log("FAIL (unexpected error)");
      console.error("  Details:", err);
      allPassed = false;
    }
  }

  // ── Check 2: recognition_certificates dangling superseded_by_id ──────────────
  // The migration (and the schema FK change) adds a self-referential FK:
  //   superseded_by_id REFERENCES recognition_certificates(id) ON DELETE SET NULL
  // Any row where superseded_by_id points to a non-existent id would block the FK addition.
  process.stdout.write("[CHECK 2] recognition_certificates dangling superseded_by_id ... ");
  try {
    const danglingResult = await db.execute(sql`
      SELECT rc.id, rc.superseded_by_id
      FROM recognition_certificates rc
      WHERE rc.superseded_by_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM recognition_certificates rc2
          WHERE rc2.id = rc.superseded_by_id
        )
    `);
    const dangling = danglingResult.rows as Array<{ id: string; superseded_by_id: string }>;
    if (dangling.length === 0) {
      console.log("PASS (0 dangling)");
    } else {
      console.log(`FAIL (${dangling.length} dangling reference(s) found)`);
      console.error("  Rows with superseded_by_id pointing to non-existent certificate:");
      for (const row of dangling) {
        console.error(`    id=${row.id}  superseded_by_id=${row.superseded_by_id}`);
      }
      console.error(
        "  Action required: set superseded_by_id = NULL for these rows before applying the migration\n" +
        "  (e.g. UPDATE recognition_certificates SET superseded_by_id = NULL WHERE id IN (...))."
      );
      allPassed = false;
    }
  } catch (err) {
    if (isUndefinedTable(err)) {
      // Table does not exist yet — this is a first-time deploy; no data to check.
      console.log("SKIP (recognition_certificates table does not exist yet — first-time deploy is safe)");
    } else {
      console.log("FAIL (unexpected error)");
      console.error("  Details:", err);
      allPassed = false;
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  if (allPassed) {
    console.log("\nAll readiness checks passed. Safe to migrate.");
    process.exit(0);
  } else {
    console.error("\nOne or more readiness checks FAILED. Resolve the issues above before deploying.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Unexpected error running readiness check:", err);
  process.exit(1);
});
