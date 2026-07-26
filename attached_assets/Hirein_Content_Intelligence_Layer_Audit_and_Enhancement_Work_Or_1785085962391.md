# Content Intelligence Layer Audit and Enhancement Work Order

**Product:** Hire’in Content Studio  
**Document type:** Architecture audit, gap comparison, and implementation specification  
**Implementation target:** Replit  
**Primary objective:** Strengthen the existing Content Intelligence Layer without rebuilding capabilities, duplicating user inputs, creating parallel prompt systems, or replacing working governance.

---

## 1. Executive Instruction to Replit

Audit the current Content Studio implementation before changing architecture or adding new fields.

The Content Studio already contains significant infrastructure and intelligence, including structured outputs, audience and domain resolution, content goals, template rendering, model selection, retry handling, compliance modes, prompt versioning, social-kit generation, quality review, human peer review, and a Super Admin publishing gate.

The required work is **not** to create a second content-generation framework.

The required work is to:

1. Identify everything already captured from the user, derived by the system, loaded from knowledge files, stored in registries, or injected into prompts.
2. Trace whether each item reaches campaign planning and final content generation.
3. Identify weak, missing, duplicated, ignored, or hardcoded intelligence.
4. Compare the current implementation with the target Content Intelligence Framework in this document.
5. Reuse and enhance the existing architecture wherever possible.
6. Add only the minimum missing components.
7. Fix the confirmed carousel, campaign-platform, brief-flow, Reels, and date-picker defects.
8. Preserve human review and claim-safe publishing.

Do not begin with a broad rewrite.

Do not rename or recreate existing fields merely to match the names used in this document. Map target concepts to current implementation names first.

---

# 2. Product Definition

## 2.1 Official Architecture Name

Use:

# **Content Intelligence Framework**

The runtime decision and orchestration layer may be called:

# **Content Intelligence Engine**

The brand-specific intelligence configuration may be called:

# **Content Intelligence DNA**

Recommended product relationship:

> Content Studio is powered by the Content Intelligence Engine, operating through the Content Intelligence Framework and each brand’s Content Intelligence DNA.

“Secret Sauce” may remain an internal description, but it should not be the formal architecture or user-facing name.

---

## 2.2 Product Promise

> Turn one strategic brief into complete, platform-native, brand-aligned, evidence-led, and publish-ready content—not generic AI outlines.

The system should not only write content. It should make structured decisions about:

- who the content is for;
- what business and audience outcome it should support;
- what point of view it should communicate;
- which evidence it may use;
- how the idea should change by platform;
- which format contract applies;
- whether the result is strong and safe enough for human review.

---

# 3. Existing Capabilities That Must Be Preserved

The audit must confirm the exact implementation, but the current known baseline includes the following.

## 3.1 Existing Content Studio Infrastructure

Preserve and reuse:

- structured JSON outputs;
- schema validation where currently present;
- generation retries;
- model tiers and model-routing logic;
- content template rendering;
- compliance modes;
- prompt versioning;
- social-kit generation;
- quality-review workflow;
- peer-review workflow;
- Super Admin publishing approval;
- human review before public release;
- claim-free-by-default behavior;
- current audience, domain, platform, theme, and content-goal resolution;
- existing content history, draft, review, and publishing records.

Do not bypass or replace these with a new standalone generator.

## 3.2 Existing Knowledge Assets

Audit all current use of:

- `HIREIN_AI_KNOWLEDGE_BASE.md`
- `HIREIN_DOMAIN_EXPERTISE.md`
- `HIREIN_CONTENT_CRAFT.md`
- `HIREIN_MASTER_PROMPT.md`
- `HIREIN_PROOF_LIBRARY.md`
- `HIREIN_CURRENT_JOBS.md`

For each file, document:

- where it is loaded;
- when it is loaded;
- which generators receive it;
- whether it is summarized, truncated, cached, or filtered;
- which target intelligence concepts it already satisfies;
- whether any content conflicts with another source;
- whether the content is versioned;
- whether Replit should preserve, restructure, or retire it.

## 3.3 Existing Shared Commercial Intelligence

Preserve and reuse the shared intelligence architecture where available.

### Shared ICP Registry

Known concepts include:

- domain;
- buyer type;
- title;
- description;
- primary pain points;
- decision criteria;
- proof themes;
- prohibited claims;
- preferred differentiators;
- typical buyer-stage entry;
- active status.

