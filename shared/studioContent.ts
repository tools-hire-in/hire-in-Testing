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

// ── Pipeline content architecture (Studio T1) ───────────────────────────────
// Three separate axes on every planned idea:
//   contentType — deliverable format + workflow schema (article | social_post | story)
//   channels    — multi-select distribution surfaces
//   pillar      — topic/category balance
// The read-time types above (quick_take/how_to/insights/deep_dive) remain as
// presentation metadata for the Article family only.

export const STUDIO_CHANNELS = [
  "linkedin",
  "instagram",
  "facebook",
  "x",
  "website",
] as const;
export type StudioChannel = (typeof STUDIO_CHANNELS)[number];

export interface StudioPipelineContentType {
  value: string;
  label: string;
  /** editorial (long-form, promotes to article) or social (social kit flow). */
  family: "editorial" | "social";
  /** When true, publish is blocked until a complete author byline is assigned. */
  bylineRequired: boolean;
  /** Channels this deliverable can be distributed on. */
  channels: StudioChannel[];
  description: string;
}

export const STUDIO_PIPELINE_CONTENT_TYPES: StudioPipelineContentType[] = [
  {
    value: "article",
    label: "Article",
    family: "editorial",
    bylineRequired: true,
    channels: ["website", "linkedin"],
    description: "Long-form editorial content that publishes to Insights.",
  },
  {
    value: "social_post",
    label: "Social Post",
    family: "social",
    bylineRequired: false,
    channels: ["linkedin", "instagram", "facebook", "x"],
    description: "A standalone social feed post (caption + creative).",
  },
  {
    value: "story",
    label: "Story",
    family: "social",
    bylineRequired: false,
    channels: ["instagram", "facebook"],
    description: "An ephemeral story frame (vertical creative).",
  },
];

export const STUDIO_PIPELINE_CONTENT_TYPE_MAP: Record<string, StudioPipelineContentType> =
  STUDIO_PIPELINE_CONTENT_TYPES.reduce(
    (acc, t) => {
      acc[t.value] = t;
      return acc;
    },
    {} as Record<string, StudioPipelineContentType>,
  );

export function getPipelineContentType(value?: string | null): StudioPipelineContentType | undefined {
  if (!value) return undefined;
  return STUDIO_PIPELINE_CONTENT_TYPE_MAP[value];
}

/**
 * Whether a studio_articles record's publish requires a complete author
 * byline. Driven by the pipeline content-type config: only the Article
 * (editorial) family has bylineRequired=true. The editorial read-time
 * subtypes (quick_take/how_to/insights/deep_dive), the legacy "article"
 * value, and an unset content type all belong to the Article family.
 * Social-family records (social_post/story — created by the Social Kit
 * promote bridge) are never author-gated.
 */
export function articleBylineRequired(contentType?: string | null): boolean {
  const cfg = getPipelineContentType(contentType);
  if (cfg) return cfg.bylineRequired;
  // Editorial subtypes / legacy "article" / unset → Article family.
  // Unknown values fail safe (byline required).
  return true;
}

/**
 * Valid values for studio_articles.content_type: the editorial read-time
 * subtypes, the legacy default "article", plus the social-family values
 * (social_post/story) that the Social Kit promote bridge creates. Server
 * returns 400 invalid_content_type for anything else.
 */
export const VALID_ARTICLE_CONTENT_TYPES: string[] = [
  "article",
  ...STUDIO_CONTENT_TYPES.map((t) => t.value),
  ...STUDIO_PIPELINE_CONTENT_TYPES.filter((t) => t.family === "social").map((t) => t.value),
];

export function isValidArticleContentType(value?: string | null): boolean {
  if (!value) return false;
  return VALID_ARTICLE_CONTENT_TYPES.includes(value);
}

// ── Idea pipeline state machine ──────────────────────────────────────────────
export const STUDIO_IDEA_STATUSES = [
  "suggested",
  "idea",
  "in_review",
  "changes_requested",
  "approved",
  "in_production",
  "scheduled",
  "published",
  "done",
  "rejected",
] as const;
export type StudioIdeaStatus = (typeof STUDIO_IDEA_STATUSES)[number];

/** from → allowed next states. Server validates every transition. */
export const STUDIO_IDEA_TRANSITIONS: Record<StudioIdeaStatus, StudioIdeaStatus[]> = {
  suggested: ["idea", "rejected"],
  idea: ["in_review", "rejected"],
  in_review: ["approved", "changes_requested", "rejected"],
  changes_requested: ["in_review", "idea", "rejected"],
  approved: ["in_production", "scheduled", "published", "rejected"],
  in_production: ["scheduled", "published", "done"],
  scheduled: ["published", "in_production", "done"],
  published: ["done"],
  done: [],
  rejected: ["idea"], // recyclable
};

export function isValidIdeaStatus(value?: string | null): value is StudioIdeaStatus {
  return !!value && (STUDIO_IDEA_STATUSES as readonly string[]).includes(value);
}

export function isValidIdeaTransition(from: string, to: string): boolean {
  if (!isValidIdeaStatus(from) || !isValidIdeaStatus(to)) return false;
  return STUDIO_IDEA_TRANSITIONS[from].includes(to);
}

export const STUDIO_IDEA_ORIGINS = ["manual", "import", "ai", "repurposed"] as const;

// ── Studio T2: campaign taxonomy ─────────────────────────────────────────────
export const STUDIO_CAMPAIGN_STATUSES = ["draft", "active", "paused", "completed"] as const;
export type StudioCampaignStatus = (typeof STUDIO_CAMPAIGN_STATUSES)[number];

export const STUDIO_FUNNEL_STAGES = ["awareness", "consideration", "decision"] as const;
export type StudioFunnelStage = (typeof STUDIO_FUNNEL_STAGES)[number];

export const STUDIO_OUTREACH_TYPES = ["linkedin", "email"] as const;
export const STUDIO_OUTREACH_STATUSES = ["draft", "approved", "archived"] as const;

export interface StudioOutreachStep {
  order: number;
  subjectOrHook: string;
  body: string;
  notes?: string;
}

export const STUDIO_PILLARS = [
  "healthcare_staffing",
  "it_staffing",
  "candidate_tips",
  "employer_insights",
  "company_culture",
  "industry_news",
] as const;

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
