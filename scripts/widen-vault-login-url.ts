/**
 * One-off migration: widen vault_secrets.login_url from varchar(512) to text.
 * OAuth/SSO URLs regularly exceed 512 characters. This is idempotent — running
 * it on a column already typed as text is a no-op in PostgreSQL.
 */
import { sql } from "drizzle-orm";
import { db } from "../server/db";

async function main() {
  console.log("[widen-vault-login-url] Widening vault_secrets.login_url to text...");
  await db.execute(sql`ALTER TABLE vault_secrets ALTER COLUMN login_url TYPE text`);
  console.log("[widen-vault-login-url] Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[widen-vault-login-url] Failed:", err);
  process.exit(1);
});
