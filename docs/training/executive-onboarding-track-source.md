Status: Training track source material — reviewed and version-controlled
Generated from: docs/training/TRAINING_GAP_MAP.md, docs/platform/PRODUCT_CAPABILITY_MAP.md, docs/workflows/WORKFLOW_STATE_MACHINES.md, docs/workflows/BUSINESS_RULES_CATALOGUE.md
Date: 2026-07-13
Human approval required: Yes — this document is source material for human review before being committed to the live training track in the platform.
Unresolved items: 0

---

# Executive / Finance Onboarding — Training Track Source Material

**Purpose of this document:** This file is the reviewed, corrected, and version-controlled source material for the "Executive / Finance Onboarding" training track seeded in the platform under Task #1014. Update existing `track_sections` rows with this content after human review.

**Training track target audience:** Finance and executive users (role: `executive`).
**Track priority:** MEDIUM — confirmed in `docs/training/TRAINING_GAP_MAP.md`.

Each section follows: Purpose → Who uses it → Where to find it → How to use it → Important rules → Knowledge check → Where to get help.

---

## Topic 1: Executive Cockpit Navigation

**Purpose:** Navigate the executive-specific landing page and understand which panels provide which financial insights.

**Who uses it:** `executive`, `super_admin`.

**Where to find it:** `/admin/executive-cockpit` — this is your automatic landing page after login.

### How to Use It

The Executive Cockpit shows:
- **Headcount panel** — total active employees, breakdown by department
- **Payroll Summary** — total monthly payroll obligation, year-to-date payroll spend
- **Payroll Run Status** — current month's run status (not started / pending approval / approved / dispatched)
- **Statutory Overview** — PF, ESI, Professional Tax obligations for the current period
- **Salary Advance Portfolio** — total outstanding advances, monthly recovery schedule

All data on this page updates on load. There is no manual refresh — navigate away and back to refresh.

For personal HR functions (your own attendance, leave, payslips), navigate to My Desk from the sidebar.

### Important Rules

- The `executive` role has read access to all payroll and headcount data.
- The `executive` role cannot create or edit employee records, configure settings, or generate HR letters.
- Executive Cockpit access is restricted to `executive` and `super_admin` roles — attempts to access it from other roles redirect to My Desk.

### Knowledge Check

1. Where do you land after logging in as an executive user?
2. Where can you find your own payslip or leave balance?
3. Can an executive user edit an employee's salary structure?
4. What must you do to refresh the data on the Executive Cockpit?
5. What does the Payroll Run Status panel tell you?

