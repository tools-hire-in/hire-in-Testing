/**
 * Unified Letter Service
 *
 * Single source of truth for all letter state-machine transitions.
 * Covers hr_letters (standard + amendment) and the approval/revision
 * loop for offer_letters.
 *
 * Every state-changing function:
 *  1. Validates the transition against ALLOWED_TRANSITIONS (HTTP 409 on illegal move).
 *  2. Applies the DB update.
 *  3. Writes a row to letter_review_cycles for audit (where applicable).
 *  4. Returns the updated record.
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { hrLetters, letterReviewCycles, offerLetters } from "@shared/schema";
import { eq } from "drizzle-orm";
import { storage } from "../storage";
import { signHrLetter as _signHrLetter } from "../documentSigningService";
import { generateHrLetterPdf } from "../hrLetterPdf";
import { generateAddendumDocx, type AddendumData } from "../offerLetterAddendum";
import { sendHrLetterEmail } from "../email";
import { TEMPLATE_PREFIX_MAP, TEMPLATE_LABELS } from "@shared/hrLetterConstants";
import type { HrLetter, InsertHrLetter } from "@shared/schema";
import { notifyUser } from "../notifications";

// ─── Types ────────────────────────────────────────────────────────────────────

export type LetterAction =
  | "submit"
  | "approve"
  | "needs_revision"
  | "resubmit"
  | "withdraw"
  | "issue"
  | "reissue"
  | "revoke";

export type LetterType = "hr_letter" | "amendment" | "offer_letter";

export interface LetterTransitionError {
  type: "conflict" | "not_found" | "validation";
  message: string;
}

export interface ApproveOrReviseParams {
  letterId: string;
  letterTableType: "hr_letter" | "offer_letter";
  action: "approve" | "needs_revision";
  actorId: string;
  revisionReason?: string;
  note?: string;
}

export interface WithdrawParams {
  letterId: string;
  letterTableType: "hr_letter" | "offer_letter";
  actorId: string;
  reason?: string;
}

export interface ResubmitParams {
  letterId: string;
  letterTableType: "hr_letter" | "offer_letter";
  actorId: string;
  note?: string;
}

export interface IssueResult {
  letter: HrLetter;
  referenceNumber: string;
  authCode: string;
  pdfPath: string;
  buffer: Buffer;
  ext: string;
  mimeType: string;
}

export interface GenerateDocumentResult {
  buffer: Buffer;
  ext: string;
  mimeType: string;
  filename: string;
}

export interface LookupForVerifyResult {
  letter: HrLetter;
  valid: boolean;
  tamperDetected: boolean;
}

// ─── State Machine Guard Table ────────────────────────────────────────────────
//
// Maps each action to the set of statuses from which it is allowed.
// Any move not listed here returns HTTP 409 via checkTransition().
//
// NOTE: "issue" intentionally includes "draft" to support the legacy
// auto-issue-on-create path (POST /api/hr/letters).  Letters that enter
// the approval loop arrive at "issue" via "approved" instead.

const ALLOWED_TRANSITIONS: Record<LetterAction, string[]> = {
  submit:         ["draft", "needs_revision", "withdrawn"],
  approve:        ["pending_approval"],
  needs_revision: ["pending_approval"],
  resubmit:       ["needs_revision"],
  withdraw:       ["draft", "pending_approval"],
  issue:          ["approved", "draft"],
  reissue:        ["issued", "reissued"],
  revoke:         ["draft", "pending_approval", "approved", "issued", "reissued", "needs_revision", "resubmitted"],
};

export function checkTransition(
  action: LetterAction,
  currentStatus: string,
): LetterTransitionError | null {
  const allowed = ALLOWED_TRANSITIONS[action];
  if (!allowed) {
    return { type: "conflict", message: `Unknown action: ${action}` };
  }
  if (!allowed.includes(currentStatus)) {
    return {
      type: "conflict",
      message: `Action '${action}' is not allowed from status '${currentStatus}'. Allowed from: ${allowed.join(", ")}.`,
    };
  }
  return null;
}

// ─── Review Cycle Writer ──────────────────────────────────────────────────────

async function writeReviewCycle(params: {
  letterId: string;
  letterType: string;
  round: number;
  action: "approved" | "needs_revision" | "withdrawn" | "resubmitted";
  reason?: string | null;
  reviewedBy?: string | null;
}): Promise<void> {
  await db.insert(letterReviewCycles).values({
    letterId: params.letterId,
    letterType: params.letterType,
    round: params.round,
    action: params.action,
    reason: params.reason ?? null,
    reviewedBy: params.reviewedBy ?? null,
    reviewedAt: new Date(),
  });
}

// ─── Reference & Auth Code Generation ────────────────────────────────────────

export function generateRefNumber(prefix: string, year: number, count: number): string {
  return `RL/${prefix}/${year}/${String(count + 1).padStart(4, "0")}`;
}

/**
 * Pure function: compute the auth code and document hash for a letter.
 * Delegates to the central DocumentSigningService to avoid algorithm drift.
 * Field ordering is preserved exactly to remain compatible with issued letters.
 */
