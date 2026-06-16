---
name: attendance policy engine
description: How late/day-completion status, grace, shiftless handling and the absent sweep fit together.
---

Attendance status is computed in `server/attendancePolicy.ts` and consumed by `server/routes.ts` (punch-in/out) and `server/scheduler.ts` (23:59 IST absent sweep).

- **Grace is read dynamically from each shift's `grace_period_minutes`.** Policy is now no-grace (default 0; one-time migration in `server/index.ts` set all existing shifts to 0, guarded by a `system_settings` marker `grace_zero_applied`). Because tests read grace from the DB, flipping grace to 0 does NOT break the SHIFT_A late suite — only tests that insert their OWN shift with explicit grace assert specific grace windows.
- **`shiftUtils` null-grace fallback `?? 15` is intentionally kept** — a test asserts a shift with NULL grace falls back to 15. Do not remove it; the no-grace policy is expressed by setting grace=0 explicitly, not by changing the fallback.
- **Shiftless active employees must NOT be swept absent.** `runAbsentSweep` skips users with no `shiftId`; the punch-in path converts a blank `[Auto] No punch-in recorded` (or training-non-compliance) absent placeholder into a real present/late row. Any test helper picking an "eligible" user for the sweep must filter `shift_id IS NOT NULL`.
- **Day-completion tiers (part-time aware), thresholds from the employee's OWN shift `scheduled_hours`:** worked `< half` → `half_day`; `>= half and < full` → `short_day`; `>= full` → `present`/`late`. `short_day` is a Postgres enum value added via `ALTER TYPE attendance_status ADD VALUE IF NOT EXISTS` (cannot run in a transaction — run standalone). It must be included anywhere statuses are treated as "present-ish" (stats/reports/UI filters and status maps).

**Why:** A shiftless-employee bug auto-marked active staff absent; the engine has no working window without a shift, so the only correct behavior is to skip them and surface them for shift assignment (Users page banner).
