import type { PromptEvalCase } from "../../evals/evalTypes";

function baseCompressionResponse(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    brief: {
      workingTitle: "The Three Places Healthcare Credential Checklists Break Down",
      contentType: "DECISION_GUIDE",
      primaryAudience: "Healthcare Employer — Nurse Manager managing contingent workforce",
      primaryQuestion: "Which credential checklist gaps should I close before my next submittal review?",
      readerOutcome:
        "Nurse manager can identify and close the top three credential gaps in under an hour",
      whyNow: "Q3 travel nursing season begins; credential delays are highest in August-September",
      recommendedAuthorExpertise: "Healthcare staffing with credential verification operations experience",
      mode: "MODE_A_FOCUSED",
      wordBudget: { min: 700, max: 1100 },
      readTimeTargetMinutes: 5,
      riskFlags: [],
    },
    stakeholderScan: {
      employerImpact: "Credential gaps delay placements, increase compliance risk, and extend time-to-fill",
      employeeCandidateImpact: "Not material to employer's checklist audit decision",
      staffingMspImpact: "Not material to employer's internal process",
      materialTradeoffs: "Topic is about employer's internal process — single lens appropriate",
      publishLenses: [
        { lens: "Employer", reason: "Primary reader doing the audit" },
      ],
      omitLenses: [
        { lens: "Candidate", reason: "Candidate experience is separate content" },
        { lens: "Staffing/MSP", reason: "MSP checklist process is a separate topic" },
      ],
    },
    researchQuestions: [
      "Which credential categories are most frequently incomplete at time of submittal? (FIELD_OBSERVATION — internal agency data or industry pattern data)",
      "What are the standard verification timelines for each credential category? (VERIFIED_FACT — JCAHO or state licensing board standards)",
    ],
    outlineRecommendation: [
      {
        purpose: "Name the three gaps",
        workingHeading: "The Three Places Checklists Break",
        readerValue: "Reader knows exactly where to look",
      },
      {
        purpose: "Audit framework",
        workingHeading: "A Checklist Audit You Can Complete in 45 Minutes",
        readerValue: "Reader has a concrete process to run immediately",
      },
    ],
    decision: "PROCEED",
    ...overrides,
  };
}

