# Hire'in AI CMO Content Copilot

## Finalization and Gap-Closure Work Order v2.1

**Status:** Final implementation instruction for the current MVP  
**Purpose:** Complete the existing Content Studio copilot and close the remaining credibility gaps  
**Implementation approach:** Continue the current codebase; do not create a new agent or redesign the platform

## 1. Final Decision

Proceed with the implementation already in progress.

The intelligence architecture, canonical taxonomy, domain guidance, claim-free behavior and platform rules are already strong enough for the MVP. The remaining work is not another strategy or architecture exercise. It is a focused product-finalization sprint.

This work order closes five gaps:

- Enforce a visible and editable brief before full generation.
- Require the copilot to resolve the audience question, source basis and reader action.
- Return three materially different hooks before content generation.
- Add staffing-specific hard-failure checks before review or publishing.
- Measure whether the team can publish with no more than light editing.

This document supersedes earlier instructions only where they conflict with the requirements below.

## 2. Product Boundary

The product remains one AI CMO Content Copilot inside the existing Hire'in Content Studio.

It creates:

- Hire'in Insights articles.
- Thought-leadership content.
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

The following values are authoritative for all new UI options, API payloads, prompt payloads and saved metadata.

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
- `CAPABILITY_BD` to `BRAND_PERSPECTIVE`.

Legacy values must never be written into new records or shown as selectable options.

## 5. Final User Flow

The final generation flow must be:

1. The user enters a topic or instruction.
2. The user selects a format or platform, or allows automatic selection.
3. The user may add source material, job facts, recruiter notes, a leadership point of view or other authorized details.
4. The copilot resolves a complete strategic brief.
5. The brief is displayed and can be edited.
6. The copilot returns three hook options and recommends one.
7. The user confirms the brief and selects or accepts a hook.
8. The copilot generates the full content.
9. Deterministic staffing-safety checks run.
10. Semantic editorial review runs.
11. Eligible failures are corrected through the existing retry path.
12. The confirmed brief, selected hook, structure and review results are saved with the draft.
13. The existing peer-review and publish-approval flow continues unchanged.

The user should experience a simple workflow. The discipline should happen behind the scenes.

## 6. Brief-First UX

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

### 6.3 Confirmation behavior

- Every field must be editable before full generation.
- The user can accept the recommended brief with one action.
- Quick Generate may accept the recommended brief automatically, but it must still create, save and display the resolved brief.
- Quick Generate must not bypass brief creation.
- The confirmed brief, not the initial model inference, must be used to build the final generation prompt.

### 6.4 Confidence handling

The copilot may infer missing fields.

When confidence is low or two interpretations are materially different:

- Mark the field as `Needs confirmation`.
- Present the recommended value.
- Offer one or two practical alternatives.
- Do not ask an open-ended follow-up when a useful recommendation can be made.

## 7. Input Discipline

Every request must resolve three strategic inputs.

### 7.1 Audience question

The brief must state the real question, decision or tension the audience is facing.

Weak input:

`Write a LinkedIn post about IT staffing.`

Acceptable resolved question:

`Why do technically qualified submissions still fail hiring-manager review?`

The audience question cannot remain a restatement of the topic.

### 7.2 Source or factual basis

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

### 7.3 Desired reader action

The brief must identify what should become easier after the audience reads the content.

Examples:

- Reconsider how a technical requirement is calibrated.
- Review a current job opportunity.
- Prepare specified documents before recruiter follow-up.
- Save a checklist for the next intake meeting.
- Start a useful conversation with the recruiting team.

Avoid generic CTAs such as `Learn more` unless they are appropriate and connected to a real destination.

## 8. Three-Hook Selection

Before full content generation, return three materially different hook options.

Each hook option must include:

- Hook text.
- Hook archetype.
- Short explanation of why it fits the audience and topic.
- Proposed content structure.

The system must recommend one hook and explain the recommendation in one or two sentences.

### 8.1 Material difference standard

The three hooks must not be small rewrites of the same sentence.

A valid set may include:

- Uncomfortable Truth.
- Mechanism Reveal.
- Decision Checklist.

