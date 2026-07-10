---
name: Salary disbursement & per-employee payslip unlock
description: How the executive disbursement workflow interacts with run status and payslip visibility
---

# Salary disbursement flow

- Runs move pending_approval → approved (attendance gate: active attendance_report_runs row for same month/year must be approved/overridden) → executed.
- Approval notifies executives (in-app + email) with deep link `/admin/executive-cockpit?tab=reports`.
- `salary_run_payments` tracks per-employee deposit status keyed by (run_id, email — matched against reportData row emails, not admin_users ids).
- A run **auto-executes** when every reportData row has a deposited payment (via PATCH single payment or mark-all).

**Payslip unlock rule:** employees see a run's slip when the run is `executed`, OR the run is approved/sent AND their own payment row is `deposited` (helper `findSlipRunForEmail` used by my-runs + render/pdf/email-me endpoints). Privileged roles (super_admin/admin/hr/finance/executive) only see executed runs in my-runs — an empty list for them on an approved run is correct, not a bug.

**How to apply:** any new slip-serving endpoint must go through `findSlipRunForEmail`; never gate on run status alone or the per-employee unlock breaks.

**Testing tip:** end-to-end auth testing works by inserting a temp admin_users row with a bcryptjs hash (login has no TOTP gate when totp_enabled=false) — remember attendance_report_entries/audit_logs FK cleanup before deleting the user.
