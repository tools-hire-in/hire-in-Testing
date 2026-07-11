# Work Order — Content Intelligence Layer Injection (replaces Work Orders 00–06)

## Context

The existing Content Studio already provides everything the deferred 7-work-order plan was going to build for infrastructure: `aiDraftService.ts` (structured JSON outputs, retries, model tiers, template rendering), `shared/studioAi.ts` (compliance modes: healthcare_safe, public_sector_safe, no_claims, source_required; guardrail injection; schema enforcement), `studioPromptSeed.ts` (versioned prompt library), social kit generation, quality review pass, and a peer-review + super-admin publish gate.

What it lacks is the intelligence layer: audience decision architecture, staffing domain expertise, hook/archetype craft, an anti-slop lexicon, exemplars, and proof-card governance. All of that exists as six authored knowledge files. This work order injects them into the existing system. **Nothing is rebuilt. No new tables unless stated. No new roles. No workflow changes.**

## Payload files (the source of truth — copy content from these, do not paraphrase)

- `HIREIN_AI_KNOWLEDGE_BASE.md` (audiences H1/H2/I1/I2, pillars P1–P5, platform rules, validation scorecard, seasonal calendar §8)
- `HIREIN_DOMAIN_EXPERTISE.md` (staffing vocabulary and mechanics, incl. §3B Facebook community mode, §5 deployment rules)
- `HIREIN_CONTENT_CRAFT.md` (hook archetypes §1, content archetypes §2, craft rules §3, banned list §4, platform craft §5, exemplars §6, self-edit pass §7)
- `HIREIN_MASTER_PROMPT.md` (workflow sequencing and hard rules — mine for prompt language, not for UI)
- `HIREIN_PROOF_LIBRARY.md` (proof-card format and usage rules)
- `HIREIN_CURRENT_JOBS.md` (job-content freshness and quotability rules)

## Scope — four tasks, in order

### Task 1 — Audience architecture as a first-class generation parameter
- Add an `audienceCode` parameter (H1 | H2 | I1 | I2) to the generation params alongside the existing free-text `target_audience` (keep the free-text field as an optional refinement, not a replacement).
- Store the four audience cards (decision questions, pain points, proof needs, tone adjustments, approved CTAs, preferred platforms) as seed data using whatever lightweight storage matches existing conventions (a seeded config table or a typed constants module — follow the codebase's existing pattern for `studioPromptSeed`-style data; do not invent a new persistence approach).
- At generation time, render the FULL selected audience card into the prompt template. The card text comes verbatim from the Knowledge Base §3.
- UI: audience selector (4 options with one-line descriptions) in the existing generation form. Default: none selected; selection required for generation.

### Task 2 — Prompt template upgrade (version bump, not replacement)
Using the existing prompt versioning system, create new versions of `article_generator`, `healthcare_staffing`, `shape_my_draft`, and each social kit prompt that additionally inject, as static blocks:
- Domain Expertise vocabulary rules (§5 deployment rules verbatim; the vocabulary sections as reference context, trimmed per template to the relevant domain)
- The banned AI-slop and staffing-cliché list (Content Craft §4) as a hard constraint block
- The self-edit pass (Content Craft §7) as a mandatory pre-output instruction
- Platform craft specifics (Content Craft §5) — each social kit prompt gets only its own platform's block
- 1–2 relevant exemplars per template (Content Craft §6) as few-shot quality anchors, with bracketed placeholder claims preserved as placeholders
- The seasonal calendar (KB §8) available to the article and planning prompts
- Prior prompt versions remain intact and revertible via the existing active/inactive mechanism.

### Task 3 — Craft parameters
- Add two optional generation parameters: `hookArchetype` (the 8 from Content Craft §1) and `contentArchetype` (the 12 from §2), surfaced as dropdowns with an "AI selects" default.
- When "AI selects": the prompt instructs the model to choose and NAME the archetype in its output metadata, and to produce 3 labeled hook options with a recommendation (per Master Prompt Step 3).
- Persist the chosen archetypes with the draft (existing draft metadata JSON is sufficient) so archetype rotation can be checked manually; automated rotation enforcement is out of scope.

### Task 4 — Proof governance wiring (map to existing mechanisms, build nothing new)
- Proof cards enter generation as `source_notes` (existing param). Provide a documented convention: each card pasted in PC-## format from the Proof Library.
- The prompt instructs: Hire'in capability claims may cite only supplied PC-## cards inline; unsupported material claims must set the existing `source_verification_needed` flag and render as `[NEEDS_PROOF: …]` in the draft text.
- Compliance mode mapping: content touching healthcare candidate guidance defaults to `healthcare_safe`; anything citing zero proof cards while making capability claims should fail the existing quality review pass. Extend the quality review prompt (version bump) to check for: banned-list violations, restricted claims (KB §2) without a cited card, missing alt text on visual assets, and identical cross-platform copy.

## Out of scope (explicitly)
Question bank, brief wizard, evidence database tables, review queue changes, approval routing changes, performance dashboards, Ceipal API integration (separate future task — HIREIN_CURRENT_JOBS.md is its spec), retrieval/vector search, new roles, any schema migration beyond what Task 1's seed storage requires, any change to the publish gate.

## Acceptance criteria
1. Generating with `audienceCode=H1` vs `H2` on the same topic produces materially different content (tone, CTA, depth) traceable to the audience cards.
2. Output never contains a banned-list phrase; test with topics that bait them ("write about the war for talent").
3. Social outputs include 3 labeled hook options + recommendation; archetype is named in metadata.
4. A capability claim with no PC-## card in source_notes yields `[NEEDS_PROOF]` + `source_verification_needed`, and quality review flags it.
5. Supplying a PC-## card yields the claim with inline citation.
6. LinkedIn/Instagram/X/Facebook outputs from one core draft share the takeaway but share no verbatim sentences.
7. Prior prompt versions restore cleanly via existing versioning.
8. No regression in existing Studio generation, compliance modes, or publish flow; existing tests pass.
9. Exemplar placeholder claims never appear verbatim in generated output (test explicitly).

## Definition of done
One PR (or small stack), demoable as: select audience → select/auto archetypes → paste proof cards → generate article + social kit → quality review flags what it should → publish gate unchanged.