This registry should satisfy a large portion of the Audience Intelligence layer. Do not create a duplicate audience database unless the current registry cannot support required use cases.

### Shared Claim Registry

Known claim classifications include:

- `approved_positioning`
- `approved_fact`
- `approved_case_study`
- `internal_only`
- `requires_review`
- `prohibited`

This registry should remain the primary source for claim permissions and restrictions.

Expected behavior:

- prohibited claims become forbidden assertions;
- approved positioning becomes permitted language;
- approved facts and case studies may be used with traceability;
- requires-review claims are marked for verification;
- internal-only claims must never reach public content.

Do not create a separate competing claim or compliance system.

### BD and Content Intelligence Bridge

Preserve the intended shared-intelligence relationship:

- BD intelligence may contribute pain points, ICP context, objections, buyer stage, and opportunity signals.
- Content intelligence may contribute proof assets, educational narratives, and market-facing content.
- Imported ideas should retain metadata such as domain, buyer stage, pain-point theme, and detected ICP.
- The Content Studio remains a marketing and publishing product, not a replacement for the BD Agent.

The Marketing Agent must not expose a generic “Capability/BD” content goal merely because BD intelligence is available. Commercial intent should be represented through audience, funnel stage, CTA, campaign objective, and approved proof.

---

# 4. Mandatory Audit Before Implementation

Replit must inspect the live code and produce the following audit artifacts before or alongside implementation.

## 4.1 Current-State Architecture Map

Document the complete flow:

```text
User Input
→ UI Form State
→ API Request
→ Brief Construction
→ Goal/Audience/Domain Resolution
→ Knowledge and Registry Retrieval
→ Prompt Assembly
→ Model Call
→ Output Validation
→ Quality Review
→ Human Review
→ Publishing
→ Performance Feedback
```

For every step, identify:

- file or module;
- function or service;
- input fields;
- derived fields;
- database reads;
- prompt blocks;
- output schema;
- fallback behavior;
- failure behavior.

## 4.2 User-Input Inventory

Create a table containing every current Content Studio user input.

Required columns:

| Current field | UI location | API field | Storage field | Required/optional | Used by | Target concept | Keep/change |
|---|---|---|---|---|---|---|---|

Include at minimum:

- brand or organization;
- product or service;
- topic;
- audience;
- domain;
- platform;
- format;
- content type;
- content goal;
- tone;
- brief;
- key message;
- CTA;
- source material;
- campaign date;
- campaign duration;
- cadence;
- selected platforms;
- content series;
- evidence or claim input;
- any advanced creative-direction fields.

The purpose is to ensure the enhancement does not ask users for information that the application already captures.

## 4.3 Derived-Intelligence Inventory

Create a second table for information inferred or resolved by the system.

Examples:

- inferred content goal;
- inferred audience;
- inferred domain;
- buyer stage;
- audience tension;
- hook archetype;
- psychological contract;
- platform role;
- funnel stage;
- content pillar;
- proof theme;
- claim permission;
- banned language;
- CTA type;
- quality score.

Required columns:

| Derived concept | Current logic | Source | Used in campaign plan | Used in final generation | Gap |
|---|---|---|---|---|---|

## 4.4 Prompt and Generator Inventory

Map all generation routes.

Required columns:

| Generator/route | Trigger | System prompt | User prompt | Knowledge injected | Schema | Fallback path | Quality review |
|---|---|---|---|---|---|---|---|

Specifically identify:

- the intelligence path;
- the standard or fallback path;
- any route that activates only when `contentGoal` is set;
- carousel generation;
- standard social-post generation;
- article generation;
- campaign generation;
- platform adaptation;
- social-kit generation;
- Reels or short-video generation;
- content revision;
- quality scoring.

## 4.5 Reuse and Gap Classification

Every target capability in this document must be classified as one of:

- **REUSE:** Already exists and works.
- **ENHANCE:** Exists but is incomplete or not consistently used.
- **CONNECT:** Exists but does not reach the correct downstream generator.
- **CONSOLIDATE:** Duplicate implementations exist and should share one source.
- **ADD:** Material capability is missing.
- **RETIRE:** Weak or conflicting implementation should be removed.

No new table, field, prompt file, or service should be added without this classification.

---

# 5. Current Known Defects to Verify

## 5.1 Carousel Output Is an Outline

Known symptom:

> “Slide 2: AI & Machine Learning—innovate and automate the future.”

This is a slide label or outline, not publish-ready slide copy.

