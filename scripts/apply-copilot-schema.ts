/**
 * Applies schema additions for Goal Copilot (Task #1116):
 *   - copilot_conversations table
 *   - company_financial_targets table
 *   - company_goal_actions table
 *   - parent_goal_id column on performance_goals
 */
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("[copilot-schema] Starting...");

  // 1. parent_goal_id on performance_goals
  await db.execute(sql`
    ALTER TABLE performance_goals
    ADD COLUMN IF NOT EXISTS parent_goal_id varchar REFERENCES performance_goals(id) ON DELETE SET NULL
  `);
  console.log("[copilot-schema] performance_goals.parent_goal_id OK");

  // 2. copilot_conversations
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS copilot_conversations (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar NOT NULL REFERENCES admin_users(id),
      role varchar NOT NULL,
      content text NOT NULL,
      intent_detected varchar,
      context_snapshot_json jsonb,
      created_at timestamp DEFAULT now()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_copilot_conv_user ON copilot_conversations(user_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_copilot_conv_created ON copilot_conversations(created_at)`);
  console.log("[copilot-schema] copilot_conversations OK");

  // 3. company_financial_targets
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS company_financial_targets (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      goal_id varchar REFERENCES performance_goals(id) ON DELETE CASCADE,
      label varchar NOT NULL,
      quarter varchar,
      year integer,
      target_amount numeric(14,2),
      actual_amount numeric(14,2),
      currency varchar NOT NULL DEFAULT 'INR',
      notes text,
      created_by varchar REFERENCES admin_users(id),
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    )
  `);
  console.log("[copilot-schema] company_financial_targets OK");

  // 4. company_goal_actions
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS company_goal_actions (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      goal_id varchar REFERENCES performance_goals(id) ON DELETE SET NULL,
      title varchar NOT NULL,
      description text,
      assigned_to varchar REFERENCES admin_users(id),
      due_date date,
      completed_at timestamp,
      created_by varchar REFERENCES admin_users(id),
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_goal_actions_assigned ON company_goal_actions(assigned_to)`);
  console.log("[copilot-schema] company_goal_actions OK");

  console.log("[copilot-schema] All done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[copilot-schema] Error:", err);
  process.exit(1);
});
