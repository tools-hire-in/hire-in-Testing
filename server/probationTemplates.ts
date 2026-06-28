import { db } from "./db";
import { sql } from "drizzle-orm";

// ─── Probation template selection logic ──────────────────────────────────────
// Resolves the best-matching probation goal templates for an employee based on
// their department / role / level, with sensible fallbacks. Used by both the
// onboarding activation flow and the manual plan-creation route so probation
// plans are pre-filled consistently. Goals stay editable per employee afterward.

export interface ProbationKey {
  department: string | null;
  role: string | null;
  level: string | null;
}

export interface ResolvedGoal {
  title: string;
  description: string | null;
  category: string;
  weight: number | null;
  milestone: string | null;
  isUniversal: boolean;
  sortOrder: number;
}

// Map a free-text designation + department name to the framework's structured
// (department, role, level) keys. Mirrors the role cards in Section 8 of the doc.
export function parseProbationKey(
  designation: string | null | undefined,
  departmentName: string | null | undefined,
): ProbationKey {
  const d = (designation || "").toLowerCase();
  const dept = (departmentName || "").toLowerCase();

  let department: string | null = null;
  if (dept.includes("health")) department = "healthcare";
  else if (/\bit\b|information tech|software|tech/.test(dept)) department = "it";
  else if (dept.includes("engineer")) department = "engineering";
  else if (dept.includes("market")) department = "marketing";
  else if (dept.includes("sales") || dept.includes("business dev") || dept.includes("bd")) department = "sales_bd";
  else if (/\bhr\b|human resource|operation|\bops\b|admin/.test(dept)) department = "hr_ops";
  else if (dept.includes("professional")) department = "professional_services";

  let role: string | null = null;
  let level: string | null = null;

  // Order matters:
  //  - Lead titles ("Lead Recruiter", "Assistant Manager - Recruitment", "Team Lead")
  //    must map to lead_recruiter BEFORE the generic recruiter branch, otherwise
  //    "Lead Recruiter" would fall into recruiter/senior.
  //  - Recruiter titles (incl. "Delivery Specialist") are matched before the broad
  //    account-manager terms; account-manager patterns stay narrow so they don't
  //    swallow recruiter/delivery roles.
  if (/\blead\b|assistant manager|team lead/.test(d)) {
    role = "lead_recruiter";
    level = "lead";
  } else if (/recruit|sourc|talent|delivery specialist/.test(d)) {
    role = "recruiter";
    level = /senior|\bsr\b|sr\./.test(d) ? "senior" : "associate";
  } else if (/account manager|delivery manager|key account|\baccount\b/.test(d)) {
    role = "account_manager";
    level = "manager";
  } else if (/market|content|social|brand|copywriter/.test(d)) {
    role = "marketing";
    level = "all";
  } else if (/\bhr\b|human resource|operation|\bops\b|admin/.test(d)) {
    role = "hr_ops";
    level = "all";
  }

  // Fall back to department to infer role when the designation is unclear.
  if (!role) {
    if (department === "marketing") { role = "marketing"; level = "all"; }
    else if (department === "hr_ops") { role = "hr_ops"; level = "all"; }
    else if (department === "sales_bd") { role = "account_manager"; level = "manager"; }
    else if (department && department !== "professional_services") { role = "recruiter"; level = "associate"; }
  }

  return { department, role, level };
}

// Resolve the ordered list of probation goals to seed for a plan:
//   1. all active universal goals (always),
//   2. the best-matching role-specific milestone goals (Day 30/60/90),
//   3. fallback to legacy healthcare templates by role_slug when no framework
//      role match exists, so existing healthcare behavior never regresses.
export async function resolveProbationGoalTemplates(
  key: ProbationKey,
  legacyRoleSlug?: string | null,
): Promise<ResolvedGoal[]> {
  const goals: ResolvedGoal[] = [];

  // 1. Universal goals (Section 5)
  const universal = await db.execute(sql`
    SELECT goal_title, goal_description, goal_category, weight, milestone, sort_order
    FROM plan_goal_templates
    WHERE plan_type = 'probation'::employee_plan_type
      AND is_universal = true
      AND is_active = true
    ORDER BY sort_order ASC
  `);
  for (const r of universal.rows as any[]) {
    goals.push({
      title: r.goal_title,
      description: r.goal_description ?? null,
      category: r.goal_category ?? "individual",
      weight: r.weight ?? null,
      milestone: r.milestone ?? null,
      isUniversal: true,
      sortOrder: r.sort_order ?? 0,
    });
  }

  // 2. Role-specific milestone goals — best match by department + level
  let roleRows: any[] = [];
  if (key.role) {
    const candidates = await db.execute(sql`
      SELECT goal_title, goal_description, goal_category, weight, milestone, sort_order, department, level
      FROM plan_goal_templates
      WHERE plan_type = 'probation'::employee_plan_type
        AND is_universal = false
        AND is_active = true
        AND role = ${key.role}
      ORDER BY sort_order ASC
    `);
    const all = candidates.rows as any[];

    // Rank candidate (department, level) groups: exact dept beats NULL dept;
    // exact level beats 'all'/NULL level. Pick the single best group.
    const score = (row: any): number => {
      let s = 0;
      if (key.department && row.department === key.department) s += 4;
      else if (!row.department) s += 1; // NULL department = applies to all
      if (key.level && row.level === key.level) s += 2;
      else if (row.level === "all" || !row.level) s += 1;
      return s;
    };
    let best = -1;
    let bestGroupKey: string | null = null;
    for (const row of all) {
      const sc = score(row);
      const gk = `${row.department ?? ""}::${row.level ?? ""}`;
      if (sc > best) { best = sc; bestGroupKey = gk; }
    }
    if (bestGroupKey !== null) {
      roleRows = all.filter(r => `${r.department ?? ""}::${r.level ?? ""}` === bestGroupKey);
    }
  }

  // 3. Fallback to legacy healthcare templates when no framework role matched.
  if (roleRows.length === 0 && legacyRoleSlug) {
    const legacy = await db.execute(sql`
      SELECT goal_title, goal_description, goal_category, weight, milestone, sort_order
      FROM plan_goal_templates
      WHERE plan_type = 'probation'::employee_plan_type
        AND is_universal = false
        AND is_active = true
        AND department_scope = 'healthcare'::employee_plan_dept_scope
        AND role IS NULL
        AND (role_slug = ${legacyRoleSlug} OR role_slug = 'all')
      ORDER BY sort_order ASC
    `);
    roleRows = legacy.rows as any[];
  }

  for (const r of roleRows) {
    goals.push({
      title: r.goal_title,
      description: r.goal_description ?? null,
      category: r.goal_category ?? "individual",
      weight: r.weight ?? null,
      milestone: r.milestone ?? null,
      isUniversal: false,
      sortOrder: 100 + (r.sort_order ?? 0),
    });
  }

  return goals;
}
