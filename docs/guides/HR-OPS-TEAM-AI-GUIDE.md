# HR & Ops Team AI User Guide — All AI-Rich HR Features

**Version:** July 2026  
**Audience:** HR Admins, Operations, Managers, and Employees  
**Purpose:** Practical reference for working with every automated and AI-assisted feature in the HR platform

---

## Automated Job Timings — Quick Reference

| Job | Runs at (IST) | Targets | Notes |
|---|---|---|---|
| Goal auto-progress sync | 07:00 IST daily | All active KPI-linked goals | Updates progress before absent sweep |
| Governance sync sweep | 07:00 IST daily | All open governance controls | Escalation evaluation + notifications |
| Absent sweep | 08:00 IST daily | **Yesterday's** IST calendar date | Proposes absences to pending_changes; never writes directly |
| Monthly leave accrual | 00:00 IST, 1st of month | Prior month | EL conditional on 128h threshold; SL unconditional after Day 30 |
| Salary report generation | 18:00 CST, last day of month | Current month | Saved as `pending_approval`; awaits admin approval |
| Attendance report month-end | 22:00 PST, last day of month | Current month | Creates/reconciles monthly attendance run |

---

## The New Role of HR and Ops

Your job used to involve chasing managers for status updates, manually generating documents one by one, and running reports from spreadsheets. That work has moved to the platform.

The platform's automation layer now handles the routine: attendance is swept nightly, leave accrues on the first of every month, salary slips compute statutory deductions automatically, compliance obligations escalate themselves if ignored, and onboarding checklists progress without prompting.

Your job now is **operating the automation layer** — reading its outputs each morning, knowing when to intervene, and handling the exceptions and judgment calls that no automated system should make alone. Every section in this guide tells you what the system does automatically, what it surfaces to you, and exactly when you need to act.

---

## Part 1: HR Admin and Operations Tools

---

### 1.1 Governance Control Tower

**Where:** People & HR → Control Tower (or the Governance Obligations card on your dashboard)

**What it does:**  
The Control Tower gives you a real-time compliance scorecard for the entire organization. Every trackable obligation — training completions, SOP acknowledgements, probation check-ins, PIP milestones, goal updates — is registered as a governance control record. The scorecard shows you, at a glance, how many controls are pending, overdue, or escalated, broken down by type and owner.

**The escalation ladder — how it works automatically:**  
The system escalates unresolved controls through four stages without any manual action from HR:

1. **Overdue** — The due date passes. The control is marked `overdue`. The employee's manager receives a notification.
2. **Escalated (Level 1)** — The control remains unresolved 48 hours past due (for most types; 24 hours for PIPs and probation). Status changes to `escalated`. The skip-level manager is notified. The direct manager receives a warning that the escalation has gone up.
3. **Escalated (Level 2)** — The control reaches the second escalation threshold. HR is notified directly.
4. **CEO Digest** — Controls that have been escalated past the `ceoReportThresholdLevel` appear in the executive digest. For PIPs, this threshold is set to zero, meaning PIP overrides go to CEO-level reporting immediately.

You do not need to send any of these notifications manually. The daily governance sync sweep, which runs at 7 AM IST, evaluates every open control and applies whatever escalation step is due.

**Reading the compliance scorecard:**  
Each section of the Control Tower shows a count and a percentage:
- **SOP compliance** — How many employees have acknowledged their assigned SOPs, broken down by wave.
- **Training compliance** — How many active employees are compliant vs. overdue vs. compliance-locked.
- **Plans** — Active PIPs, growth plans, and probation plans, with per-manager breakdown to see which managers have stalled plans.
- **Probation** — Milestones due within 7 days, and milestones missed in the last 14 days.
- **Goals** — On-track / at-risk / overdue split.
- **Check-ins** — Org-wide completion rate plus per-manager miss rates.
- **Action items** — A pre-ranked list of the highest-severity items requiring attention today.

**The weekly action digest:**  
Every Monday morning, run your team check-in using the Action Items list from the Control Tower as your agenda. Items are pre-ranked by severity (critical → warning → info) and include the employee name, manager, days overdue, and a direct link to the relevant screen. You do not need to prepare a report — the digest is the report.

**Exporting overdue items for leadership review:**  
To share overdue governance data outside the platform, use the Control Tower's export function:
1. Open People & HR → Control Tower.
2. In the Action Items section, set the filter to `critical` or `escalated` severity.
3. Use the **Export CSV** button (top-right of the Action Items table) to download the current overdue list with employee name, control type, days overdue, and assigned manager.
4. Share the CSV in your leadership meeting or paste the summary into your weekly ops report. The export reflects the state at the time of download — re-export on Monday morning for the freshest data.

**When to use it:**  
- Every Monday morning as your primary agenda-setting tool for the week ahead
- When a manager reports that an employee is unresponsive or performance is declining — check if any controls are already escalated for that employee before intervening
- Before a probation outcome decision — review the full control history for the employee
- Before payroll approval — confirm no open compliance items will affect the run

**One mistake to avoid:**  
Do not close a governance control without confirming the underlying action is actually complete. Closing a control marks it resolved in the audit trail. If you close a training control because the employee said they finished, but their completion record is not in the system, the next governance sync will re-open a new control for the same obligation.

---

### 1.2 Probation Milestone Engine

**Where:** My Team → Plans (for individual employees) | Control Tower → Probation section (org-wide)

**What it does:**  
Every employee on a probation plan gets 8 scheduled check-in milestones automatically generated: Day 1, Day 7, Day 15, Day 30, Day 45, Day 60, Day 75, and Day 90 from their probation start date. The system calculates the exact calendar date for each milestone from the plan's `start_date` and inserts the check-ins for the manager to complete. Weekends are not excluded from the count — Day 30 is 30 calendar days from start.

**Configuring a new employee's probation:**  
When an employee's offer is accepted, a probation plan is seeded with a `null` employee ID (pending). Once the employee's admin account is created and linked, HR assigns the `start_date` in the plan. The 8 milestones are generated from that date via the `backfillProbationCadence` function, which is idempotent — you can trigger it again without creating duplicates.

To set up probation correctly:
1. Go to My Team → Plans for the employee.
2. Confirm the probation plan's `start_date` matches the employee's actual joining date.
3. Check that the manager is correctly assigned — the check-ins are generated for the manager, not HR.

