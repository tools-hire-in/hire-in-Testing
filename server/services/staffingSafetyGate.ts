// Staffing Safety Gate — CMO Copilot v2.1 §10
//
// Deterministic hard-failure checks that run BEFORE semantic review.
// Hard failures block approval and publishing until corrected.
//
// Architecture: source ledger from user-supplied facts → scan generated output
// for unsupported claims → return structured failure reports.

export type SafetyFailureCode =
  | "JOB_FACT_INVENTED"
  | "HEALTHCARE_FACT_INVENTED"
  | "IT_FACT_INVENTED"
  | "GOVERNMENT_CLAIM_INVENTED"
  | "COMPANY_CLAIM_INVENTED"
  | "PLACEHOLDER_LEAKED"
  | "BANNED_PHRASE";

export interface SafetyFailure {
  code: SafetyFailureCode;
  sentence: string;         // exact sentence that triggered the failure
  reason: string;
  missingSource: string;    // what source input would have licensed this
  recommendedCorrection: string;
  autoCorrectSafe: boolean; // true = existing retry path may attempt correction
}

export interface SafetyGateResult {
  pass: boolean;
  failures: SafetyFailure[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Source ledger — normalizes user-supplied facts into a searchable token set.
// ---------------------------------------------------------------------------
function buildSourceLedger(userSuppliedFacts?: string): Set<string> {
  if (!userSuppliedFacts?.trim()) return new Set();
  // Tokenize: lowercase words, numbers, dollar amounts, percentages
  const tokens = userSuppliedFacts
    .toLowerCase()
    .match(/\b[\w$.%/-]+\b/g) ?? [];
  return new Set(tokens);
}

function ledgerContains(ledger: Set<string>, term: string): boolean {
  const t = term.toLowerCase().trim();
  return ledger.has(t) || [...ledger].some((l) => l.includes(t) || t.includes(l));
}

// ---------------------------------------------------------------------------
// Banned placeholder detection — catch exemplar placeholders that leaked.
// ---------------------------------------------------------------------------
const PLACEHOLDER_PATTERN = /\[(?:ROLE_TITLE|LOCATION|WORK_ARRANGEMENT|MUST_HAVE_\d+|APPROVED_CONTACT|STAKEHOLDER_OR_TEAM|RESPONSIBILITY_\d+|REQUIRED_LICENSE|SPECIALTY|CARE_SETTING|NEEDS_PROOF[^\]]*|PC-\d+[^\]]*)\]/gi;

function checkPlaceholders(text: string): SafetyFailure[] {
  const failures: SafetyFailure[] = [];
  const matches = text.match(PLACEHOLDER_PATTERN) ?? [];
  for (const m of [...new Set(matches)]) {
    failures.push({
      code: "PLACEHOLDER_LEAKED",
      sentence: m,
      reason: "Exemplar or proof placeholder was not replaced before output.",
      missingSource: "The bracketed field must come from the user's job record or supplied facts.",
      recommendedCorrection: "Omit the sentence containing this placeholder, or fill it from the source ledger.",
      autoCorrectSafe: true,
    });
  }
  return failures;
}

// ---------------------------------------------------------------------------
// Banned phrases — deterministic exact-match check (Content Craft §4)
// ---------------------------------------------------------------------------
const BANNED_HARD: string[] = [
  "game-changer", "game changer",
  "in today's fast-paced world",
  "the landscape of",
  "unlock", "unleash",
  "delve into", "dive into",
  "navigate the complexities",
  "war for talent",
  "people are our greatest asset",
  "we go above and beyond",
  "passionate about connecting people",
  "dream job",
  "rockstar", "ninja", "guru",
  "work hard, play hard",
];

function checkBannedPhrases(text: string): SafetyFailure[] {
  const lower = text.toLowerCase();
  const failures: SafetyFailure[] = [];
  for (const phrase of BANNED_HARD) {
    if (lower.includes(phrase)) {
      const idx = lower.indexOf(phrase);
      // Extract the sentence containing the phrase
      const start = Math.max(0, text.lastIndexOf(".", idx) + 1);
      const end = text.indexOf(".", idx + phrase.length);
      const sentence = text.slice(start, end > 0 ? end + 1 : idx + phrase.length + 40).trim();
      failures.push({
        code: "BANNED_PHRASE",
        sentence,
        reason: `Banned phrase detected: "${phrase}"`,
        missingSource: "N/A — this phrase must be removed regardless of source.",
        recommendedCorrection: "Rewrite the sentence without this phrase. The self-edit pass should have caught this.",
        autoCorrectSafe: true,
      });
    }
  }
  return failures;
}

// ---------------------------------------------------------------------------
// Job marketing checks (§10.2) — detect unsupported factual claims
// ---------------------------------------------------------------------------

