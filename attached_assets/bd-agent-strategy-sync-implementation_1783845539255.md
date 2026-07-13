# Hire'in BD Agent - Strategy Synchronization Implementation Prompt for Replit

## Purpose

Update the existing Hire'in BD Agent implementation so the product enforces Version 2.2 of the Hire'in Solutions Business Development and Client Communication Standards.

The authoritative business document is:

`docs/bd-agent-playbook.md`

This is a synchronization task, not a greenfield rebuild. Inspect and extend the current implementation. Reuse the existing authentication, users, RBAC, API client, database, ORM, upload/storage, audit, approval, logging, and UI patterns. Do not introduce a second backend, database, auth system, API abstraction, or knowledge pipeline.

Do not add new role-enum values during this task unless the current repository architecture makes the existing permission model unusable. Map BD Rep, BD Manager, Knowledge Owner, and Super Admin responsibilities to existing roles and feature permissions first.

## Required Outcomes

The product and the strategy must agree on:

- Where Hire'in Wins
- Where Hire'in Should Be Selective
- The four company value pillars
- The top three value priorities by domain
- The five-question opportunity qualification standard
- Qualification verdicts
- Proof-point and claim statuses
- Capability deck approval states
- Human review requirements
- The four-part communication framework
- The role of the BD Agent and its limitations
- Market-research provenance and reliability labeling
- A structured Client Positioning Recommendation
- Virtual CBDO opportunity strategy and competitive guidance
- Separate Agent recommendation and human decision records
- Reuse of human-reviewed positioning across decks, messages, and workflows

## Step 1 - Repository and Implementation Audit

Before editing code, locate and document the exact existing files and symbols for:

- BD Agent routes, pages, services, prompts, orchestration, and schemas
- opportunity or account profile records
- knowledge sources, chunks, claims, citations, and retrieval
- deck records, slides, versions, approval statuses, and editing workflows
- response schemas and structured-output validation
- template storage and follow-up drafting
- authorization and feature permissions
- audit logging
- repository documentation and in-product Playbook links

Identify whether a claims or proof-point table already exists. Extend it when practical instead of creating a competing registry.

## Step 2 - Add the Authoritative Playbook

Add the supplied Version 2.2 Markdown content at:

`docs/bd-agent-playbook.md`

Requirements:

- Preserve stable heading anchors.
- Add a visible Playbook link in the BD Agent workspace header.
- Add context-sensitive links from Pre-Call Brief, Discovery, Qualification, Deck Collaborator, Follow-Up Drafting, Knowledge Administration, and Manager Review.
- Render only the relevant section in contextual help.
- Do not send the entire playbook to the language model on every request.

## Step 3 - Implement Manual, Human-Controlled Proof-Point Registry

Use the existing claims model if one exists. Otherwise add a proof-point entity following current repository conventions. This is a manual governance implementation for the development and early-scale phase, not an autonomous approval engine.

Required fields or equivalent:

- id and proofPointCode
- domain
- category
- approvedLanguage
- sourceId and sourceLocator
- evidenceOwnerUserId or owner reference
- status
- allowedBuyerTypes
- allowedChannels
- qualifiers
- restrictions
- effectiveAt
- reviewAt or expiresAt
- supersededById
- internalNotes
- createdBy, updatedBy, createdAt, updatedAt

Required statuses:

- approved
- approved_with_qualification
- requires_verification
- internal_only
- prohibited
- expired
- superseded

Rules:

- Prohibited claims must be blocked from external drafts and decks.
- Requires-verification claims may be surfaced internally with a prominent label, source, and restrictions, but must not be inserted into external drafts without manual verification.
- Approved-with-qualification claims must preserve their required qualifier.
- Internal-only claims must never be inserted into an external artifact.
- Expired and superseded claims must not be selected for new external content.
- Every material claim in an external draft must expose its source, status, and qualifier in the review UI.
- Audit every status change and record the human reviewer and approval decision when approval occurs.
- Never auto-approve a claim or automatically upgrade a seeded status.
- Use existing feature permissions. Do not add a dedicated Knowledge Owner role in this phase.
- Super Admin manages records; the CEO or designated business leadership performs manual approval. HR access alone does not grant claim-governance authority.