Audit:

- current carousel template;
- user-prompt template;
- content schema;
- content-depth constraints;
- whether the intelligent prompt blocks are injected;
- whether slide body, support text, visual direction, and CTA are required;
- whether empty or title-only slides pass validation.

## 5.2 Campaign Platform Coverage Is Overridden

Known hardcoded instruction:

> Suggest 1–2 content items per day.

Audit:

- where the limit is defined;
- whether selected platforms reach the campaign prompt;
- whether platform count conflicts with output schema;
- whether one global limit silently overrides user selections;
- whether identical copy is reused across platforms.

## 5.3 Brief Intelligence Does Not Consistently Reach Generation

Known behavior:

- the richer intelligence path activates only when `contentGoal` is available;
- some carousel or standard-generation routes enter a weak fallback path;
- the detailed brief may be visible in the UI but not injected into the final prompt.

Audit the complete field trace from UI to prompt.

## 5.4 Reels Lack a Dedicated Contract

Audit whether Reels currently define:

- hook timing;
- spoken narration;
- scene timings;
- on-screen text;
- presenter direction;
- B-roll;
- screen recording;
- CTA timing;
- caption;
- cover text.

A generic free-form social prompt is not sufficient.

## 5.5 Campaign Date Picker

Verify:

- today is selectable;
- future dates are selectable;
- past-date behavior follows the intended rule;
- timezone handling is correct;
- start date cannot be after end date;
- no off-by-one error exists.

This should remain a small standalone frontend fix.

---

# 6. Target Content Intelligence Framework

The target framework consists of nine connected intelligence capabilities.

These are logical capabilities, not a requirement to create nine services, tables, or agents.

Reuse existing services and data structures wherever possible.

---

## 6.1 Brand Intelligence

Purpose: maintain the organization’s recognizable identity and position.

Target concepts:

- brand promise;
- product positioning;
- core beliefs;
- contrarian beliefs;
- differentiators;
- brand voice;
- level of directness;
- signature vocabulary;
- prohibited language;
- approved positioning;
- signature stories;
- proof assets;
- preferred CTA styles;
- competitor framing;
- topics the brand should avoid;
- founder or expert perspective;
- accessibility and inclusion rules.

Likely sources to reuse:

- brand settings;
- knowledge-base files;
- master prompt;
- claim registry;
- proof library;
- template-level voice controls.

Do not add a duplicate brand profile when these values already exist. Normalize them into one runtime context.

---

## 6.2 Audience and ICP Intelligence

Purpose: understand the reader beyond a broad title.

Target concepts:

- primary audience;
- secondary audience;
- audience category;
- domain;
- buyer type;
- role or title;
- seniority;
- current problem;
- desired outcome;
- objections;
- decision criteria;
- buying trigger;
- emotional or operational tension;
- sophistication level;
- buyer stage;
- trusted proof;
- preferred content depth;
- preferred differentiators;
- prohibited claims.

### Required Audience Families

The framework must support audience configuration without hardcoding one industry.

#### Enterprise Leadership

- CEO
- COO
- CIO
- CTO
- CHRO
- CMO
- business-unit leader
- founder
- board or executive stakeholder

#### Functional Buyers and Decision-Makers

- Talent Acquisition leadership
- HR leadership
- staffing leadership
- workforce operations
- learning and development
- compliance and risk
- procurement
- finance
- IT and security
- product and engineering leadership
- marketing and growth leadership

#### Operators and Practitioners

- recruiters
- sourcers
- account managers
- staffing managers
- program managers
- HR operations
- marketers
- product managers
- engineering and QA professionals

#### Candidates and Professionals

- healthcare professionals
- IT professionals
- engineering professionals
- finance professionals
- sales professionals
- non-IT and professional-services talent
- entry-level candidates
- experienced professionals
- contractors and consultants

#### Partners and Ecosystem

- MSP/VMS partners
- staffing partners
- implementation partners
- employers and clients
- training and credential partners
- industry communities

Use the Shared ICP Registry as the primary source when it covers these concepts.

---

## 6.3 Campaign Strategy Intelligence

Purpose: convert a business priority into a connected content narrative.

Target concepts:

- business objective;
- content objective;
- content goal;
- primary audience;
- funnel stage;
- campaign thesis;
- campaign promise;
- core point of view;
- audience tension;
- narrative sequence;
- content pillars;
- platform roles;
- selected platforms;
- frequency and cadence;
- campaign dates;
- CTA;
- evidence requirements;
- success metrics.