export function computeLetterAuthCode(letter: {
  id: string; templateType: string; employeeName: string; designation: string;
  startDate: string; endDate?: string | null; performanceBand?: string | null;
  conductBand?: string | null; completionBand?: string | null;
  department?: string | null; location?: string | null; employeeCode?: string | null;
  signatoryName?: string | null; signatoryDesignation?: string | null;
  closingLine?: string | null; responsibilitiesSummary?: string | null;
  projectName?: string | null; customOverrideText?: string | null;
  issueDate?: string | null;
}): { authCode: string; documentHash: string } {
  return _signHrLetter(letter);
}

/**
 * Generate a reference number and auth code for any hr_letters row
 * (standard + amendment), persist them on the row, and return the values.
 * Idempotent: returns the stored values immediately if already set.
 */
export async function generateReferenceAndHash(
  letter: HrLetter,
): Promise<{ referenceNumber: string; authCode: string; documentHash: string }> {
  if (letter.referenceNumber && letter.authCode) {
    return {
      referenceNumber: letter.referenceNumber,
      authCode: letter.authCode,
      documentHash: letter.documentHash ?? "",
    };
  }

  const prefix = TEMPLATE_PREFIX_MAP[letter.templateType] || "GEN";
  const year = new Date().getFullYear();
  const refPrefix = `RL/${prefix}/${year}/`;
  const count = await storage.getHrLetterCountByPrefix(refPrefix);
  const referenceNumber = generateRefNumber(prefix, year, count);

  const issueDate = letter.issueDate || new Date().toISOString().split("T")[0];
  const { authCode, documentHash } = computeLetterAuthCode({ ...letter, issueDate });

  await db.update(hrLetters)
    .set({ referenceNumber, authCode, documentHash } as any)
    .where(eq(hrLetters.id, letter.id));

  return { referenceNumber, authCode, documentHash };
}

// ─── Document Generation ──────────────────────────────────────────────────────

export const AMENDMENT_TEMPLATES = new Set([
  "salary_revision", "role_change", "combined", "device_allocation",
]);

/**
 * Generate the document buffer for a letter, routing to the correct
 * generator based on templateType.
 *
 * - Standard hr_letters  → PDFKit (generateHrLetterPdf)
 * - Amendment hr_letters → DOCX  (generateAddendumDocx)
 * - Offer letters        → DOCX  (generateOfferLetterDocx)  [future]
 */
export async function generateDocument(letter: HrLetter): Promise<GenerateDocumentResult> {
  const isAmendment = AMENDMENT_TEMPLATES.has(letter.templateType);

  const last4 = (letter.employeeCode || "").slice(-4) || "XXXX";
  const safeName = (letter.employeeName || "letter")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "");

  if (isAmendment) {
    const meta: Record<string, unknown> =
      (typeof letter.metadata === "object" && letter.metadata !== null
        ? letter.metadata
        : {}) as Record<string, unknown>;
    const effectiveDate =
      typeof meta.effectiveDate === "string" ? meta.effectiveDate : letter.startDate;
    const storedAnnexures = Array.isArray((letter as any).annexureData)
      ? (letter as any).annexureData
      : undefined;

    const docxBuffer = await generateAddendumDocx({
      candidateName: letter.employeeName,
      originalOfferDate: letter.startDate,
      originalDesignation: letter.designation,
      effectiveDate,
      hrManagerName: letter.signatoryName || "HR Manager",
      addendumType: letter.templateType as AddendumData["addendumType"],
      ...meta,
      ...(storedAnnexures ? { annexures: storedAnnexures } : {}),
    });

    const ext = "docx";
    const mimeType =
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const filename = `${safeName}_${last4}.${ext}`;
    return { buffer: docxBuffer, ext, mimeType, filename };
  }

  const dbSentences = await storage.getLetterTemplateSentences();
  const customSentences = dbSentences.reduce<Record<string, Record<string, string>>>(
    (acc, s) => {
      if (!acc[s.category]) acc[s.category] = {};
      acc[s.category][s.key] = s.sentence;
      return acc;
    },
    {},
  );

  const pdfBuffer = await generateHrLetterPdf(letter, {
    performance_band: customSentences["performance_band"],
    conduct_band: customSentences["conduct_band"],
    completion_band: customSentences["completion_band"],
    closing_line: customSentences["closing_line"],
  });

  const ext = "pdf";
  const mimeType = "application/pdf";
  const filename = `${safeName}_${last4}.${ext}`;
  return { buffer: pdfBuffer, ext, mimeType, filename };
}

