/**
 * Compliance Countdown Calculator
 *
 * Computes working-day countdowns until the SOP compliance lock activates for an employee.
 * Working days exclude weekends (Sat–Sun) and public holidays from the `holidays` table.
 *
 * Used by:
 *  - GET /api/hr/dashboard-stats  → complianceCountdown field on the CommandCenter banner
 *  - scheduler (when workingDaysLeft === 3) → manager alert notification
 */

import { db } from "./db";
import { sql } from "drizzle-orm";
import { storage } from "./storage";
import { notifyUser } from "./notifications";
import { getPortalBaseUrl } from "./portalUrl";

export interface CountdownItem {
  sopMasterId: string;
  sopCode: string;
  title: string;
  estimatedMinutes: number;
  daysUntilLockCalendar: number;
}

export interface ComplianceCountdownResult {
  active: boolean;
  workingDaysLeft: number;
  items: CountdownItem[];
}

/**
 * Count working days (M–F, excluding public holidays) between today and a future date.
 * Both bounds are exclusive of the "lock" date: we count how many working days
 * the employee has LEFT before the lock activates.
 *
 * @param todayStr  ISO date string for today (YYYY-MM-DD)
 * @param lockDateStr ISO date string for the lock activation date
 * @param holidayDates Set of holiday date strings (YYYY-MM-DD) that are non-optional
 */
function countWorkingDaysBetween(
  todayStr: string,
  lockDateStr: string,
  holidayDates: Set<string>,
): number {
  const today = new Date(todayStr + "T12:00:00Z");
  const lockDate = new Date(lockDateStr + "T12:00:00Z");

  let count = 0;
  const cursor = new Date(today);
  cursor.setDate(cursor.getDate() + 1); // start counting from tomorrow

  while (cursor <= lockDate) {
    const dayOfWeek = cursor.getUTCDay(); // 0=Sun, 6=Sat
    const dateStr = cursor.toISOString().slice(0, 10);
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidayDates.has(dateStr)) {
      count++;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return count;
}

/**
 * Compute the compliance countdown for a given employee.
 * Returns the smallest working-day window across all unacknowledged SOPs.
 * Only returns `active: true` when the nearest lock is within 5 working days.
 */
export async function workingDaysUntilLock(employeeId: string): Promise<ComplianceCountdownResult> {
  const empty: ComplianceCountdownResult = { active: false, workingDaysLeft: 999, items: [] };

  try {
    // Grace days from system_settings (default 15 if not set)
    const graceSetting = await storage.getSystemSetting("governance_sop_grace_days");
    const graceDays: number = parseInt(String(graceSetting?.value ?? "15"), 10) || 15;

    const todayStr = new Date().toISOString().slice(0, 10);

    // Load public (non-optional) holidays in the next 30 days to build exclusion set
    const inFuture30 = new Date();
    inFuture30.setDate(inFuture30.getDate() + 30);
    const futureDateStr = inFuture30.toISOString().slice(0, 10);

    const holidayRows = (await db.execute(sql`
      SELECT date FROM holidays
      WHERE date >= ${todayStr}
        AND date <= ${futureDateStr}
        AND is_optional = false
    `)).rows as Array<{ date: string }>;
    const holidayDates = new Set(holidayRows.map(h => String(h.date)));

    // Find unacknowledged SOPs for this employee that are within or approaching their grace window
    const sopRows = (await db.execute(sql`
      SELECT
        sep.sop_master_id,
        sep.id AS progress_id,
        sd.code,
        sd.title,
        ws.operational_at,
        COALESCE(sep.deadline_at::date, ws.operational_at::date + (${graceDays} || ' days')::interval)::date AS lock_date
      FROM sop_employee_progress sep
      JOIN wave_sops ws ON ws.sop_master_id = sep.sop_master_id
      JOIN sop_documents sd ON sd.sop_master_id = sep.sop_master_id AND sd.is_current = true
      WHERE sep.user_id = ${employeeId}
        AND sep.acknowledged_at IS NULL
        AND ws.operational_at IS NOT NULL
      ORDER BY lock_date ASC
    `)).rows as Array<{
      sop_master_id: string;
      progress_id: string;
      code: string;
      title: string;
      operational_at: string;
      lock_date: string;
    }>;

    if (sopRows.length === 0) return empty;

    const items: CountdownItem[] = [];

    for (const row of sopRows) {
      const lockDateStr = String(row.lock_date).slice(0, 10);

      // Skip if lock date is in the past (already overdue — handled by compliance lock)
      if (lockDateStr <= todayStr) continue;

      const calendarDays = Math.ceil(
        (new Date(lockDateStr + "T12:00:00Z").getTime() - new Date(todayStr + "T12:00:00Z").getTime()) /
        86400000
      );

      const workingDays = countWorkingDaysBetween(todayStr, lockDateStr, holidayDates);

      // Only surface SOPs within the 5-working-day window
      if (workingDays > 5) continue;

      items.push({
        sopMasterId: String(row.sop_master_id),
        sopCode: String(row.code),
        title: String(row.title),
        estimatedMinutes: 8, // fixed estimate; can be enhanced with word-count in future
        daysUntilLockCalendar: calendarDays,
      });
    }

    if (items.length === 0) return empty;

    // Smallest workingDays across all items
    const nearest = items.reduce((min, item) =>
      item.daysUntilLockCalendar < min.daysUntilLockCalendar ? item : min
    );

    const nearestWorkingDays = countWorkingDaysBetween(
      todayStr,
      new Date(new Date(todayStr + "T12:00:00Z").getTime() + nearest.daysUntilLockCalendar * 86400000)
        .toISOString().slice(0, 10),
      holidayDates,
    );

    return {
      active: true,
      workingDaysLeft: nearestWorkingDays,
      items,
    };
  } catch (err) {
    console.error("[complianceCountdown] workingDaysUntilLock failed:", err);
    return empty;
  }
}

/**
 * Fire the manager 3-working-day alert if not already sent today.
 * Uses system_settings as a dedup guard (one alert per employee per calendar day).
 */
export async function maybeSendManagerCountdownAlert(
  employeeId: string,
  employeeName: string,
  managerId: string | null,
  workingDaysLeft: number,
): Promise<void> {
  if (!managerId || workingDaysLeft !== 3) return;

  try {
    const dedupKey = `compliance_manager_alert_${employeeId}_${new Date().toISOString().slice(0, 10)}`;
    const alreadySent = await storage.getSystemSetting(dedupKey);
    if (alreadySent) return;

    const portalBase = getPortalBaseUrl();
    await notifyUser({
      userId: managerId,
      type: "compliance_manager_alert",
      title: `Compliance Task Due in 3 Days — ${employeeName}`,
      message: `${employeeName} has a SOP acknowledgment due in 3 working days. Please prompt them to complete it before their portal access is restricted.`,
      metadata: {
        employeeId,
        employeeName,
        workingDaysLeft: 3,
        ctaPath: `${portalBase}/admin/my-desk?tab=my-sops`,
      },
    });

    // Mark as sent for today (TTL: 24h, stored as timestamp string)
    await storage.upsertSystemSetting(dedupKey, new Date().toISOString());
  } catch (err) {
    console.error("[complianceCountdown] maybySendManagerCountdownAlert failed:", err);
  }
}
