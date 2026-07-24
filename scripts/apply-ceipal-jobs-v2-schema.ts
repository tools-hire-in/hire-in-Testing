/**
 * One-time script: adds Ceipal v2 enrichment columns to the jobs table.
 * Safe to run multiple times (all statements use IF NOT EXISTS / idempotent DDL).
 */
import { db } from "../server/db";
import { sql } from "drizzle-orm";

export async function applyCeipalJobsV2Schema() {
  const columns: Array<[string, string]> = [
    ["ceipal_pay_rates", "JSONB"],
    ["ceipal_industry", "TEXT"],
    ["ceipal_client", "TEXT"],
    ["ceipal_primary_recruiter", "TEXT"],
    ["remote_opportunities", "TEXT"],
    ["closing_date", "DATE"],
  ];

  for (const [col, type] of columns) {
    try {
      await db.execute(
        sql.raw(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS ${col} ${type}`)
      );
      console.log(`[ceipal-v2-schema] ensured jobs.${col}`);
    } catch (e: any) {
      console.error(`[ceipal-v2-schema] error adding jobs.${col}:`, e.message);
    }
  }
}