**What happens when a milestone is missed:**  
- Day 1–3 after the due date: the control moves to `overdue`. Manager is notified.
- After the configured `milestoneEscalateAfterDays` threshold (default 3 days): HR is notified directly — probation uses HR as the first escalation recipient, not skip-level manager.
- If 3 or more check-ins across the plan are overdue simultaneously: a "strike-threshold" finding is raised, which escalates to skip-level.

**Reading the at-risk dashboard:**  
In the Control Tower's Probation section, the "Due Soon" list shows employees with milestones falling within the next 7 days. Review this every Friday. If a milestone is due Monday and the manager has a pattern of missing check-ins, nudge them before the sweep catches it — that saves everyone the escalation noise.

**When to use it:**  
- When setting up a new employee's account after offer acceptance — confirm start date and manager assignment to trigger the 8-milestone cadence
- Every Friday — check the "Due Soon" list for milestones falling in the next 7 days and nudge managers proactively
- When a probation outcome is due — review completion of all 8 milestones before making the pass/fail decision

**One mistake to avoid:**  
Do not confuse coaching log entries with probation check-ins. Coaching log entries are ad-hoc notes a manager writes at any time. They appear in the audit trail but do not satisfy a probation milestone. Only a `completed` check-in record for the correct milestone date satisfies the governance control.

---

### 1.3 SOP Wave Rollout and Compliance Lock

**Where:** People & HR → SOPs | Control Tower → SOP section

**What it does:**  
SOPs are released to employees in waves. Each wave has a `wave_number` and an `operational_at` date (when the wave goes live). Once a wave is activated, all employees assigned to that wave must acknowledge their SOPs within the grace period (configured via `SOP_ACK_GRACE_DAYS`, default applies org-wide).

**What WAVE_DEFS means:**  
The wave configuration (`WAVE_DEFS`) is the master schedule — it defines which wave number corresponds to which operational date and enforcement mode. Wave 0 is typically exempt from hard enforcement (used for foundational policy documents that should be non-blocking during initial rollout). Waves 1 and beyond can be set to `soft` or `hard` enforcement.

- **Soft enforcement:** The employee sees a coaching banner on their dashboard reminding them to complete the SOP. They can still access all platform functions.
- **Hard enforcement (compliance lock):** The employee's platform access is restricted until they acknowledge the overdue SOP. They can still see their dashboard and the policy gate, but other navigation is blocked.

**Configuring wave membership:**  
Wave enrollment is managed at the SOP level (which wave a specific SOP belongs to) and at the employee level (which waves apply to their role or department). HR does not manually enroll individuals — the `resolveSopAccessForUser` function determines wave applicability per user. Non-pilot employees are never locked by waves that have not been activated.

**What compliance lock looks like from the employee's side:**  
The employee sees a full-screen gate when they try to navigate. The gate shows the overdue SOP name, a link to complete it, and a note that access will be restored immediately upon acknowledgement. The lock is lifted in real time — no HR intervention required.

**When to use it:**  
- When rolling out a new policy document — create the SOP, assign it to the correct wave, and set the `operational_at` date before notifying employees
- When an employee reports they cannot see a new SOP — check their wave membership and whether the wave's `operational_at` date has passed
- When reviewing compliance before a client audit — check wave acknowledgement percentages in the Control Tower's SOP section

**One mistake to avoid:**  
Do not activate a hard-enforcement wave without confirming that all employees in scope have had adequate time in the grace period. The grace period clock starts from `operational_at`. Activating a wave and immediately setting hard enforcement means employees who logged in after the activation date get zero grace days.

---

### 1.4 Training Compliance Enforcement

**Where:** My Team → Growth (for individual progress) | Control Tower → Training section (org-wide) | My Growth → Training (employee self-service)

**What it does:**  
Every active employee with assigned learning tracks and a `due_date` is evaluated nightly. If their due date passes and the track is not completed, they are marked overdue. Overdue training triggers a governance control, which escalates through the standard ladder to their manager, then skip-level, then HR.

**Compliance lock is immediate.** For lockable roles (hr, finance, manager, operations, employee), the training compliance lock is applied on the very next punch-in attempt after any training track goes overdue — there is no grace period beyond the original due date. `super_admin` and `admin` roles are exempt from locking. If a training extension has been approved and the new due date has not yet passed, the employee is not locked.

**Viewing team-wide training completion rates:**  
In the Control Tower's Training section, you see:
- **Total active** — All active employees
- **Compliant** — Employees with no overdue training (including training-exempt employees)
- **Overdue** — Employees with at least one overdue track
- **Locked** — Employees whose overdue status has triggered a compliance lock (non-admin roles only; `super_admin` and `admin` roles are exempt from locking)

**Granting exceptions:**  
If an employee has a legitimate reason to be overdue (medical leave, client emergency), a manager can submit a training extension request. When approved by HR, the system stores the new `new_due_date` and the overdue calculation respects it — the employee is no longer flagged overdue until the extended date passes. The approval creates an audit record showing who approved the exception and when.

**Minimum dwell time and quiz requirements:**  
Employees cannot rush through training by clicking through. Each section has a minimum dwell time configured by HR. Quizzes must be passed with the configured minimum score. The completion percentage shown in the Onboarding tab and on the Training Progress view reflects only genuinely completed content.

**Using training data in probation review:**  
At each probation milestone (especially Day 30 and Day 60), confirm the employee's training completion rate in the Probation section of My Team. Training completion percentage is shown on the Onboarding tab. An employee at Day 60 with less than 50% of their assigned training completed is an at-risk signal to document in the coaching log.

**When to use it:**  
- Every Monday — check the Locked count in Control Tower → Training; any locked employee needs immediate outreach before they attempt to punch in
- When assigning a new track to an employee — confirm the due date is realistic and the manager is aware
- When a manager requests more time for an employee on a training plan — approve the extension request through the governance control record

**One mistake to avoid:**  
Do not mark a track manually as complete on behalf of an employee. The system has no such backdoor, and any workaround bypasses the audit trail. If training was completed on an external platform or in a live session, the HR admin should record the completion evidence in the governance control's evidence field and close the control with a resolution note.

---

### 1.5 Onboarding Checklist Automation

**Where:** New Hire → Onboarding tab | Employee's My Desk (their own checklist progress)

**What it does:**  
When an employee's account is created, the guided onboarding checklist is computed automatically by `computeOnboardingChecklist`. The checklist covers 8 items organized into three sections:

| Item | Section | Applicable To |
|---|---|---|
| Sign your policies & consents | Growth | All roles |
| Turn on two-factor authentication | Profile | All roles |
| Complete your profile basics | Profile | Employees only |
| Add your LinkedIn URL | Profile | Employees only |
| Upload a headshot | Profile | Employees only |
| Add your bank details | Documents | Employees only |
| Add an emergency contact | Profile | Employees only |
| Upload required documents | Documents | Employees only |

Policy items are automatically bridged from annexures signed at offer acceptance — if the employee signed a growth clause addendum during the offer process, that is credited on their checklist without requiring them to sign again.

**Monitoring completion in the Onboarding tab:**  
The New Hire → Onboarding tab shows all employees who joined within the last 90 days or have a null joining date. For each employee, the tab displays:
- Training percentage completed
- Documents uploaded (count)
- Bank details on file (yes/no)
- Night-shift consent status (where applicable)

**Sending automated reminders:**  
The platform sends document reminder emails automatically when the `document_reminder_emails` feature flag is enabled. HR can also manually review the Onboarding tab and follow up with employees who have been onboarded for more than 2 weeks with incomplete checklists. Filter by "Documents not uploaded" to find the highest-priority cases.

**Night-shift consent:**  
Female employees in non-admin roles who work night shifts must have a valid active consent on file. The system checks consent expiry and flags it in the checklist. HR must collect a fresh consent before expiry — do not wait for the employee to flag it.

**When to use it:**  
- Every Monday — review the Onboarding tab for any employee beyond 14 days with incomplete documents or training below 50%
- When a new hire starts — confirm their checklist is accessible and that their joining date is correctly set (null joining date keeps them on the list indefinitely)
- When an employee says they have already signed their policies but the checklist shows incomplete — check whether the annexure was signed at offer acceptance; if so, it auto-credits and no re-signing is needed

**One mistake to avoid:**  
The onboarding checklist is informational only — it does not gate punch-in or any navigation. Do not tell an employee they cannot work until their checklist is 100% complete. The compliance lock mechanism (training/SOP) is separate from the onboarding checklist.

---

### 1.6 Leave Accrual Engine

**Where:** Automatic (no HR screen required) | Visible to employees: My Desk → Leaves → Accrual tab | Visible to HR: My Team → employee leave details

**What it does:**  
On the 1st of every month at 00:00 IST, the accrual engine runs for every active employee:

- **Earned Leave (EL):** 15 days per year, accrued monthly. The accrual is conditional — the employee must have worked at least **128 hours** in the preceding month to qualify. Employees in certain bonus months (configured in HR Settings) receive additional accrual.
- **Sick Leave (SL):** 8 days per year, accrued monthly after the first 30 days of employment. Accrual is unconditional (no hours threshold).

**What the 128-hour threshold means:**  
128 hours is approximately 16 working days at 8 hours each. An employee who took extended unpaid leave, had significant LWP days, or started mid-month may not meet this threshold. When they do not qualify, the accrual record is created with `qualified: false` and no balance is added. They can see this in the Accrual tab so there are no surprises.

**LWP gating:**  
If an employee applies for leave without a sufficient balance, the system checks whether the deficit should be recorded as Leave Without Pay (LWP). LWP days are deducted from the monthly payroll computation via the LOP (Loss of Pay) mechanism in the payroll engine. HR does not manually calculate LWP — it flows from the leave balance system to the payroll engine automatically.

**Year-end carry-forward and lapse:**  
At year-end, the engine runs a batch:
- EL carry-forward is capped (the configured maximum). Days above the cap lapse and are forfeited.
- SL does not carry forward — unused SL lapses at year-end.
- The batch is logged with an idempotency key, so re-running it does not create duplicate entries.

**When HR needs to manually intervene:**  
- An employee was incorrectly marked absent for a period and the accrual ran without them qualifying → correct the attendance records and request a manual accrual backfill.
- An employee on maternity leave should accrue leave for the period → the `maternityLeaveEligible` flag on their profile ensures accrual is not interrupted.
- An employee disputes their balance → the Accrual tab shows every monthly accrual record with the qualifying hours and result. Share this view with them.

**When to use it:**  
- When an employee disputes their leave balance — open the Accrual tab to show them the month-by-month record with qualifying hours
- At the start of a new year — verify the carry-forward/lapse batch ran correctly by checking a sample of EL balances
- When an employee returns from maternity leave — confirm the `maternityLeaveEligible` flag is set so accrual was not paused during their absence

**One mistake to avoid:**  
Do not manually edit leave balance rows directly. All adjustments should go through the leave management tools so the accrual ledger stays consistent with the displayed balance. Unauthorized direct edits create reconciliation failures at year-end.

---

### 1.7 Salary Slip Generation

**Where:** Reports & Compliance → Salary Slips | My Team → employee salary details

**What it does:**  
The India Statutory Payroll Engine automatically computes PF (EPF), ESI, and Professional Tax (PT) for every employee with a salary structure assigned. All computation is in integer paise (1/100 of a rupee) for precision — no floating-point rounding errors. ESI rounds **up** to the nearest paise.

**How the engine computes:**  
For each slip:
1. Gross salary is decomposed into components (Basic, HRA, etc.) per the employee's salary structure rules.
2. LOP fraction is applied proportionally or as fixed (per component configuration).
3. EPF is computed on the basis of `max(Basic after LOP, 50% of Gross after LOP)`. If the employee is in "restricted" mode, the basis is capped at ₹15,000.
4. ESI applies to the full gross-after-LOP if the employee is in the ESI coverage window (April–September or October–March contribution periods).
5. PT applies per state slab configuration, only if the establishment is registered in that state.
6. A waterfall subtracts deductions in strict order: statutory deductions → advance recovery → other deductions → net pay (floored at ₹0).

**Generating a slip:**  
Go to Reports & Compliance → Salary Slips. Select the employee and month. Click Generate. On the first render, the computation snapshot is written to the database — subsequent views use the stored snapshot unless you regenerate. Download the PDF for distribution.

**What triggers the computation snapshot:**  
The snapshot is written the first time the slip is rendered for a given employee and month. Once written, it is locked. If the payroll run for that month is approved or sent, the month is payroll-locked and no regeneration is possible. Correcting a slip after payroll lock requires HR admin intervention and an audit note.

