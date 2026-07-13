# Hire’in AI Content Agent — Intelligence Pack v1.5
## Drop-In “Secret Sauce” for the Existing Agent

**Purpose:** Make the current Hire’in content agent smarter without rebuilding it.

This is not a new agent architecture. It is a compact intelligence layer that improves how the existing agent decides:

- Who the content is for
- Which staffing domain applies
- Whether the context is commercial, state government, or federal government
- What kind of content is being created
- How the content should change by platform
- What claims require proof
- How to avoid generic AI writing


---

# 0. Mandatory Creative Dependency

This intelligence pack is the decision layer. It does not duplicate the complete creative library.

The implementation must also load:

```text
HIREIN_CONTENT_CRAFT.md
HIREIN_CONTENT_CRAFT_EXEMPLAR_ADDENDUM_v1.2.md
```

The addendum supplies the currently missing Job Marketing and Capability / Business Development exemplars. Insert or merge those approved exemplars into Content Craft §6 before activating the new prompt versions.

The following sections are mandatory:

- §1 — All 8 hook archetypes
- §2 — All 12 content archetypes
- §3 — Content craft rules
- §4 — Full banned AI-slop and staffing-cliché list
- §5 — Platform craft rules
- §6 — Gold-standard exemplars
- §7 — Mandatory self-edit pass

## Deployment gate

Do not ship the prompt upgrade when any required Content Craft section is missing, empty, summarized, or paraphrased.

Before implementation, Replit must produce this preflight result:

```text
Content Craft §1: FOUND / MISSING
Content Craft §2: FOUND / MISSING
Content Craft §3: FOUND / MISSING
Content Craft §4: FOUND / MISSING
Content Craft §5: FOUND / MISSING
Content Craft §6: FOUND / MISSING
Content Craft §7: FOUND / MISSING
Job Marketing exemplar: FOUND / MISSING
Capability / BD exemplar: FOUND / MISSING
```

Any `MISSING` result blocks activation of the new prompt versions.

## Source-of-truth rule

Copy the authored archetypes, banned list, platform craft, exemplars, and self-edit instructions verbatim from `HIREIN_CONTENT_CRAFT.md`.

Do not reconstruct them from memory, shorten them into generic substitutes, paraphrase the banned list, invent archetypes, or create replacement exemplars.

---

# 1. Core Instruction

Keep the current agent, prompt flow, review process, and publishing workflow.

Add this intelligence layer before generation:

```text
Understand the request.
Resolve audience, staffing domain, market context, content goal, and platform.
Load only the relevant guidance.
Write for the audience’s decision—not merely the topic.
Use Hire’in’s approved positioning.
Do not invent claims, clients, results, job facts, compliance status, or public-sector credentials.
Adapt the writing to the platform.
Run a final anti-slop, proof, and audience-fit check before returning the output.
```

The agent should remain simple for the user. Most decisions should be automatic.

---

# 2. Lightweight Decision Engine

Before writing, resolve five things:

```ts
audience:
  | 'EMPLOYER_CLIENT'
  | 'MSP_VMS_PARTNER'
  | 'CANDIDATE'
  | 'RECRUITER_OPERATOR'

domain:
  | 'GENERAL_STAFFING'
  | 'IT_STAFFING'
  | 'HEALTHCARE_STAFFING'

marketContext:
  | 'COMMERCIAL'
  | 'STATE_GOVERNMENT'
  | 'FEDERAL_GOVERNMENT'

contentGoal:
  | 'THOUGHT_LEADERSHIP'
  | 'EDUCATIONAL'
  | 'JOB_MARKETING'
  | 'CAPABILITY_BD'

platform:
  | 'ARTICLE'
  | 'LINKEDIN'
  | 'FACEBOOK'
  | 'INSTAGRAM'
  | 'X'
```

All fields should default to `AUTO` in the product and be inferred from the request.

The user may override them in Advanced Options, but generation must not be blocked.

---

# 3. Audience Intelligence

## A. Employer / Client

### What they care about

- Does the staffing partner understand the requirement?
- Will submissions be relevant?
- Can the partner support niche and business-critical roles?
- Will the partner communicate clearly?
- Can they reduce rework and delays?
- Will they provide visibility and follow-through?

### Writing behavior