### Existing Mandatory Content Goals

Preserve current goals:

- Thought Leadership
- Educational
- Job Marketing
- Brand Perspective

### Recommended Extended Goals

Add only where current taxonomies cannot express the need:

- Product Education
- Market Insight
- Customer Proof
- Employer Brand
- Candidate Education
- Recruitment Marketing
- Launch or Announcement
- Event Promotion
- Community Engagement
- Demand Generation
- Conversion Support

Do not add a generic “Capability/BD” goal to the Marketing Agent.

### Recommended Campaign Narrative Archetypes

- problem → cause → framework → proof → action;
- myth → reality → implication → recommendation;
- market shift → enterprise impact → operator response;
- before → failure → new workflow → result;
- awareness → education → consideration → evidence → action;
- job awareness → role value → requirements → employee experience → apply;
- launch teaser → problem → reveal → demonstration → proof → CTA.

---

## 6.4 Content Psychology Intelligence

Purpose: make content earn attention and create a specific reader reaction without resorting to generic clickbait.

Target concepts:

- hook archetype;
- curiosity mechanism;
- audience tension;
- belief challenged;
- emotional driver;
- operational consequence;
- trust mechanism;
- proof mechanism;
- desired reader reaction;
- CTA friction;
- narrative pacing.

### Hook Archetypes

- brutal truth;
- hidden cost;
- common mistake;
- contrarian belief;
- operator insight;
- myth versus reality;
- before and after;
- unexpected evidence;
- executive question;
- practical teardown;
- unpopular lesson;
- risk signal;
- missed opportunity;
- decision framework;
- field observation.

The system should select the hook based on audience, goal, platform, and evidence—not randomly.

---

## 6.5 Platform Intelligence

Purpose: adapt the same strategic idea to native platform behavior.

### LinkedIn

Primary roles:

- B2B credibility;
- executive perspective;
- professional education;
- founder or operator viewpoint;
- enterprise frameworks;
- market interpretation;
- evidence-backed discussion.

Supported formats:

- standard post;
- executive point-of-view post;
- contrarian post;
- framework post;
- operational teardown;
- document/carousel post;
- article;
- newsletter;
- poll where enabled;
- product or launch post;
- hiring or job-marketing post.

### Instagram

Primary roles:

- visual education;
- candidate attraction;
- career education;
- people and culture;
- visual explanation;
- Reels and short-form authority;
- stories and engagement.

Supported formats:

- carousel;
- Reel;
- static post;
- story sequence;
- founder or expert video;
- product demonstration;
- job-marketing post.

### X

Primary roles:

- concise insight;
- timely commentary;
- discussion testing;
- practical tips;
- job alerts;
- sharp points of view.

Supported formats:

- single post;
- short thread;
- detailed thread;
- commentary;
- quote-post draft;
- framework breakdown;
- job alert.

### Hire’in Insights or Canonical Long-Form Channel

Primary roles:

- canonical source article;
- evidence-led interpretation;
- market and workforce insight;
- deeper educational content;
- source-backed analysis;
- content from real-world staffing and workforce experience supported by research.

Supported formats:

- article;
- insight report;
- guide;
- research summary;
- executive brief;
- case analysis;
- trend analysis;
- evergreen resource.

### Extension-Ready Platforms

Only implement when currently supported or explicitly prioritized:

- YouTube Shorts;
- long-form YouTube;
- email newsletter;
- Facebook;
- TikTok;
- Google Business Profile.

The architecture should support future contracts without forcing all channels into the first implementation.

---

## 6.6 Format Intelligence

Purpose: ensure each requested asset has a machine-validatable, publish-ready structure.

### Core Format Contracts

#### A. LinkedIn Standard Post

Required output:

- hook;
- opening tension;
- complete post body;
- example, evidence, or practical implication;
- audience takeaway;
- CTA;
- suggested first comment;
- visual recommendation;
- source references where applicable.

#### B. LinkedIn Executive Point-of-View Post

Required output:

- executive claim;
- business context;
- decision implication;
- operator implication;
- evidence or clearly marked informed opinion;
- recommended action;
- discussion CTA.

#### C. Carousel or Document Post

Default length: 6–8 slides.

Narrative pattern:

1. hook;
2. recognizable problem;
3. why the common approach fails;
4. insight or framework;
5. application or evidence;
6. executive and operator implication;
7. recommended action;
8. CTA, when an eighth slide is appropriate.

