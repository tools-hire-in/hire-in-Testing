# Executive Guide — Dashboards, Payroll Reports, and Governance Controls

**Audience:** executive, finance
**Last updated:** 2026-07-21
**Related source doc:** `executive-onboarding-track-source.md`

---

## Purpose

This guide explains how to navigate the executive dashboard, read payroll run reports, interpret statutory deductions, review headcount metrics, and use the Governance Control Tower — all from a read-only perspective.

---

## Who Uses It

| Role | Access level |
|---|---|
| `executive` | Read access to all payroll, headcount, and governance data; can approve payroll runs |
| `super_admin` | Full access including all executive views |

The `executive` role cannot create or edit employee records, configure settings, or generate HR letters. All operations are read-only except payroll run final approval.

---

## Where to Find It

| Section | URL |
|---|---|
| Executive Cockpit | `/admin/executive-cockpit` |
| Payroll Run Review | `/admin/payroll/run` |
| Payroll Executive Dashboard | `/admin/payroll/executive` |
| Governance Control Tower | `/admin/control-tower` |
| Personal HR (leave, payslip) | My Desk (sidebar) |

---

## The Executive Cockpit

`/admin/executive-cockpit` is your automatic landing page after login.

### What you see

| Panel | What it shows |
|---|---|
| **Headcount** | Total active employees, breakdown by department |
| **Payroll Summary** | Total monthly payroll obligation for the current cycle; year-to-date payroll spend |
| **Payroll Run Status** | Current month's run status: not started / pending approval / approved / executed |
| **Statutory Overview** | PF, ESI, and Professional Tax obligations for the current period |
| **Salary Advance Portfolio** | Total outstanding advances across all employees; monthly recovery schedule |

All panels refresh on page load. Navigate away and back to get the latest figures — there is no manual refresh button.

### Navigating to personal HR functions

Your own payslip, leave balance, and attendance are accessible from **My Desk** in the sidebar. They are not shown on the Executive Cockpit.

---

## Reading a Payroll Run

`/admin/payroll/run`

### Reviewing a run before approval

1. Go to `/admin/payroll/run`.
2. Click on the current month's run.
3. Review the summary figures at the top:
   - **Total gross pay** — sum of all employees' gross salaries
   - **Total deductions** — PF (employee), ESI (employee), PT, LOP, advance recovery
   - **Total net pay** — what will actually be transferred to employees

4. Click **View Per-Employee** to see the breakdown by individual.
5. For each employee line, you can see:

| Column | What it means |
|---|---|
| Gross Pay | Salary before deductions |
| EPF (Employee) | 12% of Basic+DA (employee's share) |
| ESI (Employee) | 0.75% of Gross (if below ESI wage threshold) |
| Professional Tax | State-levied monthly slab |
| LOP | Loss of Pay deduction for LWP days in the period |
| Advance Recovery | Salary advance installment repayment |
| Net Pay | Gross minus all deductions |

6. If you are satisfied, click **Approve** (final approval). This authorizes HR to send salary slips to employees.

### If you find a discrepancy

Do **not** approve until the discrepancy is resolved. Contact HR and describe:
- The employee's name
- The specific line item that appears incorrect
- The expected amount

Dispatched salary slips **cannot be recalled** — once slips are sent, corrections must be made as adjustments in the next cycle.

---

## Understanding the Deductions

### EPF — Employee Provident Fund

A statutory retirement savings scheme.
- **Employee share:** 12% of Basic + DA
- **Employer share:** 12% of Basic + DA (paid by company, shown separately in statutory reports)
- Both shares are remitted to the EPFO (Employees' Provident Fund Organisation) monthly

### ESI — Employee State Insurance

A health insurance and social security scheme.
- **Employee share:** 0.75% of Gross Salary
- **Employer share:** 3.25% of Gross Salary
- Applies **only** to employees whose gross salary is below the statutory ESI wage ceiling
- Employees above the ceiling: ESI = 0 (this is correct behavior, not an error)

### Professional Tax (PT)

A state-levied monthly tax on employment income.
- Varies by state; collected via monthly salary slabs
- Not applicable in all states (some states have no PT obligation)
- PT is remitted to the state government

### LOP — Loss of Pay

Not a statutory deduction — this is a payroll adjustment.
- Applied when an employee had LWP (Leave Without Pay) days in the period
- Formula: `(Monthly salary ÷ working days in month) × LWP days`
- LOP days originate from the approved attendance report

### Advance Recovery

Repayment of an outstanding salary advance.
- Fixed monthly installment per advance record
- Locked once the run passes `pending_approval`
- If net pay in the recovery month is insufficient, the shortfall carries forward to the next month

---

## The Payroll Executive Dashboard

`/admin/payroll/executive`

This dashboard shows trends and statutory data useful for financial planning and compliance filing.

### Multi-Month Payroll Trend

A chart showing total payroll spend per month over the trailing period. Useful for budget vs. actual tracking and headcount cost modeling.

### Headcount History

A table showing joiners, leavers, and net headcount movement by month. Useful for reporting and workforce planning.

### Statutory Export

For PF/ESI/PT government filing:

1. Go to `/admin/payroll/executive` → Statutory Export section.
2. Select the target month.
3. Click **Export Statutory**.
4. Download the structured data file containing:
   - Employee-wise EPF wages, deductions, and employer contributions
   - ESI wages and contributions
   - PT deductions

**Important:** Always confirm the payroll run for the target month is in `executed` status before submitting a statutory filing. Filing before execution means the numbers may not match the amounts actually paid.

---

## The Governance Control Tower

`/admin/control-tower`

The Control Tower shows all active governance obligations for the organization — compliance deadlines, statutory filings, and other formal requirements.

### Reading an obligation

Each obligation shows:
- **Description** — what compliance activity is required
- **Status** — pending → in_progress → completed / escalated / disputed
- **Owner role** — which team is responsible
- **Due date** — deadline for completion

### Status meanings

| Status | Meaning |
|---|---|
| `pending` | Not yet started |
| `in_progress` | Being worked on |
| `completed` | Obligation met |
| `escalated` | Past due; escalation path reaches CEO level for high-severity items |
| `disputed` | Under active review — contested but not abandoned |

### What executives can do

As an executive, you can **view** all obligations and their current status. You can also see:
- Transition history (who changed what and when)
- Notes attached to each obligation

You **cannot** create new obligations or make status transitions — only `super_admin`, `admin`, and `hr` can do so.

### Automated Changes tab

At `/admin/control-tower?tab=automated-changes`, you can see system-initiated pending changes that required human approval before being applied. These are governance-sensitive actions proposed by automated jobs (e.g., absence sweeps, accrual adjustments) that a super_admin must review and approve before they take effect.

---

## Common Mistakes

**"The Executive Cockpit shows data from yesterday — the numbers seem stale."**
The cockpit refreshes on page load. Navigate away (e.g., go to My Desk) and then navigate back to `/admin/executive-cockpit`. This triggers a fresh load.

**"An employee shows ESI = 0 in the payroll run — is this an error?"**
No. Employees above the ESI wage threshold are not covered by ESI and their ESI deduction is correctly zero. Check if the employee's gross salary is above the statutory ESI ceiling.

**"I approved the payroll run but the slips haven't been sent to employees."**
Your approval authorizes the run. HR or super_admin must click **Send Slips** after final approval. Contact HR to proceed with slip dispatch.

**"The statutory export file doesn't match the approved run totals."**
The export reflects the computation snapshot stored at slip generation time. If the run was regenerated or adjusted after slips were generated, there may be a version discrepancy. Contact HR to reconcile before filing.

---

## Quick Reference

| Task | URL | Notes |
|---|---|---|
| Executive overview | `/admin/executive-cockpit` | Refreshes on page load |
| Approve payroll run | `/admin/payroll/run` | Final approval only |
| Multi-month trend | `/admin/payroll/executive` | Headcount history also here |
| Statutory export | `/admin/payroll/executive` | Run must be `executed` before filing |
| Governance obligations | `/admin/control-tower` | Read-only for executive role |
| Personal payslip | My Desk | Via sidebar |

---

## Where to Get Help

- Payroll rules: `docs/workflows/BUSINESS_RULES_CATALOGUE.md` §India Statutory Payroll
- Payroll run state machine: `docs/workflows/WORKFLOW_STATE_MACHINES.md` §5
- Governance control state machine: `docs/workflows/WORKFLOW_STATE_MACHINES.md` §14
- For payroll discrepancies before approval: contact HR immediately — do not approve
- For statutory filing questions: consult your statutory compliance advisor and confirm with HR
