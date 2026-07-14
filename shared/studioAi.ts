// Content Studio — AI generation canonical schemas, guardrails, and mapping.
//
// Single source of truth shared by the backend (aiDraftService, routes, seed)
// and the frontend (Generate modal, Social Kit tab). Everything the AI engine
// produces is normalized into ONE canonical shape so the UI handles a single
// structure rather than one shape per prompt.

import { z } from "zod";

// ---------------------------------------------------------------------------
// Compliance modes — layered on top of the universal Super Admin publish gate.
// ---------------------------------------------------------------------------
export const COMPLIANCE_MODES = [
  {
    value: "normal",
    label: "Normal",
    blurb: "Standard brand guardrails.",
    // The gated LLM quality-reviewer pass runs only when this is false.
    requiresQualityReview: false,
    blocksPublishOnRiskFlags: false,
  },
  {
    value: "healthcare_safe",
    label: "Healthcare-safe",
    blurb: "No clinical/outcome claims; risk flags block publish.",
    requiresQualityReview: true,
    blocksPublishOnRiskFlags: true,
  },
  {
    value: "public_sector_safe",
    label: "Public-sector-safe",
    blurb: "Government/credentialing tone; risk flags block publish.",
    requiresQualityReview: true,
    blocksPublishOnRiskFlags: true,
  },
  {
    value: "no_claims",
    label: "No-claims",
    blurb: "Strips guarantees and superlatives.",
    requiresQualityReview: true,
    blocksPublishOnRiskFlags: false,
  },
  {
    value: "source_required",
    label: "Source-required",
    blurb: "Every stat must cite a source; flags block publish.",
    requiresQualityReview: true,
    blocksPublishOnRiskFlags: true,
  },
] as const;

export type ComplianceMode = (typeof COMPLIANCE_MODES)[number]["value"];

export const COMPLIANCE_MODE_MAP = COMPLIANCE_MODES.reduce(
  (acc, m) => {
    acc[m.value] = m;
    return acc;
  },
  {} as Record<string, (typeof COMPLIANCE_MODES)[number]>,
);

export function getComplianceMode(value?: string | null) {
  return COMPLIANCE_MODE_MAP[value ?? "normal"] ?? COMPLIANCE_MODE_MAP.normal;
}

/** Hard guardrail block injected into every prompt for a given compliance mode. */
export const COMPLIANCE_BLOCKS: Record<string, string> = {
  normal:
    "Brand-safety rules: never invent statistics, named clients, or outcome figures. Do not use AI-hype language. Keep claims defensible.",
  healthcare_safe:
    "HEALTHCARE COMPLIANCE: Do NOT state or imply clinical outcomes, patient-safety guarantees, credentialing guarantees, or staffing-fill guarantees. Never invent statistics or named facilities. If a clinical or compliance claim is needed, set source_verification_needed=true and add a risk_flag instead of asserting it.",
  public_sector_safe:
    "PUBLIC-SECTOR COMPLIANCE: Avoid contract-award, set-aside, clearance, or credentialing guarantees. No political language. Never invent statistics, agency names, or compliance certifications; flag them for human verification instead.",
  no_claims:
    "NO-CLAIMS MODE: Remove all guarantees, superlatives ('best', 'leading', '#1'), and unverifiable performance claims. Use measured, descriptive language only.",
  source_required:
    "SOURCE-REQUIRED MODE: Every statistic or factual claim MUST be attributable to a source the user supplied. If a number is not in the provided source notes, do not state it — set source_verification_needed=true and add a risk_flag.",
};

// ---------------------------------------------------------------------------
// Industry modifier blocks.
// ---------------------------------------------------------------------------
export const INDUSTRY_MODIFIERS: Record<string, string> = {
  healthcare:
    "Industry: Healthcare staffing. Audience values compliance, credentialing rigor, patient-care continuity, and reliable shift coverage. Avoid clinical claims.",
  it: "Industry: IT staffing. Audience values speed-to-hire, niche tech skills, contract flexibility, and vetted technical talent.",
  government:
    "Industry: Government / public sector. Audience values compliance, clearances, accountability, and process integrity. Avoid guarantees.",
  non_it:
    "Industry: Non-IT professional services. Audience values domain expertise, reliability, and scalable workforce solutions.",
  hr_tech:
    "Industry: HR technology. Audience values workflow efficiency, data-driven hiring, and integration with existing HR stacks.",
  rayomind:
    "Industry: Rayomind training / upskilling. Audience values learning outcomes, skill readiness, and career growth.",
  food: "Industry: Food / hospitality staffing. Audience values reliability, compliance, and fast coverage for shift-based roles.",
};