Each slide must include:

- slide number;
- purpose;
- headline;
- body copy;
- supporting line;
- visual direction;
- source reference where applicable.

Default copy limits:

- headline: 3–8 words;
- body: 20–45 words;
- supporting line: no more than 18 words;
- one central idea per slide.

Reject title-only slides.

#### D. Reel or Short-Video Script

Required output:

- video title;
- target duration;
- 0–3 second hook;
- complete spoken narration;
- scene-by-scene timing;
- on-screen text;
- presenter or camera direction;
- B-roll direction;
- screen-recording direction where applicable;
- CTA timing and exact line;
- cover text;
- caption;
- pinned comment;
- accessibility notes.

#### E. Instagram Static Post

Required output:

- image headline;
- image supporting text;
- visual concept;
- caption;
- CTA;
- alt text;
- hashtags or discoverability keywords where enabled.

#### F. Instagram Story Sequence

Required output:

- number of frames;
- objective for each frame;
- exact on-screen copy;
- interaction element;
- visual direction;
- final CTA.

#### G. X Single Post

Required output:

- final post copy;
- optional supporting reply;
- CTA or discussion prompt where relevant;
- source link placeholder where applicable.

#### H. X Thread

Required output:

- opening post;
- numbered or logically ordered posts;
- one idea per post;
- evidence placement;
- closing takeaway;
- CTA.

#### I. Article or Insight

Required output:

- working title;
- final title;
- executive summary;
- audience and purpose;
- opening;
- structured sections;
- evidence and sources;
- practical implications;
- risks or limitations;
- conclusion;
- CTA;
- social repurposing summary;
- metadata and SEO fields where currently supported.

#### J. Job-Marketing Content

Required output should be adapted by platform and include only approved job information:

- role;
- location;
- employment or contract context;
- key requirements;
- role value;
- candidate CTA;
- compliance-safe wording;
- no invented compensation, benefits, sponsorship, client identity, or guarantees.

#### K. Campaign Plan

Required output:

- campaign thesis;
- audience;
- goal;
- dates;
- cadence;
- selected platforms;
- platform roles;
- daily or scheduled narrative;
- one required content record per selected platform and scheduled publishing slot;
- format;
- hook angle;
- key message;
- evidence needed;
- CTA;
- relationship to campaign narrative.

There must be no hardcoded global maximum of one or two content items that overrides selected platform coverage.

---

## 6.7 Evidence and Claims Intelligence

Purpose: make enterprise, SaaS, AI, staffing, and workforce content credible and safe.

Every material statement should be traceable to one of:

- approved brand positioning;
- approved fact;
- approved case study;
- source-backed market evidence;
- internal-only information;
- requires-review claim;
- prohibited claim;
- expert interpretation;
- inference.

Rules:

- Do not invent statistics.
- Do not invent customers.
- Do not invent testimonials.
- Do not invent product capabilities.
- Do not invent certifications.
- Do not invent results.
- Do not convert internal-only information into public content.
- Clearly distinguish evidence from informed opinion.
- Mark unresolved claims for human verification.
- Preserve source references through generation and review.

The Shared Claim Registry and Proof Library should be reused as the primary foundation.

---

## 6.8 Quality Governance Intelligence

Purpose: prevent incomplete, generic, duplicated, unsupported, or off-brand output.

### Evaluation Dimensions

Score each from 0–10:

1. brief fidelity;
2. audience relevance;
3. hook strength;
4. specificity;
5. point-of-view strength;
6. platform fit;
7. format completeness;
8. narrative progression;
9. evidence quality;
10. brand alignment;
11. CTA relevance;
12. visual usability;
13. originality;
14. claim safety.

### Mandatory Failure Conditions

Reject or internally revise when:

- a carousel slide contains only a title;
- required format fields are missing;
- selected audiences are ignored;
- selected platforms are missing;
- identical copy is reused across platforms without intentional reason;
- content includes prohibited claims;
- evidence is invented;
- the CTA conflicts with the content goal;
- the output is generic enough to apply to any company;
- the content lacks a recognizable point of view;
- banned phrases appear;
- the content goal, audience, or platform is unresolved;
- a generation route bypasses the approved brief context.

### Suggested Threshold

- overall score: at least 82/100;
- brief fidelity: at least 8/10;
- audience relevance: at least 8/10;
- platform fit: at least 8/10;
- format completeness: at least 9/10;
- claim safety: mandatory pass.

