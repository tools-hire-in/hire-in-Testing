import type { PromptEvalCase } from "../../evals/evalTypes";

function basePlanningResponse(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    brief: {
      workingTitle: "Navigating Your First Contract Role in Healthcare IT",
      contentType: "DECISION_GUIDE",
      primaryAudience: "Candidate/Job Seeker — IT professional considering first contract role",
      primaryQuestion: "How do I evaluate whether a contract role is worth taking?",
      readerOutcome:
        "Reader can evaluate their specific contract offer against five criteria and make a confident decision",
      whyNow: "Contract volumes up 18% YoY; many permanent employees considering first contract",
      recommendedAuthorExpertise: "IT contract placement with candidate counseling experience",
      mode: "MODE_A_FOCUSED",
      wordBudget: { min: 700, max: 1100 },
      readTimeTargetMinutes: 5,
      riskFlags: [],
    },
    stakeholderScan: {
      employerImpact: "Not material — employer controls contract terms, not the candidate's decision",
      employeeCandidateImpact:
        "Primary reader faces real financial and career risk in contract decision",
      staffingMspImpact: "Not material to candidate's personal decision",
      materialTradeoffs: "Candidate needs information that changes their decision — employer lens excluded",
      publishLenses: [
        { lens: "Candidate", reason: "This is exclusively a candidate decision guide" },
      ],
      omitLenses: [
        { lens: "Employer", reason: "Does not affect the candidate's evaluation framework" },
        { lens: "Staffing/MSP", reason: "Not material to personal contract decision" },
      ],
    },
    researchQuestions: [
      "What are the standard contract rates for IT roles in healthcare in 2025? (VERIFIED_FACT — BLS or market rate surveys)",
      "What are the top reasons IT contractors do not renew? (FIELD_OBSERVATION — staffing agency pattern data)",
    ],
    outlineRecommendation: [
      {
        purpose: "Name the decision",
        workingHeading: "What You're Actually Deciding",
        readerValue: "Reader understands the five-factor evaluation framework",
      },
      {
        purpose: "Apply the framework",
        workingHeading: "How to Read a Contract Offer in Under an Hour",
        readerValue: "Reader can complete the evaluation before accepting or declining",
      },
    ],
    decision: "PROCEED",
    ...overrides,
  };
}

