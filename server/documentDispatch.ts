/**
 * Central Document Dispatch Service
 *
 * Provides a reusable delivery engine that all document types plug into via adapters.
 * Supports three delivery methods: esign_link | presigned_pdf | both
 *
 * Role gate:
 *   - super_admin / architect: no approval step — direct dispatch with delivery method choice
 *   - All other roles: submit → status pending_dispatch_approval → super_admin approves / rejects
 *
 * CC management:
 *   - ccRecipients stored as JSONB per contract: [{email, name, source}]
 *   - Outside-domain CC (not hirein.com / hirein.solutions / rayomind.com) triggers
 *     in-app notifications to all super_admin users
 */

import crypto from "crypto";
import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import { db } from "./db";
import { contracts, adminUsers, notifications } from "@shared/schema";
import { eq, or } from "drizzle-orm";
// documentSigningService functions are imported dynamically at call sites below
import { ObjectStorageService } from "./replit_integrations/object_storage/objectStorage";

const objectStorageService = new ObjectStorageService();

export type DeliveryMethod = "esign_link" | "presigned_pdf" | "both";

export interface CcRecipient {
  email: string;
  name: string;
  source: "employee" | "manual";
}

export interface DispatchAdapter {
  getDocxBuffer(documentId: string): Promise<Buffer | null>;
  getRecipientInfo(documentId: string): Promise<{ email: string; name: string } | null>;
  getSigningFields(documentId: string): Promise<Record<string, any>>;
  onDispatched(documentId: string, dispatchRecord: {
    deliveryMethod: DeliveryMethod;
    authCode?: string;
    refNumber?: string;
    documentHash?: string;
    signingToken?: string;
    pdfPath?: string;
    sentAt: Date;
    sentBy: string;
  }): Promise<void>;
}

const adapters = new Map<string, DispatchAdapter>();

export function registerAdapter(documentType: string, adapter: DispatchAdapter): void {
  adapters.set(documentType, adapter);
}

export function getAdapter(documentType: string): DispatchAdapter | undefined {
  return adapters.get(documentType);
}

// ─── Internal domain whitelist ────────────────────────────────────────────────
const INTERNAL_DOMAINS = ["hirein.com", "hirein.solutions", "rayomind.com"];

function isExternalDomain(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  return !domain || !INTERNAL_DOMAINS.includes(domain);
}

// ─── Notify external CC ───────────────────────────────────────────────────────
async function notifyExternalCc(documentType: string, documentId: string, externalEmails: string[], sentBy: string): Promise<void> {
  try {
    const alertRecipients = await db.select({ id: adminUsers.id })
      .from(adminUsers)
      .where(or(
        eq(adminUsers.role as any, "super_admin" as any),
        eq(adminUsers.role as any, "architect" as any),
        eq(adminUsers.role as any, "expert" as any)
      ));

    for (const u of alertRecipients) {
      await db.insert(notifications).values({
        userId: u.id,
        type: "external_cc_alert",
        title: "External CC on Dispatched Document",
        message: `Document ${documentType} #${documentId.substring(0, 8)} was dispatched with external CC recipient(s): ${externalEmails.join(", ")}`,
        isRead: false,
        metadata: { documentType, documentId, externalEmails, sentBy },
      });
    }
  } catch (err) {
    console.error("[documentDispatch] Failed to send external CC notifications:", err);
  }
}

