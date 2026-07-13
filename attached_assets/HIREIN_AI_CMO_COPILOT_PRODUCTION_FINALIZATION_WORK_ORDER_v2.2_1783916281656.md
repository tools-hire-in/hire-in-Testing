# Hire'in AI CMO Content Copilot

## Production Finalization and Trust Gap-Closure Work Order v2.2

**Status:** Final implementation authority for the remaining MVP work  
**Purpose:** Close the incomplete handoffs between brief resolution, generation, safety review and quality measurement  
**Implementation approach:** Continue the current Content Studio codebase. Do not create a new agent, redesign the platform or reopen completed taxonomy work.

## 1. Executive Decision

Address the remaining gaps inside the current implementation before production approval.

These are not optional enhancements or a later phase. They complete features already represented in the product:

- Brief-first strategy resolution.
- Three-hook selection.
- Staffing-specific safety review.
- Source-grounded semantic review.
- Visible publishing controls.
- Editing-effort measurement.

The existing intelligence architecture remains valid. The current gap is that several resolved fields and review results are stored or scaffolded but do not yet change the generated draft or the user's approval decision.

This v2.2 work order supersedes v2.1 where the two documents conflict. The canonical taxonomy and marketing-only product boundary remain unchanged.

## 2. Product Boundary

The product remains one AI CMO Content Copilot inside the existing Hire'in Content Studio.

It creates:

- Hire'in Insights articles.
- Thought leadership.
- Educational staffing content.
- LinkedIn, Instagram, Facebook and X content.
- Multi-platform social kits.
- Job marketing content.
- Founder, leadership, recruiter and team perspectives.
- Brand Perspective content.

It does not create:

- Formal capability statements.
- Client proposals.
- RFP or RFI responses.
- Capture plans.
- Government bids.
- Formal sales pitches.
- Autonomous campaigns.
- Automated social publishing.
- Advanced analytics dashboards.

Those functions belong to separate workflows or agents.

## 3. Preserve the Existing System

Do not create a new agent, new role model or new approval workflow.

Reuse the existing:

- Content Studio.
- Article brief pipeline.
- Prompt builder.
- Prompt versioning and rollback.
- Draft records and metadata.
- Structured model output.
- Retry and regeneration flow.
- Quality review.
- Peer review.
- Publish approval.
- Social-kit generation.
- Existing permissions.

Implement the smallest correct set of changes required to complete this work order.

## 4. Canonical Taxonomy

The following values are authoritative for all new UI options, API payloads, prompt payloads, rule evaluation and saved metadata.

### Audience

- `EMPLOYER_CLIENT`
- `CANDIDATE_PROFESSIONAL`
- `MSP_STAFFING_PARTNER`
- `RECRUITER_OPERATOR`

### Staffing domain

- `GENERAL_STAFFING`
- `IT_STAFFING`
- `HEALTHCARE_STAFFING`

### Market context

- `COMMERCIAL`
- `STATE_GOVERNMENT`
- `FEDERAL_GOVERNMENT`

### Content goal

- `THOUGHT_LEADERSHIP`
- `EDUCATIONAL`
- `JOB_MARKETING`
- `BRAND_PERSPECTIVE`

### Platform

- `ARTICLE`
- `LINKEDIN`
- `INSTAGRAM`
- `FACEBOOK`
- `X`
- `SOCIAL_KIT`

### Legacy read compatibility

The normalization layer may read and convert:

- `CANDIDATE` to `CANDIDATE_PROFESSIONAL`.
- `MSP_VMS_PARTNER` to `MSP_STAFFING_PARTNER`.
- `CAPABILITY_BD` to `BRAND_PERSPECTIVE` for legacy records only.
- Raw domain labels such as `healthcare`, `Healthcare Staffing`, `it`, `technology` or `general` to their canonical domain values.

Legacy values must never be written into new records or shown as selectable options.

## 5. Final User Flow

The final generation flow must be:

1. The user enters a topic or instruction.
2. The user selects a format or platform, or allows automatic selection.
3. The user may add source material, job facts, recruiter notes, a leadership point of view or other authorized details.
4. The copilot resolves a complete strategic brief through structured output.
5. The brief is displayed and can be edited.
6. The copilot returns three materially different hooks and recommends one.
7. The user confirms the brief and selects or accepts a hook.
8. The confirmed brief and selected creative direction are injected into the generation prompt.
9. The copilot generates the full content.
10. Deterministic staffing-safety checks run.
11. Source-grounded semantic review runs.
12. The editor displays `PASS`, `REVISE` or `BLOCK` with issue details.
13. Correctable failures use the existing retry path.
14. `BLOCK` prevents approval and publishing until resolved.
15. The confirmed brief, selected hook, structure, prompt version and review results are saved with the draft.
16. The existing peer-review and publish-approval flow continues unchanged.

The user should experience a simple workflow. The discipline should happen behind the scenes.

## 6. Brief-First UX and Input Discipline

### 6.1 Main input screen

Keep the initial screen simple:

- Topic or instruction.
- Requested content format or platform.
- Optional facts or source material.

Do not require the user to manually complete a long strategy form before the copilot can help.

### 6.2 Resolved brief

Before full generation, the copilot must create and show:

- Primary audience.
- Audience question or decision.
- Staffing domain.
- Market context.
- Content goal.
- Business objective.
- Single takeaway.
- Source type.
- Short source summary.
- Desired reader action or CTA.
- Platform.
- Three hook options.
- Recommended hook.
- Selected content structure.

### 6.3 Mandatory strategic inputs

Every request must resolve these three inputs:

- **Audience question:** the real question, fear, decision or tension the audience is facing.
- **Source basis:** the factual or point-of-view basis available to the copilot.
- **Reader action:** what should become easier after reading the content.

Weak input:

`Write a LinkedIn post about IT staffing.`

Acceptable resolved audience question:

`Why do technically qualified submissions still fail hiring-manager review?`

Acceptable reader action:

`Help the reader identify the intake detail that is creating avoidable screening noise.`

### 6.4 Source types

Use one of these source types:

- `USER_PROVIDED`
- `JOB_RECORD`
- `RECRUITER_DELIVERY_NOTE`
- `CANDIDATE_QUESTION`
- `LEADERSHIP_POV`
- `APPROVED_INTERNAL_MATERIAL`
- `GENERAL_EDUCATIONAL_CONTEXT`
- `NONE`

Behavior:

- When source facts are supplied, use only those facts and preserve their qualifiers.
- When the source is general educational context or none, keep the content claim-free and non-specific.
- Do not manufacture evidence to make a brief appear complete.
- Do not show proof placeholders in normal content.

### 6.5 Confirmation behavior

- Every brief field must be editable before full generation.
- The user can accept the recommended brief with one action.
- Quick Generate may accept the recommended brief automatically, but it must still create, save and display the resolved brief.
- Quick Generate must not bypass brief creation.
- The confirmed brief, not the initial model inference, is the source of truth for final generation.

### 6.6 Confidence handling

When confidence is low or two interpretations are materially different:

- Mark the field as `Needs confirmation`.
- Present the recommended value.
- Offer one or two practical alternatives.
- Do not ask an open-ended follow-up when a useful recommendation can be made.

## 7. Structured Brief Resolution and Recovery

### 7.1 Structured output

Continue using a strict structured-output schema for brief resolution. The schema should constrain:

- Canonical taxonomy values.
- Required strategic fields.
- Hook objects.
- Confidence and alternatives.
- Source-type classification.

The economy-tier model may be used for this step.

### 7.2 Required recovery path

A single malformed structured response must not end the workflow.

Implement this recovery sequence:

1. **Attempt 1:** full strict schema.
2. **Attempt 2:** simplified recovery schema with fewer optional fields and lower nesting complexity.
3. **Fallback:** create a deterministic editable brief from the user's input and available form values.

The fallback brief must:

- Use canonical values.
- Mark inferred fields clearly.
- Preserve all user-supplied facts.
- Remain editable.
- Allow the user to continue unless the model service is unavailable.