Seed the registry with Appendix A from the playbook. Preserve the stated status; do not silently upgrade Requires verification entries to Approved.

## Step 4 - Add Where-We-Win Intelligence

Implement structured win profiles as advisory intelligence. Reuse an existing strategy/configuration model if present; otherwise create a small versioned configuration. These profiles and guardrails must support human qualification; they must not automatically reject, close, or no-bid an opportunity.

Each win profile must support:

- domain
- title
- buyer types
- deal or engagement types
- strong-fit signals
- why Hire'in is relevant
- approved value pillars
- required proof-point IDs
- disqualifiers or selectivity rules
- recommended pilot ask
- status and version

Seed these profiles:

1. Focused permanent healthcare hiring
2. Buyers experiencing submission noise or incomplete candidate packages
3. Structured MSP, VMS, and partner-led programs
4. Focused pilot opportunities
5. Buyers who value direct access, ownership, and flexibility

The Opportunity Qualification workflow must display:

- matched win profile or no strong match
- fit signals detected
- missing evidence or information
- selectivity warnings
- top two or three value pillars
- recommended pilot or next action
- qualification verdict

Do not label an opportunity a strong fit solely because its domain is supported.

## Step 5 - Align Domain Value Priorities

Encode these ordered value priorities:

### Healthcare

1. Credential-aware, submission-ready candidates
2. Quality and relevance of submissions
3. Responsive coordination through interview and onboarding

### IT

1. Accurate alignment to technical and business requirements
2. Speed to qualified and available candidates
3. Reliable communication and ownership

### Engineering and General Professional

1. Role-specific screening and practical fit
2. Focused support for priority or difficult requirements
3. Clear accountability and communication

Generation rules:

- Use no more than three primary value pillars in an external response.
- Prefer two when sufficient.
- Explain why each selected pillar is relevant to the buyer.
- Do not output a brochure-style list of all company capabilities.

## Step 6 - Update the Opportunity Qualification Contract

The system must collect and evaluate:

1. Client problem
2. Urgency and cost or risk of delay
3. Buyer, process, role, location, volume, and delivery conditions
4. Hire'in relevance and available approved proof
5. Smallest practical next action

Supported verdicts:

- pursue
- qualify_further
- nurture
- do_not_pursue

Structured output should include, using the repository's existing schema-validation approach:

- verdict
- verdictRationale
- matchedWinProfileId
- fitSignals
- selectivityWarnings
- missingInformation
- selectedValuePillars
- approvedProofPoints
- claimsRequiringVerification
- prohibitedClaimsDetected
- recommendedNextAction
- recommendedPilotAsk
- humanReviewRequired
- confidence

## Step 7 - Implement the Virtual CBDO Positioning and Opportunity Strategy Engine

Extend the existing Hire'in BD Agent so it operates as a governed Virtual Chief Business Development Officer Copilot.

This is a decision-support capability. It must recommend and explain client positioning and opportunity strategy, but it must not autonomously approve claims, reject opportunities, commit commercial terms, change opportunity state, or send external communication.

### Research and Account Intelligence Inputs

Reuse existing knowledge-upload, account, opportunity, meeting-note, job, requirement, and user-input workflows. Do not create a parallel research platform when the current Knowledge Library can be extended.

Relevant input types include:

- public market and workforce research;
- client and account research;
- buyer and discovery notes;
- client-provided information;
- delivery-team and candidate-market feedback;
- competitor observations;
- MSP, VMS, procurement, and vendor-program information;
- job, role, volume, location, rate, and urgency data;
- approved internal sources;
- previous approved decks, proposals, emails, and meeting summaries.

Each material research item used by the strategy engine should preserve or infer, where available:

- sourceType;
- sourceTitle;
- sourceLocator;
- author or submittedByUserId;
- publishedAt or observedAt;
- domain;
- geography;
- accountId and opportunityId;
- reliabilityLabel;
- verificationStatus;
- confidentiality;
- createdAt and updatedAt.

Do not treat team-submitted research as automatically verified.

### Reliability Labels

Support these labels or equivalent within the current knowledge model:

- verified_external_source;
- client_provided;
- approved_internal;
- team_observation;
- inferred;
- requires_verification;
- conflicting_evidence;
- insufficient_information.