The current quality-review workflow should be enhanced rather than replaced.

Human peer review and Super Admin publication approval remain mandatory.

---

## 6.9 Performance Learning Intelligence

Purpose: learn from approved and published content without allowing uncontrolled self-modification.

Target inputs:

- impressions;
- reach;
- engagement;
- saves;
- shares;
- comments;
- clicks;
- conversion or lead action;
- platform;
- audience;
- hook archetype;
- format;
- content goal;
- campaign;
- human quality score;
- rejection or revision reason.

Target behavior:

- identify high-performing patterns;
- recommend future hooks, formats, and publishing cadence;
- do not automatically change brand rules or claims;
- do not automatically publish;
- maintain explainable recommendations;
- preserve human control.

This may be deferred if performance data is not yet available, but the data model should not prevent future implementation.

---

# 7. Canonical Runtime Brief

The framework needs one normalized runtime brief used by every generator.

This does **not** require a new user form.

Build the runtime brief by mapping current user fields, inferred values, registry values, knowledge files, and defaults.

## 7.1 Target Runtime Schema

```json
{
  "briefId": "string",
  "rawBrief": "string",
  "brand": {
    "id": "string",
    "name": "string",
    "voice": [],
    "coreBeliefs": [],
    "contrarianBeliefs": [],
    "approvedPositioning": [],
    "bannedLanguage": [],
    "preferredCtaStyles": []
  },
  "productOrOffering": {
    "name": "string",
    "category": "string",
    "approvedCapabilities": [],
    "differentiators": []
  },
  "audience": {
    "primary": {},
    "secondary": [],
    "domain": "string",
    "buyerStage": "string",
    "painPoints": [],
    "desiredOutcomes": [],
    "objections": [],
    "decisionCriteria": []
  },
  "strategy": {
    "businessObjective": "string",
    "contentGoal": "string",
    "funnelStage": "string",
    "topic": "string",
    "campaignThesis": "string",
    "pointOfView": "string",
    "beliefChallenged": "string",
    "desiredAudienceAction": "string",
    "cta": "string"
  },
  "campaign": {
    "campaignId": "string",
    "series": "string",
    "startDate": "date",
    "endDate": "date",
    "cadence": "string",
    "selectedPlatforms": [],
    "requestedFormats": []
  },
  "craft": {
    "hookArchetype": "string",
    "psychologicalContract": "string",
    "tone": [],
    "depth": "string",
    "platformRules": {},
    "formatContract": {}
  },
  "evidence": {
    "approvedClaims": [],
    "approvedProof": [],
    "requiresReview": [],
    "prohibitedClaims": [],
    "sourceMaterials": []
  },
  "governance": {
    "complianceMode": "string",
    "humanReviewRequired": true,
    "promptVersion": "string",
    "qualityThreshold": 82
  }
}
```

## 7.2 Resolution Rules

Resolve the content goal in this order:

```text
Explicit user selection
→ Existing brief or template value
→ Inference from business objective
→ Inference from funnel stage and CTA
→ Safe default: Thought Leadership or Educational
```

Do not use the safe default when a more specific current field already exists.

Every generator must receive the resolved runtime brief.

Remove or upgrade any weak fallback route that omits audience intelligence, brand rules, platform rules, claim controls, or format requirements.

---

# 8. Target Generation Pipeline

```text
1. Receive current user inputs
2. Load stored brand and campaign context
3. Resolve domain, audience, goal, funnel stage, and requested format
4. Retrieve matching ICP intelligence
5. Retrieve approved claims and proof
6. Build the canonical runtime brief
7. Validate required context
8. Plan campaign or single-asset narrative
9. Select platform contract
10. Select format contract
11. Generate publish-ready content
12. Validate schema
13. Run quality and claim evaluation
14. Internally revise failed content
15. Save generation trace and prompt version
16. Send to existing human review workflow
17. Publish only through existing approval gate
18. Record performance and human feedback
```

A request must not bypass steps 3–14 merely because `contentGoal` or another optional field was absent in the UI.

---

# 9. Comparison Matrix Replit Must Complete

Replit must populate this matrix using the live implementation.

