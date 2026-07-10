// ---------------------------------------------------------------------------
// Content Studio — Social Card Engine (Task #432)
// Shared, dependency-free helpers used by both the render service and the UI:
//   - the layout/platform matrix
//   - the (content_type -> layout) resolver
//   - the brand/article -> template variable contract
//   - a tiny Mustache-style template renderer ({{var}}, {{#section}}, {{#list}})
// The actual PNG rasterisation (Chromium/Puppeteer) lives server-side.
// ---------------------------------------------------------------------------

export const CARD_LAYOUTS = [
  "standard",
  "checklist",
  "quote",
  // Social Kit creative layouts (Task #915)
  "hook",
  "stat",
  "story-frame",
] as const;
export type CardLayout = (typeof CARD_LAYOUTS)[number];

export const CARD_PLATFORMS = [
  "linkedin",
  "instagram-square",
  "instagram-story",
  "twitter",
] as const;
export type CardPlatform = (typeof CARD_PLATFORMS)[number];

export const DEFAULT_TEMPLATE_FAMILY = "hirein-v1";

// Which platforms each layout actually ships a template for. The engine skips
// any (layout, platform) combination not listed here.
export const LAYOUT_PLATFORMS: Record<CardLayout, CardPlatform[]> = {
  standard: ["linkedin", "instagram-square", "instagram-story", "twitter"],
  checklist: ["linkedin", "instagram-square"],
  quote: ["linkedin", "instagram-square", "twitter"],
  hook: ["linkedin", "instagram-square"],
  stat: ["linkedin", "instagram-square"],
  "story-frame": ["instagram-story"],
};

// Layouts offered when generating creative cards for a Social idea (Task #915).
// The engine picks platforms per layout from LAYOUT_PLATFORMS, filtered by the
// idea's channels where known.
export const SOCIAL_IDEA_LAYOUTS: CardLayout[] = ["hook", "quote", "stat", "story-frame"];

