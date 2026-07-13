Status: Training track source material — reviewed and version-controlled
Generated from: docs/training/TRAINING_GAP_MAP.md, docs/platform/PRODUCT_CAPABILITY_MAP.md, docs/workflows/WORKFLOW_STATE_MACHINES.md, docs/workflows/BUSINESS_RULES_CATALOGUE.md
Date: 2026-07-13
Human approval required: Yes — this document is source material for human review before being committed to the live training track in the platform.
Unresolved items: 0

---

# Manager Onboarding — Training Track Source Material

**Purpose of this document:** This file is the reviewed, corrected, and version-controlled source material for the "Manager Onboarding" training track seeded in the platform under Task #1014. Update existing `track_sections` rows with this content after human review.

**Training track target audience:** Managers (role: `manager`).
**Track priority:** MEDIUM-HIGH — confirmed in `docs/training/TRAINING_GAP_MAP.md`.

Each section follows: Purpose → Who uses it → Where to find it → How to use it → Important rules → [Scenario / Common mistake / Practical exercise for high-risk] → Knowledge check → Where to get help.

---

## Topic 1: My Team — Navigation and Scope

**Purpose:** Understand which employees you can see and why, and navigate the My Team section without confusion.

**Who uses it:** `manager`, `hr`, `admin`, `super_admin`, `operations`.

**Where to find it:** `/admin/hr/my-team` — sidebar sub-navigation (not horizontal tabs).

### How to Use It

My Team uses the sidebar to navigate between three views:
- **Team** — roster of your direct reports with attendance and leave status
- **Corrections** — punch correction form for your team members
- **Plans** — employee development plans (probation, growth, PIP)

Your scope is determined by the `manager_id` field on each employee's record. You can only see employees where your user ID is recorded as their direct manager.

### Important Rules

- If an employee is not showing in your team, their `manager_id` is not set to your user ID. Contact HR to correct this.
- HR and admin roles see all employees, not just their direct reports.
- Corrections and Plans views only show your direct reports — the same scope as Team.

### Knowledge Check

1. What determines which employees appear in your team view?
2. If your team list shows zero members even though you manage people, what is the likely cause?
3. How do you navigate between the Team, Corrections, and Plans views?
4. Does the HR role have the same scope restriction as the manager role?
5. Where would you go to see your team's leave history for a specific employee?

*(Answers: 1 — The manager_id field on each employee record; 2 — Your user ID is not set as manager_id for those employees; 3 — Sidebar sub-navigation; 4 — No, HR sees all employees; 5 — Team view → click the employee row)*

### Where to Get Help

Contact HR to update reporting relationships. Navigation guide: `docs/design/CURRENT_SCREEN_INVENTORY.md` §My Team.

---

## Topic 2: Approving Leave Requests (HIGH RISK)

**Purpose:** Approve or reject team leave requests correctly, understanding the LWP implications and the 3-day correction rule so employees are not surprised by payroll deductions.

**Who uses it:** `manager`, `hr`, `admin`, `super_admin`.

**Where to find it:** `/admin/hr/leave-approvals`.

### How to Use It

1. Go to `/admin/hr/leave-approvals`. You see pending requests from your direct reports only.
2. Review each request: leave type (EL, SL, LWP), dates, net days (weekends and holidays excluded), and current balance.
3. Click "Approve" to approve, or "Reject" and enter a reason to reject.
4. The employee receives an email notification with your decision.

### Important Rules

- **Balance is not deducted on submission — only on approval.** If you approve, the balance reduces immediately.
- **Weekends and public holidays within the leave period are excluded** from the leave day count. A 5-day leave Mon–Fri spanning a bank holiday is only 4 days.
- **LWP split is decided at application time, not approval time.** If an employee applied for 5 EL days but only had 3 EL days in balance, the application was already split: 3 EL + 2 LWP. The LWP component means those 2 days will be deducted from the employee's salary. You see this split in the request details before you approve.
- Your approval is final for your team — there is no second HR approval layer for standard leave.
- You can only approve/reject for your direct reports. You cannot approve for employees outside your team.

### Common Mistake

Approving a leave request without noticing the LWP component. If an employee applied for 5 days but had only 3 EL days available, the request shows 3 EL + 2 LWP. Approving it means the employee will have 2 days docked from their salary. Always check for the LWP split in the request summary before approving.

### Scenario

An employee applies for 5 days of EL, but has only 2 EL days in balance. The request shows:
- EL requested: 5 days
- EL available: 2 days
- LWP portion: 3 days
- Dates: Monday to Friday (no public holiday, no weekend)

If you approve:
- 2 EL days are deducted from the employee's leave balance
- 3 LWP days are recorded — the employee's next payslip will show a pro-rated deduction

If the employee intended to use all EL and does not realize they only have 2 days, ask them to withdraw and reapply for 2 EL days only before you approve.

### Knowledge Check

1. When is leave balance deducted — when the request is submitted or when it is approved?
2. An employee applies for Monday to Friday leave. A public holiday falls on Wednesday. How many leave days are consumed?
3. What does it mean when a request shows a LWP component?
4. Can you approve a leave request for an employee not in your direct team?
5. After you approve a request, can it be undone?

