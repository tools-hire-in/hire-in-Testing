/**
 * AI mock fixture for studio generation tests.
 *
 * Used by:
 *  - server unit tests (studioAiIntelligence.test.ts) — import constants directly
 *  - E2E/hybrid Playwright specs — assert response shape when STUDIO_AI_MOCK=true
 *
 * The server route reads process.env.STUDIO_AI_MOCK or the x-studio-ai-mock header
 * and returns this fixture inline (no actual OpenAI call) so test runs are fast and
 * deterministic.
 */

export const MOCK_ARTICLE_BODY_MARKDOWN = `## Why IT Staffing Firms Need a Talent Brand

The firms that place the most engineers are not the ones with the biggest job boards. They are the ones candidates trust before the conversation starts.

## The Mechanism Behind Recruiter Credibility

Candidates evaluate recruiters before responding. The first signal is the quality of the role description. The second is the transparency of the process.

A staffing firm that explains its screening process earns more candidate attention than one that leads with volume.

## What Changes the Outcome

Three operational decisions separate the firms candidates return to from the ones they ignore:

1. Requirement clarity at intake — not after three failed submittals
2. Honest communication about timelines, compensation, and work arrangement
3. Closure at every stage, including when the answer is no

These are not marketing activities. They are delivery activities that become the brand.

## The Practical Implication

Your talent brand is the reputation your recruiters build one conversation at a time. It is not a logo or a LinkedIn page. It is what a candidate tells the next candidate.`;

/** Matches CanonicalArticleDraft shape (body_markdown is the canonical field). */
export const MOCK_ARTICLE_DRAFT = {
  title: "Why IT Staffing Firms Need a Talent Brand",
  body_markdown: MOCK_ARTICLE_BODY_MARKDOWN,
  excerpt:
    "The firms that place the most engineers are not the ones with the biggest job boards.",
  suggested_tags: ["talent brand", "IT staffing", "recruiter credibility"],
  suggested_category: "Thought Leadership",
  suggested_slug: "why-it-staffing-firms-need-talent-brand",
  seo_title: "Why IT Staffing Firms Need a Talent Brand",
  seo_description:
    "The firms that place the most engineers build trust before the conversation starts. Here is the operational mechanism behind recruiter credibility.",
  hook_archetype_used: "insider_contrast",
  read_time_minutes: 3,
};

export const MOCK_QUALITY_REVIEW = {
  overall_verdict: "PASS",
  risk_flags: [],
  required_edits: [],
  suggestions: [],
};

/** Spot-check list of banned slop phrases that must NOT appear in mock body. */
export const BANNED_SLOP_SPOT_CHECK = [
  "game-changer",
  "fast-paced",
  "delve",
  "dive into",
  "revolutionize",
];
