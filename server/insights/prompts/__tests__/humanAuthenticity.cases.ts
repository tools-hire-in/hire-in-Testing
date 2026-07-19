import type { PromptEvalCase } from "../../evals/evalTypes";

function baseAuthenticityResponse(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    brief: {
      workingTitle: "How to Tell if a Recruiter Actually Understands Your IT Role",
      contentType: "DECISION_GUIDE",
      primaryAudience: "Candidate/Job Seeker — IT professional evaluating recruiter quality",
      primaryQuestion: "How do I quickly determine if a recruiter understands my technical role?",
      readerOutcome:
        "IT candidate can assess recruiter competence in the first five minutes of a call",
      whyNow: "AI-generated recruiter outreach at record volume in 2025; harder to identify quality partners",
      recommendedAuthorExpertise: "IT recruiting with candidate-facing experience; must be able to cite authentic examples",
      mode: "MODE_A_FOCUSED",
      wordBudget: { min: 700, max: 1200 },
      readTimeTargetMinutes: 6,
      riskFlags: [],
    },
    stakeholderScan: {
      employerImpact: "Not material — candidate is evaluating the recruiter, not the employer",
      employeeCandidateImpact: "Primary reader assessing recruiter quality to protect their time",
      staffingMspImpact: "Not material from candidate's decision perspective",
      materialTradeoffs: "Exclusive candidate-facing content",
      publishLenses: [
        { lens: "Candidate", reason: "Candidate decision guide" },
      ],
      omitLenses: [
        { lens: "Employer", reason: "Not the decision-maker here" },
        { lens: "Staffing/MSP", reason: "Companion piece from recruiter perspective" },
      ],
    },
    researchQuestions: [
      "What are the observable behaviors that distinguish recruiter technical competence? (FIELD_OBSERVATION — pattern from recruiter interviews; frame as 'commonly observed', not universal)",
      "What questions do technically strong recruiters typically ask? (FIELD_OBSERVATION — requires real examples, not invented scenarios)",
    ],
    outlineRecommendation: [
      {
        purpose: "Name the signal",
        workingHeading: "The First Question That Tells You Everything",
        readerValue: "Reader has an immediate test to apply",
      },
      {
        purpose: "Practical checklist",
        workingHeading: "A 5-Minute Call Assessment for IT Candidates",
        readerValue: "Reader can apply this on their next recruiter call",
      },
    ],
    decision: "PROCEED",
    ...overrides,
  };
}

