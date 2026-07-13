# Hire'in BD Agent Knowledge Source Admission Policy

**Version:** 2.0  
**Purpose:** Prevent outdated, unverified, irrelevant, or low-quality material from becoming Agent knowledge.

## Current Decision

No legacy document is approved as a knowledge source merely because it existed in a previous handoff, repository folder, deck, business plan, or company archive.

The previous capability decks, business plan, historical architecture documents, and other old files are excluded from the BD Agent knowledge base unless the CEO or designated business leader later reviews and explicitly re-admits a specific file.

There is no `source-materials/` seed folder in the current Replit handoff.

## Authoritative Product Documents

### `docs/bd-agent-playbook.md`

Use as the authoritative business-development operating standard.

It defines strategy, positioning methodology, qualification, communication standards, manual proof-point governance, and human decision authority.

It is not evidence for client-facing factual claims.

### `docs/bd-agent-architecture-guide.md`

Use as target architecture and phased implementation guidance.

The live repository remains the source of truth for current code, database, roles, routes, dependencies, and deployment.

### `docs/bd-agent-strategy-sync-implementation.md`

Use as the implementation requirements that synchronize the product with the playbook.

## Excluded Legacy Materials

The following categories are excluded by default:

- old or unofficial capability decks;
- outdated company presentations;
- legacy capability statements;
- internal business plans and projections;
- unreviewed case studies;
- old client lists;
- unsupported performance statistics;
- historical architecture documents that do not match the live repository;
- documents created by team members without approval;
- copied, generic, aspirational, or brochure-style marketing content.

Excluded material must not be:

- uploaded as approved Agent knowledge;
- used to seed proof points;
- used as grounding for external drafts;
- used as a master deck;
- treated as evidence;
- embedded into prompts;
- added as test fixtures representing approved company truth.

## Manual Admission Process

A future source may enter the Knowledge Library only after an authorized human reviews:

- source owner;
- purpose;
- creation and review date;
- accuracy;
- current relevance;
- domain;
- confidentiality;
- client-use permission;
- claim quality;
- supporting evidence;
- duplication or conflict with existing knowledge;
- required restrictions or expiration.

The reviewer must assign one of these states:

- draft;
- review_required;
- approved_internal;
- approved_for_external_grounding;
- restricted;
- superseded;
- expired;
- rejected.

Approval applies only to the specific reviewed version.

## Proof-Point Rule

No factual client-facing claim is approved simply because it appears in an admitted document.

Material claims must be represented as separate Proof Point Registry records with:

- exact wording;
- source and locator;
- owner;
- status;
- allowed audience;
- allowed channel;
- qualifier or restriction;
- effective date;
- review date;
- human reviewer.

## Master Deck Rule

A master deck provides approved narrative and design structure only after manual review.

A slide does not automatically authorize every claim written on it. Material claims must still resolve to the Proof Point Registry.

## Market Research Rule

Market research provided by a team member may be used as an input to analysis, but it must be labeled according to provenance and reliability.

Team-submitted research is not automatically verified.

## Product Enforcement

The system must:

- default new knowledge sources to review_required;
- require human approval before production retrieval;
- preserve source version and review history;
- prevent rejected, expired, superseded, and restricted material from normal external grounding;
- show source and status beside material recommendations;
- never silently promote a source or claim to approved status.

## Current Operating Principle

Start with no assumed knowledge.

Build the governance, ingestion, retrieval, positioning, and approval system first. Add current, useful, verified knowledge manually as Hire'in learns from real clients and chooses the markets it wants to target.
