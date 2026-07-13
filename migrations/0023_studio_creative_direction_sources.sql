-- Creative direction source tracking columns on studio_articles (Task #1060)
-- Separate from 0022 to preserve migration immutability.
-- USER = user explicitly selected the field; AUTO = system resolved via platform+goal lookup table.
-- Applied via idempotent ensure-blocks in server/index.ts; this file is the formal migration record.

ALTER TABLE studio_articles ADD COLUMN IF NOT EXISTS emotion_source varchar;
ALTER TABLE studio_articles ADD COLUMN IF NOT EXISTS hook_pattern_source varchar;
ALTER TABLE studio_articles ADD COLUMN IF NOT EXISTS structure_source varchar;
ALTER TABLE studio_articles ADD COLUMN IF NOT EXISTS engagement_goal_source varchar;