*(Answers: 1 — On approval; 2 — 4 days (the holiday is excluded); 3 — The employee's balance was insufficient; the deficit becomes Leave Without Pay which is deducted from salary; 4 — No, manager scope is own direct reports only; 5 — Escalate to HR — there is no undo button for the manager)*

### Where to Get Help

Leave rules: `docs/workflows/BUSINESS_RULES_CATALOGUE.md` §Leave Management. Contact HR to reverse an incorrectly approved request.

---

## Topic 3: Employee Plans — Probation, Growth, and PIP

**Purpose:** Manage probation and PIP plans for your direct reports correctly, completing check-ins on time and recording outcomes accurately.

**Who uses it:** `manager`, `hr`, `admin`, `super_admin`.

**Where to find it:** `/admin/hr/my-team` → Plans tab.

### How to Use It

**Viewing plans:** Go to My Team → Plans. Each direct report's active plan (if any) is listed with its type, start date, and next due check-in.

**Completing a check-in:**
1. Click the plan to open it.
2. Find the overdue or upcoming check-in row.
3. Enter your notes, rating (1–5), and observations.
4. For Day 30, 60, and 90 milestone check-ins: add a formal milestone review score.
5. Click "Complete".

**Recording a plan outcome:**
1. Open the plan.
2. Click "Set Outcome" — choose from: passed, extended, failed, converted (to Growth), or terminated.
3. The outcome is locked after setting.

### Important Rules

- **Probation cadence:** Auto-generated 8 check-ins at Days 1, 7, 15, 30, 45, 60, 75, and 90 from plan start date.
- **3-strike escalation:** If 3 consecutive check-ins are missed, the plan status is escalated. An escalation notification goes to HR. Avoid missing check-ins.
- **PIP plans:** Weekly check-ins auto-generated for the plan duration.
- Plans seeded at offer acceptance will show `employee_id = NULL` until the candidate is formally onboarded. This is expected — not a data error.
- Coaching log entries (ad-hoc notes) are separate from plan check-ins. They do not affect the check-in cadence.

### Knowledge Check

1. On which days are probation check-ins scheduled?
2. What happens if 3 consecutive check-ins are missed?
3. Which check-in days are formal milestone reviews requiring a score?
4. What does a plan with `employee_id = NULL` indicate?
5. What is the difference between a coaching log entry and a plan check-in?

*(Answers: 1 — Days 1, 7, 15, 30, 45, 60, 75, 90; 2 — Plan is escalated; HR receives an escalation notification; 3 — Days 30, 60, and 90; 4 — The plan was seeded at offer acceptance before the candidate was formally onboarded; 5 — Coaching log entries are informal ad-hoc notes; check-ins are formal scheduled milestones that affect the plan cadence)*

### Where to Get Help

Employee plan state machine: `docs/workflows/WORKFLOW_STATE_MACHINES.md` §8. Check-in lifecycle: §11.

---

## Topic 4: Attendance Correction

**Purpose:** Correct missed or incorrect punch records for your team within the allowed window.

**Who uses it:** `manager`, `hr`, `admin`, `super_admin`.

**Where to find it:** `/admin/hr/my-team` → Corrections tab.

### How to Use It

1. Go to My Team → Corrections tab.
2. Select the employee and the date to correct.
3. Enter the correct punch-in and/or punch-out time.
4. Submit — the correction is saved and an audit log entry is created.

### Important Rules

- **3-day window:** Corrections can only be made within 3 calendar days of the date in question. Corrections older than 3 days cannot be processed through this interface.
- **Beyond 3 days:** The employee must raise a regularization ticket via Help Desk. HR then reviews and applies the correction.
- **Audit trail:** Every correction creates an audit log entry with your name as the corrector. This cannot be undone through the UI.
- Your correction scope is limited to your direct reports.

### Knowledge Check

1. What is the maximum age of an attendance record that a manager can correct directly?
2. How should an employee request a correction for a date more than 3 days ago?
3. Does a correction create an audit trail entry?
4. Can a manager correct attendance for employees outside their direct team?
5. What information is stored in the audit log for a correction?

*(Answers: 1 — 3 calendar days; 2 — Raise a regularization ticket via Help Desk; 3 — Yes; 4 — No; 5 — Corrector's name, employee, date, old and new punch times)*

### Where to Get Help

Raise a Help Desk ticket for out-of-window corrections. HR can apply the correction via the audit review queue.

---

## Topic 5: Generating Offer Letters as a Manager

**Purpose:** Create offer letters for candidates you are hiring while understanding why the approval step exists and what happens next.

**Who uses it:** `manager`, `hr`, `admin`, `super_admin`.

**Where to find it:** `/admin/new-hire` → Offer Letters tab.

### How to Use It

1. Go to `/admin/new-hire` → Offer Letters tab → click "Generate Offer Letter".
2. Fill in: candidate name, email, role, department, compensation, start date, and probation period.
3. Click "Create" — the offer enters `pending_approval` and is queued for super_admin review.
4. After super_admin approves, the offer email is sent to the candidate automatically.
5. Once the candidate accepts, HR handles the countersignature and onboarding steps.

### Important Rules

- Managers cannot approve their own offers — a super_admin must approve before the offer is dispatched.
- You will receive a notification when super_admin approves or rejects your offer.
- You can track the offer status in the Offer Letters dashboard (draft → pending_approval → approved → sent → viewed → accepted → countersigned → onboarded).
- You cannot cancel a sent offer — contact HR or super_admin for cancellations after dispatch.

### Knowledge Check

1. Why does a manager-generated offer enter `pending_approval` instead of being sent immediately?
2. Who must approve the offer before the candidate receives the email?
3. After the candidate accepts, what is the manager's next action?
4. Can a manager cancel an offer that has already been sent to the candidate?
5. How does the manager know when the candidate has accepted?

*(Answers: 1 — Non-super_admin creators require approval before dispatch; 2 — super_admin; 3 — None — HR handles countersigning and onboarding; 4 — No, contact HR or super_admin; 5 — Notification and status update in the Offer Letters dashboard)*

### Where to Get Help

Offer letter state machine: `docs/workflows/WORKFLOW_STATE_MACHINES.md` §1.
