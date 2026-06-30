/**
 * Central Document Signing Service
 *
 * Consolidates all cryptographic signing logic for:
 *   - offer_letter / addendum  → content-bound HMAC using OFFER_SIGNING_KEY (no algorithm change)
 *   - hr_letter                → HMAC-SHA256 of pipe-delimited fields using LETTER_HMAC_SECRET (no algorithm change)
 *   - contract                 → upgraded to content-bound HMAC using OFFER_SIGNING_KEY
 *
 * All future document types should register here.
 */

import crypto from "crypto";
import { db } from "./db";
import {
  hrLetters, offerLetters, offerLetterAddendums, contracts,
  policyDocuments, policySigningRequests, policySignatures,
  signatureRecords, type InsertSignatureRecord,
} from "@shared/schema";
import { eq } from "drizzle-orm";

export type DocumentType =
  | "offer_letter" | "offer_letter_counter"
  | "addendum" | "addendum_counter"
  | "hr_letter" | "contract" | "policy" | "sop";

export interface SignResult {
  refNumber: string;
  authCode: string;
  documentHash: string;
}

export interface VerifyResult {
  valid: boolean;
  tamperDetected: boolean;
  record?: Record<string, any>;
  error?: string;
}

function getSigningKey(): string {
  const key = process.env.OFFER_SIGNING_KEY;
  if (!key) throw new Error("OFFER_SIGNING_KEY environment variable is required for document signing");
  return key;
}

function getLetterHmacSecret(): string {
  return process.env.LETTER_HMAC_SECRET || process.env.OFFER_SIGNING_KEY || "";
}

// ─── Offer letter / addendum signing ────────────────────────────────────────
// Algorithm: SHA-256 hash of DOCX content → HMAC-SHA256 → formatted auth code
// Same as existing implementation in routes.ts (lines ~5662–5687)
export function signOfferLetterContent(docxBuffer: Buffer, docId: string, acceptedName: string, timestamp: Date): SignResult {
  const signingKey = getSigningKey();
  const documentHash = crypto.createHash("sha256").update(docxBuffer).digest("hex");
  const hmacPayload = `${docId}|${acceptedName.trim()}|${timestamp.toISOString()}|${documentHash}`;
  const fullAuthCode = crypto.createHmac("sha256", signingKey).update(hmacPayload).digest("hex");
  const authCode = fullAuthCode.substring(0, 24).toUpperCase().match(/.{1,4}/g)?.join("-") || fullAuthCode.substring(0, 24).toUpperCase();
  return { refNumber: docId, authCode, documentHash };
}

// ─── HR letter signing ───────────────────────────────────────────────────────
// Algorithm: HMAC-SHA256 of pipe-delimited canonical fields
// Same as computeLetterAuthCode in routes.ts (lines ~7292–7317)
export function signHrLetter(fields: {
  id: string; templateType: string; employeeName: string; designation: string;
  startDate?: string | null; endDate?: string | null; performanceBand?: string | null;
  conductBand?: string | null; completionBand?: string | null; department?: string | null;
  location?: string | null; employeeCode?: string | null; signatoryName?: string | null;
  signatoryDesignation?: string | null; closingLine?: string | null;
  responsibilitiesSummary?: string | null; projectName?: string | null;
  customOverrideText?: string | null; issueDate?: string | null;
}): { authCode: string; documentHash: string } {
  const secret = getLetterHmacSecret();
  if (!secret) throw new Error("LETTER_HMAC_SECRET or OFFER_SIGNING_KEY environment variable is required to sign HR letters");
  // IMPORTANT: field ordering must exactly match computeLetterAuthCode in routes.ts
  // to remain compatible with letters already issued and stored in the database.
  const payload = [
    fields.id, fields.templateType, fields.employeeName,
    fields.designation, fields.department || "", fields.location || "",
    fields.employeeCode || "", fields.startDate || "", fields.endDate || "",
    fields.performanceBand || "", fields.conductBand || "", fields.completionBand || "",
    fields.closingLine || "", fields.signatoryName || "", fields.signatoryDesignation || "",
    fields.responsibilitiesSummary || "", fields.projectName || "",
    fields.customOverrideText || "", fields.issueDate || "",
  ].join("|");
  const documentHash = crypto.createHash("sha256").update(payload).digest("hex");
  const hmac = crypto.createHmac("sha256", secret).update(documentHash).digest("hex");
  const authCode = hmac.substring(0, 4).toUpperCase() + "-" + hmac.substring(4, 8).toUpperCase();
  return { authCode, documentHash };
}