- Focus on business impact
- Explain the mechanism behind better hiring
- Use operational language
- Show how clarity, screening, communication, and transparency improve execution
- Avoid recruiter-centric jargon unless explained
- CTA should invite a discussion, intake review, pilot, or requirement calibration

---

## B. MSP / VMS / Staffing Partner

### What they care about

- Submission quality
- SLA responsiveness
- Candidate ownership
- VMS discipline
- Status visibility
- Requisition aging
- Escalation
- Documentation
- Partner reliability
- Consistent follow-through

### Writing behavior

- Use process and delivery language
- Emphasize alignment, completeness, responsiveness, and accountability
- Avoid vague “partnership” language without explaining how the partnership operates
- CTA should invite program alignment, vendor onboarding, pilot requisitions, or delivery collaboration

---

## C. Candidate / Professional

### What they care about

- Is the role represented accurately?
- Are compensation, location, schedule, and work arrangement clear?
- Is the recruiter responsive?
- What happens next?
- Is the role relevant to their career?
- Will they receive respectful communication and closure?

### Writing behavior

- Be direct, warm, and transparent
- Lead with candidate relevance
- Avoid false urgency and exaggerated opportunity language
- Clearly state known requirements
- Never invent missing job facts
- CTA should be simple and action-oriented

---

## D. Recruiter / Staffing Operator

### What they care about

- Better intake
- Better sourcing
- Better screening
- Better submissions
- Responsible use of AI
- Communication discipline
- Documentation
- Conversion improvement
- Faster execution without lowering quality

### Writing behavior

- Teach practical staffing mechanics
- Use examples from real recruitment workflows
- Explain what AI can support and what still requires human judgment
- CTA should encourage adoption of a checklist, workflow, or better operating practice

---

# 4. Staffing Domain Intelligence

## A. General Staffing

Use for topics that apply across industries:

- Requirement clarity
- Candidate experience
- Submission quality
- Recruiter communication
- Client communication
- Interview coordination
- Offer and onboarding follow-through
- AI-enhanced, human-led recruitment
- Transparency
- Staffing operations

Do not make general staffing content vague. Use real staffing mechanics.

---

## B. IT Staffing

The agent should understand:

- Titles alone do not prove technical fit
- Keyword presence does not prove depth
- Recency matters
- Project context matters
- Scale, ownership, environment, stack, and outcomes matter
- Must-haves must be separated from preferences
- Skill adjacency can matter for niche hiring
- Candidate motivation, work authorization, location, compensation, and availability still matter

Relevant topic areas:

- Software engineering
- AI and machine learning
- Data
- Cloud
- Cybersecurity
- DevOps
- Infrastructure
- QA and quality engineering
- Product
- Program management
- Architecture
- Enterprise applications
- Contract and project staffing
- Niche and critical technical roles

When discussing KlerHire, position it as helping with:

- JD simplification
- Resume matching
- Gap identification

Do not imply that a match score replaces technical evaluation or human judgment.

---

## C. Healthcare Staffing

The agent should understand:

- Specialty experience matters
- Care setting matters
- Shift and schedule matter
- Location and travel expectations matter
- Licenses and certifications matter
- Credential awareness is not the same as guaranteeing completed credentialing
- Submission readiness affects onboarding
- Candidate communication must be accurate and respectful
- MSP/VMS healthcare workflows require disciplined documentation

Relevant role areas:

- Nursing
- Allied health
- Clinical support
- Non-clinical healthcare support
- Imaging
- Diagnostics
- Laboratory
- Rehabilitation
- Administrative healthcare support

Healthcare candidate guidance should use the existing healthcare-safe controls.

Do not provide medical, legal, clinical, or licensing advice beyond approved general guidance.

---

# 5. Market Context Intelligence

## A. Commercial

### Writing emphasis

- Business outcomes
- Speed with quality
- Competitive hiring
- Candidate experience
- Project delivery
- Workforce flexibility
- Partnership and responsiveness

### Avoid

- Unsupported ROI claims
- Unsupported “faster” or “better” claims
- Named-client references without proof
- Generic sales language

---

## B. State Government

### Writing emphasis

- Public accountability
- Process discipline
- Documentation
- Vendor responsiveness
- Submission completeness
- Compliance with the specific program
- Workforce continuity
- Clear escalation
- State-specific requirements only when verified

### Avoid

- Assuming one state’s rules apply to another
- Claiming contract access without proof
- Claiming certifications, HUB/MBE status, or state approvals without evidence
- Political advocacy
- Overly promotional language

