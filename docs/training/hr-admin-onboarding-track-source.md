Status: Training track source material — reviewed and version-controlled
Generated from: docs/training/TRAINING_GAP_MAP.md, docs/platform/PRODUCT_CAPABILITY_MAP.md, docs/workflows/BUSINESS_RULES_CATALOGUE.md, docs/workflows/WORKFLOW_STATE_MACHINES.md, docs/architecture/AUTH_RBAC_SECURITY.md
Date: 2026-07-13
Human approval required: Yes — this document is source material for human review before being committed to the live training track in the platform.
Unresolved items: 0

---

# HR Administrator Onboarding — Training Track Source Material

**Purpose of this document:** This file is the reviewed, corrected, and version-controlled source material for the "HR Administrator Onboarding" training track seeded in the platform under Task #1014. The content in this file should be used to update the `body` fields of the existing `track_sections` rows if the seeded content needs correction after human review.

**Training track target audience:** HR administrators (roles: `hr`, `admin`, `super_admin`).
**Track priority:** HIGH — confirmed in `docs/training/TRAINING_GAP_MAP.md`.

Each section covers one identified gap. Each follows: Purpose → Who uses it → Where to find it → How to use it → Important rules → [Scenario / Common mistake / Practical exercise for high-risk] → Knowledge check → Where to get help.

---

## Topic 1: Offer Letter Lifecycle

**Purpose:** Understand the complete offer letter workflow so you can move candidates from generation to onboarding without creating bottlenecks.

**Who uses it:** `hr`, `admin`, `super_admin`; `manager` (generate only).

**Where to find it:** `/admin/new-hire` → Offer Letters tab.

### How to Use It

| Step | Who does it | Action |
|---|---|---|
| Generate | HR, admin, manager | Fill in candidate details, compensation, start date → click Create |
| Approve | super_admin only | Offer enters `pending_approval` if creator is not super_admin → super_admin reviews and approves |
| Send to candidate | System (automated) | Email with acceptance link sent automatically after approval |
| Track | HR | Monitor status: sent → viewed → accepted |
| Countersign | HR, admin, super_admin | After candidate accepts, countersign in the dashboard |
| Onboard | HR | Click "Onboard" → employee account created, welcome email sent |

### Important Rules

- Only `super_admin` can approve offers. If you are `hr` and you generate an offer, it will NOT be emailed to the candidate until super_admin approves it.
- The `manager` role can generate and countersign offers they created, but cannot approve them.
- An expired offer can be reactivated by HR/admin. Only the `super_admin` can cancel a sent offer.
- The plan (probation or growth) is seeded with a NULL `employee_id` at acceptance — this is expected and resolves on onboarding.
- After countersigning, a cryptographic document hash is stored. The offer letter content is locked.

### Common Mistake

Creating an offer as an HR user and expecting it to be sent immediately. Offers from non-super_admin creators always enter `pending_approval` first. If a candidate does not receive the email, check whether the offer is still in `pending_approval` and contact super_admin to approve it.

### Knowledge Check

1. Which role must approve an offer before it is emailed to the candidate?
2. What status does an offer enter when a non-super_admin creates it?
3. What happens to the employee plan at the moment the candidate accepts?
4. Which tab in the New Hire section shows the offer letter pipeline?
5. After countersigning, can the offer letter content be edited?

*(Answers: 1 — super_admin; 2 — pending_approval; 3 — A plan is seeded with NULL employee_id; 4 — Offer Letters tab; 5 — No, the document hash is locked)*

### Where to Get Help

Offer letter state machine: `docs/workflows/WORKFLOW_STATE_MACHINES.md` §1. Status meanings are shown as tooltips in the dashboard.

---

## Topic 2: Monthly Payroll Run (HIGH RISK)

**Purpose:** Run the monthly payroll cycle correctly to avoid dispatching incorrect salary amounts to employees.

**Who uses it:** `hr`, `admin`, `super_admin` (generate, approve); `executive`, `super_admin` (final approval, disburse).