// ─── Draft Management ─────────────────────────────────────────────────────────

/**
 * Create a new letter in draft status.
 * Thin wrapper over storage.createHrLetter — lets routes delegate creation
 * through the service layer without any duplication.
 */
export async function createDraft(data: InsertHrLetter): Promise<HrLetter> {
  return storage.createHrLetter({ ...data, status: "draft" });
}

/**
 * Upsert draft_data JSON on a letter without changing its status.
 * Used by the draft-recovery UI to checkpoint work-in-progress.
 * Returns 409 if the letter is in a terminal state.
 */
export async function updateDraft(
  letterId: string,
  draftData: Record<string, unknown>,
  actorId: string,
): Promise<HrLetter | LetterTransitionError> {
  const letter = await storage.getHrLetter(letterId);
  if (!letter) return { type: "not_found", message: "Letter not found" };

  if (["issued", "reissued", "revoked", "withdrawn"].includes(letter.status)) {
    return {
      type: "conflict",
      message: `Cannot update draft data on a ${letter.status} letter.`,
    };
  }

  const updated = await storage.updateHrLetter(letterId, {
    draftData: draftData as any,
  });

  return updated!;
}

/**
 * Update editable fields on a draft/pending/revision letter.
 * Rejects edits on issued, reissued, or revoked letters (conflict).
 * Enforces override-text permission: only super_admin/admin may set it.
 */
export async function updateLetter(
  letterId: string,
  body: Record<string, unknown>,
  actorRole: string,
  actorId: string,
): Promise<HrLetter | LetterTransitionError> {
  const letter = await storage.getHrLetter(letterId);
  if (!letter) return { type: "not_found", message: "Letter not found" };

  if (["issued", "reissued", "revoked"].includes(letter.status)) {
    return {
      type: "conflict",
      message: `Cannot edit a ${letter.status} letter.`,
    };
  }

  const isOverrideAllowed = actorRole === "super_admin" || actorRole === "admin";
  const payload = { ...body };
  const hasOverrideChange =
    payload.customOverrideText !== undefined &&
    payload.customOverrideText !== letter.customOverrideText;

  if (!isOverrideAllowed) {
    delete payload.customOverrideText;
    delete payload.customOverrideBy;
    delete payload.customOverrideAt;
  }
  if (isOverrideAllowed && hasOverrideChange) {
    payload.customOverrideBy = actorId;
    payload.customOverrideAt = new Date();
  }

  const updated = await storage.updateHrLetter(letterId, payload);

  if (isOverrideAllowed && hasOverrideChange) {
    await storage.createAuditLog({
      actorId,
      targetId: letterId,
      action: "hr_letter_custom_override",
      changes: {
        before: letter.customOverrideText || null,
        after: payload.customOverrideText,
        source: "update",
      },
    });
  }

  return updated!;
}

// ─── State Transitions: HR Letters ───────────────────────────────────────────

/**
 * Move a draft letter into pending_approval.
 */
export async function submitForApproval(
  letterId: string,
  actorId: string,
): Promise<HrLetter | LetterTransitionError> {
  const letter = await storage.getHrLetter(letterId);
  if (!letter) return { type: "not_found", message: "Letter not found" };

  const err = checkTransition("submit", letter.status);
  if (err) return err;

  const updated = await storage.updateHrLetter(letterId, {
    status: "pending_approval",
  });

  await storage.createAuditLog({
    actorId,
    targetId: letterId,
    action: "hr_letter_submit_for_approval",
    changes: { fromStatus: letter.status, toStatus: "pending_approval" },
  });

  return updated!;
}

/**
 * Approve or request revision on a pending_approval letter.
 * When action=needs_revision, `revisionReason` is mandatory (validation error if missing).
 * Writes one row to letter_review_cycles per call, incrementing revision_round.
 */
