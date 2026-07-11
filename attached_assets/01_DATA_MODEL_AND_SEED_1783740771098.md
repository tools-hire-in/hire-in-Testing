# Work Order 01 — Content Intelligence Data Model and Strategy Seed

## Prerequisite

Read the architecture contract and the completed codebase audit.

## Objective

Add the minimum governed data model needed for audiences, pillars, platform rules, voice rules, claims, proof, sources, questions, briefs, projects, variants, validation, approvals, prompt versions, and performance.

## Scope

1. Implement schema using existing ORM/database conventions.
2. Reuse existing generic content/project tables when appropriate.
3. Create reversible migrations.
4. Add indexes for audience, domain, status, project, platform, approval status, and freshness.
5. Add Zod or existing equivalent schemas.
6. Add an idempotent seed script using `/seed/*.json`.
7. Map access through the existing feature-to-role registry.
8. Add audit logging for knowledge mutations.
9. Add service/repository methods and unit tests.
10. Add read-only API endpoints for seeded strategy objects.

## Out of scope

- UI wizard
- AI calls
- content generation
- advanced search/vector retrieval
- new role enums
- automatic publishing

## Required implementation choices

- PostgreSQL remains source of truth.
- Use relational fields for critical filtering and JSONB for flexible arrays/attributes.
- Claims and proof must support approval status and expiry.
- Sources must support confidentiality and source tier.
- Prompt records must support version and active/inactive status.
- All tables must connect to existing users rather than creating another user model.

## Acceptance criteria

- Migration applies successfully in a clean environment.
- Seed can be run repeatedly without duplicates.
- Four MVP audiences exist.
- Five MVP pillars exist.
- LinkedIn, Instagram, X, Facebook, and Insights rules exist.
- Voice/guardrail and validation rules exist.
- Unauthorized users cannot mutate strategy data.
- No current Content Studio behavior regresses.
- Type check and tests pass.
- Replit documents the schema and rollback steps.