export function getIndustryModifier(industry?: string | null): string {
  if (!industry) return "";
  return INDUSTRY_MODIFIERS[industry] ?? "";
}

// ---------------------------------------------------------------------------
// Platform character limits (injected before the call, validated on receipt).
// ---------------------------------------------------------------------------
export const PLATFORM_LIMITS = {
  linkedin: { min: 900, max: 1600, label: "LinkedIn" },
  instagram: { min: 600, max: 1200, label: "Instagram" },
  facebook: { min: 500, max: 1000, label: "Facebook" },
  twitter: { min: 0, max: 260, label: "X (Twitter)" },
  story: { minWords: 8, maxWords: 12, label: "Story frame" },
} as const;

export type SocialPlatform = "linkedin" | "instagram" | "facebook" | "twitter";

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  "linkedin",
  "instagram",
  "facebook",
  "twitter",
];

// ---------------------------------------------------------------------------
// Per-content-type word counts for long-form generation.
// ---------------------------------------------------------------------------
export const CONTENT_TYPE_WORD_RANGES: Record<string, { min: number; max: number }> = {
  quick_take: { min: 300, max: 400 },
  how_to: { min: 500, max: 700 },
  insights: { min: 700, max: 1000 },
  deep_dive: { min: 1000, max: 1300 },
};

export function getWordRange(contentType?: string | null) {
  return CONTENT_TYPE_WORD_RANGES[contentType ?? "insights"] ?? CONTENT_TYPE_WORD_RANGES.insights;
}

// ---------------------------------------------------------------------------
// Visual template handshake — maps the AI's suggested_visual_template to the
// social card engine's `layout` (Tasks #432/#435).
// ---------------------------------------------------------------------------
export const VISUAL_TEMPLATES = [
  "quote_card",
  "checklist_card",
  "thought_leadership_landscape",
  "healthcare_staffing_story_or_square",
  "stat_highlight",
  "tips_carousel",
] as const;

export type VisualTemplate = (typeof VISUAL_TEMPLATES)[number];

/** suggested_visual_template -> card engine `layout`. */
export const VISUAL_TEMPLATE_TO_LAYOUT: Record<string, string> = {
  quote_card: "quote",
  checklist_card: "checklist",
  thought_leadership_landscape: "landscape",
  healthcare_staffing_story_or_square: "story_square",
  stat_highlight: "stat",
  tips_carousel: "carousel",
};

export function visualTemplateToLayout(template?: string | null): string {
  if (!template) return "landscape";
  return VISUAL_TEMPLATE_TO_LAYOUT[template] ?? "landscape";
}

// ---------------------------------------------------------------------------
// Master parameter set — every template renders against this.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Marketing Intelligence Layer v1.5 types
// ---------------------------------------------------------------------------
// Canonical v2.1 slugs. Legacy aliases (CANDIDATE, MSP_VMS_PARTNER) kept for
// read compat with existing DB rows; normalization happens at buildArticleParams.
export type MarketingAudience =
  | 'EMPLOYER_CLIENT'
  | 'CANDIDATE_PROFESSIONAL'
  | 'MSP_STAFFING_PARTNER'
  | 'RECRUITER_OPERATOR'
  // Legacy — normalize on read, never write
  | 'CANDIDATE'
  | 'MSP_VMS_PARTNER'
  | 'AUTO';
export type StaffingDomain = 'GENERAL_STAFFING' | 'IT_STAFFING' | 'HEALTHCARE_STAFFING';
export type MarketContext = 'COMMERCIAL' | 'STATE_GOVERNMENT' | 'FEDERAL_GOVERNMENT';
export type ContentGoal = 'THOUGHT_LEADERSHIP' | 'EDUCATIONAL' | 'JOB_MARKETING' | 'BRAND_PERSPECTIVE';
export type PublishPlatform = 'ARTICLE' | 'LINKEDIN' | 'FACEBOOK' | 'INSTAGRAM' | 'X';

