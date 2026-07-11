# Work Order 02 — Audience Question Bank and Content Brief Wizard

## Objective

Build the user-facing MVP flow for capturing real audience questions and creating a structured, audience-led content brief.

## Features

### Audience Question Bank

- List, filter, search, create, edit, archive
- Fields: exact question, primary audience, domain, source context, role/specialty, urgency, business relevance, audience value, proof readiness, status
- Prioritization score with visible rationale
- Convert question to content project

### Brief Wizard

1. Business objective/source
2. Audience and domain
3. Audience decision/question
4. Pillar and single takeaway
5. Approved sources/proof/claims
6. Core format and requested platform variants
7. CTA and reviewer
8. Summary and save

### Project workspace shell

- Brief summary
- status
- owner
- versions
- evidence panel
- generation placeholder
- validation placeholder
- review placeholder

## UX requirements

- Use existing components and visual system.
- Do not create a separate mini-app.
- Provide strong empty states and inline explanations.
- Warn when the user selects no proof for a proof-dependent claim.
- Make one primary audience mandatory.
- Make one audience question and one single takeaway mandatory.
- Do not permit identical platform copy generation in this work order; generation is not yet implemented.

## API and validation

- Add CRUD endpoints using existing route conventions.
- Validate all requests.
- Enforce feature access.
- Audit question, brief, and project changes.
- Prevent status transitions that skip required fields.

## Acceptance criteria

- A permitted user can capture and prioritize a question.
- A question can become a project.
- A complete brief can be saved and versioned.
- An incomplete brief cannot be approved.
- Evidence records can be attached.
- Existing Content Studio navigation includes the new flow.
- Mobile and keyboard navigation are usable.
- Tests cover permissions, validation, and state transitions.
