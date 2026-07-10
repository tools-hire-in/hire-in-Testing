---
name: Studio schema drift (later-added columns missing in dev DB)
description: Why public studio/insights read endpoints should select narrow columns, not whole rows
---

In the isolated dev env, several studio columns exist in `shared/schema.ts` but are
MISSING from the actual DB (auto-migrations disabled; the original CREATE TABLE IF NOT
EXISTS ensure-blocks never add later-added columns). Known drifters: `studio_articles.category`,
`studio_newsletter_subscribers.suppressed_at` / `bounce_count` / `last_bounce_at`, and
`studio_projects.routing_rules` (whole-row `getStudioProjects` 500s until an ALTER ensure adds it),
and `studio_content_ideas.archived_at` (broke campaign idea-count queries until ALTER'd in).
Any `db.select()` (all columns) against these tables throws `column ... does not exist`
(Postgres 42703), which 500s the read path (insights getters, getNewsletterSubscriberCounts).

**Rule:** when adding a new column to a studio table in `shared/schema.ts`, also add a matching
idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` ensure line in the server startup block,
because the original CREATE-TABLE-IF-NOT-EXISTS ensures never backfill later-added columns and
auto-migrations are disabled.

**Why:** the env DB lags the schema, so any whole-row `db.select()` against the table throws
42703 and 500s the read path until the column physically exists in both dev and prod.

**Rule:** new public read endpoints that only need to check existence/status should select
narrow columns (e.g. `db.select({ id, status })`) instead of reusing whole-row getters.

**Why:** narrow selects are both a sound design choice (don't fetch a whole row to check a
flag) AND resilient to this drift — they keep working even when the env DB lags the schema.

**How to apply:** if a studio/insights feature 500s with a missing-column error in dev,
it is env drift, not your bug. Either select only the columns you need, or add the missing
column via idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` (see db-push-interactive-prompt).

**Studio article_status enum has no `reviewer_pending`.** Valid values: draft, in_review,
approved, scheduled, published, ready_to_export, pending_marketing, pending_final_approval,
archived. A "seeded, awaiting reviewer" article must be stored as `in_review` (the only status
that makes the reviewer inbox + review-decision flow functional); track the seed/approval state
via `seed_batch_id` + `requires_author_approval`/`requires_marketing_approval` flags, not a status.
**Why:** review-decision endpoint 409s unless status === 'in_review', and the enum cannot hold a
made-up value.