export interface AiGenerationParams {
  brand_name?: string;
  brand_tagline?: string;
  brand_voice?: string;
  industry?: string;
  content_type?: string;
  platform?: string;
  article_title?: string;
  article_summary?: string;
  article_body?: string;
  topic?: string;
  target_audience?: string;
  author_name?: string;
  author_title?: string;
  key_points?: string;
  source_notes?: string;
  cta_url?: string;
  cta_text?: string;
  visual_template?: string;
  tone?: string;
  desired_length?: string;
  compliance_mode?: string;
  // Free-text raw idea/notes/draft for "Shape my idea / draft" mode.
  raw_input?: string;
  // Marketing Intelligence Layer v1.5 fields
  contentGoal?: ContentGoal;
  audience?: MarketingAudience;
  marketContext?: MarketContext;
  userSuppliedFacts?: string;
  // CMO Copilot v2.1 — selected hook from brief resolution
  selectedHookText?: string;
  selectedHookArchetype?: string;
  selectedContentStructure?: string;
  // Psychological brief (Task #1060) — author-chosen brief fields
  desiredEmotion?: string;
  hookPattern?: string;
  contentStructure?: string;
  engagementGoal?: string;
  // Past performance signal — best-performing entry injected from studio_post_performance
  pastPerformanceSignal?: string;
}

// ---------------------------------------------------------------------------
// Brand Voice Hub (Studio T2) — per-project voice config stored in
// studio_projects.brand_voice_config. Resolution order in aiDraftService:
// platforms[channel] merged over default merged over DEFAULT_BRAND.
// ---------------------------------------------------------------------------
export const BRAND_VOICE_FRAMEWORKS = ["none", "aida", "pas", "bab"] as const;

export const brandVoicePlatformOverrideSchema = z.object({
  tone: z.array(z.string()).optional(),
  signaturePhrases: z.array(z.string()).optional(),
});

export const brandVoiceDefaultSchema = z.object({
  tone: z.array(z.string()).optional(),
  guardrails: z.array(z.string()).optional(),
  bannedPhrases: z.array(z.string()).optional(),
  signaturePhrases: z.array(z.string()).optional(),
  icpOneLiner: z.string().optional(),
  brandPromise: z.string().optional(),
  ctaStyle: z.string().optional(),
  complianceNotes: z.string().optional(),
  defaultFramework: z.string().optional(),
});

export const brandVoiceConfigSchema = z.object({
  default: brandVoiceDefaultSchema.optional(),
  platforms: z.record(z.string(), brandVoicePlatformOverrideSchema).optional(),
});

export type BrandVoiceConfig = z.infer<typeof brandVoiceConfigSchema>;
export type BrandVoiceDefault = z.infer<typeof brandVoiceDefaultSchema>;

/** Resolved brand voice handed to prompt rendering as flat params. */
export interface ResolvedBrandVoice {
  brand_name: string;
  brand_tagline: string;
  brand_voice: string;
}

/**
 * Merge a project's brandVoiceConfig (+ optional channel override) over the
 * system DEFAULT_BRAND into the flat prompt params. Pure — usable client-side
 * for preview and server-side for generation.
 */
export function composeBrandVoice(
  brandName: string | undefined,
  tagline: string | undefined,
  config: BrandVoiceConfig | null | undefined,
  channel?: string | null,
): ResolvedBrandVoice {
  const base = config?.default ?? {};
  const override = channel && config?.platforms ? config.platforms[channel] : undefined;
  const tone = override?.tone?.length ? override.tone : base.tone;
  const signature = override?.signaturePhrases?.length
    ? override.signaturePhrases
    : base.signaturePhrases;

  const parts: string[] = [];
  if (tone?.length) parts.push(`Tone: ${tone.join(", ")}.`);
  if (base.guardrails?.length) parts.push(`Guardrails: ${base.guardrails.join("; ")}.`);
  if (base.bannedPhrases?.length) parts.push(`Never use these phrases: ${base.bannedPhrases.join(", ")}.`);
  if (signature?.length) parts.push(`Signature phrases to weave in naturally: ${signature.join(" | ")}.`);
  if (base.icpOneLiner) parts.push(`Ideal customer profile: ${base.icpOneLiner}.`);
  if (base.brandPromise) parts.push(`Brand promise: ${base.brandPromise}.`);
  if (base.ctaStyle) parts.push(`CTA style: ${base.ctaStyle}.`);
  if (base.complianceNotes) parts.push(`Compliance notes: ${base.complianceNotes}.`);
  if (base.defaultFramework && base.defaultFramework !== "none") {
    parts.push(`Structure copy using the ${base.defaultFramework.toUpperCase()} framework.`);
  }

  return {
    brand_name: brandName || DEFAULT_BRAND.brand_name,
    brand_tagline: tagline || DEFAULT_BRAND.brand_tagline,
    brand_voice: parts.length ? parts.join(" ") : DEFAULT_BRAND.brand_voice,
  };
}

