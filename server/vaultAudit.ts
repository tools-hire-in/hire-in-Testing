import crypto from "crypto";
import { db } from "./db";
import { vaultAuditLogs } from "../shared/schema";

export type VaultAuditAction =
  | "reveal_password"
  | "copy_password"
  | "copy_username"
  | "create_secret"
  | "edit_secret"
  | "archive_secret"
  | "create_vault"
  | "edit_vault"
  | "archive_vault"
  | "grant_access"
  | "revoke_access"
  | "failed_access"
  | "totp_failed"
  | "exit_revoke"
  | "share_vault"
  | "revoke_vault_share"
  | "transfer_vault_ownership"
  | "team_vault_create"
  | "team_vault_member_add"
  | "team_vault_member_remove"
  | "team_vault_member_update";

function hashValue(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export async function logVaultAudit(opts: {
  actorId: string;
  secretId?: string;
  vaultId?: string;
  action: VaultAuditAction;
  ip?: string;
  userAgent?: string;
  reason?: string;
  meta?: Record<string, unknown> | string;
}): Promise<void> {
  try {
    await db.insert(vaultAuditLogs).values({
      actorId: opts.actorId,
      secretId: opts.secretId ?? null,
      vaultId: opts.vaultId ?? null,
      action: opts.action,
      ipHash: opts.ip ? hashValue(opts.ip) : null,
      uaHash: opts.userAgent ? hashValue(opts.userAgent) : null,
      reason: opts.reason ?? null,
      meta: opts.meta ? (typeof opts.meta === "string" ? opts.meta : JSON.stringify(opts.meta)) : null,
    });
  } catch (err) {
    console.error("[VaultAudit] Failed to write audit log:", err);
  }
}
