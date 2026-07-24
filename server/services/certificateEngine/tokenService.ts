import crypto from "crypto";

function getSigningKey(): string {
  const key = process.env.OFFER_SIGNING_KEY || process.env.LETTER_HMAC_SECRET;
  if (!key) throw new Error("OFFER_SIGNING_KEY or LETTER_HMAC_SECRET is required for certificate signing");
  return key;
}

export interface CertificateTokenResult {
  authCode: string;
  documentHash: string;
}

export function signRecognitionCertificate(fields: {
  certificateId: string;
  referenceNumber: string;
  recipientId: string;
  approverId: string;
  badgeTypeId: string;
  publicCitation: string;
  issuedAt: Date;
}): CertificateTokenResult {
  const signingKey = getSigningKey();

  const canonical = [
    fields.certificateId,
    fields.referenceNumber,
    fields.recipientId,
    fields.approverId,
    fields.badgeTypeId,
    fields.publicCitation.trim(),
    fields.issuedAt.toISOString(),
  ].join("|");

  const documentHash = crypto.createHash("sha256").update(canonical).digest("hex");
  const hmac = crypto.createHmac("sha256", signingKey).update(documentHash).digest("hex");
  const authCode = hmac.substring(0, 4).toUpperCase() + "-" + hmac.substring(4, 8).toUpperCase();

  return { authCode, documentHash };
}

export function verifyRecognitionCertificateAuth(
  stored: CertificateTokenResult & { certificateId: string; referenceNumber: string; recipientId: string; approverId: string; badgeTypeId: string; publicCitation: string; issuedAt: Date },
  providedAuthCode: string,
): boolean {
  const recomputed = signRecognitionCertificate(stored);
  const bufA = Buffer.from(recomputed.authCode.toUpperCase(), "utf8");
  const bufB = Buffer.from(providedAuthCode.toUpperCase(), "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