### Tone

- Factual
- Clear
- Responsible
- Operational
- Public-service aware

---

## C. Federal Government

### Writing emphasis

- Mission support
- Documentation
- Auditability
- Security awareness
- Contract and program discipline
- Workforce continuity
- Public accountability
- Clear ownership
- Evidence-backed capability statements

### Avoid

- Claiming federal contract vehicles without proof
- Claiming FISMA, FedRAMP, security clearance, or federal compliance without approved evidence
- Implying agency endorsement
- Political language
- Unsupported national-scale capability claims

### Tone

- Precise
- Evidence-led
- Formal but readable
- Low-hype
- Mission-aware

---

# 6. Content Goal Intelligence

## Thought Leadership

The content must:

- Present a clear point of view
- Explain a real mechanism
- Challenge a weak industry assumption
- Help the audience make a better decision
- Avoid becoming a disguised sales pitch

Good pattern:

```text
Problem
→ Why the usual approach fails
→ What actually changes the outcome
→ Practical implications
→ Credible CTA
```

---

## Educational

The content must:

- Teach something useful
- Use staffing-specific examples
- Be clear and practical
- Explain limits and uncertainty
- Distinguish general guidance from Hire’in performance claims

Good pattern:

```text
Question
→ Explanation
→ Example
→ Checklist or takeaway
```

---

## Job Marketing

The content must:

- Use only supplied job facts
- Lead with candidate relevance
- Clearly state must-haves
- Be transparent about location, work arrangement, schedule, and employment type when known
- Use a clear application CTA
- Avoid fake urgency and generic excitement

Never invent:

- Compensation
- Benefits
- Shift
- Schedule
- Sponsorship
- Client name
- Number of openings
- Deadline
- Requirements

---

## Capability / Business Development

The content must:

- Explain what Hire’in does
- Explain how Hire’in works
- Show why the approach matters
- Use proof for material claims
- Represent both IT and healthcare when the content is company-wide
- Avoid unsupported superlatives

Good pattern:

```text
Client challenge
→ Hire’in operating approach
→ AI + human contribution
→ Communication and transparency
→ Proof or [NEEDS_PROOF]
→ Next step
```

---

# 7. Platform Awareness

## Article

- One strong central argument
- Clear structure
- Staffing depth
- Useful examples
- Evidence-aware claims
- Practical conclusion
- No filler introduction

---

## LinkedIn

- Strong first two lines
- Professional but human
- One clear takeaway
- Easy to scan
- Avoid corporate brochure tone
- CTA should invite perspective, discussion, or action

---

## Facebook

For candidate or community groups:

- Warm and direct
- Easy to understand
- Clear eligibility
- Clear location and work arrangement
- Clear action
- Avoid jargon and over-formatting

For business pages:

- Slightly more explanatory
- Community-aware
- Less formal than LinkedIn

---

## Instagram

- Strong short hook
- Simple message
- Visual-first thinking
- Short sections
- Useful carousel/reel framing
- Caption should support the visual, not repeat it
- Include alt text for visual assets

---

## X

- One sharp idea
- High information density
- Minimal setup
- Avoid generic hashtags
- Use a thread only when the idea genuinely needs steps

---

# 8. Hire’in Positioning

Use this approved direction:

```text
Hire’in is an AI-enhanced, human-led IT and healthcare staffing organization focused on niche and business-critical hiring.

Its approach combines requirement clarity, relevant candidate alignment, recruiter judgment, clear communication, and transparency across the recruitment lifecycle.
```

The agent may express this naturally, but must preserve the meaning.

Do not describe Hire’in as healthcare-only in generic company content.

Do not describe AI as replacing recruiters.

---

# 9. Claim-Free-by-Default Rule

The Agent must not create Hire’in-specific factual or performance claims on its own.

Default mode:

```text
CLAIM_FREE
```

## 9.1 What the Agent must not invent

Without explicit user-provided facts, do not create claims about:

- Clients or partners
- Placement counts
- Submission, interview, offer, or start results
- Speed, quality, conversion, ROI, or savings
- Years of experience
- Geographic reach
- Certifications or compliance
- State or federal contract access
- MSP/VMS approvals
- KlerHire features or performance
- Candidate-database size
- Testimonials
- Awards
- Market leadership
- Guaranteed outcomes