export const DEFAULT_BRAND = {
  brand_name: "Hire'in Solutions",
  brand_tagline: "AI-powered recruitment for Healthcare, IT, Engineering & Professional Services",
  brand_voice:
    "Professional, warm, credible, and practical. Confident without hype. Speaks plainly to recruiters, candidates, and employers.",
};

// ---------------------------------------------------------------------------
// Canonical ARTICLE DRAFT schema.
// ---------------------------------------------------------------------------
export const canonicalArticleDraftSchema = z.object({
  title: z.string(),
  slug: z.string(),
  meta_title: z.string(),
  meta_description: z.string(),
  excerpt: z.string(),
  body_markdown: z.string(),
  key_takeaways: z.array(z.string()),
  recommended_reviewer_role: z.string(),
  source_verification_needed: z.boolean(),
  cta_text: z.string(),
  cta_url: z.string(),
  // Only populated in "Shape my idea / draft" mode.
  what_changed: z.string().optional().default(""),
  // CMO Copilot v2.1 — AI reports which hook archetype it used.
  hook_archetype_used: z.string().optional().default(""),
});

export type CanonicalArticleDraft = z.infer<typeof canonicalArticleDraftSchema>;

// ---------------------------------------------------------------------------
// Canonical SOCIAL KIT schema.
// ---------------------------------------------------------------------------
export const canonicalCaptionSchema = z.object({
  platform: z.string(),
  text: z.string(),
  variants: z.array(z.string()).optional().default([]),
});

export const canonicalSocialKitSchema = z.object({
  captions: z.array(canonicalCaptionSchema),
  thread: z.array(z.string()).optional().default([]),
  story_frames: z.array(z.string()).optional().default([]),
  quote_card_text: z.string().optional().default(""),
  checklist_card_items: z.array(z.string()).optional().default([]),
  hashtags: z.record(z.string(), z.array(z.string())).optional().default({}),
  suggested_visual_template: z.string().optional().default("thought_leadership_landscape"),
  suggested_card_layout: z.string().optional().default("landscape"),
  suggested_category_badge: z.string().optional().default(""),
  quality_notes: z
    .object({
      risk_flags: z.array(z.string()).optional().default([]),
      needs_human_review: z.boolean().optional().default(false),
      suggested_reviewer_role: z.string().optional().default(""),
      brand_fit_score: z.number().optional().default(0),
    })
    .optional()
    .default({
      risk_flags: [],
      needs_human_review: false,
      suggested_reviewer_role: "",
      brand_fit_score: 0,
    }),
});

export type CanonicalSocialKit = z.infer<typeof canonicalSocialKitSchema>;

// ---------------------------------------------------------------------------
// Quality reviewer schema (gated pass).
// ---------------------------------------------------------------------------
export const qualityReviewSchema = z.object({
  approved_for_human_review: z.boolean(),
  risk_flags: z.array(z.string()),
  required_edits: z.array(z.string()),
  quality_scores: z.object({
    brand_fit: z.number(),
    clarity: z.number(),
    compliance: z.number(),
    accuracy: z.number(),
  }),
});

export type QualityReview = z.infer<typeof qualityReviewSchema>;

