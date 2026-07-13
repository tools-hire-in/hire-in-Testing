Status: Training track source material — reviewed and version-controlled
Generated from: docs/training/TRAINING_GAP_MAP.md, docs/workflows/WORKFLOW_STATE_MACHINES.md §1, docs/platform/PRODUCT_CAPABILITY_MAP.md
Date: 2026-07-13
Human approval required: Yes — this document is source material for human review before being committed to the live training track in the platform.
Unresolved items: 0

---

# Candidate: What Happens After Offer Acceptance — Training Track Source Material

**Purpose of this document:** This file is the reviewed, corrected, and version-controlled source material for the "Candidate: What Happens After Offer Acceptance" training track seeded in the platform under Task #1014. Update existing `track_sections` rows with this content after human review.

**Training track target audience:** New hires who have accepted an offer and are between acceptance and their first day.
**Track priority:** Confirmed gap from `docs/training/TRAINING_GAP_MAP.md`.
**Gap severity:** No candidate guide exists for the post-acceptance period. Candidates who accept have no documented expectation of what happens next, when to expect credentials, and what documents to prepare.

Each section follows: Purpose → Who uses it → Where to find it → How to use it → Important rules → Knowledge check → Where to get help.

---

## Topic 1: What Happens Immediately After You Accept

**Purpose:** Understand the sequence of events between your acceptance and receiving login credentials so you know what to expect and when to follow up.

**Who uses it:** All candidates who have accepted an offer.

**Where to find it:** `/onboard/:token` (the acceptance page you just completed).

### How to Use It

After you click "Accept Offer":

| Step | Who does it | When |
|---|---|---|
| Acceptance is recorded | System (immediately) | Right now |
| HR or authorized approver countersigns | HR | Usually within 1–2 business days |
| Welcome email with credentials sent | System (automated after countersign) | Shortly after countersign |
| You log in and complete 2FA setup | You | On receiving the welcome email |
| You upload required documents and bank details | You | Before your start date |
| Day 1 onboarding | You | Your joining date |

### Important Rules

- Your acceptance is immediate and binding. You can view the accepted offer letter as a PDF after accepting.
- You do NOT have login access yet — credentials are created and emailed only after HR countersigns.
- If you have not received credentials within 3 business days of accepting, contact the HR person who sent you the offer link.

### Knowledge Check

1. When does your acceptance take effect — immediately or after HR countersigns?
2. When do you receive your login credentials?
3. What should you do if you have not received credentials within 3 business days of accepting?
4. Does your acceptance give you immediate access to the admin portal?
5. Who countersigns the offer after you accept?

*(Answers: 1 — Immediately upon clicking Accept; 2 — After HR countersigns; 3 — Contact the HR person who sent the offer link; 4 — No, credentials are created only after countersign; 5 — HR or an authorized approver)*

### Where to Get Help

Contact the HR team member who sent you the offer link for any questions about the post-acceptance timeline.

---

## Topic 2: Setting Up Your Account on First Login

**Purpose:** Successfully log in and set up 2FA on your first attempt without getting locked out.

**Who uses it:** All new employees on their first login.

**Where to find it:** `https://[your-portal-url]/admin/login`

### How to Use It

1. Open your welcome email. It contains your work email address and a temporary password.
2. Go to the admin portal login page.
3. Enter your email and temporary password.
4. You are prompted to set up two-factor authentication (2FA). Open Google Authenticator or Authy on your phone and scan the QR code shown on screen.
5. Enter the 6-digit code shown in your authenticator app.
6. You are now logged in. Your session stays active for 30 minutes.

**Forgotten password:** Click "Forgot Password" on the login page. Enter your email. Follow the link in the email you receive — it expires in 1 hour.

### Important Rules

- 2FA is mandatory. There is no way to skip it.
- Your authenticator app generates a new 6-digit code every 30 seconds. Enter the current code shown in the app — do not wait if it is about to change.
- Do not share your password or authenticator codes with anyone.
- If you lose access to your authenticator (new phone, deleted app), contact HR to reset your 2FA.

### Knowledge Check

1. What two pieces of information do you need to log in after 2FA is set up?
2. How long does a session stay active if you are inactive?
3. What app do you use to generate the 6-digit code?
4. What should you do if you lose your authenticator device?
5. How long does a password reset link remain valid?

*(Answers: 1 — Password and 6-digit authenticator code; 2 — 30 minutes; 3 — Google Authenticator or Authy (or any TOTP-compatible app); 4 — Contact HR to reset 2FA; 5 — 1 hour)*

### Where to Get Help

Contact HR if you do not receive the welcome email, cannot log in, or need 2FA reset.

---

## Topic 3: Required Documents Before Your Start Date

**Purpose:** Know exactly what to prepare and upload before your first day so your payroll and compliance setup can be completed without delays.

**Who uses it:** All new employees.

**Where to find it:** `/admin/hr/my-documents` (available after login).

### How to Use It

1. Log in to the portal.
2. Go to `/admin/hr/my-documents`.
3. Review your document checklist — required items are marked.
4. Click "Upload" next to each required document and select the file from your device.