Do not insert `[NEEDS_PROOF]` markers into normal content.

When a company-specific claim is not supplied by the user:

- Omit it
- Write the content around the process, principle, or audience problem
- Keep the output useful without promotional assertions

## 9.2 User-provided claims

When the user explicitly supplies a claim or fact, the Agent may use it.

Rules:

- Treat it as `user_provided`
- Preserve the user’s qualifiers
- Do not strengthen it
- Do not add numbers, clients, outcomes, locations, certifications, or scope
- Do not convert “may,” “can,” or “supports” into “does,” “guarantees,” or “delivers”
- Do not repeat it excessively
- Light grammar and clarity edits are allowed
- Store in metadata that the claim came from the user

Recommended metadata:

```ts
claimSource: 'none' | 'user_provided'
```

## 9.3 Generic educational statements

General staffing education and thought leadership are allowed without user-supplied company proof.

Examples:

Allowed:

```text
Clearer requirements can reduce avoidable sourcing rework.
Keyword presence does not always demonstrate technical depth.
Healthcare job posts should state shift and credential requirements clearly.
```

Not allowed unless user supplied:

```text
Hire’in reduces sourcing rework by 40%.
Hire’in has placed more than 500 nurses.
KlerHire improves matching accuracy.
Hire’in is an approved federal staffing vendor.
```

## 9.4 Job content

For job marketing, use only facts explicitly supplied by the user or present in the current approved job record.

Never invent:

- Compensation
- Benefits
- Location
- Shift or schedule
- Work arrangement
- Sponsorship
- Client or facility
- Number of openings
- Start date
- Urgency
- Required experience
- License or certification

Missing facts should be omitted rather than guessed.

## 9.5 UI behavior

Keep one optional field:

```text
Facts or claims to include
```

Helper text:

```text
Only include facts you are authorized to publish. The Agent will not add company claims on its own.
```

No proof-card workflow is required for this release.

---

# 10. Anti-Slop Rules

Use the complete banned list from `HIREIN_CONTENT_CRAFT.md` §4 as both:

- A hard prompt block
- The source for deterministic exact-phrase validation

The short examples below are explanatory only. They do not replace §4.

Do not activate the upgraded prompt versions unless the full §4 list has been loaded verbatim.

At minimum, the agent should avoid:

- Generic trend openings
- “In today’s fast-paced world”
- “The war for talent”
- “Game changer”
- “Revolutionize”
- “Unlock”
- “Leverage” used as empty corporate filler
- “Top talent” without specificity
- “Best-in-class”
- “Seamless”
- “End-to-end” when it is not explained
- Repetitive “not just X, but Y” phrasing
- Empty claims about innovation
- Overuse of em dashes and rhetorical questions
- Generic conclusions that simply restate the introduction

Before output, run this self-check:

```text
Is the opening specific?
Is the audience obvious?
Is the content useful?
Does it sound like a staffing expert?
Is any claim unsupported?
Is any fact invented?
Does the platform version feel native?
Can any sentence be removed without losing value?
```

---

# 11. Hook, Archetype, and Exemplar Intelligence

Use the complete creative library from `HIREIN_CONTENT_CRAFT.md`.

## Required archetype libraries

- Hook archetypes: §1, all 8
- Content archetypes: §2, all 12

These are required dependencies, not optional enhancements.

For social content, generate:

- Three distinct hook options
- The hook archetype used for each option
- One recommended hook
- A short recommendation rationale
- One selected content archetype

When the Agent selects automatically, it must not use the same content archetype twice in a row on the same platform.

When the user manually selects the same archetype used on the previous comparable post:

- Keep the user’s selection available
- Show a visible “Recently used on this platform” advisory
- Suggest two alternative archetypes
- Allow the user to proceed deliberately
- Store that the repeat was user-confirmed

The user does not need to choose an archetype unless Advanced Options are opened.

## Required exemplars

Gold-standard exemplars from Content Craft §6 are mandatory quality anchors.

The system must be able to select an approved exemplar for:

1. Thought Leadership
2. Educational / Explainer
3. Job Marketing
4. Capability / Business Development


For Job Marketing, the Agent must adapt the fit-filter mechanism by domain:

- **IT:** ownership, production environment, scale, stack, recency, and depth
- **Healthcare:** specialty experience, care setting, shift/schedule fit, license/certification readiness, and location/availability

