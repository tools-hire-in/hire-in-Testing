# Work Order 04 — Platform Adaptation and Content Validation

## Objective

Generate meaningfully different platform variants from the approved canonical insight and validate every asset against Hire'in's rules.

## Variants

- LinkedIn text post
- LinkedIn carousel outline
- Instagram carousel + caption
- Instagram Reel script + on-screen text
- X single post
- X thread
- Selective Facebook post
- Hire'in Insights article remains the canonical source

Only show formats selected in the brief.

## Platform adaptation requirements

- Adapt hook, depth, structure, visual direction, CTA, and tone.
- Do not copy identical text across platforms.
- Include alt text for image/carousel assets.
- Include caption/on-screen-text direction for video.
- Include no more hashtags than allowed by the active platform rule.
- Connect every variant to the same approved core insight and proof IDs.

## Validator

Implement deterministic and AI-assisted checks for:

- audience clarity
- usefulness/specificity
- proof coverage
- unsupported claims
- platform fit
- voice/tone
- CTA fit
- accessibility
- privacy/sensitive data
- client-name approval
- job freshness when applicable
- link/destination consistency

Return:

- score
- dimension scores
- blockers
- warnings
- required actions
- required reviewers
- approved elements to preserve

## Revision

- "Fix validation issues" must revise only failed dimensions.
- Preserve user edits and approved sections.
- Keep version history.
- Require revalidation after revision.

## Acceptance criteria

- Variants are materially adapted.
- Every variant has internal source/proof traceability.
- Blocking rules prevent approval.
- Score thresholds work.
- Missing alt text blocks relevant assets.
- Unsupported claims are removed or flagged.
- Tests cover all blocker categories.