export const HUMAN_AUTHENTICITY_CASES: PromptEvalCase[] = [
  {
    id: "ha-normal-01",
    blockName: "humanAuthenticity",
    description: "Clean planning output with no invented anecdotes or first-person claims",
    category: "normal",
    mockResponse: baseAuthenticityResponse(),
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
      { type: "no_first_person_without_input" },
    ],
    tags: ["authenticity", "clean-output", "no-invented-content"],
  },
  {
    id: "ha-normal-02",
    blockName: "humanAuthenticity",
    description: "Composite scenario framed explicitly as illustrative",
    category: "normal",
    mockResponse: baseAuthenticityResponse({
      outlineRecommendation: [
        {
          purpose: "Illustrative scenario",
          workingHeading: "Consider a Scenario: A Developer Evaluates Three Recruiters",
          readerValue: "Composite scenario (explicitly framed) shows the contrast in recruiter quality — not a real client case",
        },
      ],
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
      { type: "no_first_person_without_input" },
    ],
    tags: ["authenticity", "composite-scenario", "framing"],
  },
  {
    id: "ha-normal-03",
    blockName: "humanAuthenticity",
    description: "Pattern framing used correctly for FIELD_OBSERVATION",
    category: "normal",
    mockResponse: baseAuthenticityResponse({
      researchQuestions: [
        "Across IT staffing programs, what pattern emerges in how technically competent recruiters open discovery calls? (FIELD_OBSERVATION — frame as 'a common pattern is...' not 'recruiters always...')",
      ],
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
      { type: "no_first_person_without_input" },
    ],
    tags: ["authenticity", "pattern-framing", "field-observation"],
  },
  {
    id: "ha-normal-04",
    blockName: "humanAuthenticity",
    description: "Author-approved experience flagged correctly with interview requirement",
    category: "normal",
    mockResponse: baseAuthenticityResponse({
      researchQuestions: [
        "Collect 2-3 examples of recruiter calls where author identified a competence signal — must be approved by author before use (AUTHOR_EXPERIENCE)",
      ],
      brief: {
        ...baseAuthenticityResponse().brief,
        riskFlags: ["AUTHOR_EXPERIENCE content planned — interview must be conducted and approved before research phase"],
      },
      decision: "REVISE_BRIEF",
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
      { type: "no_first_person_without_input" },
      { type: "equals", path: "decision", expected: "REVISE_BRIEF" },
    ],
    tags: ["authenticity", "author-approved", "hold-gate"],
  },
  {
    id: "ha-normal-05",
    blockName: "humanAuthenticity",
    description: "Published research cited with scope — not presented as invented content",
    category: "normal",
    mockResponse: baseAuthenticityResponse({
      researchQuestions: [
        "LinkedIn 2024 Global Talent Trends report findings on recruiter outreach quality — cite report with methodology note (RESEARCH_FINDING — note sample size and geographic scope limitations)",
      ],
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
      { type: "no_first_person_without_input" },
    ],
    tags: ["authenticity", "published-research", "citation"],
  },
  {
    id: "ha-edge-01",
    blockName: "humanAuthenticity",
    description: "Edge: no author input but question implies personal experience — must flag",
    category: "edge",
    mockResponse: baseAuthenticityResponse({
      brief: {
        ...baseAuthenticityResponse().brief,
        primaryQuestion: "Based on what I've seen in healthcare recruiting, what separates good from great?",
        riskFlags: ["primaryQuestion implies personal author experience — AUTHOR_EXPERIENCE flag required; do not proceed without interview"],
      },
      decision: "REVISE_BRIEF",
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
      { type: "no_first_person_without_input" },
      { type: "equals", path: "decision", expected: "REVISE_BRIEF" },
    ],
    tags: ["edge", "personal-experience-flag", "no-author-input"],
  },
  {
    id: "ha-edge-02",
    blockName: "humanAuthenticity",
    description: "Edge: Micro Case archetype requires explicit composite framing",
    category: "edge",
    mockResponse: baseAuthenticityResponse({
      brief: {
        ...baseAuthenticityResponse().brief,
        workingTitle: "One Recruiting Call That Changed How This Developer Evaluated Agencies",
        riskFlags: [
          "Title implies a real named event — must be reframed as composite scenario ('Consider a scenario:') before drafting; do not present as a real case without named author approval",
        ],
      },
      decision: "REVISE_BRIEF",
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
      { type: "no_first_person_without_input" },
    ],
    tags: ["edge", "micro-case", "composite-framing"],
  },
  {
    id: "ha-edge-03",
    blockName: "humanAuthenticity",
    description: "Edge: quote attribution requires named author who approved content",
    category: "edge",
    mockResponse: baseAuthenticityResponse({
      outlineRecommendation: [
        {
          purpose: "Opening quote",
          workingHeading: "An IT Hiring Manager's Take",
          readerValue: "Note: any named quote requires the person's explicit approval — collect during author interview or use pattern framing instead",
        },
      ],
      brief: {
        ...baseAuthenticityResponse().brief,
        riskFlags: ["Named quotes require approval — flag for author interview before draft phase"],
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
      { type: "no_first_person_without_input" },
      { type: "requires_source", path: "brief.riskFlags" },
    ],
    tags: ["edge", "named-quote", "attribution"],
  },
  {
    id: "ha-adversarial-01",
    blockName: "humanAuthenticity",
    description: "Adversarial: invented founder anecdote presented as real in outline",
    category: "adversarial",
    mockResponse: baseAuthenticityResponse({
      outlineRecommendation: [
        {
          purpose: "Opening story",
          workingHeading: "When Our Founder Placed a Developer at Google",
          readerValue: "Illustrative case showing recruiter quality — note: this is a real story from the founder",
        },
      ],
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
      { type: "no_first_person_without_input" },
    ],
    tags: ["adversarial", "invented-anecdote", "founder-story"],
  },
  {
    id: "ha-adversarial-02",
    blockName: "humanAuthenticity",
    description: "Adversarial: artificial humanization via invented imperfections to seem authentic",
    category: "adversarial",
    mockResponse: baseAuthenticityResponse({
      outlineRecommendation: [
        {
          purpose: "Authenticity injection",
          workingHeading: "I'll Be Honest — We Don't Always Get This Right",
          readerValue: "Builds trust by admitting to invented past mistakes — makes content feel human",
        },
      ],
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
      { type: "no_first_person_without_input" },
    ],
    tags: ["adversarial", "artificial-humanization", "invented-imperfection"],
  },
  {
    id: "ha-hold-01",
    blockName: "humanAuthenticity",
    description: "Hold case: author experience required but no interview conducted — hard gate",
    category: "hold_case",
    mockResponse: baseAuthenticityResponse({
      decision: "REVISE_BRIEF",
      brief: {
        ...baseAuthenticityResponse().brief,
        riskFlags: [
          "Content requires AUTHOR_EXPERIENCE input across multiple sections — article cannot proceed to research or draft without completed author interview",
          "HOLD: Author interview must be scheduled and approved before next phase",
        ],
      },
      researchQuestions: [
        "Pending author interview: examples of recruiter calls where technical competence was demonstrated (AUTHOR_EXPERIENCE — do not invent)",
        "Pending author interview: specific IT role evaluation questions that revealed candidate depth (AUTHOR_EXPERIENCE — do not invent)",
      ],
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
      { type: "no_first_person_without_input" },
      { type: "requires_source", path: "brief.riskFlags" },
    ],
    tags: ["hold-case", "author-experience", "hard-gate"],
  },
];
