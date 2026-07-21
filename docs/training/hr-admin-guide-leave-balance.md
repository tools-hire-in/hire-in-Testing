# HR Admin Guide — Leave Balance Configuration and Management

**Audience:** hr, admin, super_admin
**Last updated:** 2026-07-21
**Related source doc:** `hr-admin-onboarding-track-source.md` Topic 3 (gap); `docs/workflows/BUSINESS_RULES_CATALOGUE.md` §Leave Management

---

## Purpose

This guide covers how leave types are configured, how the accrual engine works, when LWP is applied, how year-end carry-forward and lapse rules operate, and how HR can manually adjust balances when needed.

---

## Who Uses It

| Role | What they can do |
|---|---|
| `super_admin` | Configure leave types, accrual rates, adjust balances, run year-end batch |
| `admin` | Configure leave types, adjust balances |
| `hr` | View balances, adjust balances, process LWP |
| `manager` | View team balances (read only) |

---

## Where to Find It

- Leave type configuration: `/admin/settings/leave-types`
- Employee leave balances: `/admin/hr/people` → employee profile → Leave tab
- Leave approval queue: `/admin/hr/leave-approvals`

---

## Leave Types — Current Configuration

The platform ships with two core leave types:

### Earned Leave (EL)
- **Entitlement:** 15 days per year
- **Accrual:** Monthly, after the employee works at least **128 hours** in the previous month
- **Monthly rate:** Approximately 1.25 days/month (with bonus months adding up to 15/year)
- **Eligibility:** Starts accruing from month 1 of employment
- **Carry-forward:** Unused EL above the carry-forward cap is lapsed at year-end
- **Max balance:** Configurable per leave type; defaults to 30 days

### Sick Leave (SL)
- **Entitlement:** 8 days per year
- **Accrual:** Monthly, after the first 30 days of employment
- **Monthly rate:** Approximately 0.67 days/month
- **Eligibility:** SL accrual begins only after the employee completes 30 calendar days of employment
- **Carry-forward:** SL does not carry forward — unused balance lapses at year-end
- **No advance allocation:** SL is not front-loaded; employees only receive what has accrued

---

## How the Accrual Engine Works

The accrual engine runs automatically on the **1st of each month** for the previous month. It evaluates each employee's worked hours:

- If hours ≥ 128: full monthly EL accrual is credited
- If hours < 128: no EL accrual for that month (the employee does not earn EL if they worked fewer than 128 hours)

SL accrues on the same schedule but requires only that the employee has passed their 30-day mark.

**Weekend and public holiday exclusion:** Weekends and holidays defined in the holiday calendar are excluded from leave day counts. An employee applying for Mon–Fri leave spanning a public holiday Wednesday uses only 4 leave days, not 5.

---

## LWP (Leave Without Pay) — How It Works

LWP is applied automatically when an employee's approved leave exceeds their available balance.

### When LWP is triggered

1. Employee applies for leave
2. System checks current balance for the requested leave type
3. If the request exceeds the available balance:
   - Available balance is consumed as EL or SL
   - Deficit days are recorded as LWP
4. Manager sees the split (e.g., "3 EL + 2 LWP") when approving
5. Manager approval deducts the EL portion from balance and records LWP days

### LWP impact on salary

LWP days are deducted from gross salary at the pro-rated daily rate:

```
LWP deduction = (Monthly salary ÷ working days in month) × LWP days
```

This deduction appears in the monthly payroll run as an LOP (Loss of Pay) line item.

### HR cannot prevent LWP — they can only inform

If an employee applies for leave they don't have, the system automatically splits the request. The manager (or HR on manager's behalf) can reject the request to prevent LWP, but approval always produces the split.

---

## Configuring Leave Types

To add or modify a leave type:

1. Go to `/admin/settings/leave-types`.
2. Click **Add Leave Type** or click an existing type to edit.
3. Configure:
   - **Name** (e.g., Earned Leave, Sick Leave, Casual Leave)
   - **Accrual rate** (days per month, or annual total)
   - **Accrual trigger** (min hours worked — default 128)
   - **Carry-forward cap** (max days that roll to next year; 0 = no carry-forward)
   - **Max balance** (maximum accrued days an employee can hold)
   - **Advance allocation** (whether all days are credited on January 1)
   - **Eligible from** (day 1 or after probation)
4. Save.

**Important:** Changes to accrual rates apply to future accrual runs only — they do not retroactively adjust past balances.

---

## Manually Adjusting a Leave Balance

Use manual adjustments for:
- Correcting accrual errors
- Recording legacy leave entitlements for newly added employees
- Granting additional leave as a one-time benefit
- Correcting an incorrectly approved LWP request

**Steps:**
1. Go to `/admin/hr/people` → find the employee → Leave tab.
2. Click **Adjust Balance**.
3. Select the leave type.
4. Enter the adjustment amount (positive to add, negative to deduct).
5. Enter the reason (this is stored in the audit log).
6. Save.

All manual adjustments are logged with the HR user's name, timestamp, and stated reason.

---

## Year-End Processing

At the end of each calendar year (December 31), the system runs a year-end batch:

### EL Carry-Forward
- Unused EL up to the **carry-forward cap** rolls into the next year's balance
- EL above the cap is **lapsed** (forfeited)
- Example: if the carry-forward cap is 15 days and an employee has 22 days of EL, 15 carry forward and 7 are lapsed

### SL Lapse
- All unused SL is lapsed — SL does not carry forward under any configuration

### HR actions at year-end
- No manual HR action is required — the batch runs automatically
- HR should review the year-end lapse report (generated by the batch) to confirm correct processing
- Employees are notified of their year-end balances after the batch completes

**If year-end processing shows incorrect carry-forward:** use the manual balance adjustment tool to correct individual employee balances, with reason documented.

---

## Common Mistakes

**"An employee's EL balance didn't grow this month."**
Check if the employee worked fewer than 128 hours in the previous month. The accrual engine only credits EL if the minimum hours threshold is met. Review their attendance records.

**"An employee applied for SL on day 15 of employment, but the request failed."**
SL accrual only begins after 30 days of employment. Before day 30, no SL balance exists to draw from.

**"An employee is confused — they had 10 EL days and applied for 10 days, but their payslip shows LWP."**
This happens when EL days in the application span weekends or holidays. A 10-day application over a period with 2 weekends and a holiday actually consumes 7 EL days, leaving 3 days as LWP if the employee chose full dates. Review the specific leave request to see the split.

**"HR wants to remove LWP that was incorrectly approved."**
The approved leave request cannot be edited. Manually adjust the employee's EL balance upward to compensate (add back the EL days), and record a manual LWP reversal adjustment with the reason documented. Flag the payroll team to reverse the LOP deduction in the same cycle if payroll hasn't run yet.

---

## Quick Reference — Leave Rules

| Rule | Detail |
|---|---|
| EL accrual trigger | Min 128 hours worked in previous month |
| EL entitlement | 15 days/year |
| SL accrual starts | After 30 days of employment |
| SL entitlement | 8 days/year |
| Weekend/holiday counting | Excluded from leave day count |
| Balance deduction timing | On manager approval, not on submission |
| LWP trigger | When approved leave exceeds available balance |
| LWP salary impact | Pro-rated daily rate × LWP days |
| EL year-end | Unused EL above carry-forward cap lapses |
| SL year-end | All unused SL lapses |

---

## Where to Get Help

- Full leave rules: `docs/workflows/BUSINESS_RULES_CATALOGUE.md` §Leave Management
- Leave request state machine: `docs/workflows/WORKFLOW_STATE_MACHINES.md` §2
- For payroll impact of LWP: `hr-admin-guide-payroll-run.md` §LOP Mode
