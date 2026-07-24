import { db } from "../../db";
import { recognitionCertificates } from "@shared/schema";
import { eq } from "drizzle-orm";

function randomAlphaNum(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  const bytes = require("crypto").randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

function slugifyBadge(badgeName: string): string {
  return badgeName
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 12);
}

export async function generateCertificateId(badgeName: string, year: number): Promise<{ certId: string; referenceNumber: string }> {
  const badge = slugifyBadge(badgeName);
  const yy = String(year).slice(-2);
  const maxAttempts = 10;

  for (let i = 0; i < maxAttempts; i++) {
    const rand = randomAlphaNum(6);
    const certId = `HIS-REC-${badge}-${yy}-${rand}`;
    const referenceNumber = `RC/${badge}/${year}/${rand}`;

    const existing = await db
      .select({ id: recognitionCertificates.id })
      .from(recognitionCertificates)
      .where(eq(recognitionCertificates.certificateId, certId))
      .limit(1);

    if (existing.length === 0) {
      return { certId, referenceNumber };
    }
  }

  throw new Error("Failed to generate unique certificate ID after 10 attempts");
}
