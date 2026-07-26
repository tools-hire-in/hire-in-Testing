import { pool } from "../server/db";

async function applyAmendmentSchema() {
  console.log("Applying amendment lifecycle schema changes...");

  await pool.query(`
    ALTER TABLE hr_letters
    ADD COLUMN IF NOT EXISTS amendment_subtype varchar;
  `);
  console.log("✓ hr_letters.amendment_subtype added");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS designation_changes (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      employee_id varchar NOT NULL REFERENCES admin_users(id),
      old_designation varchar,
      new_designation varchar NOT NULL,
      old_department varchar,
      new_department varchar,
      effective_date varchar NOT NULL,
      source_type varchar NOT NULL DEFAULT 'manual',
      source_document_id varchar,
      source_document_type varchar,
      reason text,
      initiated_by varchar REFERENCES admin_users(id),
      created_at timestamp DEFAULT now()
    );
  `);
  console.log("✓ designation_changes table created");

  await pool.end();
  console.log("Done.");
}

applyAmendmentSchema().catch(err => {
  console.error("Schema migration failed:", err);
  process.exit(1);
});
