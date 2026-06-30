// ─────────────────────────────────────────────────────────────────────────────
// SOP role-based assignment engine (Task #661)
//
// When an employee's role is set or changed, we auto-create sop_employee_progress
// rows for every SOP whose role assignments match the new role. This is the
// "who is impacted by this SOP" projection. It is idempotent — re-running never
// creates duplicates (upsertSopEmployeeProgress is keyed on master + user).
//
// We only project against the CURRENT version of each SOP, and only for SOPs that
// have actually reached a published-or-later lifecycle state, so drafts under
// review never generate employee obligations.
// ─────────────────────────────────────────────────────────────────────────────

import { db } from "./db";
import { storage } from "./storage";
import { sopRoleAssignments, sopDocuments } from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";

// Lifecycle states at which a SOP is "live enough" to create employee obligations.
const IMPACTING_STATUSES = ["published", "training_assigned", "acknowledged", "active"];

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