// ─── Offer letter acceptance signing (JSON-field based) ─────────────────────
// Algorithm: SHA-256 hash of JSON-serialised letter fields → HMAC payload using
// OFFER_SIGNING_KEY. Field set and payload format must stay identical to the
// inline logic in routes.ts POST /api/onboard/:token/accept to preserve backward
// compatibility with offer letters already signed and stored in the database.
export interface AnnexureInitialRecord {
  key: string;
  initials: string;
  initialedAt: string;
}

export function signOfferLetterAcceptance(
  letterFields: { id: string; candidateName: string; designation?: string | null; salary?: string | null; proposedStartDate?: string | null; offerDate?: string | null; location?: string | null },
  acceptedName: string,
  timestamp: Date,
  annexureInitials?: AnnexureInitialRecord[] | null,
): { authCode: string; documentHash: string } {
  const signingKey = getSigningKey();
  // Sort annexure initials by key for deterministic hashing
  const normalizedInitials = Array.isArray(annexureInitials) && annexureInitials.length > 0
    ? [...annexureInitials]
        .map((a) => ({ key: a.key, initials: (a.initials || "").trim(), initialedAt: a.initialedAt }))
        .sort((a, b) => a.key.localeCompare(b.key))
    : null;
  const docContents = JSON.stringify({
    id: letterFields.id,
    candidateName: letterFields.candidateName,
    designation: letterFields.designation,
    salary: letterFields.salary,
    proposedStartDate: letterFields.proposedStartDate,
    offerDate: letterFields.offerDate,
    location: letterFields.location,
    annexureInitials: normalizedInitials,
  });
  const documentHash = crypto.createHash("sha256").update(docContents).digest("hex");
  const hmacPayload = `${letterFields.id}|${acceptedName.trim()}|${timestamp.toISOString()}|${documentHash}`;
  const fullAuthCode = crypto.createHmac("sha256", signingKey).update(hmacPayload).digest("hex");
  const authCode = fullAuthCode.substring(0, 24).toUpperCase().match(/.{1,4}/g)?.join("-") || fullAuthCode.substring(0, 24).toUpperCase();
  return { authCode, documentHash };
}

// ─── Contract signing ────────────────────────────────────────────────────────
// Upgraded to content-bound HMAC (previously weak random-hex + metadata-only HMAC)
export function signContract(fields: {
  id: string; clientName: string; templateName?: string | null;
  agreementDate?: string | null; billingFrequency?: string | null;
  paymentTermsDays?: number | null; candidates?: any;
  signedAt: Date;
}): SignResult {
  const signingKey = getSigningKey();
  // Canonical payload — all key fields serialised
  const canonicalPayload = [
    fields.id,
    fields.clientName,
    fields.templateName || "",
    fields.agreementDate || "",
    fields.billingFrequency || "",
    String(fields.paymentTermsDays || ""),
    JSON.stringify(fields.candidates || []),
    fields.signedAt.toISOString(),
  ].join("|");
  const documentHash = crypto.createHash("sha256").update(canonicalPayload).digest("hex");
  const fullAuthCode = crypto.createHmac("sha256", signingKey).update(documentHash).digest("hex");
  const authCode = fullAuthCode.substring(0, 4).toUpperCase() + "-" + fullAuthCode.substring(4, 8).toUpperCase();
  return { refNumber: `CTR/${fields.signedAt.getFullYear()}/${fields.id.substring(0, 8).toUpperCase()}`, authCode, documentHash };
}

