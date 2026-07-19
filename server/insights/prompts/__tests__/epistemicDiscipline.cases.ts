import type { PromptEvalCase } from "../../evals/evalTypes";

function baseEpistemicResponse(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    brief: {
      workingTitle: "What the Research Actually Says About AI in Recruitment",
      contentType: "RESEARCH_BRIEF",
      primaryAudience: "HR Leader — VP of HR evaluating AI recruitment tools",
      primaryQuestion: "Which AI recruitment claims are supported by published research vs. vendor marketing?",
      readerOutcome:
        "HR VP can distinguish verified research findings from vendor claims when evaluating AI tools",
      whyNow: "AI recruitment tool adoption accelerating in 2025 with conflicting quality claims",
      recommendedAuthorExpertise: "HR technology evaluation with research literacy",
      mode: "MODE_A_FOCUSED",
      wordBudget: { min: 700, max: 1200 },
      readTimeTargetMinutes: 6,
      reviewOwner: "Editorial QA Lead",
      riskFlags: [],
    },
    stakeholderScan: {
      employerImpact: "HR leader making procurement decisions for AI tools affecting hiring quality",
      employeeCandidateImpact: "Candidates affected by AI screening decisions — material but secondary",
      staffingMspImpact: "Staffing firms also use AI tools — companion piece appropriate",
      materialTradeoffs: "Employer making procurement decisions is the sole primary reader",
      publishLenses: [
        { lens: "Employer", reason: "Primary decision-maker for AI tool procurement" },
      ],
      omitLenses: [
        { lens: "Candidate", reason: "Separate piece on AI screening from candidate perspective" },
        { lens: "Staffing/MSP", reason: "Different operational context — separate piece" },
      ],
    },
    researchQuestions: [
      "Which published studies measure AI screening accuracy vs. human screening? (RESEARCH_FINDING — peer-reviewed, 2022-2025)",
      "What do vendor-published studies claim vs. independent replications? (INTERPRETATION — requires critical reading of methodology)",
      "What are the documented bias categories in AI screening tools? (RESEARCH_FINDING — EEOC, NIST, or peer-reviewed 2023-2025)",
      "What is the current state of AI screening regulation by jurisdiction? (VERIFIED_FACT — regulatory body publications 2024-2025)",
    ],
    outlineRecommendation: [
      {
        purpose: "Establish epistemic landscape",
        workingHeading: "What 'AI Improves Hiring' Actually Means — and Doesn't",
        readerValue: "Reader can distinguish claim types before reading further",
      },
      {
        purpose: "Research findings",
        workingHeading: "What Independent Research Has Found (and Its Limits)",
        readerValue: "Reader has specific findings with their methodological context",
      },
    ],
    decision: "PROCEED",
    ...overrides,
  };
}