Changing the selected hook must change the framing and structure of the content, not only the first sentence.

### 8.2 Hook controls

The user must be able to:

- Accept the recommended hook.
- Select another hook.
- Regenerate only the hook options.
- Manually enter a hook.

Store the selected hook text, archetype and structure in draft metadata.

## 9. Generation Pipeline and Handshakes

Use the following sequence in the existing architecture.

### Step 1: Normalize

- Normalize legacy taxonomy values.
- Normalize platform names.
- Separate user-supplied facts from general instructions.

### Step 2: Resolve the strategic brief

- Classify audience, domain, market context and content goal.
- Resolve the audience question, takeaway, source type and CTA.
- Return confidence and alternatives where useful.

### Step 3: Confirm the brief

- Save the resolved brief as a draft brief.
- Allow edits.
- Mark the confirmed version as the source of truth.

### Step 4: Resolve creative direction

- Generate three hooks.
- Recommend one.
- Resolve the content structure.
- Apply recent-structure rotation rules.

### Step 5: Build the generation prompt

Load only:

- Shared Hire'in marketing rules.
- Confirmed audience guidance.
- Confirmed domain guidance.
- Confirmed market-context guidance.
- Confirmed content-goal guidance.
- Platform rules.
- One relevant exemplar.
- User-provided source facts.
- Claim-free rules.
- Banned-language rules.
- Staffing hard-failure rules.
- Output schema.
- Mandatory self-edit instruction.

### Step 6: Generate

Generate the content against the confirmed brief and selected hook.

### Step 7: Deterministic safety review

Run exact and source-led checks before semantic review.

### Step 8: Semantic editorial review

Review audience fit, domain depth, usefulness, platform fit, generic AI language, coherence and CTA relevance.

### Step 9: Correct or block

- Use the existing retry flow for correctable failures.
- Block review or publishing when a hard failure remains.
- Show the exact failed sentence and reason.

### Step 10: Save and continue

Save the confirmed brief, hook, structure, prompt version and review results with the draft. Continue into the existing review and publishing flow.

## 10. Staffing-Specific Safety Gate

The safety gate must have real enforcement. Hard failures must block approval or publishing until corrected.

### 10.1 Source ledger

Create a normalized fact ledger from:

- User-provided facts.
- Current job record fields.
- Approved source material attached to the request.
- Explicit leadership or SME input.

For job marketing and company-specific content, factual details in the generated output must be traceable to this ledger.

### 10.2 Job-marketing hard failures

Block output that introduces any unsupplied:

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

### 10.3 Healthcare hard failures

Block output that introduces any unsupplied:

- `Recent experience` requirement.
- Minimum years of experience.
- Specialty.
- Care setting.
- Shift or call requirement.
- License.
- Certification.
- Credentialing requirement.
- Facility name.
- Clinical, licensing, legal or medical advice.

Do not infer recency from specialty, urgency, care setting or recruiter preference.

### 10.4 IT hard failures

Block output that introduces any unsupplied:

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

### 10.5 Government hard failures

Block output that introduces any unsupplied:

- Agency relationship.
- Contract vehicle.
- Prime or subcontractor status.
- State approval.
- Federal approval.
- Security clearance.
- Certification.
- Compliance status.
- Past performance.

### 10.6 Hire'in and product-claim hard failures

Block output that introduces any unsupplied:

- Named client or partner.
- Placement or submission count.
- Conversion result.
- Time-to-fill result.
- Revenue, savings or ROI.
- Geographic coverage.
- Certification or compliance claim.
- KlerHire feature or performance claim.
- Superlative market position.
- Guaranteed result.

### 10.7 Other blocking failures

Block output that:

- Leaks bracketed exemplar placeholders.
- Repeats prohibited full sentences across social-kit variants.
- Contains a banned phrase that the deterministic linter classifies as a hard failure.
- Omits required strategy metadata.
- Uses the wrong audience or domain after brief confirmation.

### 10.8 Failure response

A hard failure should return:

- Failure code.
- Exact sentence or field.
- Reason.
- Missing or conflicting source input.
- Recommended correction.
- Whether automatic correction is safe.