The Agent must distinguish facts from interpretations, assumptions, and recommendations.

### Structured Client Positioning Recommendation

Generate a validated structured output containing:

- clientSituation;
- clientProblem;
- businessImpactOrRisk;
- buyerRole;
- buyerPriorities;
- opportunityStage;
- primaryPositioningStatement;
- primaryValuePillar;
- supportingValuePillars;
- matchedWinProfileIds;
- fitSignals;
- whyHireinIsRelevant;
- recommendedProofPointIds;
- evidenceGaps;
- claimsRequiringVerification;
- capabilitiesNotToEmphasize;
- recommendedTone;
- urgencyLevel;
- competitiveAngle;
- competitorEvidenceLimitations;
- selectivityWarnings;
- recommendedNextAction;
- recommendedPilotAsk;
- agentVerdict;
- confidence;
- humanReviewRequired.

Use no more than one primary and two supporting value pillars unless the user explicitly requests a broader internal analysis.

### Advisory Opportunity Verdicts

Support:

- pursue;
- qualify_further;
- pilot_recommended;
- nurture;
- leadership_review_required;
- do_not_prioritize.

Do not automatically close, reject, archive, no-bid, approve, or change the status of an opportunity based on the Agent verdict.

### Competitive Strategy

Where sufficient evidence exists, the Agent may recommend whether Hire'in should lead with:

- domain specialization;
- submission quality;
- credential-aware screening;
- process discipline;
- direct access and ownership;
- responsiveness;
- flexibility;
- a focused pilot; or
- account-specific delivery insight.

The Agent must not invent competitor clients, pricing, performance, capabilities, weaknesses, or market share. When evidence is limited, label the assessment as directional and requiring verification.

### Human Decision Record

Store the Agent recommendation separately from the human decision.

Supported human decisions:

- accepted;
- modified;
- escalated;
- deprioritized;
- pending_review.

Record, using existing audit and user patterns:

- reviewerUserId;
- decision;
- rationale or modifications;
- decidedAt;
- positioningVersion.

Do not overwrite the original Agent recommendation.

### Positioning Data Model

Extend the existing opportunity model when safe. Otherwise add a related versioned positioning entity using current schema, repository, migration, and audit conventions.

Required fields or equivalent:

- id;
- opportunityId;
- version;
- clientSituation;
- primaryPositioning;
- primaryValuePillar;
- supportingValuePillars;
- matchedWinProfileIds;
- proofPointIds;
- evidenceGaps;
- competitiveAngle;
- selectivityWarnings;
- recommendedNextAction;
- recommendedPilotAsk;
- agentVerdict;
- agentConfidence;
- humanDecision;
- humanRationale;
- reviewedBy;
- reviewedAt;
- createdAt;
- updatedAt.

### Positioning Reuse

After a human accepts or modifies a strategy, make the current positioning available to:

- Pre-Call Brief;
- Discovery;
- Qualification;
- Deck Collaborator;
- Follow-Up Drafter;
- Meeting Summary;
- Pilot Proposal;
- Objection Response;
- Manager Review.

A material new discovery may trigger a proposed revision. It must not silently replace the current human-reviewed positioning.

### Product Interface

Add a Positioning and Strategy view within the opportunity workspace showing:

- Agent verdict;
- human decision status;
- Where-We-Win alignment;
- client problem and business impact;
- recommended positioning;
- primary and supporting value pillars;
- approved proof available;
- evidence gaps;
- research sources and reliability labels;
- competitive angle and limitations;
- risks and selectivity warnings;
- recommended pilot;
- next best action;
- confidence;
- human-review notice.

Provide actions consistent with current UI and permissions:

- Accept;
- Modify;
- Escalate;
- Deprioritize;
- Regenerate using new evidence.

Do not implement autonomous opportunity-state changes or external sending.

## Step 8 - Align Every Agent Mode

### Pre-Call Brief

Include buyer type, decision context, matched win profile, top value pillars, relevant approved proof, questions to close information gaps, prohibited or risky claims, and recommended objective.

### Discovery and Profile Building

Capture the five qualification questions and the strong-fit/selectivity signals. Do not infer missing facts as confirmed.

### Qualification Verdict

Use the four verdicts and show the evidence behind the verdict.

### Deck Collaborator

