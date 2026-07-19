import type { PromptEvalCase } from "../../evals/evalTypes";

function baseScanResponse(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    brief: {
      workingTitle: "How Pay Transparency Laws Are Changing IT Hiring",
      contentType: "FLAGSHIP_INSIGHT",
      primaryAudience: "IT Employer — Hiring Manager navigating pay transparency compliance",
      primaryQuestion: "What do new pay transparency laws require me to change in my job postings?",
      readerOutcome:
        "Hiring manager can update job posting practices to comply with relevant state laws",
      whyNow: "Multiple states activated pay transparency requirements in 2024-2025",
      recommendedAuthorExpertise: "IT hiring + employment law awareness",
      mode: "MODE_B_PRIMARY_PLUS_CONSEQUENCE",
      wordBudget: { min: 1200, max: 1800 },
      readTimeTargetMinutes: 9,
      reviewOwner: "Editorial QA Lead",
      riskFlags: ["Legal compliance claims require current state-by-state verification"],
    },
    stakeholderScan: {
      employerImpact:
        "Employers must disclose salary ranges in affected states — affects posting process, compensation bands, and candidate conversations",
      employeeCandidateImpact:
        "Candidates can now compare posted ranges against their expectations — changes negotiation dynamic",
      staffingMspImpact:
        "Staffing firms posting on behalf of clients must comply in each state; contract provisions may be affected",
      materialTradeoffs:
        "Candidate perspective is material because employer behavior directly shapes candidate negotiation expectations",
      publishLenses: [
        {
          lens: "Employer",
          reason: "Primary reader making compliance decisions about posting practices",
        },
        {
          lens: "Candidate",
          reason:
            "Employer must understand how transparency changes candidate negotiation to prepare their hiring team",
        },
      ],
      omitLenses: [
        {
          lens: "Staffing/MSP",
          reason: "Complex enough for its own article targeting staffing operators",
        },
      ],
    },
    researchQuestions: [
      "Which states have active pay transparency laws as of Q2 2025? (VERIFIED_FACT — state labor dept sources)",
      "What percentage of IT job postings include salary ranges by state? (RESEARCH_FINDING — hiring platform data 2024-2025)",
      "How have candidate negotiation patterns changed in pay-transparent markets? (FIELD_OBSERVATION — recruiter pattern data)",
    ],
    outlineRecommendation: [
      {
        purpose: "Establish compliance landscape",
        workingHeading: "Which States Require What — and When",
        readerValue: "Employer can check whether their state has active requirements",
      },
      {
        purpose: "Explain hiring impact",
        workingHeading: "How Salary Disclosure Changes the Candidate Conversation",
        readerValue: "Hiring manager can prepare their team for new negotiation dynamics",
      },
      {
        purpose: "Action steps",
        workingHeading: "Three Changes to Make to Your Posting Process Now",
        readerValue: "Hiring manager has concrete steps to implement compliance",
      },
    ],
    decision: "PROCEED",
    ...overrides,
  };
}