| Target capability | Current implementation | Evidence/file/function | Classification | Required change |
|---|---|---|---|---|
| Brand intelligence |  |  | REUSE/ENHANCE/CONNECT/ADD |  |
| Audience and ICP intelligence |  |  |  |  |
| Campaign strategy |  |  |  |  |
| Content-goal resolution |  |  |  |  |
| Content psychology |  |  |  |  |
| Platform intelligence |  |  |  |  |
| Format contracts |  |  |  |  |
| Carousel depth |  |  |  |  |
| Reels scripting |  |  |  |  |
| Article generation |  |  |  |  |
| Job marketing |  |  |  |  |
| Evidence retrieval |  |  |  |  |
| Claim registry |  |  |  |  |
| Quality scoring |  |  |  |  |
| Human review |  |  |  |  |
| Super Admin approval |  |  |  |  |
| Campaign platform coverage |  |  |  |  |
| Prompt versioning |  |  |  |  |
| Generation traceability |  |  |  |  |
| Performance learning |  |  |  |  |

---

# 10. Implementation Requirements

## 10.1 Reuse Order

Use this order before adding new architecture:

1. reuse current fields;
2. reuse current derived values;
3. reuse current knowledge files;
4. reuse Shared ICP Registry;
5. reuse Shared Claim Registry;
6. reuse Proof Library;
7. reuse current prompt-building services;
8. reuse current format templates;
9. enhance current quality review;
10. add only the smallest missing component.

## 10.2 No-Duplication Rules

Do not:

- create a second audience taxonomy when the ICP Registry can be extended;
- create a second claim registry;
- create a parallel prompt engine;
- create duplicate brand or voice fields;
- ask users to enter the same information in multiple screens;
- preserve separate weak and intelligent generation paths;
- copy identical intelligence blocks into every template;
- create many independent operators where shared infrastructure with format personas is sufficient;
- replace the current approval workflow;
- expose internal-only data in generated content.

## 10.3 Preferred Technical Pattern

Use shared infrastructure with specialized contracts.

Recommended logical structure:

```text
Content Intelligence Orchestrator
├── Context Resolver
├── Brand Context Provider
├── Audience/ICP Context Provider
├── Campaign Strategy Resolver
├── Claims and Proof Provider
├── Platform Rule Provider
├── Format Contract Registry
├── Content Generator
├── Quality and Claims Evaluator
└── Review Workflow Adapter
```

Carousel, Reel, LinkedIn, X, article, and job-marketing behavior should normally be format contracts or personas on shared infrastructure—not completely separate AI systems.

---

# 11. Priority Implementation Plan

## Phase 0 — Mandatory Audit

Deliver:

- current architecture map;
- user-input inventory;
- derived-intelligence inventory;
- prompt inventory;
- comparison matrix;
- duplication report;
- proposed reuse plan.

No speculative rewrite.

## Phase 1 — Canonical Runtime Brief and Flow Repair

Implement:

- mapping from existing inputs to canonical runtime brief;
- reliable content-goal resolution;
- reliable audience and domain resolution;
- brief propagation to every generator;
- shared ICP and claim context;
- removal or strengthening of weak fallback behavior;
- generation trace showing which context was used.

This is the highest-value phase.

## Phase 2 — Publish-Ready Format Contracts

Implement or enhance:

- carousel;
- LinkedIn standard post;
- LinkedIn executive POV;
- Reel;
- Instagram static post;
- Instagram story;
- X post;
- X thread;
- article;
- job-marketing post.

Start with formats already exposed in the UI. Do not expose unsupported formats merely because the schema exists.

## Phase 3 — Campaign Platform Orchestration

Implement:

- selected-platform injection;
- selected cadence;
- platform coverage validation;
- platform-native adaptation;
- campaign narrative;
- removal of the hardcoded 1–2-item limit;
- duplication detection.

## Phase 4 — Quality and Claim Governance

Enhance:

- current quality review;
- format completeness;
- claim classification;
- banned-language checks;
- automatic internal revision;
- evidence traceability;
- human review handoff.

## Phase 5 — Performance Learning

Implement only after reliable publication and performance data are available.

---

# 12. Required Acceptance Criteria

## 12.1 Audit and Reuse

- Every existing user input is mapped.
- Every derived intelligence field is mapped.
- Every generator is inventoried.
- No duplicate field is introduced without written justification.
- No duplicate claim or ICP registry is created.
- Existing human approval remains intact.

## 12.2 Brief Fidelity

- Every generation route receives the normalized brief.
- The generated output reflects the selected or inferred audience.
- The generated output reflects the selected or inferred content goal.
- The generated output reflects the requested platform and format.
- The raw brief remains traceable.
- No rich UI brief is silently ignored.