Do not silently remove a material user-supplied requirement.

## 11. Editorial Quality Review

After deterministic checks, run semantic review for:

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

The semantic reviewer should score or classify:

- `PASS`
- `REVISE`
- `BLOCK`

A revise result may use the existing retry path. A block result requires correction or user input.

## 12. Exemplar Quality Floor

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

The existing canonical exemplar pack already covers six categories. Add the two benchmark exemplars below before final activation.

### 12.1 Healthcare employer thought-leadership benchmark

Audience: `EMPLOYER_CLIENT`  
Domain: `HEALTHCARE_STAFFING`  
Goal: `THOUGHT_LEADERSHIP`  
Platform: `LINKEDIN`  
Hook archetype: Readiness Gap  
Structure: Assumption, mechanism, operational implication, decision

Benchmark:

A credential-complete healthcare candidate can still be submission-unready.

Licenses and certifications answer only part of the question. Before a candidate reaches the hiring team, the process may still need to confirm specialty alignment, care-setting experience, shift and location fit, availability, compensation expectations when applicable, and the candidate's understanding of the role.

When those details remain unclear, the problem moves downstream. Interviews are scheduled for candidates who cannot accept the conditions, submissions require repeated clarification, and onboarding risks appear later than they should.

Submission readiness is not an administrative finish line. It is the point where the available evidence is clear enough for the next person to make a useful decision.

Before requesting more candidates, identify which unanswered detail is creating the most avoidable rework.

Quality standard:

- Explains a healthcare staffing mechanism.
- Does not claim a Hire'in result.
- Avoids clinical advice.
- Gives a hiring leader a practical decision.

### 12.2 IT candidate educational benchmark

Audience: `CANDIDATE_PROFESSIONAL`  
Domain: `IT_STAFFING`  
Goal: `EDUCATIONAL`  
Platform: `LINKEDIN`  
Hook archetype: Evidence Correction  
Structure: Weak signal, stronger evidence, application

Benchmark:

Listing a technology shows exposure. It does not show what you contributed.

For each important project, help the reader understand:

- The problem or environment.
- What you personally owned.
- The decision, implementation or improvement you made.
- The scale, constraint or risk that shaped the work.
- The result, when you can support it accurately.

Compare these two statements:

`Worked with cloud infrastructure.`

`Owned deployment automation for a production service and reduced manual release steps by documenting and standardizing the workflow.`

The second statement is stronger because it explains ownership and context. Use numbers only when you can support them, and do not exaggerate team results as individual impact.

Before submitting your resume, review the top requirements and ask whether each one is supported by evidence, not only a keyword.

Quality standard:

- Helps candidates demonstrate fit honestly.
- Does not invent metrics.
- Teaches an immediately usable method.
- Avoids promising interview or hiring outcomes.

### 12.3 Exemplar use rules

- Load one relevant exemplar per generation by default.
- Load a second only when it adds materially different platform or domain guidance.
- Do not copy exemplar sentences.
- Do not expose placeholders.
- Do not treat exemplar facts as company facts.
- Fail preflight when the required category is missing.

## 13. Content-Structure Rotation

Use the existing content-structure rotation logic.

- Avoid using the same structure consecutively on the same platform when another suitable structure exists.
- When the user manually selects a recently used structure, show a `Recently used` advisory and two alternatives.
- Allow deliberate override.
- Save the selected structure and override status in metadata.

This is a creative-diversity control, not an automated editorial calendar.

## 14. Metadata and Lightweight Learning

Do not build an advanced analytics dashboard.

Save enough information to evaluate whether the copilot is becoming useful.

### 14.1 Required metadata

- Confirmed audience.
- Confirmed audience question.
- Confirmed domain.
- Confirmed market context.
- Confirmed content goal.
- Objective.
- Source type.
- CTA.
- Platform.
- Hook options.
- Selected hook text.
- Selected hook archetype.
- Selected content structure.
- Exemplar identifier.
- Prompt version.
- Regeneration count.
- Safety-review result.
- Editorial-review result.
- Publish status.