### 7.3 Three-hook recovery

The preferred result is exactly three valid hooks.

Do not fail the complete brief because the model returned two valid hooks or one malformed hook object.

Recovery behavior:

- Keep valid, materially distinct hooks.
- Run one focused retry to generate only the missing hook.
- Reject duplicated or near-duplicated hooks.
- Use a deterministic archetype fallback only when the focused retry fails.

## 8. Generation Context Handshake

The confirmed brief must be injected into the final generation prompt. Storing the fields in the database is not sufficient.

The generation prompt must receive:

- Confirmed primary audience.
- Confirmed audience question.
- Confirmed staffing domain.
- Confirmed market context.
- Confirmed content goal.
- Confirmed business objective.
- Confirmed single takeaway.
- Confirmed source type and source summary.
- Confirmed reader action or CTA.
- Selected platform.
- Selected hook text.
- Selected hook archetype.
- Selected content structure.
- User-provided facts.
- Claim-source status.

Add explicit generation constraints equivalent to:

`Write for the confirmed primary audience.`

`Answer this audience question: {audienceQuestion}`

`After reading, this should become easier for the reader: {readerAction}`

`Deliver this single takeaway: {singleTakeaway}`

`Use the selected hook archetype and content structure throughout the draft. Do not treat the selected hook as only an opening sentence.`

The audience question must shape the argument. The reader action must shape the conclusion and CTA.

## 9. Three-Hook Selection and Full-Draft Enforcement

Before full content generation, return three materially different hook options.

Each hook option must include:

- Hook text.
- Hook archetype.
- Short explanation of why it fits the audience and topic.
- Proposed content structure.

The system must recommend one hook and explain the recommendation in one or two sentences.

### 9.1 Material difference standard

The three hooks must not be small rewrites of the same sentence.

A valid set may include:

- Uncomfortable Truth.
- Mechanism Reveal.
- Decision Checklist.

### 9.2 Hook controls

The user must be able to:

- Accept the recommended hook.
- Select another hook.
- Regenerate only the hook options.
- Manually enter a hook.

Store:

- `selectedHookText`
- `selectedHookArchetype`
- `selectedContentStructure`

### 9.3 Downstream effect

The selected hook must control:

- Opening.
- Argument order.
- Section structure.
- Example selection.
- Pacing.
- Conclusion.
- CTA framing.

Changing from an Uncomfortable Truth hook to a Checklist hook must produce a materially different draft structure, not only a different first paragraph.

Regenerating after a hook change must reuse the confirmed brief and must not call the brief-resolution model again.

## 10. Shared Normalization Boundary

Create or reuse one shared canonical normalizer. Do not duplicate normalization logic across services.

Normalization must occur before:

- Prompt building.
- Exemplar lookup.
- Safety-gate rule selection.
- Semantic review.
- Metadata persistence.
- Analytics events.
- UI badge rendering.
- Retry and regeneration.

Do not evaluate safety rules against raw values such as `healthcare`, `it`, `candidate` or `MSP_VMS_PARTNER`.

The safety gate must receive normalized values even when `domainResolved` is null and the only available value came from a raw form field such as `industry`.

Required normalization tests:

- `healthcare` to `HEALTHCARE_STAFFING`.
- `Healthcare Staffing` to `HEALTHCARE_STAFFING`.
- `IT` to `IT_STAFFING`.
- `technology` to `IT_STAFFING`.
- `CANDIDATE` to `CANDIDATE_PROFESSIONAL`.
- `MSP_VMS_PARTNER` to `MSP_STAFFING_PARTNER`.
- `CAPABILITY_BD` to `BRAND_PERSPECTIVE` for legacy reads only.

New records must save only canonical values.

## 11. Safety and Trust Pipeline

The deterministic safety gate remains the first filter. It is not proof of factual accuracy.

Required pipeline:

1. Deterministic checks.
2. Source-grounded semantic review.
3. Classification as `PASS`, `REVISE` or `BLOCK`.
4. Visible editor badge and issue details.
5. Approval and publishing enforcement.