// ─── Offer letter countersign signing ────────────────────────────────────────
// Matches inline crypto block in routes.ts offer-letter countersign endpoint
export function signOfferCountersign(
  letter: { id: string; candidateName: string; acceptedName?: string | null; acceptanceDate?: string | Date | null; authCode?: string | null; documentHash?: string | null },
  counterSignedName: string,
  timestamp: Date,
): { counterAuthCode: string; counterDocumentHash: string } {
  const signingKey = getSigningKey();
  const counterDocContents = JSON.stringify({
    id: letter.id,
    candidateName: letter.candidateName,
    acceptedName: letter.acceptedName,
    acceptanceDate: letter.acceptanceDate,
    authCode: letter.authCode,
    documentHash: letter.documentHash,
  });
  const counterDocumentHash = crypto.createHash("sha256").update(counterDocContents).digest("hex");
  const hmacPayload = `${letter.id}|counter|${counterSignedName.trim()}|${timestamp.toISOString()}|${counterDocumentHash}`;
  const fullAuthCode = crypto.createHmac("sha256", signingKey).update(hmacPayload).digest("hex");
  const counterAuthCode = fullAuthCode.substring(0, 24).toUpperCase().match(/.{1,4}/g)?.join("-") || fullAuthCode.substring(0, 24).toUpperCase();
  return { counterAuthCode, counterDocumentHash };
}

// ─── Addendum acceptance signing ─────────────────────────────────────────────
// Matches inline crypto block in routes.ts addendum acceptance endpoint
export function signAddendumAcceptance(
  addendum: { id: string; offerLetterId: string | null; candidateName: string; addendumType: string; effectiveDate?: string | null },
  acceptedName: string,
  timestamp: Date,
): { authCode: string; documentHash: string } {
  const signingKey = getSigningKey();
  const docContents = JSON.stringify({
    id: addendum.id,
    offerLetterId: addendum.offerLetterId,
    candidateName: addendum.candidateName,
    addendumType: addendum.addendumType,
    effectiveDate: addendum.effectiveDate,
  });
  const documentHash = crypto.createHash("sha256").update(docContents).digest("hex");
  const hmacPayload = `${addendum.id}|${acceptedName.trim()}|${timestamp.toISOString()}|${documentHash}`;
  const fullAuthCode = crypto.createHmac("sha256", signingKey).update(hmacPayload).digest("hex");
  const authCode = fullAuthCode.substring(0, 24).toUpperCase().match(/.{1,4}/g)?.join("-") || fullAuthCode.substring(0, 24).toUpperCase();
  return { authCode, documentHash };
}

// ─── Addendum countersign signing ─────────────────────────────────────────────
// Matches inline crypto block in routes.ts addendum countersign endpoint
export function signAddendumCountersign(
  addendum: { id: string; candidateName: string; acceptedName?: string | null; authCode?: string | null; documentHash?: string | null },
  counterSignedBy: string,
  timestamp: Date,
): { counterAuthCode: string; counterDocumentHash: string } {
  const signingKey = getSigningKey();
  const counterDocContents = JSON.stringify({
    id: addendum.id,
    candidateName: addendum.candidateName,
    acceptedName: addendum.acceptedName,
    authCode: addendum.authCode,
    documentHash: addendum.documentHash,
  });
  const counterDocumentHash = crypto.createHash("sha256").update(counterDocContents).digest("hex");
  const hmacPayload = `${addendum.id}|counter|${counterSignedBy}|${timestamp.toISOString()}|${counterDocumentHash}`;
  const fullAuthCode = crypto.createHmac("sha256", signingKey).update(hmacPayload).digest("hex");
  const counterAuthCode = fullAuthCode.substring(0, 24).toUpperCase().match(/.{1,4}/g)?.join("-") || fullAuthCode.substring(0, 24).toUpperCase();
  return { counterAuthCode, counterDocumentHash };
}

