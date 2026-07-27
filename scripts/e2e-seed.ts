/**
 * E2E test seed script — creates deterministic test accounts and cleans them
 * up so Playwright tests have real users to authenticate with.
 *
 * Usage:
 *   npx tsx scripts/e2e-seed.ts          <- create
 *   npx tsx scripts/e2e-seed.ts teardown <- remove
 */
import bcrypt from "bcryptjs";
import { db } from "../server/db.js";
import { sql } from "drizzle-orm";

export const E2E_ADMIN_ID      = "ee000001-0000-0000-0000-000000000000";
export const E2E_EMPLOYEE_ID   = "ee000002-0000-0000-0000-000000000000";
export const E2E_MANAGER_ID    = "ee000003-0000-0000-0000-000000000000";
export const E2E_HR_ID         = "ee000004-0000-0000-0000-000000000000";
export const E2E_RECRUITER_ID  = "ee000005-0000-0000-0000-000000000000";
export const E2E_REVIEWER_ID   = "ee000006-0000-0000-0000-000000000000";
export const E2E_CM_ID         = "ee000007-0000-0000-0000-000000000000";
export const E2E_MARKETING_ID  = "ee000008-0000-0000-0000-000000000000";

// Shared studio project for workflow tests — stable ID avoids creating one at runtime.
export const E2E_STUDIO_PROJECT_ID = "ee100001-0000-0000-0000-000000000000";

export const E2E_ADMIN_EMAIL      = "e2e-admin@hire-in.com";
export const E2E_EMPLOYEE_EMAIL   = "e2e-employee@hire-in.com";
export const E2E_MANAGER_EMAIL    = "e2e-manager@hire-in.com";
export const E2E_HR_EMAIL         = "e2e-hr@hire-in.com";
export const E2E_RECRUITER_EMAIL  = "e2e-recruiter@hire-in.com";
export const E2E_REVIEWER_EMAIL   = "e2e-reviewer@hire-in.com";
export const E2E_CM_EMAIL         = "e2e-cm@hire-in.com";
export const E2E_MARKETING_EMAIL  = "e2e-marketing@hire-in.com";
export const E2E_PASSWORD         = "E2eTest@2024!";

const ALL_E2E_IDS = [
  E2E_ADMIN_ID, E2E_EMPLOYEE_ID, E2E_MANAGER_ID, E2E_HR_ID, E2E_RECRUITER_ID,
  E2E_REVIEWER_ID, E2E_CM_ID, E2E_MARKETING_ID,
];

export async function seedE2EUsers(): Promise<void> {
  const hash = await bcrypt.hash(E2E_PASSWORD, 10);

  // Non-employee base users — ceipal_update_prompt_enabled=false so admin/manager/hr
  // never trigger the Ceipal modal (flag defaults to NULL→true in app logic otherwise)
  await db.execute(sql`
    INSERT INTO admin_users
      (id, email, password, first_name, last_name, role, is_active, totp_enabled,
       ceipal_update_prompt_enabled, created_at)
    VALUES
      (${E2E_ADMIN_ID},     ${E2E_ADMIN_EMAIL},     ${hash}, 'E2E', 'Admin',    'super_admin', true, false, false, NOW()),
      (${E2E_MANAGER_ID},   ${E2E_MANAGER_EMAIL},   ${hash}, 'E2E', 'Manager',  'manager',     true, false, false, NOW()),
      (${E2E_HR_ID},        ${E2E_HR_EMAIL},         ${hash}, 'E2E', 'HR',       'hr',          true, false, false, NOW())
    ON CONFLICT (id) DO UPDATE
      SET password = EXCLUDED.password,
          is_active = true,
          deleted_at = NULL,
          totp_enabled = false,
          totp_secret = NULL,
          ceipal_update_prompt_enabled = false
  `);

  // Studio workflow role users — reviewer (manager role so reviewer pool picks work),
  // content manager (hr role + studio.cm_review via add-on path), marketing manager.
  await db.execute(sql`
    INSERT INTO admin_users
      (id, email, password, first_name, last_name, role, is_active, totp_enabled,
       ceipal_update_prompt_enabled, created_at)
    VALUES
      (${E2E_REVIEWER_ID},  ${E2E_REVIEWER_EMAIL},  ${hash}, 'E2E', 'Reviewer',  'manager',     true, false, false, NOW()),
      (${E2E_CM_ID},        ${E2E_CM_EMAIL},         ${hash}, 'E2E', 'CM',        'hr',          true, false, false, NOW()),
      (${E2E_MARKETING_ID}, ${E2E_MARKETING_EMAIL},  ${hash}, 'E2E', 'Marketing', 'manager',     true, false, false, NOW())
    ON CONFLICT (id) DO UPDATE
      SET password = EXCLUDED.password,
          is_active = true,
          deleted_at = NULL,
          totp_enabled = false,
          totp_secret = NULL,
          ceipal_update_prompt_enabled = false
  `);

  // Employee (has manager_id)
  await db.execute(sql`
    INSERT INTO admin_users
      (id, email, password, first_name, last_name, role, is_active, totp_enabled, manager_id, created_at)
    VALUES
      (${E2E_EMPLOYEE_ID}, ${E2E_EMPLOYEE_EMAIL}, ${hash}, 'E2E', 'Employee', 'employee', true, false, ${E2E_MANAGER_ID}, NOW())
    ON CONFLICT (id) DO UPDATE
      SET password = EXCLUDED.password,
          is_active = true,
          deleted_at = NULL,
          totp_enabled = false,
          totp_secret = NULL,
          manager_id = ${E2E_MANAGER_ID}
  `);

  // Recruiter — Ceipal-eligible role; ceipal_update_prompt_enabled defaults to true
  await db.execute(sql`
    INSERT INTO admin_users
      (id, email, password, first_name, last_name, role, is_active, totp_enabled, manager_id,
       ceipal_update_prompt_enabled, created_at)
    VALUES
      (${E2E_RECRUITER_ID}, ${E2E_RECRUITER_EMAIL}, ${hash},
       'E2E', 'Recruiter', 'recruiter', true, false, ${E2E_MANAGER_ID}, true, NOW())
    ON CONFLICT (id) DO UPDATE
      SET password = EXCLUDED.password,
          is_active = true,
          deleted_at = NULL,
          totp_enabled = false,
          totp_secret = NULL,
          manager_id = ${E2E_MANAGER_ID},
          ceipal_update_prompt_enabled = true
  `);

  console.log("[e2e-seed] Test users created.");

  // Seed the shared studio project used by all workflow tests.
  await db.execute(sql`
    INSERT INTO studio_projects
      (id, name, slug, description, is_active, created_at)
    VALUES
      (${E2E_STUDIO_PROJECT_ID}, 'E2E Workflow Project', 'e2e-workflow-project',
       'Shared project for E2E workflow pipeline tests', true, NOW())
    ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name,
          is_active = true
  `).catch((err: any) => {
    // Table might not have all columns — log but don't abort seed.
    console.warn("[e2e-seed] Studio project seed warning:", err.message);
  });

  console.log("[e2e-seed] Studio project seeded.");
}

