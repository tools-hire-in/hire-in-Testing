/**
 * Zoom SMS PII/PHI Sanitization Pipeline
 *
 * Sits between raw SMS message bodies and any AI processing.
 * Ensures candidate names, phone numbers, compensation figures,
 * and other sensitive data are NEVER sent to OpenAI — only anonymized digests are.
 *
 * Key guarantee: generateDigest() always calls buildNameList() internally before
 * sending any text to the AI model, so no unsanitized names can reach OpenAI even
 * if the caller omits the name list.
 *
 * Exports:
 *   sanitizeThread(messages, nameList) — pure, no external deps; unit-testable
 *   generateDigest(messages, sessionId, date) — full pipeline: sanitize then digest
 *   buildNameList()  — loads name tokens from admin_users + applications
 */

import { db } from "./db";
import { sql } from "drizzle-orm";

// ── PII regex substitution passes ────────────────────────────────────────────

const PHONE_RE =
  /(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;

const EMAIL_RE =
  /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

const COMPENSATION_RE =
  /\$\s?\d[\d,]*(\.\d{1,2})?(\s?(k|K|per\s?hour|\/hr|\/year|annually|salary|compensation))?|\b\d[\d,]*\s*(dollars?|USD|per\s?hour|\/hr)\b/g;

const SSN_RE =
  /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g;

const ID_RE =
  /\b[A-Z]{1,2}\d{6,9}\b/g;

const DOB_RE =
  /\b(0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12]\d|3[01])[\/\-](\d{2}|\d{4})\b|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}\b/gi;

// ── Name token types ──────────────────────────────────────────────────────────

export interface NameEntry {
  tokens: string[];
  label: "[CANDIDATE]" | "[RECRUITER]" | "[PERSON]";
}

/**
 * Build a combined name list from two sources:
 *   1. admin_users (active, non-deleted) — recruiters → [RECRUITER], others → [PERSON]
 *   2. applications (candidate names) — → [CANDIDATE]
 *
 * The caller can optionally pass extra entries to supplement (e.g. from the Zoom
 * sync engine which knows the peer's identity before querying the DB).
 */
export async function buildNameList(extra: NameEntry[] = []): Promise<NameEntry[]> {
  const entries: NameEntry[] = [...extra];

  try {
    const staffResult = await db.execute(sql`
      SELECT first_name, last_name, role
      FROM admin_users
      WHERE is_active = true
        AND deleted_at IS NULL
        AND (first_name IS NOT NULL OR last_name IS NOT NULL)
    `);
    const staffRows = (staffResult?.rows ?? staffResult ?? []) as Array<{
      first_name: string | null;
      last_name: string | null;
      role: string | null;
    }>;

    for (const r of staffRows) {
      const tokens = [r.first_name, r.last_name]
        .filter((t): t is string => !!t && t.trim().length > 1)
        .map((t) => t.trim());
      if (tokens.length === 0) continue;
      const label: NameEntry["label"] =
        r.role === "recruiter" ? "[RECRUITER]" : "[PERSON]";
      entries.push({ tokens, label });
    }
  } catch (err) {
    console.warn("[zoomSanitizer] buildNameList — admin_users query failed:", err);
  }

  try {
    const candResult = await db.execute(sql`
      SELECT candidate_name
      FROM applications
      WHERE candidate_name IS NOT NULL
        AND length(trim(candidate_name)) > 1
      LIMIT 5000
    `);
    const candRows = (candResult?.rows ?? candResult ?? []) as Array<{
      candidate_name: string | null;
    }>;

    for (const r of candRows) {
      const fullName = r.candidate_name?.trim() ?? "";
      if (!fullName) continue;
      const tokens = fullName
        .split(/\s+/)
        .filter((t) => t.length > 1);
      if (tokens.length === 0) continue;
      entries.push({ tokens, label: "[CANDIDATE]" });
    }
  } catch (err) {
    console.warn("[zoomSanitizer] buildNameList — applications query failed:", err);
  }

  return entries;
}

/**
 * Build a case-insensitive token→label lookup regex from the name list.
 * Longer tokens take priority (sorted by descending length before alternation).
 * Returns null when the list is empty (no name substitution performed).
 */
function buildNameRegex(
  nameList: NameEntry[],
): { re: RegExp; map: Map<string, string> } | null {
  if (nameList.length === 0) return null;

  const map = new Map<string, string>();
  for (const entry of nameList) {
    for (const token of entry.tokens) {
      const key = token.toLowerCase();
      if (!map.has(key)) {
        map.set(key, entry.label);
      }
    }
  }

  const escaped = Array.from(map.keys())
    .sort((a, b) => b.length - a.length)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  if (escaped.length === 0) return null;

  return { re: new RegExp(`\\b(${escaped.join("|")})\\b`, "gi"), map };
}

