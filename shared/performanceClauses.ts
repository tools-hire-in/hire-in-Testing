// Shared definitions for the optional performance-based salary clauses (Task #336).
// Used by BOTH the server (DOCX engines, routes) and the client (preview, settings).
// Pure functions only — no imports of server- or client-only modules.

export const OFFER_CLAUSE_CATEGORY = "offer_clause";
export const OFFER_CLAUSE_KEY = "probation_performance_review";
export const OFFER_CLAUSE_LABEL = "Probationary Compensation & Performance-Based Salary Review";

export const ADDENDUM_CLAUSE_CATEGORY = "addendum_clause";
export const ADDENDUM_CLAUSE_KEY = "growth_plan_review";
export const ADDENDUM_CLAUSE_LABEL = "90-Day Performance Review & Salary Revision Eligibility";

// Approved seed wording. Optional fragments are wrapped in {{ ... }}: if any
// token inside a fragment is left blank, ONLY that fragment is removed while the
// surrounding mandatory text is preserved. A standalone line whose only token is
// blank (e.g. a bullet that is entirely about the optional ceiling) is dropped.
export const OFFER_CLAUSE_DEFAULT_TEXT = [
  "Your compensation during the initial probation period will be ₹[ProbationSalary] per month. The initial probation period will be [ProbationMonths] from your date of joining.",
  "",
  "Upon completion of the initial probation period, the Company will conduct a performance and delivery review. Subject to your performance, achievement of assigned goals, quality of delivery, consistency, professional conduct, and overall contribution, your salary may be reconsidered.",
  "",
  "Employees who meet the expected performance and delivery standards may continue at the existing compensation or may be considered for revision based on management's assessment. {{Employees who significantly exceed the expected goals and demonstrate strong ownership, consistent delivery, and measurable business impact may be considered for a salary revision of up to ₹[MaxRevisionSalary] per month.}}",
  "",
  "Any salary revision will be at the sole discretion of the Company and will be confirmed separately in writing. Mention of the review amount does not create an automatic entitlement or guarantee of salary increase.{{ The Company may also extend the probation period up to [ExtendedProbationMonths], if required, based on performance, delivery, conduct, or business needs.}}",
].join("\n");

export const ADDENDUM_CLAUSE_DEFAULT_TEXT = [
  "Your current salary is ₹[CurrentSalary] per month. As discussed, a 90-day performance plan with defined goals and targets has been agreed with you.",
  "",
  "At the end of the 90-day period, your performance will be reviewed against the agreed goals and targets, productivity expectations, quality of submissions, successful delivery outcomes, compliance discipline, communication standards, ownership, and overall contribution to the Healthcare Recruitment department.",
  "",
  "Based on the outcome of this review:",
  "- If performance meets the agreed targets, the Company may continue the existing salary or consider a revision based on overall performance and business needs.",
  "- If performance significantly exceeds the agreed targets and demonstrates strong, measurable results, the Company may consider a salary revision of up to ₹[MaxRevisionSalary] per month.",
  "- If performance is below the agreed targets, the plan period may be extended or the arrangement reviewed further in accordance with your terms of employment.",
  "",
  "Any salary revision{{, including any increase up to ₹[MaxRevisionSalary] per month,}} shall not be automatic and will be subject to management review, business requirements, and written approval by the Company.",
].join("\n");

export interface PerformanceClauseSeed {
  key: string;
  category: string;
  label: string;
  sentence: string;
  sortOrder: number;
}

export const PERFORMANCE_CLAUSE_SEEDS: PerformanceClauseSeed[] = [
  {
    key: OFFER_CLAUSE_KEY,
    category: OFFER_CLAUSE_CATEGORY,
    label: OFFER_CLAUSE_LABEL,
    sentence: OFFER_CLAUSE_DEFAULT_TEXT,
    sortOrder: 1,
  },
  {
    key: ADDENDUM_CLAUSE_KEY,
    category: ADDENDUM_CLAUSE_CATEGORY,
    label: ADDENDUM_CLAUSE_LABEL,
    sentence: ADDENDUM_CLAUSE_DEFAULT_TEXT,
    sortOrder: 1,
  },
];

// Human-friendly labels for the new categories in the settings editor.
export const PERFORMANCE_CLAUSE_CATEGORY_LABELS: Record<string, string> = {
  [OFFER_CLAUSE_CATEGORY]: "Offer Letter — Performance Probation Clause",
  [ADDENDUM_CLAUSE_CATEGORY]: "Addendum — 90-Day Growth Plan Clause",
};