// ---------------------------------------------------------------------------
// JSON Schemas for OpenAI Structured Outputs (response_format json_schema).
// strict mode requires every property listed in `required` and
// additionalProperties:false.
// ---------------------------------------------------------------------------
export const ARTICLE_DRAFT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    slug: { type: "string" },
    meta_title: { type: "string" },
    meta_description: { type: "string" },
    excerpt: { type: "string" },
    body_markdown: { type: "string", description: "Full article in Markdown with H2 (##) section headings." },
    key_takeaways: { type: "array", items: { type: "string" } },
    recommended_reviewer_role: { type: "string" },
    source_verification_needed: { type: "boolean" },
    cta_text: { type: "string" },
    cta_url: { type: "string" },
    what_changed: {
      type: "string",
      description: "In shape-my-draft mode: summary of structural/voice changes. Otherwise empty string.",
    },
  },
  required: [
    "title",
    "slug",
    "meta_title",
    "meta_description",
    "excerpt",
    "body_markdown",
    "key_takeaways",
    "recommended_reviewer_role",
    "source_verification_needed",
    "cta_text",
    "cta_url",
    "what_changed",
  ],
} as const;

export const SOCIAL_KIT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    captions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          platform: {
            type: "string",
            enum: ["linkedin", "instagram", "facebook", "twitter"],
          },
          text: { type: "string" },
          variants: { type: "array", items: { type: "string" } },
        },
        required: ["platform", "text", "variants"],
      },
    },
    thread: { type: "array", items: { type: "string" } },
    story_frames: {
      type: "array",
      items: { type: "string" },
      description: "8-12 words each, overlay frames for a Story.",
    },
    quote_card_text: { type: "string" },
    checklist_card_items: { type: "array", items: { type: "string" } },
    hashtags: {
      type: "object",
      additionalProperties: false,
      properties: {
        linkedin: { type: "array", items: { type: "string" } },
        instagram: { type: "array", items: { type: "string" } },
        facebook: { type: "array", items: { type: "string" } },
        twitter: { type: "array", items: { type: "string" } },
      },
      required: ["linkedin", "instagram", "facebook", "twitter"],
    },
    suggested_visual_template: {
      type: "string",
      enum: [...VISUAL_TEMPLATES],
    },
    suggested_category_badge: { type: "string" },
    quality_notes: {
      type: "object",
      additionalProperties: false,
      properties: {
        risk_flags: { type: "array", items: { type: "string" } },
        needs_human_review: { type: "boolean" },
        suggested_reviewer_role: { type: "string" },
        brand_fit_score: { type: "number" },
      },
      required: ["risk_flags", "needs_human_review", "suggested_reviewer_role", "brand_fit_score"],
    },
  },
  required: [
    "captions",
    "thread",
    "story_frames",
    "quote_card_text",
    "checklist_card_items",
    "hashtags",
    "suggested_visual_template",
    "suggested_category_badge",
    "quality_notes",
  ],
} as const;

export const QUALITY_REVIEW_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    approved_for_human_review: { type: "boolean" },
    risk_flags: { type: "array", items: { type: "string" } },
    required_edits: { type: "array", items: { type: "string" } },
    quality_scores: {
      type: "object",
      additionalProperties: false,
      properties: {
        brand_fit: { type: "number" },
        clarity: { type: "number" },
        compliance: { type: "number" },
        accuracy: { type: "number" },
      },
      required: ["brand_fit", "clarity", "compliance", "accuracy"],
    },
  },
  required: ["approved_for_human_review", "risk_flags", "required_edits", "quality_scores"],
} as const;

// ---------------------------------------------------------------------------
// Mapping layer — normalize each prompt's raw JSON into the canonical shape.
// master_social_kit already returns close to canonical; specialized prompts
// (linkedin_thought_leadership, quote_card, checklist_card, etc.) return
// narrower shapes that we fold into the canonical object.
// ---------------------------------------------------------------------------

function asArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x) => typeof x === "string");
  if (typeof v === "string" && v.trim()) return [v.trim()];
  return [];
}

