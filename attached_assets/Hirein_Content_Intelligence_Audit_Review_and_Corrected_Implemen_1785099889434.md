# Content Intelligence Layer — Audit Review and Corrected Implementation Plan

**Product:** Hire’in Content Studio  
**Audience:** Replit engineering/architecture team  
**Document purpose:** Review the submitted code audit, correct weak recommendations, and provide an implementation-ready enhancement plan  
**Status:** Approved for implementation planning, subject to the verification gates in Phase 0  
**Supersedes:** Any earlier instruction that assumes a Shared ICP Registry, Claim Registry, Proof Library, or runtime knowledge loader already exists

---

# 1. Executive Verdict

## Overall assessment

The audit is **strong, credible, and correctly identifies the central architectural problem**.

The system already contains valuable content intelligence:

- claim-free guardrails;
- four audience blocks;
- domain and market-context blocks;
- four content-goal blocks;
- hook archetypes;
- content archetypes;
- banned generic language;
- exemplars;
- strong Insights editorial blocks;
- a richer intelligence prompt path.

The core weakness is not that the system lacks all intelligence. The core weakness is that existing intelligence is **not consistently routed into every generation flow**, and several formats are governed by loose word limits instead of enforceable output contracts.

The audit correctly identifies four major root causes:

1. The system has a rich intelligence path and a weak fallback path.
2. Campaign generation is isolated from selected-platform context.
3. Format instructions are word budgets rather than schemas.
4. knowledge and proof assets do not reliably enter runtime generation.

These findings should be accepted as the basis of the enhancement work.

## Honest rating of the audit

**Audit quality: 8.5/10**

It is materially better than a generic architecture review because it references specific files, functions, prompt blocks, parameters, and hardcoded instructions.

However, several recommendations should be corrected before implementation to avoid replacing one problem with unnecessary complexity.

---

# 2. Critical Correction to the Previous Work Order

The earlier work order treated the following as existing infrastructure that should be reused:

- Shared ICP Registry;
- Shared Claim Registry;
- Proof Library;
- runtime knowledge-file loading.

The audit reports that these are **not implemented as structured runtime services or registries**.

The current implementation appears to contain:

- four audience enum-style blocks;
- a blanket claim-free prompt block;
- knowledge files under `attached_assets/`;
- manually extracted content in `marketingIntelligence.ts`;
- no confirmed structured ICP, claims, or proof retrieval service.

Therefore, Replit must treat these as:

| Capability | Correct classification |
|---|---|
| Audience intelligence blocks | **ENHANCE** |
| Shared ICP Registry | **ADD LATER OR IMPLEMENT AS LIGHTWEIGHT REGISTRY** |
| Claim-free safeguards | **REUSE** |
| Structured Claim Registry | **ADD INCREMENTALLY** |
| Proof Library runtime retrieval | **ADD** |
| Knowledge-file loader | **DO NOT IMPLEMENT AS A NAIVE PER-REQUEST FILE READER** |

This correction is important. Do not create parallel infrastructure based on the assumption that these registries already exist.

---

# 3. What the Audit Gets Right

## 3.1 The intelligence layer itself is not weak

The report shows that `server/intelligence/marketingIntelligence.ts` contains genuinely useful components:

- `CLAIM_FREE_BLOCK`;
- `DOMAIN_BLOCKS`;
- `MARKET_CONTEXT_BLOCKS`;
- `CONTENT_GOAL_BLOCKS`;
- `HOOK_ARCHETYPES_BLOCK`;
- `CONTENT_ARCHETYPES_BLOCK`;
- `BANNED_SLOP_BLOCK`;
- `EXEMPLAR_BLOCKS`;
- strong Insights editorial blocks.

These should be preserved.

The correct product strategy is to **connect and operationalize the existing intelligence**, not replace it with a new prompt library.

## 3.2 The two-path architecture is the highest-priority defect

The audit reports:

- the intelligence path receives the full content-intelligence stack;
- the fallback path receives only the base template, industry modifier, and compliance instructions.

This explains why some outputs are strong and others are generic even when the user supplied a detailed brief.

The fix should be architectural:

> Every generation request must pass through one canonical context-resolution pipeline.

A missing `contentGoal` should trigger goal resolution, not demotion to a weak prompt path.

## 3.3 Campaign platform context is genuinely disconnected

The audit reports that `generateCampaignDayPlan` does not receive `selectedPlatforms`, while the template hardcodes one or two items per day in two locations.

This is not a prompt-quality issue. It is a data-contract issue.

The campaign service must receive:

