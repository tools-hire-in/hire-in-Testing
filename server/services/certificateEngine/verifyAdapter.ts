import { db } from "../../db";
import { recognitionCertificates, adminUsers, praiseBadgeTypes } from "@shared/schema";
import { eq } from "drizzle-orm";
import { verifyRecognitionCertificateAuth } from "./tokenService";

export interface RecognitionVerifyResult {
  valid: boolean;
  found: boolean;
  revoked?: boolean;
  record?: {
    id: string;
    certificateId: string;
    referenceNumber: string;
    recipientName: string;
    badgeName: string;
    badgeEmoji: string;
    recognitionDescription: string;
    contributionSummary: string;
    publicCitation: string;
    issuedAt: string;
    status: string;
    version: number;
    approverName: string;
    approverDesignation: string | null;
    pdfUrl: string | null;
  };
}

export async function verifyRecognitionCertificate(
  ref: string,
  providedAuthCode: string,
): Promise<RecognitionVerifyResult> {
  const [cert] = await db
    .select()
    .from(recognitionCertificates)
    .where(eq(recognitionCertificates.referenceNumber, ref.toUpperCase()))
    .limit(1);

  if (!cert) return { valid: false, found: false };

  if (cert.status === "revoked") {
    return { valid: false, found: true, revoked: true };
  }

  const authOk = verifyRecognitionCertificateAuth(
    {
      authCode: cert.authCode,
      documentHash: cert.documentHash,
      certificateId: cert.certificateId,
      referenceNumber: cert.referenceNumber,
      recipientId: cert.recipientId,
      approverId: cert.approverId,
      badgeTypeId: cert.badgeTypeId,
      publicCitation: cert.publicCitation,
      issuedAt: cert.issuedAt ?? new Date(),
    },
    providedAuthCode,
  );

  if (!authOk) return { valid: false, found: false };

  const [recipient, approver, badge] = await Promise.all([
    db.select({ firstName: adminUsers.firstName, lastName: adminUsers.lastName })
      .from(adminUsers).where(eq(adminUsers.id, cert.recipientId)).limit(1),
    db.select({ firstName: adminUsers.firstName, lastName: adminUsers.lastName, designation: adminUsers.designation })
      .from(adminUsers).where(eq(adminUsers.id, cert.approverId)).limit(1),
    db.select({ name: praiseBadgeTypes.name, emoji: praiseBadgeTypes.emoji })
      .from(praiseBadgeTypes).where(eq(praiseBadgeTypes.id, cert.badgeTypeId)).limit(1),
  ]);

  return {
    valid: true,
    found: true,
    record: {
      id: cert.id,
      certificateId: cert.certificateId,
      referenceNumber: cert.referenceNumber,
      recipientName: recipient[0] ? `${recipient[0].firstName} ${recipient[0].lastName}` : "Unknown",
      badgeName: badge[0]?.name ?? "Badge",
      badgeEmoji: badge[0]?.emoji ?? "🏅",
      recognitionDescription: cert.recognitionDescription,
      contributionSummary: cert.contributionSummary,
      publicCitation: cert.publicCitation,
      issuedAt: cert.issuedAt?.toISOString() ?? new Date().toISOString(),
      status: cert.status,
      version: cert.version,
      approverName: approver[0] ? `${approver[0].firstName} ${approver[0].lastName}` : "Unknown",
      approverDesignation: approver[0]?.designation ?? null,
      pdfUrl: cert.pdfUrl ?? null,
    },
  };
}
