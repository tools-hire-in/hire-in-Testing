/**
 * Schema migration: Manager-activated plan engine
 * - Make employee_plans.start_date and end_date nullable (pending plans have no dates yet)
 * - Add pip_hr_acknowledged_at to employee_plans
 * - Add due_day_offset to plan_goal_templates
 */

import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("[plan-activation-schema] Applying schema changes...");

  // 1. Make start_date and end_date nullable on employee_plans
  await db.execute(sql`ALTER TABLE employee_plans ALTER COLUMN start_date DROP NOT NULL`);
  console.log("[plan-activation-schema] start_date is now nullable");

  await db.execute(sql`ALTER TABLE employee_plans ALTER COLUMN end_date DROP NOT NULL`);
  console.log("[plan-activation-schema] end_date is now nullable");

  // 2. Add pip_hr_acknowledged_at column to employee_plans
  await db.execute(sql`
    ALTER TABLE employee_plans
    ADD COLUMN IF NOT EXISTS pip_hr_acknowledged_at TIMESTAMPTZ
  `);
  console.log("[plan-activation-schema] Added pip_hr_acknowledged_at");

  // 3. Add due_day_offset column to plan_goal_templates
  await db.execute(sql`
    ALTER TABLE plan_goal_templates
    ADD COLUMN IF NOT EXISTS due_day_offset INTEGER
  `);
  console.log("[plan-activation-schema] Added due_day_offset");

  // 4. Seed sensible due_day_offset values for existing templates
  // Day-30 goals (milestone tag "day_30") → offset 30
  await db.execute(sql`
    UPDATE plan_goal_templates SET due_day_offset = 30 WHERE milestone = 'day_30' AND due_day_offset IS NULL
  `);
  // Day-60 goals → offset 60
  await db.execute(sql`
    UPDATE plan_goal_templates SET due_day_offset = 60 WHERE milestone = 'day_60' AND due_day_offset IS NULL
  `);
  // Day-90 goals → offset 90 (end of 90-day plan)
  await db.execute(sql`
    UPDATE plan_goal_templates SET due_day_offset = 90 WHERE milestone = 'day_90' AND due_day_offset IS NULL
  `);
  // PIP templates (30-day plans) — end-of-plan goals, no specific milestone
  await db.execute(sql`
    UPDATE plan_goal_templates SET due_day_offset = 30
    WHERE plan_type = 'pip' AND milestone IS NULL AND due_day_offset IS NULL
  `);
  console.log("[plan-activation-schema] Seeded due_day_offset for existing templates");

  console.log("[plan-activation-schema] All schema changes applied successfully.");
  process.exit(0);
}

main().catch(err => {
  console.error("[plan-activation-schema] FAILED:", err);
  process.exit(1);
});