- selected platforms;
- per-platform publishing frequency or cadence;
- campaign dates;
- content formats;
- primary platform;
- campaign narrative;
- CTA;
- audience;
- content goal.

## 3.4 Carousel and Reels require real schemas

The audit correctly distinguishes between:

- a word-count instruction; and
- a publish-ready format contract.

A carousel cannot be considered complete when the model returns slide labels.

A Reel cannot be considered complete when the system has no schema for:

- hook timing;
- narration;
- scene timing;
- on-screen copy;
- visual direction;
- B-roll;
- CTA timing.

These formats should be validated structurally before they are shown to users.

## 3.5 Evidence retrieval is missing

The existing claim-free block reduces hallucination risk, but it cannot produce strong evidence-led content unless approved facts, proof, product capabilities, and sources are available at runtime.

The long-term solution is a governed proof and claims layer.

The first implementation should remain intentionally small.

---

# 4. What Should Not Be Implemented Literally

## 4.1 Do not create 30 or more independent audience prompt blocks

The audit notes that the current four audiences are thin compared with more than 30 possible ICP families.

Creating 30–50 hardcoded audience blocks will become difficult to maintain and will recreate the same monolithic-prompt problem.

Use a **composable audience model**:

```text
Audience Family
+ Role/Title
+ Seniority
+ Domain
+ Buyer Stage
+ Pain Points
+ Desired Outcome
+ Objections
+ Decision Criteria
```

Example:

```text
Family: FUNCTIONAL_BUYER
Role: Talent Acquisition Leader
Seniority: VP
Domain: Healthcare Staffing
Buyer Stage: Consideration
Pain Point: Inconsistent recruiter quality
Desired Outcome: Evidence-led candidate matching
```

This model can express many ICPs without maintaining one prompt block for every title.

## 4.2 Do not add all extended content goals immediately

The current four goals are useful:

- Thought Leadership;
- Educational;
- Job Marketing;
- Brand Perspective.

Do not immediately add eleven more goals simply because the future framework lists them.

Add only goals that materially change generation behavior.

Recommended first additions:

- `PRODUCT_EDUCATION`;
- `CUSTOMER_PROOF`;
- `LAUNCH_ANNOUNCEMENT`.

Other commercial intent should initially be expressed using:

- funnel stage;
- campaign objective;
- CTA;
- audience;
- proof type;
- platform;
- format.

This prevents goal-taxonomy sprawl.

## 4.3 Do not force every selected platform every day

The audit recommends validating that every selected platform receives an asset per scheduled day.

That is correct only when the user selected **daily publishing on every platform**.

The better rule is:

> Every scheduled platform slot must receive one valid asset.

The campaign model should support:

```text
LinkedIn: Monday, Wednesday, Friday
Instagram: Tuesday, Thursday
X: Monday–Friday
Insights: Friday
```

Selected platforms define eligibility. The schedule matrix defines actual publishing slots.

## 4.4 Do not use a naive runtime Markdown loader

Reading files from `attached_assets/` during every generation request would introduce:

- environment dependency;
- inconsistent deployment behavior;
- token bloat;
- uncontrolled content injection;
- poor versioning;
- difficult testing;
- slow request processing.

Use a versioned and curated intelligence registry.

Recommended progression:

### Initial implementation

- move approved knowledge into typed JSON or TypeScript configuration;
- load and validate it at application startup;
- cache it;
- assign a version and status;
- inject only context relevant to the request.

### Later implementation

- migrate approved facts, proofs, claims, and audience records into an admin-managed database or CMS;
- retain audit history and approval status.

Do not ingest arbitrary Markdown directly into public-content prompts.

## 4.5 Do not make the first quality evaluator excessively subjective

A 14-dimensional score is useful as a mature framework, but implementing all 14 dimensions immediately may:

- increase model calls;
- raise latency and cost;
- produce unstable scores;
- make failures difficult to diagnose;
- create false precision.

Separate quality controls into two layers.

### Layer A: Deterministic hard validation

Examples:

- required fields present;
- selected platforms covered;
- carousel slide body is non-empty;
- Reels timing is present;
- prohibited claim not present;
- unsupported metric not present;
- output conforms to schema;
- duplicate platform copy is below threshold.

### Layer B: Model-assisted editorial scoring

Start with six dimensions:

1. brief fidelity;
2. audience relevance;
3. specificity;
4. platform fit;
5. point-of-view strength;
6. evidence and claim safety.

Expand only after the team has enough reviewed output to calibrate the evaluator.