export async function approveOrRevise(
  params: ApproveOrReviseParams,
): Promise<HrLetter | LetterTransitionError> {
  const letter = await storage.getHrLetter(params.letterId);
  if (!letter) return { type: "not_found", message: "Letter not found" };

  const action: LetterAction =
    params.action === "approve" ? "approve" : "needs_revision";
  const err = checkTransition(action, letter.status);
  if (err) return err;

  if (params.action === "needs_revision" && !params.revisionReason?.trim()) {
    return {
      type: "validation",
      message: "revision_reason is required when requesting a revision.",
    };
  }

  const toStatus = params.action === "approve" ? "approved" : "needs_revision";
  const newRound =
    params.action === "needs_revision"
      ? (letter.revisionRound ?? 0) + 1
      : letter.revisionRound ?? 0;

  const updatePayload: Partial<HrLetter> =
    params.action === "approve"
      ? {
          status: "approved",
          approvedBy: params.actorId,
          approvedAt: new Date(),
        }
      : {
          status: "needs_revision",
          revisionRound: newRound,
          revisionReason: params.revisionReason ?? null,
        };

  const updated = await storage.updateHrLetter(params.letterId, updatePayload);

  await writeReviewCycle({
    letterId: params.letterId,
    letterType: params.letterTableType,
    round: newRound,
    action: params.action === "approve" ? "approved" : "needs_revision",
    reason: params.revisionReason ?? params.note ?? null,
    reviewedBy: params.actorId,
  });

  await storage.createAuditLog({
    actorId: params.actorId,
    targetId: params.letterId,
    action: params.action === "approve"
      ? "hr_letter_approved"
      : "hr_letter_needs_revision",
    changes: {
      toStatus,
      revisionRound: newRound,
      revisionReason: params.revisionReason ?? null,
    },
  });

  // Notify the letter creator (fire-and-forget — must not fail the transition).
  if (letter.createdBy) {
    const letterTypeLabel = (TEMPLATE_LABELS as Record<string, string>)[letter.templateType] ?? letter.templateType;
    if (params.action === "needs_revision") {
      const reasonExcerpt = (params.revisionReason ?? "").slice(0, 120);
      notifyUser({
        userId: letter.createdBy,
        type: "hr_letter_needs_revision",
        title: "Letter returned for revision",
        message: `Your ${letterTypeLabel} for ${letter.employeeName} was returned for revision${reasonExcerpt ? `: ${reasonExcerpt}` : "."}`,
        metadata: { letterId: params.letterId, revisionRound: newRound },
      }).catch(() => {/* non-fatal */});
    } else {
      notifyUser({
        userId: letter.createdBy,
        type: "hr_letter_approved",
        title: "Letter approved",
        message: `Your ${letterTypeLabel} for ${letter.employeeName} was approved.`,
        metadata: { letterId: params.letterId },
      }).catch(() => {/* non-fatal */});
    }
  }

  return updated!;
}

/**
 * Resubmit a letter that was sent back for revision.
 * needs_revision → pending_approval.
 */
export async function resubmit(
  params: ResubmitParams,
): Promise<HrLetter | LetterTransitionError> {
  const letter = await storage.getHrLetter(params.letterId);
  if (!letter) return { type: "not_found", message: "Letter not found" };

  const err = checkTransition("resubmit", letter.status);
  if (err) return err;

  const updated = await storage.updateHrLetter(params.letterId, {
    status: "pending_approval",
  });

  await writeReviewCycle({
    letterId: params.letterId,
    letterType: params.letterTableType,
    round: letter.revisionRound ?? 0,
    action: "resubmitted",
    reason: params.note ?? null,
    reviewedBy: params.actorId,
  });

  await storage.createAuditLog({
    actorId: params.actorId,
    targetId: params.letterId,
    action: "hr_letter_resubmitted",
    changes: { fromStatus: "needs_revision", toStatus: "pending_approval" },
  });

  return updated!;
}

/**
 * Withdraw a letter from draft or pending_approval.
 */