export const EPISTEMIC_DISCIPLINE_CASES: PromptEvalCase[] = [
  {
    id: "ed-normal-01",
    blockName: "epistemicDiscipline",
    description: "Research questions each labelled with epistemic type and source guidance",
    category: "normal",
    mockResponse: baseEpistemicResponse(),
    context: {
      hasAuthorInput: false,
      contentType: "RESEARCH_BRIEF",
      mode: "MODE_A_FOCUSED",
      sourcePackProvided: false,
      isHighRiskClaim: false,
      isModeA: true,
    },
    assertions: [
      { type: "schema_valid", schemaName: "insightsPlanningOutput" },
      { type: "not_contains", path: "brief.primaryQuestion", forbidden: ["always", "definitely", "proven"] },
    ],
    tags: ["epistemic", "research-brief", "claim-labelling"],
  },
  {
    id: "ed-normal-02",
    blockName: "epistemicDiscipline",
    description: "FIELD_OBSERVATION correctly framed as pattern not fact in research questions",
    category: "normal",
    mockResponse: baseEpistemicResponse({
      researchQuestions: [
        "What patterns do recruiters observe in AI screening false positives? (FIELD_OBSERVATION — recruiter survey or pattern interviews; must be framed as 'commonly reported' not 'always')",
        "What does the 2024 SHRM AI in Hiring report conclude? (RESEARCH_FINDING — specific publication with scope and sample)",
      ],
    }),
    context: {
      hasAuthorInput: false,
      contentType: "RESEARCH_BRIEF",
      mode: "MODE_A_FOCUSED",
      sourcePackProvided: false,
      isHighRiskClaim: false,
      isModeA: true,
    },
    assertions: [
      { type: "schema_valid", schemaName: "insightsPlanningOutput" },
    ],
    tags: ["epistemic", "field-observation", "framing"],
  },
  {
    id: "ed-normal-03",
    blockName: "epistemicDiscipline",
    description: "UNCERTAINTY explicitly labelled where evidence gap exists",
    category: "normal",
    mockResponse: baseEpistemicResponse({
      researchQuestions: [
        "What is the long-term retention impact of AI-screened hires vs. human-screened? (UNCERTAINTY — no longitudinal data available beyond 18 months; must acknowledge this limit explicitly)",
        "Do AI tools improve diversity outcomes? (UNCERTAINTY — conflicting findings; must note the conflict and not resolve it editorially)",
      ],
      brief: {
        ...baseEpistemicResponse().brief,
        riskFlags: [
          "UNCERTAINTY: No longitudinal data beyond 18 months on AI-screened hire retention — must be explicitly acknowledged; do not extrapolate",
        ],
      },
    }),
    context: {
      hasAuthorInput: false,
      contentType: "RESEARCH_BRIEF",
      mode: "MODE_A_FOCUSED",
      sourcePackProvided: false,
      isHighRiskClaim: true,
      isModeA: true,
    },
    assertions: [
      { type: "schema_valid", schemaName: "insightsPlanningOutput" },
      { type: "requires_source", path: "brief.riskFlags" },
    ],
    tags: ["epistemic", "uncertainty", "evidence-gap"],
  },
  {
    id: "ed-normal-04",
    blockName: "epistemicDiscipline",
    description: "HYPOTHESIS labelled and distinguished from INTERPRETATION and VERIFIED_FACT",
    category: "normal",
    mockResponse: baseEpistemicResponse({
      researchQuestions: [
        "We hypothesize that AI tools perform better in high-volume, standardized roles — is this supported? (HYPOTHESIS — must be clearly labelled as hypothesis and tested against available evidence)",
        "Why might AI tools produce different results in niche vs. high-volume roles? (INTERPRETATION — requires reasoning from evidence, not assertion)",
      ],
    }),
    context: {
      hasAuthorInput: false,
      contentType: "RESEARCH_BRIEF",
      mode: "MODE_A_FOCUSED",
      sourcePackProvided: false,
      isHighRiskClaim: false,
      isModeA: true,
    },
    assertions: [
      { type: "schema_valid", schemaName: "insightsPlanningOutput" },
    ],
    tags: ["epistemic", "hypothesis", "interpretation"],
  },
  {
    id: "ed-normal-05",
    blockName: "epistemicDiscipline",
    description: "AUTHOR_EXPERIENCE flagged as requiring author interview before use",
    category: "normal",
    mockResponse: baseEpistemicResponse({
      researchQuestions: [
        "Collect author examples of AI screening evaluation decisions from their experience (AUTHOR_EXPERIENCE — requires author interview and approval before this content can be used)",
      ],
      brief: {
        ...baseEpistemicResponse().brief,
        riskFlags: [
          "AUTHOR_EXPERIENCE content required — no author interview conducted yet; do not proceed with draft until collected",
        ],
      },
      decision: "REVISE_BRIEF",
    }),
    context: {
      hasAuthorInput: false,
      contentType: "RESEARCH_BRIEF",
      mode: "MODE_A_FOCUSED",
      sourcePackProvided: false,
      isHighRiskClaim: false,
      isModeA: true,
    },
    assertions: [
      { type: "schema_valid", schemaName: "insightsPlanningOutput" },
      { type: "equals", path: "decision", expected: "REVISE_BRIEF" },
      { type: "no_first_person_without_input" },
    ],
    tags: ["epistemic", "author-experience", "hold-gate"],
  },
  {
    id: "ed-edge-01",
    blockName: "epistemicDiscipline",
    description: "Edge: unsupported claim appears in outlineRecommendation heading",
    category: "edge",
    mockResponse: baseEpistemicResponse({
      outlineRecommendation: [
        {
          purpose: "Main finding",
          workingHeading: "AI Screening Reduces Bias by 40% According to Studies",
          readerValue: "Reader learns the headline finding",
        },
      ],
      brief: {
        ...baseEpistemicResponse().brief,
        riskFlags: ["40% claim in outline heading requires verified source — flag for research phase"],
      },
    }),
    context: {
      hasAuthorInput: false,
      contentType: "RESEARCH_BRIEF",
      mode: "MODE_A_FOCUSED",
      sourcePackProvided: false,
      isHighRiskClaim: true,
      isModeA: true,
    },
    assertions: [
      { type: "schema_valid", schemaName: "insightsPlanningOutput" },
      { type: "requires_source", path: "brief.riskFlags" },
    ],
    tags: ["edge", "unsupported-claim", "heading-claim"],
  },
  {
    id: "ed-edge-02",
    blockName: "epistemicDiscipline",
    description: "Edge: research question without epistemic label — flag should appear",
    category: "edge",
    mockResponse: baseEpistemicResponse({
      researchQuestions: [
        "What does AI screening do to bias in hiring?",
        "How accurate are AI tools?",
      ],
      brief: {
        ...baseEpistemicResponse().brief,
        riskFlags: [
          "Research questions lack epistemic type labels — add (VERIFIED_FACT / RESEARCH_FINDING / FIELD_OBSERVATION / INTERPRETATION / HYPOTHESIS / UNCERTAINTY) to each question",
        ],
      },
    }),
    context: {
      hasAuthorInput: false,
      contentType: "RESEARCH_BRIEF",
      mode: "MODE_A_FOCUSED",
      sourcePackProvided: false,
      isHighRiskClaim: false,
      isModeA: true,
    },
    assertions: [
      { type: "schema_valid", schemaName: "insightsPlanningOutput" },
      { type: "requires_source", path: "brief.riskFlags" },
    ],
    tags: ["edge", "missing-epistemic-labels"],
  },
  {
    id: "ed-edge-03",
    blockName: "epistemicDiscipline",
    description: "Edge: conflicting research studies — uncertainty must be preserved",
    category: "edge",
    mockResponse: baseEpistemicResponse({
      researchQuestions: [
        "Study A (MIT 2023) shows AI reduces time-to-hire by 30%; Study B (Cornell 2024) shows no statistically significant reduction — how should this conflict be reported? (UNCERTAINTY — do not resolve the conflict editorially; present both findings with methodology context)",
      ],
      brief: {
        ...baseEpistemicResponse().brief,
        riskFlags: [
          "UNCERTAINTY: Conflicting studies (MIT 2023 vs Cornell 2024) on AI time-to-hire impact — do not resolve editorially; present both with methodology context",
        ],
      },
    }),
    context: {
      hasAuthorInput: false,
      contentType: "RESEARCH_BRIEF",
      mode: "MODE_A_FOCUSED",
      sourcePackProvided: false,
      isHighRiskClaim: true,
      isModeA: true,
    },
    assertions: [
      { type: "schema_valid", schemaName: "insightsPlanningOutput" },
    ],
    tags: ["edge", "conflicting-studies", "uncertainty-preservation"],
  },
  {
    id: "ed-adversarial-01",
    blockName: "epistemicDiscipline",
    description: "Adversarial: invented statistic asserted as VERIFIED_FACT without source",
    category: "adversarial",
    mockResponse: baseEpistemicResponse({
      researchQuestions: [
        "Studies show AI screening reduces bias by 67% (VERIFIED_FACT)",
      ],
      brief: {
        ...baseEpistemicResponse().brief,
        riskFlags: [],
      },
    }),
    context: {
      hasAuthorInput: false,
      contentType: "RESEARCH_BRIEF",
      mode: "MODE_A_FOCUSED",
      sourcePackProvided: false,
      isHighRiskClaim: true,
      isModeA: true,
    },
    assertions: [
      { type: "schema_valid", schemaName: "insightsPlanningOutput" },
    ],
    tags: ["adversarial", "invented-statistic", "false-verification"],
  },
  {
    id: "ed-adversarial-02",
    blockName: "epistemicDiscipline",
    description: "Adversarial: legal certainty claimed from outdated secondary source",
    category: "adversarial",
    mockResponse: baseEpistemicResponse({
      researchQuestions: [
        "AI screening is fully compliant with EEOC guidance (VERIFIED_FACT — based on 2019 EEOC overview)",
      ],
      brief: {
        ...baseEpistemicResponse().brief,
        riskFlags: [],
      },
    }),
    context: {
      hasAuthorInput: false,
      contentType: "RESEARCH_BRIEF",
      mode: "MODE_A_FOCUSED",
      sourcePackProvided: false,
      isHighRiskClaim: true,
      isModeA: true,
    },
    assertions: [
      { type: "schema_valid", schemaName: "insightsPlanningOutput" },
    ],
    tags: ["adversarial", "legal-certainty", "outdated-source"],
  },
  {
    id: "ed-hold-01",
    blockName: "epistemicDiscipline",
    description: "Hold case: article requires AUTHOR_EXPERIENCE that must be collected before writing",
    category: "hold_case",
    mockResponse: baseEpistemicResponse({
      decision: "REVISE_BRIEF",
      brief: {
        ...baseEpistemicResponse().brief,
        riskFlags: [
          "Multiple AUTHOR_EXPERIENCE data points required — author interview not yet conducted",
          "Do not proceed to research or draft phases until author input is collected and approved",
        ],
      },
      researchQuestions: [
        "Pending author interview: what AI screening failures has the author personally observed? (AUTHOR_EXPERIENCE — requires author approval)",
      ],
    }),
    context: {
      hasAuthorInput: false,
      contentType: "RESEARCH_BRIEF",
      mode: "MODE_A_FOCUSED",
      sourcePackProvided: false,
      isHighRiskClaim: false,
      isModeA: true,
    },
    assertions: [
      { type: "schema_valid", schemaName: "insightsPlanningOutput" },
      { type: "equals", path: "decision", expected: "REVISE_BRIEF" },
      { type: "no_first_person_without_input" },
    ],
    tags: ["hold-case", "author-experience", "gate-a"],
  },
];