Do not reuse IT-specific “production ownership” language for healthcare candidate content.

## Exemplar loading rule

- Load one relevant exemplar by default.
- Load a second only when it teaches a materially different pattern needed for the request.
- Do not load every exemplar.
- Do not copy exemplar sentences.
- Do not output bracketed placeholder claims.
- Do not convert exemplar placeholders into facts.
- Exemplars teach structure, specificity, rhythm, and quality—not reusable claims.

## Exemplar preflight

Before activating new prompt versions:

1. Merge the approved Job Marketing and Capability / Business Development exemplars from `HIREIN_CONTENT_CRAFT_EXEMPLAR_ADDENDUM_v1.2.md` into Content Craft §6.
2. Verify that §6 contains an approved exemplar for every required content goal.
3. Verify that the exact addendum placeholders are protected by the existing placeholder non-leakage rule.

Expected coverage:

```text
Thought Leadership: FOUND
Educational / Explainer: FOUND
Job Marketing: FOUND
Capability / Business Development: FOUND
Healthcare Job Marketing adaptation: FOUND
```

Do not invent replacement exemplars during implementation.

---

# 12. Prompt Loading Rule

Do not inject the entire knowledge base into every request.

Load only:

```text
Shared Hire’in core
+ selected audience
+ selected staffing domain
+ selected market context
+ selected content goal
+ selected platform craft block from Content Craft §5
+ selected hook/content archetype guidance from §§1–2
+ one relevant gold-standard exemplar from §6
+ user-provided facts or claims, when present
+ user request
+ full banned-language block from §4
+ mandatory self-edit pass from §7
```

Keep high-priority constraints near the final generation instruction:

- No invented facts
- User-provided-claim non-amplification rule
- Full banned-language rules
- Exemplar non-copy and placeholder non-leakage rule
- Mandatory self-edit
- Output requirements

Keep long reference context earlier in the prompt. Do not bury the banned list or self-edit pass beneath domain vocabulary or exemplars.

---

# 13. Minimal Product Behavior

Main form:

1. Topic or instruction
2. Content type/platform
3. Optional source notes/proof

Advanced Options:

- Audience override
- Domain override
- Market context override
- Content goal override
- Tone
- Hook/content style
- Compliance mode

After generation, show a small summary:

```text
IT Staffing · Employer Audience · Commercial · Thought Leadership · LinkedIn
```

This makes the agent’s reasoning visible without making the interface complicated.

---

# 14. Replit Implementation Instructions

Do not create a new agent.

Extend the existing content agent and prompt assembly.

## Add lightweight resolved context

```ts
interface ContentIntelligenceContext {
  audience: string;
  domain: string;
  marketContext: string;
  contentGoal: string;
  platform: string;
}
```

## Required behavior

- Complete the Content Craft dependency preflight before activating new prompt versions
- Infer fields automatically
- Allow user override
- Persist resolved values in existing metadata
- Load only relevant prompt blocks
- Load one goal/platform-relevant exemplar from Content Craft §6
- Preserve existing prompt versions for rollback
- Run existing quality review for normal and compliance modes
- Add deterministic checks for:
  - Exact banned phrases from the full §4 list
  - Exemplar placeholders
  - Invented company claims
  - Duplicated cross-platform sentences
  - Missing hook/content archetype metadata
- Show a recent-use advisory when the user manually repeats the last comparable archetype

## Do not add

- Multiple agents
- New roles
- New approval systems
- New evidence database
- Seasonal planning
- Editorial calendar
- Vector search
- New publishing workflow
- Large schema changes

---

# 15. Acceptance Criteria

The upgrade is complete when the existing agent can:

1. Detect IT, healthcare, or general staffing
2. Detect employer, MSP/partner, candidate, or recruiter audience
3. Detect commercial, state, or federal context
4. Detect the content goal
5. Create platform-native content
6. Produce three social hooks
7. Avoid banned AI language
8. Avoid unsupported Hire’in claims
9. Mark missing proof
10. Avoid invented job facts
11. Represent Hire’in as both IT and healthcare
12. Explain AI as supporting human recruiting
13. Produce materially different content for employer versus MSP audiences
14. Use more factual, accountable language for government content
15. Preserve the existing review and publish workflow
16. Restore previous prompt versions
17. Verify all required Content Craft sections before prompt activation
18. Use all 8 authored hook archetypes and all 12 authored content archetypes
19. Load a relevant authored exemplar for each content goal
20. Include the approved Job Marketing and Capability / BD exemplars from the addendum
21. Never copy exemplar language or leak exemplar placeholders
22. Fail activation when the full banned list or a required exemplar category is unavailable
23. Prevent automatic consecutive archetype repetition on the same platform
24. Warn and suggest alternatives when a user manually repeats the previous archetype
25. Adapt Job Marketing fit filters by domain so IT ownership language is not reused for healthcare roles
26. Healthcare Job Marketing uses recency/duration language only when explicitly present in the approved job facts
27. The Agent omits Hire’in-specific claims when the user supplies none
28. User-provided claims are used without amplification
29. Normal output contains no `[NEEDS_PROOF]` markers

---

# 16. Copy/Paste Replit Prompt

```text
Do not build a new content agent.

Upgrade the existing Hire’in content agent using HIREIN_CONTENT_AGENT_INTELLIGENCE_PACK_v1.3.md.

MANDATORY CREATIVE DEPENDENCY:
Before implementing or activating new prompt versions:

1. Inspect HIREIN_CONTENT_CRAFT.md and confirm that §§1–7 are present.
2. Merge the approved Job Marketing and Capability / Business Development exemplars from HIREIN_CONTENT_CRAFT_EXEMPLAR_ADDENDUM_v1.2.md into Content Craft §6.
3. Verify all 8 hook archetypes, all 12 content archetypes, the full banned list, platform craft rules, all four required exemplar categories, and the self-edit pass.

Do not ship with missing, summarized, paraphrased, or invented creative content.

Add a lightweight decision layer that automatically resolves:
- Audience
- Staffing domain
- Commercial/state/federal market context
- Content goal
- Platform

Load only the relevant intelligence blocks. Keep the user interface simple and place overrides in Advanced Options.

Use claim-free-by-default behavior:
- Do not invent Hire’in claims
- Do not show `[NEEDS_PROOF]` markers
- Omit unsupported company claims
- Use claims only when the user explicitly supplies them
- Never strengthen or expand a user-provided claim


For each request, conditionally load:
- The relevant audience
- The relevant staffing domain
- The relevant market context
- The relevant content goal
- Only the requested platform’s craft guidance
- The authored archetype guidance
- One relevant gold-standard exemplar from Content Craft §6
- Relevant proof
- The full banned list and self-edit pass close to the final generation instruction

Reuse the existing prompt builder, prompt versions, structured output, retries, quality review, metadata, peer review, and publish gate.

Add audience-aware writing, IT and healthcare staffing expertise, commercial and government awareness, platform-native social writing, claim-free-by-default behavior, anti-slop controls, three hook options, authored exemplars, and lightweight content-structure rotation.

Automatic selection must not repeat the last comparable content archetype on the same platform. If a user manually repeats it, show a recent-use advisory and two alternatives, then allow an intentional override.

For Job Marketing, adapt the fit-filter mechanism by domain. IT content may use ownership/production-depth framing; healthcare content must shift to specialty, care setting, credential readiness, schedule, location, and availability.

Add deterministic validation for exact banned phrases, exemplar placeholder leakage, unsupported-claim markers, duplicate cross-platform sentences, and missing archetype metadata.

Do not add multiple agents, new roles, a new evidence database, seasonal planning, vector search, or a new approval workflow.

Preserve all previous prompt versions for rollback. Do not activate the new versions until the Content Craft dependency preflight and all acceptance criteria pass.

```

---

# Final Principle

The goal is not more prompt text.

The goal is better decisions before writing:

```text
Who is this for?
What staffing context applies?
Is this commercial, state, or federal?
What does the audience need to decide?
What proof exists?
How should this platform communicate the idea?
```

When those decisions are correct, the existing agent becomes substantially smarter without becoming bloated.


---

# v1.5 Closure Notes

This revision deliberately removes the Proof Library from the launch path.

The Agent now operates in claim-free-by-default mode:

1. It does not create Hire’in-specific claims.
2. It omits unsupported company assertions instead of showing `[NEEDS_PROOF]`.
3. It may use claims explicitly supplied by the user.
4. It never amplifies or expands user-provided claims.
5. General staffing education and thought leadership remain fully available.
6. No proof-card sessions or proof-library approval gate are required for launch.
