---
name: Centralized compensation
description: Rules for how employee salary is sourced, changed, and authorized across the HR app.
---

`admin_users.salary` is the single source of truth for compensation, and a `salary_changes` ledger is the audit history. Every change must go through the ledger helper, which both applies the new value AND records an audit row — never write `admin_users.salary` directly from a feature path.

**Write-back rules (all idempotent per source document):**
- Offer salary writes back at the earliest point a user record exists: at acceptance for an offer already linked to an existing employee, otherwise at account creation (start-onboarding) for brand-new hires. Both paths are safe to run because idempotency keys on (source, document id).
- Probation handling: the opening/current salary is the *probation* figure when present (not the headline/post-probation figure). A distinct post-probation salary is recorded as a separate **future-dated** ledger entry so the salary report transitions automatically by effective date — there is no cron that flips the live salary at probation end.
- Addendum salary writes back only for salary_revision / combined types, at both candidate acceptance and HR countersign.

**Why:** prevents pay figures drifting from the documents that set them, and keeps payroll/report numbers reconstructable as-of any month by effective date.

**Effective-date timing (critical):** never write `admin_users.salary` ahead of a change's effective date. A change recorded/approved with a *future* effective date is stored in the ledger as status `applied` but with `appliedAt = null` and the live salary untouched. A daily cron (`applyDueSalaryChanges`) promotes such entries to the live salary once due, stamping `appliedAt`. **Why:** writing early corrupts both the live figure and salary reports for pre-effective months (the report falls back to `admin_users.salary` when no ledger entry precedes the month). `appliedAt = null` is the "not yet reflected on the employee record" marker; the report still counts the entry by effective date.

**Maker-checker (manual edits):** super_admin applies immediately; admin/hr/manager create a pending request only a super_admin can approve/reject. A manual change MUST carry an effective date, a reason, AND a linked proof document (offer/addendum) — proof is mandatory and is server-validated to actually belong to that employee.

**Authorization:** super_admin/admin/hr are org-wide; managers are scoped to their direct reports on every salary-change read and write endpoint. Don't rely on role-only gating for compensation data — enforce per-employee scope.

**Advances:** disbursement is recorded in the same ledger (no salary mutation). Final-approve auto-disburses; recovery runs with the regular salary cycle unless an urgent payout is approved by the requester's manager/dept head, which starts recovery in the current month.