// Patterns that indicate invented compensation
const COMPENSATION_PATTERNS = [
  /\$\s*[\d,]+(?:k|K|\s*thousand|\s*per\s+(?:hour|hr|year|annum))?/g,
  /\b(?:salary|compensation|pay|wage|hourly\s+rate|annual\s+salary)\s+(?:is|of|around|up\s+to)\s+[\d$]/gi,
  /[\d,]+\s*(?:per\s+hour|\/hr|\/year|\/annum)/gi,
];

// Patterns that indicate shift/schedule claims
const SCHEDULE_PATTERNS = [
  /\b(?:day\s+shift|night\s+shift|evening\s+shift|rotating\s+shift|12[-\s]hour(?:\s+shift)?|8[-\s]hour(?:\s+shift)?|10[-\s]hour(?:\s+shift)?)\b/gi,
  /\b(?:monday\s+(?:to|through|–|-)\s+friday|weekends?\s+(?:required|included|off))\b/gi,
];

// Patterns for urgency language
const URGENCY_PATTERNS = [
  /\b(?:urgent(?:ly)?|immediately|asap|as\s+soon\s+as\s+possible|apply\s+(?:now|today|immediately)|deadline(?:\s+is)?|closing\s+(?:soon|date))\b/gi,
];

function checkJobMarketing(
  text: string,
  ledger: Set<string>,
  contentGoal?: string,
): SafetyFailure[] {
  if (contentGoal !== "JOB_MARKETING") return [];
  const failures: SafetyFailure[] = [];

  // Compensation check
  for (const pattern of COMPENSATION_PATTERNS) {
    const matches = text.match(pattern) ?? [];
    for (const match of matches) {
      if (!ledgerContains(ledger, match)) {
        const idx = text.indexOf(match);
        const start = Math.max(0, text.lastIndexOf("\n", idx));
        const sentence = text.slice(start, idx + match.length + 60).trim();
        failures.push({
          code: "JOB_FACT_INVENTED",
          sentence,
          reason: `Compensation figure "${match}" was not supplied by the user.`,
          missingSource: "Compensation amount must come from the approved job record.",
          recommendedCorrection: "Remove the compensation detail. Never invent salary, hourly rate, or pay range.",
          autoCorrectSafe: false,
        });
        break; // one failure per compensation pattern type
      }
    }
  }

  // Urgency language check
  for (const pattern of URGENCY_PATTERNS) {
    const matches = text.match(pattern) ?? [];
    for (const match of matches) {
      const idx = text.toLowerCase().indexOf(match.toLowerCase());
      const sentence = text.slice(Math.max(0, idx - 30), idx + match.length + 60).trim();
      failures.push({
        code: "JOB_FACT_INVENTED",
        sentence,
        reason: `Urgency language "${match}" was not supplied and violates claim-free rules.`,
        missingSource: "Do not add urgency, deadlines, or time pressure that the user did not supply.",
        recommendedCorrection: "Remove urgency language. Use a clear, low-friction CTA instead.",
        autoCorrectSafe: true,
      });
      break;
    }
  }

  return failures;
}

// ---------------------------------------------------------------------------
// Healthcare checks (§10.3) — detect unsupplied clinical/recency claims
// ---------------------------------------------------------------------------
const RECENCY_PATTERNS = [
  /\b(?:recent(?:ly)?|within\s+the\s+(?:last|past)\s+\d+|current(?:ly\s+)?(?:licensed|certified|credentialed)|up[-\s]to[-\s]date(?:\s+license)?)\b/gi,
];

const CLINICAL_ADVICE_PATTERNS = [
  /\b(?:diagnos(?:e|is|ing)|prescri(?:be|ption|bing)|treat(?:ment|ing)?|patient\s+(?:care\s+)?outcome|clinical\s+(?:judgment|decision|protocol))\b/gi,
];

