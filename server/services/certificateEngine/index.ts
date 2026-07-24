/**
 * Certificate Engine — Public API
 *
 * issueRecognitionCertificate(praisePostId, approverUserId)
 *   Validates approval state, generates cert ID, token, QR, renders PDF,
 *   uploads to object storage, writes DB rows, logs audit, sends notification.
 *
 * revokeCertificate(certId, actorId, reason)
 * correctCertificate(certId, actorId, reason, newData)
 *
 * All functions are self-contained — zero praise-route coupling.
 */

import { db } from "../../db";
import {
  praisePosts, adminUsers, praiseBadgeTypes,
  recognitionCertificates, recognitionCertificateAudit,
  notifications, systemSettings,
} from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { generateCertificateId } from "./certificateId";
import { signRecognitionCertificate } from "./tokenService";
import { generateQrDataUrl } from "./qrCode";
import { renderCertificatePdf } from "./pdfRenderer";
import { renderTemplate4 } from "./templates/template4.html";
import { renderTemplate1 } from "./templates/template1.html";
import { ObjectStorageService } from "../../replit_integrations/object_storage/objectStorage";

const objectStorageService = new ObjectStorageService();

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
}

async function getActiveCertificateTemplate(): Promise<"template4" | "template1"> {
  try {
    const [row] = await db
      .select({ value: systemSettings.value })
      .from(systemSettings)
      .where(eq(systemSettings.key, "recognition_certificate_template"))
      .limit(1);
    if (row?.value === "template1") return "template1";
  } catch {}
  return "template4";
}

async function logAudit(certificateId: string, actorId: string, action: string, metadata?: Record<string, unknown>) {
  try {
    await db.insert(recognitionCertificateAudit).values({
      certificateId,
      actorId,
      action,
      metadata: metadata ?? null,
    });
  } catch (err) {
    console.error("[certEngine] audit log failed:", err);
  }
}

async function notifyUser(userId: string, type: string, title: string, message: string, metadata?: Record<string, unknown>) {
  try {
    await db.insert(notifications).values({ userId, type, title, message, metadata: metadata ?? null });
  } catch {}
}

export interface IssuedCertificate {
  certificateId: string;
  referenceNumber: string;
  authCode: string;
  pdfUrl: string | null;
}

