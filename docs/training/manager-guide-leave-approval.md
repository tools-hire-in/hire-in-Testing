# Manager Guide — Leave Approvals

**Audience:** manager, hr, admin, super_admin
**Last updated:** 2026-07-21
**Related source doc:** `manager-onboarding-track-source.md` Topic 2

---

## Purpose

This guide explains how to review and action team leave requests, understand the LWP split, handle half-day approvals, reject a request with a reason, and stay within the 3-day correction window.

---

## Who Uses It

| Role | Scope |
|---|---|
| `manager` | Own direct reports only |
| `hr` | All employees |
| `admin` | All employees |
| `super_admin` | All employees |

---

## Where to Find It

`/admin/hr/leave-approvals`

---

## How the Leave Approval Flow Works

1. Employee submits a leave request via My Desk → Apply Leave.
2. The request appears in your queue at `/admin/hr/leave-approvals`.
3. You receive an in-app notification (if notifications are enabled) and an email.
4. You review and approve or reject.
5. The employee receives an email notification with your decision.

There is **no second approval layer** for standard leave — your decision is final for your team.

---

## Step-by-Step: Reviewing a Request

1. Go to `/admin/hr/leave-approvals`.
2. You see pending requests from your direct reports (managers see only their own team; HR/admin see all).
3. Click on a request to open the detail view.
4. Review the following before deciding:
   - **Leave type** — EL (Earned Leave) or SL (Sick Leave)
   - **Dates** — start and end date, net days (weekends and public holidays are excluded automatically)
   - **Current balance** — how many EL/SL days the employee currently holds
   - **LWP component** — if the request exceeds the balance, the deficit is shown as LWP days

---

## Step-by-Step: Approving a Request

1. After reviewing, click **Approve**.
2. The leave balance is deducted immediately (for EL and SL components).
3. LWP days (if any) are recorded — these will appear as LOP deductions in the next payroll run.
4. The employee receives an email confirmation.

**Balance is deducted on approval, not on submission.** This means if you delay approving for a week, the deduction only happens when you click Approve.

---

## Step-by-Step: Rejecting a Request

1. Click **Reject**.
2. Enter a reason — the reason is mandatory and is sent to the employee in the rejection email.
3. Confirm rejection.

The employee's leave balance is **not affected** by a rejection. They can resubmit with different dates or a reduced number of days.

---

## Understanding the LWP Split

If an employee applies for more days than their available balance, the system automatically splits the request:

| Applied | Available EL | LWP |
|---|---|---|
| 5 days EL | 2 days | 3 days |
| 3 days EL | 3 days | 0 days |
| 7 days EL | 0 days | 7 days |

**The LWP component means those days will be deducted from the employee's salary** at the pro-rated daily rate in the payroll run for that month.

Always check for LWP before approving. If the employee did not realize they had insufficient balance, reject and ask them to resubmit for a smaller number of days.

---

## Half-Day Approvals

Employees can request half-day leave (morning or afternoon). These appear in the approval queue like a standard request, with the half-day type noted.

Half-day leave consumes **0.5 days** from the balance. The rules are otherwise identical — LWP applies if the balance is insufficient even for 0.5 days.

---

## Weekend and Holiday Exclusion

Weekends (Saturday and Sunday) and public holidays defined in the holiday calendar are **automatically excluded** from the leave day count.

**Example:** An employee applies for leave from Monday to Friday (5 calendar days). A public holiday falls on Wednesday. The net leave days consumed = **4** (Wednesday is excluded).

The application summary shows the net day count — not the calendar span. Always read the net days, not the date range.

---

## The 3-Day Correction Window

After you approve a leave request, it cannot be undone through the approval interface. If you approved an incorrect request:

- **Within 3 days of approval:** Contact HR — they can reverse the approval through an administrative correction
- **After 3 days:** The request must be corrected via a payroll adjustment in the current or next payroll run

If an employee's leave was incorrectly marked as LWP due to a balance error, HR can manually adjust the leave balance and coordinate the payroll correction.

---

## Common Mistakes

**"I approved 5 days but the employee's payslip shows 2 days deducted from LWP."**
The request had a split: 3 EL + 2 LWP. LWP days generate an LOP deduction in payroll. Check the leave request detail — the split was visible in the request summary before you approved.

**"An employee applied for a week off starting next Monday — I don't see the request."**
The employee may not have submitted yet (the request shows only after submission), or the request is assigned to a different approver. Check with the employee and HR.

**"I rejected a request but the employee says their balance was deducted."**
Rejection does not deduct balance. If their balance changed, check whether a separate, previously approved request is responsible, or whether the balance was adjusted manually by HR.

**"A public holiday was on a Thursday during the leave period, but the system counted it."**
Check that the holiday is listed in the holiday calendar (`/admin/settings/holidays`). If the holiday was not added to the calendar, the system does not know to exclude it. Contact HR to add it and recalculate.

---

## Quick Reference

| Rule | Detail |
|---|---|
| Approval scope | Managers: own direct reports only |
| Balance deduction timing | On approval, not on submission |
| LWP trigger | Approved leave exceeds available balance |
| Weekend/holiday counting | Excluded from net day count |
| Rejection reason | Mandatory — shown to employee in email |
| Reversal window | 3 days — contact HR |
| Second approval layer | None — manager decision is final |
| Half-day leave | Consumes 0.5 days; same LWP rules apply |

---

## Where to Get Help

- Leave rules in full: `docs/workflows/BUSINESS_RULES_CATALOGUE.md` §Leave Management
- Leave request state machine: `docs/workflows/WORKFLOW_STATE_MACHINES.md` §2
- To reverse an incorrectly approved leave: contact HR
- Leave balance guide: `hr-admin-guide-leave-balance.md`