## 4.6 Do not delete the fallback path without migration protection

The weak fallback path should not remain a normal generation route.

However, immediately deleting it may break:

- older templates;
- background jobs;
- tests;
- saved drafts;
- API clients;
- uncommon content types.

Replace it through a controlled migration:

1. introduce the canonical resolver;
2. route all known entry points through it;
3. log requests that still invoke fallback;
4. retain fallback behind a feature flag temporarily;
5. remove it after telemetry shows no legitimate dependency.

---

# 5. Corrected Target Architecture

The target architecture should remain shared and compact.

```text
Content Generation Request
        │
        ▼
Canonical Brief Resolver
        │
        ├── Brand Context
        ├── Audience Context
        ├── Domain and Market Context
        ├── Content Goal Resolver
        ├── Campaign Context
        ├── Claims and Proof Context
        └── User-Supplied Facts
        │
        ▼
Content Intelligence Orchestrator
        │
        ├── Hook and Archetype Selection
        ├── Platform Contract
        ├── Format Contract
        ├── Tone and Psychological Contract
        └── Prompt Assembly
        │
        ▼
Structured Generation
        │
        ▼
Schema Validation
        │
        ▼
Claims and Quality Gate
        │
        ├── Pass → Existing Human Review
        └── Fail → One Controlled Revision → Human Review
```

Do not create separate AI systems for every format.

Use:

- one canonical context resolver;
- one orchestrator;
- one format-contract registry;
- one platform-rule registry;
- one claims/proof provider;
- one validation and quality layer.

---

# 6. Canonical Runtime Brief

The canonical runtime brief is the most important new abstraction.

It should not require a new user form. It should normalize information already captured by the UI and enrich it with derived context.

## 6.1 Recommended TypeScript interface

```ts
export type ContentGoal =
  | "THOUGHT_LEADERSHIP"
  | "EDUCATIONAL"
  | "JOB_MARKETING"
  | "BRAND_PERSPECTIVE"
  | "PRODUCT_EDUCATION"
  | "CUSTOMER_PROOF"
  | "LAUNCH_ANNOUNCEMENT";

export type Platform =
  | "LINKEDIN"
  | "INSTAGRAM"
  | "X"
  | "FACEBOOK"
  | "ARTICLE"
  | "INSIGHTS";

export type ContentFormat =
  | "SOCIAL_POST"
  | "EXECUTIVE_POV"
  | "CAROUSEL"
  | "REEL"
  | "STATIC_POST"
  | "STORY_SEQUENCE"
  | "X_THREAD"
  | "ARTICLE"
  | "JOB_POST";

export interface CanonicalContentBrief {
  briefId: string;
  rawBrief?: string;

  brand: {
    name: string;
    tagline?: string;
    voice: string[];
    approvedPositioning: string[];
    coreBeliefs?: string[];
    contrarianBeliefs?: string[];
    bannedLanguage: string[];
    preferredCtaStyles?: string[];
  };

  audience: {
    family: string;
    role?: string;
    seniority?: string;
    domain: string;
    buyerStage?: string;
    painPoints: string[];
    desiredOutcomes: string[];
    objections?: string[];
    decisionCriteria?: string[];
  };

  strategy: {
    contentGoal: ContentGoal;
    contentGoalSource: "USER" | "TEMPLATE" | "INFERRED" | "DEFAULT";
    topic: string;
    businessObjective?: string;
    funnelStage?: string;
    campaignThesis?: string;
    pointOfView?: string;
    desiredAudienceAction?: string;
    primaryCta?: string;
  };

  campaign?: {
    campaignId?: string;
    startDate?: string;
    endDate?: string;
    scheduleSlots?: CampaignScheduleSlot[];
    selectedPlatforms: Platform[];
  };

  generation: {
    platform: Platform;
    format: ContentFormat;
    tone?: string[];
    selectedHook?: string;
    requestedLength?: string;
  };

  evidence: {
    userFacts: string[];
    approvedClaims: ApprovedClaim[];
    approvedProof: ApprovedProof[];
    prohibitedClaims: string[];
    requiresReview: string[];
    sources: SourceReference[];
  };

  governance: {
    complianceMode?: string;
    humanReviewRequired: true;
    intelligenceVersion: string;
    formatContractVersion: string;
    promptVersion: string;
  };
}
```

## 6.2 Goal resolution waterfall