function checkHealthcare(
  text: string,
  ledger: Set<string>,
  domain?: string,
  contentGoal?: string,
): SafetyFailure[] {
  if (domain !== "HEALTHCARE_STAFFING") return [];
  const failures: SafetyFailure[] = [];

  // Recency language — only allowed when in source ledger
  for (const pattern of RECENCY_PATTERNS) {
    const matches = text.match(pattern) ?? [];
    for (const match of matches) {
      if (!ledgerContains(ledger, match.toLowerCase())) {
        const idx = text.toLowerCase().indexOf(match.toLowerCase());
        const sentence = text.slice(Math.max(0, idx - 40), idx + match.length + 80).trim();
        failures.push({
          code: "HEALTHCARE_FACT_INVENTED",
          sentence,
          reason: `Recency requirement "${match}" was not in the approved job record or user-supplied facts.`,
          missingSource: "Recency language must come from the approved job record. Omit if not explicitly required.",
          recommendedCorrection: 'Remove the recency claim or replace with "as required by the approved job record".',
          autoCorrectSafe: false,
        });
        break;
      }
    }
  }

  // Clinical advice — always blocked regardless of source
  for (const pattern of CLINICAL_ADVICE_PATTERNS) {
    const matches = text.match(pattern) ?? [];
    for (const match of matches) {
      const idx = text.toLowerCase().indexOf(match.toLowerCase());
      const sentence = text.slice(Math.max(0, idx - 40), idx + match.length + 80).trim();
      failures.push({
        code: "HEALTHCARE_FACT_INVENTED",
        sentence,
        reason: `Clinical advice language detected: "${match}" — this is outside the permitted scope.`,
        missingSource: "Healthcare content must not provide medical, clinical, legal, or licensing advice.",
        recommendedCorrection: "Remove the clinical guidance. Focus on submission readiness, credential preparation, and process clarity.",
        autoCorrectSafe: false,
      });
      break;
    }
  }

  return failures;
}

// ---------------------------------------------------------------------------
// IT checks (§10.4) — detect unsupplied tech/version/clearance claims
// ---------------------------------------------------------------------------
const CLEARANCE_PATTERNS = [
  /\b(?:security\s+clearance|top\s+secret|secret\s+clearance|ts\/sci|public\s+trust|clearance\s+required|must\s+have\s+clearance)\b/gi,
];

const CERT_PATTERNS = [
  /\b(?:aws[-\s]certified|azure[-\s]certified|google[-\s]certified|cissp|ceh|pmp|ccna|ccnp|comptia|gcp[-\s]certified)\b/gi,
];

function checkIT(
  text: string,
  ledger: Set<string>,
  domain?: string,
  contentGoal?: string,
): SafetyFailure[] {
  if (domain !== "IT_STAFFING" || contentGoal !== "JOB_MARKETING") return [];
  const failures: SafetyFailure[] = [];

  // Security clearance — only allowed when in source ledger
  for (const pattern of CLEARANCE_PATTERNS) {
    const matches = text.match(pattern) ?? [];
    for (const match of matches) {
      if (!ledgerContains(ledger, match.toLowerCase())) {
        const idx = text.toLowerCase().indexOf(match.toLowerCase());
        const sentence = text.slice(Math.max(0, idx - 40), idx + match.length + 80).trim();
        failures.push({
          code: "IT_FACT_INVENTED",
          sentence,
          reason: `Security clearance requirement "${match}" was not supplied by the user.`,
          missingSource: "Clearance requirements must come from the approved job record.",
          recommendedCorrection: "Remove the clearance requirement if it was not supplied.",
          autoCorrectSafe: false,
        });
        break;
      }
    }
  }

  // Specific certifications — only when in source ledger
  for (const pattern of CERT_PATTERNS) {
    const matches = text.match(pattern) ?? [];
    for (const match of matches) {
      if (!ledgerContains(ledger, match.toLowerCase())) {
        const idx = text.toLowerCase().indexOf(match.toLowerCase());
        const sentence = text.slice(Math.max(0, idx - 40), idx + match.length + 80).trim();
        failures.push({
          code: "IT_FACT_INVENTED",
          sentence,
          reason: `Certification "${match}" was not in the user-supplied job facts.`,
          missingSource: "Certifications must come from the approved job record. Do not invent required qualifications.",
          recommendedCorrection: "Remove the certification requirement if not supplied.",
          autoCorrectSafe: false,
        });
        break;
      }
    }
  }

  return failures;
}

// ---------------------------------------------------------------------------
// Government checks (§10.5) — detect unsupplied government-specific claims
// ---------------------------------------------------------------------------
const GOV_CONTRACT_PATTERNS = [
  /\b(?:GSA\s+schedule|GWAC|BPA|IDIQ|seaport|CIO-SP|SEWP|contract\s+vehicle|prime\s+contractor|subcontractor)\b/gi,
];

const GOV_CERT_PATTERNS = [
  /\b(?:FedRAMP|FISMA|CMMC|ITAR|DFARS|fedramp[-\s]authorized|fedramp[-\s]moderate|fedramp[-\s]high|DOD\s+approved|agency\s+approved|GSA[-\s]approved)\b/gi,
];