**When to use it:**  
- At month-end, after the attendance report is reviewed and closed — generate slips for all employees with salary structures assigned
- When an employee requests a salary slip for a past month — select the month and generate; the stored snapshot is returned if already generated
- Before distributing slips — verify LOP days match the closed attendance report

**One mistake to avoid:**  
Do not generate salary slips before the attendance report for that month is finalized. The slip uses present days and LOP days from the attendance data. If you generate a slip mid-month or before the attendance report is closed, the LOP calculation will be wrong. Always generate slips after the monthly attendance report has been reviewed and approved.

---

### 1.8 Salary Advance Recording

**Where:** Salary Advance → Active Advances → "Record for Employee" button

**What it does:**  
HR, Admin, and Super Admin can record a salary advance or overpayment directly for any employee without going through the employee self-service request flow. This is the primary tool for correcting historical payroll records and for situations where an advance was given informally.

**Backfilled advance vs. overpayment — the difference:**

| | Backfilled Advance | Overpayment |
|---|---|---|
| Use case | Employee received money they need to repay over multiple months | Employee was paid more than they should have been |
| Recovery method | Spread across configured repayment months starting from a chosen month | Full amount recovered in the next payroll cycle; remainder carries forward |
| Status on creation | `disbursed` | `disbursed` |
| Recovery handled by | Monthly payroll recovery engine (oldest-first FIFO) | Next cycle, then remainder continues |

Both types appear in the Active Advances list with a badge ("Advance" or "Overpayment") and a "Manually recorded" marker. The audit trail captures which HR user created the record.

**What "disbursed" status means for payroll recovery:**  
Records created as `disbursed` are immediately picked up by the monthly payroll recovery engine. You do not need to approve them — they skip the request/approval flow entirely. At the next payroll run, the engine will include recovery deductions in the net-pay waterfall calculation.

**This works even when the self-service flag is OFF:**  
If the `salary_advance_enabled` feature flag is disabled (employees cannot request advances themselves), HR's manual recording tool is still fully functional. The flag controls employee self-service, not HR's administrative tools.

**When to use it:**  
- When an advance was given in cash or via bank transfer outside the platform — record it here so the payroll engine can recover it automatically
- When you discover an overpayment in a previous payroll run — record it as an Overpayment type so it is recovered in the next cycle
- When an employee leaves and has an outstanding advance balance — confirm the final payslip's net-pay waterfall includes the remaining recovery

**One mistake to avoid:**  
Do not record an advance twice. If a recovery is already in progress for an employee, adding another advance for the same amount compounds the recovery deduction in the next payroll cycle. Always check the Active Advances list before creating a new record.

---

### 1.9 Amendment Letters (AI-Assisted)

**Where:** People & HR → HR Tools → Amendment Letters

**What it does:**  
Amendment letters are formal addenda to an employee's employment contract. Four types are supported:

| Letter Type | Use Case |
|---|---|
| Salary Revision | Confirming a salary change with effective date and new components |
| Designation / Promotion | Confirming a role or title change |
| Combined | Simultaneous salary and designation change |
| Device Allocation | Documenting devices issued to the employee |

**How to generate:**  
1. Select the letter type.
2. Pick the employee from the system picker (pulls their current details automatically) or enter manually for contractors.
3. Fill in the specific amendment details (new salary, new designation, device details, effective date).
4. The platform generates a DOCX using the addendum engine — the same engine used for offer letter addendums.
5. Optionally, deliver the letter by email directly from the tool.

**DOCX generation:**  
The letter is produced from a template with the employee's details merged in. The DOCX is stored and linked to the employee's record. A reference number and authentication code are generated at creation, enabling public verification at `/verify`.

**How email delivery works:**  
If you choose to email the letter, the system sends it to the employee's email on file with the DOCX attached. A CC field is available for managers or legal. The email delivery is logged in the letter's record.

**When to use it:**  
- When completing a salary revision — generate the Salary Revision letter after the salary change record is approved in My Team → Salary Changes
- When an employee is promoted — generate a Designation / Promotion letter on the effective date of the role change
- When issuing a device — generate the Device Allocation letter before handing over the device so the record is in the system from day one

**One mistake to avoid:**  
Do not generate an amendment letter for a salary change before the salary change record has been approved in the salary changes ledger (My Team → Salary Changes). The ledger requires maker-checker approval. If you generate the letter first and then the salary change is not approved, you have distributed a letter that does not match the approved compensation record.

---

### 1.10 Document Verification (/verify)

**Where:** Public page at `/verify` — no login required

**What it does:**  
Every HR letter (experience letters, internship letters, relieving letters, amendment letters) has a **Reference Number** and an **Authentication Code** embedded in the document. Any person — an employee, a future employer, a client — can go to `hire-in.com/verify`, enter those two values, and confirm the letter is genuine and unaltered.

**How the cryptographic verification works:**  
When a letter is issued, the system computes a hash of the letter's content. The hash is stored alongside the letter record. When someone submits the reference number and auth code on `/verify`, the system retrieves the stored hash and compares it to the current document content. If they match, the letter is confirmed authentic. If the document was altered after issuance, the hash will not match.

**What to tell employees and clients:**  
- Employees: "Every letter we issue has a reference number and auth code printed at the bottom. If a company or bank asks to verify your letter, point them to hire-in.com/verify. They enter the two codes and get instant confirmation."
- Clients: "We can provide independently verifiable letters for any candidate we place. The verification is publicly accessible and cryptographically secured — no need to call us for confirmation."

**Use it as a fraud-prevention talking point:**  
In competitive staffing, forged offer letters and experience certificates are a known risk to clients. The `/verify` page is a concrete differentiator: your clients can verify every document we issue, in seconds, without contacting HR. Surface this in client proposals and onboarding conversations.

**When to use it:**  
- When issuing any HR letter — confirm the Reference Number and Auth Code are printed on the document before sending
- When a client or bank asks to verify a candidate's or employee's letter — direct them to `/verify` rather than calling HR
- When an employee reports a verification failure — check if the letter was amended after issuance, which would invalidate the stored hash

**One mistake to avoid:**  
The `/verify` page covers `hr_letter` and `contract` document types only. Offer letter acceptance hashes are separate and are not currently surfaced on the verify page. Do not tell candidates or clients that their offer letter acceptance can be verified at `/verify` — only issued HR letters and contracts can be checked there.

---

### 1.11 Absent Sweep and Pending Changes

**Where:** Admin → Pending Changes (Super Admin only for review)

