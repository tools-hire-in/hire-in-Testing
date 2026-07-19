import type { PromptEvalCase } from "../../evals/evalTypes";

function baseLensResponse(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    brief: {
      workingTitle: "What AI Resume Screening Actually Gets Wrong",
      contentType: "TOOL_TECH_WATCH",
      primaryAudience: "IT Employer — Engineering Manager using AI screening tools",
      primaryQuestion:
        "What are the systematic gaps I should audit in my AI resume screening setup?",
      readerOutcome:
        "Engineering manager can identify which screening criteria to double-check after AI review",
      whyNow: "AI screening adoption accelerated in 2024-2025; systematic gaps now visible in hiring data",
      recommendedAuthorExpertise: "IT hiring + AI screening tool evaluation experience",
      mode: "MODE_A_FOCUSED",
      wordBudget: { min: 800, max: 1300 },
      readTimeTargetMinutes: 6,
      riskFlags: [],
    },
    stakeholderScan: {
      employerImpact:
        "Employers using AI screening risk systematic bias in candidate selection — affects quality, diversity, and legal exposure",
      employeeCandidateImpact:
        "Candidates with non-linear career paths may be filtered out incorrectly — material but not the primary focus",
      staffingMspImpact:
        "Staffing firms using AI screening face same risks in their submittal quality — separate operational topic",
      materialTradeoffs:
        "Candidate perspective informs what to look for in audit but is not the primary reader's decision context",
      publishLenses: [
        {
          lens: "Employer",
          reason: "Primary reader directly controlling screening criteria and tool configuration",
        },
      ],
      omitLenses: [
        {
          lens: "Candidate",
          reason:
            "Candidate impact is noted in the audit criteria but the employer makes the decision — a candidate-facing version is a separate piece",
        },
        {
          lens: "Staffing/MSP",
          reason:
            "Staffing firm screening operations are a separate topic with a different primary reader",
        },
      ],
    },
    researchQuestions: [
      "What categories of screening criteria are most commonly misconfigured in AI tools? (RESEARCH_FINDING — vendor bias audits 2023-2025)",
      "What types of candidate profiles are most frequently misclassified? (FIELD_OBSERVATION — recruiter pattern data)",
    ],
    outlineRecommendation: [
      {
        purpose: "Name the systematic gaps",
        workingHeading: "Four Things AI Screening Consistently Gets Wrong",
        readerValue: "Employer knows which gaps to audit immediately",
      },
      {
        purpose: "Provide audit framework",
        workingHeading: "How to Audit Your Current Screening Setup in Two Hours",
        readerValue: "Employer can run an audit this week",
      },
    ],
    decision: "PROCEED",
    ...overrides,
  };
}

