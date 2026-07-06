---
name: Inline advance management in salary-run approval
description: How advance/adjustment editing works inside the pending salary-run approval screen and the refresh-from-source pattern
---

# Inline advance/adjustment management on the salary-run approval screen

The salary-run approval table (ApprovalTable in `client/src/pages/admin/hr/SalaryReports.tsx`)
lets super_admin/admin/hr edit advances **only while the run is `pending_approval`**.
Gate: `SALARY_EDIT_ROLES.includes(role) && run.status === 'pending_approval'`.

## Source-of-truth, not snapshot
Advance edits write to the advance tables (salary_advance_repayments), NOT to the
run's reportData snapshot. After any advance write the UI calls
`POST /api/hr/reports/salary/runs/:id/refresh` which re-runs
`generateMonthlySalaryReport` and overwrites reportData, then re-applies the
run's manual per-employee adjustments on top (recomputing deductions/net against
fresh advanceRecovery, and resetting each adjustment's `originalRow` to the fresh
baseline so "remove adjustment" restores to current source values).

**Why:** advanceRecovery is derived from scheduled repayments at generate time; a
stale snapshot would show the old recovery. Refresh keeps the preview honest
without a full manual "Regenerate".

## Installment endpoints (server/salaryAdvanceRoutes.ts)
- `PATCH /api/salary-advances/:id/installment` {year,month,newAmount,reason} —
  edits ONE month's scheduled recovery, preserving outstanding balance by
  redistributing the delta: reduce→push freed amount to last later installment
  (or new trailing month); increase→pull from later installments end-first
  (deleting zeroed rows). Clamps newAmount to oldAmount+sumLater.
- `POST /api/salary-advances/:id/installment/remove` {year,month,reason} —
  deletes the month's scheduled row and defers the amount to a new trailing month.
- Both: `requirePermission("salaryAdvance.backfill","super_admin","admin","hr")`,
  guard advance status disbursed/repaying + target month run not locked
  (`isRunLocked`), audited via addSalaryAdvanceAuditEntry
  (actions `installment_adjusted`/`installment_removed`).

**Why only scheduled installments:** deducted installments belong to a locked run
and must go through the existing super-admin reverse flow, not these editors.

## Add flow reuses backfill
The "Add advance/overpayment/credit" form posts the existing
`POST /api/salary-advances/backfill` — overpayment/salary_credit still enter
`pending_review` (super-admin approval preserved); advance is created active.

## Gotchas
- ApprovalTable rows are keyed by **email**, not userId. Fetch
  `/api/hr/admin/users` and build an email→userId map to call the advance
  endpoints and the employee advances read.
- `requireAdminLevel` (routes.ts) is super_admin+admin ONLY (no hr) — the refresh
  endpoint uses an inline role check to include hr.