// ─── Policy acknowledgement signing ──────────────────────────────────────────
// Folds the previously crypto-less policy-signing path onto the central service.
// Binds the policy identity + version + page initials + final signature into a
// content hash, then derives a formatted auth code via HMAC. Used additively — the
// existing policy_signatures row + generated PDF certificate remain unchanged.
export function signPolicyAcknowledgement(fields: {
  policyId: string; policyTitle: string; policyVersion: number;
  employeeName: string;
  pageInitials: Array<{ page: number; initial: string }>;
  finalSignature: string;
  signedAt: Date;
}): SignResult {
  const signingKey = getSigningKey();
  const normalizedInitials = [...(fields.pageInitials || [])]
    .map((p) => ({ page: p.page, initial: (p.initial || "").trim() }))
    .sort((a, b) => a.page - b.page);
  const docContents = JSON.stringify({
    policyId: fields.policyId,
    policyTitle: fields.policyTitle,
    policyVersion: fields.policyVersion,
    finalSignature: (fields.finalSignature || "").trim(),
    pageInitials: normalizedInitials,
  });
  const documentHash = crypto.createHash("sha256").update(docContents).digest("hex");
  const hmacPayload = `${fields.policyId}|${fields.employeeName.trim()}|${fields.signedAt.toISOString()}|${documentHash}`;
  const fullAuthCode = crypto.createHmac("sha256", signingKey).update(hmacPayload).digest("hex");
  const authCode = fullAuthCode.substring(0, 4).toUpperCase() + "-" + fullAuthCode.substring(4, 8).toUpperCase();
  const refNumber = `POL/${fields.signedAt.getFullYear()}/${fields.policyId.substring(0, 8).toUpperCase()}`;
  return { refNumber, authCode, documentHash };
}

// ─── Unified signature ledger writer ──────────────────────────────────────────
// Append-only, NON-FATAL: a ledger failure must never break a signing flow, so all
// errors are swallowed and logged. Every sign call-site should call this after it has
// persisted the per-entity columns, passing the same authCode/documentHash it stored.
export async function recordSignature(entry: {
  documentType: DocumentType | string;
  documentId: string;
  referenceNumber?: string | null;
  signerName: string;
  signerRole?: string | null;
  signerUserId?: string | null;
  signedAt?: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
  contentHash?: string | null;
  authCode?: string | null;
  sectionInitials?: any;
  certificatePath?: string | null;
  metadata?: any;
  consentAcceptedAt?: Date | null;
}): Promise<{ id: string } | null> {
  try {
    const values: InsertSignatureRecord = {
      documentType: entry.documentType,
      documentId: entry.documentId,
      referenceNumber: entry.referenceNumber ?? null,
      signerName: entry.signerName,
      signerRole: entry.signerRole ?? null,
      signerUserId: entry.signerUserId ?? null,
      signedAt: entry.signedAt ?? new Date(),
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
      contentHash: entry.contentHash ?? null,
      authCode: entry.authCode ?? null,
      sectionInitials: entry.sectionInitials ?? null,
      certificatePath: entry.certificatePath ?? null,
      metadata: entry.metadata ?? null,
      consentAcceptedAt: entry.consentAcceptedAt ?? null,
    };
    const [row] = await db.insert(signatureRecords).values(values).returning({ id: signatureRecords.id });
    return row ?? null;
  } catch (err) {
    console.error(`[signatureLedger] Failed to record ${entry.documentType} signature for ${entry.documentId}:`, err);
    return null;
  }
}

// ─── Generic dispatcher ───────────────────────────────────────────────────────
// Single entry-point that routes to the correct algorithm by document type.
// All dispatch / signing call-sites should use this rather than calling individual
// sign* functions directly, so adding a new document type only requires a new branch
// here rather than scattered changes across the codebase.
export function sign(documentType: DocumentType | string, fields: Record<string, any>): SignResult {
  switch (documentType) {
    case "contract":
      return signContract(fields as Parameters<typeof signContract>[0]);

    case "offer_letter":
      // Acceptance signing — returns same SignResult shape
      if (!fields.docxBuffer && !fields.letterFields) {
        throw new Error("offer_letter sign requires letterFields + acceptedName + timestamp");
      }
      if (fields.docxBuffer) {
        return signOfferLetterContent(fields.docxBuffer, fields.docId, fields.acceptedName, fields.timestamp);
      }
      {
        const r = signOfferLetterAcceptance(fields.letterFields, fields.acceptedName, fields.timestamp);
        return { refNumber: fields.letterFields.id, authCode: r.authCode, documentHash: r.documentHash };
      }

    case "hr_letter":
      {
        const r = signHrLetter(fields as Parameters<typeof signHrLetter>[0]);
        return { refNumber: fields.id, authCode: r.authCode, documentHash: r.documentHash };
      }

    default:
      throw new Error(`Unsupported document type for signing: ${documentType}`);
  }
}