export function isCardLayout(value: unknown): value is CardLayout {
  return typeof value === "string" && (CARD_LAYOUTS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Layout resolution. A per-article override always wins (when valid); otherwise
// the article's content type picks a sensible default. Anything unknown falls
// back to the "standard" layout, which exists for every platform.
// ---------------------------------------------------------------------------
const CONTENT_TYPE_TO_LAYOUT: Record<string, CardLayout> = {
  how_to: "checklist",
  listicle: "checklist",
  playbook: "checklist",
  checklist: "checklist",
  checklist_card: "checklist",
  quote: "quote",
  pull_quote: "quote",
  quick_take: "quote",
  quote_card: "quote",
};

export function resolveCardLayout(
  contentType?: string | null,
  override?: string | null,
): CardLayout {
  if (isCardLayout(override)) return override;
  if (contentType && CONTENT_TYPE_TO_LAYOUT[contentType]) {
    return CONTENT_TYPE_TO_LAYOUT[contentType];
  }
  return "standard";
}

// Every (layout, platform) combination that should be rendered for an article.
export function cardVariantsForLayout(
  layout: CardLayout,
): Array<{ layout: CardLayout; platform: CardPlatform }> {
  return LAYOUT_PLATFORMS[layout].map((platform) => ({ layout, platform }));
}

// ---------------------------------------------------------------------------
// Recommended copy budgets (chars) — surfaced in the UI as soft warnings. These
// mirror templates/social-cards/hirein-v1/CHARACTER_BUDGET.md. Overflow is safe
// (CSS line-clamp truncates) but going over risks an ellipsis.
// ---------------------------------------------------------------------------
export interface CardBudget {
  title?: number;
  supporting?: number;
  category?: number;
  quote?: number;
  tipTitle?: number;
  tipDesc?: number;
  maxTips?: number;
}

export const CARD_BUDGETS: Record<string, CardBudget> = {
  "standard:linkedin": { title: 70, supporting: 110, category: 28 },
  "standard:instagram-square": { title: 60, supporting: 90, category: 28 },
  "standard:instagram-story": { title: 60, supporting: 90, category: 28 },
  "standard:twitter": { title: 80, supporting: 120, category: 28 },
  "checklist:linkedin": { title: 46, category: 28, tipTitle: 40, tipDesc: 80, maxTips: 4 },
  "checklist:instagram-square": { title: 40, category: 28, tipTitle: 40, tipDesc: 80, maxTips: 5 },
  "quote:linkedin": { quote: 90, category: 28 },
  "quote:instagram-square": { quote: 110, category: 28 },
  "quote:twitter": { quote: 100, category: 28 },
  "hook:linkedin": { title: 80, supporting: 100, category: 28 },
  "hook:instagram-square": { title: 90, supporting: 90, category: 28 },
  "stat:linkedin": { title: 90, supporting: 90, category: 28 },
  "stat:instagram-square": { title: 100, supporting: 80, category: 28 },
  "story-frame:instagram-story": { title: 120, supporting: 110, category: 28 },
};

export function cardBudget(layout: string, platform: string): CardBudget {
  return CARD_BUDGETS[`${layout}:${platform}`] ?? {};
}

// ---------------------------------------------------------------------------
// Brand colours (defaults match Hire'in v1). category_color maps to --cat and
// brand_color maps to --brand inside the templates.
// ---------------------------------------------------------------------------
export const BRAND_DEFAULTS = {
  navy: "#1F3A6E",
  orangePrimary: "#F47C20",
  orangeAccent: "#F96D3E",
};

// Per-category pill colour. Falls back to the brand orange.
export const CATEGORY_COLORS: Record<string, string> = {
  Healthcare: "#0E9F8E",
  IT: "#2563EB",
  Engineering: "#7C3AED",
  "Professional Services": "#F47C20",
};

export function categoryColor(category?: string | null): string {
  if (!category) return BRAND_DEFAULTS.orangePrimary;
  return CATEGORY_COLORS[category] ?? BRAND_DEFAULTS.orangePrimary;
}

// ---------------------------------------------------------------------------
// The variable contract every template renders against.
// ---------------------------------------------------------------------------
export interface CardTip {
  tip_title: string;
  tip_desc?: string;
}

export interface CardVariables {
  title: string;
  excerpt?: string;
  supporting_line?: string;
  category?: string;
  category_color?: string;
  brand_color?: string;
  author_name?: string;
  author_title?: string;
  author_photo_url?: string;
  logo_url?: string;
  footer_url?: string;
  publish_date?: string;
  tips?: CardTip[];
  // Social-idea creative slots (Task #915). stat templates render stat_value
  // big + stat_label under it, falling back to title when stat_value is empty.
  stat_value?: string;
  stat_label?: string;
}

// ---------------------------------------------------------------------------
// Social-idea card variables (Task #915). Hook text (first line of the
// caption, or an explicit override) drives {{title}}; stat layouts try to
// extract a leading figure ("73% of nurses...") into stat_value/stat_label.
// ---------------------------------------------------------------------------
const STAT_RE = /(\$?\d[\d,.]*\s*(?:%|x|X|percent|million|billion|k|K|hrs?|hours?|days?)?)/;

export function extractStatFromText(text: string): { statValue: string; statLabel: string } | null {
  const m = text.match(STAT_RE);
  if (!m || m.index === undefined) return null;
  const statValue = m[1].trim();
  // Must actually look like a figure, not a bare year mention inside a sentence.
  if (!/\d/.test(statValue)) return null;
  const label = (text.slice(0, m.index) + text.slice(m.index + m[1].length))
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,.:;-]+|[\s,.:;-]+$/g, "")
    .trim();
  if (!label) return null;
  return { statValue, statLabel: label };
}

export function firstLine(text?: string | null): string {
  if (!text) return "";
  const line = text.split(/\r?\n/).find((l) => l.trim().length > 0) ?? "";
  return line.trim();
}

