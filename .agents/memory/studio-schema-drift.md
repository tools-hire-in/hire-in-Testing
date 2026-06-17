---
name: Studio article schema drift (category column)
description: Why public studio/insights read endpoints should select narrow columns, not whole rows
---

In the isolated dev env, `studio_articles.category` exists in `shared/schema.ts` but is
MISSING from the actual DB (auto-migrations disabled; ensure-blocks use CREATE TABLE IF
NOT EXISTS so they never add later-added columns). Any `db.select()` (all columns) against
studio_articles throws `column ... does not exist` (Postgres 42703), which 500s the whole
insights read path (getPublishedInsights, getStudioArticle, getPublishedInsightBySlug).

**Rule:** new public read endpoints that only need to check existence/status should select
narrow columns (e.g. `db.select({ id, status })`) instead of reusing whole-row getters.

**Why:** narrow selects are both a sound design choice (don't fetch a whole row to check a
flag) AND resilient to this drift — they keep working even when the env DB lags the schema.

**How to apply:** if a studio/insights feature 500s with a missing-column error in dev,
it is env drift, not your bug. Either select only the columns you need, or add the missing
column via idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` (see db-push-interactive-prompt).