**What it does:**  
At **8:00 AM IST**, the absent sweep runs and targets **yesterday's** IST calendar date. For every active employee who:
- Has a shift assigned
- Does not have a punch-in record for that day
- Does not have an approved leave record covering that day
- Is not on a weekend or public holiday

...the sweep **proposes** an "absent" attendance record. It does not write the record directly. It places the proposal in the `pending_changes` store for Super Admin review.

**Why this guardrail exists:**  
Attendance records directly affect LWP calculations, salary deductions, and leave accrual eligibility. Automated overwriting of attendance data without human review creates the risk of incorrect payroll deductions for employees who were present but experienced a technical issue with punch-in. The guardrail ensures a human confirms each absent marking before it becomes part of the employee's record.

**What the Super Admin review queue looks like:**  
The Pending Changes screen shows each proposed absent record with:
- Employee name and date
- The reason ("No punch-in recorded")
- The proposed change (status: absent)
- An Approve or Reject action

Approving writes the attendance row. Rejecting discards it permanently — the system's deduplication index ensures the same proposal cannot be recreated for a previously-reviewed date.

**What happens to unreviewed proposals:**  
If a proposal sits unreviewed for 3 days, it does not auto-approve. It remains pending indefinitely. Payroll for the relevant period will not include the absent deduction until the proposal is acted on. If the pending changes queue grows large (many unreviewed proposals), it is a signal that the Super Admin review cadence needs attention — include it in your Monday morning checklist.

**When to use it:**  
- Every Monday morning — review and clear the pending changes queue for the previous week (aim for zero proposals older than 3 days)
- When a manager disputes an absence marking — check whether the employee had a correction ticket pending at the time the sweep ran
- Before payroll approval — confirm all absent proposals for the pay period have been reviewed; unreviewed proposals are not included in LWP calculations

**One mistake to avoid:**  
Do not bulk-approve all pending absent proposals without checking for employees who submitted a punch-in correction (regularization) for the same day. If an employee filed a correction ticket that is still pending, approving the absent proposal will conflict with the correction when it is later approved. Check the Corrections tab for any pending requests before approving absent proposals for the same employees.

---

## Part 2: Manager Tools

---

### 2.1 Team Attendance Pulse Card

**Where:** My Desk (dashboard) — top section for manager/HR/admin roles

**What it does:**  
Every morning when you open the platform, the Team Pulse card shows four numbers updated in real time (refreshing every 60 seconds):
- **Present** — Team members who have punched in today (includes those still working)
- **Absent** — Team members with no attendance record and no leave approval for today
- **On Leave** — Team members with an approved leave request covering today
- **Pending Leaves** — Leave requests in `pending` status from your team awaiting your approval

**How to read it in under 2 minutes:**  
1. Check the Absent count. If it's higher than your team's typical pattern, click "View Team →" to see who is missing. Contact them if needed before the absent sweep runs at 8:00 AM IST the next morning and proposes them absent.
2. Check Pending Leaves. If the count is non-zero, there's a leave request waiting for you. Click "Review →" to act on it immediately.
3. Note the break status of anyone on your team — on-lunch and on-tea badges are visible in the full Team Attendance view.

**When to use it:**  
- Every morning when you open the platform — check before your first meeting so you know your team's status
- When someone is unexpectedly absent — use it to identify the gap and reach out before 8:00 AM IST the next day (when the absent sweep runs for that date)
- When leave requests are accumulating — the Pending Leaves count is a direct prompt to act before the 48-hour governance escalation clock expires

**One mistake to avoid:**  
The Absent count on the pulse card reflects employees with no attendance record as of the time you view it — not the final end-of-day count. An employee who comes in late and punches in at 11 AM IST will show as Absent until they punch in. Do not use the morning absent count as a definitive absence record. The absent sweep runs at 8:00 AM IST and evaluates yesterday's date — that sweep result (as proposals in Pending Changes) is the authoritative daily absent record.

---

### 2.2 Leave Request Approval Workflow

**Where:** My Desk → Team → Leave Approvals | My Team → Leave Approvals tab | Notification when a request is submitted

**What it does:**  
When a team member submits a leave request, you receive an in-app notification and an email. The request enters `pending` status. You can approve or reject it, and the decision is recorded with a timestamp and your name in the audit trail.

**The approval flow:**  
1. Employee submits request (specifying dates, leave type, reason).
2. You receive notification.
3. You review and either Approve (balance is deducted, leave record created) or Reject (balance untouched, employee notified of rejection with your comment).
4. If approved, the system automatically excludes those dates from the absent sweep for that employee.

**How to leave a rejection comment the employee will see:**  
When rejecting, the comment field is required. The comment appears in the employee's leave history and in the rejection notification email. Write a clear, specific reason — "Team capacity is low on those dates; please resubmit for the following week" is more useful than "Rejected."

**Half-day leave handling:**  
Employees can submit leave for half a day. The system handles the 0.5-day balance deduction automatically. On the attendance side, a half-day approval prevents the absent sweep from flagging that day entirely — the employee is not marked absent even if they were only in for half the day.

**Notification timing:**  
You receive a notification immediately when the request is submitted. If you do not act within 48 hours, the governance control for leave approval obligations moves to `overdue` and your skip-level manager is notified. Act within 24 hours as a best practice.

**When to use it:**  
- As soon as you receive a leave request notification — act within 24 hours as best practice; governance escalation starts at 48 hours
- When a team member is sick and calls in — have them submit the request from the platform (or submit it on their behalf if the platform allows) so the approval is on record before the absent sweep runs
- When a request spans a team crunch period — reject with a clear reason and suggest alternative dates

**One mistake to avoid:**  
Do not approve leave requests verbally and skip the platform approval. If the leave is not approved in the system, the absent sweep will mark the employee absent, the balance will not be deducted correctly, and your verbal approval creates a governance gap with no audit trail.

---

### 2.3 Coaching Log

**Where:** My Team → select employee → Coaching tab

**What it does:**  
The coaching log is your private field notes for informal performance conversations. You add entries any time — after a 1:1, after a difficult client call, after you notice a performance pattern. Each entry records the date, what was discussed, and any actions agreed upon.

**Coaching log vs. formal check-ins — the critical distinction:**  
| | Coaching Log | Probation Check-in / PIP Check-in |
|---|---|---|
| Scheduled? | No — ad hoc | Yes — system-generated cadence |
| Satisfies milestone? | No | Yes |
| Governance control? | No | Yes |
| Visible to HR? | Yes (in My Team view) | Yes |
| Visible to employee? | No (manager notes) | Referenced in formal reviews |