// ─── Generate signing token ────────────────────────────────────────────────────
function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// ─── Generate contract PDF ────────────────────────────────────────────────────
// Renders the full contract content (extracted from the DOCX via JSZip) into a
// signed PDF with a cryptographic verification stamp.  Falls back to a structured
// summary PDF when no DOCX buffer is supplied (e.g. esign_link-only flows).
// LibreOffice is NOT available in this environment.
export async function generateContractVerificationPdf(params: {
  contractId: string;
  clientName: string;
  candidates: any[];
  agreementDate?: string | null;
  billingFrequency?: string | null;
  paymentTermsDays?: number | null;
  contractStartDate?: string | null;
  contractEndDate?: string | null;
  refNumber: string;
  authCode: string;
  approvedByName: string;
  docxBuffer?: Buffer; // when provided, contract body text is extracted and embedded
}): Promise<Buffer> {
  // ── 1. Extract contract body text from DOCX asynchronously (before PDFKit callback) ──
  let contractLines: string[] = [];
  if (params.docxBuffer) {
    try {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(params.docxBuffer);
      const xmlFile = zip.file("word/document.xml");
      if (xmlFile) {
        const xml = await xmlFile.async("text");
        // Split on paragraph boundaries and collect <w:t> runs within each paragraph
        const parasRaw = xml.split(/<w:p[ \/>]/);
        for (const para of parasRaw) {
          const runs = [...para.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map(m => m[1]).join("");
          if (runs.trim()) contractLines.push(runs.trim());
        }
      }
    } catch (docxErr) {
      console.warn("[generateContractVerificationPdf] DOCX text extraction failed:", docxErr);
    }
  }

  // ── 2. Render PDF ──────────────────────────────────────────────────────────
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margins: { top: 50, bottom: 50, left: 60, right: 60 } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const navyColor = "#1F3A6E";
    const orangeColor = "#F47C20";

    const logoPath = path.resolve("client/public/hirein-logo.png");
    const altLogoPath = path.resolve("client/public/rayomind-logo.png");
    let y = 50;
    try {
      const useLogo = fs.existsSync(logoPath) ? logoPath : fs.existsSync(altLogoPath) ? altLogoPath : null;
      if (useLogo) {
        doc.image(useLogo, doc.page.margins.left + pageWidth / 2 - 60, y, { width: 120 });
        y += 80;
      }
    } catch {}

    doc.fontSize(14).font("Helvetica-Bold").fillColor(navyColor);
    doc.text("STAFFING SERVICES AGREEMENT", doc.page.margins.left, y, { align: "center", width: pageWidth });
    y += 20;
    doc.fontSize(9).font("Helvetica").fillColor("#666666");
    doc.text("(Pre-Executed Copy — Digitally Authorized)", doc.page.margins.left, y, { align: "center", width: pageWidth });
    y += 10;
    doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.margins.left + pageWidth, y).lineWidth(2).strokeColor(orangeColor).stroke();
    y += 18;

    const addRow = (label: string, value: string) => {
      doc.font("Helvetica").fontSize(10).fillColor("#374151");
      doc.text(label + ":", doc.page.margins.left, y, { continued: false });
      doc.font("Helvetica-Bold").text(value, doc.page.margins.left + 150, y - doc.currentLineHeight());
      y += 18;
    };

    addRow("Client", params.clientName);
    if (params.agreementDate) addRow("Agreement Date", params.agreementDate);
    if (params.contractStartDate) addRow("Effective Date", params.contractStartDate);
    if (params.contractEndDate) addRow("End Date", params.contractEndDate);
    if (params.billingFrequency) addRow("Billing Frequency", params.billingFrequency.replace(/_/g, " "));
    if (params.paymentTermsDays) addRow("Payment Terms", `Net ${params.paymentTermsDays} days`);

    y += 10;
    doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.margins.left + pageWidth, y).lineWidth(0.5).strokeColor("#e5e7eb").stroke();
    y += 12;

    if (params.candidates && params.candidates.length > 0) {
      doc.font("Helvetica-Bold").fontSize(10).fillColor(navyColor);
      doc.text("Candidate Schedule", doc.page.margins.left, y);
      y += 14;

      const cols = [100, 80, 80, 80, 80];
      const headers = ["Name", "Role", "Start Date", "Location", "Type"];
      let x = doc.page.margins.left;
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#374151");
      headers.forEach((h, i) => { doc.text(h, x, y, { width: cols[i] }); x += cols[i]; });
      y += 14;
      doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.margins.left + pageWidth, y).lineWidth(0.3).strokeColor("#d1d5db").stroke();
      y += 4;

      for (const c of params.candidates) {
        x = doc.page.margins.left;
        doc.font("Helvetica").fontSize(8).fillColor("#374151");
        const vals = [c.name || "", c.role || "", c.startDate || "", c.location || "", c.engagementType || ""];
        vals.forEach((v, i) => { doc.text(v, x, y, { width: cols[i], ellipsis: true }); x += cols[i]; });
        y += 14;
      }
    }

    // ── Contract body text (extracted from DOCX) ──────────────────────────────
    if (contractLines.length > 0) {
      doc.addPage();
      doc.font("Helvetica-Bold").fontSize(11).fillColor(navyColor);
      doc.text("CONTRACT AGREEMENT", { align: "center" });
      doc.moveDown(0.6);
      doc.font("Helvetica").fontSize(9).fillColor("#374151");
      for (const line of contractLines) {
        doc.text(line, { paragraphGap: 4 });
      }
      doc.moveDown(2);

      // Inline verification stamp at end of contract body
      doc.moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.margins.left + pageWidth, doc.y)
        .lineWidth(2).strokeColor(orangeColor).stroke();
      doc.moveDown(0.5);
      doc.font("Helvetica-Bold").fontSize(8).fillColor(navyColor);
      doc.text("CRYPTOGRAPHICALLY SIGNED & VERIFIED DOCUMENT", { align: "center", width: pageWidth });
      doc.moveDown(0.3);
      doc.font("Courier").fontSize(7).fillColor("#374151");
      doc.text(`Ref: ${params.refNumber}   Auth: ${params.authCode}`, { align: "center", width: pageWidth });
      doc.moveDown(0.2);
      doc.font("Helvetica-Oblique").fontSize(7).fillColor("#9ca3af");
      doc.text(`Verify at hire-in.com/verify — Authorized by: ${params.approvedByName}`, { align: "center", width: pageWidth });
    } else {
      // Summary-only: absolute-positioned footer on the single page
      y = doc.page.height - doc.page.margins.bottom - 70;
      doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.margins.left + pageWidth, y).lineWidth(2).strokeColor(orangeColor).stroke();
      y += 8;
      doc.font("Helvetica-Bold").fontSize(8).fillColor(navyColor);
      doc.text("CRYPTOGRAPHICALLY SIGNED & VERIFIED DOCUMENT", doc.page.margins.left, y, { align: "center", width: pageWidth });
      y += 12;
      doc.font("Courier").fontSize(7).fillColor("#374151");
      doc.text(`Ref: ${params.refNumber}`, doc.page.margins.left, y);
      doc.text(`Auth: ${params.authCode}`, doc.page.margins.left + pageWidth / 2, y, { align: "right", width: pageWidth / 2 });
      y += 10;
      doc.font("Helvetica-Oblique").fontSize(7).fillColor("#9ca3af");
      doc.text(`Verify at hire-in.com/verify — Authorized by: ${params.approvedByName}`, doc.page.margins.left, y, { align: "center", width: pageWidth });
    }

    doc.end();
  });
}

