// ─────────────────────────────────────────────────────────────────────────────
// SOP role-based assignment engine (Task #661, updated Task #1576)
//
// When an employee's role is set or changed, we auto-create sop_employee_progress
// rows for every SOP whose role assignments match the new role. This is the
// "who is impacted by this SOP" projection. It is idempotent — re-running never
// creates duplicates (upsertSopEmployeeProgress is keyed on master + user).
//
// We only project against the CURRENT version of each SOP, and only for SOPs that
// have actually reached a published-or-later lifecycle state, so drafts under
// review never generate employee obligations.
//
// Task #1576 additions:
//   resolveTrainingGroups(user) — maps a user to their set of 13 business role groups
//   getAssignmentLevelForUser(userId, sopMasterId) — highest A/R/C level for a user
// ─────────────────────────────────────────────────────────────────────────────

import { db } from "./db";
import { sql as rawSql } from "drizzle-orm";
import { storage } from "./storage";
import { sopRoleAssignments, sopDocuments } from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";
import type { SopAssignmentLevel } from "./sopSeedData";

// Lifecycle states at which a SOP is "live enough" to create employee obligations.
const IMPACTING_STATUSES = ["published", "training_assigned", "acknowledged", "active"];

// Level priority ordering for highest-wins resolution
const LEVEL_RANK: Record<SopAssignmentLevel, number> = {
  optional_reference: 0,
  awareness: 1,
  required: 2,
  certification: 3,
};

// Level-derived quiz parameters
export const LEVEL_PARAMS: Record<SopAssignmentLevel, {
  questionCount: number;
  passScore: number;
  evidenceRequired: boolean;
  managerSignoffRequired: boolean;
  quizViewOnly: boolean;
}> = {
  awareness:          { questionCount: 5,  passScore: 70, evidenceRequired: false, managerSignoffRequired: false, quizViewOnly: false },
  required:           { questionCount: 8,  passScore: 80, evidenceRequired: false, managerSignoffRequired: false, quizViewOnly: false },
  certification:      { questionCount: 8,  passScore: 85, evidenceRequired: true,  managerSignoffRequired: true,  quizViewOnly: false },
  optional_reference: { questionCount: 0,  passScore: 0,  evidenceRequired: false, managerSignoffRequired: false, quizViewOnly: true  },
};

// ─── Role Group Resolver (Task #1576) ─────────────────────────────────────────
// Maps a user (role + department) to their set of 13 business role groups.
// A user may belong to multiple groups (e.g. manager role + healthcare dept).
// The caller then takes the highest A/R/C level among all matching assignments.

export interface UserGroupContext {
  id: string;
  role: string | null | undefined;
  departmentName?: string | null; // the department display name (lowercased for matching)
}

export function resolveTrainingGroups(user: UserGroupContext): string[] {
  const groups = new Set<string>();

  // ALL group is always included
  groups.add("ALL");

  const role = (user.role ?? "").toLowerCase();
  const dept = (user.departmentName ?? "").toLowerCase();

  // Role-based groups
  if (role === "super_admin" || role === "admin") {
    groups.add("CEO-SuperAdmin");
  }
  if (role === "manager") {
    groups.add("Managers-All");
  }
  if (role === "recruiter") {
    groups.add("TA-Recruiter");
  }
  if (role === "hr" || role === "operations") {
    groups.add("Ops-HR");
  }
  if (role === "finance") {
    groups.add("Finance-Team");
  }

  // Department-based groups (complement to role groups)
  if (dept.includes("healthcare") || dept.includes("health care") || dept.includes("clinical")) {
    groups.add("Healthcare-Team");
  }
  if (dept.includes("information technology") || dept.includes(" it ") || dept === "it" || dept.startsWith("it ") || dept.endsWith(" it")) {
    groups.add("IT-Team");
  }
  if (dept.includes("engineering") || dept.includes("professional services") || dept.includes("prof services")) {
    groups.add("Engineering-Prof-Services-Team");
  }
  if (dept.includes("sales") || dept.includes("account management") || dept.includes("account manager")) {
    groups.add("Sales-AM");
  }
  if (dept.includes("business development") || dept.includes("bd ") || dept === "bd") {
    groups.add("BD-Team");
  }
  if (dept.includes("marketing") || dept.includes("content")) {
    groups.add("Marketing-Team");
  }
  if (dept.includes("finance") || dept.includes("billing") || dept.includes("payroll") || dept.includes("accounts receivable") || dept.includes("accounts payable")) {
    groups.add("Finance-Team");
  }
  if (dept.includes("hr") || dept.includes("human resources") || dept.includes("operations") || dept.includes("ops")) {
    groups.add("Ops-HR");
  }

  return Array.from(groups);
}