export async function withdraw(
  params: WithdrawParams,
): Promise<HrLetter | LetterTransitionError> {
  const letter = await storage.getHrLetter(params.letterId);
  if (!letter) return { type: "not_found", message: "Letter not found" };

  const err = checkTransition("withdraw", letter.status);
  if (err) return err;

  const updated = await storage.updateHrLetter(params.letterId, {
    status: "withdrawn",
  });

  await writeReviewCycle({
    letterId: params.letterId,
    letterType: params.letterTableType,
    round: letter.revisionRound ?? 0,
    action: "withdrawn",
    reason: params.reason ?? null,
    reviewedBy: params.actorId,
  });

  await storage.createAuditLog({
    actorId: params.actorId,
    targetId: params.letterId,
    action: "hr_letter_withdrawn",
    changes: { fromStatus: letter.status, reason: params.reason ?? null },
  });

  return updated!;
}

/**
 * Issue a letter: generate document, assign ref+hash via generateReferenceAndHash,
 * persist the file, and record the signature.
 *
 * Allowed from "approved" (review-loop path) or "draft" (legacy auto-issue path).
 */
export async function issue(
  letterId: string,
  actorId: string,
): Promise<IssueResult | LetterTransitionError> {
  const letter = await storage.getHrLetter(letterId);
  if (!letter) return { type: "not_found", message: "Letter not found" };

  const err = checkTransition("issue", letter.status);
  if (err) return err;

  const issueDate = letter.issueDate || new Date().toISOString().split("T")[0];
  const letterWithDate: HrLetter = { ...letter, issueDate };

  const { referenceNumber, authCode, documentHash } =
    await generateReferenceAndHash(letterWithDate);

  const issuedLetter: HrLetter = {
    ...letterWithDate,
    referenceNumber,
    authCode,
    status: "issued",
  };

  const { buffer, ext } = await generateDocument(issuedLetter);

  const fileDir = path.resolve("uploads/hr-letters");
  if (!fs.existsSync(fileDir)) fs.mkdirSync(fileDir, { recursive: true });
  const filename = `${referenceNumber.replace(/\//g, "-")}.${ext}`;
  const filePath = path.join(fileDir, filename);
  fs.writeFileSync(filePath, buffer);
  const storedPath = `hr-letters/${filename}`;

  const updated = await storage.updateHrLetter(letterId, {
    status: "issued",
    referenceNumber,
    authCode,
    documentHash,
    issuedBy: actorId,
    issuedAt: new Date(),
    issueDate,
    pdfPath: storedPath,
  });

  const { recordSignature } = await import("../documentSigningService");
  await recordSignature({
    documentType: "hr_letter",
    documentId: letterId,
    referenceNumber,
    signerName: letter.employeeName,
    signerRole: "hr",
    signerUserId: actorId,
    contentHash: documentHash,
    authCode,
    metadata: { templateType: letter.templateType },
  });

  await storage.createAuditLog({
    actorId,
    targetId: letterId,
    action: "issue_hr_letter",
    changes: { referenceNumber, authCode, status: "issued", pdfPath: storedPath },
  });

  // Increment template usage_count when letter was created from a template
  const fromTemplateId = (letter as any).fromTemplateId ?? null;
  if (fromTemplateId) {
    db.execute(sql`UPDATE letter_templates SET usage_count = usage_count + 1, updated_at = NOW() WHERE id = ${fromTemplateId}`)
      .catch(() => {});
  }

  const mimeType = ext === "pdf"
    ? "application/pdf"
    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  return {
    letter: updated!,
    referenceNumber,
    authCode,
    pdfPath: storedPath,
    buffer,
    ext,
    mimeType,
  };
}

/**
 * Reissue an already-issued letter. Marks the original as `reissued`,
 * creates a new letter populated with current employee data, auto-issues it.
 * Rolls back the original status if issuance of the new letter fails.
 */
