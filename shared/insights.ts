// Shared metadata for the public /insights surface (Content Studio read path).
// Single source of truth for the category taxonomy + the category -> CTA
// mapping used on article detail pages. Imported by both the frontend
// (filter chips, CTA block) and kept dependency-free so it is safe everywhere.

export interface InsightCategory {
  /** Stored value on studio_articles.category. */
  value: string;
  /** Human label shown in filter chips and badges. */
  label: string;
}

export const INSIGHT_CATEGORIES: InsightCategory[] = [
  { value: "staffing_market", label: "Staffing Market" },
  { value: "employer_guide", label: "Employer Guide" },
  { value: "recruiter_playbook", label: "Recruiter Playbook" },
  { value: "candidate_hub", label: "Candidate Hub" },
  { value: "ai_in_hiring", label: "AI in Hiring" },
  { value: "healthcare", label: "Healthcare" },
  { value: "it_staffing", label: "IT Staffing" },
];

export const INSIGHT_CATEGORY_MAP: Record<string, InsightCategory> =
  INSIGHT_CATEGORIES.reduce(
    (acc, c) => {
      acc[c.value] = c;
      return acc;
    },
    {} as Record<string, InsightCategory>,
  );

export function insightCategoryLabel(value: string | null | undefined): string {
  if (!value) return "Insights";
  return INSIGHT_CATEGORY_MAP[value]?.label ?? "Insights";
}

export interface InsightCta {
  heading: string;
  body: string;
  buttonLabel: string;
  href: string;
}

const DEFAULT_CTA: InsightCta = {
  heading: "Ready to build your team?",
  body: "Partner with Hire'in Solutions for AI-powered recruitment across Healthcare, IT, Engineering, and Professional Services.",
  buttonLabel: "Request a Quote",
  href: "/request-a-quote",
};

// Each category points readers to the most relevant existing site surface.
const CTA_BY_CATEGORY: Record<string, InsightCta> = {
  healthcare: {
    heading: "Need healthcare talent fast?",
    body: "From travel nurses to locum physicians, our Joint Commission-aligned workflows deliver credentialed clinicians across all 50 states.",
    buttonLabel: "Explore Healthcare Staffing",
    href: "/services/healthcare-recruitment",
  },
  it_staffing: {
    heading: "Hiring software & IT talent?",
    body: "Get pre-screened engineers, DevOps, and cloud specialists with first submissions in 24 hours.",
    buttonLabel: "Explore IT Staffing",
    href: "/it-staffing",
  },
  ai_in_hiring: {
    heading: "Put AI to work in your hiring",
    body: "See how Hire'in Solutions blends AI matching with human recruiters to fill roles faster and more accurately.",
    buttonLabel: "Why Hire'in Solutions",
    href: "/why-hire-in-solutions",
  },
  employer_guide: {
    heading: "Let's plan your next hire",
    body: "Tell us what you need and get a tailored staffing quote — no upfront fees.",
    buttonLabel: "Request a Quote",
    href: "/request-a-quote",
  },
  recruiter_playbook: {
    heading: "Partner with a specialist agency",
    body: "Hire'in Solutions handles sourcing, screening, and compliance so your team can focus on results.",
    buttonLabel: "See How We Work",
    href: "/why-hire-in-solutions",
  },
  candidate_hub: {
    heading: "Looking for your next role?",
    body: "Browse open positions across Healthcare, IT, Engineering, and Professional Services.",
    buttonLabel: "Browse Jobs",
    href: "/jobs",
  },
  staffing_market: {
    heading: "Plan your workforce strategy",
    body: "Talk to Hire'in Solutions about flexible contract, contract-to-hire, and direct placement options.",
    buttonLabel: "Request a Quote",
    href: "/request-a-quote",
  },
};

export function ctaForCategory(value: string | null | undefined): InsightCta {
  if (!value) return DEFAULT_CTA;
  return CTA_BY_CATEGORY[value] ?? DEFAULT_CTA;
}

// Reader reactions shown on public article pages. The `value` is what gets
// stored on studio_article_reactions.reaction_type and is the single source of
// truth shared by the reaction bar (frontend) and the react API (backend).
export interface InsightReaction {
  value: string;
  emoji: string;
  label: string;
}

export const INSIGHT_REACTIONS: InsightReaction[] = [
  { value: "helpful", emoji: "👍", label: "Helpful" },
  { value: "insightful", emoji: "💡", label: "Insightful" },
  { value: "love", emoji: "❤️", label: "Love this" },
  { value: "saved", emoji: "🔖", label: "Saved it" },
];

export const INSIGHT_REACTION_VALUES = INSIGHT_REACTIONS.map((r) => r.value);
