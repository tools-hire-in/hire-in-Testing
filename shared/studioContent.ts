// Shared Content Studio metadata + read-time engine.
// Used by both the frontend (content-type picker, badges) and the backend
// (read-time computation on save). Keep this the single source of truth.

export interface StudioContentType {
  value: string;
  label: string;
  /** Inclusive lower bound of the read-time range, in minutes. */
  readMin: number;
  /** Inclusive upper bound of the read-time range, in minutes. */
  readMax: number;
  /** Short human label for the range, e.g. "1–2 min". */
  blurb: string;
  description: string;
}

export const STUDIO_CONTENT_TYPES: StudioContentType[] = [
  {
    value: "quick_take",
    label: "Quick Take",
    readMin: 1,
    readMax: 2,
    blurb: "1–2 min",
    description: "A punchy, single-point read.",
  },
  {
    value: "how_to",
    label: "How-To",
    readMin: 2,
    readMax: 3,
    blurb: "2–3 min",
    description: "A practical, step-by-step guide.",
  },
  {
    value: "insights",
    label: "Insights",
    readMin: 3,
    readMax: 4,
    blurb: "3–4 min",
    description: "An analytical take with supporting detail.",
  },
  {
    value: "deep_dive",
    label: "Deep Dive",
    readMin: 4,
    readMax: 5,
    blurb: "4–5 min",
    description: "A thorough, long-form exploration.",
  },
];

export const STUDIO_CONTENT_TYPE_MAP: Record<string, StudioContentType> =
  STUDIO_CONTENT_TYPES.reduce(
    (acc, t) => {
      acc[t.value] = t;
      return acc;
    },
    {} as Record<string, StudioContentType>,
  );

export function getStudioContentType(value?: string | null): StudioContentType | undefined {
  if (!value) return undefined;
  return STUDIO_CONTENT_TYPE_MAP[value];
}

const WORDS_PER_MINUTE = 200;

/** Count words in a Markdown body, stripping common markup so the count is fair. */
export function countWords(markdown?: string | null): number {
  if (!markdown) return 0;
  const text = markdown
    // remove fenced code blocks
    .replace(/```[\s\S]*?```/g, " ")
    // inline code
    .replace(/`[^`]*`/g, " ")
    // images / links -> keep link text only
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    // markdown punctuation
    .replace(/[#>*_~\-]+/g, " ")
    .trim();
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Compute read time in minutes from a word count, clamped to the content
 * type's allowed range. Falls back to a simple words/200 estimate (min 1)
 * for unknown content types.
 */
export function computeReadTimeFromWords(wordCount: number, contentType?: string | null): number {
  const raw = Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));
  const type = getStudioContentType(contentType);
  if (!type) return raw;
  return Math.min(type.readMax, Math.max(type.readMin, raw));
}

/** Convenience: compute read time directly from Markdown body. */
export function computeReadTime(markdown?: string | null, contentType?: string | null): number {
  return computeReadTimeFromWords(countWords(markdown), contentType);
}