### 14.2 Editing-effort measurement

Retain:

- First accepted generated version.
- Final approved or published version.
- A normalized text-difference percentage as a directional editing-effort indicator.
- Optional edit-reason tags.

Suggested edit-reason tags:

- Wrong audience.
- Wrong domain or context.
- Weak hook.
- Generic writing.
- Factual correction.
- Tone.
- Structure.
- CTA.
- Platform fit.
- Other.

The text-difference percentage is a product-quality proxy, not a formal performance metric.

### 14.3 Measurement-source clarity

- Native reach, impressions, reactions, saves, shares, comments and video views come from LinkedIn, Instagram, Facebook or X.
- Article visits, referral traffic and configured CTA clicks come from Studio or website analytics.
- Applications, candidate conversations and employer inquiries come from the ATS, recruiter records or shared inbox.
- Audience questions, production time, approval delays and reuse can be tracked manually during the pilot.

Do not report Studio activity as native social reach.

## 15. MVP Success Standard

Run a controlled pilot after implementation.

The copilot is credible for the MVP when:

- At least 80 percent of approved outputs require no more than 20 percent editing.
- No invented staffing, company or job facts reach approval.
- At least 80 percent of briefs are accepted or corrected with only minor changes.
- Users can understand and change the audience, goal and hook before generation.
- Multi-platform versions do not read like duplicated captions.
- The team voluntarily uses the copilot for recurring weekly content work.

Suggested editing bands:

- 0 to 10 percent: minor cleanup.
- 11 to 20 percent: publishable with light editing.
- 21 to 40 percent: meaningful rewriting required.
- Above 40 percent: generation failure for product-learning purposes.

## 16. Implementation Sequence

Complete the work in this order.

### Phase 1: Audit and preserve

- Confirm the current article-brief backend and frontend state.
- Identify completed work and open gaps.
- Confirm canonical taxonomy is already active.
- Confirm prompt rollback still works.
- Do not rewrite working components.

### Phase 2: Brief-first completion

- Implement or complete brief resolution.
- Display the brief before generation.
- Make all brief fields editable.
- Save confirmed values.
- Ensure Quick Generate does not bypass the brief.

### Phase 3: Three-hook return

- Add structured three-hook output.
- Add recommendation and rationale.
- Add selection, regeneration and manual-entry controls.
- Bind the selected hook to the final generation prompt.

### Phase 4: Staffing safety gate

- Build the source ledger.
- Implement deterministic job, healthcare, IT, government and company-claim checks.
- Integrate exact failure reporting.
- Use existing retry logic for safe corrections.
- Block approval while a hard failure remains.

### Phase 5: Exemplar completion

- Add the healthcare-employer benchmark.
- Add the IT-candidate benchmark.
- Run the eight-category preflight.
- Confirm no exemplar text or placeholders leak into output.

### Phase 6: Metadata and lightweight learning

- Save confirmed brief, hook, structure, review and prompt metadata.
- Retain initial and final versions.
- Add directional editing-effort calculation and edit-reason tags.
- Do not add a complex dashboard.

### Phase 7: Regression and acceptance testing

- Run all existing canonical v2.0 acceptance tests.
- Run the additional tests in Section 17.
- Demonstrate the complete user flow.
- Provide a completion report.

## 17. Final Acceptance Tests

### 17.1 Brief-first behavior

- A short topic creates a complete strategic brief.
- The brief appears before full generation.
- The user can edit every resolved field.
- The audience question is a real audience decision, not a restated topic.
- Source type and desired reader action are always resolved.
- Quick Generate creates and saves the brief.
- Final generation uses confirmed values.

### 17.2 Hook behavior

- Every eligible request returns three materially different hooks.
- Each hook has an archetype, rationale and structure.
- One hook is recommended.
- Selecting another hook changes the content framing and structure.
- Regenerating hooks does not discard the confirmed brief.
- Hook metadata is saved.

### 17.3 Staffing safety

