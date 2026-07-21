# HR Admin Guide — Monthly Payroll Run

**Audience:** hr, admin, super_admin (generate, adjust, approve); executive, super_admin (final approval, disburse)
**Last updated:** 2026-07-21
**Related source doc:** `hr-admin-onboarding-track-source.md` Topic 2

---

## Purpose

This guide explains the full monthly payroll run cycle: from finalizing attendance through to confirming disbursements. It covers LOP mode, salary advance recovery, and how to handle errors before and after approval.

---

## Who Uses It

| Role | What they can do |
|---|---|
| `super_admin` | All steps including final approval and disburse |
| `admin` | Generate, adjust, approve run (final approval by super_admin/executive) |
| `hr` | Generate, adjust, review |
| `executive` | Final approval, view payroll executive dashboard |

---

## Where to Find It

- Run management: `/admin/payroll/run`
- Executive dashboard: `/admin/payroll/executive`
- Attendance report (prerequisite): `/admin/hr/reports`

---

## The Payroll Run Cycle — Overview

```
1. Finalize Attendance  →  2. Generate Run  →  3. Review & Adjust
       ↓                                              ↓
4. Approve Run          →  5. Final Approval  →  6. Send Slips  →  7. Confirm Payments
```

Each step must complete before the next can begin. Do not skip steps.

---

## Step 1 — Finalize Attendance

Before generating a payroll run, the attendance report for the target month must be in `notified` status.

1. Go to `/admin/hr/reports`.
2. Generate the attendance report for the target month. Review for:
   - Missing punch-in or punch-out records
   - Employees with LWP days (these will become LOP deductions in payroll)
   - Unprocessed regularization tickets
3. Resolve any corrections before proceeding.
4. Click **Notify** — this sends the attendance report to employees and locks the status to `notified`.

**If you generate a payroll run before notifying attendance:** the run may not reflect the latest corrections. Always notify attendance first.

---

## Step 2 — Generate the Run

1. Go to `/admin/payroll/run`.
2. Click **Generate Run**.
3. Select the target month and year.
4. Click **Confirm**.

The system computes payroll for all employees who have an assigned salary structure. Employees without an assigned salary structure are **skipped gracefully** — no error is shown; they simply do not appear in the run.

What is computed per employee:
- Gross salary (from salary structure)
- PF deduction (employee: 12% of Basic+DA; employer: 12%)
- ESI deduction (employee: 0.75% of Gross; employer: 3.25% — only for employees below the ESI wage threshold)
- Professional Tax (state slab)
- LOP deduction (pro-rated daily rate × LWP days in the period)
- Salary advance recovery installments

---

## Step 3 — Review and Adjust

After generation, review each employee's line before approving. This is the **only window** to make adjustments.

**What to check:**
- Gross pay matches the employee's current salary
- LOP deductions match LWP days in the attendance report
- Salary advance repayment amounts match the agreed installment schedule
- ESI shows 0 for employees above the ESI wage threshold (this is correct)
- No employee is missing who should be present (check salary structure assignment)

**Adding a manual deduction or adjustment:**
1. Click the employee row.
2. Click **Add Adjustment**.
3. Enter the amount, type (deduction or addition), and reason.
4. Save.

**Editing an advance recovery installment:**
1. Click the employee row.
2. In the Advances section, click the installment.
3. Edit the amount.
4. Save. The run refreshes the total from the updated source.

---

## Step 4 — Approve the Run

1. When all lines are verified, click **Approve Run**.
2. The run moves to `pending_approval` and is queued for final authorization.

**Critical:** Once the run passes `pending_approval`, salary advance recovery installments are **locked**. They cannot be edited. Do not approve until recovery amounts are verified.

---

## Step 5 — Final Approval and Dispatch

A `super_admin` or `executive` reviews the approved run:

1. Go to `/admin/payroll/run` → click the run in `pending_approval`.
2. Review the total payroll obligation and per-employee breakdown.
3. Click **Approve** (final).
4. Click **Send Slips** — salary slips are emailed to all employees included in the run.

**Dispatched slips cannot be recalled.** If a discrepancy is discovered after slips are sent, it must be corrected as an adjustment in the following month's run.

---

## Step 6 — Confirm Payments

After finance confirms each bank transfer:

1. Click the employee row → click **Mark Deposited**.
2. Or, if all payments are confirmed in bulk, click **Execute Run** — this marks the entire run as executed.

The run moves to `executed` status. This is the official record for statutory filing.

---

## LOP Mode

LOP (Loss of Pay) is calculated based on the LWP days recorded in the approved attendance report. The formula is:

```
LOP deduction = (Monthly salary ÷ working days in the month) × LWP days
```

The `lop_mode` setting controls how working days are counted:
- `calendar` — all calendar days in the month
- `working_days` — only working days (excludes weekends)
- `fixed` — a fixed divisor configured in payroll settings

HR admins can view the current LOP basis in `/admin/settings/payroll`.

---

## Common Mistakes

**"An employee is missing from the run."**
The employee does not have a salary structure assigned. Assign a salary structure at the employee's profile, then regenerate the run (or add them as a manual adjustment).

**"The advance recovery amount is wrong — but the run is already approved."**
Recovery installments lock at `pending_approval`. You cannot edit them. If the error is significant, contact super_admin to cancel the run, revert to draft, correct the advance record, and re-approve. For minor differences, record a correcting adjustment in the next run.

**"I generated the run before notifying attendance."**
Cancel the run, complete the attendance notification step, then regenerate. Running payroll against an unnotified attendance report risks LOP discrepancies.

**"A salary slip was sent with the wrong amount."**
Dispatched slips cannot be recalled. Issue a correction letter or adjustment in the next month's run. Document the discrepancy for audit purposes.

---

## Quick Reference — Run Statuses

| Status | Meaning |
|---|---|
| `draft` | Generated, under review, adjustments allowed |
| `pending_approval` | Submitted for final authorization; advance recovery locked |
| `approved` | Final approval given; ready to send slips |
| `executed` | All payments confirmed; official record |
| `cancelled` | Run cancelled before execution |

---

## Quick Reference — Key Rules

| Rule | Detail |
|---|---|
| Attendance prerequisite | Attendance report must be `notified` before generating a run |
| Advance lock point | Recovery amounts lock when run passes `pending_approval` |
| Employees without structure | Skipped silently — check their profiles |
| ESI threshold | ESI = 0 for employees above the statutory wage ceiling (correct behavior) |
| Slip recall | Not possible — corrections go into next month's run |
| Multi-run rows | Table may have multiple rows per month; UI always shows `is_active = true` row |

---

## Where to Get Help

- Payroll run state machine: `docs/workflows/WORKFLOW_STATE_MACHINES.md` §5
- India statutory payroll rules (PF, ESI, PT): `docs/workflows/BUSINESS_RULES_CATALOGUE.md` §India Statutory Payroll
- Salary advance recovery: `docs/workflows/BUSINESS_RULES_CATALOGUE.md` §Salary Advance
- For individual employee discrepancies before approval: contact HR to review and correct
