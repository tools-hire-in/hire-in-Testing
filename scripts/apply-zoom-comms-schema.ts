/**
 * Applies the Zoom Comms Sync & AI Analytics tables to the database.
 * Run with: npx tsx scripts/apply-zoom-comms-schema.ts
 */
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("[apply-zoom-comms-schema] Starting...");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS zoom_call_logs (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR NOT NULL,
      email VARCHAR NOT NULL,
      call_id VARCHAR NOT NULL,
      direction VARCHAR NOT NULL DEFAULT 'outbound',
      duration INTEGER NOT NULL DEFAULT 0,
      caller_number VARCHAR,
      callee_number VARCHAR,
      result VARCHAR NOT NULL DEFAULT 'answered',
      start_time TIMESTAMP,
      end_time TIMESTAMP,
      synced_date DATE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log("[apply-zoom-comms-schema] zoom_call_logs created");

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS zoom_call_logs_call_id_date_idx
    ON zoom_call_logs(call_id, synced_date)
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS zoom_sms_sessions (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR NOT NULL,
      email VARCHAR NOT NULL,
      session_id VARCHAR NOT NULL,
      participant_number VARCHAR,
      message_count INTEGER NOT NULL DEFAULT 0,
      last_message_at TIMESTAMP,
      synced_date DATE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log("[apply-zoom-comms-schema] zoom_sms_sessions created");

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS zoom_sms_sessions_session_date_idx
    ON zoom_sms_sessions(session_id, synced_date)
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS zoom_sms_messages (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id VARCHAR NOT NULL,
      direction VARCHAR NOT NULL DEFAULT 'outbound',
      body TEXT,
      sent_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log("[apply-zoom-comms-schema] zoom_sms_messages created");

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS zoom_sms_messages_session_idx ON zoom_sms_messages(session_id)
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS zoom_sms_digests (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id VARCHAR NOT NULL,
      date DATE NOT NULL,
      sanitized_digest TEXT,
      sanitized_at TIMESTAMP DEFAULT NOW(),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log("[apply-zoom-comms-schema] zoom_sms_digests created");

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS zoom_sms_digests_session_date_idx
    ON zoom_sms_digests(session_id, date)
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS zoom_ai_insights (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      date DATE NOT NULL,
      scope VARCHAR NOT NULL DEFAULT 'user',
      scope_id VARCHAR NOT NULL,
      content JSONB,
      generated_at TIMESTAMP DEFAULT NOW(),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log("[apply-zoom-comms-schema] zoom_ai_insights created");

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS zoom_ai_insights_date_scope_idx ON zoom_ai_insights(date, scope, scope_id)
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS zoom_sync_meta (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      last_synced_at TIMESTAMP,
      last_synced_date DATE,
      synced_user_count INTEGER DEFAULT 0,
      status VARCHAR NOT NULL DEFAULT 'idle',
      error_message TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    INSERT INTO zoom_sync_meta (id, status) VALUES ('singleton', 'idle')
    ON CONFLICT (id) DO NOTHING
  `);
  console.log("[apply-zoom-comms-schema] zoom_sync_meta created");

  console.log("[apply-zoom-comms-schema] All tables created successfully");
  process.exit(0);
}

main().catch((err) => {
  console.error("[apply-zoom-comms-schema] Fatal error:", err);
  process.exit(1);
});