### 11.1 Source ledger

Create a normalized source ledger from:

- User-provided facts.
- Current job record fields.
- Recruiter or delivery notes.
- Leadership or SME input.
- Approved source material attached to the request.
- Confirmed brief fields.

For job marketing and company-specific content, factual details in the generated output must be traceable to this ledger.

### 11.2 Deterministic checks

Continue to identify and block:

- Placeholder leakage.
- Explicit unsupported compensation.
- Unsupported minimum years of experience.
- Unsupported healthcare recency language.
- Invented licenses or certifications.
- Invented client or facility names when detectable.
- Invented government approvals or contract vehicles when detectable.
- Banned hard-failure phrases.
- Duplicate full sentences across social-kit variants.
- Missing required strategy metadata.
- Confirmed audience or domain mismatch.

### 11.3 Source-grounded semantic review

The semantic reviewer must compare every material factual or promotional assertion against the source ledger.

Classify each material assertion as:

- `SUPPORTED`
- `UNSUPPORTED`
- `AMBIGUOUS`
- `GENERAL_GUIDANCE`

The reviewer must catch subtle unsupported statements that may bypass regex checks, including:

- `Competitive compensation aligned with market benchmarks.`
- `Clearance may be required depending on the client.`
- `Candidates move through onboarding faster.`
- `Our process improves submission quality.`
- `This role offers strong growth potential.`
- `Recent acute-care experience is preferred.`

General educational statements may be classified as `GENERAL_GUIDANCE` when they are framed as guidance rather than as a Hire'in, client, job or product fact.

### 11.4 Domain-specific hard failures

#### Job marketing

Block unsupplied:

- Compensation.
- Benefits.
- Location.
- Work arrangement.
- Shift.
- Schedule.
- Employment type.
- Sponsorship or work authorization.
- Client or facility name.
- Start date.
- Number of openings.
- Urgency.
- Required years of experience.
- License or certification.
- Application contact.

Missing information must be omitted, not guessed.

#### Healthcare

Block unsupplied:

- Recent-experience requirements.
- Minimum years of experience.
- Specialty.
- Care setting.
- Shift or call requirements.
- License.
- Certification.
- Credentialing requirements.
- Facility name.
- Clinical, licensing, legal or medical advice.

Do not infer recency from specialty, urgency, care setting or recruiter preference.

#### IT

Block unsupplied:

- Technology or product.
- Version.
- Architecture or environment.
- Project scale.
- Ownership level.
- Work authorization.
- Client name.
- Security clearance.
- Certification.
- Compensation or location detail.

#### Government

Block unsupplied:

- Agency relationship.
- Contract vehicle.
- Prime or subcontractor status.
- State or federal approval.
- Security clearance.
- Certification.
- Compliance status.
- Past performance.

#### Hire'in and product claims

Block unsupplied:

- Named clients or partners.
- Placement or submission counts.
- Conversion results.
- Time-to-fill results.
- Revenue, savings or ROI.
- Geographic coverage.
- Certifications or compliance claims.
- KlerHire features or performance claims.
- Superlative market position.
- Guaranteed results.

## 12. Visible Review UX and Publishing Enforcement

Display one review state in the article editor and review panel:

- `PASS`
- `REVISE`
- `BLOCK`

For every issue, show:

- Exact sentence or field.
- Severity.
- Rule or review category.
- Why it is unsupported, ambiguous or risky.
- Missing source or input.
- Recommended correction.
- Whether automatic correction is safe.
- `Remove sentence` action.
- `Return to brief` action.

Behavior:

- `PASS` may continue into the existing review workflow.
- `REVISE` allows editing or a controlled retry but must not appear fully approved.
- `BLOCK` prevents peer approval and publishing until all blocking issues are resolved.
- Do not silently remove a material user-provided requirement.
- Re-run deterministic and semantic review after material edits or regeneration.

## 13. Editorial Quality Review

After factual review, assess:

- Clear audience fit.
- A real audience question.
- Domain-specific depth.
- Useful insight or instruction.
- Strong opening.
- Logical structure.
- Human and credible voice.
- Platform-native writing.
- Relevant CTA.
- Respectful candidate and employee language.
- Absence of generic AI phrasing.
- Absence of empty promotional language.

Editorial review must remain separate from factual support classification. A factually safe draft may still receive `REVISE` for generic, weak or poorly structured writing.

## 14. Exemplar Quality Floor

Exemplars are editorial benchmarks, not templates to copy.

The active MVP library must contain at least these eight categories:

1. IT employer thought leadership.
2. Healthcare employer thought leadership.
3. Healthcare candidate education.
4. IT candidate education.
5. Recruiter or operator education.
6. Job Marketing with IT and healthcare adaptations.
7. Brand Perspective.
8. Independent multi-platform social-kit adaptation.

Use composite exemplar lookup based on:

- Content goal.
- Staffing domain.
- Audience.
- Platform when materially relevant.

Rules:

- Load one relevant exemplar by default.
- Load a second only when it adds materially different platform or domain guidance.
- Do not copy exemplar sentences.
- Do not expose placeholders.
- Do not treat exemplar facts as company facts.
- Fail preflight when a required exemplar category is missing.

## 15. Latency and Recovery Experience

Do not remove the brief-first flow to reduce latency.

Use these controls:

- Use the economy model for brief resolution.
- Load relevant intelligence and exemplar blocks while the user reviews the brief.
- Cache confirmed briefs for regeneration.
- Do not resolve the brief again when only the hook changes.
- Do not re-run hook generation when only the body is regenerated with the same creative direction.
- Show progress states:
  - `Resolving strategy`
  - `Preparing hook options`
  - `Generating draft`
  - `Running staffing safety review`

Default user preference:

`Review brief before generation: ON`

A later experienced-user option may accept the recommended brief in one action, but the resolved brief must still be created and stored.

## 16. Metadata and Visible Editing Effort

### 16.1 Required metadata

Save:

- Confirmed audience.
- Confirmed audience question.
- Confirmed domain.
- Confirmed market context.
- Confirmed content goal.
- Objective.
- Single takeaway.
- Source type and source summary.
- Reader action or CTA.
- Platform.
- Hook options.
- Selected hook text.
- Selected hook archetype.
- Selected content structure.
- Exemplar identifier.
- Prompt version.
- Regeneration count.
- Deterministic-review result.
- Semantic assertion-review result.
- Editorial-review result.
- Publish status.

### 16.2 Editing-effort calculation

Retain:

- First accepted generated version.
- Final approved or published version.

Calculate a directional word-level change percentage:

`changed words / maximum word count of original and final x 100`

Normalize before comparison:

- Whitespace.
- Markdown formatting.
- Punctuation-only changes.
- Case-only changes.

Display in the article header or review panel:

`Editing effort: 14% changed from first generation`

Use these bands:

- 0 to 10 percent: Minor cleanup.
- 11 to 20 percent: Light editing.
- 21 to 40 percent: Meaningful rewriting.
- Above 40 percent: Generation missed the brief.

Allow optional edit-reason tags:

- Wrong audience.
- Weak hook.
- Too generic.
- Incorrect tone.
- Unsupported claims.
- Missing staffing depth.
- Poor platform fit.
- CTA needed revision.
- Other.

This does not require an advanced analytics dashboard. Store the value and expose it on the article record and pilot summary.

## 17. Measurement Sources and Pilot Standard

Metric sources must remain clear:

- Native reach, impressions, reactions, saves, shares, comments and video views come from LinkedIn, Instagram, Facebook or X.
- Article visits, referral traffic and configured CTA clicks come from Studio or website analytics.
- Applications, candidate conversations and employer inquiries come from the ATS, recruiter records or shared inbox.
- Audience questions, production time, approval delays, reuse and edit reasons may be tracked manually during the pilot.

Do not report Studio activity as native social reach.

The copilot is credible for the MVP when:

- At least 80 percent of approved outputs require no more than 20 percent editing.
- No invented staffing, company or job facts reach approval.
- At least 80 percent of briefs are accepted or corrected with only minor changes.
- Users can understand and change the audience, goal and hook before generation.
- Multi-platform versions do not read like duplicated captions.
- The team voluntarily uses the copilot for recurring weekly content work.

## 18. Implementation Sequence

Complete the work in this order.

### Phase 1: Audit and preserve

- Confirm the current article-brief backend and frontend state.
- Identify completed work and open gaps.
- Confirm canonical taxonomy is active.
- Confirm prompt rollback works.
- Do not rewrite working components.

### Phase 2: Shared normalization

- Consolidate taxonomy normalization in one shared service.
- Apply it before prompt, exemplar, safety, semantic review, metadata and UI boundaries.
- Add legacy-read and raw-domain tests.

### Phase 3: Brief-resolution recovery

- Keep the strict structured-output approach.
- Add one simplified-schema retry.
- Add deterministic editable fallback.
- Add focused hook-count recovery.

### Phase 4: Generation handshake

- Inject the confirmed audience question, reader action, takeaway, source basis and full creative direction into generation.
- Confirm the draft body, conclusion and CTA use these values.

### Phase 5: Hook enforcement

- Bind the selected hook archetype and structure to the complete draft plan.
- Confirm hook changes produce materially different organization and reasoning.

### Phase 6: Safety and trust pipeline

- Preserve deterministic checks.
- Add source-led semantic assertion review.
- Add visible `PASS`, `REVISE` and `BLOCK` states.
- Prevent approval and publishing while `BLOCK` issues remain.

### Phase 7: Editing effort

- Calculate word-level change percentage.
- Display the metric.
- Capture optional edit reasons.
- Retain original and final versions.

### Phase 8: Regression and acceptance

- Run all existing canonical v2.0 and v2.1 tests.
- Run the v2.2 tests below.
- Complete the required demonstration.
- Provide a completion report.

## 19. Final Acceptance Tests

### 19.1 Brief and generation handshake

- A short topic creates a complete editable brief.
- The audience question is not a restated topic.
- The reader action is visible before generation.
- The confirmed audience question materially shapes the body.
- The confirmed reader action materially shapes the conclusion and CTA.
- Source type and source summary are included in generation constraints.
- Quick Generate creates and saves the brief.

### 19.2 Structured-output recovery

- A malformed first response triggers one simplified-schema retry.
- A malformed second response creates an editable deterministic fallback brief.
- Two valid hooks plus one invalid hook trigger focused recovery rather than complete failure.
- Duplicate hooks are rejected.
- The user reaches an editable brief unless the model service is unavailable.

### 19.3 Normalization

- Raw `healthcare` triggers `HEALTHCARE_STAFFING` safety rules.
- `Healthcare Staffing` normalizes correctly.
- Raw `IT` and `technology` normalize to `IT_STAFFING`.
- Legacy audience slugs normalize before prompt and safety evaluation.
- New records save only canonical values.

### 19.4 Hook behavior

- Every eligible request returns three materially different hooks.
- Each hook has an archetype, rationale and structure.
- Selecting an Uncomfortable Truth hook produces a tension-led argument.
- Selecting a Checklist hook produces a step-led structure.
- The two drafts are materially different beyond their opening paragraphs.
- Changing the hook does not re-resolve the brief.

### 19.5 Deterministic and semantic safety

- Explicit unsupplied compensation causes a hard failure.
- Subtle compensation language such as `competitive compensation` is identified when unsupported.
- Unsupplied healthcare recency language is blocked even when domain entered the pipeline as raw `healthcare`.
- `Clearance may be required depending on client` is identified when unsupported.
- Unsupported process-outcome language is identified.
- Material assertions are classified as supported, unsupported, ambiguous or general guidance.
- Exact sentences and missing source inputs are shown.

### 19.6 Editor state and publishing controls

- The editor shows `PASS`, `REVISE` or `BLOCK`.
- `REVISE` shows actionable issue details.
- `BLOCK` prevents approval and publishing.
- Remove-sentence and return-to-brief actions work.
- Review runs again after material edits.

### 19.7 Editing effort