export async function teardownE2EUsers(): Promise<void> {
  // Remove studio articles and the shared project created during workflow tests.
  await db.execute(sql`
    DELETE FROM studio_articles WHERE project_id = ${E2E_STUDIO_PROJECT_ID}
  `).catch(() => {});
  await db.execute(sql`
    DELETE FROM studio_projects WHERE id = ${E2E_STUDIO_PROJECT_ID}
  `).catch(() => {});

  for (const [table, col] of [
    ["ceipal_update_logs",        "user_id"],
    ["section_acknowledgements",  "user_id"],
    ["section_progress",          "user_id"],
    ["track_completions",         "user_id"],
    ["attendance",                "user_id"],
    ["break_records",             "user_id"],
    ["sop_employee_progress",     "user_id"],
    ["notification_preferences",  "user_id"],
    ["leave_balances",            "user_id"],
    ["leave_accruals",            "user_id"],
    ["leave_requests",            "user_id"],
    ["coaching_log_entries",      "employee_id"],
    ["coaching_log_entries",      "author_id"],
    ["audit_logs",                "actor_id"],
    ["audit_logs",                "target_id"],
    ["notifications",             "user_id"],
    ["copilot_conversations",     "user_id"],
  ] as [string, string][]) {
    await db.execute(sql`
      DELETE FROM ${sql.raw(table)}
      WHERE ${sql.raw(col)} IN (
        ${E2E_ADMIN_ID}, ${E2E_EMPLOYEE_ID}, ${E2E_MANAGER_ID},
        ${E2E_HR_ID}, ${E2E_RECRUITER_ID},
        ${E2E_REVIEWER_ID}, ${E2E_CM_ID}, ${E2E_MARKETING_ID}
      )
    `).catch(() => {});
  }

  await db.execute(sql`
    DELETE FROM track_assignments
    WHERE user_id IN (
        ${E2E_ADMIN_ID}, ${E2E_EMPLOYEE_ID}, ${E2E_MANAGER_ID},
        ${E2E_HR_ID}, ${E2E_RECRUITER_ID},
        ${E2E_REVIEWER_ID}, ${E2E_CM_ID}, ${E2E_MARKETING_ID}
      )
       OR assigned_by IN (
        ${E2E_ADMIN_ID}, ${E2E_EMPLOYEE_ID}, ${E2E_MANAGER_ID},
        ${E2E_HR_ID}, ${E2E_RECRUITER_ID},
        ${E2E_REVIEWER_ID}, ${E2E_CM_ID}, ${E2E_MARKETING_ID}
      )
  `).catch(() => {});

  await db.execute(sql`
    DELETE FROM admin_users
    WHERE id IN (
      ${E2E_ADMIN_ID}, ${E2E_EMPLOYEE_ID}, ${E2E_MANAGER_ID},
      ${E2E_HR_ID}, ${E2E_RECRUITER_ID},
      ${E2E_REVIEWER_ID}, ${E2E_CM_ID}, ${E2E_MARKETING_ID}
    )
  `).catch(() => {});

  console.log("[e2e-seed] Test users removed.");
}

const isTeardown = process.argv[2] === "teardown";
if (isTeardown) {
  teardownE2EUsers().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
} else {
  seedE2EUsers().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}