/**
 * Merge bracketed tokens (e.g. [ProbationSalary]) into a clause template.
 *
 * Two-stage graceful omission so mandatory text is never lost:
 *  1. Optional fragments wrapped in {{ ... }}: if ANY token inside the fragment
 *     has an empty/missing value, the entire fragment (and its markers) is
 *     removed while the surrounding text on the same line is preserved. If all
 *     its tokens have values, the markers are stripped and the inner text kept.
 *  2. Line-based omission of whatever remains: for every line, if it still
 *     references a token whose value is empty/missing, that entire line is
 *     dropped (covers standalone optional lines such as a bullet that is wholly
 *     about the optional ceiling). Lines without tokens, or whose tokens all
 *     have values, are kept with the tokens substituted.
 *
 * Trailing whitespace is trimmed per line, and runs of 3+ blank lines are
 * collapsed to a single blank line so removed conditionals leave no large gaps.
 */
export function mergeClauseText(
  template: string,
  values: Record<string, string | number | null | undefined>,
): string {
  const normalized: Record<string, string> = {};
  for (const [k, v] of Object.entries(values)) {
    normalized[k] = v === null || v === undefined ? "" : String(v).trim();
  }

  const tokenRegex = /\[([A-Za-z0-9_]+)\]/g;
  const fragmentRegex = /\{\{([\s\S]*?)\}\}/g;

  const hasEmptyToken = (text: string): boolean => {
    const tokens = Array.from(text.matchAll(tokenRegex)).map((m) => m[1]);
    return tokens.some((t) => !normalized[t] || normalized[t].length === 0);
  };

  // Stage 1: resolve optional inline fragments.
  const withFragments = template.replace(fragmentRegex, (_full, inner: string) =>
    hasEmptyToken(inner) ? "" : inner,
  );

  // Stage 2: line-based omission of remaining lines with empty tokens.
  const outputLines: string[] = [];
  for (const line of withFragments.split("\n")) {
    if (hasEmptyToken(line)) {
      // Drop the whole line — a referenced value was left blank.
      continue;
    }
    const replaced = line.replace(tokenRegex, (_full, token) => normalized[token] ?? "");
    outputLines.push(replaced.replace(/[ \t]+$/, ""));
  }

  // Collapse 3+ consecutive newlines into 2 (one blank line), trim ends.
  return outputLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// Format an Indian-rupee monthly amount for display inside merged clauses.
export function formatRupees(amount: string | number | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "";
  const num = typeof amount === "number" ? amount : parseFloat(String(amount).replace(/[^0-9.]/g, ""));
  if (isNaN(num)) return "";
  return num.toLocaleString("en-IN");
}

// Format a months count as a human label ("1 month" / "3 months").
export function formatMonths(months: number | string | null | undefined): string {
  if (months === null || months === undefined || months === "") return "";
  const n = typeof months === "number" ? months : parseInt(String(months), 10);
  if (isNaN(n) || n <= 0) return "";
  return n === 1 ? "1 month" : `${n} months`;
}

// Build the token-value map for the offer-letter probation clause.
export function buildOfferClauseValues(input: {
  probationSalary?: string | number | null;
  probationPeriodMonths?: number | string | null;
  maxRevisionSalary?: string | number | null;
  extendedProbationMonths?: number | string | null;
}): Record<string, string> {
  return {
    ProbationSalary: formatRupees(input.probationSalary),
    ProbationMonths: formatMonths(input.probationPeriodMonths),
    MaxRevisionSalary: formatRupees(input.maxRevisionSalary),
    ExtendedProbationMonths: formatMonths(input.extendedProbationMonths),
  };
}

// Build the token-value map for the addendum growth-plan clause.
export function buildAddendumClauseValues(input: {
  currentSalary?: string | number | null;
  maxRevisionSalary?: string | number | null;
}): Record<string, string> {
  return {
    CurrentSalary: formatRupees(input.currentSalary),
    MaxRevisionSalary: formatRupees(input.maxRevisionSalary),
  };
}

// Render the offer-letter probation clause with HR's inputs merged in.
export function renderOfferClause(
  template: string,
  input: Parameters<typeof buildOfferClauseValues>[0],
): string {
  return mergeClauseText(template, buildOfferClauseValues(input));
}

// Render the addendum growth-plan clause with HR's inputs merged in.
export function renderAddendumClause(
  template: string,
  input: Parameters<typeof buildAddendumClauseValues>[0],
): string {
  return mergeClauseText(template, buildAddendumClauseValues(input));
}