// ─── Verify ──────────────────────────────────────────────────────────────────

export async function verifyDocument(
  documentType: DocumentType,
  refNumber: string,
  providedAuthCode: string,
): Promise<VerifyResult> {
  try {
    if (documentType === "hr_letter") {
      const letter = await db.select().from(hrLetters).where(eq(hrLetters.referenceNumber, refNumber)).limit(1);
      if (!letter[0]) return { valid: false, tamperDetected: false, error: "not_found" };
      const l = letter[0];
      const { authCode: recomputed } = signHrLetter({
        id: l.id, templateType: l.templateType, employeeName: l.employeeName,
        designation: l.designation, startDate: l.startDate, endDate: l.endDate,
        performanceBand: l.performanceBand, conductBand: l.conductBand,
        completionBand: l.completionBand, department: l.department,
        location: l.location, employeeCode: l.employeeCode,
        signatoryName: l.signatoryName, signatoryDesignation: l.signatoryDesignation,
        closingLine: l.closingLine, responsibilitiesSummary: l.responsibilitiesSummary,
        projectName: l.projectName, customOverrideText: l.customOverrideText,
        issueDate: l.issueDate,
      });
      if (recomputed !== providedAuthCode.toUpperCase()) return { valid: false, tamperDetected: false, error: "not_found" };
      const tamperDetected = l.authCode !== recomputed;
      return { valid: !tamperDetected, tamperDetected, record: l as any };
    }

    if (documentType === "contract") {
      // Verify by BOTH referenceNumber AND authCode for strict pairing
      const [c] = await db.select().from(contracts).where(eq(contracts.referenceNumber, refNumber)).limit(1);
      if (!c) return { valid: false, tamperDetected: false, error: "not_found" };

      // Auth-code mismatch → not found (don't reveal which field was wrong)
      if (!c.authCode || c.authCode.toUpperCase() !== providedAuthCode.toUpperCase()) {
        return { valid: false, tamperDetected: false, error: "not_found" };
      }

      // signedAt must be persisted to allow deterministic recomputation
      if (!c.signedAt) {
        // Contract exists and auth code matches but was signed with old weak scheme —
        // treat as valid but flag that tamper detection is unavailable
        return { valid: true, tamperDetected: false, record: c as any };
      }

      // Deterministic recompute using persisted signedAt
      const recomputed = signContract({
        id: c.id, clientName: c.clientName, templateName: c.templateName,
        agreementDate: c.agreementDate, billingFrequency: c.billingFrequency,
        paymentTermsDays: c.paymentTermsDays, candidates: c.candidates,
        signedAt: c.signedAt,
      });
      const tamperDetected = c.documentHash !== recomputed.documentHash;
      return { valid: !tamperDetected, tamperDetected, record: c as any };
    }

    if (documentType === "offer_letter") {
      // Reference is the offer letter id (shown to the candidate in the offer body).
      const [l] = await db.select().from(offerLetters).where(eq(offerLetters.id, refNumber)).limit(1);
      if (!l || !l.authCode || !l.acceptedAt) return { valid: false, tamperDetected: false, error: "not_found" };
      const { authCode: recomputed } = signOfferLetterAcceptance(
        {
          id: l.id, candidateName: l.candidateName, designation: l.designation,
          salary: l.salary, proposedStartDate: l.proposedStartDate, offerDate: l.offerDate,
          location: l.location,
        },
        l.acceptedName || "",
        new Date(l.acceptedAt),
        (l.annexureInitials as any) || null,
      );
      if (recomputed.toUpperCase() !== providedAuthCode.toUpperCase()) return { valid: false, tamperDetected: false, error: "not_found" };
      const tamperDetected = l.authCode !== recomputed;
      return { valid: !tamperDetected, tamperDetected, record: l as any };
    }

    if (documentType === "addendum") {
      const [a] = await db.select().from(offerLetterAddendums).where(eq(offerLetterAddendums.id, refNumber)).limit(1);
      if (!a || !a.authCode || !a.acceptedAt) return { valid: false, tamperDetected: false, error: "not_found" };
      const { authCode: recomputed } = signAddendumAcceptance(
        { id: a.id, offerLetterId: a.offerLetterId, candidateName: a.candidateName, addendumType: a.addendumType, effectiveDate: a.effectiveDate },
        a.acceptedName || "",
        new Date(a.acceptedAt),
      );
      if (recomputed.toUpperCase() !== providedAuthCode.toUpperCase()) return { valid: false, tamperDetected: false, error: "not_found" };
      const tamperDetected = a.authCode !== recomputed;
      return { valid: !tamperDetected, tamperDetected, record: a as any };
    }

    if (documentType === "policy") {
      // Policy verification is ledger-backed (the per-entity policy_signatures row carries
      // no auth code historically). The ledger row stores the reference + authCode + hash.
      const [rec] = await db.select().from(signatureRecords)
        .where(eq(signatureRecords.referenceNumber, refNumber)).limit(1);
      if (!rec || rec.documentType !== "policy" || !rec.authCode) return { valid: false, tamperDetected: false, error: "not_found" };
      if (rec.authCode.toUpperCase() !== providedAuthCode.toUpperCase()) return { valid: false, tamperDetected: false, error: "not_found" };
      // Recompute from the linked signature → request → policy document to detect tamper.
      const [sig] = await db.select().from(policySignatures).where(eq(policySignatures.id, rec.documentId)).limit(1);
      if (!sig || !sig.signedAt) {
        return { valid: true, tamperDetected: false, record: rec as any };
      }
      const [reqRow] = await db.select().from(policySigningRequests).where(eq(policySigningRequests.id, sig.signingRequestId)).limit(1);
      const [pol] = reqRow ? await db.select().from(policyDocuments).where(eq(policyDocuments.id, reqRow.policyDocumentId)).limit(1) : [];
      if (!pol) return { valid: true, tamperDetected: false, record: { ...rec, signedAt: sig.signedAt } as any };
      const recomputed = signPolicyAcknowledgement({
        policyId: pol.id, policyTitle: pol.title, policyVersion: pol.version,
        employeeName: rec.signerName,
        pageInitials: (sig.pageInitials as any) || [],
        finalSignature: sig.finalSignature,
        signedAt: new Date(sig.signedAt),
      });
      const tamperDetected = rec.contentHash !== recomputed.documentHash;
      return {
        valid: !tamperDetected,
        tamperDetected,
        record: { ...rec, policyTitle: pol.title, policyVersion: pol.version, signedAt: sig.signedAt } as any,
      };
    }

    if (documentType === "sop") {
      // SOP acknowledgments are ledger-backed (no per-entity table carries the auth
      // code). The ledger row stores reference + authCode + content hash; we match
      // on reference + authCode. The contentHash is deterministic for the version.
      const [rec] = await db.select().from(signatureRecords)
        .where(eq(signatureRecords.referenceNumber, refNumber)).limit(1);
      if (!rec || rec.documentType !== "sop" || !rec.authCode) return { valid: false, tamperDetected: false, error: "not_found" };
      if (rec.authCode.toUpperCase() !== providedAuthCode.toUpperCase()) return { valid: false, tamperDetected: false, error: "not_found" };
      return { valid: true, tamperDetected: false, record: rec as any };
    }

    return { valid: false, tamperDetected: false, error: "unsupported_type" };
  } catch (err: any) {
    return { valid: false, tamperDetected: false, error: err.message };
  }
}
