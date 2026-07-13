Status: Training track source material — reviewed and version-controlled
Generated from: docs/training/TRAINING_GAP_MAP.md, docs/platform/PRODUCT_CAPABILITY_MAP.md, docs/workflows/BUSINESS_RULES_CATALOGUE.md
Date: 2026-07-13
Human approval required: Yes — this document is source material for human review before being committed to the live training track in the platform.
Unresolved items: 0

---

# Employee Onboarding — Training Track Source Material

**Purpose of this document:** This file is the reviewed, corrected, and version-controlled source material for the "Employee Onboarding" training track seeded in the platform under Task #1014. Update existing `track_sections` rows with this content after human review.

**Training track target audience:** All new employees (role: `employee`).
**Track priority:** LOW-MEDIUM — confirmed in `docs/training/TRAINING_GAP_MAP.md`.

Each section follows: Purpose → Who uses it → Where to find it → How to use it → Important rules → [Scenario / Common mistake / Practical exercise for high-risk] → Knowledge check → Where to get help.

---

## Topic 1: Logging In and Setting Up 2FA

**Purpose:** Get securely into the portal on your first day without getting locked out.

**Who uses it:** All employees.

**Where to find it:** `https://[your-portal-url]/admin/login`

### How to Use It

1. Open your welcome email — it contains your work email address and a temporary password.
2. Go to the admin portal login page. Enter your email and temporary password.
3. You are prompted to set up two-factor authentication (2FA). Open an authenticator app (Google Authenticator or Authy) and scan the QR code.
4. Enter the 6-digit code to confirm setup.
5. From this point, every login requires your password AND a 6-digit code from your authenticator app.

If you forget your password: click "Forgot Password" on the login page, enter your email, and follow the link in the reset email. The link expires in 1 hour.

### Important Rules

- **2FA is mandatory.** You cannot skip this step.
- **Your session expires after 30 minutes of inactivity.** You will be logged out automatically and must log in again.
- **Do not share your password or 2FA codes** with anyone — including HR.
- If you lose access to your authenticator app, contact HR to reset your 2FA.

### Knowledge Check

1. What two pieces of information do you need to log in after 2FA setup?
2. How long does a password reset link remain valid?
3. How long can your session remain inactive before you are automatically logged out?
4. Who should you contact if you lose access to your authenticator app?
5. Can you skip 2FA setup and log in with just your password?

*(Answers: 1 — Password and 6-digit authenticator code; 2 — 1 hour; 3 — 30 minutes; 4 — HR; 5 — No, 2FA is mandatory)*

### Where to Get Help

Contact HR if you cannot receive the password reset email or have lost your authenticator device.

---

## Topic 2: Leave Rules — When Your Leave Becomes LWP (HIGH RISK)

**Purpose:** Understand how leave balance works, when LWP (Leave Without Pay) is applied, and how LWP affects your salary — so you are never surprised by a smaller-than-expected paycheck.

**Who uses it:** All employees.

**Where to find it:** My Desk → Leave Balance tab, Apply Leave tab.

### How to Use It

**Viewing your balance:** Go to My Desk → Leave Balance tab. You see your current EL (Earned Leave), SL (Sick Leave), and LWP balance.

**Applying for leave:**
1. Go to My Desk → Apply Leave tab.
2. Select the leave type and dates.
3. The system shows you how many days will be consumed and flags any LWP component.
4. Submit — your manager receives a notification.
5. You receive an email when your manager decides.

### Important Rules

- **Leave balance grows monthly.** EL accrues after you work at least 128 hours in the previous month. SL accrues after your first 30 days of employment.
- **Weekends and public holidays are NOT counted as leave days.** A leave from Monday to Friday over a public-holiday Wednesday uses only 4 EL days.
- **LWP is automatic.** If you apply for more days than your balance allows, the system automatically splits your request: available days as EL/SL, deficit days as LWP. LWP days are deducted from your salary at the monthly pro-rated daily rate.
- **Balance is deducted when your manager approves**, not when you submit the request.

### Common Mistake

Applying for 10 EL days when you only have 6 EL in balance, not noticing the LWP component in the request summary, and then being surprised that 4 days are deducted from salary.

Always check the application summary before submitting — it clearly shows the EL portion and the LWP portion.

### Scenario

You want to take a week off (Monday to Friday). Your EL balance is 3 days. There are no public holidays that week.

When you apply:
- EL days consumed: 3
- LWP days: 2
- You will see this breakdown in the application form before submitting.

If you approve and submit: 3 EL days are deducted from your balance. 2 LWP days are recorded. Your next payslip will show a deduction of 2 × (monthly salary ÷ working days in the month).

To avoid LWP: apply for only 3 EL days. Take the remaining 2 days unpaid consciously, or split the leave into two applications.

### Knowledge Check

1. What happens to your leave application if you apply for more days than your EL balance allows?
2. Does a public holiday within your leave period count as a leave day used?
3. When is your leave balance deducted — on submission or on approval?
4. How many hours must you work in a month to earn your monthly EL accrual?
5. What does LWP mean for your paycheck?

*(Answers: 1 — The excess is automatically converted to LWP; 2 — No, holidays are excluded from the count; 3 — On approval; 4 — 128 hours; 5 — LWP days are deducted from your salary at the pro-rated daily rate)*

### Where to Get Help