```ts
function resolveContentGoal(input: ContentRequest): ResolvedContentGoal {
  if (input.contentGoal) {
    return { value: input.contentGoal, source: "USER" };
  }

  if (input.template?.defaultContentGoal) {
    return { value: input.template.defaultContentGoal, source: "TEMPLATE" };
  }

  const inferred = inferGoalFromContext({
    campaignGoal: input.campaignGoal,
    funnelStage: input.funnelStage,
    format: input.format,
    primaryCta: input.primaryCta,
    topic: input.topic,
  });

  if (inferred) {
    return { value: inferred, source: "INFERRED" };
  }

  return {
    value: input.jobContext ? "JOB_MARKETING" : "EDUCATIONAL",
    source: "DEFAULT",
  };
}
```

Every request should continue through the intelligence path after this resolution.

---

# 7. Format Contract Registry

Create a typed registry rather than scattering format instructions across platform blocks.

```ts
interface FormatContract<TSchema> {
  id: ContentFormat;
  version: string;
  supportedPlatforms: Platform[];
  systemInstructions: string;
  outputSchema: TSchema;
  validate: (value: unknown) => ValidationResult;
}
```

Platform rules and format rules should remain separate:

- platform rules determine channel-native voice, length, and CTA behavior;
- format contracts determine required output structure.

---

# 8. Required Format Contracts

## 8.1 Carousel

### Recommended schema

```ts
interface CarouselSlide {
  slideNumber: number;
  purpose:
    | "HOOK"
    | "PROBLEM"
    | "FAILED_APPROACH"
    | "INSIGHT"
    | "FRAMEWORK"
    | "PROOF"
    | "IMPLICATION"
    | "ACTION"
    | "CTA";
  headline: string;
  bodyCopy: string;
  supportingLine?: string;
  visualDirection: string;
  sourceRefs?: string[];
}

interface CarouselOutput {
  title: string;
  slides: CarouselSlide[];
  caption: string;
  primaryCta: string;
  alternativeCta?: string;
  altText: string;
  commentPrompts?: string[];
}
```

### Rules

- default: 6–8 slides;
- allow templates to request a different range;
- one central idea per slide;
- headline: approximately 3–8 words;
- body copy: normally 12–40 words;
- supporting line: optional and brief;
- every slide requires visual direction;
- no title-only slide;
- CTA slide required only when the campaign objective needs one;
- do not force 2–4 sentences on every slide.

### Validation

Reject when:

- fewer than the required number of slides;
- any slide lacks `headline`, `bodyCopy`, or `visualDirection`;
- body copy duplicates the headline;
- multiple slides are substantially identical;
- the content contains unsupported facts.

## 8.2 Reel or short video

```ts
interface ReelScene {
  startSecond: number;
  endSecond: number;
  narration: string;
  onScreenText?: string;
  presenterDirection?: string;
  visualDirection: string;
  bRoll?: string;
}

interface ReelOutput {
  title: string;
  durationSeconds: number;
  hook: string;
  scenes: ReelScene[];
  ctaLine: string;
  ctaStartSecond: number;
  coverText: string;
  caption: string;
  pinnedComment?: string;
  accessibilityNotes?: string;
}
```

Validation must confirm:

- the hook occurs in the first three seconds;
- scene times are ordered and do not overlap incorrectly;
- complete narration exists;
- CTA wording and timing exist;
- visual direction exists;
- the output is not carousel copy presented as video.

## 8.3 LinkedIn executive point of view

Required fields:

- hook;
- executive position;
- business context;
- decision implication;
- operator implication;
- evidence or explicit opinion label;
- recommendation;
- CTA;
- visual suggestion;
- suggested first comment.

## 8.4 X thread

Required fields:

- opening post;
- ordered thread posts;
- one central idea per post;
- evidence placement;
- closing takeaway;
- CTA or discussion prompt.

## 8.5 Existing article and job-marketing formats

Preserve the existing strong Insights and Job Marketing systems.

Only connect them to:

- canonical brief resolution;
- campaign orchestration;
- shared evidence and traceability;
- platform scheduling.

Do not redesign them unless tests reveal format defects.

---

# 9. Campaign Orchestration Redesign

## 9.1 Correct function contract

`generateCampaignDayPlan` should no longer infer platforms without input.

Recommended parameters:

```ts
interface CampaignPlanInput {
  campaignName: string;
  campaignGoal: string;
  campaignBrief: string;
  canonicalBrief: CanonicalContentBrief;
  durationDays: number;
  startDate: string;
  endDate?: string;
  selectedPlatforms: Platform[];
  scheduleSlots: CampaignScheduleSlot[];
  primaryPlatform?: Platform;
  allowedFormatsByPlatform: Partial<Record<Platform, ContentFormat[]>>;
}
```