- Start from an approved master deck or approved version.
- Select only slides relevant to the buyer and decision.
- Insert only allowed proof points.
- Preserve protected brand elements.
- Show source and claim status during review.
- Require approval before external status.
- Prevent draft, expired, restricted, or superseded versions from external sharing.

### Follow-Up Drafter

Use the four-part structure:

1. Context
2. Relevance and value
3. Evidence, action, or recommendation
4. Clear next step

Use no more than two or three value pillars and never auto-send.

## Step 9 - Implement the Pre-Send Review

Before an external artifact can be marked approved, validate:

- buyer and purpose are present
- opportunity profile is sufficiently complete
- selected value pillars are limited and relevant
- proof-point status allows external use
- required qualifiers are retained
- no prohibited, internal-only, expired, or superseded claims are present
- the correct approved deck/template version is used
- next action is specific
- human approver and approval timestamp are recorded

Do not implement this as a cosmetic checklist only. Enforce the machine-verifiable items server-side.

## Step 10 - Manual Registry Administration Experience

Add or update a manual Proof Point Registry screen with:

- filters by domain, category, status, owner, review date, and source
- create, edit, classify, review, approve, qualify, prohibit, expire, and supersede actions according to existing feature permissions; Super Admin manages records and designated business leadership performs manual approval
- source preview or source locator
- exact approved language and qualifier fields
- usage history and audit trail
- overdue-review indicator
- a clear notice that the registry supports human decisions and does not authorize autonomous external use

Add a Where-We-Win management view or configuration screen only if the current admin architecture supports it without inflating the task. Otherwise seed versioned configuration and document the update path.

## Step 11 - Update Templates and Master Deck Grounding

Review existing templates and master deck slides.

- Link material claims to proof-point IDs where practical.
- Mark unsupported claims for review rather than deleting evidence silently.
- Quarantine the claims listed in Appendix B.
- Treat the internal business plan as internal-only.
- Do not treat a slide as verified merely because it exists in a master deck.

## Deferred From This Task

Do not build:

- autonomous claim approval or publication;
- automatic opportunity rejection or no-bid decisions;
- multi-level approval routing;
- a new Knowledge Owner database role;
- automated quarterly governance workflows;
- automatic client-specific claim authorization;
- automated external sending or sharing; or
- a complex evidence-attachment workflow.

## Step 12 - Audit, Evaluation, and Acceptance Criteria

Add tests or evaluation fixtures covering:

- healthcare opportunity that strongly matches a win profile
- opportunity with accepted human positioning reused across deck and follow-up
- market research labeled as team observation rather than verified fact
- directional competitive recommendation with insufficient competitor evidence
- IT opportunity with insufficient external proof
- opportunity selected only on lowest rate
- request for a 24-hour guarantee
- named-client claim without approval
- approved-with-qualification credential-aware claim
- expired or superseded proof point
- internal financial projection leaking into external copy
- deck created from an outdated version
- follow-up draft with more than three value pillars

The task is complete only when:

- the playbook is available in-product;
- opportunity qualification uses win profiles and selectivity rules;
- the Virtual CBDO engine produces structured positioning and strategy recommendations;
- Agent recommendations and human decisions are stored separately;
- accepted or modified positioning is reused consistently across downstream workflows;
- domain value priorities are enforced;
- proof points are structured and governed;
- unsupported claims cannot enter approved external artifacts;
- the Deck Collaborator respects version and approval states;
- the Follow-Up Drafter follows the communication framework;
- human review and approval remain mandatory;
- Where-We-Win profiles and selectivity guardrails remain advisory and never trigger automatic opportunity rejection;
- all changes reuse the current architecture and pass existing tests;
- implementation documentation names the exact files and schemas changed.

## Stop Conditions

Stop and report rather than improvising if:

- the existing claims or deck schema materially conflicts with this model;
- a role-enum migration would be required;
- current approval states are ambiguous or destructive to migrate;
- source documents cannot be linked reliably;
- implementation would require a second knowledge system;
- an unsupported claim would need to be treated as approved to make a feature work.

Return a concise implementation report with:

- reused components
- schema changes
- API changes
- UI changes
- prompt or orchestration changes
- seeded records
- tests added
- unresolved verification items
- claims quarantined
- migration or rollback notes