## 12.3 Carousel

- Default output contains 6–8 slides unless the user requests otherwise.
- Every slide includes headline, body copy, supporting line, and visual direction.
- No slide is title-only.
- Slides form a clear narrative.
- Caption, CTA, and alt text are included.
- Output passes schema validation.

## 12.4 Reels

- Hook appears within 0–3 seconds.
- Full spoken narration is included.
- Scene timings are included.
- On-screen text is included.
- B-roll or visual direction is included.
- CTA timing and exact wording are included.
- Cover text and caption are included.

## 12.5 Campaign Platform Coverage

- Selected platforms reach the campaign planner.
- Every scheduled platform slot receives an asset record.
- No global 1–2-item restriction overrides the user’s selection.
- Platform-native versions are meaningfully different.
- Missing platform coverage fails validation.

## 12.6 Claims and Evidence

- Prohibited claims never appear.
- Internal-only claims never appear publicly.
- Requires-review claims are flagged.
- Statistics and results include source references or are removed.
- The system does not invent customers, testimonials, certifications, or product capabilities.

## 12.7 Quality

- Mandatory format fields are validated.
- Generic or incomplete outputs are revised before presentation.
- Claim safety passes.
- Quality score and failed checks are stored.
- Human review remains required before publishing.

## 12.8 Date Picker

- Today is selectable.
- Future dates are selectable.
- Past dates follow the intended rule.
- Timezone behavior is tested.
- Date-range validation works.

---

# 13. Required Tests

Add or update tests for:

## Unit Tests

- content-goal resolution;
- audience and domain resolution;
- canonical brief construction;
- ICP retrieval;
- claim filtering;
- platform selection;
- format contract selection;
- carousel schema;
- Reels schema;
- campaign platform-count validation;
- date validation;
- banned-language detection.

## Integration Tests

- UI brief → API → runtime brief → carousel;
- UI brief → campaign planner → all selected platforms;
- missing content goal → inferred goal → intelligent path;
- BD-imported idea → ICP metadata → Content Studio generation;
- approved claim → generated content;
- prohibited claim → blocked output;
- low-quality output → internal revision;
- generated content → existing human review workflow.

## Regression Tests

Confirm existing behavior still works for:

- Thought Leadership;
- Educational;
- Job Marketing;
- Brand Perspective;
- H1/H2/I1/I2 or current audience classes;
- healthcare;
- IT;
- engineering;
- finance;
- non-IT/professional;
- LinkedIn;
- Instagram;
- X;
- Hire’in Insights;
- existing templates;
- existing prompt versions;
- existing approval flow.

---

# 14. Required Replit Deliverables

Replit must return the following in its implementation response:

1. **Current-State Audit Report**
2. **Current-to-Target Comparison Matrix**
3. **List of Existing Components Reused**
4. **List of Existing Components Enhanced**
5. **List of New Components Added**
6. **List of Duplicate or Weak Components Removed**
7. **Database and Migration Impact**
8. **API Contract Changes**
9. **UI Changes**
10. **Prompt and Schema Changes**
11. **Files Changed**
12. **Test Coverage**
13. **Known Limitations**
14. **Screenshots or sample outputs for each changed format**
15. **Before-and-after carousel example**
16. **Before-and-after campaign platform example**
17. **Before-and-after Reels example**

The report must state explicitly whether any new field duplicates information already captured elsewhere.

---

# 15. Definition of Done

This work is complete only when:

- the current implementation has been audited;
- current intelligence is reused rather than recreated;
- every content-generation route receives sufficient intelligence;
- the brief is no longer decorative or ignored;
- carousels contain publish-ready slide copy;
- Reels contain production-ready scripts;
- campaign plans honor selected platforms and cadence;
- content types use format-specific contracts;
- audiences use shared ICP intelligence;
- claims use the shared registry and proof library;
- quality review rejects incomplete and generic output;
- human review and Super Admin publication control remain mandatory;
- tests demonstrate the fixes;
- Replit provides the completed comparison report.

---

# 16. Final Instruction

Do not treat this document as a request to rebuild the Content Studio.

Treat it as a request to:

> Audit the current Content Intelligence Layer, preserve everything that already works, connect intelligence that is currently dropped or bypassed, strengthen incomplete format and platform contracts, remove conflicting fallback behavior, and add only the missing capabilities required to produce complete, platform-native, evidence-led content.
