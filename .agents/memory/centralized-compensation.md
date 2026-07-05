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

**Backdated corrections must not downgrade the live figure:** a correction effective for a *past* month (e.g. from the payroll-preview "correct base salary" tool) must only write `admin_users.salary` when it is the latest-effective applied change. If a later-effective raise already exists, record it in the ledger only — the target month's slip resolves it by effective date, but the current live salary stays put. This rule applies on BOTH write paths: the super_admin direct `correct-salary` endpoint AND the admin/hr maker-checker approval endpoint (`/api/hr/salary-changes/:id/approve`) — the approval path was the last one missed.

Two non-obvious traps when suppressing a backdated write:
1. **Only later changes that are ALREADY IN EFFECT (`effectiveDate <= today`) may suppress.** A *future*-dated raise must NOT block a legitimately-current backdated correction, or the live figure is left stale. So `hasLaterApplied` must compare `laterEff > thisEff && laterEff <= today`.
2. **A suppressed backdated row must be SETTLED, not left `appliedAt = null`.** `getDueSalaryChanges` returns `appliedAt IS NULL AND effectiveDate <= today`, so a suppressed-but-due row with `appliedAt = null` gets picked up by the daily `applyDueSalaryChanges` cron and re-promotes the old value — the exact downgrade you suppressed, just delayed. Stamp `appliedAt` for any due row (written OR suppressed). `recordSalaryChange` gained a `settle` option for this (`settleNow = writeNow || settle`); `appliedAt = null` is reserved ONLY for genuine future-dated entries awaiting scheduled promotion (e.g. offer post-probation step, which uses `apply:false` + future date and must stay promotable — it does NOT pass `settle`).

**Why:** `recordSalaryChange(apply:true)` overwrites the live salary whenever effectiveDate ≤ today, so a naive backdated apply silently reverts a current raise — either immediately, or later via the promotion cron if the suppressed row is left unsettled.

**Approved salary runs are locked — enforce server-side on every slip-writing path, not just the UI:** once a `salary_report_runs` row for a period is `approved`, both slip regeneration and the inline base-salary correction return 409. UI disabling is not enough; a hidden button is still callable. Attendance can still be corrected via the shared general-purpose endpoint (it's not payroll-specific), but because regeneration is blocked, those corrections cannot flow into a locked month's slips.
