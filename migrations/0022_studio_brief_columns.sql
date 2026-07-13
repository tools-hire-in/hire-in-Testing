-- Psychological brief columns on studio_articles (Task #1060)
-- Applied via idempotent ensure-blocks in server/index.ts; this file is the formal migration record.

ALTER TABLE studio_articles ADD COLUMN IF NOT EXISTS desired_emotion text;
ALTER TABLE studio_articles ADD COLUMN IF NOT EXISTS hook_pattern text;
ALTER TABLE studio_articles ADD COLUMN IF NOT EXISTS content_structure text;
ALTER TABLE studio_articles ADD COLUMN IF NOT EXISTS engagement_goal text;
