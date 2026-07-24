/**
 * Zoom Comms Sanitization Pipeline
 *
 * Pure-function module with no external dependencies on server state.
 * Provides:
 *   - NER regex layer for PII substitution
 *   - Name substitution using known team member list
 *   - Digest generator that summarises an anonymised thread via OpenAI
 *
 * IMPORTANT: Raw SMS bodies are NEVER passed to analytics — only sanitized digests.
 */

export interface SmsMessage {
  direction: "inbound" | "outbound";
  body: string;
  sentAt?: Date | string | null;
}

// ── PII substitution patterns ─────────────────────────────────────────────────

const PII_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // SSN / ID numbers: e.g. 123-45-6789 or 123456789
  { pattern: /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g, replacement: "[ID]" },
  // Phone numbers: various formats
  {
    pattern: /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    replacement: "[PHONE]",
  },
  // Email addresses
  { pattern: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, replacement: "[EMAIL]" },
  // Dollar amounts and salary figures
  {
    pattern: /\$\s?\d{1,3}(?:[,\s]?\d{3})*(?:\.\d{2})?(?:\s?(?:k|K|thousand|million|\/hr|\/hour|\/year|per\s+hour|per\s+year|per\s+annum|pa|annually))?/g,
    replacement: "[COMPENSATION]",
  },
  // Salary mentioned as a number with k/K
  { pattern: /\b\d{2,3}[kK]\b/g, replacement: "[COMPENSATION]" },
  // Date of birth patterns
  {
    pattern: /\b(?:dob|date of birth|born on|born)[\s:]+\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/gi,
    replacement: "[DOB]",
  },
  { pattern: /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}\b/g, replacement: "[DATE]" },
];

/**
 * Substitutes known PII tokens in a single message body.
 * Runs regex passes sequentially so earlier patterns don't interfere with later ones.
 */
export function sanitizeBody(text: string, knownNames: string[] = []): string {
  if (!text) return "";

  let result = text;

  // Apply PII regex patterns first
  for (const { pattern, replacement } of PII_PATTERNS) {
    result = result.replace(pattern, replacement);
  }

  // Name substitution: known recruiter/team names → [RECRUITER] or [PERSON]
  // Candidate names (unknown proper nouns in recruiting context) → [CANDIDATE]
  if (knownNames.length > 0) {
    for (const name of knownNames) {
      if (!name || name.length < 2) continue;
      const parts = name.trim().split(/\s+/);
      for (const part of parts) {
        if (part.length < 2) continue;
        const escaped = part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const re = new RegExp(`\\b${escaped}\\b`, "gi");
        result = result.replace(re, "[RECRUITER]");
      }
    }
  }

  // Heuristic: capitalised two-word sequences that survived PII passes → [CANDIDATE]
  // e.g. "John Smith", "Sarah O'Brien"
  result = result.replace(/\b([A-Z][a-z]{1,20})\s+([A-Z][a-z]{1,20})\b/g, "[CANDIDATE]");

  return result;
}

/**
 * Sanitize a full thread (array of messages) and return a single anonymised text block.
 */
export function sanitizeThread(messages: SmsMessage[], knownNames: string[] = []): string {
  return messages
    .map((m) => {
      const dir = m.direction === "inbound" ? "CANDIDATE" : "RECRUITER";
      const body = sanitizeBody(m.body || "", knownNames);
      return `[${dir}]: ${body}`;
    })
    .join("\n");
}

/**
 * Generate a sanitised digest for a session and store it.
 * Uses OpenAI (via Replit AI Integrations) with a strict prompt.
 * The digest (not raw messages) is what is used for AI analytics.
 */
export async function generateDigest(
  sanitizedText: string,
  sessionId: string,
  date: string,
  db: any,
  sql: any,
): Promise<string> {
  if (!sanitizedText || sanitizedText.trim().length < 10) {
    const fallback = "Conversation too short to summarise.";
    await upsertDigest(sessionId, date, fallback, db, sql);
    return fallback;
  }

  try {
    const OpenAI = (await import("openai")).default;
    const client = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });

    const completion = await client.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 200,
      messages: [
        {
          role: "system",
          content:
            "You are a privacy-safe conversation summariser for a staffing firm. " +
            "Summarise the intent and tone of this anonymised recruiter-candidate SMS thread " +
            "in 2-3 sentences. Do NOT invent details. Do NOT include any names, phone numbers, " +
            "emails, or dollar amounts. Use only what is stated. Stay factual and brief.",
        },
        {
          role: "user",
          content: sanitizedText.slice(0, 4000),
        },
      ],
    });

    const digest = completion.choices?.[0]?.message?.content?.trim() ?? "Summary unavailable.";
    await upsertDigest(sessionId, date, digest, db, sql);
    return digest;
  } catch (err: any) {
    console.warn("[zoomSanitizer] Digest generation failed:", err?.message ?? err);
    const fallback = "Digest generation temporarily unavailable.";
    await upsertDigest(sessionId, date, fallback, db, sql);
    return fallback;
  }
}

async function upsertDigest(
  sessionId: string,
  date: string,
  digest: string,
  db: any,
  sql: any,
): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO zoom_sms_digests (session_id, date, sanitized_digest, sanitized_at)
      VALUES (${sessionId}, ${date}::date, ${digest}, NOW())
      ON CONFLICT (session_id, date) DO UPDATE
        SET sanitized_digest = EXCLUDED.sanitized_digest,
            sanitized_at = NOW()
    `);
  } catch (err) {
    console.warn("[zoomSanitizer] Digest upsert failed:", err);
  }
}