export const PRIMARY_READER_CASES: PromptEvalCase[] = [
  {
    id: "pr-normal-01",
    blockName: "primaryReader",
    description: "Single candidate reader with specific decision — textbook Mode A",
    category: "normal",
    mockResponse: basePlanningResponse(),
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
      { type: "not_contains", path: "brief.primaryAudience", forbidden: ["and", "employers and"] },
      { type: "one_of", path: "decision", values: ["PROCEED"] },
    ],
    tags: ["primary-reader", "single-audience", "mode-a"],
  },
  {
    id: "pr-normal-02",
    blockName: "primaryReader",
    description: "Healthcare Employer as primary reader with credential verification question",
    category: "normal",
    mockResponse: basePlanningResponse({
      brief: {
        ...basePlanningResponse().brief,
        workingTitle: "Credential Verification Gaps That Delay Healthcare Placements",
        contentType: "FLAGSHIP_INSIGHT",
        primaryAudience:
          "Healthcare Employer — Clinical Director responsible for contingent workforce",
        primaryQuestion:
          "Which credential verification gaps am I most likely to miss before submission?",
        readerOutcome:
          "Clinical Director can audit their current credential checklist and close the top three gaps",
        wordBudget: { min: 1200, max: 1800 },
        readTimeTargetMinutes: 9,
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
      { type: "not_contains", path: "brief.primaryAudience", forbidden: ["all audiences", "general"] },
    ],
    tags: ["primary-reader", "healthcare", "employer"],
  },
  {
    id: "pr-normal-03",
    blockName: "primaryReader",
    description: "Staffing/MSP operator primary reader with program performance question",
    category: "normal",
    mockResponse: basePlanningResponse({
      brief: {
        ...basePlanningResponse().brief,
        workingTitle: "Why Your VMS Aging Report Is Hiding Your Biggest Submittal Problem",
        contentType: "FLAGSHIP_INSIGHT",
        primaryAudience:
          "Staffing/MSP Operator — Account Manager responsible for requisition aging",
        primaryQuestion: "Where in the submittal process is my program losing the most time?",
        readerOutcome: "Account manager can identify and address the top aging chokepoint in their VMS",
        wordBudget: { min: 1200, max: 1800 },
        readTimeTargetMinutes: 9,
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
      { type: "not_contains", path: "brief.primaryAudience", forbidden: ["employers and candidates"] },
    ],
    tags: ["primary-reader", "msp", "operator"],
  },
  {
    id: "pr-normal-04",
    blockName: "primaryReader",
    description: "HR Leader primary reader with workforce strategy question",
    category: "normal",
    mockResponse: basePlanningResponse({
      brief: {
        ...basePlanningResponse().brief,
        workingTitle: "When to Shift from Permanent to Contingent Workforce Expansion",
        contentType: "DECISION_GUIDE",
        primaryAudience:
          "HR Leader — VP of HR making build vs. contract workforce decisions",
        primaryQuestion:
          "How do I decide whether to expand headcount permanently or through contingent staffing?",
        readerOutcome:
          "HR VP has a framework to evaluate the next expansion decision based on role type, timeline, and budget",
        wordBudget: { min: 700, max: 1100 },
        readTimeTargetMinutes: 5,
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
      { type: "not_contains", path: "brief.primaryQuestion", forbidden: ["everyone", "all readers"] },
    ],
    tags: ["primary-reader", "hr-leader"],
  },
  {
    id: "pr-normal-05",
    blockName: "primaryReader",
    description: "Recruiter/Operator primary reader with AI tool adoption question",
    category: "normal",
    mockResponse: basePlanningResponse({
      brief: {
        ...basePlanningResponse().brief,
        workingTitle: "How to Use AI Screening Tools Without Letting Them Replace Your Judgment",
        contentType: "TOOL_TECH_WATCH",
        primaryAudience:
          "Recruiter/Staffing Operator — Recruiter adopting AI screening tools",
        primaryQuestion: "Which parts of the screening process should I still own personally after adding AI?",
        readerOutcome:
          "Recruiter has a clear map of where AI supports vs. where human judgment is non-negotiable",
        wordBudget: { min: 800, max: 1300 },
        readTimeTargetMinutes: 6,
      },
    }),
    context: {
      hasAuthorInput: false,
      contentType: "TOOL_TECH_WATCH",
      mode: "MODE_A_FOCUSED",
      sourcePackProvided: false,
      isHighRiskClaim: false,
      isModeA: true,
    },
    assertions: [
      { type: "schema_valid", schemaName: "insightsPlanningOutput" },
    ],
    tags: ["primary-reader", "recruiter", "ai-tools"],
  },
  {
    id: "pr-edge-01",
    blockName: "primaryReader",
    description: "Edge: vague primary audience that requires narrowing — model should flag",
    category: "edge",
    mockResponse: basePlanningResponse({
      decision: "REVISE_BRIEF",
      brief: {
        ...basePlanningResponse().brief,
        primaryAudience: "Healthcare professionals and employers",
        riskFlags: [
          "Primary audience spans both candidates and employers — requires narrowing to one specific decision-maker",
        ],
      },
    }),
    context: {
      hasAuthorInput: false,
      contentType: "FLAGSHIP_INSIGHT",
      mode: "MODE_A_FOCUSED",
      sourcePackProvided: false,
      isHighRiskClaim: false,
      isModeA: false,
    },
    assertions: [
      { type: "schema_valid", schemaName: "insightsPlanningOutput" },
      { type: "equals", path: "decision", expected: "REVISE_BRIEF" },
    ],
    tags: ["edge", "vague-audience", "narrowing"],
  },
  {
    id: "pr-edge-02",
    blockName: "primaryReader",
    description: "Edge: primaryQuestion is a yes/no question with no decision framework",
    category: "edge",
    mockResponse: basePlanningResponse({
      brief: {
        ...basePlanningResponse().brief,
        primaryQuestion: "Should I use a staffing agency?",
        riskFlags: ["Question is binary — needs a decision framework, not a yes/no answer"],
      },
      decision: "REVISE_BRIEF",
    }),
    context: {
      hasAuthorInput: false,
      contentType: "DECISION_GUIDE",
      mode: "MODE_A_FOCUSED",
      sourcePackProvided: false,
      isHighRiskClaim: false,
      isModeA: false,
    },
    assertions: [
      { type: "schema_valid", schemaName: "insightsPlanningOutput" },
      { type: "equals", path: "decision", expected: "REVISE_BRIEF" },
    ],
    tags: ["edge", "yes-no-question"],
  },
  {
    id: "pr-edge-03",
    blockName: "primaryReader",
    description: "Edge: readerOutcome does not connect to a concrete action",
    category: "edge",
    mockResponse: basePlanningResponse({
      brief: {
        ...basePlanningResponse().brief,
        readerOutcome: "The reader will feel informed about staffing",
        riskFlags: ["readerOutcome is inspirational, not action-oriented — revise to name a specific decision or action"],
      },
      decision: "REVISE_BRIEF",
    }),
    context: {
      hasAuthorInput: false,
      contentType: "FLAGSHIP_INSIGHT",
      mode: "MODE_A_FOCUSED",
      sourcePackProvided: false,
      isHighRiskClaim: false,
      isModeA: false,
    },
    assertions: [
      { type: "schema_valid", schemaName: "insightsPlanningOutput" },
    ],
    tags: ["edge", "reader-outcome", "action-oriented"],
  },
  {
    id: "pr-adversarial-01",
    blockName: "primaryReader",
    description: "Adversarial: model lists multiple primary readers without narrowing",
    category: "adversarial",
    mockResponse: basePlanningResponse({
      brief: {
        ...basePlanningResponse().brief,
        primaryAudience: "Employers and candidates and staffing firms",
        primaryQuestion: "How does staffing work for everyone involved?",
      },
      decision: "PROCEED",
    }),
    context: {
      hasAuthorInput: false,
      contentType: "FLAGSHIP_INSIGHT",
      mode: "MODE_A_FOCUSED",
      sourcePackProvided: false,
      isHighRiskClaim: false,
      isModeA: false,
    },
    assertions: [
      { type: "schema_valid", schemaName: "insightsPlanningOutput" },
      { type: "not_contains", path: "brief.primaryAudience", forbidden: ["and candidates and"] },
    ],
    tags: ["adversarial", "multi-audience"],
  },
  {
    id: "pr-adversarial-02",
    blockName: "primaryReader",
    description: "Adversarial: client name embedded in primaryAudience field",
    category: "adversarial",
    mockResponse: basePlanningResponse({
      brief: {
        ...basePlanningResponse().brief,
        primaryAudience: "John Smith at Acme Healthcare — VP of Nursing",
      },
    }),
    context: {
      hasAuthorInput: false,
      contentType: "FLAGSHIP_INSIGHT",
      mode: "MODE_A_FOCUSED",
      sourcePackProvided: false,
      isHighRiskClaim: false,
      isModeA: false,
    },
    assertions: [
      { type: "schema_valid", schemaName: "insightsPlanningOutput" },
    ],
    tags: ["adversarial", "pii", "client-name"],
  },
  {
    id: "pr-hold-01",
    blockName: "primaryReader",
    description: "Hold case: primaryQuestion requires author personal experience not yet collected",
    category: "hold_case",
    mockResponse: basePlanningResponse({
      decision: "REVISE_BRIEF",
      brief: {
        ...basePlanningResponse().brief,
        primaryQuestion: "Based on my 15 years in healthcare staffing, what makes a great submission?",
        riskFlags: [
          "Question references author personal experience — author interview required before proceeding",
          "AUTHOR_EXPERIENCE epistemic type required; no author input collected yet",
        ],
      },
      researchQuestions: [
        "Collect author's personal experience examples from interview before writing begins (AUTHOR_EXPERIENCE)",
      ],
    }),
    context: {
      hasAuthorInput: false,
      contentType: "FLAGSHIP_INSIGHT",
      mode: "MODE_A_FOCUSED",
      sourcePackProvided: false,
      isHighRiskClaim: false,
      isModeA: false,
    },
    assertions: [
      { type: "schema_valid", schemaName: "insightsPlanningOutput" },
      { type: "equals", path: "decision", expected: "REVISE_BRIEF" },
      { type: "no_first_person_without_input" },
    ],
    tags: ["hold-case", "author-experience", "human-input"],
  },
];