export async function issueRecognitionCertificate(
  praisePostId: string,
  approverUserId: string,
  options?: { approvedCitation?: string },
): Promise<IssuedCertificate> {
  // 1. Load praise post
  const [post] = await db.select().from(praisePosts).where(eq(praisePosts.id, praisePostId)).limit(1);
  if (!post) throw new Error(`Praise post ${praisePostId} not found`);

  // Accept pending_verification (approve+issue) or approved (issue only) or approved (correct flow)
  const allowedStatuses = ["approved", "pending_verification"];
  if (!allowedStatuses.includes(post.certificateStatus ?? "")) {
    throw new Error(`Recognition must be in pending_verification or approved state before issuance (current: ${post.certificateStatus})`);
  }
  // Citation: from options (approve+issue path) or already stored (issue-only path)
  const approvedCitation: string = options?.approvedCitation?.trim() || post.publicCitationApproved || "";
  if (!approvedCitation.trim()) throw new Error("Approved citation is required before issuance");

  // 2. Load required records
  const [recipient, approver, badge] = await Promise.all([
    db.select({ id: adminUsers.id, firstName: adminUsers.firstName, lastName: adminUsers.lastName })
      .from(adminUsers).where(eq(adminUsers.id, post.recipientId)).limit(1),
    db.select({ id: adminUsers.id, firstName: adminUsers.firstName, lastName: adminUsers.lastName, designation: adminUsers.designation })
      .from(adminUsers).where(eq(adminUsers.id, approverUserId)).limit(1),
    db.select({ id: praiseBadgeTypes.id, name: praiseBadgeTypes.name, emoji: praiseBadgeTypes.emoji })
      .from(praiseBadgeTypes).where(eq(praiseBadgeTypes.id, post.badgeTypeId)).limit(1),
  ]);
  if (!recipient[0]) throw new Error("Recipient not found");
  if (!approver[0]) throw new Error("Approver not found");
  if (!badge[0]) throw new Error("Badge type not found");

  const now = new Date();
  const year = now.getFullYear();

  // 3. Generate certificate ID
  const { certId, referenceNumber } = await generateCertificateId(badge[0].name, year);

  // 4. Sign (HMAC auth code)
  const { authCode, documentHash } = signRecognitionCertificate({
    certificateId: certId,
    referenceNumber,
    recipientId: recipient[0].id,
    approverId: approver[0].id,
    badgeTypeId: badge[0].id,
    publicCitation: approvedCitation,
    issuedAt: now,
  });

  // 5. QR code
  const verifyUrl = `https://hire-in.com/verify?ref=${encodeURIComponent(referenceNumber)}&auth=${authCode}`;
  const qrDataUrl = await generateQrDataUrl(verifyUrl);

  // 6. Choose template and render HTML
  const activeTemplate = await getActiveCertificateTemplate();
  const recipientName = `${recipient[0].firstName} ${recipient[0].lastName}`;
  const approverName = `${approver[0].firstName} ${approver[0].lastName}`;
  const approverTitle = approver[0].designation || "Authorized Approver";

  const commonData = {
    employeeName: recipientName,
    badgeName: badge[0].name,
    badgeEmoji: badge[0].emoji,
    publicCitation: approvedCitation,
    issueDate: formatDate(now),
    recognitionDate: formatDate(post.createdAt ?? now),
    certificateId: certId,
    approverName,
    approverTitle,
    qrDataUrl,
    verifyUrl,
  };

  let html: string;
  if (activeTemplate === "template1") {
    html = renderTemplate1(commonData);
  } else {
    html = renderTemplate4({
      ...commonData,
      recognitionDescription: post.recognitionDescription || "",
      contributionSummary: post.contributionSummary || "",
    });
  }

  // 7. Render PDF
  const pdfBuffer = await renderCertificatePdf({ html });

  // 8. Upload to object storage — must succeed; abort issuance on failure
  const storagePath = `recognition-certificates/${year}/${certId}.pdf`;
  let pdfUrl: string;
  try {
    await objectStorageService.uploadBuffer(pdfBuffer, storagePath, "application/pdf");
    pdfUrl = `/objects/${storagePath}`;
  } catch (err) {
    console.error("[certEngine] PDF upload failed:", err);
    throw new Error(`Certificate issuance aborted: PDF could not be stored. ${err instanceof Error ? err.message : String(err)}`);
  }

  // 9–11. Atomically write cert row + update post status + audit log in a transaction
  const cert = await db.transaction(async (tx) => {
    const [inserted] = await tx.insert(recognitionCertificates).values({
      praisePostId,
      certificateId: certId,
      recipientId: recipient[0].id,
      approverId: approver[0].id,
      badgeTypeId: badge[0].id,
      recognitionDescription: post.recognitionDescription || "",
      contributionSummary: post.contributionSummary || "",
      publicCitation: approvedCitation,
      recognitionContext: post.recognitionContext ?? null,
      referenceNumber,
      authCode,
      documentHash,
      pdfStoragePath: storagePath,
      pdfUrl,
      status: "issued",
      version: 1,
      issuedAt: now,
    }).returning();

    await tx.execute(
      sql`UPDATE praise_posts SET certificate_status = 'issued', public_citation_approved = ${approvedCitation} WHERE id = ${praisePostId}`
    );

    await tx.insert(recognitionCertificateAudit).values({
      certificateId: inserted.id,
      actorId: approverUserId,
      action: "issued",
      metadata: { referenceNumber, certId },
    });

    return inserted;
  });

  // 12. Notify recipient (fire-and-forget, outside transaction)
  await notifyUser(
    recipient[0].id,
    "recognition_certificate_issued",
    `🏆 Your ${badge[0].emoji} ${badge[0].name} certificate is ready!`,
    `Your verified recognition certificate has been issued. Certificate ID: ${certId}`,
    { certificateId: cert.id, certId, referenceNumber, pdfUrl },
  );

  return { certificateId: certId, referenceNumber, authCode, pdfUrl };
}

