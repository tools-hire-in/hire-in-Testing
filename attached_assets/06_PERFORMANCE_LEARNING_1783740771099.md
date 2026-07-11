# Work Order 06 — Performance Capture and Governed Learning Loop

## Objective

Add basic performance capture and recommendations without allowing analytics to silently rewrite strategy.

## Features

1. Record published URL/date.
2. Capture platform metrics manually or through existing integrations.
3. Capture business signals:
   - applications
   - recruiter contacts
   - employer inquiries
   - requirements
   - qualified conversations
4. Capture qualitative signals:
   - meaningful comments
   - new questions
   - objections
   - winning hooks
   - production friction
5. Dashboard by:
   - audience
   - domain
   - pillar
   - platform
   - format
   - objective
6. Generate recommendation cards.
7. Require human approval before a recommendation changes:
   - audience card
   - platform rule
   - voice rule
   - CTA rule
   - claim/proof status
   - prompt version

## Acceptance criteria

- Metrics can be associated with the exact content variant.
- Dashboard distinguishes vanity and business signals.
- Recommendations cite the performance records used.
- Strategy cannot be changed automatically.
- Approved changes create a new version and audit event.
- Tests cover authorization and versioning.
