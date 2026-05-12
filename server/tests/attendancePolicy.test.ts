/**
 * Attendance Policy Integration Tests
 * Run: npx tsx --test server/tests/attendancePolicy.test.ts
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import request from "supertest";

import {
  computeLateStatus,
  computeHalfDayStatus,
  isRegularisationAllowed,
  countWorkingDaysBack,
  queryGraceUsage,
} from "../attendancePolicy.js";
import { getCurrentShiftTiming } from "../shiftUtils.js";
import { runAbsentSweep } from "../scheduler.js";
import { requireRole, requireAuth } from "../auth.js";
import { storage } from "../storage.js";
import { db } from "../db.js";
import { sql } from "drizzle-orm";

// --- Constants ---

const TEST_DATE        = "2020-01-06"; // Monday
const PUNCH_TEST_DATE  = "2020-02-03"; // Monday (separate date for punch tests)
const TEST_MONTH       = "2020-01";

const REAL_SHIFT_ID      = "SHIFT_A";
const OVERNIGHT_SHIFT_ID = "TEST_OVERNIGHT_2359";
const NULL_GRACE_SHIFT   = "TEST_NULL_GRACE_SHIFT";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const MGR_ID   = "922352aa-6baa-49db-8e7d-358eb6654a3d";
const MGR_TEAM = [
  "e2c817b3-0921-4034-be9d-ec02642f125f",
  "a97336cb-65b9-450c-b021-769704f9e33a",
  "4a9dc086-da42-4e03-9785-95dfad6a5fc6",
];

const LEAVE_TYPE_ID = "aad652c5-ef0f-4cb3-834f-9c8f179ec947";
const PUNCH_USER_ID = "e2c817b3-0921-4034-be9d-ec02642f125f";

// --- Helpers ---

async function cleanAttendance(userId: string, date: string) {
  await db.execute(sql`DELETE FROM attendance WHERE user_id = ${userId} AND date = ${date}`);
}

async function insertLateRecord(userId: string, date: string) {
  await db.execute(sql`
    INSERT INTO attendance (user_id, date, punch_in, status, notes, created_at)
    VALUES (${userId}, ${date}, ${new Date("2020-01-06T14:16:00Z").toISOString()},
            'late', '[Test] late record', NOW())
    ON CONFLICT DO NOTHING
  `);
}

async function findEligibleUser(): Promise<string | null> {
  const r = await db.execute(sql`
    SELECT id FROM admin_users
    WHERE is_active = true AND deleted_at IS NULL
      AND employment_status = 'active' AND attendance_exempt = false
    LIMIT 1
  `);
  return r.rows.length > 0 ? (r.rows[0] as { id: string }).id : null;
}

// Convert an IST minute-of-day to UTC anchored on 2026-01-05 (a regular weekday)
function istMinToUTC(istMinOfDay: number): Date {
  const dayMs = new Date("2026-01-05T00:00:00Z").getTime();
  return new Date(dayMs + (istMinOfDay % 1440) * 60_000 - IST_OFFSET_MS);
}

// --- Suite 1: computeLateStatus — real DB SHIFT_A, DST-agnostic, null-grace ---

describe("computeLateStatus — SHIFT_A, DST-agnostic + null-grace fallback", () => {
  let graceEndIST = "";
  let punchWithin: Date;
  let punchLate: Date;
  let punchEarly: Date;
  let punchExact: Date;

  before(async () => {
    const timing = await getCurrentShiftTiming(REAL_SHIFT_ID);
    assert.ok(timing, "SHIFT_A must be active in the DB");
    const [sh, sm] = timing.istStart.split(":").map(Number);
    const startMin = sh * 60 + sm;
    const graceEnd = startMin + timing.gracePeriodMinutes;
    const norm     = graceEnd % 1440;
    graceEndIST    = `${String(Math.floor(norm / 60)).padStart(2, "0")}:${String(norm % 60).padStart(2, "0")}`;
    punchWithin    = istMinToUTC(norm - 5);
    punchLate      = istMinToUTC(norm + 1);
    punchEarly     = istMinToUTC(startMin - 10);
    punchExact     = istMinToUTC(norm);

    await db.execute(sql`
      INSERT INTO shifts (id, name, display_label, us_coverage,
        ist_start_std, ist_end_std, ist_start_dst, ist_end_dst,
        scheduled_hours, grace_period_minutes, is_active)
      VALUES (${NULL_GRACE_SHIFT}, ${NULL_GRACE_SHIFT}, 'Test Null Grace', 'N/A',
              '09:00', '18:00', '09:00', '18:00', 9, NULL, true)
      ON CONFLICT (id) DO UPDATE SET grace_period_minutes = NULL, is_active = true
    `);
  });

  after(async () => {
    await db.execute(sql`DELETE FROM shifts WHERE id = ${NULL_GRACE_SHIFT}`);
  });

  it("punch 5 min before grace end → present", async () => {
    const r = await computeLateStatus(REAL_SHIFT_ID, punchWithin);
    assert.ok(r !== null);
    assert.equal(r!.status, "present");
    assert.ok(r!.notes.includes(graceEndIST), `got: ${r!.notes}`);
  });

  it("punch 1 min after grace end → late", async () => {
    const r = await computeLateStatus(REAL_SHIFT_ID, punchLate);
    assert.ok(r !== null);
    assert.equal(r!.status, "late");
    assert.ok(r!.notes.startsWith("[Auto]"));
    assert.ok(r!.notes.includes(graceEndIST), `got: ${r!.notes}`);
  });

  it("punch 10 min before shift start → present", async () => {
    const r = await computeLateStatus(REAL_SHIFT_ID, punchEarly);
    assert.ok(r !== null);
    assert.equal(r!.status, "present");
  });

  it("punch exactly at grace end → present (boundary inclusive)", async () => {
    const r = await computeLateStatus(REAL_SHIFT_ID, punchExact);
    assert.ok(r !== null);
    assert.equal(r!.status, "present");
  });

  it("unknown shift ID → null", async () => {
    assert.equal(await computeLateStatus("NONEXISTENT_SHIFT_XYZ", new Date()), null);
  });

  it("notes contain HH:MM time", async () => {
    const r = await computeLateStatus(REAL_SHIFT_ID, punchWithin);
    assert.ok(r !== null);
    assert.match(r!.notes, /\d{2}:\d{2}/);
  });

  it("null grace_period_minutes falls back to 15-min default → present inside", async () => {
    const punchInside = istMinToUTC(9 * 60 + 10); // 09:10 IST, within 09:15 default grace
    const r = await computeLateStatus(NULL_GRACE_SHIFT, punchInside);
    assert.ok(r !== null);
    assert.equal(r!.status, "present");
    assert.ok(r!.notes.includes("09:15"), `got: ${r!.notes}`);
  });

  it("null grace: punch 1 min past 15-min default → late", async () => {
    const punchPast = istMinToUTC(9 * 60 + 16); // 09:16 IST
    const r = await computeLateStatus(NULL_GRACE_SHIFT, punchPast);
    assert.ok(r !== null);
    assert.equal(r!.status, "late");
  });
});

// --- Suite 2: computeHalfDayStatus — real DB SHIFT_A ---

describe("computeHalfDayStatus — SHIFT_A (9h scheduled, 4.5h threshold)", () => {
  it("3h worked → half_day", async () => {
    const r = await computeHalfDayStatus(REAL_SHIFT_ID, 3, "present");
    assert.equal(r.status, "half_day");
    assert.ok(r.notes?.startsWith("[Auto]"));
    assert.ok(r.notes?.includes("4.5h"));
  });

  it("exactly at threshold (4.5h) → no change", async () => {
    const r = await computeHalfDayStatus(REAL_SHIFT_ID, 4.5, "present");
    assert.equal(r.status, "present");
    assert.equal(r.notes, undefined);
  });

  it("8h worked → present", async () => {
    assert.equal((await computeHalfDayStatus(REAL_SHIFT_ID, 8, "present")).status, "present");
  });

  it("late + 2h → half_day", async () => {
    assert.equal((await computeHalfDayStatus(REAL_SHIFT_ID, 2, "late")).status, "half_day");
  });

  it("on_leave not overridden", async () => {
    const r = await computeHalfDayStatus(REAL_SHIFT_ID, 0, "on_leave");
    assert.equal(r.status, "on_leave");
    assert.equal(r.notes, undefined);
  });

  it("absent not overridden", async () => {
    assert.equal((await computeHalfDayStatus(REAL_SHIFT_ID, 0, "absent")).status, "absent");
  });

  it("holiday not overridden", async () => {
    assert.equal((await computeHalfDayStatus(REAL_SHIFT_ID, 0, "holiday")).status, "holiday");
  });

  it("4h29m → half_day", async () => {
    assert.equal(
      (await computeHalfDayStatus(REAL_SHIFT_ID, (4 * 60 + 29) / 60, "present")).status,
      "half_day",
    );
  });

  it("unknown shift → status unchanged", async () => {
    assert.equal(
      (await computeHalfDayStatus("NONEXISTENT_SHIFT_XYZ", 1, "present")).status,
      "present",
    );
  });
});

// --- Suite 3: Overnight midnight-wrap fix ---

describe("Overnight late-marking fix — graceEnd >= 1440 (real DB temp shift)", () => {
  // Shift 23:50 IST, grace=15 → graceEnd=1445 → graceEndNorm=5 (00:05 next day)
  before(async () => {
    await db.execute(sql`
      INSERT INTO shifts (id, name, display_label, us_coverage,
        ist_start_std, ist_end_std, ist_start_dst, ist_end_dst,
        scheduled_hours, grace_period_minutes, is_active)
      VALUES (${OVERNIGHT_SHIFT_ID}, ${OVERNIGHT_SHIFT_ID}, 'Test Overnight', 'N/A',
              '23:50', '08:50', '23:50', '08:50', 9, 15, true)
      ON CONFLICT (id) DO UPDATE SET
        ist_start_std='23:50', ist_end_std='08:50',
        ist_start_dst='23:50', ist_end_dst='08:50',
        grace_period_minutes=15, is_active=true
    `);
  });

  after(async () => {
    await db.execute(sql`DELETE FROM shifts WHERE id = ${OVERNIGHT_SHIFT_ID}`);
  });

  it("23:55 IST (within 15-min grace) → present", async () => {
    // 23:55 IST = 18:25 UTC
    const r = await computeLateStatus(OVERNIGHT_SHIFT_ID, new Date("2026-01-05T18:25:00Z"));
    assert.ok(r !== null);
    assert.equal(r!.status, "present");
  });

  it("00:06 IST next day (1 min past grace 00:05) → late", async () => {
    // 00:06 IST 2026-01-06 = 18:36 UTC 2026-01-05
    const r = await computeLateStatus(OVERNIGHT_SHIFT_ID, new Date("2026-01-05T18:36:00Z"));
    assert.ok(r !== null);
    assert.equal(r!.status, "late");
  });

  it("00:04 IST next day (before grace end 00:05) → present", async () => {
    // 00:04 IST 2026-01-06 = 18:34 UTC 2026-01-05
    const r = await computeLateStatus(OVERNIGHT_SHIFT_ID, new Date("2026-01-05T18:34:00Z"));
    assert.ok(r !== null);
    assert.equal(r!.status, "present");
  });

  it("20:00 IST same-day (pre-shift evening) → present (not late)", async () => {
    // 20:00 IST 2026-01-05 = 14:30 UTC 2026-01-05 — before tonight's 23:50 shift
    const r = await computeLateStatus(OVERNIGHT_SHIFT_ID, new Date("2026-01-05T14:30:00Z"));
    assert.ok(r !== null);
    assert.equal(r!.status, "present",
      "pre-shift evening punch for overnight shift must not be marked late");
  });

  it("notes show normalised 00:05, not 24:05", async () => {
    const r = await computeLateStatus(OVERNIGHT_SHIFT_ID, new Date("2026-01-05T18:25:00Z"));
    assert.ok(r !== null);
    assert.ok(r!.notes.includes("00:05"), `got: ${r!.notes}`);
    assert.ok(!r!.notes.includes("24:"), `must not contain 24:xx; got: ${r!.notes}`);
  });
});

// --- Suite 4: Regularisation window — pure logic ---

describe("isRegularisationAllowed / countWorkingDaysBack — 3 working-day window", () => {
  const TODAY = "2026-01-12"; // Monday

  it("today → allowed",                  () => assert.ok(isRegularisationAllowed(TODAY, TODAY)));
  it("Fri 2026-01-09 → allowed (1 wd)",  () => assert.ok(isRegularisationAllowed("2026-01-09", TODAY)));
  it("Wed 2026-01-07 → allowed (3 wd)",  () => assert.ok(isRegularisationAllowed("2026-01-07", TODAY)));
  it("Tue 2026-01-06 → rejected (4 wd)", () => assert.ok(!isRegularisationAllowed("2026-01-06", TODAY)));
  it("future date → rejected",           () => assert.ok(!isRegularisationAllowed("2026-01-20", TODAY)));
  it("Sat 2026-01-10 → allowed (0 wd)",  () => assert.ok(isRegularisationAllowed("2026-01-10", TODAY)));
  it("Wed→Mon = 3",  () => assert.equal(countWorkingDaysBack("2026-01-07", TODAY), 3));
  it("Tue→Mon = 4",  () => assert.equal(countWorkingDaysBack("2026-01-06", TODAY), 4));
  it("same day = 0", () => assert.equal(countWorkingDaysBack(TODAY, TODAY), 0));
  it("future = -1",  () => assert.equal(countWorkingDaysBack("2026-01-20", TODAY), -1));
});

// --- Suite 5: runAbsentSweep — weekend, holiday, approved leave, exempt, dup ---

describe("runAbsentSweep — weekend, holiday, approved leave, exempt, duplicate", () => {
  let eligibleId: string | null = null;
  const HOLIDAY_ID   = "test-holiday-2020-01-06";
  const LEAVE_REQ_ID = "test-leave-req-2020-01-06";

  before(async () => {
    eligibleId = await findEligibleUser();
    if (eligibleId) await cleanAttendance(eligibleId, TEST_DATE);
  });

  after(async () => {
    if (eligibleId) await cleanAttendance(eligibleId, TEST_DATE);
    await db.execute(sql`DELETE FROM holidays WHERE id = ${HOLIDAY_ID}`);
    await db.execute(sql`DELETE FROM leave_requests WHERE id = ${LEAVE_REQ_ID}`);
    if (eligibleId) {
      await db.execute(sql`UPDATE admin_users SET attendance_exempt = false WHERE id = ${eligibleId}`);
    }
  });

  it("Saturday (2020-01-04) → skippedWeekend=true, created=0", async () => {
    const r = await runAbsentSweep("2020-01-04");
    assert.ok(r.skippedWeekend);
    assert.equal(r.created, 0);
  });

  it("public holiday on TEST_DATE → skippedHoliday, no absent records", async () => {
    await db.execute(sql`
      INSERT INTO holidays (id, name, date, type, is_optional)
      VALUES (${HOLIDAY_ID}, 'Test Holiday', ${TEST_DATE}, 'national', false)
      ON CONFLICT (id) DO NOTHING
    `);
    const r = await runAbsentSweep(TEST_DATE);
    assert.ok(r.skippedHoliday);
    assert.equal(r.created, 0);
    await db.execute(sql`DELETE FROM holidays WHERE id = ${HOLIDAY_ID}`);
  });

  it("approved leave → user skipped, no absent record", async () => {
    if (!eligibleId) return;
    await cleanAttendance(eligibleId, TEST_DATE);
    await db.execute(sql`
      INSERT INTO leave_requests
        (id, user_id, leave_type_id, start_date, end_date, total_days, reason, status, created_at)
      VALUES (${LEAVE_REQ_ID}, ${eligibleId}, ${LEAVE_TYPE_ID},
              ${TEST_DATE}, ${TEST_DATE}, 1, 'Test leave', 'approved', NOW())
      ON CONFLICT (id) DO NOTHING
    `);
    await runAbsentSweep(TEST_DATE, true);
    const rows = await db.execute(sql`
      SELECT id FROM attendance WHERE user_id = ${eligibleId} AND date = ${TEST_DATE}
    `);
    assert.equal(rows.rows.length, 0, "user on approved leave must not get an absent record");
    await db.execute(sql`DELETE FROM leave_requests WHERE id = ${LEAVE_REQ_ID}`);
  });

  it("attendance-exempt user excluded from sweep", async () => {
    if (!eligibleId) return;
    await cleanAttendance(eligibleId, TEST_DATE);
    await db.execute(sql`UPDATE admin_users SET attendance_exempt = true WHERE id = ${eligibleId}`);
    try {
      await runAbsentSweep(TEST_DATE, true);
      const rows = await db.execute(sql`
        SELECT id FROM attendance WHERE user_id = ${eligibleId} AND date = ${TEST_DATE}
      `);
      assert.equal(rows.rows.length, 0);
    } finally {
      await db.execute(sql`UPDATE admin_users SET attendance_exempt = false WHERE id = ${eligibleId}`);
    }
  });

  it("Monday skipGuards=true → creates absent record", async () => {
    if (!eligibleId) return;
    await cleanAttendance(eligibleId, TEST_DATE);
    const result = await runAbsentSweep(TEST_DATE, true);
    assert.ok(result.created >= 1);
    const post = await db.execute(sql`
      SELECT status, notes FROM attendance WHERE user_id = ${eligibleId} AND date = ${TEST_DATE}
    `);
    const row = post.rows[0] as { status: string; notes: string };
    assert.equal(row.status, "absent");
    assert.ok(row.notes?.includes("[Auto]"));
  });

  it("re-running same date → idempotent (no duplicate)", async () => {
    if (!eligibleId) return;
    const result = await runAbsentSweep(TEST_DATE, true);
    assert.ok(result.created === 0 || result.skipped >= 1);
    const rows = await db.execute(sql`
      SELECT id FROM attendance WHERE user_id = ${eligibleId} AND date = ${TEST_DATE}
    `);
    assert.equal(rows.rows.length, 1);
  });

  it("result shape has {date, created, skipped}", async () => {
    const r = await runAbsentSweep(TEST_DATE, true);
    assert.ok("date" in r && "created" in r && "skipped" in r);
    assert.equal(r.date, TEST_DATE);
  });
});

// --- Suite 6: queryGraceUsage — real DB inserts, manager scoping ---

describe("queryGraceUsage — real DB inserts, manager scoping, empty-month", () => {
  before(async () => {
    for (const uid of MGR_TEAM) {
      await cleanAttendance(uid, TEST_DATE);
      await insertLateRecord(uid, TEST_DATE);
    }
  });

  after(async () => {
    for (const uid of MGR_TEAM) await cleanAttendance(uid, TEST_DATE);
  });

  it("HR sees all late records in TEST_MONTH", async () => {
    const rows = await queryGraceUsage("hr", "any-caller", TEST_MONTH);
    for (const uid of MGR_TEAM) {
      const match = rows.find((r) => r.userId === uid);
      assert.ok(match, `HR must see late record for ${uid}`);
      assert.ok(match!.lateCount >= 1);
    }
  });

  it("manager sees only own direct reports", async () => {
    const rows = await queryGraceUsage("manager", MGR_ID, TEST_MONTH);
    assert.equal(rows.length, MGR_TEAM.length);
    for (const row of rows) {
      assert.ok(MGR_TEAM.includes(row.userId), `unexpected user ${row.userId}`);
    }
  });

  it("manager result does not include themselves", async () => {
    const ids = (await queryGraceUsage("manager", MGR_ID, TEST_MONTH)).map((r) => r.userId);
    assert.ok(!ids.includes(MGR_ID));
  });

  it("results sorted by lateCount DESC", async () => {
    const counts = (await queryGraceUsage("hr", "any-caller", TEST_MONTH)).map((r) => r.lateCount);
    assert.deepEqual(counts, [...counts].sort((a, b) => b - a));
  });

  it("each row has all required fields", async () => {
    const rows = await queryGraceUsage("hr", "any-caller", TEST_MONTH);
    const row  = rows.find((r) => MGR_TEAM.includes(r.userId));
    assert.ok(row);
    for (const key of ["userId", "firstName", "email", "lateCount", "department", "shift"] as const) {
      assert.ok(key in row!);
    }
  });

  it("month with no records returns []", async () => {
    assert.deepEqual(await queryGraceUsage("hr", "any-caller", "2000-01"), []);
  });
});

// --- Suite 7: Grace-usage HTTP — real requireRole + real queryGraceUsage ---

describe("Grace-usage HTTP — real requireRole + real queryGraceUsage", () => {
  function buildApp(userId: string, role: string) {
    const app = express();
    app.use(express.json());
    app.use((req: Request, _res: Response, next: NextFunction) => {
      (req as any).session = { userId, role };
      next();
    });
    app.get(
      "/api/hr/attendance/grace-usage",
      requireRole("hr", "admin", "super_admin", "manager"),
      async (req: Request, res: Response) => {
        try {
          const s = (req as any).session as { userId: string; role: string };
          res.json(await queryGraceUsage(s.role, s.userId, TEST_MONTH));
        } catch {
          res.status(500).json({ error: "internal" });
        }
      },
    );
    return app;
  }

  const unauthApp = express();
  unauthApp.use((req: Request, _r: Response, next: NextFunction) => {
    (req as any).session = {};
    next();
  });
  unauthApp.get("/api/hr/attendance/grace-usage",
    requireAuth,
    requireRole("hr", "admin", "super_admin", "manager"),
    (_req, res) => res.json([]),
  );

  it("unauthenticated → 401", async () => {
    assert.equal(
      (await request(unauthApp).get(`/api/hr/attendance/grace-usage?month=${TEST_MONTH}`)).status,
      401,
    );
  });

  it("employee → 403", async () => {
    assert.equal(
      (await request(buildApp("emp", "employee")).get(`/api/hr/attendance/grace-usage?month=${TEST_MONTH}`)).status,
      403,
    );
  });

  it("hr → 200, array", async () => {
    const r = await request(buildApp("hr-user", "hr")).get(`/api/hr/attendance/grace-usage?month=${TEST_MONTH}`);
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.body));
  });

  it("admin → 200", async () => {
    assert.equal(
      (await request(buildApp("admin-user", "admin")).get(`/api/hr/attendance/grace-usage?month=${TEST_MONTH}`)).status,
      200,
    );
  });

  it("super_admin → 200", async () => {
    assert.equal(
      (await request(buildApp("sa-user", "super_admin")).get(`/api/hr/attendance/grace-usage?month=${TEST_MONTH}`)).status,
      200,
    );
  });

  it("manager sees only own team", async () => {
    for (const uid of MGR_TEAM) {
      await cleanAttendance(uid, TEST_DATE);
      await insertLateRecord(uid, TEST_DATE);
    }
    try {
      const r = await request(buildApp(MGR_ID, "manager")).get(`/api/hr/attendance/grace-usage?month=${TEST_MONTH}`);
      assert.equal(r.status, 200);
      const body = r.body as Array<{ userId: string }>;
      assert.equal(body.length, MGR_TEAM.length);
      for (const row of body) {
        assert.ok(MGR_TEAM.includes(row.userId));
      }
    } finally {
      for (const uid of MGR_TEAM) await cleanAttendance(uid, TEST_DATE);
    }
  });
});

// --- Suite 8: Regularization API — storage.countLeaveDays enforcement ---
//
// Uses the same DB-backed storage.countLeaveDays function as the production
// /api/hr/tickets route — tests the actual enforcement path, not the pure helper.

describe("Regularization window API — real storage.countLeaveDays enforcement", () => {
  function buildRegApp(userId: string) {
    const app = express();
    app.use(express.json());
    app.use((req: Request, _res: Response, next: NextFunction) => {
      (req as any).session = { userId, role: "employee" };
      next();
    });
    app.post("/api/hr/tickets", requireAuth, async (req: Request, res: Response) => {
      const { date, type } = req.body as { date?: string; type?: string };
      if (!date || !type) return res.status(400).json({ error: "date and type required" });
      if (type === "regularization") {
        const todayIST = new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
        if (date > todayIST) {
          return res.status(400).json({ error: "Regularisation date cannot be in the future" });
        }
        if (date < todayIST) {
          const workingDays = await storage.countLeaveDays(date, todayIST);
          const daysBack    = workingDays - 1;
          if (daysBack > 3) {
            return res.status(400).json({
              error: "Regularisation must be raised within 3 working days of the incident",
              daysBack,
              cutoffExceeded: true,
            });
          }
        }
      }
      res.status(201).json({ ok: true });
    });
    return app;
  }

  const regApp = buildRegApp("some-employee-id");

  it("date 10+ working days back → 400 cutoffExceeded (real storage.countLeaveDays)", async () => {
    const r = await request(regApp)
      .post("/api/hr/tickets")
      .send({ date: "2000-01-01", type: "regularization" });
    assert.equal(r.status, 400);
    assert.ok(r.body.cutoffExceeded === true);
    assert.ok(r.body.daysBack > 3);
  });

  it("future date → 400 future guard", async () => {
    const future = new Date(Date.now() + IST_OFFSET_MS + 86400_000).toISOString().slice(0, 10);
    const r = await request(regApp)
      .post("/api/hr/tickets")
      .send({ date: future, type: "regularization" });
    assert.equal(r.status, 400);
    assert.ok(r.body.error?.toLowerCase().includes("future"));
  });

  it("today's date → 201", async () => {
    const todayIST = new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
    const r = await request(regApp)
      .post("/api/hr/tickets")
      .send({ date: todayIST, type: "regularization" });
    assert.equal(r.status, 201);
  });

  it("unauthenticated → 401", async () => {
    const app = express();
    app.use(express.json());
    app.use((req: Request, _r: Response, next: NextFunction) => {
      (req as any).session = {};
      next();
    });
    app.post("/api/hr/tickets", requireAuth, (_req, res) => res.json({}));
    assert.equal(
      (await request(app).post("/api/hr/tickets").send({ date: "2000-01-01", type: "regularization" })).status,
      401,
    );
  });

  it("non-regularization type with old date → 201 (not gated)", async () => {
    const r = await request(regApp)
      .post("/api/hr/tickets")
      .send({ date: "2000-01-01", type: "punch_correction" });
    assert.equal(r.status, 201);
  });
});

// --- Suite 9: Punch-in / Punch-out API — real storage + policy integration ---
//
// Thin test routes that call the same functions as the production punch routes
// (computeLateStatus → storage.createAttendance, computeHalfDayStatus → storage.updateAttendance)
// with a controllable punchTime + date parameter so tests are deterministic.

describe("Punch-in / Punch-out API — real storage + computeLateStatus/HalfDay", () => {
  let punchLateIST: Date;  // guaranteed past SHIFT_A grace end → 'late'
  let punchEarlyIST: Date; // guaranteed before SHIFT_A shift start → 'present'

  before(async () => {
    const timing = await getCurrentShiftTiming(REAL_SHIFT_ID);
    assert.ok(timing, "SHIFT_A must be present in DB");
    const [sh, sm] = timing.istStart.split(":").map(Number);
    const startMin = sh * 60 + sm;
    const graceEnd = (startMin + timing.gracePeriodMinutes) % 1440;
    punchLateIST  = istMinToUTC(graceEnd + 5);  // 5 min past grace → late
    punchEarlyIST = istMinToUTC(startMin - 10); // 10 min before start → present
    await cleanAttendance(PUNCH_USER_ID, PUNCH_TEST_DATE);
  });

  after(async () => {
    await cleanAttendance(PUNCH_USER_ID, PUNCH_TEST_DATE);
  });

  function buildPunchApp() {
    const app = express();
    app.use(express.json());
    app.use((req: Request, _res: Response, next: NextFunction) => {
      (req as any).session = { userId: PUNCH_USER_ID, role: "employee" };
      next();
    });

    app.post("/test/punch-in", requireAuth, async (req: Request, res: Response) => {
      const { shiftId, punchTime: ptStr, date } = req.body as {
        shiftId?: string; punchTime?: string; date?: string;
      };
      const punchTime = ptStr ? new Date(ptStr) : new Date();
      const day       = date ?? new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
      const userId    = (req as any).session.userId as string;

      const result = shiftId ? await computeLateStatus(shiftId, punchTime) : null;
      const record = await storage.createAttendance({
        userId,
        date:    day,
        punchIn: punchTime,
        status:  (result?.status ?? "present") as "present" | "late",
        notes:   result?.notes ?? null,
      });
      res.status(201).json(record);
    });

    app.post("/test/punch-out", requireAuth, async (req: Request, res: Response) => {
      const { shiftId, punchOutTime: potStr, date } = req.body as {
        shiftId?: string; punchOutTime?: string; date?: string;
      };
      const punchOut = potStr ? new Date(potStr) : new Date();
      const day      = date ?? new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
      const userId   = (req as any).session.userId as string;

      const rows = await db.execute(sql`
        SELECT id, punch_in, status, notes
        FROM attendance WHERE user_id = ${userId} AND date = ${day} LIMIT 1
      `);
      if (!rows.rows.length) return res.status(400).json({ error: "no punch-in record" });

      type ExistingRow = { id: string; punch_in: string; status: string; notes: string | null };
      const existing      = rows.rows[0] as ExistingRow;
      const punchIn       = existing.punch_in ? new Date(existing.punch_in) : punchOut;
      const totalHoursNum = (punchOut.getTime() - punchIn.getTime()) / (1000 * 60 * 60);
      const totalHours    = totalHoursNum.toFixed(2);

      const halfResult    = shiftId
        ? await computeHalfDayStatus(shiftId, totalHoursNum, existing.status)
        : null;

      const update: { punchOut: Date; totalHours: string; status?: string; notes?: string } = {
        punchOut,
        totalHours,
      };
      if (halfResult && halfResult.status !== existing.status) {
        update.status = halfResult.status;
        update.notes  = (existing.notes ? `${existing.notes}; ` : "") + halfResult.notes;
      }

      const updated = await storage.updateAttendance(existing.id, update as Parameters<typeof storage.updateAttendance>[1]);
      res.status(200).json(updated);
    });

    return app;
  }

  const punchApp = buildPunchApp();

  it("past-grace punch-in → HTTP 201, DB status='late'", async () => {
    await cleanAttendance(PUNCH_USER_ID, PUNCH_TEST_DATE);
    const res = await request(punchApp).post("/test/punch-in").send({
      shiftId: REAL_SHIFT_ID, punchTime: punchLateIST.toISOString(), date: PUNCH_TEST_DATE,
    });
    assert.equal(res.status, 201);
    const rows = await db.execute(sql`
      SELECT status, notes FROM attendance WHERE user_id = ${PUNCH_USER_ID} AND date = ${PUNCH_TEST_DATE}
    `);
    assert.equal(rows.rows.length, 1);
    const row = rows.rows[0] as { status: string; notes: string };
    assert.equal(row.status, "late");
    assert.ok(row.notes?.startsWith("[Auto]"));
  });

  it("immediate punch-out (0 hours) → HTTP 200, DB status='half_day'", async () => {
    const res = await request(punchApp).post("/test/punch-out").send({
      shiftId: REAL_SHIFT_ID, punchOutTime: punchLateIST.toISOString(), date: PUNCH_TEST_DATE,
    });
    assert.equal(res.status, 200);
    const rows = await db.execute(sql`
      SELECT status, notes FROM attendance WHERE user_id = ${PUNCH_USER_ID} AND date = ${PUNCH_TEST_DATE}
    `);
    const row = rows.rows[0] as { status: string; notes: string };
    assert.equal(row.status, "half_day");
    assert.ok(row.notes?.includes("[Auto]"));
  });

  it("punch-out without prior punch-in → 400", async () => {
    await cleanAttendance(PUNCH_USER_ID, PUNCH_TEST_DATE);
    const res = await request(punchApp).post("/test/punch-out").send({
      shiftId: REAL_SHIFT_ID, punchOutTime: punchLateIST.toISOString(), date: PUNCH_TEST_DATE,
    });
    assert.equal(res.status, 400);
  });

  it("early punch-in (before shift start) → DB status='present'", async () => {
    await cleanAttendance(PUNCH_USER_ID, PUNCH_TEST_DATE);
    const res = await request(punchApp).post("/test/punch-in").send({
      shiftId: REAL_SHIFT_ID, punchTime: punchEarlyIST.toISOString(), date: PUNCH_TEST_DATE,
    });
    assert.equal(res.status, 201);
    const rows = await db.execute(sql`
      SELECT status FROM attendance WHERE user_id = ${PUNCH_USER_ID} AND date = ${PUNCH_TEST_DATE}
    `);
    assert.equal((rows.rows[0] as { status: string }).status, "present");
  });

  it("punch-out after 6h → status stays 'present' (> 4.5h threshold)", async () => {
    const sixHrsLater = new Date(punchEarlyIST.getTime() + 6 * 60 * 60 * 1000);
    const res = await request(punchApp).post("/test/punch-out").send({
      shiftId: REAL_SHIFT_ID, punchOutTime: sixHrsLater.toISOString(), date: PUNCH_TEST_DATE,
    });
    assert.equal(res.status, 200);
    const rows = await db.execute(sql`
      SELECT status FROM attendance WHERE user_id = ${PUNCH_USER_ID} AND date = ${PUNCH_TEST_DATE}
    `);
    assert.equal((rows.rows[0] as { status: string }).status, "present");
  });
});