export const LENS_INCLUSION_CASES: PromptEvalCase[] = [
  {
    id: "li-normal-01",
    blockName: "lensInclusion",
    description: "Mode A with one lens, two omitted with clear materiality reasons",
    category: "normal",
    mockResponse: baseLensResponse(),
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
      { type: "one_of", path: "brief.mode", values: ["MODE_A_FOCUSED"] },
    ],
    tags: ["lens-inclusion", "mode-a", "omit-reasons"],
  },
  {
    id: "li-normal-02",
    blockName: "lensInclusion",
    description: "Mode B candidate lens materially affects employer's credential decision",
    category: "normal",
    mockResponse: baseLensResponse({
      brief: {
        ...baseLensResponse().brief,
        workingTitle: "Why Credential Verification Delays Keep Happening",
        mode: "MODE_B_PRIMARY_PLUS_CONSEQUENCE",
        primaryAudience: "Healthcare Employer — Nurse Manager",
        primaryQuestion: "How do I reduce credential delays in my contingent nurse hiring?",
      },
      stakeholderScan: {
        ...baseLensResponse().stakeholderScan,
        publishLenses: [
          { lens: "Employer", reason: "Primary reader making hiring process decisions" },
          {
            lens: "Candidate",
            reason:
              "Candidate experience during verification is the mechanism causing delays — employer must understand this to fix the problem",
          },
        ],
        omitLenses: [
          { lens: "Staffing/MSP", reason: "Separate operational piece for staffing operators" },
        ],
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
      { type: "one_of", path: "brief.mode", values: ["MODE_B_PRIMARY_PLUS_CONSEQUENCE"] },
    ],
    tags: ["lens-inclusion", "mode-b", "materiality"],
  },
  {
    id: "li-normal-03",
    blockName: "lensInclusion",
    description: "All five materiality questions answered implicitly in lens reasons",
    category: "normal",
    mockResponse: baseLensResponse({
      stakeholderScan: {
        ...baseLensResponse().stakeholderScan,
        omitLenses: [
          {
            lens: "Candidate",
            reason:
              "Does not change what employer decides (Q1 no); information is not new to employer (Q2 no); including it makes article less focused (Q3 trade-off: omit); can be served by a separate candidate-facing article (Q5 yes)",
          },
          {
            lens: "Staffing/MSP",
            reason:
              "Not material to an employer configuring their own screening tools (Q1 no); staffing operator audience requires separate piece (Q5 yes)",
          },
        ],
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
    tags: ["lens-inclusion", "materiality-test", "five-questions"],
  },
  {
    id: "li-normal-04",
    blockName: "lensInclusion",
    description: "Mode C with systemic justification for all three lenses",
    category: "normal",
    mockResponse: baseLensResponse({
      brief: {
        ...baseLensResponse().brief,
        mode: "MODE_C_SYSTEM",
        workingTitle: "How Mark-Up Compression in VMS Programs Affects Everyone in the Chain",
        wordBudget: { min: 1200, max: 1800 },
        readTimeTargetMinutes: 9,
      },
      stakeholderScan: {
        employerImpact: "Employer pays gross mark-up that determines which suppliers engage",
        employeeCandidateImpact: "Candidate pay is compressed as mark-up layers accumulate",
        staffingMspImpact: "Supplier margin determines which requisitions get prioritized",
        materialTradeoffs:
          "Mark-up compression creates a simultaneous effect across all three stakeholders — cannot be explained from one perspective alone",
        publishLenses: [
          { lens: "Employer", reason: "Controls program structure and markup budget" },
          {
            lens: "Candidate",
            reason: "Pay compression directly affects acceptance rates which feeds back to employer fill rates",
          },
          {
            lens: "Staffing/MSP",
            reason:
              "Supplier prioritization behavior is the mechanism linking employer decisions to candidate outcomes",
          },
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
    tags: ["lens-inclusion", "mode-c", "systemic-justification"],
  },
  {
    id: "li-normal-05",
    blockName: "lensInclusion",
    description: "FIELD_SIGNAL with only one lens — appropriate for rapid signal format",
    category: "normal",
    mockResponse: baseLensResponse({
      brief: {
        ...baseLensResponse().brief,
        contentType: "FIELD_SIGNAL",
        wordBudget: { min: 250, max: 500 },
        readTimeTargetMinutes: 3,
        mode: "MODE_A_FOCUSED",
      },
      stakeholderScan: {
        ...baseLensResponse().stakeholderScan,
        publishLenses: [{ lens: "Employer", reason: "Sole material reader for this signal" }],
        omitLenses: [
          { lens: "Candidate", reason: "Signal is operational, not candidate-facing" },
          { lens: "Staffing/MSP", reason: "Separate signal for staffing operators" },
        ],
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
    tags: ["lens-inclusion", "field-signal", "single-lens"],
  },
  {
    id: "li-edge-01",
    blockName: "lensInclusion",
    description: "Edge: candidate lens included in Mode A with inadequate reason — should trigger flag",
    category: "edge",
    mockResponse: baseLensResponse({
      brief: {
        ...baseLensResponse().brief,
        mode: "MODE_A_FOCUSED",
        riskFlags: [
          "Two lenses published in Mode A — review materiality test or upgrade to Mode B",
        ],
      },
      stakeholderScan: {
        ...baseLensResponse().stakeholderScan,
        publishLenses: [
          { lens: "Employer", reason: "Primary reader" },
          { lens: "Candidate", reason: "Interesting to include" },
        ],
        omitLenses: [{ lens: "Staffing/MSP", reason: "Not relevant" }],
      },
      decision: "REVISE_BRIEF",
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
      { type: "requires_source", path: "brief.riskFlags" },
    ],
    tags: ["edge", "lens-overuse", "mode-a-violation"],
  },
  {
    id: "li-edge-02",
    blockName: "lensInclusion",
    description: "Edge: omitLenses has empty reason strings",
    category: "edge",
    mockResponse: baseLensResponse({
      stakeholderScan: {
        ...baseLensResponse().stakeholderScan,
        omitLenses: [
          { lens: "Candidate", reason: "" },
          { lens: "Staffing/MSP", reason: "" },
        ],
        publishLenses: [{ lens: "Employer", reason: "Primary reader" }],
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
    tags: ["edge", "empty-omit-reason"],
  },
  {
    id: "li-edge-03",
    blockName: "lensInclusion",
    description: "Edge: publishLenses has no lens for the primary reader",
    category: "edge",
    mockResponse: baseLensResponse({
      stakeholderScan: {
        ...baseLensResponse().stakeholderScan,
        publishLenses: [
          { lens: "Candidate", reason: "More interesting than employer perspective" },
        ],
        omitLenses: [
          { lens: "Employer", reason: "Less interesting" },
          { lens: "Staffing/MSP", reason: "Not relevant" },
        ],
      },
      brief: {
        ...baseLensResponse().brief,
        riskFlags: ["Published lens does not include the primary reader's perspective"],
      },
      decision: "REVISE_BRIEF",
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
      { type: "equals", path: "decision", expected: "REVISE_BRIEF" },
    ],
    tags: ["edge", "primary-reader-omitted"],
  },
  {
    id: "li-adversarial-01",
    blockName: "lensInclusion",
    description: "Adversarial: Mode A output has three lenses without any flagging",
    category: "adversarial",
    mockResponse: baseLensResponse({
      brief: {
        ...baseLensResponse().brief,
        mode: "MODE_A_FOCUSED",
        riskFlags: [],
      },
      stakeholderScan: {
        ...baseLensResponse().stakeholderScan,
        publishLenses: [
          { lens: "Employer", reason: "Primary reader" },
          { lens: "Candidate", reason: "Their experience matters" },
          { lens: "Staffing/MSP", reason: "They should be included too" },
        ],
        omitLenses: [],
      },
      decision: "PROCEED",
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
    tags: ["adversarial", "lens-overuse", "mode-a"],
  },
  {
    id: "li-adversarial-02",
    blockName: "lensInclusion",
    description: "Adversarial: stakeholder headings in content for Mode A without inclusion reason",
    category: "adversarial",
    mockResponse: baseLensResponse({
      outlineRecommendation: [
        {
          purpose: "Employer section",
          workingHeading: "For Employers: What AI Screening Gets Wrong",
          readerValue: "Employer perspective",
        },
        {
          purpose: "Candidate section",
          workingHeading: "For Candidates: How to Get Past AI Screening",
          readerValue: "Candidate perspective — included without materiality justification",
        },
        {
          purpose: "Staffing section",
          workingHeading: "For Staffing Firms: Optimizing Your AI Screening",
          readerValue: "MSP perspective — not justified",
        },
      ],
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
    tags: ["adversarial", "stakeholder-headings", "mode-a-violation"],
  },
  {
    id: "li-hold-01",
    blockName: "lensInclusion",
    description: "Hold case: lens decision requires human editorial judgment before proceeding",
    category: "hold_case",
    mockResponse: baseLensResponse({
      decision: "REVISE_BRIEF",
      brief: {
        ...baseLensResponse().brief,
        riskFlags: [
          "Candidate and Staffing/MSP lenses appear equally material — requires editorial judgment call before mode is set",
          "Recommend human editor review before Mode B vs Mode C decision is finalized",
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
      { type: "requires_source", path: "brief.riskFlags" },
    ],
    tags: ["hold-case", "human-editorial-judgment"],
  },
];
