import type { AdminUser } from "@shared/schema";
import { storage } from "./storage";

/**
 * Pure in-memory BFS over a pre-loaded user list.
 * Returns the IDs of all users in the reporting chain under managerId
 * (direct reports, their direct reports, and so on — not the manager themselves).
 *
 * Pass allUsers once to avoid N+1 DB queries; callers that have already loaded
 * the full user list should prefer this function over getAllReporteeIdsFromDb.
 */
export function getAllReporteeIds(managerId: string, allUsers: AdminUser[]): string[] {
  const result: string[] = [];
  const queue = [managerId];
  const visited = new Set<string>([managerId]);

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    for (const user of allUsers) {
      if (user.managerId === currentId && !visited.has(user.id)) {
        visited.add(user.id);
        result.push(user.id);
        queue.push(user.id);
      }
    }
  }
  return result;
}

/**
 * Convenience async wrapper: loads the full admin-user list once, then runs
 * the BFS in memory. Use this when you don't already have allUsers loaded;
 * it is more efficient than the old per-level storage.getTeamMembers() loop.
 */
export async function getAllReporteeIdsFromDb(managerId: string): Promise<string[]> {
  const allUsers = await storage.getAdminUsers();
  return getAllReporteeIds(managerId, allUsers);
}