/** Map any prompt's raw output into the canonical Social Kit. */
export function mapToCanonicalSocialKit(raw: any, ctx?: { platform?: string }): CanonicalSocialKit {
  const r = raw ?? {};

  // Captions: accept canonical `captions[]`, or per-platform fields, or a
  // single `caption`/`text` from a specialized single-platform prompt.
  let captions: { platform: string; text: string; variants: string[] }[] = [];
  if (Array.isArray(r.captions)) {
    captions = r.captions.map((c: any) => ({
      platform: String(c.platform ?? ctx?.platform ?? "linkedin"),
      text: String(c.text ?? c.caption ?? ""),
      variants: asArray(c.variants),
    }));
  } else {
    for (const p of SOCIAL_PLATFORMS) {
      if (typeof r[p] === "string" && r[p].trim()) {
        captions.push({ platform: p, text: r[p], variants: [] });
      }
    }
    const single = r.caption ?? r.text ?? r.post;
    if (!captions.length && typeof single === "string" && single.trim()) {
      captions.push({ platform: ctx?.platform ?? "linkedin", text: single, variants: asArray(r.variants) });
    }
  }

  // Hashtags: accept a map, or a flat array applied to all platforms.
  let hashtags: Record<string, string[]> = {};
  if (r.hashtags && typeof r.hashtags === "object" && !Array.isArray(r.hashtags)) {
    for (const [k, v] of Object.entries(r.hashtags)) hashtags[k] = asArray(v);
  } else if (Array.isArray(r.hashtags)) {
    const flat = asArray(r.hashtags);
    for (const p of SOCIAL_PLATFORMS) hashtags[p] = flat;
  }

  const q = r.quality_notes ?? {};
  const suggestedTemplate = r.suggested_visual_template ?? r.visual_template ?? "thought_leadership_landscape";

  const candidate = {
    captions,
    thread: asArray(r.thread),
    story_frames: asArray(r.story_frames ?? r.story ?? r.story_overlay_frames),
    quote_card_text: String(r.quote_card_text ?? r.quote ?? r.quote_text ?? ""),
    checklist_card_items: asArray(r.checklist_card_items ?? r.checklist ?? r.checklist_items),
    hashtags,
    suggested_visual_template: String(suggestedTemplate),
    suggested_card_layout: visualTemplateToLayout(String(suggestedTemplate)),
    suggested_category_badge: String(r.suggested_category_badge ?? r.category_badge ?? ""),
    quality_notes: {
      risk_flags: asArray(q.risk_flags),
      needs_human_review: Boolean(q.needs_human_review),
      suggested_reviewer_role: String(q.suggested_reviewer_role ?? ""),
      brand_fit_score: Number(q.brand_fit_score ?? q.brand_fit ?? 0) || 0,
    },
  };

  return canonicalSocialKitSchema.parse(candidate);
}

/** Map raw article output into the canonical article draft. */
export function mapToCanonicalArticleDraft(raw: any): CanonicalArticleDraft {
  const r = raw ?? {};
  const candidate = {
    title: String(r.title ?? ""),
    slug: String(r.slug ?? ""),
    meta_title: String(r.meta_title ?? r.seo_title ?? r.title ?? ""),
    meta_description: String(r.meta_description ?? r.seo_description ?? r.excerpt ?? ""),
    excerpt: String(r.excerpt ?? r.summary ?? ""),
    body_markdown: String(r.body_markdown ?? r.body ?? r.content ?? ""),
    key_takeaways: asArray(r.key_takeaways ?? r.takeaways),
    recommended_reviewer_role: String(r.recommended_reviewer_role ?? "reviewer"),
    source_verification_needed: Boolean(r.source_verification_needed),
    cta_text: String(r.cta_text ?? r.cta?.text ?? ""),
    cta_url: String(r.cta_url ?? r.cta?.url ?? ""),
    what_changed: String(r.what_changed ?? ""),
    hook_archetype_used: String(r.hook_archetype_used ?? ""),
  };
  return canonicalArticleDraftSchema.parse(candidate);
}

// ---------------------------------------------------------------------------
// CMO Copilot v2.1 — Resolved Brief + Hook types
// ---------------------------------------------------------------------------

export interface HookOption {
  text: string;
  archetype: string;
  rationale: string;
  contentStructure: string;
}