- Unsupplied compensation in a job post causes a hard failure.
- Unsupplied healthcare recency language causes a hard failure.
- Unsupplied licenses, certifications or facility names cause a hard failure.
- Unsupplied IT technologies, project scale or client names cause a hard failure.
- Unsupplied government approvals or contract vehicles cause a hard failure.
- Unsupplied Hire'in or KlerHire claims cause a hard failure.
- The failure identifies the sentence, reason and correction.
- A hard failure prevents approval or publishing.

### 17.4 Creative quality

- All eight exemplar categories pass preflight.
- No exemplar sentence is copied verbatim into normal output.
- No placeholder appears in output.
- The opening is specific and audience-relevant.
- Social-kit versions use independent wording and platform-native structure.
- Structure rotation and deliberate override work.

### 17.5 Metadata and learning

- Confirmed brief values are stored with the draft.
- Selected hook and structure are stored.
- Prompt version and review results are stored.
- Initial accepted output and final approved output are retained.
- Directional editing effort can be calculated.
- Edit-reason tags can be recorded without blocking publishing.

### 17.6 Regression

- Existing drafts open without data loss.
- Existing generation routes still work.
- Peer review and publish approval remain unchanged.
- Legacy values normalize correctly.
- Previous prompt versions remain available for rollback.
- No new roles or unnecessary workflows are introduced.

## 18. Required Demonstration

Before marking the work complete, demonstrate:

1. Enter a short IT-employer topic.
2. Show the automatically resolved brief.
3. Edit the audience question or CTA.
4. Show three materially different hooks.
5. Select a non-recommended hook.
6. Generate a LinkedIn post and show that the selected hook changes the structure.
7. Change the audience to `MSP_STAFFING_PARTNER` and demonstrate meaningful framing changes.
8. Generate a healthcare-candidate educational post.
9. Attempt to add unsupported recent-experience language and show the blocking failure.
10. Generate a job post with compensation omitted from the input and confirm the output also omits compensation.
11. Attempt to introduce an unsupported client or facility name and show the blocking failure.
12. Generate a Brand Perspective post without converting it into capability or BD content.
13. Generate a four-platform social kit with independent adaptations.
14. Save, reopen and edit the brief and draft.
15. Show stored hook, structure, prompt version and review metadata.
16. Show the comparison between the initial accepted output and final approved output.
17. Open a legacy draft and show canonical normalization.
18. Reactivate the previous prompt version and confirm rollback.

## 19. Definition of Done

The MVP finalization is complete only when:

- The brief is visible and editable before full generation.
- Audience question, source basis and reader action are resolved for every request.
- Three materially different hooks are returned and selectable.
- The selected hook controls the final structure.
- Staffing-specific hard failures block unsafe content.
- Eight exemplar categories pass preflight.
- Canonical taxonomy is used for all new data.
- Existing review, publishing and rollback workflows remain intact.
- Required metadata and editing-effort signals are saved.
- All acceptance tests pass.
- The required demonstration is completed.
- A final completion report is delivered.

## 20. Final Replit Execution Instruction

Use the following instruction with this document:

`Continue the existing Hire'in Content Studio implementation. Do not create a new agent, redesign the application or reopen completed taxonomy work. Treat this v2.1 Finalization and Gap-Closure Work Order as the execution authority for the remaining MVP work. First audit the current article-brief and generation pipeline and identify what is already complete. Then implement the visible editable brief, input-discipline fields, three-hook selection, staffing-specific safety gate, two missing exemplar categories, and lightweight editing-effort metadata in the exact sequence defined here. Preserve existing drafts, prompt rollback, peer review, publish approval, roles and routes. Run the full canonical v2.0 test suite plus the v2.1 tests in this document. Do not mark the task complete until the required demonstration and completion report are provided.`

## 21. Required Completion Report

Replit must return:

- Current-state audit summary.
- Features completed.
- Files changed.
- Database or schema changes.
- API changes.
- UI changes.
- Prompt versions created or updated.
- Safety rules implemented.
- Exemplar preflight results.
- Tests run and results.
- Demonstration results.
- Known limitations.
- Remaining blockers, if any.
- Rollback instructions.

Do not report completion based only on code changes. Report completion only after the end-to-end flow is demonstrated and the acceptance tests pass.