export const LENGTH_COMPRESSION_CASES: PromptEvalCase[] = [
  {
    id: "lc-normal-01",
    blockName: "lengthCompression",
    description: "DECISION_GUIDE with correct word budget and read time formula",
    category: "normal",
    mockResponse: baseCompressionResponse(),
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
      { type: "word_count", path: "brief.workingTitle", min: 3, max: 15 },
    ],
    tags: ["length", "compression", "word-budget", "read-time"],
  },
  {
    id: "lc-normal-02",
    blockName: "lengthCompression",
    description: "FIELD_SIGNAL with tight budget — under 500 words",
    category: "normal",
    mockResponse: baseCompressionResponse({
      brief: {
        ...baseCompressionResponse().brief,
        contentType: "FIELD_SIGNAL",
        wordBudget: { min: 250, max: 500 },
        readTimeTargetMinutes: 3,
        workingTitle: "Travel Nurse Supply Down 8% — What Hiring Teams Should Do This Week",
      },
    }),
    context: {
      hasAuthorInput: false,
      contentType: "FIELD_SIGNAL",
      mode: "MODE_A_FOCUSED",
      sourcePackProvided: false,
      isHighRiskClaim: false,
      isModeA: true,
    },
    assertions: [
      { type: "schema_valid", schemaName: "insightsPlanningOutput" },
    ],
    tags: ["length", "field-signal", "tight-budget"],
  },
  {
    id: "lc-normal-03",
    blockName: "lengthCompression",
    description: "FLAGSHIP_INSIGHT at max budget — 1800 words, 9 min read time",
    category: "normal",
    mockResponse: baseCompressionResponse({
      brief: {
        ...baseCompressionResponse().brief,
        contentType: "FLAGSHIP_INSIGHT",
        wordBudget: { min: 1200, max: 1800 },
        readTimeTargetMinutes: 9,
        workingTitle: "How Pay Compression in Healthcare Staffing Creates a Quiet Talent Crisis",
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
    tags: ["length", "flagship-insight", "max-budget"],
  },
  {
    id: "lc-normal-04",
    blockName: "lengthCompression",
    description: "EDITORIAL_PERSPECTIVE with moderate word count — 600-1100 words",
    category: "normal",
    mockResponse: baseCompressionResponse({
      brief: {
        ...baseCompressionResponse().brief,
        contentType: "EDITORIAL_PERSPECTIVE",
        wordBudget: { min: 600, max: 1100 },
        readTimeTargetMinutes: 5,
        workingTitle: "Why 'AI-Powered' Staffing Claims Are Mostly Marketing",
        primaryAudience: "HR Leader — evaluating AI staffing vendor claims",
      },
    }),
    context: {
      hasAuthorInput: false,
      contentType: "EDITORIAL_PERSPECTIVE",
      mode: "MODE_A_FOCUSED",
      sourcePackProvided: false,
      isHighRiskClaim: false,
      isModeA: true,
    },
    assertions: [
      { type: "schema_valid", schemaName: "insightsPlanningOutput" },
    ],
    tags: ["length", "editorial-perspective", "moderate-budget"],
  },
  {
    id: "lc-normal-05",
    blockName: "lengthCompression",
    description: "MONTHLY_INTELLIGENCE_BRIEF at correct 1000-1600 word budget",
    category: "normal",
    mockResponse: baseCompressionResponse({
      brief: {
        ...baseCompressionResponse().brief,
        contentType: "MONTHLY_INTELLIGENCE_BRIEF",
        wordBudget: { min: 1000, max: 1600 },
        readTimeTargetMinutes: 8,
        workingTitle: "Workforce Intelligence Brief — August 2025",
        primaryAudience: "HR Leader — VP of HR managing talent strategy",
      },
    }),
    context: {
      hasAuthorInput: false,
      contentType: "MONTHLY_INTELLIGENCE_BRIEF",
      mode: "MODE_A_FOCUSED",
      sourcePackProvided: false,
      isHighRiskClaim: false,
      isModeA: true,
    },
    assertions: [
      { type: "schema_valid", schemaName: "insightsPlanningOutput" },
    ],
    tags: ["length", "monthly-brief", "correct-budget"],
  },
  {
    id: "lc-edge-01",
    blockName: "lengthCompression",
    description: "Edge: word budget exceeds the content type ceiling — should flag",
    category: "edge",
    mockResponse: baseCompressionResponse({
      brief: {
        ...baseCompressionResponse().brief,
        contentType: "FIELD_SIGNAL",
        wordBudget: { min: 500, max: 1200 },
        readTimeTargetMinutes: 6,
        riskFlags: ["FIELD_SIGNAL budget (max 1200) exceeds content type ceiling (500 words) — compress to 250-500"],
      },
      decision: "REVISE_BRIEF",
    }),
    context: {
      hasAuthorInput: false,
      contentType: "FIELD_SIGNAL",
      mode: "MODE_A_FOCUSED",
      sourcePackProvided: false,
      isHighRiskClaim: false,
      isModeA: true,
    },
    assertions: [
      { type: "schema_valid", schemaName: "insightsPlanningOutput" },
      { type: "equals", path: "decision", expected: "REVISE_BRIEF" },
      { type: "requires_source", path: "brief.riskFlags" },
    ],
    tags: ["edge", "budget-exceeded", "field-signal"],
  },
  {
    id: "lc-edge-02",
    blockName: "lengthCompression",
    description: "Edge: readTimeTargetMinutes inconsistent with word budget formula",
    category: "edge",
    mockResponse: baseCompressionResponse({
      brief: {
        ...baseCompressionResponse().brief,
        wordBudget: { min: 700, max: 1100 },
        readTimeTargetMinutes: 2,
        riskFlags: ["readTimeTargetMinutes (2) inconsistent with budget max (1100÷220=5 min)"],
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
      { type: "requires_source", path: "brief.riskFlags" },
    ],
    tags: ["edge", "read-time-inconsistency"],
  },
  {
    id: "lc-edge-03",
    blockName: "lengthCompression",
    description: "Edge: outline has too many sections for the word budget",
    category: "edge",
    mockResponse: baseCompressionResponse({
      outlineRecommendation: [
        { purpose: "Section 1", workingHeading: "Background", readerValue: "Context" },
        { purpose: "Section 2", workingHeading: "Problem", readerValue: "Problem definition" },
        { purpose: "Section 3", workingHeading: "Data", readerValue: "Research findings" },
        { purpose: "Section 4", workingHeading: "Analysis", readerValue: "Interpretation" },
        { purpose: "Section 5", workingHeading: "Counter-argument", readerValue: "Balance" },
        { purpose: "Section 6", workingHeading: "Recommendation", readerValue: "Action" },
        { purpose: "Section 7", workingHeading: "Case example", readerValue: "Illustration" },
        { purpose: "Section 8", workingHeading: "Conclusion", readerValue: "Summary" },
      ],
      brief: {
        ...baseCompressionResponse().brief,
        riskFlags: ["8 outline sections exceeds what a 700-1100 word budget can support — compress to 3-4 sections"],
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
      { type: "requires_source", path: "brief.riskFlags" },
    ],
    tags: ["edge", "over-structured", "outline-compression"],
  },
  {
    id: "lc-adversarial-01",
    blockName: "lengthCompression",
    description: "Adversarial: word budget pressured to exceed content type ceiling in field signal",
    category: "adversarial",
    mockResponse: baseCompressionResponse({
      brief: {
        ...baseCompressionResponse().brief,
        contentType: "FIELD_SIGNAL",
        wordBudget: { min: 800, max: 1500 },
        readTimeTargetMinutes: 7,
        riskFlags: [],
      },
      decision: "PROCEED",
    }),
    context: {
      hasAuthorInput: false,
      contentType: "FIELD_SIGNAL",
      mode: "MODE_A_FOCUSED",
      sourcePackProvided: false,
      isHighRiskClaim: false,
      isModeA: true,
    },
    assertions: [
      { type: "schema_valid", schemaName: "insightsPlanningOutput" },
    ],
    tags: ["adversarial", "word-budget-pressure", "ceiling-exceeded"],
  },
  {
    id: "lc-adversarial-02",
    blockName: "lengthCompression",
    description: "Adversarial: readTimeTargetMinutes set to zero",
    category: "adversarial",
    mockResponse: baseCompressionResponse({
      brief: {
        ...baseCompressionResponse().brief,
        readTimeTargetMinutes: 0,
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
    tags: ["adversarial", "zero-read-time"],
  },
  {
    id: "lc-hold-01",
    blockName: "lengthCompression",
    description: "Hold case: word budget requires human editorial decision on scope",
    category: "hold_case",
    mockResponse: baseCompressionResponse({
      decision: "REVISE_BRIEF",
      brief: {
        ...baseCompressionResponse().brief,
        riskFlags: [
          "Topic scope requires human editorial judgment on which sections to include within the 700-1100 word ceiling",
          "Recommend editor review outline before research begins to avoid over-scoped draft",
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
      { type: "equals", path: "decision", expected: "REVISE_BRIEF" },
      { type: "requires_source", path: "brief.riskFlags" },
    ],
    tags: ["hold-case", "editorial-scope", "compression"],
  },
];
