import { db } from "../server/db";

async function apply() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS dev_email_inbox (
      id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      env_mode    TEXT NOT NULL,
      type        TEXT NOT NULL,
      source_job  TEXT NOT NULL,
      to_addresses TEXT[] NOT NULL,
      cc_addresses TEXT[] NOT NULL DEFAULT '{}',
      subject     TEXT NOT NULL,
      body_html   TEXT,
      body_text   TEXT,
      captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  console.log("[apply-dev-email-inbox] Table dev_email_inbox ensured.");
  process.exit(0);
}

apply().catch(err => { console.error(err); process.exit(1); });