export async function reissue(
  letterId: string,
  actorId: string,
  reissueReason?: string,
): Promise<{ original: HrLetter; newLetter: HrLetter } | LetterTransitionError> {
  const originalLetter = await storage.getHrLetter(letterId);
  if (!originalLetter) return { type: "not_found", message: "Letter not found" };

  const err = checkTransition("reissue", originalLetter.status);
  if (err) return err;

  const currentEmployee = originalLetter.employeeId
    ? await storage.getAdminUser(originalLetter.employeeId)
    : null;

  if (originalLetter.employeeId && !currentEmployee) {
    return { type: "validation", message: "Employee record not found. Cannot reissue letter." };
  }

  let currentFullName = originalLetter.employeeName;
  let currentDesignation = originalLetter.designation;
  let currentDepartment = originalLetter.department || "";

  if (currentEmployee) {
    currentFullName = `${currentEmployee.firstName} ${currentEmployee.lastName}`.trim() || originalLetter.employeeName;
    currentDesignation = currentEmployee.designation || originalLetter.designation;
    if (currentEmployee.departmentId) {
      const dept = await storage.getDepartment(currentEmployee.departmentId);
      if (dept?.name) currentDepartment = dept.name;
    }
  }

  await storage.updateHrLetter(letterId, { status: "reissued" });
  let draftLetter: HrLetter | null = null;

  try {
    const newIssueDate = new Date().toISOString().split("T")[0];
    draftLetter = await storage.createHrLetter({
      templateType: originalLetter.templateType,
      employeeId: originalLetter.employeeId,
      employeeName: currentFullName,
      employeeCode: currentEmployee?.employeeId ?? originalLetter.employeeCode,
      designation: currentDesignation,
      department: currentDepartment,
      employmentType: originalLetter.employmentType,
      location: currentEmployee?.location ?? originalLetter.location,
      reportingManager: originalLetter.reportingManager,
      startDate: originalLetter.startDate,
      endDate: originalLetter.endDate,
      lastWorkingDay: originalLetter.lastWorkingDay,
      performanceBand: originalLetter.performanceBand,
      conductBand: originalLetter.conductBand,
      completionBand: originalLetter.completionBand,
      closingLine: originalLetter.closingLine,
      includeResponsibilities: originalLetter.includeResponsibilities,
      responsibilitiesSummary: originalLetter.responsibilitiesSummary,
      includeProject: originalLetter.includeProject,
      projectName: originalLetter.projectName,
      includeSeal: originalLetter.includeSeal,
      signatoryId: originalLetter.signatoryId,
      signatoryName: originalLetter.signatoryName,
      signatoryDesignation: originalLetter.signatoryDesignation,
      issueDate: newIssueDate,
      customOverrideText: originalLetter.customOverrideText,
      customOverrideBy: originalLetter.customOverrideBy,
      customOverrideAt: originalLetter.customOverrideAt,
      pdfPath: null,
      status: "approved",
      reissuedFromLetterId: originalLetter.id,
      reissueReason: reissueReason || "Reissued with updated data",
      createdBy: actorId,
    });

    const issueResult = await issue(draftLetter.id, actorId);
    if ("type" in issueResult) {
      throw new Error(`Issue failed: ${issueResult.message}`);
    }

    const dataChanges: Record<string, { old: string | null; new: string | null }> = {};
    if (originalLetter.employeeName !== currentFullName) {
      dataChanges.employeeName = { old: originalLetter.employeeName, new: currentFullName };
    }
    if (originalLetter.designation !== currentDesignation) {
      dataChanges.designation = { old: originalLetter.designation, new: currentDesignation };
    }
    if ((originalLetter.department || null) !== (currentDepartment || null)) {
      dataChanges.department = { old: originalLetter.department || null, new: currentDepartment || null };
    }

    await storage.createAuditLog({
      actorId,
      targetId: issueResult.letter.id,
      action: "reissue_hr_letter",
      changes: {
        originalId: originalLetter.id,
        originalReference: originalLetter.referenceNumber,
        newReference: issueResult.referenceNumber,
        reissueReason,
        dataChanges: Object.keys(dataChanges).length > 0 ? dataChanges : null,
      },
    });

    return {
      original: (await storage.getHrLetter(letterId)) ?? originalLetter,
      newLetter: issueResult.letter,
    };
  } catch (issuanceError) {
    try {
      await storage.updateHrLetter(letterId, { status: originalLetter.status });
      if (draftLetter) {
        await storage.updateHrLetter(draftLetter.id, { status: "revoked" });
      }
    } catch (rollbackError) {
      console.error("[letterService.reissue] Rollback failed:", rollbackError);
    }
    throw issuanceError;
  }
}

/**
 * Revoke a letter. Allowed from any non-revoked status.
 */
export async function revoke(
  letterId: string,
  actorId: string,
  revokeReason?: string,
): Promise<HrLetter | LetterTransitionError> {
  const letter = await storage.getHrLetter(letterId);
  if (!letter) return { type: "not_found", message: "Letter not found" };

  const err = checkTransition("revoke", letter.status);
  if (err) return err;

  const updated = await storage.updateHrLetter(letterId, {
    status: "revoked",
    revokedBy: actorId,
    revokedAt: new Date(),
    revokeReason: revokeReason || "Revoked",
  });

  await storage.createAuditLog({
    actorId,
    targetId: letterId,
    action: "revoke_hr_letter",
    changes: { revokeReason, status: "revoked" },
  });

  return updated!;
}

