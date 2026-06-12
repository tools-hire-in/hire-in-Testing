---
name: Performance salary clauses (offer + addendum)
description: How the two optional performance-based salary clauses are sourced, rendered, and gated by role.
---

# Performance-based salary clauses

Two optional performance-based salary clauses, both seeded as editable `letter_template_sentences` rows:
- Offer letter: category `offer_clause`, key `probation_performance_review` — a third compensation mode alongside the existing single-salary and committed two-stage probation modes. No committed post-probation figure; optional "up to ₹" ceiling.
- Addendum: category `addendum_clause`, key `growth_plan_review` — optional 90-day growth-plan clause, NO probation framing.

Constants + merge engine live in `shared/performanceClauses.ts` (`renderOfferClause`, `renderAddendumClause`, default seed text, category labels). `mergeClauseText` is two-stage: (1) inline optional fragments wrapped in `{{ ... }}` are removed if any token inside is blank, preserving surrounding mandatory text; (2) any remaining whole line with a blank token is dropped. **Why:** an earlier line-based-only version deleted mandatory legal text when the optional ceiling was blank, because mandatory sentences shared a line with the `[MaxRevisionSalary]` token. **How to apply:** keep optional clauses (ceiling, extension) inside `{{ }}` whenever they sit on a line with mandatory wording; reserve whole-line drops for lines that are entirely optional (e.g. a bullet solely about the ceiling).

Seed text lives in the DB (`runMigrations` applies the INSERT in 0015 in BOTH dev and prod, tracked by `__drizzle_migrations`). To change already-seeded wording without clobbering admin edits, add a new migration that `UPDATE ... WHERE sentence = <exact old text>` (see 0016). Server renders via `getManagedClauseText` (DB row, fallback to constant), so the DB row — not just the constant — must be updated.

**Role gating:** clause TEXT is edit + DOCX-download only for super_admin/admin (`requireAdminLevel`); regular HR sees only a toggle that applies the managed wording. Download endpoint: `GET /api/hr/letter-templates/sentences/:id/download` → `generateClauseDocx` in `server/offerLetterAddendum.ts`.

**Known divergence (intentional, follow-up filed):** the HRTools offer-letter live PREVIEW renders the clause using the hardcoded client default `OFFER_CLAUSE_DEFAULT_TEXT`, while the server send/DOCX path uses the admin-EDITED managed template from DB. So preview won't reflect admin customizations — only the final downloaded/sent letter does.
**Why:** preview is computed client-side in a useMemo without fetching the managed template.
**How to apply:** if asked why preview text differs from the sent letter, this is the cause; fix by fetching the managed template client-side.
