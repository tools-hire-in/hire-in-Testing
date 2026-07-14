import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function applyVaultShares() {
  console.log("[apply-vault-shares] Adding isPersonal column to vaults...");

  await db.execute(sql`
    ALTER TABLE vaults
    ADD COLUMN IF NOT EXISTS is_personal boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS owner_id varchar REFERENCES admin_users(id);
  `);
  console.log("[apply-vault-shares] vaults columns added.");

  console.log("[apply-vault-shares] Creating vault_shares table...");
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS vault_shares (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      vault_id varchar NOT NULL REFERENCES vaults(id),
      user_id varchar NOT NULL REFERENCES admin_users(id),
      role varchar(20) NOT NULL DEFAULT 'viewer',
      granted_by varchar NOT NULL REFERENCES admin_users(id),
      granted_at timestamp NOT NULL DEFAULT now(),
      revoked_at timestamp,
      revoked_by varchar
    );
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS vault_shares_vault_idx ON vault_shares(vault_id);
    CREATE INDEX IF NOT EXISTS vault_shares_user_idx ON vault_shares(user_id);
  `);

  console.log("[apply-vault-shares] Done.");
  process.exit(0);
}

applyVaultShares().catch(e => { console.error(e); process.exit(1); });