Coaching log entries feed into the probation review dashboard — HR can see coaching frequency and recency in the Governance Control Tower's plans section. An employee at Day 60 of probation with zero coaching log entries is a flag for HR review, even if all milestone check-ins are complete.

**When to use the coaching log:**  
- After any conversation about performance, behavior, or development that is not a scheduled milestone
- When you want to document that you addressed an issue before it escalated
- After a client complaint or commendation about a team member
- When you notice attendance patterns worth documenting before they become formal issues

**Audit trail implications:**  
Every coaching log entry is timestamped and attributed to you by name. Entries cannot be deleted. If you document something inaccurate, add a correction entry noting the error. Write entries as if they will be read in a formal review — because they may be.

**One mistake to avoid:**  
Do not use the coaching log as a substitute for completing scheduled probation or PIP check-ins. A coaching log entry on Day 30 does not satisfy the Day 30 milestone. The milestone check-in must be marked `completed` in the system separately.

---

### 2.4 Goal Auto-Progress Sync

**Where:** My Team → Goals | Performance → Team Goals

**What it does:**  
Goals linked to KPI sources (attendance metrics, ATS submission counts, SOP completion rates, training completion percentages) have their progress calculated automatically by the daily goal auto-progress sync, which runs at 7:00 AM IST every day.

**What the sync calculates:**  
- **Attendance-linked goals** — Pulls from the attendance table to compute present-day ratios, on-time rates, or total hours.
- **ATS-linked goals** — Queries submission and placement counts from the ATS integration.
- **SOP completion goals** — Pulls from the SOP employee progress table.
- **Training completion goals** — Pulls from track assignments and completions.

The sync computes the new progress percentage, compares it to the previous value, and flags anomalies (sudden drops, implausible spikes) for your review. It also flags goals that are at-risk or overdue for escalation.

**What you still need to do manually:**  
Goals that are not linked to a system data source — qualitative goals, client satisfaction goals, project delivery goals — require manual progress updates from the employee or you. The sync only computes what the system can measure. Assign numeric KPI sources wherever possible to maximize automation coverage.

**When manual progress update is still needed:**  
- A client project was completed ahead of schedule → you update the goal progress to 100% manually.
- An employee's goal is "deliver 3 client proposals" → you manually mark progress as each proposal is delivered.
- A system data source is temporarily unavailable → the sync skips the goal for that cycle and preserves the last known value.

**One mistake to avoid:**  
Do not manually override a KPI-synced goal's progress percentage. If the goal is linked to attendance data and you manually set it to 100% while attendance data shows 70%, the next sync will reset it back to the computed value. If the data source is wrong, fix the underlying data — not the goal progress.

---

### 2.5 Manager Compliance Dashboard

**Where:** Control Tower → Check-ins section (per-manager breakdown) | Your own Governance Obligations card on the dashboard

**What it does:**  
Your Governance Obligations card on the dashboard shows all governance controls currently assigned to you — check-ins you need to complete, training obligations, SOP acknowledgements. Each control shows its due date and current status.

The Control Tower's per-manager breakdown in the Check-ins section shows your completion rate: how many scheduled check-ins you completed vs. missed, and your consecutive miss count. If you have missed 3 or more check-ins consecutively, a warning appears in your skip-level manager's Control Tower view.

**What "overdue obligation" means:**  
An overdue obligation is a control that has passed its due date without being marked `completed` or `closed`. The due date is set when the control is created (check-in scheduled date, training due date, etc.). You have no grace period for most control types — overdue means the date passed and no action was taken.

**How to resolve overdue items before escalation triggers:**  
1. Complete the underlying action (finish the check-in, sign the SOP, complete the training).
2. Once the system detects the completion, the governance control auto-closes. You do not need to manually close it.
3. If the action was completed but the control has not closed (because the system has not synced yet — sync runs at 7 AM IST), you can submit evidence through the governance control record, which moves the status to `in_progress`.

**When to use it:**  
- Every morning — scan your Governance Obligations card before starting work; resolve anything in `overdue` before it escalates that day's sync
- Every Friday — clear all obligations before the weekend; the Monday 7 AM sweep will escalate anything still overdue to your skip-level
- When a control appears incorrectly assigned to you — contact HR to correct the owner before disputing

**One mistake to avoid:**  
Do not dispute a governance control to avoid escalation. Disputing a control flags it for HR review but does not pause the escalation ladder — escalation continues on schedule regardless of the dispute status. If you disagree with a control, file the dispute AND complete the action so you're not escalated while the dispute is reviewed.

---

## Part 3: Employee Self-Service

---

### 3.1 Self-Service Leave Application

**Where:** My Desk → Leaves tab (four sub-tabs: Balance / Apply / History / Accrual)

**What it does:**  
You manage all leave from the Leaves tab. The four tabs work together:

- **Balance** — Shows your current available days for each leave type (EL, SL, LWP, etc.) and how many you have used this year.
- **Apply** — The leave application form. Select dates, leave type, and add a reason. The system validates your balance and shows whether you have enough days. Dates that fall on weekends or public holidays are automatically excluded from the day count.
- **History** — Every leave request you have submitted with its current status (pending, approved, rejected), the reviewer's name, and any rejection comment.
- **Accrual** — Month-by-month accrual history. For each month, it shows whether you qualified (based on the 128-hour threshold for EL), how many days were accrued, and your running balance.

**How to read your accrual history:**  
Look at the Accrual tab to understand why your balance is what it is. If a month shows "Not qualified," you did not meet the 128-hour working threshold that month and no EL was added. Your SL accrual should show every month after your first 30 days of employment, regardless of hours worked.

**What LWP means if you apply without balance:**  
If you apply for leave and your balance is zero or insufficient, the application is processed as Leave Without Pay (LWP) for the deficit days. LWP days are deducted from your monthly salary at the end of the payroll cycle. The system calculates this automatically — you do not need to do anything extra, but you will see a lower net salary for that month.

**When to use it:**  
- When planning time off — check your Balance tab first, then submit from the Apply tab at least 5 business days before your leave starts
- When you return from leave — check your History tab to confirm the leave was approved and the balance was correctly deducted
- When you dispute your leave balance — open the Accrual tab and review month by month; if an error is visible, raise a ticket with HR

