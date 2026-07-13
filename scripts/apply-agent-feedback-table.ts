/**
 * Creates the agent_feedback_events table for Task #999.
 * Run with: npx tsx scripts/apply-agent-feedback-table.ts
 */
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("[apply-agent-feedback-table] Starting...");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS agent_feedback_events (
      id                VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      agent_type        VARCHAR NOT NULL,
      source_record_type VARCHAR NOT NULL,
      source_record_id  VARCHAR NOT NULL,
      generation_id     VARCHAR,
      conversation_id   VARCHAR,
      user_id           VARCHAR NOT NULL,
      event_type        VARCHAR NOT NULL,
      reason_code       VARCHAR,
      domain            VARCHAR,
      audience          VARCHAR,
      content_goal      VARCHAR,
      bd_mode           VARCHAR,
      icp_id            VARCHAR,
      buyer_stage       VARCHAR,
      pain_point_theme  VARCHAR,
      prompt_version    INTEGER,
      model_version     VARCHAR,
      metadata          JSONB,
      created_at        TIMESTAMP DEFAULT NOW(),
      updated_at        TIMESTAMP DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS agent_feedback_user_idx
      ON agent_feedback_events(user_id)
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS agent_feedback_source_idx
      ON agent_feedback_events(source_record_type, source_record_id)
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS agent_feedback_agent_type_idx
      ON agent_feedback_events(agent_type, event_type)
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS agent_feedback_created_at_idx
      ON agent_feedback_events(created_at)
  `);

  console.log("[apply-agent-feedback-table] agent_feedback_events table + indexes created.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[apply-agent-feedback-table] Failed:", err);
  process.exit(1);
});
