# Hire'in BD Agent Source Classification and Ingestion Rules

**Version:** 1.0  
**Purpose:** Define how each supplied file may be used. Uploading a file does not make every statement externally approved.

## Primary Business Standard

### `docs/bd-agent-playbook.md`

Use as the authoritative business-development, communication, positioning, qualification, manual proof-point governance, and human-review standard.

Do not treat the playbook itself as evidence for external factual claims. It defines methodology and operating rules.

## Technical Architecture Context

### `docs/bd-agent-architecture-guide.md`

Use as target product architecture and phased implementation context.

The live repository remains the source of truth for current files, schemas, roles, dependencies, routes, services, and migrations.

### `Multi-Portal-System-Architecture-Implementation-Plan.md`

Use only as historical technical reference for likely stack and shared-platform patterns. Verify every assumption against live code.

Do not implement its broad multi-portal scope as part of the BD Agent work. Do not copy its proposed role-enum changes without explicit approval.

### `Hire-in.docx`

Use as historical CredentialRX/platform architecture reference. It may help identify reusable auth, database, encryption, upload, PDF, audit, and storage patterns. Verify against live code.

## Business and Evidence Sources

### `Hirein_Healthcare_Staffing_Capability_Deck.pptx`

Classification: **Primary candidate source for healthcare process and capability grounding, subject to human review.**

May seed:
- healthcare delivery workflow;
- supported role categories;
- credential-aware screening language;
- submission-readiness process;
- MSP/VMS operating discipline;
- focused pilot positioning.

Do not automatically approve every slide statement. Material claims require Proof Point Registry records with source location, status, qualifier, and human reviewer.

### `HireInSolns_CapablityDeck.pdf`

Classification: **Legacy/high-risk capability source; quarantine by default.**

Use to identify claims requiring verification, including:
- nationwide reach or deployment;
- candidates delivered in hours;
- 24/7 responsiveness;
- named-client experience;
- government-program performance;
- Joint Commission, HIPAA, FISMA, or other compliance assertions;
- rapid-deployment and guaranteed-outcome language.

Do not use these externally unless individually verified and manually approved.

### `HireinAI_Business_Plan.docx`

Classification: **Internal only.**

Financial projections, margins, fill-rate assumptions, ROI, break-even, investment needs, operating costs, and growth forecasts may support internal strategy but must never be inserted into client-facing outputs as proof.

## General Ingestion Rules

For every source:

- preserve file name, version, upload date, source owner, confidentiality, domain, and source locator;
- distinguish approved internal knowledge from public research, client-provided information, team observation, inference, and unverified content;
- never infer external approval from the existence of a document;
- never treat a master-deck slide as an automatically approved claim;
- link material claims to atomic Proof Point Registry records;
- preserve required qualifiers;
- quarantine prohibited, internal-only, expired, superseded, and requires-verification claims from approved external artifacts;
- require human review before external use.