Leave questions: contact HR. Check your balance at My Desk → Leave Balance tab before applying.

---

## Topic 3: Training Compliance Lock — What It Is and How to Resolve It

**Purpose:** Know what to do if you arrive at the portal and find yourself unable to access any pages except a compliance notice screen.

**Who uses it:** All employees.

**Where to find it:** `/admin/policy-gate` — the lock screen.

### How to Use It

**If you see the Policy Gate screen:**
1. Read the page — it lists the specific SOPs or training tracks that are overdue.
2. If you are in a `full` enforcement wave and have overdue training, you must complete the listed items before you can access the rest of the portal.
3. Click on each item to complete it directly from the gate screen.
4. Once all required items are acknowledged/completed, your access is restored automatically.

**If you cannot complete the training** (e.g., you need more time, or the content is unclear):
1. Contact HR and ask for a training exception.
2. HR can grant an exception that removes the lock without completing the training. Note: exceptions are permanent — you will not be asked to complete that item again.

### Important Rules

- The compliance lock only activates if two conditions are both true: (1) your training is overdue past the due date, AND (2) your rollout wave is set to `full` enforcement.
- Employees in `soft` or `measured` waves see a warning banner but their portal access is not restricted.
- The grace period is 15 days after the due date before the lock activates. `CONFIRMED_IN_CODE`
- Completing the overdue training unlocks access immediately — no HR action required.

### Knowledge Check

1. What two conditions must both be true for the compliance lock to activate?
2. Where do you see the list of overdue items that are causing the lock?
3. What happens to your portal access as soon as you complete all overdue training?
4. If your wave enforcement level is `soft`, will you be locked out for overdue training?
5. What is the trade-off when HR grants you a training exception?

*(Answers: 1 — Training is past due date, AND rollout wave is set to `full` enforcement; 2 — `/admin/policy-gate` (the lock screen); 3 — Access is restored immediately; 4 — No, only `full` enforcement locks; 5 — You permanently bypass that training requirement and will never be asked to complete it)*

### Where to Get Help

Contact HR to request a training exception or to clarify what content is required.

---

## Topic 4: Punching In and Out / Break Tracking

**Purpose:** Record your own attendance and breaks correctly so your hours are accurate for payroll and no corrections are needed.

**Who uses it:** All employees.

**Where to find it:** My Desk → Time Card tab.

### How to Use It

**Punch in:** Click the "Punch In" button at the start of your working day. A live hours counter starts.

**Punch out:** Click "Punch Out" when you finish work for the day.

**Breaks:**
- Lunch: Click "Start Lunch". You have 1 lunch break of up to 30 minutes per day.
- Tea: Click "Start Tea". You have up to 2 tea breaks of up to 15 minutes each per day.
- Click "End Break" when you return.

### Important Rules

- **Punch in when you start — do not wait until later in the day.** Forgetting to punch in means you appear absent. You have only 3 days to raise a correction.
- **Break warnings are soft** — the system warns you if you exceed your break allowance, but it does not block you. Consistent over-long breaks may be flagged in your attendance report.
- **3-day window for corrections.** If you forget to punch in or out, raise a regularization ticket at My Desk → Regularizations tab within 3 days of the missed date.

### Knowledge Check

1. How many lunch breaks are allowed per day, and how long can each be?
2. What must you do if you forget to punch in?
3. Does the system block you from working if you exceed your break allowance?
4. How many days do you have to raise a correction for a missed punch?
5. What tab do you use to raise a correction ticket?

*(Answers: 1 — 1 lunch break, up to 30 minutes; 2 — Raise a regularization ticket within 3 days; 3 — No, warnings are soft only; 4 — 3 calendar days; 5 — My Desk → Regularizations)*

### Where to Get Help

Raise a regularization ticket at My Desk → Regularizations for missed punches. Contact HR for correction requests older than 3 days.

---

## Topic 5: Salary Advance

**Purpose:** Know how to request a salary advance and understand how it is recovered from your salary.

**Who uses it:** All employees.

**Where to find it:** `/admin/salary-advance`.

### How to Use It

1. Go to `/admin/salary-advance`.
2. Click "Request Advance".
3. Enter the amount requested and select the number of monthly installments.
4. Submit — your manager receives an approval notification.
5. After manager approval, HR or super_admin gives final approval and disburses the advance.

Recovery is automatic: each month's salary slip will show a deduction of one installment until the advance is fully repaid.

### Important Rules

- You can have only one active advance at a time.
- Requests above 50% of your monthly salary are automatically escalated to CEO level and require super_admin approval.
- If your net salary in a recovery month is insufficient to cover the full installment, the shortfall carries forward to the next month — it is not lost.
- The `salary_advance_enabled` flag must be ON for self-service requests. If the button is not visible, contact HR — they can record an advance manually.

### Knowledge Check

1. How many active salary advances can you have at one time?
2. Who approves a salary advance request above 50% of your monthly salary?
3. What happens if your net salary in a recovery month cannot cover the full installment?
4. Where does the advance repayment appear on your payslip?
5. If the salary advance request button is not visible, what should you do?

*(Answers: 1 — One; 2 — super_admin (CEO escalation); 3 — The shortfall carries forward to the next month; 4 — As a deduction line item; 5 — Contact HR — they can record it manually regardless of the flag)*

### Where to Get Help

Contact HR for advance status questions or if you need a manual recording for an advance not eligible for self-service.
