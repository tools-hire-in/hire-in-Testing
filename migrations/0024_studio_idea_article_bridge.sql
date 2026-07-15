-- Idea → Article promotion bridge columns on studio_articles
-- linked_idea_id: back-link from the article to its originating content idea
-- idea_context:   JSONB snapshot of planner context (pillar, bdIntelMetadata,
--                 captionCopy, channels) captured at promotion time so the
--                 ArticleEditor can surface full context without re-querying the idea.
-- Applied via idempotent ensure-blocks in scripts/apply-studio-idea-article-bridge.ts;
-- this file is the formal migration record.

ALTER TABLE studio_articles ADD COLUMN IF NOT EXISTS linked_idea_id varchar;
ALTER TABLE studio_articles ADD COLUMN IF NOT EXISTS idea_context jsonb;