export interface BuildCardVariablesInput {
  article: {
    title: string;
    excerpt?: string | null;
    category?: string | null;
    contentType?: string | null;
    publishedAt?: Date | string | null;
    socialKit?: any;
    keyTakeaways?: string[] | null;
  };
  project?: {
    brandColor?: string | null;
    logoUrl?: string | null;
    footerUrl?: string | null;
  } | null;
  author?: {
    displayName?: string | null;
    title?: string | null;
    photoUrl?: string | null;
  } | null;
  brand?: {
    navy?: string | null;
    orangeAccent?: string | null;
    logoUrl?: string | null;
  } | null;
}

function formatPublishDate(value?: Date | string | null): string {
  const d = value ? new Date(value) : new Date();
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// Pull the checklist tips out of an article's Social Kit / key takeaways.
export function extractTips(input: BuildCardVariablesInput["article"], maxTips: number): CardTip[] {
  const out: CardTip[] = [];
  const kit = input.socialKit;
  // Social kit may carry structured carousel/checklist points.
  const candidates: any[] =
    (Array.isArray(kit?.checklist) && kit.checklist) ||
    (Array.isArray(kit?.tips) && kit.tips) ||
    (Array.isArray(kit?.carousel_slides) && kit.carousel_slides) ||
    (Array.isArray(input.keyTakeaways) && input.keyTakeaways) ||
    [];
  for (const c of candidates) {
    if (out.length >= maxTips) break;
    if (typeof c === "string") {
      const [head, ...rest] = c.split(/[:\u2014\-]\s*/);
      out.push({ tip_title: (head ?? c).trim(), tip_desc: rest.join(" ").trim() || undefined });
    } else if (c && typeof c === "object") {
      out.push({
        tip_title: (c.tip_title ?? c.title ?? c.heading ?? "").toString().trim(),
        tip_desc: (c.tip_desc ?? c.desc ?? c.body ?? c.text ?? "").toString().trim() || undefined,
      });
    }
  }
  return out.filter((t) => t.tip_title);
}

export function buildCardVariables(
  input: BuildCardVariablesInput,
  layout: CardLayout,
  platform: CardPlatform,
): CardVariables {
  const { article, project, author, brand } = input;
  const brandColor =
    project?.brandColor || brand?.orangeAccent || BRAND_DEFAULTS.orangeAccent;
  const catColor = categoryColor(article.category);
  const kit = article.socialKit ?? {};

  const vars: CardVariables = {
    title: article.title ?? "",
    excerpt: article.excerpt ?? kit?.excerpt ?? "",
    supporting_line: (kit?.supporting_line ?? article.excerpt ?? "").toString(),
    category: article.category ?? "",
    category_color: catColor,
    brand_color: brandColor,
    author_name: author?.displayName ?? "",
    author_title: author?.title ?? "",
    author_photo_url: author?.photoUrl ?? "",
    logo_url: project?.logoUrl ?? brand?.logoUrl ?? "",
    footer_url: project?.footerUrl ?? "hire-in.com/insights",
    publish_date: formatPublishDate(article.publishedAt),
  };

  if (layout === "checklist") {
    const budget = cardBudget(layout, platform);
    vars.tips = extractTips(article, budget.maxTips ?? 4);
  }
  if (layout === "quote") {
    // Quote templates render the pull-quote through {{title}}.
    const quote = kit?.pull_quote ?? kit?.quote;
    if (quote) vars.title = quote.toString();
  }
  return vars;
}

// ---------------------------------------------------------------------------
// Minimal Mustache-style renderer.
//   {{var}}              -> HTML-escaped value
//   {{#list}}...{{/list}} -> iterate array items (item fields merged over scope)
//   {{#flag}}...{{/flag}} -> render block once when value is truthy (non-array)
//   {{^flag}}...{{/flag}} -> render block when value is falsy/empty
// Lookups walk the current item scope, then the root scope.
// ---------------------------------------------------------------------------
function htmlEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const SECTION_RE = /\{\{([#^])\s*([\w.]+)\s*\}\}([\s\S]*?)\{\{\/\s*\2\s*\}\}/g;
const VAR_RE = /\{\{\s*([\w.]+)\s*\}\}/g;

function lookup(scopes: Array<Record<string, any>>, key: string): any {
  for (let i = scopes.length - 1; i >= 0; i--) {
    const s = scopes[i];
    if (s && Object.prototype.hasOwnProperty.call(s, key) && s[key] !== undefined) {
      return s[key];
    }
  }
  return undefined;
}

function renderInternal(template: string, scopes: Array<Record<string, any>>): string {
  // Resolve sections first (handles nesting via the non-greedy matched pairs).
  let out = template.replace(SECTION_RE, (_m, sigil: string, key: string, inner: string) => {
    const value = lookup(scopes, key);
    const truthy = Array.isArray(value) ? value.length > 0 : Boolean(value);
    if (sigil === "^") {
      return truthy ? "" : renderInternal(inner, scopes);
    }
    if (!truthy) return "";
    if (Array.isArray(value)) {
      return value
        .map((item) =>
          renderInternal(
            inner,
            scopes.concat([item && typeof item === "object" ? item : { ".": item }]),
          ),
        )
        .join("");
    }
    // Non-array truthy value: render once with the value pushed as scope so the
    // template can still reference the same key (e.g. {{#brand_color}}{{brand_color}}{{/}}).
    return renderInternal(
      inner,
      scopes.concat([typeof value === "object" ? value : { ".": value }]),
    );
  });

  out = out.replace(VAR_RE, (_m, key: string) => {
    const value = key === "." ? lookup(scopes, ".") : lookup(scopes, key);
    return htmlEscape(value);
  });
  return out;
}

export function renderCardTemplate(html: string, vars: CardVariables): string {
  return renderInternal(html, [vars as Record<string, any>]);
}

// Sample data for live template previews (Template Settings UI / preview route).
export function sampleCardVariables(layout: CardLayout): CardVariables {
  const base: CardVariables = {
    title: "5 Ways to Speed Up Your Healthcare Hiring Pipeline",
    excerpt:
      "Cut time-to-fill without cutting corners. Practical tactics that recruiting teams can apply this quarter.",
    supporting_line: "Practical tactics recruiting teams can apply this quarter.",
    category: "Healthcare",
    category_color: categoryColor("Healthcare"),
    brand_color: BRAND_DEFAULTS.orangeAccent,
    author_name: "Priya Nair",
    author_title: "Director of Talent Solutions",
    author_photo_url: "",
    logo_url: "",
    footer_url: "hire-in.com/insights",
    publish_date: formatPublishDate(new Date()),
  };
  if (layout === "checklist") {
    base.title = "5 Faster-Hiring Tactics";
    base.tips = [
      { tip_title: "Pre-screen with structured intake", tip_desc: "Align on must-haves before sourcing." },
      { tip_title: "Batch interviews", tip_desc: "Compress scheduling into focused windows." },
      { tip_title: "Use a scorecard", tip_desc: "Reduce bias and speed up decisions." },
      { tip_title: "Keep candidates warm", tip_desc: "Communicate next steps within 24 hours." },
    ];
  }
  if (layout === "quote") {
    base.title = "Speed and quality aren't opposites — the right process delivers both.";
  }
  if (layout === "hook") {
    base.title = "Your best candidate just accepted another offer. Here's why.";
    base.supporting_line = "The 48-hour window most hiring teams miss.";
  }
  if (layout === "stat") {
    base.title = "73% of candidates drop off after a slow first week";
    base.stat_value = "73%";
    base.stat_label = "of candidates drop off after a slow first week";
    base.supporting_line = "Source: Hire'in placement data, 2026.";
  }
  if (layout === "story-frame") {
    base.title = "The hiring metric nobody tracks (and why it costs you offers)";
    base.supporting_line = "Swipe up for the full breakdown.";
  }
  return base;
}
