/**
 * Shared verification input schema for the /verify public endpoint.
 *
 * Exported from shared/ so both the server route handler and the frontend
 * form can import the same regex patterns and Zod schema, keeping client-side
 * and server-side validation in lockstep.
 *
 * Document type → reference format mapping:
 *   hr_letter    RL/{PREFIX}/{YEAR}/{SEQ}   PREFIX∈{EXP,INT,CRT,REL,SAL,ROL,CMB,DEV}
 *   contract     CTR/{YEAR}/{HEX8}
 *   offer_letter OL/{YEAR}/{SEQ4}           e.g. OL/2026/0042
 *   addendum     AM/{PREFIX}/{YEAR}/{SEQ4}  PREFIX∈{SAL,ROL,CMB,DEV,PRB,CST}
 *
 * Auth code is always [A-F0-9]{4}-[A-F0-9]{4} for all document types.
 */

import { z } from "zod";

export const ALLOWED_DOC_TYPES = [
  "hr_letter",
  "contract",
  "offer_letter",
  "addendum",
] as const;

export type AllowedDocType = (typeof ALLOWED_DOC_TYPES)[number];

export const REF_PATTERNS: Record<AllowedDocType, RegExp> = {
  hr_letter:
    /^RL\/(EXP|INT|CRT|REL|SAL|ROL|CMB|DEV)\/\d{4}\/\d{4}$/,
  contract:
    /^CTR\/\d{4}\/[A-F0-9]{8}$/,
  offer_letter:
    /^OL\/\d{4}\/\d{4}$/,
  addendum:
    /^AM\/(SAL|ROL|CMB|DEV|PRB|CST)\/\d{4}\/\d{4}$/,
};

const AUTH_CODE_RE = /^[A-F0-9]{4}-[A-F0-9]{4}$/;

/** Human-readable example auth codes for placeholder text. */
export const AUTH_CODE_EXAMPLE = "A7F3-B92E";

/**
 * Infer document type from a reference number prefix.
 * Returns null if the prefix is unrecognised.
 */
export function inferDocType(ref: string): AllowedDocType | null {
  const upper = ref.toUpperCase().trim();
  if (upper.startsWith("RL/")) return "hr_letter";
  if (upper.startsWith("CTR/")) return "contract";
  if (upper.startsWith("OL/")) return "offer_letter";
  if (upper.startsWith("AM/")) return "addendum";
  return null;
}

/**
 * Returns true when `ref` matches the canonical pattern for `docType`.
 */
export function refMatchesDocType(ref: string, docType: AllowedDocType): boolean {
  return REF_PATTERNS[docType].test(ref.toUpperCase().trim());
}

/**
 * Server-side Zod schema.
 *
 * Normalises inputs (trim + uppercase/lowercase as appropriate) then validates:
 *   1. documentType is an allowed enum value
 *   2. ref matches the pattern for that documentType
 *   3. auth matches [A-F0-9]{4}-[A-F0-9]{4}
 *
 * Returns the normalised { ref, auth, documentType } on success.
 *
 * Max lengths: ref ≤ 40, auth ≤ 9, documentType ≤ 20.
 */
export const verifyInputSchema = z
  .object({
    ref: z
      .string()
      .max(40, "ref too long")
      .transform((v) => v.trim().toUpperCase()),
    auth: z
      .string()
      .max(9, "auth too long")
      .transform((v) => v.trim().toUpperCase()),
    documentType: z
      .string()
      .max(20, "documentType too long")
      .transform((v) => v.trim().toLowerCase())
      .pipe(z.enum(ALLOWED_DOC_TYPES)),
  })
  .superRefine((data, ctx) => {
    if (!REF_PATTERNS[data.documentType].test(data.ref)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ref"],
        message: `Reference number does not match expected format for ${data.documentType}`,
      });
    }
    if (!AUTH_CODE_RE.test(data.auth)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["auth"],
        message: "Auth code must be XXXX-XXXX (8 hex chars, e.g. A7F3-B92E)",
      });
    }
  });

export type VerifyInput = z.infer<typeof verifyInputSchema>;