**Where to find it:** `/admin/payroll/run`

### How to Use It

**Step 1 — Finalize attendance:** Go to `/admin/hr/reports`, generate and approve the attendance report for the month, and click "Notify" to send it to employees. The attendance report must be in `notified` status.

**Step 2 — Generate the run:** Go to `/admin/payroll/run`, click "Generate Run" for the target month. The system computes amounts for all employees with salary structures assigned. Employees without an assigned structure are skipped gracefully.

**Step 3 — Review per-employee amounts:** Check gross pay, deductions (PF, ESI, PT), LOP, and advance repayments for each employee. Flag discrepancies before approving.

**Step 4 — Approve:** Click "Approve Run". This submits the run for final approval by an authorized approver.

**Step 5 — Dispatch slips:** After final approval, click "Send Slips". Salary slips are emailed to all employees in the run.

**Step 6 — Confirm payments:** After finance confirms each bank transfer, mark each employee as "Deposited", or click "Execute" to confirm the full run.

### Important Rules

- Salary advance recovery installments are locked once the run moves past `pending_approval`. Do not approve until recoveries are correct.
- Multiple active rows can exist in the payroll runs table — always filter by `is_active = true` when reading run data via the API (the UI does this automatically).
- Employees must have a salary structure assigned for India statutory deductions (PF, ESI, PT) to compute. Without a structure, only base salary and LOP are computed.
- Dispatched salary slips cannot be recalled. Corrections to an already-dispatched month must be made as adjustments in the following month's run.

### Common Mistake

Approving the payroll run before checking salary advance recovery amounts. Once approved, recovery installments cannot be edited. If an installment is incorrect, it must be corrected before the run reaches `pending_approval` status.

### Scenario

An HR user needs to run payroll for June 2026.

1. Confirm all attendance corrections and regularizations for June are processed.
2. Generate the June attendance report at `/admin/hr/reports`. Review for missing punches. Click "Notify".
3. Go to `/admin/payroll/run`. Click "Generate Run" → select June 2026.
4. Review each employee's line. Note any LOP deductions (expect these for employees who had LWP days in June).
5. Check salary advance repayment rows — confirm recovery amounts match agreed installments.
6. Click "Approve Run". super_admin or executive receives approval notification.
7. After final approval, click "Send Slips". Employees receive salary slip emails.
8. Finance confirms transfers → mark each employee "Deposited".

### Practical Exercise

Run a test payroll in the development environment for a single test employee with a complete salary structure. Verify that the PF and ESI amounts match manual calculations (Basic × 12% for PF; Gross × 0.75% for ESI if below threshold).

### Knowledge Check

1. What must the attendance report status be before generating a payroll run?
2. At what point are salary advance recovery amounts locked?
3. What happens to employees without a salary structure when a run is generated?
4. After salary slips are dispatched, how can a pay discrepancy for a single employee be corrected?
5. Who can authorize the final approval to disburse a payroll run?