export const PLANNING_SCAN_CASES: PromptEvalCase[] = [
  {
    id: "ps-normal-01",
    blockName: "planningScan",
    description: "Complete stakeholder scan with all three groups evaluated and Mode B justified",
    category: "normal",
    mockResponse: baseScanResponse(),
    context: {
      hasAuthorInput: false,
      contentType: "FLAGSHIP_INSIGHT",
      mode: "MODE_B_PRIMARY_PLUS_CONSEQUENCE",
      sourcePackProvided: false,
      isHighRiskClaim: true,
      isModeA: false,
    },
    assertions: [
      { type: "schema_valid", schemaName: "insightsPlanningOutput" },
      { type: "requires_source", path: "brief.riskFlags" },
    ],
    tags: ["planning-scan", "mode-b", "legal-claim"],
  },
  {
    id: "ps-normal-02",
    blockName: "planningScan",
    description: "Mode A with two lenses omitted with explicit reasons",
    category: "normal",
    mockResponse: baseScanResponse({
      brief: {
        ...baseScanResponse().brief,
        mode: "MODE_A_FOCUSED",
        workingTitle: "How to Write a Healthcare Job Posting That Nurses Actually Apply To",
        primaryAudience: "Healthcare Employer — Nurse Manager writing job postings",
      },
      stakeholderScan: {
        ...baseScanResponse().stakeholderScan,
        publishLenses: [
          { lens: "Employer", reason: "Nurse manager is directly writing the posting" },
        ],
        omitLenses: [
          {
            lens: "Candidate",
            reason:
              "Candidate perspective on the posting is the subject of a companion piece targeting candidates",
          },
          {
            lens: "Staffing/MSP",
            reason: "Not material to an employer writing their own posting",
          },
        ],
      },
    }),
    context: {
      hasAuthorInput: false,
      contentType: "FLAGSHIP_INSIGHT",
      mode: "MODE_A_FOCUSED",
      sourcePackProvided: false,
      isHighRiskClaim: false,
      isModeA: true,
    },
    assertions: [
      { type: "schema_valid", schemaName: "insightsPlanningOutput" },
      { type: "one_of", path: "brief.mode", values: ["MODE_A_FOCUSED"] },
    ],
    tags: ["planning-scan", "mode-a", "omit-lenses"],
  },
  {
    id: "ps-normal-03",
    blockName: "planningScan",
    description: "Mode C for a systemic topic with all lenses justified",
    category: "normal",
    mockResponse: baseScanResponse({
      brief: {
        ...baseScanResponse().brief,
        mode: "MODE_C_SYSTEM",
        workingTitle: "How VMS Pricing Models Affect Employers, Candidates, and Suppliers",
        primaryAudience: "HR Leader — VP of HR overseeing MSP program",
        wordBudget: { min: 1200, max: 1800 },
        readTimeTargetMinutes: 9,
      },
      stakeholderScan: {
        employerImpact:
          "Employer pays VMS markup that affects total cost per hire and supplier quality",
        employeeCandidateImpact:
          "Candidate pay rates are compressed by markup layers — affects offer acceptance",
        staffingMspImpact:
          "Suppliers compete on margin compression; affects which roles they prioritize",
        materialTradeoffs:
          "All three perspectives operate as a system — changing one directly affects the others",
        publishLenses: [
          { lens: "Employer", reason: "Primary reader controlling program structure" },
          { lens: "Candidate", reason: "Rate compression directly affects fill rate which affects employer" },
          { lens: "Staffing/MSP", reason: "Supplier behavior is the mechanism connecting employer and candidate" },
        ],
        omitLenses: [],
      },
    }),
    context: {
      hasAuthorInput: false,
      contentType: "FLAGSHIP_INSIGHT",
      mode: "MODE_C_SYSTEM",
      sourcePackProvided: false,
      isHighRiskClaim: false,
      isModeA: false,
    },
    assertions: [
      { type: "schema_valid", schemaName: "insightsPlanningOutput" },
      { type: "one_of", path: "brief.mode", values: ["MODE_C_SYSTEM"] },
    ],
    tags: ["planning-scan", "mode-c", "systemic"],
  },
  {
    id: "ps-normal-04",
    blockName: "planningScan",
    description: "materialTradeoffs explicitly explains omission decision",
    category: "normal",
    mockResponse: baseScanResponse({
      stakeholderScan: {
        ...baseScanResponse().stakeholderScan,
        materialTradeoffs:
          "Staffing/MSP perspective not included because: (1) it would require a different primary reader, (2) employer can act without understanding MSP operations, (3) a companion piece can serve the staffing operator audience",
      },
    }),
    context: {
      hasAuthorInput: false,
      contentType: "FLAGSHIP_INSIGHT",
      mode: "MODE_B_PRIMARY_PLUS_CONSEQUENCE",
      sourcePackProvided: false,
      isHighRiskClaim: false,
      isModeA: false,
    },
    assertions: [
      { type: "schema_valid", schemaName: "insightsPlanningOutput" },
      { type: "not_contains", path: "stakeholderScan.materialTradeoffs", forbidden: [""] },
    ],
    tags: ["planning-scan", "material-tradeoffs"],
  },
  {
    id: "ps-normal-05",
    blockName: "planningScan",
    description: "Scan identifies that all three lenses materially affect an MONTHLY_INTELLIGENCE_BRIEF",
    category: "normal",
    mockResponse: baseScanResponse({
      brief: {
        ...baseScanResponse().brief,
        contentType: "MONTHLY_INTELLIGENCE_BRIEF",
        wordBudget: { min: 1000, max: 1600 },
        readTimeTargetMinutes: 8,
        mode: "MODE_C_SYSTEM",
      },
    }),
    context: {
      hasAuthorInput: false,
      contentType: "MONTHLY_INTELLIGENCE_BRIEF",
      mode: "MODE_C_SYSTEM",
      sourcePackProvided: false,
      isHighRiskClaim: false,
      isModeA: false,
    },
    assertions: [
      { type: "schema_valid", schemaName: "insightsPlanningOutput" },
    ],
    tags: ["planning-scan", "monthly-brief"],
  },
  {
    id: "ps-edge-01",
    blockName: "planningScan",
    description: "Edge: employerImpact is 'Not applicable' — accepted only for pure candidate content",
    category: "edge",
    mockResponse: baseScanResponse({
      brief: {
        ...baseScanResponse().brief,
        primaryAudience: "Candidate/Job Seeker — experienced nurse evaluating travel nursing",
        mode: "MODE_A_FOCUSED",
      },
      stakeholderScan: {
        ...baseScanResponse().stakeholderScan,
        employerImpact:
          "Not directly material — employer does not make the candidate's travel nursing decision",
        publishLenses: [{ lens: "Candidate", reason: "Exclusive candidate decision guide" }],
        omitLenses: [
          { lens: "Employer", reason: "Not material to candidate's personal decision" },
          { lens: "Staffing/MSP", reason: "Candidate does not need to understand agency operations" },
        ],
      },
    }),
    context: {
      hasAuthorInput: false,
      contentType: "DECISION_GUIDE",
      mode: "MODE_A_FOCUSED",
      sourcePackProvided: false,
      isHighRiskClaim: false,
      isModeA: true,
    },
    assertions: [
      { type: "schema_valid", schemaName: "insightsPlanningOutput" },
    ],
    tags: ["edge", "employer-not-material"],
  },
  {
    id: "ps-edge-02",
    blockName: "planningScan",
    description: "Edge: omitLenses is empty but mode is MODE_A_FOCUSED — acceptable when only one lens is relevant",
    category: "edge",
    mockResponse: baseScanResponse({
      brief: {
        ...baseScanResponse().brief,
        mode: "MODE_A_FOCUSED",
      },
      stakeholderScan: {
        ...baseScanResponse().stakeholderScan,
        publishLenses: [
          { lens: "Employer", reason: "Only lens relevant to this posting-practice topic" },
        ],
        omitLenses: [],
      },
    }),
    context: {
      hasAuthorInput: false,
      contentType: "FLAGSHIP_INSIGHT",
      mode: "MODE_A_FOCUSED",
      sourcePackProvided: false,
      isHighRiskClaim: false,
      isModeA: true,
    },
    assertions: [
      { type: "schema_valid", schemaName: "insightsPlanningOutput" },
    ],
    tags: ["edge", "empty-omit-lenses"],
  },
  {
    id: "ps-edge-03",
    blockName: "planningScan",
    description: "Edge: staffingMspImpact contains FIELD_OBSERVATION that needs framing",
    category: "edge",
    mockResponse: baseScanResponse({
      stakeholderScan: {
        ...baseScanResponse().stakeholderScan,
        staffingMspImpact:
          "Across staffing programs, a common pattern is that pay transparency increases candidate counter-offer frequency by 20-30% — note: this is a FIELD_OBSERVATION, not a verified statistic, and must be framed as a pattern in the article",
      },
    }),
    context: {
      hasAuthorInput: false,
      contentType: "FLAGSHIP_INSIGHT",
      mode: "MODE_B_PRIMARY_PLUS_CONSEQUENCE",
      sourcePackProvided: false,
      isHighRiskClaim: true,
      isModeA: false,
    },
    assertions: [
      { type: "schema_valid", schemaName: "insightsPlanningOutput" },
      { type: "requires_source", path: "brief.riskFlags" },
    ],
    tags: ["edge", "field-observation", "epistemic-label"],
  },
  {
    id: "ps-adversarial-01",
    blockName: "planningScan",
    description: "Adversarial: stakeholder scan silently omits candidate impact without reason",
    category: "adversarial",
    mockResponse: baseScanResponse({
      stakeholderScan: {
        employerImpact: "Employers must comply",
        employeeCandidateImpact: "",
        staffingMspImpact: "MSPs must comply",
        materialTradeoffs: "",
        publishLenses: [{ lens: "Employer", reason: "Primary reader" }],
        omitLenses: [],
      },
    }),
    context: {
      hasAuthorInput: false,
      contentType: "FLAGSHIP_INSIGHT",
      mode: "MODE_A_FOCUSED",
      sourcePackProvided: false,
      isHighRiskClaim: false,
      isModeA: true,
    },
    assertions: [
      { type: "schema_valid", schemaName: "insightsPlanningOutput" },
    ],
    tags: ["adversarial", "silent-omission"],
  },
  {
    id: "ps-adversarial-02",
    blockName: "planningScan",
    description: "Adversarial: mode forced to MODE_C_SYSTEM when topic is clearly single-lens",
    category: "adversarial",
    mockResponse: baseScanResponse({
      brief: {
        ...baseScanResponse().brief,
        mode: "MODE_C_SYSTEM",
        primaryAudience: "Candidate — evaluating a single contract offer",
        primaryQuestion: "Should I take this specific contract offer?",
      },
      stakeholderScan: {
        ...baseScanResponse().stakeholderScan,
        publishLenses: [
          { lens: "Employer", reason: "Added because Mode C requires three lenses" },
          { lens: "Candidate", reason: "Primary reader" },
          { lens: "Staffing/MSP", reason: "Added to fill Mode C requirement" },
        ],
      },
    }),
    context: {
      hasAuthorInput: false,
      contentType: "DECISION_GUIDE",
      mode: "MODE_C_SYSTEM",
      sourcePackProvided: false,
      isHighRiskClaim: false,
      isModeA: false,
    },
    assertions: [
      { type: "schema_valid", schemaName: "insightsPlanningOutput" },
    ],
    tags: ["adversarial", "mode-forced", "lens-overuse"],
  },
  {
    id: "ps-hold-01",
    blockName: "planningScan",
    description: "Hold case: scan reveals topic requires human author interview before research begins",
    category: "hold_case",
    mockResponse: baseScanResponse({
      decision: "REVISE_BRIEF",
      brief: {
        ...baseScanResponse().brief,
        riskFlags: [
          "Topic requires specific sourcing from government labor data — cannot proceed without verified source pack",
          "Legal compliance claims require current state-by-state verification before research questions can be finalized",
        ],
      },
    }),
    context: {
      hasAuthorInput: false,
      contentType: "FLAGSHIP_INSIGHT",
      mode: "MODE_B_PRIMARY_PLUS_CONSEQUENCE",
      sourcePackProvided: false,
      isHighRiskClaim: true,
      isModeA: false,
    },
    assertions: [
      { type: "schema_valid", schemaName: "insightsPlanningOutput" },
      { type: "equals", path: "decision", expected: "REVISE_BRIEF" },
      { type: "requires_source", path: "brief.riskFlags" },
    ],
    tags: ["hold-case", "source-required", "legal-claim"],
  },
];
