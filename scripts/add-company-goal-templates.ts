import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function apply() {
  console.log("[company-goal-templates] Creating company_goal_templates table...");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS company_goal_templates (
      id               VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      template_code    VARCHAR(60) NOT NULL UNIQUE,
      title            VARCHAR(200) NOT NULL,
      description      TEXT,
      suggested_milestones JSONB NOT NULL DEFAULT '[]'::jsonb,
      is_active        BOOLEAN NOT NULL DEFAULT true,
      created_at       TIMESTAMP DEFAULT NOW(),
      updated_at       TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log("[company-goal-templates] Table created (or already existed).");

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_company_goal_templates_active
      ON company_goal_templates (is_active)
  `);
  console.log("[company-goal-templates] Index ensured.");

  console.log("[company-goal-templates] Done.");
  process.exit(0);
}

apply().catch((e) => { console.error(e); process.exit(1); });