function checkGovernment(
  text: string,
  ledger: Set<string>,
  marketContext?: string,
): SafetyFailure[] {
  if (marketContext !== "STATE_GOVERNMENT" && marketContext !== "FEDERAL_GOVERNMENT") return [];
  const failures: SafetyFailure[] = [];

  for (const pattern of GOV_CONTRACT_PATTERNS) {
    const matches = text.match(pattern) ?? [];
    for (const match of matches) {
      if (!ledgerContains(ledger, match.toLowerCase())) {
        const idx = text.toLowerCase().indexOf(match.toLowerCase());
        const sentence = text.slice(Math.max(0, idx - 40), idx + match.length + 80).trim();
        failures.push({
          code: "GOVERNMENT_CLAIM_INVENTED",
          sentence,
          reason: `Government contract vehicle "${match}" was not supplied by the user.`,
          missingSource: "Contract vehicles and prime/sub status must be verified before inclusion.",
          recommendedCorrection: "Remove the contract vehicle reference. Never claim contract access without proof.",
          autoCorrectSafe: false,
        });
        break;
      }
    }
  }

  for (const pattern of GOV_CERT_PATTERNS) {
    const matches = text.match(pattern) ?? [];
    for (const match of matches) {
      if (!ledgerContains(ledger, match.toLowerCase())) {
        const idx = text.toLowerCase().indexOf(match.toLowerCase());
        const sentence = text.slice(Math.max(0, idx - 40), idx + match.length + 80).trim();
        failures.push({
          code: "GOVERNMENT_CLAIM_INVENTED",
          sentence,
          reason: `Government compliance claim "${match}" was not supplied by the user.`,
          missingSource: "FedRAMP, FISMA, CMMC, and similar claims require approved evidence.",
          recommendedCorrection: "Remove the compliance claim. Never invent certifications or agency approvals.",
          autoCorrectSafe: false,
        });
        break;
      }
    }
  }

  return failures;
}

// ---------------------------------------------------------------------------
// Company / Hire'in claim checks (§10.6)
// ---------------------------------------------------------------------------
const HIREIN_CLAIM_PATTERNS = [
  /\b(?:hire'?in\s+(?:has|achieved|placed|filled|delivers?|guarantees?|ensures?)|our\s+(?:placement\s+rate|fill\s+rate|time[-\s]to[-\s]fill|success\s+rate))\b/gi,
  /\b(?:kler\s*hire\s+(?:guarantees?|ensures?|achieves?|delivers?))\b/gi,
  /\b(?:leading\s+(?:staffing|healthcare|IT)\s+(?:firm|company|agency|provider)|#1\s+staffing|top[-\s]rated\s+staffing)\b/gi,
  /\b(?:\d+(?:\.\d+)?%?\s+(?:placement|fill|success|conversion)\s+rate|placed\s+over\s+\d+|filled\s+\d+\s+(?:roles?|positions?))\b/gi,
];

function checkCompanyClaims(
  text: string,
  ledger: Set<string>,
): SafetyFailure[] {
  const failures: SafetyFailure[] = [];
  for (const pattern of HIREIN_CLAIM_PATTERNS) {
    const matches = text.match(pattern) ?? [];
    for (const match of matches) {
      if (!ledgerContains(ledger, match.toLowerCase())) {
        const idx = text.toLowerCase().indexOf(match.toLowerCase());
        const sentence = text.slice(Math.max(0, idx - 40), idx + match.length + 80).trim();
        failures.push({
          code: "COMPANY_CLAIM_INVENTED",
          sentence,
          reason: `Hire'in or product claim "${match}" was not supplied by the user.`,
          missingSource: "Company performance claims, superlatives, and KPIs must be user-supplied facts.",
          recommendedCorrection: "Remove the company claim. Claim-free mode: omit rather than invent or annotate.",
          autoCorrectSafe: false,
        });
        break;
      }
    }
  }
  return failures;
}

// ---------------------------------------------------------------------------
// Main gate — runs all checks, returns structured result
// ---------------------------------------------------------------------------
export interface SafetyGateInput {
  generatedText: string;
  userSuppliedFacts?: string;
  contentGoal?: string;
  domain?: string;
  marketContext?: string;
}

export function runStaffingSafetyGate(input: SafetyGateInput): SafetyGateResult {
  const { generatedText, userSuppliedFacts, contentGoal, domain, marketContext } = input;
  const ledger = buildSourceLedger(userSuppliedFacts);
  const text = generatedText ?? "";

  const failures: SafetyFailure[] = [
    ...checkPlaceholders(text),
    ...checkBannedPhrases(text),
    ...checkJobMarketing(text, ledger, contentGoal),
    ...checkHealthcare(text, ledger, domain, contentGoal),
    ...checkIT(text, ledger, domain, contentGoal),
    ...checkGovernment(text, ledger, marketContext),
    ...checkCompanyClaims(text, ledger),
  ];

  const warnings: string[] = [];

  return {
    pass: failures.length === 0,
    failures,
    warnings,
  };
}