// Returns the highest A/R/C assignment level for a user on a given SOP,
// resolved across all matching role groups.
// Returns null if no assignments found (SOP does not target this user).
// Convenience overload matching Task #1568 dependency contract:
// getAssignmentLevelForUser(userId, sopMasterId) → level string
export async function getAssignmentLevelForUser(userId: string, sopMasterId: string): Promise<string>;
// Full-context overload (internal use)
export async function getAssignmentLevelForUser(user: UserGroupContext, sopMasterId: string): Promise<{ level: SopAssignmentLevel; assignmentId: string; roleGroup: string } | null>;
export async function getAssignmentLevelForUser(
  userOrId: UserGroupContext | string,
  sopMasterId: string,
): Promise<string | { level: SopAssignmentLevel; assignmentId: string; roleGroup: string } | null> {
  // If called with just a userId string, load the user and return the level string
  if (typeof userOrId === "string") {
    const rows = await db.execute(rawSql`
      SELECT au.id, au.role, d.name AS dept_name
      FROM admin_users au
      LEFT JOIN departments d ON d.id = au.department_id
      WHERE au.id = ${userOrId} LIMIT 1
    `);
    if (!rows.rows.length) return "required";
    const r = rows.rows[0] as any;
    const ctx: UserGroupContext = { id: r.id as string, role: r.role as string | null | undefined, departmentName: r.dept_name as string | undefined };
    const result = await _getAssignmentLevelForUserCtx(ctx, sopMasterId);
    return result?.level ?? "required";
  }
  return _getAssignmentLevelForUserCtx(userOrId, sopMasterId);
}

async function _getAssignmentLevelForUserCtx(
  user: UserGroupContext,
  sopMasterId: string,
): Promise<{ level: SopAssignmentLevel; assignmentId: string; roleGroup: string } | null> {
  const groups = resolveTrainingGroups(user);

  const rows = await db.execute(rawSql`
    SELECT id, role_group_key, assignment_level, applies_to_all
    FROM sop_role_assignments
    WHERE sop_master_id = ${sopMasterId}
      AND (role_group_key IN (${rawSql.join(groups.map(g => rawSql`${g}`), rawSql`, `)}) OR applies_to_all = true)
  `);

  if (!rows.rows.length) return null;

  let best: { level: SopAssignmentLevel; assignmentId: string; roleGroup: string } | null = null;
  for (const row of rows.rows as any[]) {
    const level = (row.assignment_level ?? "required") as SopAssignmentLevel;
    if (!best || LEVEL_RANK[level] > LEVEL_RANK[best.level]) {
      best = { level, assignmentId: row.id as string, roleGroup: (row.role_group_key ?? "ALL") as string };
    }
  }
  return best;
}