## 9.2 Schedule-slot model

```ts
interface CampaignScheduleSlot {
  date: string;
  platform: Platform;
  preferredFormat?: ContentFormat;
  objective?: string;
}
```

The planner should generate one asset record for every schedule slot.

This prevents two opposite errors:

- silently ignoring selected platforms;
- forcing every platform to publish every day.

## 9.3 Remove hardcoded limits

Remove both prompt instructions that say:

- one to two items per day;
- no more than two items per day.

Capacity must be controlled by `scheduleSlots`, not by hidden prompt text.

## 9.4 Campaign output schema

```ts
interface CampaignAssetPlan {
  date: string;
  platform: Platform;
  format: ContentFormat;
  audience: string;
  funnelStage?: string;
  objective: string;
  hookAngle: string;
  keyMessage: string;
  evidenceNeeded: string[];
  primaryCta?: string;
  narrativeRole: string;
}

interface CampaignPlanOutput {
  campaignThesis: string;
  narrativeArc: string[];
  assets: CampaignAssetPlan[];
}
```

## 9.5 Coverage validation

The validator must compare requested schedule slots with generated asset records.

Fail when:

- a schedule slot has no asset;
- the platform is not selected;
- an unsupported format is assigned;
- identical copy strategy is reused across all platforms;
- dates fall outside the campaign range.

---

# 10. Evidence and Claims Layer

## 10.1 First implementation: lightweight governed registry

Do not start with a large multi-table claims platform unless the product already has an admin data-management pattern that can be reused.

Create versioned, typed records.

```ts
type ClaimStatus =
  | "APPROVED_POSITIONING"
  | "APPROVED_FACT"
  | "APPROVED_CASE_STUDY"
  | "REQUIRES_REVIEW"
  | "INTERNAL_ONLY"
  | "PROHIBITED";

interface ApprovedClaim {
  id: string;
  status: ClaimStatus;
  text: string;
  brand: string;
  domain?: string;
  products?: string[];
  sourceRefs?: string[];
  validFrom?: string;
  validUntil?: string;
  version: string;
}

interface ApprovedProof {
  id: string;
  title: string;
  summary: string;
  proofType: "METRIC" | "CASE_STUDY" | "PRODUCT_FACT" | "MARKET_SOURCE";
  sourceRefs: string[];
  approvedForPublicUse: boolean;
  domains?: string[];
  products?: string[];
  version: string;
}
```

## 10.2 Runtime retrieval

Retrieve only records matching:

- brand;
- product;
- domain;
- audience;
- content goal;
- requested topic.

Do not inject the entire proof library into every prompt.

## 10.3 Safety hierarchy

1. user-provided facts for the current request;
2. approved public claims;
3. approved proof;
4. source-backed market facts;
5. expert interpretation;
6. cautious inference;
7. omit the statement when evidence is insufficient.

`INTERNAL_ONLY` and `PROHIBITED` records must never be included as positive generation context.

---

# 11. Audience Intelligence Redesign

Retain the four existing broad audience families as compatibility values:

- `EMPLOYER_CLIENT`;
- `MSP_VMS_PARTNER`;
- `CANDIDATE`;
- `RECRUITER_OPERATOR`.

Add dimensions rather than dozens of blocks.

Recommended fields:

```ts
interface AudienceContext {
  family: string;
  role?: string;
  seniority?: string;
  domain: string;
  buyerStage?: string;
  painPoints: string[];
  desiredOutcomes: string[];
  objections?: string[];
  decisionCriteria?: string[];
  trustedProofTypes?: string[];
}
```

Initial prioritized role profiles:

1. enterprise executive;
2. TA/HR leader;
3. staffing owner or leader;
4. MSP/VMS partner;
5. recruiter or sourcer;
6. account manager or delivery leader;
7. healthcare candidate;
8. IT/engineering candidate;
9. employer or hiring manager;
10. procurement/compliance stakeholder.

Add profiles based on actual content demand, not theoretical completeness.

---

# 12. Quality Governance

## 12.1 Deterministic output validation

This is mandatory before any model-based scoring.

Validate:

- JSON/schema correctness;
- required fields;
- selected platform;
- requested format;
- slide/scene completeness;
- allowed claim status;
- source references for material facts;
- platform coverage;
- date coverage;
- duplicate content;
- empty CTA when CTA is required;
- excessive banned language.

## 12.2 Editorial evaluator

Initial six dimensions:

