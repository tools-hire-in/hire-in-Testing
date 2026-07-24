/**
 * Creates the five Zoom communications tables.
 * Run with: npx tsx scripts/apply-zoom-comms-schema.ts
 *
 * Uses raw SQL (CREATE TABLE IF NOT EXISTS) to avoid drizzle-kit interactive prompts.
 * Matches the declarations in shared/schema.ts exactly.
 */
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("[apply-zoom-comms-schema] Starting...");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS zoom_call_logs (
      id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      zoom_call_id    VARCHAR UNIQUE,
      user_id         VARCHAR REFERENCES admin_users(id) ON DELETE SET NULL,
      zoom_user_id    VARCHAR,
      direction       VARCHAR,
      duration        INTEGER,
      caller_number   VARCHAR,
      callee_number   VARCHAR,
      start_time      TIMESTAMP,
      end_time        TIMESTAMP,
      status          VARCHAR,
      raw_data        JSONB,
      created_at      TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log("[apply-zoom-comms-schema] zoom_call_logs OK");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS zoom_sms_sessions (
      id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      zoom_session_id VARCHAR UNIQUE,
      user_id         VARCHAR REFERENCES admin_users(id) ON DELETE SET NULL,
      zoom_user_id    VARCHAR,
      peer_number     VARCHAR,
      session_start   TIMESTAMP,
      session_end     TIMESTAMP,
      message_count   INTEGER DEFAULT 0,
      sanitized_thread TEXT,
      created_at      TIMESTAMP DEFAULT NOW(),
      updated_at      TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log("[apply-zoom-comms-schema] zoom_sms_sessions OK");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS zoom_sms_messages (
      id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id      VARCHAR NOT NULL REFERENCES zoom_sms_sessions(id) ON DELETE CASCADE,
      zoom_message_id VARCHAR UNIQUE,
      body            TEXT,
      direction       VARCHAR,
      sent_at         TIMESTAMP,
      created_at      TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log("[apply-zoom-comms-schema] zoom_sms_messages OK");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS zoom_sms_digests (
      id           VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id   VARCHAR NOT NULL REFERENCES zoom_sms_sessions(id) ON DELETE CASCADE,
      date         VARCHAR NOT NULL,
      digest_text  TEXT,
      generated_at TIMESTAMP,
      created_at   TIMESTAMP DEFAULT NOW(),
      CONSTRAINT uq_zoom_sms_digests_session_date UNIQUE (session_id, date)
    )
  `);
  console.log("[apply-zoom-comms-schema] zoom_sms_digests OK");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS zoom_ai_insights (
      id           VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      insight_type VARCHAR NOT NULL,
      subject_id   VARCHAR,
      subject_type VARCHAR,
      content      JSONB NOT NULL,
      generated_at TIMESTAMP DEFAULT NOW(),
      created_at   TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log("[apply-zoom-comms-schema] zoom_ai_insights OK");

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_zoom_call_logs_user_id ON zoom_call_logs(user_id)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_zoom_call_logs_start_time ON zoom_call_logs(start_time)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_zoom_sms_sessions_user_id ON zoom_sms_sessions(user_id)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_zoom_sms_sessions_start ON zoom_sms_sessions(session_start)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_zoom_sms_messages_session_id ON zoom_sms_messages(session_id)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_zoom_sms_messages_sent_at ON zoom_sms_messages(sent_at)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_zoom_ai_insights_type ON zoom_ai_insights(insight_type)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_zoom_ai_insights_subject ON zoom_ai_insights(subject_type, subject_id)
  `);
  console.log("[apply-zoom-comms-schema] Indexes OK");

  console.log("[apply-zoom-comms-schema] All Zoom comms tables created successfully.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[apply-zoom-comms-schema] Failed:", err);
  process.exit(1);
});