// ─── Email Dispatch ───────────────────────────────────────────────────────────

/**
 * Send (or resend) the letter email to the employee.
 * Routes to sendAddendumEmail for amendment letters, sendHrLetterEmail for standard.
 * Wraps both existing email functions without duplicating the underlying logic.
 */
export async function dispatchEmail(
  letterId: string,
  actorId: string,
  opts: {
    recipientEmail: string;
    ccEmails?: string[];
    verifyUrl: string;
    resend?: boolean;
  },
): Promise<{ success: boolean; error?: string }> {
  const letter = await storage.getHrLetter(letterId);
  if (!letter) return { success: false, error: "Letter not found" };

  if (!letter.referenceNumber || !letter.authCode) {
    return { success: false, error: "Letter missing reference number or auth code" };
  }

  const isAmendment = AMENDMENT_TEMPLATES.has(letter.templateType);

  let buffer: Buffer | undefined;
  if (letter.pdfPath) {
    const filePath = path.resolve("uploads", letter.pdfPath);
    if (fs.existsSync(filePath)) {
      buffer = fs.readFileSync(filePath);
    }
  }

  if (!buffer) {
    const { buffer: generated } = await generateDocument(letter);
    buffer = generated;
  }

  const ext = isAmendment ? "docx" : "pdf";
  const docFilename = `${letter.referenceNumber.replace(/\//g, "-")}.${ext}`;

  const result = await sendHrLetterEmail({
    to: opts.recipientEmail,
    employeeName: letter.employeeName,
    letterType: letter.templateType,
    referenceNumber: letter.referenceNumber,
    authCode: letter.authCode,
    verifyUrl: opts.verifyUrl,
    pdfBuffer: buffer,
    pdfFilename: docFilename,
    cc: opts.ccEmails?.length ? opts.ccEmails : undefined,
  });

  if (result.success) {
    await storage.createAuditLog({
      actorId,
      targetId: letterId,
      action: opts.resend ? "resend_hr_letter" : "email_hr_letter",
      changes: {
        sentTo: opts.recipientEmail,
        referenceNumber: letter.referenceNumber,
        cc: opts.ccEmails?.length ? opts.ccEmails : undefined,
        isAmendment,
      },
    });
  }

  return result;
}

// ─── Offer Letter: Approval / Revision via Service ───────────────────────────

/**
 * Apply an approval or revision-request decision to an offer letter.
 *
 * - action=approve      → status "sent", sets approvedBy/approvedAt
 * - action=needs_revision → status "needs_revision", stores revisionReason,
 *   writes a letter_review_cycles row so it joins the same audit trail.
 *
 * Returns { success: true } or a LetterTransitionError on any illegal move.
 * Callers (route handlers) remain responsible for candidate email, creator
 * notification, and other request-context side effects.
 */
export async function approveOrReviseOfferLetter(params: {
  offerId: string;
  action: "approve" | "needs_revision";
  actorId: string;
  revisionReason?: string;
}): Promise<{ success: true } | LetterTransitionError> {
  const [offer] = await db.select().from(offerLetters)
    .where(eq(offerLetters.id, params.offerId)).limit(1);
  if (!offer) return { type: "not_found", message: "Offer letter not found" };

  if (offer.status !== "pending_approval") {
    return {
      type: "conflict",
      message: `Action '${params.action}' is not allowed from offer letter status '${offer.status}'. Allowed from: pending_approval.`,
    };
  }

  if (params.action === "needs_revision" && !params.revisionReason?.trim()) {
    return {
      type: "validation",
      message: "revision_reason is required when requesting a revision.",
    };
  }

  if (params.action === "approve") {
    await db.update(offerLetters)
      .set({
        status: "sent",
        approvedBy: params.actorId,
        approvedAt: new Date(),
      } as any)
      .where(eq(offerLetters.id, params.offerId));
  } else {
    await db.update(offerLetters)
      .set({
        status: "needs_revision",
        approvalRejectionReason: params.revisionReason ?? null,
      } as any)
      .where(eq(offerLetters.id, params.offerId));

    const existingCycles = await db.select({ round: letterReviewCycles.round })
      .from(letterReviewCycles)
      .where(eq(letterReviewCycles.letterId, params.offerId));
    const round = existingCycles.length + 1;

    await writeReviewCycle({
      letterId: params.offerId,
      letterType: "offer_letter",
      round,
      action: "needs_revision",
      reason: params.revisionReason ?? null,
      reviewedBy: params.actorId,
    });
  }

  return { success: true };
}

