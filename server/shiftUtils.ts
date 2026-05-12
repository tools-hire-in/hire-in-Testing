import { db } from "./db";
import { sql } from "drizzle-orm";

export interface ShiftTiming {
  shiftId: string;
  istStart: string;
  istEnd: string;
  isDst: boolean;
  scheduledHours: number;
  gracePeriodMinutes: number;
}

/** Return today's date string in IST (UTC+5:30) to avoid UTC boundary errors on DST transition days. */
function todayIST(): { todayStr: string; year: number } {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(Date.now() + IST_OFFSET_MS);
  const todayStr = istDate.toISOString().slice(0, 10);
  const year = parseInt(todayStr.slice(0, 4), 10);
  return { todayStr, year };
}

export async function getCurrentShiftTiming(shiftId: string): Promise<ShiftTiming | null> {
  const { todayStr, year } = todayIST();

  const dstRows = await db.execute(sql`
    SELECT spring_forward_date, fall_back_date
    FROM dst_config
    WHERE year = ${year}
    LIMIT 1
  `);

  let isDst = false;
  if (dstRows.rows.length > 0) {
    const row = dstRows.rows[0] as { spring_forward_date: string; fall_back_date: string };
    isDst = todayStr >= row.spring_forward_date && todayStr < row.fall_back_date;
  }

  const shiftRows = await db.execute(sql`
    SELECT id, ist_start_dst, ist_end_dst, ist_start_std, ist_end_std,
           scheduled_hours, grace_period_minutes
    FROM shifts
    WHERE id = ${shiftId} AND is_active = true
    LIMIT 1
  `);

  if (shiftRows.rows.length === 0) return null;

  const shift = shiftRows.rows[0] as {
    id: string;
    ist_start_dst: string;
    ist_end_dst: string;
    ist_start_std: string;
    ist_end_std: string;
    scheduled_hours: number;
    grace_period_minutes: number | null;
  };

  return {
    shiftId: shift.id,
    istStart: isDst ? shift.ist_start_dst : shift.ist_start_std,
    istEnd: isDst ? shift.ist_end_dst : shift.ist_end_std,
    isDst,
    scheduledHours: shift.scheduled_hours ?? 9,
    gracePeriodMinutes: shift.grace_period_minutes ?? 15,
  };
}

interface ShiftRow {
  id: string;
  name: string;
  display_label: string;
  us_coverage: string;
  ist_start_dst: string;
  ist_end_dst: string;
  ist_start_std: string;
  ist_end_std: string;
  scheduled_hours: number;
  grace_period_minutes: number | null;
  is_active: boolean;
}

export async function getAllShiftsWithTiming() {
  const { todayStr, year } = todayIST();

  const dstRows = await db.execute(sql`
    SELECT spring_forward_date, fall_back_date FROM dst_config WHERE year = ${year} LIMIT 1
  `);

  let isDst = false;
  if (dstRows.rows.length > 0) {
    const row = dstRows.rows[0] as { spring_forward_date: string; fall_back_date: string };
    isDst = todayStr >= row.spring_forward_date && todayStr < row.fall_back_date;
  }

  const shiftRows = await db.execute(sql`
    SELECT id, name, display_label, us_coverage,
           ist_start_dst, ist_end_dst, ist_start_std, ist_end_std,
           scheduled_hours, grace_period_minutes, is_active
    FROM shifts
    WHERE is_active = true
    ORDER BY id
  `);

  return (shiftRows.rows as ShiftRow[]).map(s => ({
    id: s.id,
    name: s.name,
    displayLabel: s.display_label,
    usCoverage: s.us_coverage,
    istStart: isDst ? s.ist_start_dst : s.ist_start_std,
    istEnd: isDst ? s.ist_end_dst : s.ist_end_std,
    istStartDst: s.ist_start_dst,
    istEndDst: s.ist_end_dst,
    istStartStd: s.ist_start_std,
    istEndStd: s.ist_end_std,
    scheduledHours: s.scheduled_hours,
    gracePeriodMinutes: s.grace_period_minutes ?? 15,
    isDst,
  }));
}

/**
 * Determine IST time-of-day in minutes from midnight for a given UTC Date object.
 * Returns the number of minutes elapsed since 00:00 IST.
 */
export function utcToIstMinutes(utcDate: Date): number {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const istMs = utcDate.getTime() + IST_OFFSET_MS;
  const istDate = new Date(istMs);
  return istDate.getUTCHours() * 60 + istDate.getUTCMinutes();
}

/**
 * Parse an HH:MM shift-start string into minutes from midnight.
 */
export function shiftTimeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