| Dimension | Minimum |
|---|---:|
| Brief fidelity | 8/10 |
| Audience relevance | 8/10 |
| Specificity | 7/10 |
| Platform fit | 8/10 |
| Point-of-view strength | 7/10 |
| Evidence and claim safety | Mandatory pass |

The evaluator should return:

```ts
interface ContentQualityResult {
  approved: boolean;
  score: number;
  dimensions: Record<string, number>;
  hardFailures: string[];
  revisionInstructions: string[];
  evaluatorVersion: string;
}
```

## 12.3 Revision behavior

- permit one automatic revision;
- preserve the same canonical brief and evidence set;
- provide explicit failed checks to the revision prompt;
- do not loop indefinitely;
- send unresolved failures to human review with warnings.

## 12.4 Human review

The audit describes human review and Super Admin approval as “assumed.”

Replit must verify these workflows before classifying them as reusable.

Confirm:

- review status model;
- reviewer roles;
- approval transition;
- audit logging;
- publishing permission;
- whether generated content can bypass approval.

If not confirmed, document the gap instead of marking it complete.

---

# 13. Generation Traceability

Store enough information to explain how content was created without storing sensitive chain-of-thought.

Recommended trace:

```ts
interface GenerationTrace {
  generationId: string;
  intelligencePath: "CANONICAL";
  contentGoal: string;
  contentGoalSource: string;
  audienceFamily: string;
  platform: Platform;
  format: ContentFormat;
  intelligenceBlocks: string[];
  intelligenceVersion: string;
  promptVersion: string;
  formatContractVersion: string;
  claimIds: string[];
  proofIds: string[];
  model: string;
  qualityResultId?: string;
  createdAt: string;
}
```

Do not store hidden model reasoning.

Store only inputs, selected rules, versions, references, validation outcomes, and final output.

---

# 14. Recommended File and Module Structure

The audit identifies `marketingIntelligence.ts` as a strong but increasingly monolithic source of truth.

Refactor gradually.

```text
server/
├── intelligence/
│   ├── index.ts
│   ├── brandIntelligence.ts
│   ├── audienceRegistry.ts
│   ├── domainContext.ts
│   ├── contentGoals.ts
│   ├── hooksAndArchetypes.ts
│   ├── platformContracts.ts
│   ├── formatContracts.ts
│   ├── claimsRegistry.ts
│   ├── proofRegistry.ts
│   └── versions.ts
├── services/
│   ├── canonicalBriefService.ts
│   ├── contentGoalResolver.ts
│   ├── contentIntelligenceOrchestrator.ts
│   ├── campaignPlanService.ts
│   ├── contentGenerationService.ts
│   ├── outputValidationService.ts
│   ├── contentQualityService.ts
│   └── generationTraceService.ts
├── schemas/
│   ├── canonicalBrief.schema.ts
│   ├── carousel.schema.ts
│   ├── reel.schema.ts
│   ├── linkedin.schema.ts
│   ├── xThread.schema.ts
│   └── campaignPlan.schema.ts
└── tests/
    ├── intelligence/
    ├── generation/
    ├── campaign/
    └── regression/
```

Do not perform this entire refactor before fixing behavior.

Use small migrations:

1. introduce shared interfaces and registries;
2. move one logical block at a time;
3. retain compatibility exports from `marketingIntelligence.ts`;
4. update tests;
5. remove old exports only after all callers migrate.

---

# 15. Complete Implementation Plan

## Phase 0 — Verification and Baseline

**Priority:** P0  
**Effort class:** Small  
**Purpose:** Confirm the audit’s few unverified assumptions before changing architecture.

### Tasks

- verify every generation entry point;
- verify human review and publishing approval;
- verify all references to `buildSystemPrompt`;
- verify all callers of `generateCampaignDayPlan`;
- verify current JSON schemas;
- verify the frontend campaign date component;
- verify whether claims, ICPs, or proofs exist under different names;
- capture representative current outputs.

### Required baseline samples

Generate and save:

- one LinkedIn post with `contentGoal`;
- one LinkedIn post without `contentGoal`;
- one Instagram carousel;
- one Reel request;
- one multi-platform campaign;
- one Insights article;
- one Job Marketing post.

### Deliverable

A short confirmation report listing:

- confirmed findings;
- corrected findings;
- affected files;
- regression risk;
- baseline output fixtures.

---

## Phase 1 — Unify the Intelligence Path

**Priority:** P0  
**Effort class:** Medium  
**Business impact:** Highest

### Tasks

