// Shared canonical agent contracts for the Commercial Intelligence Bridge.
// Both the BD Agent and Content Studio import from this module.
// Prevents each system from inventing its own labels for the same concepts.

export type AgentType = "bd_agent" | "content_studio";

export type CanonicalDomain =
  | "healthcare"
  | "it"
  | "engineering"
  | "professional_services"
  | "general"
  | "cross_domain";

export type CanonicalAudience =
  | "employer_client"
  | "msp_vms_partner"
  | "candidate"
  | "recruiter_operator";

export type BuyerStage =
  | "problem_identification"
  | "solution_exploration"
  | "requirements_definition"
  | "supplier_evaluation"
  | "commercial_validation"
  | "pilot_or_contracting"
  | "expansion_or_renewal";

export type PainPointTheme =
  | "submission_quality"
  | "credentialing_delays"
  | "candidate_relevance"
  | "vms_discipline"
  | "time_to_fill"
  | "cost_per_hire"
  | "retention_risk"
  | "compliance_risk"
  | "communication_gaps"
  | "onboarding_friction"
  | "technical_screening"
  | "workforce_continuity"
  | "other";

export interface BdIntelMetadata {
  sourceConversationId?: string | null;
  domain?: CanonicalDomain | null;
  buyerStage?: BuyerStage | null;
  painPointTheme?: PainPointTheme | null;
  icpHint?: string | null;
}

export interface PublishedContentAsset {
  id: string;
  title: string;
  slug: string | null;
  excerpt: string | null;
  domainResolved: string | null;
  publishedAt: string | null;
  tags: string[] | null;
}

// ── Domain normalizers ────────────────────────────────────────────────────────

const DOMAIN_ALIAS_MAP: Record<string, CanonicalDomain> = {
  healthcare: "healthcare",
  health_care: "healthcare",
  it: "it",
  technology: "it",
  information_technology: "it",
  engineering: "engineering",
  professional_services: "professional_services",
  general: "general",
  general_staffing: "general",
  cross_domain: "cross_domain",
};

export function normalizeDomain(raw: string | null | undefined): CanonicalDomain {
  if (!raw) return "general";
  const key = raw.toLowerCase().replace(/[\s-]/g, "_");
  return DOMAIN_ALIAS_MAP[key] ?? "general";
}

// Maps a canonical domain to studio article domainResolved values
export function domainToStudioResolved(domain: CanonicalDomain): string[] {
  switch (domain) {
    case "healthcare":
      return ["HEALTHCARE_STAFFING"];
    case "it":
      return ["IT_STAFFING"];
    case "engineering":
    case "professional_services":
    case "general":
      return ["GENERAL_STAFFING"];
    case "cross_domain":
      return ["GENERAL_STAFFING", "IT_STAFFING", "HEALTHCARE_STAFFING"];
    default:
      return ["GENERAL_STAFFING"];
  }
}

// ── Buyer stage normalizer ────────────────────────────────────────────────────

const BUYER_STAGE_LABELS: Record<BuyerStage, string> = {
  problem_identification: "Problem Identification",
  solution_exploration: "Solution Exploration",
  requirements_definition: "Requirements Definition",
  supplier_evaluation: "Supplier Evaluation",
  commercial_validation: "Commercial Validation",
  pilot_or_contracting: "Pilot / Contracting",
  expansion_or_renewal: "Expansion / Renewal",
};

export function normalizeBuyerStage(raw: string | null | undefined): BuyerStage | null {
  if (!raw) return null;
  const key = raw.toLowerCase().replace(/[\s\-/]/g, "_") as BuyerStage;
  return (Object.keys(BUYER_STAGE_LABELS) as BuyerStage[]).includes(key) ? key : null;
}

export function buyerStageLabel(stage: BuyerStage | string): string {
  return BUYER_STAGE_LABELS[stage as BuyerStage] ?? stage;
}

// ── Audience normalizer ───────────────────────────────────────────────────────

const AUDIENCE_ALIAS_MAP: Record<string, CanonicalAudience> = {
  employer_client: "employer_client",
  employer: "employer_client",
  client: "employer_client",
  msp_vms_partner: "msp_vms_partner",
  msp: "msp_vms_partner",
  vms: "msp_vms_partner",
  candidate: "candidate",
  recruiter: "recruiter_operator",
  recruiter_operator: "recruiter_operator",
  operator: "recruiter_operator",
};

export function normalizeAudience(raw: string | null | undefined): CanonicalAudience | null {
  if (!raw) return null;
  const key = raw.toLowerCase().replace(/[\s-]/g, "_");
  return AUDIENCE_ALIAS_MAP[key] ?? null;
}

// ── Display labels ────────────────────────────────────────────────────────────

export const CANONICAL_DOMAIN_LABELS: Record<CanonicalDomain, string> = {
  healthcare: "Healthcare",
  it: "IT / Technology",
  engineering: "Engineering",
  professional_services: "Professional Services",
  general: "General",
  cross_domain: "Cross-Domain",
};

export const PAIN_POINT_LABELS: Record<PainPointTheme, string> = {
  submission_quality: "Submission Quality",
  credentialing_delays: "Credentialing Delays",
  candidate_relevance: "Candidate Relevance",
  vms_discipline: "VMS Discipline",
  time_to_fill: "Time to Fill",
  cost_per_hire: "Cost per Hire",
  retention_risk: "Retention Risk",
  compliance_risk: "Compliance Risk",
  communication_gaps: "Communication Gaps",
  onboarding_friction: "Onboarding Friction",
  technical_screening: "Technical Screening",
  workforce_continuity: "Workforce Continuity",
  other: "Other",
};

export const PAIN_POINT_OPTIONS = Object.entries(PAIN_POINT_LABELS).map(([value, label]) => ({
  value: value as PainPointTheme,
  label,
}));

export const BUYER_STAGE_OPTIONS = Object.entries(BUYER_STAGE_LABELS).map(([value, label]) => ({
  value: value as BuyerStage,
  label,
}));

export const DOMAIN_OPTIONS = Object.entries(CANONICAL_DOMAIN_LABELS).map(([value, label]) => ({
  value: value as CanonicalDomain,
  label,
}));
