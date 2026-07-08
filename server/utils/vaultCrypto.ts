import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_VERSION = "v1";

function getKey(): Buffer {
  const hex = process.env.VAULT_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("VAULT_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Set it in Replit Secrets.");
  }
  return Buffer.from(hex, "hex");
}

export function encryptVaultField(plain: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, tag, encrypted]);
  return `${KEY_VERSION}:${combined.toString("base64")}`;
}

export function decryptVaultField(stored: string): string {
  if (!stored) return "";
  const colonIdx = stored.indexOf(":");
  if (colonIdx === -1) throw new Error("Invalid vault ciphertext format");
  const payload = stored.slice(colonIdx + 1);
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const key = getKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final("utf8");
}