*(Answers: 1 — notified; 2 — Once the run moves past pending_approval; 3 — They are skipped gracefully (no error); 4 — Issue an adjustment in the next month's run — dispatched slips cannot be recalled; 5 — super_admin, admin, or executive)*

### Where to Get Help

Payroll run state machine: `docs/workflows/WORKFLOW_STATE_MACHINES.md` §5. India statutory rules: `docs/workflows/BUSINESS_RULES_CATALOGUE.md` §India Statutory Payroll.

---

## Topic 3: HR Letters — Generating and Issuing

**Purpose:** Issue formal employment letters correctly with the right wording and verification trail.

**Who uses it:** `hr`, `admin`, `super_admin`.

**Where to find it:** `/admin/hr/tools` → HR Letters section.

### How to Use It

1. Select the employee from the search field.
2. Select the letter type: Experience, Internship, or Relieving.
3. Click "Generate" — the letter is created in `draft` status with pre-defined controlled wording.
4. Review the letter content — you cannot add custom free-form text outside designated fields.
5. Click "Issue" — assigns a unique reference number and auth code.
6. Click "Email" to send to the employee, or "Download" to retrieve the PDF.

To revoke an issued letter: click "Revoke". The reference number remains valid at `/verify` but returns "Revoked" status. The letter row is retained.

**Amendment letters** (Salary Revision, Designation/Promotion, Combined, Device Allocation): same flow but generates a DOCX file via the addendum engine. Optional email delivery.

### Important Rules

- Letters use controlled wording — free-form text outside designated fields is not supported. This is by design to prevent legally inconsistent language.
- Issued letters are verifiable at `/verify` by any third party using the reference number and auth code.
- Revoked letters are NOT deleted — the verification endpoint returns "Revoked" status, which is sufficient proof of revocation.
- Amendment letters are also verifiable via the same `/verify` endpoint.

### Knowledge Check

1. At which status does a letter become externally verifiable?
2. Can you add a custom paragraph to a letter using the HR tools generator?
3. What URL do third parties use to verify a letter?
4. If a letter is revoked, is the reference number still usable at `/verify`?
5. Which letter type requires the DOCX addendum engine?

*(Answers: 1 — After "Issue" (reference number and auth code are assigned); 2 — No, only controlled wording in designated fields; 3 — `/verify`; 4 — Yes — it returns "Revoked" status; 5 — Amendment letters)*

### Where to Get Help

HR Letter state machine: `docs/workflows/WORKFLOW_STATE_MACHINES.md` §12. Letter verification: public URL `/verify`.

---

## Topic 4: SOP Compliance Management

**Purpose:** Understand how to publish SOPs, configure enforcement, and manage exceptions so the compliance lock is not accidentally triggered for employees in the wrong wave.

**Who uses it:** `super_admin`, `admin` (configure); `hr`, `operations`, `manager` (view/manage acknowledgements).

**Where to find it:** `/admin/sops` (library); `/admin/sops/compliance` (employee view).

### How to Use It

**Publishing an SOP:**
1. Go to `/admin/sops` → click "Create SOP".
2. Fill in title, category, content, and assign applicable roles.
3. Submit for review → designated reviewer approves → SOP is published.

**Configuring wave rollout:**
1. In SOP settings, assign employees to rollout waves (Wave 0 = pilot; Wave 5 = full compliance lock).
2. Set the enforcement level per wave: `soft` (banner warning), `measured` (tracking), or `full` (compliance lock).

**Managing the compliance lock:**
- If an employee is locked at `/admin/policy-gate`, you can grant an exception: set `excepted = true` on their assignment row.
- An excepted employee permanently bypasses this SOP — use exceptions sparingly.

### Important Rules

- Only employees in waves with enforcement level `full` and overdue assignments are locked out.
- Employees in `soft` or `measured` waves see a warning banner but retain full portal access.
- Revised SOPs require re-acknowledgement from all assigned employees.
- Maximum ≤ 2 operational SOPs published per week (cadence limit). Wave 0 is exempt.

### Knowledge Check

1. Which enforcement level triggers the compliance lock that blocks portal access?
2. Can an employee in a `soft` enforcement wave be locked out of the portal for an overdue SOP?
3. What happens to an employee marked `excepted` on a training assignment?
4. How many operational SOPs can be published per week (outside Wave 0)?
5. Where does a locked employee see their overdue items?

*(Answers: 1 — `full`; 2 — No, only `full` enforcement triggers the lock; 3 — They permanently bypass that training requirement; 4 — ≤2 per week; 5 — `/admin/policy-gate`)*

### Where to Get Help

SOP state machine: `docs/workflows/WORKFLOW_STATE_MACHINES.md` §6 and §7.

---

## Topic 5: Manual Salary Advance Recording

**Purpose:** Record a salary advance or overpayment directly for an employee without going through the request/approval flow — used for correcting historical payroll or recording employer-initiated disbursements.

**Who uses it:** `super_admin`, `admin`, `hr`.

**Where to find it:** `/admin/salary-advance` → Active Advances → "Record for Employee".

### How to Use It

**Backfill advance:** Select amount, repayment months, and start month. Creates a `disbursed` advance record; the recovery engine handles monthly installments automatically.

**Overpayment:** The full amount is recovered in the next payroll cycle. Any remainder that cannot be recovered in one cycle carries forward.

The record is created as `disbursed` status — it enters the payroll recovery engine immediately without a separate approval step.

### Important Rules

- This tool works even when the `salary_advance_enabled` self-service flag is OFF. It is always available to authorized HR roles.
- The acting user's name is logged in the audit trail as the recorder.
- Rows show "Advance" or "Overpayment" badges plus a "Manually recorded" marker.
- Recovery is locked once the payroll run for the recovery month passes `pending_approval`.

### Knowledge Check

1. Does manual advance recording require the `salary_advance_enabled` feature flag to be ON?
2. What is the difference between a "backfill advance" and an "overpayment" in terms of recovery schedule?
3. Where is the recorder's identity logged?
4. What status does a manually recorded advance entry start with?
5. When does the recovery amount become locked and uneditable?

*(Answers: 1 — No, manual recording works regardless of the flag; 2 — Backfill: recovers over chosen monthly installments; Overpayment: full recovery in next cycle with carry-forward; 3 — audit trail; 4 — disbursed; 5 — When the payroll run for that recovery month passes pending_approval)*

### Where to Get Help

Salary advance state machine: `docs/workflows/WORKFLOW_STATE_MACHINES.md` §4.

---

## Topic 6: Feature Flags — What Each Flag Does

**Purpose:** Know what each feature flag controls so you can make informed decisions when toggling them in Settings. Toggling a flag incorrectly can disable a feature for all users or unexpectedly lock employees out.

**Who uses it:** `super_admin` (toggle); `hr` (view only).

**Where to find it:** `/admin/settings/feature-flags`.

### How to Use It

Flags are ON/OFF toggles. Turning a flag OFF disables the feature globally for all users immediately. There is no per-user or per-role scoping for flag changes — they apply platform-wide.

| Flag | What turning it OFF does |
|---|---|
| `salary_advance_enabled` | Disables employee self-service salary advance requests. HR manual recording still works. |
| `notifications_enabled` | Disables the in-app notification centre and bell badge for all users |
| `onboarding_training_enabled` | Disables training track assignments (existing assignments unaffected) |
| `performance_management_enabled` | Hides all Performance pages from all users |
| `document_reminder_emails` | Stops automatic document reminder emails to employees with incomplete checklists |
| `new_look` | Global kill-switch for v2 UI; overrides per-user newLook preference |
| `studio_v2_enabled` | Redirects `/studio/*` back to `/admin/studio/*` (legacy studio) |
| `process_governance` | Hides SOP Library and Compliance pages from all users |

### Important Rules

- Only `super_admin` can toggle feature flags.
- Changes take effect immediately — there is no staging or confirmation step.
- Disabling `process_governance` does NOT remove existing SOP acknowledgement records — it only hides the UI.
- Disabling `performance_management_enabled` does NOT delete existing goals, check-ins, or reviews.

### Knowledge Check

1. Who can toggle feature flags in the platform?
2. If you turn off `performance_management_enabled`, are existing performance review records deleted?
3. What is the difference between `salary_advance_enabled` OFF and manual advance recording being unavailable?
4. Which flag acts as the global kill-switch for the v2 UI redesign?
5. Does toggling a flag require a server restart?

*(Answers: 1 — super_admin only; 2 — No, records are preserved but hidden; 3 — The flag disables self-service requests but manual recording by HR always works regardless; 4 — `new_look`; 5 — No, changes take effect immediately)*

### Where to Get Help

Full flag list and three-place engineering rule: `docs/engineering/ENGINEERING_RUNBOOK.md` §Feature Flags.