**One mistake to avoid:**  
Do not assume a submitted leave request is approved. Until your manager takes action, the status remains `pending`. Check the History tab after submitting to confirm receipt, and follow up with your manager if the request has been pending for more than 24 hours and your leave starts soon.

---

### 3.2 Break Tracking Widget

**Where:** My Desk dashboard (BreakWidget) | My Desk → Attendance tab (when punched in)

**What it does:**  
The break tracking widget lets you record lunch and tea breaks precisely. The policy is:
- **Lunch break:** 1 break per day, maximum 30 minutes
- **Tea breaks:** 2 breaks per day, maximum 15 minutes each

Click "Start Lunch" or "Start Tea" when you begin your break. A live timer shows how long you have been on break. Click "End Break" when you return. The system records exact start and end times.

**What a soft warning means:**  
If your break extends beyond the allowed duration (30 minutes for lunch, 15 minutes for tea), a soft warning appears on the widget. The warning is informational — it does not automatically deduct from your hours or mark you absent. However, excessive or frequent overruns are visible to your manager in the Team Attendance view with on-lunch/on-tea status badges, and may be discussed in a coaching conversation.

**Why breaks are tracked:**  
Break time is excluded from your total worked hours for the day. If you worked 8 hours including a 30-minute lunch, your recorded total is 7.5 hours. This matters for the 128-hour threshold for monthly leave accrual and for the short-day / half-day classification at punch-out.

**When to use it:**  
- Every time you take a lunch or tea break — click Start before leaving and End when you return; the live timer keeps you aware of duration
- When your day's hours seem lower than expected — check if a break was not ended; submit a regularization ticket if the timer ran on

**One mistake to avoid:**  
Do not forget to end your break. If you start a lunch break and do not click "End Break," the system keeps the timer running and your effective worked hours for the day continue to be reduced by break time. If this happens, submit a regularization ticket from the Attendance tab to correct the record.

---

### 3.3 My Training

**Where:** My Desk → My Growth tab | Navigation: My Growth

**What it does:**  
My Growth shows all learning tracks assigned to you — including onboarding training, SOP tracks, compliance modules, and any additional courses HR has assigned. Each track shows your progress percentage, due date, and current completion status.

**How to navigate assigned SOPs and training:**  
1. Click on a track to open it.
2. Work through each section in order. Sections with a minimum dwell time will not let you advance until the timer expires — this is intentional, not a bug.
3. Complete any quizzes with the minimum required score to mark the section complete.
4. After completing all sections, acknowledge the track. Your signature is recorded with a timestamp.

**What "minimum dwell time" means:**  
Each section has a minimum number of seconds you must spend on it before proceeding. If the section takes 5 minutes to read and the dwell time is 3 minutes, you can advance after 3 minutes even if you have not finished reading. The intent is to prevent speed-clicking through without engaging with the material, not to force you to read slowly. Actually reading the content is in your interest — quizzes test the material.

**What happens when training is overdue:**  
- A banner appears on your dashboard listing overdue training.
- Your manager receives a notification.
- **The compliance lock is immediate** — for roles hr, finance, manager, operations, and employee, your next punch-in attempt after the due date passes will be blocked with a "Portal locked due to overdue training" message. There is no grace period beyond your original due date. `super_admin` and `admin` roles are not subject to this lock. If your manager approved an extension and the new due date has not yet passed, you are not locked.
- The compliance lock is lifted in real time as soon as you complete and acknowledge the overdue track — no HR intervention needed.

**When to use it:**  
- When a new training track appears on your dashboard — start it immediately; the due date clock runs from assignment
- When you receive an overdue training notification — complete the overdue track the same day; for lockable roles the compliance lock triggers on your next punch-in attempt
- Before requesting an extension — confirm with your manager first; the extension request goes through them before HR approves it

**One mistake to avoid:**  
Do not close the training window mid-section and expect your progress to be saved. Progress is saved when you complete and move past a section. If you close in the middle of a section, you will need to restart that section (though previously completed sections are saved). Complete each section fully before navigating away.

---

### 3.4 Document Self-Verification

**Where:** My Desk → My Documents | Public: hire-in.com/verify

**What it does:**  
Every HR letter issued to you (experience letter, internship certificate, relieving letter, amendment letters) is stored in My Documents. You can view, download, and print any letter from there at any time.

**How to find your letters:**  
Go to My Desk → My Documents. Select the "Letters" or "HR Documents" filter. Each letter shows the document type, issue date, and download button. Letters are available indefinitely — they do not expire from the system even if you leave the company (as long as the HR admin has not revoked it).

**How to use /verify to confirm a letter's authenticity:**  
Every letter you receive has a Reference Number and Authentication Code printed on it. If you need to prove the letter is genuine to a bank, a new employer, or any other institution:
1. Ask them to visit `hire-in.com/verify`.
2. Provide them the Reference Number and Authentication Code from your letter.
3. They enter both values and the page confirms whether the letter is authentic, when it was issued, and its current status.

You can verify your own letters too — useful if you want to confirm a letter is still active before sharing it.

**When to contact HR if a document is missing:**  
- You joined more than 14 days ago and have no letters in My Documents → contact HR to issue your experience letter or welcome letter.
- A letter you previously saw in My Documents is no longer there → the letter may have been revoked by HR. Contact HR to understand why and request a reissuance if appropriate.
- Your letter has a name discrepancy (the platform shows a warning badge when your name has changed since issue) → contact HR to request a reissuance with your current name.

**One mistake to avoid:**  
Do not share your Authentication Code publicly. The auth code is the security credential for your letter. Anyone with both the Reference Number and Auth Code can verify the letter — which is intentional for legitimate verification — but sharing it carelessly (e.g., posting a photo of your letter online) means anyone can check your employment history without your consent.

---

## Part 4: Monday Morning Ops Checklist

Complete this checklist every Monday morning in under 30 minutes.