/**
 * Withdraw an offer letter (pending_approval or needs_revision).
 * Writes a review cycle row.
 */
export async function withdrawOfferLetter(params: {
  offerId: string;
  actorId: string;
  reason?: string;
}): Promise<{ success: true } | LetterTransitionError> {
  const [offer] = await db.select().from(offerLetters)
    .where(eq(offerLetters.id, params.offerId)).limit(1);
  if (!offer) return { type: "not_found", message: "Offer letter not found" };

  if (!["pending_approval", "needs_revision", "draft"].includes(offer.status)) {
    return {
      type: "conflict",
      message: `Withdraw is not allowed from status '${offer.status}'.`,
    };
  }

  await db.update(offerLetters)
    .set({ status: "withdrawn" } as any)
    .where(eq(offerLetters.id, params.offerId));

  const existingCycles = await db.select({ round: letterReviewCycles.round })
    .from(letterReviewCycles)
    .where(eq(letterReviewCycles.letterId, params.offerId));

  await writeReviewCycle({
    letterId: params.offerId,
    letterType: "offer_letter",
    round: existingCycles.length,
    action: "withdrawn",
    reason: params.reason ?? null,
    reviewedBy: params.actorId,
  });

  return { success: true };
}

// ─── Verify Lookup ────────────────────────────────────────────────────────────

/**
 * Verify an HR letter (standard or amendment) by reference number + auth code.
 *
 * Scope: letter_type IN ('hr_letter', 'amendment') — all rows in hr_letters,
 * since both standard templates and amendment addendum templates live in the
 * same table.  Offer letters are verified via a separate endpoint path.
 *
 * Excludes revoked and withdrawn letters (auth code match returns valid=false
 * so the verify page can show an appropriate revocation warning).
 *
 * Returns null when no matching referenceNumber is found.
 */
export async function lookupForVerify(
  ref: string,
  auth: string,
): Promise<LookupForVerifyResult | null> {
  const rows = await db.select().from(hrLetters)
    .where(eq(hrLetters.referenceNumber, ref))
    .limit(1);

  if (!rows.length || !rows[0].authCode) return null;

  const letter = rows[0];

  const recomputed = computeLetterAuthCode({
    id: letter.id,
    templateType: letter.templateType,
    employeeName: letter.employeeName,
    designation: letter.designation,
    startDate: letter.startDate,
    endDate: letter.endDate,
    performanceBand: letter.performanceBand,
    conductBand: letter.conductBand,
    completionBand: letter.completionBand,
    department: letter.department,
    location: letter.location,
    employeeCode: letter.employeeCode,
    signatoryName: letter.signatoryName,
    signatoryDesignation: letter.signatoryDesignation,
    closingLine: letter.closingLine,
    responsibilitiesSummary: letter.responsibilitiesSummary,
    projectName: letter.projectName,
    customOverrideText: letter.customOverrideText,
    issueDate: letter.issueDate,
  });

  const storedAuth = letter.authCode!;
  let authMatch: boolean;
  try {
    authMatch = crypto.timingSafeEqual(
      Buffer.from(auth.padEnd(storedAuth.length, "\0")),
      Buffer.from(storedAuth.padEnd(auth.length, "\0")),
    ) && auth.length === storedAuth.length;
  } catch {
    authMatch = false;
  }

  const tamperDetected = authMatch && recomputed.authCode !== storedAuth;

  const isRevoked = letter.status === "revoked";
  const isWithdrawn = letter.status === "withdrawn";

  const valid = authMatch && !isRevoked && !isWithdrawn;

  return {
    letter,
    valid,
    tamperDetected,
  };
}

// ─── Helper: translate service errors to HTTP responses ───────────────────────

export function isTransitionError(
  result: HrLetter | LetterTransitionError | { success: true } | { success: boolean; error?: string } | null,
): result is LetterTransitionError {
  return (
    result !== null &&
    typeof result === "object" &&
    "type" in result &&
    (result as LetterTransitionError).type !== undefined &&
    !("success" in result) &&
    !("id" in result)
  );
}

export function transitionErrorStatus(err: LetterTransitionError): number {
  switch (err.type) {
    case "not_found":   return 404;
    case "conflict":    return 409;
    case "validation":  return 400;
    default:            return 500;
  }
}