*(Answers: 1 — `/admin/executive-cockpit`; 2 — My Desk; 3 — No, executive is read-only for employee records; 4 — Navigate away and back (page refreshes on load); 5 — The current status of this month's payroll run)*

### Where to Get Help

Contact HR for data questions. Engineering team for access issues.

---

## Topic 2: Reading Payroll Reports (HIGH RISK)

**Purpose:** Interpret payroll run output correctly — understanding deduction types and recovery items — so you can approve runs with confidence and identify discrepancies before they reach employees.

**Who uses it:** `executive`, `super_admin`.

**Where to find it:** `/admin/payroll/run` and `/admin/payroll/executive`.

### How to Use It

**Reviewing a payroll run:**
1. Go to `/admin/payroll/run`.
2. Click on the current month's run.
3. For each employee, you see: Gross Pay, PF deduction, ESI deduction, Professional Tax, LOP, Advance Repayment, and Net Pay.
4. If satisfied, click "Approve Run" (or escalate to super_admin for final approval).

**Payroll Executive Dashboard:**
Go to `/admin/payroll/executive` for:
- Multi-month payroll spend trend
- Headcount history (joiners/leavers per month)
- Statutory export data for EPF/ESI/PT filing

### Understanding the Deduction Types

| Deduction | What it is | Who pays | Cap/Threshold |
|---|---|---|---|
| EPF (Employee Provident Fund) | Retirement savings | Employee: 12% of Basic+DA; Employer: 12% | Subject to statutory wage ceiling |
| ESI (Employee State Insurance) | Health coverage | Employee: 0.75% of Gross; Employer: 3.25% | Only employees below ESI wage threshold |
| Professional Tax | State-levied monthly tax | Employee | Varies by state; monthly slab |
| LOP (Loss of Pay) | Salary deduction for LWP days | Employee | Pro-rated daily rate × LWP days |
| Advance Repayment | Recovery of outstanding salary advance | Employee | Fixed monthly installment |

### Important Rules

- **Dispatched salary slips cannot be recalled.** A discrepancy discovered after slips are sent must be corrected as an adjustment in the next month's run. Do not approve until you are satisfied.
- Salary advance recovery installments are locked once the run passes `pending_approval`.
- Employees without a salary structure assigned are skipped in the run — they will not appear in the per-employee detail and will not receive a slip.
- The computation snapshot on each salary slip is written at first render and is immutable — it permanently records the values used.

### Knowledge Check

1. Which deduction applies to employees whose salary is above the ESI wage threshold?
2. What is LOP, and when does it appear on an employee's payslip?
3. Can you correct a payslip after it has been dispatched to the employee?
4. At what point are salary advance recovery amounts locked and unable to be edited?
5. Why might an employee not appear in the payroll run detail?

*(Answers: 1 — ESI does not apply; they pay EPF only; 2 — Loss of Pay — it appears when an employee had LWP (Leave Without Pay) days in the month; 3 — No, corrections become adjustments in the next month's run; 4 — When the run passes pending_approval; 5 — They may not have a salary structure assigned)*

### Where to Get Help

Payroll rules: `docs/workflows/BUSINESS_RULES_CATALOGUE.md` §India Statutory Payroll. Contact HR if you find a per-employee discrepancy before approving.

---

## Topic 3: Governance Controls and Control Tower

**Purpose:** Understand the governance obligation tracking system and how to read the current compliance status.

**Who uses it:** `executive`, `super_admin`, `admin`, `hr`.

**Where to find it:** `/admin/control-tower`.

### How to Use It

The Control Tower shows all active governance obligations for the organization. Each obligation has:
- A description of the compliance requirement
- A status (pending → in_progress → completed / escalated / disputed)
- An owner role
- A due date

You can view all obligations and their current status. To take action (transition a status, escalate, or dispute), click on the obligation and use the action buttons.

### Important Rules

- **Escalated** status means the obligation is past due. An escalation path reaches CEO level for high-severity obligations.
- **Disputed** status means the obligation is under active review — it is contested but not abandoned.
- Executive users can view all controls. Only `super_admin`, `admin`, and `hr` can create new obligations or make status transitions.
- The automated-changes view at `/admin/control-tower?tab=automated-changes` shows system-initiated pending changes that required human approval before being applied.

### Knowledge Check

1. Which two roles can create new governance obligations in the Control Tower?
2. What does "escalated" status mean for a governance control?
3. Can an executive user transition a governance control to "completed"?
4. Where would you find system-initiated pending changes that need review?
5. What does "disputed" status mean?

*(Answers: 1 — super_admin and admin (plus hr); 2 — The obligation is past its due date; 3 — No, executives are read-only for governance controls; 4 — Control Tower → Automated Changes tab; 5 — The obligation is contested and under active review)*

### Where to Get Help

Governance control state machine: `docs/workflows/WORKFLOW_STATE_MACHINES.md` §14. Contact HR or super_admin for status transition questions.

---

## Topic 4: Generating Statutory Reports

**Purpose:** Know how to export the statutory data needed for PF/ESI/PT government filing without requesting it from HR each time.

**Who uses it:** `executive`, `super_admin`.

**Where to find it:** `/admin/payroll/executive` → Statutory Export section.

### How to Use It

1. Go to `/admin/payroll/executive`.
2. Select the target month.
3. Click "Export Statutory".
4. Download the structured data file containing: employee-wise EPF wages, deductions, employer contributions, ESI wages, and contributions.

### Important Rules

- Always confirm the payroll run for the target month is in `executed` status (all payments confirmed) before submitting any statutory filing. Submitting before execution means the filing may not match the actual amounts paid.
- The export reflects the computation snapshot stored at slip generation time — it is the official record.
- ESI is computed only for employees below the statutory wage threshold. Employees above the threshold show ESI = 0.

### Knowledge Check

1. What status should a payroll run be in before you use its data for statutory filing?
2. Where do you generate the statutory export?
3. Why might an employee show ESI = 0 in the statutory export?
4. What does the computation snapshot represent?
5. Who else besides `executive` can access the statutory export?

*(Answers: 1 — executed; 2 — `/admin/payroll/executive`; 3 — They are above the ESI wage threshold; 4 — The immutable record of statutory computation values written at slip generation; 5 — super_admin)*

### Where to Get Help

Contact HR before submitting any government filing. If the statutory data appears incorrect, do not file — notify HR to investigate the payroll run.
