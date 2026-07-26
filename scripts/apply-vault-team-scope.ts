import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("[apply-vault-team-scope] Adding scope to vaults and can_edit to vault_shares...");

  await db.execute(sql`
    ALTER TABLE vaults
      ADD COLUMN IF NOT EXISTS scope varchar(20) NOT NULL DEFAULT 'admin'
  `);

  await db.execute(sql`
    UPDATE vaults SET scope = 'personal' WHERE is_personal = true AND scope = 'admin'
  `);

  await db.execute(sql`
    ALTER TABLE vault_shares
      ADD COLUMN IF NOT EXISTS can_edit boolean NOT NULL DEFAULT false
  `);

  console.log("[apply-vault-team-scope] Done.");
  process.exit(0);
}

main().catch(err => {
  console.error("[apply-vault-team-scope] Failed:", err);
  process.exit(1);
});
