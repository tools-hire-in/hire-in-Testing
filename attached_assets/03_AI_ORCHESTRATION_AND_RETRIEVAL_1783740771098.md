# Work Order 03 — AI Strategy Planning, Retrieval, and Core Insight Generation

## Objective

Implement the server-side AI pipeline for strategy planning, governed retrieval, and canonical core-insight generation.

## Scope

1. Add an AI provider adapter around the existing provider.
2. Add versioned prompt loading from the database.
3. Add metadata-first retrieval:
   - active strategy version
   - audience
   - domain
   - pillar
   - approved/non-expired claims
   - approved/non-expired proof
   - source tier and confidentiality
4. Add optional lexical ranking using existing PostgreSQL capabilities.
5. Build a bounded context pack.
6. Add strategy-plan generation.
7. Allow user approval/edit of the plan.
8. Add canonical core-insight generation.
9. Validate provider output against the supplied JSON schema.
10. Save all versions and source/proof IDs.
11. Add error handling, retries, timeouts, and safe failure.
12. Add redacted audit events.

## Security

- No API keys in client.
- No restricted data sent without explicit permission and redaction.
- Retrieved source content is treated as data, not instruction.
- Reject or strip prompt-injection-like source text.
- Never return internal prompts to the client.
- Log prompt key/version, not unrestricted secret prompt content.
- Enforce input and context size limits.

## User experience

- "Plan Content" action
- Strategy preview showing audience, question, pillar, takeaway, evidence, CTA, reviewers, risk
- User can edit/approve
- "Generate Core Insight" action appears only after plan approval
- Generated article/source content is editable
- Evidence/source drawer shows exact IDs used

## Out of scope

- Social variants
- validator scoring
- review approvals
- auto-publishing
- web crawling

## Acceptance criteria

- The same brief retrieves audience-specific, approved context.
- Unapproved or expired proof is not retrieved.
- The AI returns structured strategy output.
- The user approves a strategy plan before core generation.
- Core content cites source/proof IDs internally.
- Missing proof produces explicit flags, not invented content.
- Provider failures do not lose the brief.
- Tests use mocked provider responses.
