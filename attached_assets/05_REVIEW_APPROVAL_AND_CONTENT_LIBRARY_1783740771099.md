# Work Order 05 — Review, Approval, Versioning, and Content Library

## Objective

Complete the human-in-the-loop workflow and reusable content package library.

## Features

### Review queue

- Filter by status, owner, audience, domain, risk, due date
- Reviewer assignment
- Comments
- Request changes
- Approve variant or complete package
- Approval history

### Approval routing

- Low risk: content lead
- Medium risk: content lead + SME
- High risk: content lead + SME + leadership/compliance approver

Risk triggers include:

- named clients
- metrics
- compensation
- compliance
- state-specific credentials
- healthcare-sensitive claims
- AI capability claims
- testimonials
- high-intent conversion pages/messages

### Content library

- Search/filter projects and variants
- View brief, strategy, content, sources, proof, validation, approvals, versions
- Duplicate a project as a new brief without copying expired proof
- Export/copy approved content package
- Archive
- Preserve immutable approval snapshot

## Access

Use existing roles and feature access registry. Do not add enum roles.

## Acceptance criteria

- Invalid or blocked content cannot be approved.
- Required reviewers are enforced.
- Every decision is audited.
- User edits and AI versions are distinguishable.
- Approved content can be exported.
- Duplicated content must be revalidated against current strategy/proof.
- Existing Content Studio workflows remain functional.