export async function regenerateCertificatePdf(
  certDbId: string,
  actorId: string,
): Promise<{ pdfUrl: string }> {
  const [cert] = await db.select().from(recognitionCertificates)
    .where(eq(recognitionCertificates.id, certDbId)).limit(1);
  if (!cert) throw new Error("Certificate not found");
  if (cert.status === "revoked" || cert.status === "superseded") {
    throw new Error(`Cannot regenerate PDF for a ${cert.status} certificate`);
  }

  const [recipient, approver, badge] = await Promise.all([
    db.select({ id: adminUsers.id, firstName: adminUsers.firstName, lastName: adminUsers.lastName })
      .from(adminUsers).where(eq(adminUsers.id, cert.recipientId)).limit(1),
    db.select({ id: adminUsers.id, firstName: adminUsers.firstName, lastName: adminUsers.lastName, designation: adminUsers.designation })
      .from(adminUsers).where(eq(adminUsers.id, cert.approverId)).limit(1),
    db.select({ id: praiseBadgeTypes.id, name: praiseBadgeTypes.name, emoji: praiseBadgeTypes.emoji })
      .from(praiseBadgeTypes).where(eq(praiseBadgeTypes.id, cert.badgeTypeId)).limit(1),
  ]);
  if (!recipient[0]) throw new Error("Recipient not found");
  if (!approver[0]) throw new Error("Approver not found");
  if (!badge[0]) throw new Error("Badge type not found");

  const issuedAt = cert.issuedAt ?? new Date();
  const verifyUrl = `https://hire-in.com/verify?ref=${encodeURIComponent(cert.referenceNumber)}&auth=${cert.authCode}`;
  const qrDataUrl = await generateQrDataUrl(verifyUrl);
  const activeTemplate = await getActiveCertificateTemplate();
  const recipientName = `${recipient[0].firstName} ${recipient[0].lastName}`;
  const approverName = `${approver[0].firstName} ${approver[0].lastName}`;
  const approverTitle = approver[0].designation || "Authorized Approver";

  const commonData = {
    employeeName: recipientName,
    badgeName: badge[0].name,
    badgeEmoji: badge[0].emoji,
    publicCitation: cert.publicCitation,
    issueDate: formatDate(issuedAt),
    recognitionDate: formatDate(issuedAt),
    certificateId: cert.certificateId,
    approverName,
    approverTitle,
    qrDataUrl,
    verifyUrl,
  };

  let html: string;
  if (activeTemplate === "template1") {
    html = renderTemplate1(commonData);
  } else {
    html = renderTemplate4({ ...commonData, recognitionDescription: cert.recognitionDescription, contributionSummary: cert.contributionSummary });
  }

  const pdfBuffer = await renderCertificatePdf({ html });
  const storagePath = cert.pdfStoragePath ?? `recognition-certificates/${issuedAt.getFullYear()}/${cert.certificateId}.pdf`;

  try {
    await objectStorageService.uploadBuffer(pdfBuffer, storagePath, "application/pdf");
  } catch (err) {
    throw new Error(`PDF regeneration failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  const pdfUrl = `/objects/${storagePath}`;
  await db.update(recognitionCertificates)
    .set({ pdfUrl, pdfStoragePath: storagePath, updatedAt: new Date() })
    .where(eq(recognitionCertificates.id, certDbId));

  await logAudit(certDbId, actorId, "pdf_regenerated", { storagePath, pdfUrl });

  return { pdfUrl };
}

export async function revokeCertificate(
  certDbId: string,
  actorId: string,
  reason?: string,
): Promise<void> {
  await db
    .update(recognitionCertificates)
    .set({ status: "revoked", revokedAt: new Date(), revokedById: actorId, correctionReason: reason ?? null, updatedAt: new Date() })
    .where(eq(recognitionCertificates.id, certDbId));

  await logAudit(certDbId, actorId, "revoked", { reason });

  // Update praise post
  const [cert] = await db.select({ praisePostId: recognitionCertificates.praisePostId })
    .from(recognitionCertificates).where(eq(recognitionCertificates.id, certDbId)).limit(1);
  if (cert?.praisePostId) {
    await db.execute(sql`UPDATE praise_posts SET certificate_status = 'revoked' WHERE id = ${cert.praisePostId}`);
  }
}

export async function correctCertificate(
  certDbId: string,
  actorId: string,
  reason: string,
): Promise<IssuedCertificate> {
  // Load old certificate to capture current version
  const [old] = await db.select().from(recognitionCertificates)
    .where(eq(recognitionCertificates.id, certDbId)).limit(1);
  if (!old) throw new Error("Certificate not found");

  const nextVersion = (old.version ?? 1) + 1;

  // Mark old as superseded
  await db.update(recognitionCertificates)
    .set({ status: "superseded", updatedAt: new Date() })
    .where(eq(recognitionCertificates.id, certDbId));

  await logAudit(certDbId, actorId, "superseded", { reason, correctedBy: actorId });

  // Issue a new version on the same praise post
  if (!old.praisePostId) throw new Error("No praise post linked to this certificate");

  // Reset status for re-issue (issueRecognitionCertificate expects "approved")
  await db.execute(sql`UPDATE praise_posts SET certificate_status = 'approved' WHERE id = ${old.praisePostId}`);

  const issued = await issueRecognitionCertificate(old.praisePostId, actorId);

  // Link old superseded cert to new, set correct version
  const [newCert] = await db.select({ id: recognitionCertificates.id })
    .from(recognitionCertificates)
    .where(eq(recognitionCertificates.certificateId, issued.certificateId))
    .limit(1);

  if (newCert) {
    // Link OLD cert → NEW cert (old superseded cert points to its replacement)
    await db.execute(sql`
      UPDATE recognition_certificates
      SET superseded_by_id = ${newCert.id}, correction_reason = ${reason}
      WHERE id = ${certDbId}
    `);
    // Set correct version number and 'corrected' status on the NEW cert
    await db.execute(sql`
      UPDATE recognition_certificates SET version = ${nextVersion}, status = 'corrected' WHERE id = ${newCert.id}
    `);
    await logAudit(certDbId, actorId, "corrected", { newCertId: newCert.id, reason, version: nextVersion });
  }

  return { ...issued };
}
