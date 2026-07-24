/**
 * One-time migration: adds recognition certificate columns to praise_posts
 * and creates the recognition_certificates + recognition_certificate_audit tables.
 * Run: npx tsx scripts/apply-recognition-schema.ts
 */
import { pool } from "../server/db";

async function main() {
  const client = await pool.connect();
  try {
    console.log("Applying recognition certificate schema...");

    // 1. Add new columns to praise_posts
    await client.query(`
      ALTER TABLE praise_posts
        ADD COLUMN IF NOT EXISTS certificate_requested boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS certificate_status varchar(50),
        ADD COLUMN IF NOT EXISTS recognition_description text,
        ADD COLUMN IF NOT EXISTS contribution_summary text,
        ADD COLUMN IF NOT EXISTS public_citation_draft text,
        ADD COLUMN IF NOT EXISTS public_citation_approved text,
        ADD COLUMN IF NOT EXISTS recognition_context varchar(100),
        ADD COLUMN IF NOT EXISTS visibility varchar(50) NOT NULL DEFAULT 'public';
    `);
    console.log("✓ Extended praise_posts");

    // 2. Create recognition_certificates
    await client.query(`
      CREATE TABLE IF NOT EXISTS recognition_certificates (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        praise_post_id varchar REFERENCES praise_posts(id),
        certificate_id varchar NOT NULL UNIQUE,
        recipient_id varchar NOT NULL REFERENCES admin_users(id),
        approver_id varchar NOT NULL REFERENCES admin_users(id),
        badge_type_id varchar NOT NULL REFERENCES praise_badge_types(id),
        recognition_description text NOT NULL,
        contribution_summary text NOT NULL,
        public_citation text NOT NULL,
        recognition_context varchar(100),
        reference_number varchar NOT NULL UNIQUE,
        auth_code varchar NOT NULL,
        document_hash varchar NOT NULL,
        pdf_storage_path varchar,
        pdf_url varchar,
        status varchar(50) NOT NULL DEFAULT 'issued',
        version integer NOT NULL DEFAULT 1,
        superseded_by_id varchar,
        issued_at timestamp DEFAULT now(),
        revoked_at timestamp,
        revoked_by_id varchar REFERENCES admin_users(id),
        correction_reason text,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
    `);
    console.log("✓ Created recognition_certificates");

    // 3. Create recognition_certificate_audit
    await client.query(`
      CREATE TABLE IF NOT EXISTS recognition_certificate_audit (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        certificate_id varchar NOT NULL REFERENCES recognition_certificates(id),
        actor_id varchar NOT NULL REFERENCES admin_users(id),
        action varchar(50) NOT NULL,
        metadata jsonb,
        created_at timestamp DEFAULT now()
      );
    `);
    console.log("✓ Created recognition_certificate_audit");

    // 4. Create recognition_certificate_views (view telemetry)
    await client.query(`
      CREATE TABLE IF NOT EXISTS recognition_certificate_views (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        certificate_id varchar NOT NULL REFERENCES recognition_certificates(id) ON DELETE CASCADE,
        reference_number varchar NOT NULL,
        viewed_at timestamp NOT NULL DEFAULT now(),
        ip_address varchar,
        user_agent text
      );
      CREATE INDEX IF NOT EXISTS idx_rcv_certificate_id ON recognition_certificate_views(certificate_id);
      CREATE INDEX IF NOT EXISTS idx_rcv_viewed_at ON recognition_certificate_views(viewed_at);
    `);
    console.log("✓ Created recognition_certificate_views");

    console.log("Recognition schema migration complete.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