**Bank details for salary payment:**
1. From My Documents, click "Add Bank Details".
2. Enter: account holder name, account number, IFSC code, bank name, and account type (savings/current).
3. Save.

### Important Rules

- **Missing bank details will delay your first salary payment.** Enter them as soon as possible after logging in — do not wait until your first day.
- Required documents typically include: government ID (Aadhaar or equivalent), PAN card, address proof, and latest educational certificate. Your HR will specify which are required for your role.
- Night shift consent: if your role involves non-standard hours, you will see a consent form in your checklist. This must be completed before your first shift.
- Documents are reviewed by HR — they will notify you if any document is rejected or needs resubmission.

### Knowledge Check

1. Where do you upload your onboarding documents in the portal?
2. What information is required for bank details setup?
3. What is the consequence of not entering bank details before your first payroll cycle?
4. Where can you see if a document has been reviewed and accepted by HR?
5. Who notifies you if a document is rejected?

*(Answers: 1 — `/admin/hr/my-documents`; 2 — Account holder name, account number, IFSC code, bank name, account type; 3 — Your salary payment will be delayed until details are added; 4 — My Documents — verified items are marked; 5 — HR sends a notification)*

### Where to Get Help

Contact HR for questions about which documents are required for your specific role, or if a document is repeatedly rejected.

---

## Topic 4: Verifying Your Offer Letter

**Purpose:** Know how to use the public verification page so you can provide proof of employment to banks, landlords, or government agencies.

**Who uses it:** All employees (and any third party).

**Where to find it:** `/verify` (public page — no login required).

### How to Use It

Your accepted offer letter has a unique reference number and authentication code. These are shown on the offer letter itself (in the PDF).

To verify the letter:
1. Go to `https://[your-portal-url]/verify` from any browser — no account needed.
2. Enter the reference number and authentication code from the letter.
3. Click "Verify".
4. The page shows: letter type, issue date, your first name, and whether the letter is active or revoked.

### Important Rules

- Any member of the public can verify a letter using the reference number and auth code — this is intentional and enables banks and government bodies to confirm your employment.
- The verification page does not show your full personal details — only your first name, letter type, and status.
- If the letter is revoked (e.g., if the company reissued a corrected version), the verification page shows "Revoked" — not an error.
- The offer letter verification page covers offer letters and HR letters (experience, internship, relieving). Other documents use different verification paths.

### Knowledge Check

1. Do you need to log in to verify a letter at `/verify`?
2. What two pieces of information does a third party need to verify your letter?
3. What personal information is shown on the verification result?
4. If a third party receives "Revoked" when verifying your letter, what does that mean?
5. Can a bank use the `/verify` page to confirm your employment?

*(Answers: 1 — No, it is a public page; 2 — Reference number and authentication code; 3 — First name, letter type, issue date, and status; 4 — The letter has been withdrawn or replaced; contact HR for a reissued version; 5 — Yes)*

### Where to Get Help

Contact HR if your letter reference number does not work at `/verify`, or if a third party reports an unexpected verification result.

---

## Topic 5: Your First Week — What to Expect

**Purpose:** Know what your first week looks like in the system so you arrive prepared and nothing catches you off guard.

**Who uses it:** All new employees.

**Where to find it:** My Desk, My Training, My Team.

### How to Use It

| Day | What happens in the system |
|---|---|
| Day 1 | Manager completes Day 1 probation check-in. Training tracks are assigned. You receive email notification of assigned training. |
| Day 7 | Manager completes Day 7 check-in. You should have completed at least some assigned training sections. |
| Day 15 | Manager completes Day 15 check-in. Document checklist should be fully complete. |
| Day 30 | First formal milestone review (manager scores your progress). |
| Days 45–90 | Ongoing check-ins at scheduled milestones. |

**Training:** Go to `/admin/hr/my-training` to see your assigned tracks. Complete sections before due dates.

**Your probation plan:** Go to My Growth or My Team → Plans to see your active probation plan. You can view upcoming check-in dates and your manager's notes after each check-in.

### Important Rules

- Training due dates are real deadlines. Missing them may trigger the compliance lock (see Employee Onboarding Topic 3).
- Probation check-in dates are scheduled automatically — you do not need to request them. Your manager initiates each check-in.
- After each check-in, your manager's notes are visible to you in the plan.

### Knowledge Check

1. Who initiates the Day 1 probation check-in — you or your manager?
2. Where can you see your active probation plan and upcoming check-in dates?
3. What should be fully complete by Day 15?
4. What is the consequence of missing assigned training due dates?
5. After Day 30, can you read your manager's milestone review notes?

*(Answers: 1 — Your manager; 2 — My Growth or My Team → Plans; 3 — Document checklist (all required documents uploaded); 4 — May trigger the compliance lock; 5 — Yes, notes are visible to you after the check-in is marked complete)*

### Where to Get Help

Contact HR for questions about your training assignments or probation plan. Raise a Help Desk ticket at `/admin/help-desk` for any portal access issues.
