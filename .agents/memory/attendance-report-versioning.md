---
name: Attendance report versioning & auto-sync
description: How monthly attendance report runs are versioned, auto-synced, and gated against payroll.
---

# Attendance report versioning & auto-sync

`attendance_report_runs` has NO unique constraint on (month, year). Versioning model:
multiple rows per (month, year); exactly one has `is_active=true` = the current version.
`version` increments per regeneration; retired versions keep `is_active=false` as immutable history.

**Why:** duplicate pending runs already existed in prod (two June 2026 rows); a unique
constraint would have failed to apply. Multi-row-one-active also gives free version history
without a separate table.

**How to apply:**
- Every read/lock/gate query against `attendance_report_runs` MUST filter `is_active = true`
  and `ORDER BY version DESC, created_at DESC LIMIT 1`. Missing the filter silently reads a
  retired version. Touched call sites live in routes.ts (reg-lock checks, salary-gate, salary
  generate, salary approve) and attendanceReport.ts / attendanceReportRoutes.ts.
- Auto-sync (`reconcileRunEntries`) is strictly ADDITIVE and safe to call on every read of an
  OPEN run (skips approved/overridden/deadline_expired). It heals empty runs and adds
  newly-joined/activated eligible employees; it never edits or removes existing entries
  (manager corrections preserved). It bumps `auto_added_total` + `last_synced_at`. Eligibility =
  `is_active AND deleted_at IS NULL AND attendance_exempt=false`.
- Regeneration is governed: past months allowed (not future), comment REQUIRED, blocked when
  payroll is finalized = attendance approved AND an `approved` salary_report_runs row exists.
  Regenerating flags any `pending_approval` salary run for that month with
  `adjustments._attendanceSuperseded`; the salary approve endpoint refuses (code
  ATTENDANCE_SUPERSEDED) until the salary run is regenerated.