1. Create `CanonicalContentBrief`.
2. Implement `resolveContentGoal`.
3. Implement audience and domain resolution.
4. Normalize existing UI fields into the canonical brief.
5. Inject all existing strong intelligence blocks into one canonical path.
6. Route social, carousel, article, campaign, and revision calls through the resolver.
7. Add telemetry for any remaining fallback invocation.
8. Place legacy fallback behind a temporary feature flag.
9. Preserve current model routing and retry behavior.
10. Store generation trace fields.

### Acceptance criteria

- requests without `contentGoal` receive a resolved goal;
- no known UI route receives the bare fallback prompt;
- the same raw brief is traceable to final generation;
- content-goal source is stored;
- existing strong hooks, archetypes, banned language, exemplars, and compliance blocks remain active;
- existing Insights and Job Marketing outputs do not regress.

---

## Phase 2 — Carousel and Reel Contracts

**Priority:** P0  
**Effort class:** Medium  
**Business impact:** Very high

### Tasks

1. Create format-contract registry.
2. Add carousel schema.
3. Add Reel schema.
4. Update prompt assembly to include selected format contract.
5. Validate structured output.
6. Reject title-only carousel slides.
7. Reject incomplete Reel scripts.
8. Add one controlled repair call for invalid output.
9. Update UI rendering for structured slides and scenes.
10. Add export/copy support for final production fields.

### Acceptance criteria

#### Carousel

- default 6–8 slides;
- every slide has headline, body, and visual direction;
- narrative progresses logically;
- caption, CTA, and alt text are present;
- no slide is only a label.

#### Reel

- hook starts within three seconds;
- complete narration exists;
- timing and scene direction exist;
- on-screen text exists where useful;
- CTA timing and wording exist;
- cover text and caption exist.

---

## Phase 3 — Campaign Orchestration and Date Fix

**Priority:** P0/P1  
**Effort class:** Medium

### Tasks

1. Add `selectedPlatforms` to campaign input.
2. Add schedule slots or per-platform cadence.
3. Remove both hardcoded one-to-two-item instructions.
4. Pass canonical brief into campaign planning.
5. Add narrative arc.
6. Validate schedule-slot coverage.
7. Add platform-native format selection.
8. Add duplicate-strategy detection.
9. Fix campaign date picker.
10. Test timezone and date-range behavior.

### Acceptance criteria

- selected platforms are never guessed;
- every schedule slot has one asset plan;
- unsupported formats are not assigned;
- LinkedIn, Instagram, and X plans differ meaningfully;
- today and future dates are selectable;
- past-date behavior follows the intended product rule;
- start/end date validation works.

---

## Phase 4 — Evidence, Claims, and Proof

**Priority:** P1  
**Effort class:** Medium to Large

### Tasks

1. Inventory facts currently hardcoded in prompts and knowledge files.
2. Classify each fact by status.
3. Create versioned typed claims/proof registry.
4. Move approved knowledge out of `attached_assets/`.
5. Load registry at startup.
6. Validate registry structure.
7. Retrieve only relevant records per request.
8. attach claim and proof IDs to generation trace.
9. block internal-only and prohibited facts.
10. flag requires-review content.

### Acceptance criteria

- public content uses only approved or user-supplied facts;
- unsupported metrics are removed or flagged;
- proof is traceable;
- internal-only records never appear;
- knowledge is versioned;
- no arbitrary local file is read per request;
- prompt size remains bounded.

---

## Phase 5 — Quality Governance

**Priority:** P1  
**Effort class:** Medium

### Tasks

1. Add deterministic schema and claims validation.
2. Add six-dimension editorial evaluator.
3. Add duplicate-content checks.
4. Add one automatic revision attempt.
5. Store quality outcomes.
6. surface warnings to human reviewers.
7. verify review and Super Admin gates.

### Acceptance criteria

- malformed output cannot be presented as complete;
- claim-safety failure is a hard stop;
- editorial failures receive actionable revision instructions;
- unresolved failures are clearly flagged;
- no infinite regeneration loop;
- human approval remains required.

---

## Phase 6 — Audience Expansion

**Priority:** P2  
**Effort class:** Medium

### Tasks

1. Introduce composable audience context.
2. retain compatibility with the four current audience enums.
3. add ten prioritized role profiles.
4. map roles to domain, pain points, outcomes, objections, and proof preferences.
5. add admin/config versioning.
6. test across current domains.

### Acceptance criteria

- the same family can support different roles and seniority;
- prompts do not require dozens of hardcoded audience blocks;
- current audiences remain supported;
- audience relevance improves without duplicating UI inputs.