- The first accepted generation is retained.
- The final approved version is retained.
- Word-level change percentage is calculated.
- Punctuation-only, case-only and formatting-only edits do not inflate the result materially.
- The metric is visible on the article record.
- Edit reasons can be recorded.

### 19.8 Regression

- Existing drafts open without data loss.
- Existing generation routes still work.
- Peer review and publish approval remain intact.
- Previous prompt versions remain available for rollback.
- No new user roles or unnecessary workflows are introduced.

## 20. Required Demonstration

Before marking the work complete, demonstrate:

1. Enter a short IT-employer topic.
2. Show the automatically resolved brief.
3. Edit the audience question and reader action.
4. Show three materially different hooks.
5. Select a non-recommended hook.
6. Generate the draft and show how the confirmed question and reader action shape the body and CTA.
7. Regenerate with a different hook and show a materially different structure.
8. Enter a raw healthcare domain value and demonstrate normalized healthcare safety rules.
9. Attempt to add unsupported `recent experience` language and show `BLOCK`.
10. Attempt to add `competitive compensation` without source support and show the issue.
11. Attempt to add an unsupported client, facility or clearance statement and show the semantic review result.
12. Correct or remove the issue and show the review state change.
13. Generate a Brand Perspective post without converting it into capability or BD content.
14. Generate a four-platform social kit with independent adaptations.
15. Trigger a malformed structured brief response and demonstrate recovery or deterministic fallback.
16. Save, reopen and edit the brief and draft.
17. Show stored hook, structure, prompt version and review metadata.
18. Show the editing-effort percentage between the first accepted and final approved versions.
19. Open a legacy draft and demonstrate canonical normalization.
20. Reactivate the previous prompt version and confirm rollback.

## 21. Definition of Done

The MVP finalization is complete only when:

- The brief is visible and editable before full generation.
- Audience question, source basis and reader action are resolved for every request.
- Confirmed brief fields are injected into generation and visibly affect the draft.
- Three materially different hooks are returned and selectable.
- The selected hook controls the complete content structure.
- One shared normalizer protects all downstream boundaries.
- Deterministic and semantic safety reviews both run.
- `PASS`, `REVISE` and `BLOCK` are visible and actionable.
- `BLOCK` prevents approval and publishing.
- Malformed structured output recovers without losing the user's work.
- Editing effort is calculated and visible.
- Eight exemplar categories pass preflight.
- Canonical taxonomy is used for all new data.
- Existing review, publishing and rollback workflows remain intact.
- All acceptance tests pass.
- The required demonstration is completed.
- A final completion report is delivered.

## 22. Final Replit Execution Instruction

Use this instruction with this document:

`Continue the existing Hire'in Content Studio implementation. Do not create a new agent, redesign the application or reopen completed taxonomy work. Treat this v2.2 Production Finalization and Trust Gap-Closure Work Order as the execution authority for the remaining MVP work. First audit the current brief, hook, generation, safety and editing-effort implementation and identify what is already complete. Then close only the remaining handoff gaps: shared canonical normalization, resilient structured brief recovery, confirmed-brief injection into generation, full-draft hook enforcement, source-grounded semantic review, visible PASS/REVISE/BLOCK controls, publishing enforcement and visible word-level editing effort. Preserve existing drafts, prompt rollback, peer review, publish approval, roles and routes. Run the canonical v2.0 and v2.1 tests plus the v2.2 tests in this document. Do not mark the task complete until the required end-to-end demonstration and completion report are provided.`

## 23. Required Completion Report

Replit must return:

- Current-state audit, preserved features and gaps closed.
- Files, database or schema, API and UI changes.
- Prompt versions created or updated, with rollback instructions.
- Normalization rules and test results.
- Deterministic and semantic safety-review results.
- Review-state and publishing-enforcement results.
- Structured-output recovery results.
- Editing-effort calculation results.
- Exemplar preflight results.
- Acceptance-test and required-demonstration results.
- Known limitations and remaining blockers, if any.
- Final completion status only after the end-to-end flow is demonstrated and all acceptance tests pass.
