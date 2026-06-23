---
name: Salary advance payroll recovery
description: How advance installments are recovered from payroll, capped, and carried forward
---

Payroll recovery for salary advances reconciles against the ACTUAL capped amount
on the salary run row, not the raw scheduled installment.

- `salaryReport.ts` caps each row's advance recovery at net-pay-after-attendance
  (`min(scheduledSum, netBeforeAdvance)`) so net pay never goes negative.
- `applyAdvanceRecoveriesForRun` (server/salaryAdvanceRoutes.ts) must therefore
  distribute that capped figure across the employee's scheduled installments
  oldest-first, decrement outstanding by the REAL amount, and only auto-close
  when outstanding hits 0.

**Why:** marking installments deducted by the full `scheduledAmount` when net pay
was short understated outstanding and closed advances prematurely.

**Carry-forward:** any unrecovered remainder is rescheduled to the next free
month after the advance's last installment — partial remainder → a NEW scheduled
row; a fully-skipped installment (budget exhausted by earlier ones) → the row is
moved in place via `storage.rescheduleRepayment`. Audit action
`repayment_rescheduled`. This guarantees eventual full recovery.

**How to apply:** recovery is allocated across ALL of an employee's advances
together (oldest installmentNo first), so funding one month can recover a
different advance than expected — tests must clean up between cases or carry-
forward rows from prior advances collide in the same month.

The repayment status enum is only `scheduled | deducted | waived` (no
"partially_deducted") — that's why partials are handled via carry-forward rows
rather than a new status.

**Disbursement gate (policy):** payroll recovery must only run once funds are
actually disbursed. Both the report computation and the run-approval
reconciliation filter to advance status `disbursed | repaying` — NOT `approved`.
Final approval creates the repayment schedule but does not start recovery;
disbursement is a separate manual accounts step.

**Approval ceilings (policy):** the manager stage is capped at
`policy.managerMaxMonths` for EVERY approver acting there (manager/hr/admin) —
admin does not inherit the CEO ceiling at the manager stage. `ceoMaxMonths`
applies only at the final super-admin stage. Final approval is super_admin only
(registry `salaryAdvance.finalApprove = ["super_admin"]`); never auto-inject
super_admin/admin into permission fallbacks.

**HR fallback routing:** when the manager chain is unavailable/on-leave, the
request is routed to the first active HR user, stored as the advance's
`managerId`. Manager queue, stats badge, and manager-action gating all key off
`managerId == userId`, so HR-fallback UI gates must include the `hr` role.

## Feature flag gate (salary_advance_enabled)
The whole self-service Salary Advance feature is gated behind the `salary_advance_enabled` system_settings feature flag (default OFF — useFeatureFlags treats absent/non-true as disabled, so no seeding needed). Backend: an `app.use("/api/salary-advances")` middleware at the top of registerSalaryAdvanceRoutes returns 403 unless the flag is true; route handlers + applyAdvanceRecoveriesForRun are left intact. Frontend gates: AdminLayout nav item + stats query, SalaryAdvance.tsx redirect to /admin/hr, HRSettings "Salary Advance Policy" nav+section. To re-enable: flip the flag via /api/system/feature-flags. Tests (access/recovery) call storage directly, not HTTP, so the gate doesn't affect them.