export interface ResolvedBrief {
  audienceResolved: string;      // canonical v2.1 slug
  audienceQuestion: string;      // real decision/tension the audience faces
  domain: string;                // GENERAL_STAFFING | IT_STAFFING | HEALTHCARE_STAFFING
  marketContext: string;         // COMMERCIAL | STATE_GOVERNMENT | FEDERAL_GOVERNMENT
  contentGoal: string;           // THOUGHT_LEADERSHIP | EDUCATIONAL | JOB_MARKETING | BRAND_PERSPECTIVE
  businessObjective: string;
  singleTakeaway: string;
  sourceType: string;            // USER_PROVIDED | JOB_RECORD | RECRUITER_DELIVERY_NOTE | CANDIDATE_QUESTION | LEADERSHIP_POV | APPROVED_INTERNAL_MATERIAL | GENERAL_EDUCATIONAL_CONTEXT | NONE
  sourceSummary: string;
  readerAction: string;          // what should become easier after reading
  platform: string;              // ARTICLE | LINKEDIN | INSTAGRAM | FACEBOOK | X | SOCIAL_KIT
  hookOptions: HookOption[];     // exactly 3
  recommendedHookIndex: number;  // 0-2
  recommendedHookRationale: string;
}

/** JSON Schema for structured AI brief resolution (enforced by response_format). */
export const RESOLVED_BRIEF_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "audienceResolved", "audienceQuestion", "domain", "marketContext",
    "contentGoal", "businessObjective", "singleTakeaway",
    "sourceType", "sourceSummary", "readerAction", "platform",
    "hookOptions", "recommendedHookIndex", "recommendedHookRationale",
  ],
  properties: {
    audienceResolved: { type: "string", enum: ["EMPLOYER_CLIENT", "CANDIDATE_PROFESSIONAL", "MSP_STAFFING_PARTNER", "RECRUITER_OPERATOR"] },
    audienceQuestion: { type: "string" },
    domain: { type: "string", enum: ["GENERAL_STAFFING", "IT_STAFFING", "HEALTHCARE_STAFFING"] },
    marketContext: { type: "string", enum: ["COMMERCIAL", "STATE_GOVERNMENT", "FEDERAL_GOVERNMENT"] },
    contentGoal: { type: "string", enum: ["THOUGHT_LEADERSHIP", "EDUCATIONAL", "JOB_MARKETING", "BRAND_PERSPECTIVE"] },
    businessObjective: { type: "string" },
    singleTakeaway: { type: "string" },
    sourceType: { type: "string", enum: ["USER_PROVIDED", "JOB_RECORD", "RECRUITER_DELIVERY_NOTE", "CANDIDATE_QUESTION", "LEADERSHIP_POV", "APPROVED_INTERNAL_MATERIAL", "GENERAL_EDUCATIONAL_CONTEXT", "NONE"] },
    sourceSummary: { type: "string" },
    readerAction: { type: "string" },
    platform: { type: "string", enum: ["ARTICLE", "LINKEDIN", "INSTAGRAM", "FACEBOOK", "X", "SOCIAL_KIT"] },
    hookOptions: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "archetype", "rationale", "contentStructure"],
        properties: {
          text: { type: "string" },
          archetype: { type: "string" },
          rationale: { type: "string" },
          contentStructure: { type: "string" },
        },
      },
    },
    recommendedHookIndex: { type: "integer", minimum: 0, maximum: 2 },
    recommendedHookRationale: { type: "string" },
  },
};

/** Validate caption lengths against platform limits; returns warnings. */
export function validateCaptionLengths(kit: CanonicalSocialKit): string[] {
  const warnings: string[] = [];
  for (const c of kit.captions) {
    const limit = (PLATFORM_LIMITS as any)[c.platform];
    if (!limit || limit.min === undefined) continue;
    const len = c.text.length;
    if (len > limit.max) {
      warnings.push(`${limit.label} caption is ${len} chars (max ${limit.max}).`);
    } else if (limit.min && len < limit.min) {
      warnings.push(`${limit.label} caption is ${len} chars (min ${limit.min}).`);
    }
  }
  for (const frame of kit.story_frames) {
    const words = frame.trim().split(/\s+/).filter(Boolean).length;
    if (words > PLATFORM_LIMITS.story.maxWords) {
      warnings.push(`A story frame has ${words} words (max ${PLATFORM_LIMITS.story.maxWords}).`);
    }
  }
  return warnings;
}