---

## Phase 7 — Performance Learning

**Priority:** Deferred  
**Effort class:** Large

Do not implement automated learning until:

- publication data is reliable;
- platform metrics are available;
- campaigns and assets have stable IDs;
- human review outcomes are recorded.

For now, reserve fields for:

- platform;
- format;
- hook;
- goal;
- audience;
- quality score;
- approval;
- published status;
- performance metrics.

Do not allow performance learning to automatically change brand, claims, or publishing rules.

---

# 16. Test Plan

## 16.1 Unit tests

- content-goal resolution;
- canonical brief construction;
- audience mapping;
- domain mapping;
- platform contract selection;
- format contract selection;
- carousel validation;
- Reel timing validation;
- campaign schedule coverage;
- claim status filtering;
- proof retrieval;
- generation trace serialization;
- date validation.

## 16.2 Integration tests

- UI brief without goal → inferred goal → canonical intelligence path;
- carousel request → structured slides;
- Reel request → structured scenes;
- campaign UI → selected platform schedule → campaign plan;
- approved claim → included with trace;
- prohibited claim → blocked;
- invalid output → one repair attempt;
- generated output → existing review workflow.

## 16.3 Regression tests

Protect:

- Thought Leadership;
- Educational;
- Job Marketing;
- Brand Perspective;
- Healthcare Staffing;
- IT Staffing;
- General Staffing;
- Government;
- LinkedIn;
- Instagram;
- X;
- Facebook;
- Article;
- Insights;
- current model routing;
- retries;
- compliance modes;
- prompt versioning;
- current approval flow.

## 16.4 Golden-output tests

Maintain representative fixtures for:

- strong LinkedIn post;
- carousel;
- Reel;
- X thread;
- campaign plan;
- Insights article;
- Job Marketing post.

Do not assert exact prose.

Assert:

- required structure;
- key brief concepts;
- platform fit;
- claim safety;
- absence of banned patterns.

---

# 17. Rollout and Risk Controls

## Feature flags

Recommended flags:

```text
canonical_content_brief_v1
unified_intelligence_path_v1
carousel_contract_v1
reel_contract_v1
campaign_schedule_v1
claims_registry_v1
output_quality_v1
```

## Rollout sequence

1. internal test users;
2. side-by-side generation;
3. compare quality and failure rate;
4. enable by format;
5. monitor fallback usage;
6. remove fallback only after stability;
7. expand audience profiles;
8. introduce claims/proof administration later.

## Metrics

Track:

- schema failure rate;
- automatic-repair rate;
- fallback-path usage;
- average prompt size;
- model cost;
- generation latency;
- reviewer edits;
- rejection reasons;
- approval rate;
- duplicate-platform rate;
- unsupported-claim rate.

---

# 18. Required Replit Deliverables

Replit must return:

1. confirmed audit findings;
2. corrected or unconfirmed findings;
3. architecture diagram;
4. list of reused components;
5. list of enhanced components;
6. list of new components;
7. list of retired or deprecated paths;
8. current and updated API contracts;
9. current and updated schemas;
10. migrations, if any;
11. files changed;
12. feature flags;
13. tests added;
14. test results;
15. before-and-after outputs;
16. known limitations;
17. rollback plan.

Required before-and-after examples:

- carousel;
- Reel;
- campaign across at least three platforms;
- generation without explicit `contentGoal`;
- evidence-backed post;
- prohibited-claim test.

---

# 19. Definition of Done

The enhancement is complete when:

- all known generation routes use canonical context;
- missing `contentGoal` no longer causes a weak prompt;
- carousels contain real slide copy;
- Reels contain production-ready scripts;
- campaign plans honor the actual schedule and selected platforms;
- format structures are schema-validated;
- approved evidence can be retrieved at runtime;
- prohibited/internal claims are blocked;
- quality failures are detectable;
- generation decisions are traceable;
- human review and publishing approval are verified and preserved;
- existing strong Insights and Job Marketing behavior does not regress.

---

# 20. Final Instruction to Replit

Implement this as an **enhancement of the existing Content Intelligence Layer**, not as a replacement product.

The correct order is:

1. verify the audit;
2. unify context resolution;
3. add format contracts;
4. repair campaign orchestration;
5. add evidence and claim governance;
6. add calibrated quality controls;
7. expand audience intelligence compositionally;
8. defer performance learning.

The highest-value change is not adding more prompt text.

It is ensuring that every request receives the right existing intelligence, the correct platform and format contract, approved evidence, and enforceable quality validation.