// Returns all users impacted by a SOP, using the new role-group system.
// Falls back to the legacy role-based lookup when no role_group_key rows exist.
export async function impactedUsersForSopWithLevel(
  sopMasterId: string,
): Promise<Array<{ userId: string; level: SopAssignmentLevel; roleGroup: string; assignmentId: string; department: string }>> {
  // Load all group assignments for this SOP
  const assignmentRows = await db.execute(rawSql`
    SELECT id, role_group_key, assignment_level, applies_to_all, role
    FROM sop_role_assignments
    WHERE sop_master_id = ${sopMasterId}
  `);

  const allUsers = await storage.getAdminUsers();
  const activeUsers = allUsers.filter((u) => u.isActive !== false);

  // Load department names for all users in one shot
  const deptRows = await db.execute(rawSql`
    SELECT au.id, d.name as dept_name
    FROM admin_users au
    LEFT JOIN departments d ON d.id = au.department_id
    WHERE au.is_active = true AND au.deleted_at IS NULL
  `);
  const deptMap = new Map<string, string>();
  for (const r of deptRows.rows as any[]) {
    deptMap.set(r.id as string, (r.dept_name as string | null) ?? "");
  }

  // Determine if any rows use the new role_group_key system
  const hasGroupRows = (assignmentRows.rows as any[]).some((r) => r.role_group_key);

  const result: Array<{ userId: string; level: SopAssignmentLevel; roleGroup: string; assignmentId: string; department: string }> = [];

  if (hasGroupRows) {
    // New role-group system: resolve per user
    for (const user of activeUsers) {
      const groups = resolveTrainingGroups({
        id: user.id,
        role: user.role,
        departmentName: deptMap.get(user.id),
      });

      let best: { level: SopAssignmentLevel; roleGroup: string; assignmentId: string } | null = null;
      for (const row of assignmentRows.rows as any[]) {
        const rowGroup = row.role_group_key as string | null;
        const appliesToAll = row.applies_to_all as boolean;
        if (!rowGroup && !appliesToAll) continue; // skip legacy rows when group rows exist
        if (appliesToAll || (rowGroup && groups.includes(rowGroup))) {
          const level = (row.assignment_level ?? "required") as SopAssignmentLevel;
          if (!best || LEVEL_RANK[level] > LEVEL_RANK[best.level]) {
            best = { level, roleGroup: rowGroup ?? "ALL", assignmentId: row.id as string };
          }
        }
      }
      if (best) result.push({ userId: user.id, ...best, department: deptMap.get(user.id) ?? "" });
    }
  } else {
    // Legacy role-based system: match on system role slug
    const roles = Array.from(new Set((assignmentRows.rows as any[]).map((r) => r.role as string).filter(Boolean)));
    for (const user of activeUsers) {
      if (user.role && roles.includes(user.role)) {
        const matchingRow = (assignmentRows.rows as any[]).find((r) => r.role === user.role);
        if (matchingRow) {
          result.push({
            userId: user.id,
            level: "required",
            roleGroup: user.role,
            assignmentId: matchingRow.id as string,
            department: deptMap.get(user.id) ?? "",
          });
        }
      }
    }
  }

  return result;
}

// Sync SOP progress rows for a single user given their role. Returns the number of
// new progress rows created.
export async function syncSopProgressForUser(userId: string, role: string | null | undefined): Promise<number> {
  if (!role) return 0;

  // SOP masters that target this role.
  const roleRows = await db
    .select({ sopMasterId: sopRoleAssignments.sopMasterId })
    .from(sopRoleAssignments)
    .where(eq(sopRoleAssignments.role, role));
  const masterIds = Array.from(new Set(roleRows.map((r) => r.sopMasterId)));
  if (masterIds.length === 0) return 0;

  // Current, impacting versions of those masters.
  const docs = await db
    .select()
    .from(sopDocuments)
    .where(and(eq(sopDocuments.isCurrent, true), inArray(sopDocuments.sopMasterId, masterIds)));

  let created = 0;
  for (const doc of docs) {
    if (!IMPACTING_STATUSES.includes(doc.lifecycleStatus as string)) continue;
    const before = await storage.getSopEmployeeProgressForUser(userId);
    const had = before.some((p) => p.sopMasterId === doc.sopMasterId);
    await storage.upsertSopEmployeeProgress(doc.sopMasterId, doc.version, userId);
    if (!had) created += 1;
  }
  return created;
}

// Sync progress for every active employee that matches a given SOP's role
// assignments — used when a SOP is published / training assigned. Returns the set
// of impacted user IDs (regardless of whether the row already existed).
export async function impactedUserIdsForSop(sopMasterId: string): Promise<string[]> {
  const roleRows = await db
    .select({ role: sopRoleAssignments.role })
    .from(sopRoleAssignments)
    .where(eq(sopRoleAssignments.sopMasterId, sopMasterId));
  const roles = Array.from(new Set(roleRows.map((r) => r.role)));
  if (roles.length === 0) return [];

  const users = await storage.getAdminUsers();
  return users
    .filter((u) => u.isActive !== false && u.role && roles.includes(u.role))
    .map((u) => u.id);
}

// Backfill: for every current impacting SOP, create progress rows for every active
// employee matching its roles. Idempotent. Returns count of new rows created.
export async function backfillAllSopProgress(): Promise<{ created: number; scanned: number }> {
  const docs = await db.select().from(sopDocuments).where(eq(sopDocuments.isCurrent, true));
  let created = 0;
  let scanned = 0;
  for (const doc of docs) {
    if (!IMPACTING_STATUSES.includes(doc.lifecycleStatus as string)) continue;
    const userIds = await impactedUserIdsForSop(doc.sopMasterId);
    for (const userId of userIds) {
      scanned += 1;
      const before = await storage.getSopEmployeeProgressForUser(userId);
      const had = before.some((p) => p.sopMasterId === doc.sopMasterId);
      await storage.upsertSopEmployeeProgress(doc.sopMasterId, doc.version, userId);
      if (!had) created += 1;
    }
  }
  return { created, scanned };
}