// ─── Request Dispatch (non-super-admin path) ──────────────────────────────────
export interface RequestDispatchParams {
  documentType: string;
  documentId: string;
  requestedBy: string;
  ccRecipients?: CcRecipient[];
  note?: string;
  recipientEmail?: string;
}

export async function requestDispatch(params: RequestDispatchParams): Promise<{ success: boolean; error?: string }> {
  try {
    if (params.documentType === "contract") {
      const requestUpdate: Record<string, any> = {
        status: "pending_dispatch_approval",
        ccRecipients: params.ccRecipients || [],
        updatedAt: new Date(),
      };
      if (params.recipientEmail) requestUpdate.dispatchRecipientEmail = params.recipientEmail;
      await db.update(contracts)
        .set(requestUpdate as any)
        .where(eq(contracts.id, params.documentId));

      // Notify super_admin users
      const superAdmins = await db.select({ id: adminUsers.id, firstName: adminUsers.firstName })
        .from(adminUsers)
        .where(eq(adminUsers.role as any, "super_admin" as any));

      for (const sa of superAdmins) {
        await db.insert(notifications).values({
          userId: sa.id,
          type: "dispatch_approval_request",
          title: "Contract Dispatch Approval Needed",
          message: `A contract dispatch request for ${params.documentType} #${params.documentId.substring(0, 8)} is pending your approval.`,
          isRead: false,
          metadata: { documentType: params.documentType, documentId: params.documentId, requestedBy: params.requestedBy, note: params.note },
        });
      }

      return { success: true };
    }

    return { success: false, error: "unsupported_document_type" };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ─── Direct Dispatch (super-admin path) ───────────────────────────────────────
export interface DirectDispatchParams {
  documentType: string;
  documentId: string;
  deliveryMethod: DeliveryMethod;
  approvedBy: string;
  approvedByName: string;
  approvedByEmail: string;
  recipientEmail?: string;
  ccRecipients?: CcRecipient[];
  appBase: string;
}

export async function directDispatch(params: DirectDispatchParams): Promise<{ success: boolean; signingUrl?: string; error?: string }> {
  try {
    const adapter = adapters.get(params.documentType);
    if (!adapter) return { success: false, error: `No adapter registered for document type: ${params.documentType}` };

    const recipientInfo = await adapter.getRecipientInfo(params.documentId);
    const toEmail = params.recipientEmail || recipientInfo?.email;
    if (!toEmail) {
      return { success: false, error: "A recipient email is required for dispatch" };
    }

    const signingFields = await adapter.getSigningFields(params.documentId);

    // Capture one canonical timestamp — used for BOTH signContract and onDispatched.sentAt
    // so the stored documentHash and the re-computed hash in verifyDocument always agree.
    const dispatchTimestamp = new Date();

    // Sign the document at dispatch time for ALL delivery methods.
    // Artifacts (refNumber/authCode/documentHash) are persisted immediately; the
    // token-sign endpoint reuses them and does not re-sign, so verification details
    // sent in the dispatch email remain valid after the client executes the link.
    let signResult: { refNumber: string; authCode: string; documentHash: string } | null = null;
    if (params.documentType === "contract") {
      const { sign } = await import("./documentSigningService");
      signResult = sign("contract", {
        id: params.documentId,
        clientName: signingFields.clientName,
        templateName: signingFields.templateName,
        agreementDate: signingFields.agreementDate,
        billingFrequency: signingFields.billingFrequency,
        paymentTermsDays: signingFields.paymentTermsDays,
        candidates: signingFields.candidates,
        signedAt: dispatchTimestamp,
      });
    }

    let signingToken: string | undefined;
    let signingUrl: string | undefined;
    let pdfPath: string | undefined;

    if (params.deliveryMethod === "esign_link" || params.deliveryMethod === "both") {
      signingToken = generateToken();
      signingUrl = `${params.appBase}/contracts/sign/${signingToken}`;
    }

    // Fetch the contract DOCX buffer early — used both for PDF rendering (presigned_pdf)
    // and as a direct attachment (so recipients always receive the full contract text).
    // LibreOffice is not available, so we embed extracted text into the PDF via JSZip
    // and also attach the original DOCX separately.
    let contractDocxBuffer: Buffer | undefined;
    try {
      const docxBuf = await adapter.getDocxBuffer(params.documentId);
      if (docxBuf) contractDocxBuffer = docxBuf;
    } catch (docxErr) {
      console.warn("[documentDispatch] Could not fetch DOCX buffer:", docxErr);
    }

    if (params.deliveryMethod === "presigned_pdf" || params.deliveryMethod === "both") {
      if (!signResult) return { success: false, error: "Signing failed — no sign result" };

      const pdfBuffer = await generateContractVerificationPdf({
        contractId: params.documentId,
        clientName: signingFields.clientName,
        candidates: signingFields.candidates || [],
        agreementDate: signingFields.agreementDate,
        billingFrequency: signingFields.billingFrequency,
        paymentTermsDays: signingFields.paymentTermsDays,
        contractStartDate: signingFields.contractStartDate,
        contractEndDate: signingFields.contractEndDate,
        refNumber: signResult.refNumber,
        authCode: signResult.authCode,
        approvedByName: params.approvedByName,
        docxBuffer: contractDocxBuffer, // embed full contract text extracted from DOCX
      });

      pdfPath = await objectStorageService.uploadBuffer(
        pdfBuffer,
        `.private/contracts/signed/${Date.now()}_${params.documentId.substring(0, 8)}.pdf`,
        "application/pdf"
      );
    }

    // Send email — errors are intentionally fatal so the dispatch is aborted and the
    // contract record is NOT mutated to "sent" / "countersigned" when delivery fails.
    if (toEmail) {
      const { sendContractDispatchEmail } = await import("./email");

      const emailResult = await sendContractDispatchEmail({
        to: toEmail,
        clientName: signingFields.clientName,
        deliveryMethod: params.deliveryMethod,
        signingUrl: signingUrl,
        refNumber: signResult?.refNumber,
        authCode: signResult?.authCode,
        approvedByName: params.approvedByName,
        approvedByEmail: params.approvedByEmail,
        ccRecipients: (params.ccRecipients || []).map(c => c.email),
        contractDocxBuffer,
        pdfBuffer: params.deliveryMethod !== "esign_link" ? await (async () => {
          if (pdfPath) return objectStorageService.downloadBuffer(pdfPath);
          return undefined;
        })() : undefined,
      });
      // Email failure is fatal — abort before mutating contract state
      if (!emailResult.success) {
        throw new Error(`Email delivery failed: ${emailResult.error || "unknown error"}`);
      }
    }

    // Notify adapter — only called after a successful email send so contract status
    // is never mutated to "sent"/"countersigned" if delivery failed.
    await adapter.onDispatched(params.documentId, {
      deliveryMethod: params.deliveryMethod,
      authCode: signResult?.authCode,
      refNumber: signResult?.refNumber,
      documentHash: signResult?.documentHash,
      signingToken,
      pdfPath,
      sentAt: dispatchTimestamp,
      sentBy: params.approvedBy,
    });

    // Handle CC recipients + external domain check
    const ccList = params.ccRecipients || [];
    const externalCcs = ccList.filter(c => isExternalDomain(c.email)).map(c => c.email);
    if (externalCcs.length > 0) {
      await notifyExternalCc(params.documentType, params.documentId, externalCcs, params.approvedBy);
    }

    return { success: true, signingUrl };
  } catch (err: any) {
    console.error("[documentDispatch] directDispatch error:", err);
    return { success: false, error: err.message };
  }
}

// ─── Reject Dispatch Request ──────────────────────────────────────────────────
export async function rejectDispatch(params: {
  documentType: string;
  documentId: string;
  rejectedBy: string;
  reason: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    if (params.documentType === "contract") {
      const [c] = await db.select().from(contracts).where(eq(contracts.id, params.documentId));
      if (!c) return { success: false, error: "Contract not found" };
      if (c.status !== "pending_dispatch_approval") {
        return { success: false, error: `Cannot reject: contract status is '${c.status}'. Only contracts awaiting dispatch approval can be rejected.` };
      }

      await db.update(contracts)
        .set({ status: "draft", rejectionReason: params.reason, updatedAt: new Date() } as any)
        .where(eq(contracts.id, params.documentId));

      // Notify the originator
      if (c.createdBy) {
        await db.insert(notifications).values({
          userId: c.createdBy,
          type: "dispatch_rejected",
          title: "Dispatch Request Rejected",
          message: `Your dispatch request for contract #${params.documentId.substring(0, 8)} was rejected: ${params.reason}`,
          isRead: false,
          metadata: { documentType: params.documentType, documentId: params.documentId, reason: params.reason },
        });
      }

      return { success: true };
    }

    return { success: false, error: "unsupported_document_type" };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ─── Adapter registrations ────────────────────────────────────────────────────

// Contract adapter
registerAdapter("contract", {
  async getDocxBuffer(contractId: string): Promise<Buffer | null> {
    const { db: dbInst } = await import("./db");
    const { contracts: c } = await import("@shared/schema");
    const { eq: eqFn } = await import("drizzle-orm");
    const [contract] = await dbInst.select().from(c).where(eqFn(c.id, contractId));
    if (!contract?.docxPath) return null;
    return objectStorageService.downloadBuffer(contract.docxPath);
  },
  async getRecipientInfo(contractId: string): Promise<{ email: string; name: string } | null> {
    const { db: dbInst } = await import("./db");
    const { contracts: c, contractClients: cc } = await import("@shared/schema");
    const { eq: eqFn } = await import("drizzle-orm");
    const [contract] = await dbInst.select().from(c).where(eqFn(c.id, contractId));
    if (!contract) return null;
    if (contract.clientId) {
      const [client] = await dbInst.select().from(cc).where(eqFn(cc.id, contract.clientId));
      if (client?.email) return { email: client.email, name: client.name };
    }
    return { email: "", name: contract.clientName };
  },
  async getSigningFields(contractId: string): Promise<Record<string, any>> {
    const { db: dbInst } = await import("./db");
    const { contracts: c } = await import("@shared/schema");
    const { eq: eqFn } = await import("drizzle-orm");
    const [contract] = await dbInst.select().from(c).where(eqFn(c.id, contractId));
    if (!contract) return {};
    return {
      clientName: contract.clientName, templateName: contract.templateName,
      agreementDate: contract.agreementDate, billingFrequency: contract.billingFrequency,
      paymentTermsDays: contract.paymentTermsDays, candidates: contract.candidates,
      contractStartDate: contract.contractStartDate, contractEndDate: contract.contractEndDate,
    };
  },
  async onDispatched(contractId: string, dispatchRecord): Promise<void> {
    const { db: dbInst } = await import("./db");
    const { contracts: c } = await import("@shared/schema");
    const { eq: eqFn } = await import("drizzle-orm");
    const updates: Record<string, any> = {
      status: dispatchRecord.deliveryMethod === "presigned_pdf" ? "countersigned" : "sent",
      sentAt: dispatchRecord.sentAt,
      updatedAt: new Date(),
    };
    if (dispatchRecord.signingToken) updates.signingToken = dispatchRecord.signingToken;
    if (dispatchRecord.authCode) updates.authCode = dispatchRecord.authCode;
    if (dispatchRecord.refNumber) updates.referenceNumber = dispatchRecord.refNumber;
    if (dispatchRecord.documentHash) updates.documentHash = dispatchRecord.documentHash;
    // Persist signedAt so verifyDocument can deterministically recompute the hash
    updates.signedAt = dispatchRecord.sentAt;
    await dbInst.update(c).set(updates).where(eqFn(c.id, contractId));
  },
});

// Offer letter adapter — TODO: implement in next task
registerAdapter("offer_letter", {
  getDocxBuffer: async () => { throw new Error("[offer_letter adapter] not yet implemented"); },
  getRecipientInfo: async () => { throw new Error("[offer_letter adapter] not yet implemented"); },
  getSigningFields: async () => { throw new Error("[offer_letter adapter] not yet implemented"); },
  onDispatched: async () => { throw new Error("[offer_letter adapter] not yet implemented"); },
});

// Amendment letter adapter — TODO: implement in next task
registerAdapter("amendment_letter", {
  getDocxBuffer: async () => { throw new Error("[amendment_letter adapter] not yet implemented"); },
  getRecipientInfo: async () => { throw new Error("[amendment_letter adapter] not yet implemented"); },
  getSigningFields: async () => { throw new Error("[amendment_letter adapter] not yet implemented"); },
  onDispatched: async () => { throw new Error("[amendment_letter adapter] not yet implemented"); },
});