| # | Action | Where | What to look for |
|---|---|---|---|
| 1 | Review the Governance Control Tower action items list | People & HR → Control Tower | Any items severity `critical` or with 3+ days overdue. These are your agenda for the week. |
| 2 | Review pending absent sweep proposals | Pending Changes (Super Admin) | Approve or reject proposals from the previous week. Aim for zero pending proposals older than 3 days. |
| 3 | Check the Onboarding tab for new hires | New Hire → Onboarding | Any employees in the last 90 days with training below 50% or documents not uploaded. Follow up directly. |
| 4 | Review probation milestones due this week | Control Tower → Probation → Due Soon | Any milestones in the next 7 days. Confirm the manager has the check-in scheduled. |
| 5 | Check pending leave requests older than 24 hours | Leave Approvals | Any team-level requests sitting unapproved. Escalate to managers who have not acted. |
| 6 | Review SOP compliance wave percentages | Control Tower → SOP | Any wave below 80% acknowledgement. Identify employees not compliant and check if enforcement is soft or hard. |
| 7 | Check the training compliance locked count | Control Tower → Training | Any employees with `locked` status. These employees cannot use the platform fully until training is complete. Reach out before they notice the lock. |
| 8 | Review pending amendment letters requiring countersign | People & HR → HR Tools | Any letter in `pending_countersign` status for more than 48 hours. |
| 9 | Check salary advance Active Advances for overdue recoveries | Salary Advance → Active Advances | Any advances that show a recovery due this month but have not been picked up by the payroll engine. |
| 10 | Review the goals at-risk count in Control Tower | Control Tower → Goals | Any employees with escalated goals and no coaching log entry in the last 14 days. Log that as a coaching gap and alert the manager. |

---

## Part 5: Manager Weekly Actions

Five things every manager should do each week to stay compliant before the governance sweep catches them:

1. **Complete any scheduled probation or PIP check-ins due this week.** Check My Team → Plans. The check-in list shows scheduled dates. Complete them in the system, not just in a conversation.

2. **Act on all pending leave requests within 24 hours.** Any request older than 48 hours triggers an overdue governance control. Check your Governance Obligations card on the dashboard every morning.

3. **Add at least one coaching log entry for any team member currently on a performance plan.** Log a note after every 1:1, every client feedback conversation, and every behavioral observation. Zero coaching entries in a week on an active PIP is a red flag in the Control Tower.

4. **Review your team's attendance for the week in Team Attendance.** Look for anyone with more than 2 late punch-ins or a short-day / half-day record. Have a brief conversation before it becomes a pattern — document the conversation in the coaching log.

5. **Check your own Governance Obligations card.** Resolve any items in `overdue` status before Friday. The daily governance sweep runs at 7:00 AM IST every morning (including Monday) — anything still overdue over the weekend will be escalated to your skip-level manager at the start of the next work week.

---

## Part 6: Common Escalation Scenarios

---

### Scenario 1: A Probation Milestone Is Missed

**What the system does automatically:**
- Day of the missed check-in: status moves to `overdue`. Manager receives an in-app notification and email.
- 24 hours later (probation type uses a shorter escalation window): HR is notified directly.
- 72 hours later: HR receives a second alert. The control escalation level increments.
- If 3 or more check-ins across the plan are overdue simultaneously: a "strike-threshold" finding is raised. Skip-level manager is notified.

**What HR needs to do manually:**
- Check whether the manager completed the check-in in a meeting but forgot to log it in the system. If so, have the manager log it immediately.
- If the check-in genuinely did not happen, contact the manager to understand why and schedule the overdue check-in.
- If this is a pattern (manager has multiple overdue probation check-ins), escalate to the manager's skip-level and document the coaching gap in the audit trail.
- If the employee's probation period ends with incomplete milestones, HR must make an explicit probation outcome decision — the system does not auto-pass or auto-fail probation.

---

### Scenario 2: A Training Deadline Passes

**What the system does automatically:**
- Day after due date: employee's training control moves to `overdue`. Manager is notified.
- 48 hours later: control escalates to skip-level. Manager receives a warning.
- 120 hours later: HR is notified.
- **Compliance lock is applied immediately** on the employee's next punch-in attempt after the due date passes (for lockable roles: hr, finance, manager, operations, employee). The lock is entirely separate from SOP wave enforcement — it is triggered solely by an overdue training track with no approved extension. Employee cannot punch in until the overdue track is completed and acknowledged.

**What HR needs to do manually:**
- Determine if the employee needs a legitimate extension (medical leave, client crisis). If so, approve a training extension request — this pushes the due date and removes the overdue flag.
- If the employee is locked and claims they have completed the training on an external platform, verify the evidence (certificate, completion screenshot). Submit evidence to the governance control record and close it manually with a resolution note.
- If no legitimate reason: do not grant an extension. The escalation to HR means it is time to have a direct conversation with the employee about their training obligations.

---

### Scenario 3: A Manager Ignores Leave Requests for 48 Hours

**What the system does automatically:**
- 48 hours after submission: a governance control for the manager's leave approval obligation moves to `overdue`. Manager is notified.
- After the first escalation hours (typically 48 hours more): the manager's skip-level manager is notified. The manager receives a warning that the escalation has gone to their skip-level.

**What HR needs to do manually:**
- Review the Control Tower → Check-ins section for the manager's compliance rate. If this is a pattern (miss rate above 20% or consecutive misses), escalate formally.
- Contact the employee whose request is pending and confirm verbally whether they need a decision urgently (e.g., leave starts in 24 hours).
- If the employee's leave starts soon and the manager is unreachable, HR / Admin can approve the leave directly — HR and Admin roles have override authority on leave approvals.
- Log the pattern in the manager's coaching notes if this recurs.

---

### Scenario 4: An Absent Sweep Proposal Sits Unreviewed for 3 Days

**What the system does automatically:**
- Nothing. Proposals do not auto-approve, auto-expire, or escalate. They sit in the pending changes queue indefinitely.

**What HR needs to do manually:**
- The 3-day mark is the signal to act. If proposals are not reviewed within 3 days, the monthly attendance report will be inaccurate and payroll will not correctly reflect absences for those employees.
- Before approving: cross-check each absent proposal against the Corrections tab. If the employee has a pending regularization for that date, hold the approval until the correction is reviewed first.
- If the employee is confirmed absent (no correction pending, manager confirms absence): approve the proposal. The attendance row is written with `[Auto] No punch-in recorded` in the notes.
- If the employee was actually present but the punch-in failed technically: reject the proposal and submit a manual attendance correction through My Team → Corrections.
- Establish a weekly cadence: Pending Changes should be reviewed every Monday. More than 10 unreviewed proposals is a queue management problem, not just a data problem.

---

*This guide is current as of July 2026. For questions about specific features not covered here, contact the platform administrator or open a support ticket through the internal helpdesk.*