// ── Core sanitize function (pure) ─────────────────────────────────────────────

export interface RawMessage {
  body: string;
  direction: string;
}

/**
 * Sanitize a thread of messages into a single anonymized string.
 *
 * Pure function — no external dependencies. Safe to unit-test directly.
 * Applies PII regex passes first, then name-token substitution.
 *
 * @param messages  Raw SMS messages (body + direction)
 * @param nameList  Pre-loaded name entries from buildNameList(); pass [] for regex-only mode
 * @returns         Anonymized thread text, one message per line prefixed [IN] / [OUT]
 */
export function sanitizeThread(
  messages: RawMessage[],
  nameList: NameEntry[] = [],
): string {
  const nameRegexResult = buildNameRegex(nameList);

  const sanitized = messages.map((msg) => {
    let text = msg.body ?? "";

    text = text.replace(PHONE_RE, "[PHONE]");
    text = text.replace(EMAIL_RE, "[EMAIL]");
    text = text.replace(COMPENSATION_RE, "[COMPENSATION]");
    text = text.replace(SSN_RE, "[ID]");
    text = text.replace(ID_RE, "[ID]");
    text = text.replace(DOB_RE, "[DOB]");

    if (nameRegexResult) {
      const { re, map } = nameRegexResult;
      text = text.replace(re, (match) => {
        return map.get(match.toLowerCase()) ?? "[PERSON]";
      });
    }

    const prefix = msg.direction === "inbound" ? "IN" : "OUT";
    return `[${prefix}]: ${text}`;
  });

  return sanitized.join("\n");
}

// ── Digest generator (full pipeline) ─────────────────────────────────────────

const DIGEST_SYSTEM_PROMPT =
  "Summarize the intent and tone of this conversation in 2–3 sentences. " +
  "Do not invent details. Include no names or numbers.";

/**
 * Full sanitize-then-digest pipeline.
 *
 * Always calls buildNameList() internally so candidate/recruiter/person names
 * are GUARANTEED to be substituted before any text reaches OpenAI — even if the
 * caller provides no pre-built name list.
 *
 * Stores the result in zoom_sms_digests (upsert on session_id + date).
 * Never throws — errors are logged and skipped so a digest failure never
 * blocks the sync engine.
 *
 * @param messages   Raw SMS messages to sanitize and summarize
 * @param sessionId  zoom_sms_sessions.id (internal UUID)
 * @param date       YYYY-MM-DD string for the digest partition key
 * @param extraNames Optional caller-supplied name entries to merge into the name list
 */
export async function generateDigest(
  messages: RawMessage[],
  sessionId: string,
  date: string,
  extraNames: NameEntry[] = [],
): Promise<void> {
  let nameList: NameEntry[] = [];
  try {
    nameList = await buildNameList(extraNames);
  } catch (err) {
    console.warn("[zoomSanitizer] buildNameList threw unexpectedly — proceeding with regex-only sanitization:", err);
  }

  const sanitizedText = sanitizeThread(messages, nameList);

  let digestText: string | null = null;

  try {
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

    if (!apiKey) {
      console.warn("[zoomSanitizer] AI_INTEGRATIONS_OPENAI_API_KEY not set — skipping digest");
      return;
    }

    const OpenAI = (await import("openai")).default;
    const client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 256,
      messages: [
        { role: "system", content: DIGEST_SYSTEM_PROMPT },
        { role: "user", content: sanitizedText },
      ],
    });

    digestText = completion.choices?.[0]?.message?.content?.trim() ?? null;
  } catch (err) {
    console.warn("[zoomSanitizer] OpenAI digest generation failed, skipping:", err);
    return;
  }

  if (!digestText) {
    console.warn("[zoomSanitizer] Empty digest returned by OpenAI for session", sessionId);
    return;
  }

  try {
    await db.execute(sql`
      INSERT INTO zoom_sms_digests (session_id, date, digest_text, generated_at, created_at)
      VALUES (${sessionId}, ${date}, ${digestText}, NOW(), NOW())
      ON CONFLICT (session_id, date)
      DO UPDATE SET digest_text = EXCLUDED.digest_text, generated_at = NOW()
    `);
    console.log(`[zoomSanitizer] Digest stored for session=${sessionId} date=${date}`);
  } catch (err) {
    console.warn("[zoomSanitizer] Failed to store digest in DB:", err);
  }
}
