Status: Current-state practitioner reference
Generated from: Phase 1 documents (PRODUCT_CAPABILITY_MAP.md, WORKFLOW_STATE_MACHINES.md, BUSINESS_RULES_CATALOGUE.md, AUTH_RBAC_SECURITY.md, DATABASE_ARCHITECTURE.md) plus targeted codebase reads
Date: 2026-07-13
Human approval required: Yes — for all UNABLE_TO_CONFIRM items listed within
Unresolved items: 6 — see inline UNABLE_TO_CONFIRM flags

---

# Current Feature Build Reference

This document is the combined product and engineering reference for every P0 and P1 feature. It uses Phase 1 documents as its primary source. P2 and P3 features receive a one-line stub with a pointer back to `docs/platform/PRODUCT_CAPABILITY_MAP.md`.

**Priority tiers used in this document:**
- P0: Core platform features required for daily HR operations and recruitment.
- P1: Important features used regularly by non-employee roles.
- P2/P3: Supporting or advanced features; stub entries only.

---

## Domain: My Desk / Command Center

### My Desk (Command Center)

**Priority:** P0

**Purpose:** The primary landing page for all authenticated users. Renders a role-specific view — employees see their personal time card, leave balances, and quick actions; managers and HR see a team pulse card in addition to their own work items. The `executive` role redirects directly to `/admin/executive-cockpit`.

**Current users:** All roles. `CONFIRMED_IN_CODE`

**Entry screen and route:** `/admin/my-desk` — `client/src/pages/admin/my-desk/MyDesk.tsx`

**Frontend components:** `MyDesk.tsx` (main shell), `HRDashboard` (manager/HR pulse card), `BreakWidget` (break tracking), attendance time-card tabs

**Backend routes and methods:**
- `GET /api/auth/me` — session user
- `GET /api/hr/dashboard-stats` — today's attendance, leave summary, team pulse counts
- `GET /api/attendance` — own attendance records
- `GET /api/leave-requests` — own leave requests

**Database tables read:** `attendance`, `leave_requests`, `leave_balances`, `admin_users`, `break_records`

**Database tables written:** `attendance` (punch in/out), `break_records` (break start/end)

**Permissions required:** `requireAuth` only — any authenticated user. `CONFIRMED_IN_CODE`

**Workflow:** See Attendance state machine in `docs/workflows/WORKFLOW_STATE_MACHINES.md` §3.

**Business rules applied:** Attendance sweep (absent marking), break policy soft warnings (1×30min lunch, 2×15min tea). Full rules in `docs/workflows/BUSINESS_RULES_CATALOGUE.md` §Attendance.

**Notifications triggered:** None directly from the dashboard.

**Audit events logged:** Punch in/out actions do not generate separate audit log entries; attendance row is the record.

**Error behavior:** If `dashboard-stats` endpoint fails, the dashboard degrades gracefully (punch button may not render). Bug history: a missing `today` variable in the endpoint previously caused 500 errors hiding the punch button. `CONFIRMED_IN_EXISTING_GUIDE`

**Known limitations:** Employee and manager/HR views share the same route but render different layouts. The break widget is soft-warning only — server does not reject over-duration breaks.

---

### Break Tracking

**Priority:** P0

**Purpose:** Allows employees to log Lunch (1×30min, once per day) and Tea (2×15min, twice per day) breaks with a live timer. Managers see `on_lunch` / `on_tea` status badges in the Team Attendance view.

**Current users:** employee (self), manager/HR/admin (view team status). `CONFIRMED_IN_CODE`

**Entry screen and route:** `/admin/my-desk` (BreakWidget on dashboard and Attendance tab), `/admin/hr/team-attendance` (badge display)

**Frontend components:** `BreakWidget`, team attendance badge renderer

**Backend routes:** `POST /api/attendance/break/start`, `POST /api/attendance/break/end`, `GET /api/attendance/breaks/today`

**Database tables written:** `break_records`
**Database tables read:** `break_records`

**Permissions required:** `requireAuth`. `CONFIRMED_IN_CODE`

**Business rules applied:** Soft warning only; server does not enforce break duration or daily count limits. `CONFIRMED_IN_CODE`

**Notifications triggered:** None.
**Audit events logged:** None.
**Error behavior:** If break API fails, timer continues client-side but break is not persisted.
**Known limitations:** Policy not hard-enforced server-side. Soft warnings are UI-only.

---

### Leave Management (Self-Service)

**Priority:** P0

**Purpose:** Enables all employees to apply for leave, view their current balances across leave types, track application history, and view their monthly accrual log. LWP splitting is automatic when balance is exhausted.

**Current users:** All roles (own records only). `CONFIRMED_IN_CODE`

**Entry screen and route:** `/admin/my-desk` (Leaves tab, Apply-Leave tab, Leave-History tab, Accrual tab)

**Frontend components:** Leave balance card, leave application form, leave history table, accrual log

**Backend routes:**
- `GET /api/leave-balances` — current balances
- `POST /api/leave-requests` — submit application
- `GET /api/leave-requests` — own history
- `GET /api/leave-accruals` — accrual log

**Database tables written:** `leave_requests`, `leave_balances`
**Database tables read:** `leave_requests`, `leave_balances`, `leave_accruals`, `holidays`, `shifts`

**Permissions required:** `requireAuth`. Employee sees own records only. `CONFIRMED_IN_CODE`

**Workflow:** Leave Request Lifecycle — `docs/workflows/WORKFLOW_STATE_MACHINES.md` §2.

**Business rules applied:** LWP gating (balance exhausted → deficit becomes LWP), weekend/holiday exclusion, EL accrual 128h threshold, SL 30-day eligibility. Full rules in `docs/workflows/BUSINESS_RULES_CATALOGUE.md` §Leave Management.

**Notifications triggered:** Email and in-app notification to manager/HR on submission; decision email to employee on approval/rejection. `CONFIRMED_IN_CODE`

**Audit events logged:** No dedicated audit log entry; leave request row is the record.

**Error behavior:** If the leave API fails on submission, form returns an error toast. Balance is not deducted until approval.

**Known limitations:** LWP split is calculated automatically without employee confirmation. Year-end lapse is applied by the batch cron.

---

### Holiday Calendar

**Priority:** P1

**Purpose:** Displays the company-wide holiday list for the year. Employees may opt in to optional regional holidays (once per year per holiday).

**Current users:** All roles. `CONFIRMED_IN_CODE`

**Entry screen and route:** `/admin/my-desk` (Holidays / Leave-Calendar tab)

**Backend routes:** `GET /api/holidays`, `POST /api/regional-holiday-selections`

**Database tables read:** `holidays`, `regional_holiday_selections`
**Database tables written:** `regional_holiday_selections`

**Permissions required:** `requireAuth` only — all authenticated roles can view holidays and opt in to regional holidays. `CONFIRMED_IN_CODE`

**Business rules applied:** Unique index on (user_id, holiday_id, year) prevents duplicate regional holiday selections. `CONFIRMED_IN_SCHEMA`

**Notifications triggered:** None.

**Audit events logged:** None dedicated.

**Error behavior:** Duplicate regional holiday opt-in returns 409 (unique constraint violation).

**Known limitations:** None confirmed.

---

## Domain: HR and People Management

### Employee Directory

**Priority:** P0

**Purpose:** Central registry of all workforce records. Allows authorized roles to create, view, edit, and deactivate employee accounts. Supports CSV bulk upload for mass onboarding.

**Current users:** super_admin, admin, hr, manager (create/patch), operations (no access), recruiter (no access), employee (no access). `CONFIRMED_IN_CODE`

**Entry screen and route:** `/admin/users` and `/admin/hr/people` (Users tab)

**Frontend components:** `AdminUsers`, `PeopleHR`

**Backend routes:**
- `GET /api/users` — list all users
- `POST /api/users` — create user
- `PATCH /api/users/:id` — update user
- `DELETE /api/users/:id` (soft-delete, super_admin only)
- `POST /api/users/bulk-upload` — CSV import

**Database tables written:** `admin_users`
**Database tables read:** `admin_users`, `departments`, `shifts`

**Permissions required:** `requirePermission('admin.users', ...)`. Manager scope: can only create/patch, cannot delete. `CONFIRMED_IN_CODE`

**Business rules applied:** Soft delete sets `deleted_at` — account becomes inaccessible but row is retained. `CONFIRMED_IN_CODE`

**Notifications triggered:** Welcome email sent on user creation via SendGrid. `CONFIRMED_IN_CODE`

**Audit events logged:** None dedicated; changes visible in profile history.

**Error behavior:** Duplicate email returns 400. Deactivated account login returns 403.

**Known limitations:** `manager_id` column has no DB-level FK constraint (ORM-only). `CONFIRMED_IN_CODE`

---

### My Team

**Priority:** P0

**Purpose:** Provides managers and HR with a consolidated view of their direct reports — attendance, leave, profile details, corrections, audit trail, and employee plans — via a sidebar sub-navigation with internal tabs.

**Current users:** super_admin, admin, hr, manager, operations. `CONFIRMED_IN_CODE`

**Entry screen and route:** `/admin/hr/my-team` — `client/src/pages/admin/hr/MyTeamTabs.tsx`

**Tabs available:** Team roster, Corrections, Plans

**Backend routes:**
- `GET /api/hr/team` — direct reports list
- `GET /api/attendance?userId=:id` — team member attendance
- `GET /api/leave-requests?userId=:id` — team member leave
- `POST /api/attendance/:id/correct` — punch correction
- `GET /api/hr/plans` — employee plans

**Database tables read:** `admin_users`, `attendance`, `leave_requests`, `employee_plans`, `audit_logs`
**Database tables written:** `attendance` (corrections), `audit_logs`

**Permissions required:** `requirePermission('admin.myTeam', ...)`. Manager scope limited to own direct reports via `WHERE manager_id = $1` filter. `CONFIRMED_IN_CODE`

**Business rules applied:** Managers can only view and correct attendance for own direct reports. 3-day correction window for regularizations. `CONFIRMED_IN_CODE`

**Notifications triggered:** None on correction.
**Audit events logged:** Attendance correction writes to `audit_logs`. `CONFIRMED_IN_CODE`

**Error behavior:** Attempting correction outside 3-day window returns 400.

**Known limitations:** My Team uses sidebar sub-navigation, not horizontal tabs. Only one level of internal tabs is supported to avoid nesting issues.

---

### Leave Approvals

**Priority:** P0

**Purpose:** Allows managers, HR, and admins to review pending leave requests from their team, approve or reject each request with an optional comment, and view the approval history.

**Current users:** super_admin, admin, hr, manager (own team only). `CONFIRMED_IN_CODE`

**Entry screen and route:** `/admin/hr/leave-approvals` — `client/src/pages/admin/hr/LeaveApprovals.tsx`

**Backend routes:**
- `GET /api/leave-requests?status=pending` — pending requests queue
- `POST /api/leave-requests/:id/approve` — approve
- `POST /api/leave-requests/:id/reject` — reject with reason

**Database tables written:** `leave_requests`, `leave_balances`
**Database tables read:** `leave_requests`, `leave_balances`, `admin_users`

**Permissions required:** `requirePermission('hr.leaveRequests.myTeam', ...)`. `CONFIRMED_IN_CODE`

**Business rules applied:** Manager may only approve/reject for direct reports. LWP split computed at time of application, not approval. Balance deducted on approval. `CONFIRMED_IN_CODE`

**Notifications triggered:** Email and in-app notification to employee on decision. `CONFIRMED_IN_CODE`

**Audit events logged:** None dedicated; leave request status change is the record.
**Error behavior:** Approving already-approved leave returns 400.
**Known limitations:** No bulk approval action.

---

### Employee Profile

**Priority:** P1

**Purpose:** Employee's self-service profile page. Shows personal details, LinkedIn URL, profile photo, and notification preferences.

**Current users:** All roles (own profile). `CONFIRMED_IN_CODE`

**Entry screen and route:** `/admin/profile`

**Backend routes:** `GET /api/auth/me`, `PATCH /api/auth/me/preferences`, `GET /api/hr/my-profile`

**Database tables read:** `admin_users`
**Database tables written:** `admin_users` (preferences, LinkedIn URL, avatar)

**Permissions required:** `requireAuth` only — every role can view and edit their own profile. `CONFIRMED_IN_CODE`

**Business rules applied:** Employees can only read and update their own record. HR/admin editing an employee's HR profile is a separate path via People & HR. `CONFIRMED_IN_CODE`

**Notifications triggered:** None.

**Audit events logged:** None dedicated.

**Error behavior:** PATCH with invalid preferences payload returns 400.

**Known limitations:** Bank details and emergency contacts are managed separately under My Documents.

---

### Org Chart

**Priority:** P1

**Purpose:** Visual hierarchy display. Reads manager_id relationships to render a tree of the organization.

**Current users:** All roles. `CONFIRMED_IN_CODE`

**Entry screen and route:** `/admin/hr/org-chart`

**Backend routes:** `GET /api/users` (full list, manager_id used for tree construction)

**Database tables read:** `admin_users`
**Database tables written:** None (read-only display).

**Permissions required:** `requireAuth` only. No write operations — all roles can view. `CONFIRMED_IN_CODE`

**Business rules applied:** Tree is built client-side from the flat user list using manager_id relationships. Root nodes are employees with no manager or whose manager is not in the list. `CONFIRMED_IN_CODE`

**Notifications triggered:** None.

**Audit events logged:** None (read-only feature).

**Error behavior:** Error toast if the user list fails to load.

**Known limitations:** `manager_id` has no DB FK constraint. Orphaned or NULL manager_id nodes fall through hierarchy. `CONFIRMED_IN_CODE`

---

### Post-Onboarding Documents

**Priority:** P1

**Purpose:** Document compliance checklist for employees. HR can upload, verify, mark required/optional, and send reminder emails. Employees see their own document status.

**Current users:** super_admin, admin, hr (manage); all roles (own documents). `CONFIRMED_IN_CODE`

**Entry screen and route:** `/admin/hr/my-documents`

**Backend routes:** `GET /api/employee-documents`, `POST /api/employee-documents/upload`, `PATCH /api/employee-documents/:id/verify`

**Database tables written:** `employee_documents`
**Database tables read:** `employee_documents`, `admin_users`

**Permissions required:** `requireAuth` (own records); `requirePermission('hr.users', ...)` to verify or manage documents for any employee. `CONFIRMED_IN_CODE`

**Business rules applied:** Document status transitions: pending → verified or rejected. Rejected documents display a rejection reason to the employee. `CONFIRMED_IN_CODE`

**Notifications triggered:** Reminder emails when `document_reminder_emails` flag is ON. `CONFIRMED_IN_CODE`

**Audit events logged:** None dedicated.

**Error behavior:** Upload of disallowed file type returns 400.

**Known limitations:** None confirmed.

---

## Domain: Letters and Documents

### HR Letters

**Priority:** P0

**Purpose:** Generates formal employment letters (Experience, Internship, Relieving) using controlled-wording templates. Letters are issued with a unique reference number and cryptographic auth code verifiable at `/verify`.

**Current users:** super_admin, admin, hr (generate/issue). `CONFIRMED_IN_CODE`

**Entry screen and route:** `/admin/hr/tools` — `client/src/pages/admin/hr/HRTools.tsx`

**Frontend components:** `HRTools.tsx` — HR Letters section

**Backend routes:**
- `POST /api/hr-letters` — generate letter
- `POST /api/hr-letters/:id/issue` — issue with reference number and auth code
- `POST /api/hr-letters/:id/revoke` — revoke
- `POST /api/hr-letters/:id/email` — send via email
- `GET /api/hr-letters/:id/download` — download PDF

**Database tables written:** `hr_letters`
**Database tables read:** `hr_letters`, `admin_users`

**Permissions required:** `requirePermission('hr.tools', ...)`. `CONFIRMED_IN_CODE`

**Workflow:** HR Letter Lifecycle — `docs/workflows/WORKFLOW_STATE_MACHINES.md` §12.

**Business rules applied:** Controlled wording only — free-form text outside designated fields not supported. Revoke marks status as revoked, does not delete. `CONFIRMED_IN_CODE`

**Notifications triggered:** Email to employee when letter is sent. `CONFIRMED_IN_CODE`

**Audit events logged:** Issue and revoke actions logged.

**Error behavior:** Invalid employee reference returns 400.

**Known limitations:** Verification covers `hr_letter` and `contract` types only; offer letters are a separate flow.

---

### Amendment Letters

**Priority:** P1

**Purpose:** Generates post-hire addendum documents — Salary Revision, Designation/Promotion, Combined (salary + designation), and Device Allocation — using the DOCX addendum engine. Supports both system employee picker and manual entry. Optional email delivery.

**Current users:** super_admin, admin, hr. `CONFIRMED_IN_CODE`

**Entry screen and route:** `/admin/hr/tools` (Amendment Letters section)

**Backend routes:** `POST /api/hr-letters/amendment` (via addendum engine), `POST /api/offer-letter-addendums`

**Database tables written:** `hr_letters`, `offer_letter_addendums`
**Database tables read:** `admin_users`, `hr_letters`

**Permissions required:** `requirePermission('hr.tools', ...)` — restricted to super_admin, admin, hr. `CONFIRMED_IN_CODE`

**Business rules applied:** Document hash stored at generation for audit integrity. All amendment letters are verifiable via `/verify`. `CONFIRMED_IN_CODE`

**Notifications triggered:** Optional email delivery to employee on generation if selected. `CONFIRMED_IN_CODE`

**Audit events logged:** Letter generation and issue events logged.

**Error behavior:** Employee not found (for system picker) returns 400. DOCX template missing returns 500.

**Known limitations:** DOCX generation requires `docx` and `docxtemplater` packages at runtime. `CONFIRMED_IN_CODE`

---

### Offer Letters

**Priority:** P0

**Purpose:** Full offer letter lifecycle — generation by authorized roles, approval gate for non-super_admin creators, email delivery to candidate, candidate acceptance flow, HR countersignature, and onboarding trigger.

**Current users:** super_admin, admin, hr, manager (generate); super_admin (approve/reject); hr, admin, super_admin (countersign). `CONFIRMED_IN_CODE`

**Entry screen and route:** `/admin/new-hire` (Offer Letters tab) — `client/src/pages/admin/NewHire.tsx`

**Frontend components:** `OfferLetterGenerator`, `OfferLettersDashboard`

**Backend routes:**
- `POST /api/offer-letters` — create
- `POST /api/offer-letters/:id/approve` — super_admin approves
- `POST /api/offer-letters/:id/reject` — super_admin rejects
- `POST /api/offer-letters/:id/cancel` — cancel
- `POST /api/offer-letters/:id/reactivate` — reactivate expired
- `POST /api/offer-letters/:id/countersign` — countersign accepted offer
- `POST /api/offer-letters/:id/onboard` — trigger onboarding

**Database tables written:** `offer_letters`, `admin_users` (on onboard), `employee_plans` (seeded at acceptance)
**Database tables read:** `offer_letters`, `admin_users`

**Permissions required:** `requirePermission('hr.offerLetters', ...)`. `CONFIRMED_IN_CODE`

**Workflow:** Offer Letter Lifecycle — `docs/workflows/WORKFLOW_STATE_MACHINES.md` §1.

**Business rules applied:** Non-super_admin creators cannot send directly; enters `pending_approval`. Expiry check on candidate access. Plan seeded with NULL employee_id at acceptance. Counter-signature stores document hash. Full rules in `docs/workflows/BUSINESS_RULES_CATALOGUE.md` §Offer Letter.

**Notifications triggered:** Super_admin notified on pending_approval creation; manager notified on approval/rejection decision; candidate email with accept URL on approval. `CONFIRMED_IN_CODE`

**Audit events logged:** Offer acceptance triggers audit record.

**Error behavior:** Access to expired offer updates status to `expired`. Candidate cannot sign expired offer.

**Known limitations:** Manager can only trigger `onboarded` transition for offers they originally created.

---

### Public Verification

**Priority:** P0

**Purpose:** Allows any member of the public to verify the authenticity of an HR letter or contract by entering the reference number and auth code. Returns letter type, issue date, employee name (first only), and revocation status.

**Current users:** Public (no authentication required). `CONFIRMED_IN_CODE`

**Entry screen and route:** `/verify` — `client/src/pages/VerifyLetter.tsx`

**Backend routes:** `POST /api/verify-letter` (rate-limited)

**Database tables read:** `hr_letters`

**Permissions required:** None. Rate limiter only. `CONFIRMED_IN_CODE`

**Business rules applied:** Only covers `hr_letter` and `contract` document types. Revoked letters return revoked status — not an error. `CONFIRMED_IN_CODE`

**Error behavior:** Invalid reference number returns generic "not found" — does not confirm or deny existence.

**Known limitations:** Offer letter acceptance hash does not use this verification flow.

---

### Offer Letter Addendums

**Priority:** P1

**Purpose:** Post-hire addendum clauses (growth plan, device allocation, salary) sent to employees for countersignature via a token-gated URL.

**Current users:** super_admin, admin, hr (generate/send); manager (generate for own reports); employee (countersign via token). `CONFIRMED_IN_CODE`

**Entry screen and route:** `/admin/new-hire`, `/admin/hr/my-team` (generate); `/addendum/:token` (candidate acceptance)

**Backend routes:**
- `POST /api/offer-letter-addendums` — create addendum and generate token link
- `GET /api/offer-letter-addendums/token/:token` — load addendum for candidate (token-gated)
- `POST /api/offer-letter-addendums/token/:token/accept` — candidate countersigns

**Database tables written:** `offer_letter_addendums`, `employee_plans` (growth clause → activates plan)
**Database tables read:** `offer_letter_addendums`, `admin_users`

**Permissions required:** `requirePermission('hr.offerLetters', ...)` to generate; token-gated public URL for employee acceptance. `CONFIRMED_IN_CODE`

**Business rules applied:** Signed growth-clause addendum activates a real tracked growth plan via `ensurePlanFromDocument`. Token is single-use — second acceptance attempt returns error. `CONFIRMED_IN_CODE`

**Notifications triggered:** Email with token link sent to employee on dispatch. `CONFIRMED_IN_CODE`

**Audit events logged:** Acceptance event logged with document hash.

**Error behavior:** Expired or already-used token returns 400.

**Known limitations:** None confirmed.

---

### Policy Documents and Signing

**Priority:** P1

**Purpose:** HR publishes policy documents and assigns them to employees for e-signature. Signatures are stored with evidence. The guided onboarding checklist bridges policy signing to the annexure flow.

**Current users:** super_admin, admin, hr (publish/assign); all roles (sign own assigned policies). `CONFIRMED_IN_CODE`

**Entry screen and route:** `/admin/hr/documents/policy/:signingId` (sign); HR admin tools for publishing and assignment

**Backend routes:**
- `GET /api/policy-signing-requests/:signingId` — load signing request
- `POST /api/policy-signing-requests/:signingId/sign` — submit e-signature

**Database tables written:** `policy_documents`, `policy_signing_requests`, `policy_signatures`
**Database tables read:** `policy_documents`, `policy_signing_requests`, `admin_users`

**Permissions required:** `requireAuth` to sign own assigned policy; `requirePermission('hr.tools', ...)` to publish and assign. `CONFIRMED_IN_CODE`

**Business rules applied:** Signing request must be assigned to the authenticated user — cross-user signing returns 403. Onboarding checklist bridges policy signing to the annexure flow before activating other onboarding steps. `CONFIRMED_IN_CODE`

**Notifications triggered:** Email notification to employee when a new policy is assigned for signing. `CONFIRMED_IN_CODE`

**Audit events logged:** Signature creation logged with timestamp and evidence.

**Error behavior:** Signing already-completed request returns 400 "Already signed". Unknown signingId returns 404.

**Known limitations:** None confirmed.

---

## Domain: Attendance and Payroll

### Team Attendance

**Priority:** P0

**Purpose:** Provides managers and HR with a real-time view of the team's attendance status for today, including break status badges (`on_lunch`, `on_tea`), and historical range reports.

**Current users:** super_admin, admin, hr, manager, operations. `CONFIRMED_IN_CODE`

**Entry screen and route:** `/admin/hr/team-attendance`

**Backend routes:** `GET /api/hr/team-attendance`, `GET /api/attendance/range`

**Database tables read:** `attendance`, `break_records`, `admin_users`
**Database tables written:** None.

**Permissions required:** `requirePermission('hr.attendance.myTeam', ...)`. `CONFIRMED_IN_CODE`

**Workflow:** No state-machine lifecycle. Real-time read of current-day attendance rows.

**Business rules applied:** Manager scope: own direct reports only via `WHERE manager_id = $1`. Break status derived at read time from `break_records` — not a stored column. `CONFIRMED_IN_CODE`

**Notifications triggered:** None.

**Audit events logged:** None (read-only view).

**Error behavior:** Error toast if team attendance API fails to load.

**Known limitations:** Break status is a live derived field from `break_records`, not a stored enum. May lag if break records are slow to commit.

---

### Payroll Run

**Priority:** P0

**Purpose:** Monthly batch payroll processing. HR generates a run for a period, it goes through approval, salary slips are dispatched, and payments are confirmed per employee.

**Current users:** super_admin, admin, hr, executive (generate/approve); super_admin, admin, executive (final approve/disburse). `CONFIRMED_IN_CODE`

**Entry screen and route:** `/admin/payroll/run`

**Frontend components:** `BulkPayrollRun.tsx`

**Backend routes:**
- `POST /api/payroll/run` — generate run
- `POST /api/payroll/run/:id/approve` — approve run
- `POST /api/payroll/run/:id/send` — dispatch salary slips
- `POST /api/payroll/run/:id/execute` — confirm payments
- `POST /api/payroll/run/:id/payments/:userId/deposit` — per-employee payment

**Database tables written:** `salary_report_runs`, `salary_slips`, `salary_run_payments`
**Database tables read:** `salary_report_runs`, `admin_users`, `salary_structures`, `salary_advance_repayments`, `attendance_report_runs`

**Permissions required:** `requirePermission('finance.payroll', ...)`. `CONFIRMED_IN_CODE`

**Workflow:** Payroll Run Lifecycle — `docs/workflows/WORKFLOW_STATE_MACHINES.md` §5.

**Business rules applied:** India statutory PF/ESI/PT computed if salary structure is assigned; skipped gracefully if not. Advance recoveries locked once run moves past `pending_approval`. `CONFIRMED_IN_CODE`

**Notifications triggered:** Salary slip email to each employee on dispatch. `CONFIRMED_IN_CODE`

**Audit events logged:** Run creation and approval logged.

**Error behavior:** Attempting to modify recoveries on a locked run returns 400.

**Known limitations:** Multiple active rows possible in `salary_report_runs` (no month/year unique constraint); all reads must filter `is_active = true`. `CONFIRMED_IN_CODE`

---

### India Statutory Payroll

**Priority:** P0

**Purpose:** Pure paise-precision engine computing PF (employee + employer), ESI (employee + employer), Professional Tax (state-slab based), and LOP deductions. Results are stored in `salary_slips.computation_snapshot` JSONB on first render.

**Current users:** System (payroll engine); viewable by super_admin, admin, hr, finance, executive. `CONFIRMED_IN_CODE`

**Entry screen and route:** `/admin/payroll/run`, `/admin/payroll/setup`

**Backend files:** `server/payrollEngine.ts`, `server/salaryEngine.ts`

**Database tables written:** `salary_slips` (computation_snapshot JSONB)
**Database tables read:** `salary_structures`, `salary_structure_rules`, `payroll_settings`, `attendance`

**Business rules applied:** Full PF/ESI/PT/LOP rules in `docs/workflows/BUSINESS_RULES_CATALOGUE.md` §India Statutory Payroll. ESI rounds UP. Net pay floored at ₹0. Computation snapshot immutable after first render. `CONFIRMED_IN_CODE`

**Known limitations:** Requires salary structure assignment per employee. ESI rounding is UP to nearest paise (pure-paise engine) or rupee (float engine) — confirm which engine path is active for a given employee. `UNABLE_TO_CONFIRM — OWNER REVIEW REQUIRED`

---

### Salary Advance

**Priority:** P0

**Purpose:** Full salary advance lifecycle — employee self-service request, manager approval, CEO escalation (>50% salary), super_admin final approval, disbursement, and automatic monthly recovery via payroll engine.

**Current users:** All roles (self-request); manager/hr (manager approve); super_admin (final approve/disburse); hr/admin/super_admin (manual record). `CONFIRMED_IN_CODE`

**Entry screen and route:** `/admin/salary-advance`

**Backend routes:** `server/salaryAdvanceRoutes.ts`

**Database tables written:** `salary_advance_requests`, `salary_advance_repayments`
**Database tables read:** `salary_advance_requests`, `salary_advance_repayments`, `salary_report_runs`

**Permissions required:** `requirePermission('finance.salaryAdvance', ...)`. `CONFIRMED_IN_CODE`

**Workflow:** Salary Advance Lifecycle — `docs/workflows/WORKFLOW_STATE_MACHINES.md` §4.

**Business rules applied:** CEO escalation if amount > 50% monthly salary. FIFO oldest-first recovery. Shortfall carry-forward. Manual recording works even when `salary_advance_enabled` flag is OFF. Full rules in `docs/workflows/BUSINESS_RULES_CATALOGUE.md` §Salary Advance. `CONFIRMED_IN_CODE`

**Notifications triggered:** Manager and super_admin notified at each approval stage. `CONFIRMED_IN_CODE`

**Known limitations:** Recovery edit/remove locked once payroll run moves past `pending_approval`.

---

### Salary Slip Generator

**Priority:** P1

**Purpose:** Generate and download individual monthly pay slip PDFs for any employee. Includes India statutory breakdown if salary structure is assigned.

**Current users:** super_admin, admin, hr, finance, executive. `CONFIRMED_IN_CODE`

**Entry screen and route:** `/admin/hr/reports` (Reports & Compliance)

**Backend routes:** `GET /api/salary-slips/:id/pdf`, `POST /api/salary-slips/generate`

**Database tables written:** `salary_slips`
**Database tables read:** `salary_slips`, `admin_users`, `salary_structures`

**Permissions required:** `requirePermission('finance.payroll', ...)`. `CONFIRMED_IN_CODE`

**Workflow:** Per-employee unlock via `salary_run_payments`; slip generation triggers on payment confirmation within a payroll run.

**Business rules applied:** Computation snapshot written on first render — immutable after that. Statutory deductions (PF, ESI, PT) computed from salary structure. `CONFIRMED_IN_CODE`

**Notifications triggered:** Salary slip email sent to employee when dispatched via payroll run.

**Audit events logged:** Slip generation logged.

**Error behavior:** Employee without salary structure assignment returns a slip with zero statutory components (no error).

**Known limitations:** Computation snapshot written on first render; not recomputed on re-view. `CONFIRMED_IN_CODE`

---

### Attendance Report

**Priority:** P1

**Purpose:** Monthly attendance summary used as the gate before payroll run generation. HR generates, reviews, and notifies employees. Supports additive auto-sync on open runs.

**Current users:** super_admin, admin, hr, executive. `CONFIRMED_IN_CODE`

**Entry screen and route:** `/admin/hr/reports`

**Backend routes:** `POST /api/attendance-reports/generate`, `GET /api/attendance-reports`, `POST /api/attendance-reports/:id/notify`

**Database tables written:** `attendance_report_runs`, `attendance_report_entries`
**Database tables read:** `attendance`, `admin_users`, `attendance_report_runs`

**Permissions required:** `requirePermission('hr.reports', ...)`. `CONFIRMED_IN_CODE`

**Workflow:** Attendance Report Draft/Send Lifecycle — generated as draft (notified_at NULL); notify action sets notified_at and triggers employee emails.

**Business rules applied:** Multiple active rows possible; reads must filter `is_active = true`. Draft held until `notified_at` set. Additive auto-sync on open runs. `CONFIRMED_IN_CODE`

**Notifications triggered:** Email notification to each employee in the report when notify action is triggered. `CONFIRMED_IN_CODE`

**Audit events logged:** Report generation and notify events logged.

**Error behavior:** Notifying a report that has already been notified returns 400.

**Known limitations:** No (month, year) unique constraint on runs. Is_active filter is mandatory on all reads.

---

### Salary Structures

**Priority:** P1

**Purpose:** Defines salary component breakdowns (Basic, HRA, Special Allowance, etc.) with computation rules (percent_of_gross, percent_of_component, fixed, residual). Assigned per employee.

**Current users:** super_admin, admin, hr, executive (view); super_admin, admin, hr (manage). `CONFIRMED_IN_CODE`

**Entry screen and route:** `/admin/payroll/setup`

**Backend routes:** `GET /api/salary-structures`, `POST /api/salary-structures`, `PATCH /api/salary-structures/:id`, `POST /api/salary-structures/:id/assign`

**Database tables written:** `salary_structures`, `salary_structure_rules`
**Database tables read:** `salary_structures`, `salary_structure_rules`, `admin_users`

**Permissions required:** `requirePermission('finance.payroll', ...)`. Executive role is read-only. `CONFIRMED_IN_CODE`

**Business rules applied:** Topological sort of components by dependency. Residual component absorbs rounding to ensure components sum exactly to Gross After LOP. `CONFIRMED_IN_CODE`

**Notifications triggered:** None.

**Audit events logged:** Structure assignment to employee logged.

**Error behavior:** Circular component dependency returns validation error. Assigning a non-existent structure to employee returns 400.

**Known limitations:** Employees without an assigned structure are silently skipped in payroll run — no visible warning on the setup page.

---

### Salary Changes Ledger

**Priority:** P1

**Purpose:** Immutable audit trail of all compensation changes. Each change requires proof upload and maker-checker approval. Managers can only adjust own direct reports.

**Current users:** super_admin, admin, hr (manage any employee); manager (own direct reports only). `CONFIRMED_IN_CODE`

**Entry screen and route:** `/admin/hr/my-team` (Plans tab or salary section)

**Backend routes:** `POST /api/salary-changes`, `GET /api/salary-changes/:userId`, `POST /api/salary-changes/:id/approve`

**Database tables written:** `salary_changes`
**Database tables read:** `salary_changes`, `admin_users`

**Permissions required:** `requirePermission('finance.salaryChanges', ...)`. Manager scope: own direct reports only. `CONFIRMED_IN_CODE`

**Business rules applied:** Maker-checker required — the person who records the change cannot be the approver. Manager direct-report scope enforced. Each change requires proof document upload. `CONFIRMED_IN_CODE`

**Notifications triggered:** Maker notified on approval or rejection. `CONFIRMED_IN_CODE`

**Audit events logged:** Every salary change row is itself the audit record (immutable ledger).

**Error behavior:** Missing proof document returns 400. Manager attempting to change non-direct-report returns 403.

**Known limitations:** `admin_users.salary` is the operational value; the ledger is the history. The two must remain in sync — any out-of-band direct update to `salary` bypasses the ledger.

---

### Leave Accrual Engine

**Priority:** P0

**Purpose:** System cron that automatically accrues Earned Leave (EL) and Sick Leave (SL) balances monthly for all eligible employees. Handles year-end carry-forward and lapse batch.

**Current users:** System (cron-driven — not user-initiated). Results visible to all roles via leave balance display. `CONFIRMED_IN_CODE`

**Entry screen and route:** No UI entry. Triggered by scheduler cron at 00:00 IST on the 1st of each month. Results visible at `/admin/my-desk` (Leave Balance tab).

**Backend files:** `server/scheduler.ts`, `server/leaveEngine.ts` (or equivalent accrual function)

**Database tables written:** `leave_accruals`, `leave_balances`
**Database tables read:** `leave_balances`, `attendance`, `admin_users`, `shifts`

**Permissions required:** System (cron-initiated). No user permissions checked.

**Workflow:** Leave Accrual — triggered monthly, writes one accrual row per eligible employee per leave type.

**Business rules applied:** EL accrues only if employee worked ≥ 128 hours in the previous month (threshold configurable). SL accrues unconditionally after first 30 days of employment. Year-end carry-forward: EL up to carry-forward cap; excess lapses. SL: any unused SL lapses at year-end. Full rules in `docs/workflows/BUSINESS_RULES_CATALOGUE.md` §Leave Accrual. `CONFIRMED_IN_CODE`

**Notifications triggered:** None from the accrual run itself.

**Audit events logged:** Each accrual run row in `leave_accruals` is the audit record.

**Error behavior:** If the accrual cron fails for one employee, it continues processing remaining employees (non-blocking per-employee).

**Known limitations:** Accrual is an idempotent bookkeeping operation and is not gated by the pending-changes guardrail. Manual leave adjustments can be recorded by HR separately.

---

### Attendance Correction

**Priority:** P1

**Purpose:** Allows managers, HR, and admins to directly correct punch-in and punch-out times for team members within a 3-day window. Each correction writes an audit log entry.

**Current users:** super_admin, admin, hr, manager (own direct reports only). `CONFIRMED_IN_CODE`

**Entry screen and route:** `/admin/hr/my-team` → Corrections tab

**Backend routes:**
- `POST /api/attendance/:id/correct` — overwrite punch times with corrected values

**Database tables written:** `attendance`, `audit_logs`
**Database tables read:** `attendance`, `admin_users`

**Permissions required:** `requirePermission('hr.attendance.correct', ...)`. Manager scope: own direct reports only via `WHERE manager_id = $1`. `CONFIRMED_IN_CODE`

**Workflow:** Correction is immediate — no approval step for direct corrections within window.

**Business rules applied:** 3-calendar-day window enforced. Corrections older than 3 days are rejected (400). Outside-window corrections must go through regularization ticket flow. `CONFIRMED_IN_CODE`

**Notifications triggered:** None on correction.

**Audit events logged:** Every correction creates an `audit_logs` row recording corrector, employee, date, and before/after punch times. `CONFIRMED_IN_CODE`

**Error behavior:** Correction outside the 3-day window returns HTTP 400. Correction of another manager's direct report returns 403.

**Known limitations:** Managers cannot correct attendance for employees not in their direct reporting chain.

---

### Regularization (Employee-Submitted Correction Request)

**Priority:** P0

**Purpose:** Allows employees to request a correction to their own attendance record via a ticket when the 3-day direct-correction window has closed. Manager or HR reviews and applies the correction.

**Current users:** All roles (submit own requests). HR, manager, super_admin, admin (review and apply). `CONFIRMED_IN_CODE`

**Entry screen and route:** `/admin/my-desk` → Regularizations tab (submit); `/admin/help-desk` (HR review queue)

**Backend routes:** `POST /api/tickets` (type: regularization), `POST /api/attendance-regularizations/:id/approve`

**Database tables written:** `tickets`, `attendance_regularizations`, `attendance`
**Database tables read:** `tickets`, `attendance`, `admin_users`

**Permissions required:** `requireAuth` (submit). `requirePermission('hr.tickets', ...)` (review). `CONFIRMED_IN_CODE`

**Business rules applied:** 3-day window is enforced for the self-service submission path. Out-of-window requests require HR to manually override. The regularization record is separate from the attendance row — HR applies the correction after reviewing the ticket. `CONFIRMED_IN_CODE`

**Notifications triggered:** Ticket creation notifies HR queue. Decision notifies employee.

**Audit events logged:** Regularization ticket row and approval action are the records.

**Error behavior:** Submission without a required reason field returns 400.

**Known limitations:** The self-service regularization submission path enforces the 3-day window. HR can override manually via the admin correction path.

---

### Night Shift Consents

**Priority:** P1

**Purpose:** Records an employee's formal consent to work non-standard hours. Required for labour law compliance. HR tracks expiry and sends alerts when consent approaches expiry.

**Current users:** super_admin, admin, hr (record/manage consents and view status). `CONFIRMED_IN_CODE`

**Entry screen and route:** `/admin/hr/tools` (Night Shift Consents section) or HR profile management

**Backend routes:** `POST /api/night-shift-consents`, `GET /api/night-shift-consents/:userId`

**Database tables written:** `night_shift_consents`
**Database tables read:** `night_shift_consents`, `admin_users`

**Permissions required:** `requirePermission('hr.tools', ...)` or equivalent. `CONFIRMED_IN_CODE`

**Workflow:** HR records consent with an effective date and expiry date. System sends alerts before expiry.

**Business rules applied:** Consent records are associated with an employee and a specific role or shift type. Expiry alerts sent via notification system. `CONFIRMED_IN_CODE`

**Notifications triggered:** Expiry alert sent before consent expiry date. `CONFIRMED_IN_CODE`

**Audit events logged:** Consent creation logged.

**Error behavior:** None confirmed.

**Known limitations:** `UNABLE_TO_CONFIRM — OWNER REVIEW REQUIRED` — Specific consent expiry alert lead time not confirmed from code.

---

### Bank Details and Emergency Contacts

**Priority:** P1

**Purpose:** Bank Details — stores employee payment routing information (account number, IFSC, bank name, account type) used by payroll disbursement. Emergency Contacts — stores next-of-kin registry for HR compliance.

**Current users:** super_admin, admin, hr (add/update for any employee); employee (own record only via My Documents). `CONFIRMED_IN_CODE`

**Entry screen and route:** `/admin/hr/my-documents` (employee self-service), HR profile management (HR entry)

**Backend routes:**
- `POST /api/employee-bank-details` — add bank account
- `PATCH /api/employee-bank-details/:id` — update
- `POST /api/employee-emergency-contacts` — add contact
- `PATCH /api/employee-emergency-contacts/:id` — update

**Database tables written:** `employee_bank_details`, `employee_emergency_contacts`
**Database tables read:** `employee_bank_details`, `employee_emergency_contacts`

**Permissions required:** `requireAuth` (own records); `requirePermission('hr.users', ...)` (manage others). `CONFIRMED_IN_CODE`

**Business rules applied:** Bank details required before salary can be disbursed to the employee. No application-layer encryption confirmed. `UNABLE_TO_CONFIRM — OWNER REVIEW REQUIRED`

**Notifications triggered:** None directly.

**Audit events logged:** None confirmed.

**Error behavior:** Missing bank details at payroll dispatch — employee skipped or flagged in run.

**Known limitations:** No application-layer encryption of account numbers confirmed in code.

---

## Domain: Performance Management

### Employee Plans (Probation / Growth / PIP)

**Priority:** P0

**Purpose:** Formal development and accountability plans — Probation (new hire, 90 days), Growth (post-probation career development), and PIP (performance improvement). Each plan type auto-generates a check-in cadence and has a structured outcome lifecycle.

**Current users:** super_admin, admin, hr, manager (manage); employee (view and acknowledge own plan). `CONFIRMED_IN_CODE`

**Entry screen and route:** `/admin/hr/my-team` (Plans tab), `/admin/growth` (My Growth)

**Backend routes:** `server/performanceRoutes.ts`

**Database tables written:** `employee_plans`, `check_ins`, `plan_acknowledgements`, `audit_logs`
**Database tables read:** `employee_plans`, `check_ins`, `admin_users`

**Permissions required:** `requirePermission('performance.plans', ...)`. Manager scope: own direct reports only. `CONFIRMED_IN_CODE`

**Workflow:** Employee Plan Lifecycle — `docs/workflows/WORKFLOW_STATE_MACHINES.md` §8.

**Business rules applied:** Probation: 8 check-ins at Days 1/7/15/30/45/60/75/90. Days 30/60/90 are formal milestone reviews with `reviewScores` JSONB. PIP: weekly pip_review check-ins auto-generated. Escalation: 3 missed check-ins set `strikeEscalatedAt`. `CONFIRMED_IN_CODE`

**Notifications triggered:** Day-before employee reminder, same-day manager reminder, overdue escalation, 3-strike escalation. `CONFIRMED_IN_CODE`

**Audit events logged:** `plan_created`, `plan_updated`, `plan_acknowledged`, `check_in_created`, `check_in_updated`, `plan_check_in_completed`. `CONFIRMED_IN_CODE`

**Error behavior:** Plan seeded at offer acceptance with NULL `employee_id`; this is expected — not a bug. `employee_id` is populated on onboarding.

**Known limitations:** Audit log captures new values only — old values not recorded. See `docs/ai-governance-audit/GOVERNANCE-MVP-READINESS.md` §4. Plans data source: `GET /api/hr/plans` returns all statuses; "one plan" appearing is a data issue not a filter bug.

---

### Governance Controls

**Priority:** P1

**Purpose:** Tracks compliance obligations with a formal status lifecycle (pending → in_progress → completed/escalated/disputed). Escalation path reaches CEO level.

**Current users:** All roles (view); hr, admin, executive (manage); super_admin, admin, executive (CEO-level escalation). `CONFIRMED_IN_CODE`

**Entry screen and route:** `/admin/control-tower`

**Backend routes:** `GET /api/governance-controls`, `POST /api/governance-controls`, `PATCH /api/governance-controls/:id/transition`

**Database tables written:** `governance_controls`
**Database tables read:** `governance_controls`, `admin_users`

**Permissions required:** `requireAuth` (view); `requirePermission('governance.controls', ...)` to transition. `CONFIRMED_IN_CODE`

**Workflow:** Governance Control Lifecycle — `docs/workflows/WORKFLOW_STATE_MACHINES.md` §14.

**Business rules applied:** Status transitions follow the defined lifecycle; invalid transitions return 400. Escalated items require CEO acknowledgement before closure. `CONFIRMED_IN_CODE`

**Notifications triggered:** Escalation alert sent to designated owner on status change to `escalated`. `CONFIRMED_IN_CODE`

**Audit events logged:** Status transition events logged with actor and timestamp.

**Error behavior:** Invalid transition returns 400. Transitioning a completed control returns 400.

**Known limitations:** None confirmed.

---

### Performance Goals, Check-ins, Reviews, Feedback

**Priority:** P1 (all behind `performance_management_enabled` flag)

**Purpose:** OKR-style goal tracking, recurring manager-employee check-ins, formal review cycles, and peer feedback.

**Current users:** All roles (varied per feature). Employee: own goals/reviews. Manager: team goals, check-ins, team reviews. HR/admin: full visibility. `CONFIRMED_IN_CODE`

**Entry screens:** `/admin/performance/goals`, `/admin/performance/check-ins`, `/admin/performance/reviews`, `/admin/performance/review-cycles`, `/admin/performance/feedback`, `/admin/performance/analytics`

**Backend routes:** `GET/POST /api/performance/goals`, `GET/POST /api/performance/check-ins`, `GET/POST /api/performance/reviews`, `GET/POST /api/performance/review-cycles`, `GET/POST /api/performance/feedback`

**Database tables written:** `performance_goals`, `performance_check_ins`, `performance_reviews`, `review_cycles`, `performance_feedback`
**Database tables read:** All above tables, `admin_users`, `sop_documents` (for KPI linkage)

**Permissions required:** `requirePermission('performance.*', ...)` scoped by role. All pages 404 when flag is OFF. `CONFIRMED_IN_CODE`

**Workflow:** Performance Goal Lifecycle — `docs/workflows/WORKFLOW_STATE_MACHINES.md` §9. Check-in Lifecycle — §11.

**Business rules applied:** Goals linked to SOPs via `linked_sop_id`. Self-reviews submitted by employee; manager reviews submitted after self-review is complete. Review cycle close locks all associated reviews. `CONFIRMED_IN_CODE`

**Notifications triggered:** Check-in reminder on scheduled date; review request notification on cycle open. `CONFIRMED_IN_CODE`

**Audit events logged:** Goal creation, review submission, and cycle close are logged.

**Error behavior:** Submitting manager review before self-review complete returns 400.

**Feature flag required:** `performance_management_enabled` must be ON. Three-place rule applies: `ALLOWED_FLAGS`, `flagDefs`, `FLAG_DEFAULTS`. `CONFIRMED_IN_CODE`

**Known limitations:** Audit log does not capture old values on update (NEEDS_EXTENSION per governance audit).

---

## Domain: Training and SOPs

### Onboarding Training

**Priority:** P0

**Purpose:** Structured learning tracks with sections, content, quizzes, and acknowledgements. Assigned to employees with a due date. Training compliance lock blocks portal access when overdue training is unacknowledged.

**Current users:** All roles (complete own tracks); super_admin, admin, hr, manager, operations (assign/manage). `CONFIRMED_IN_CODE`

**Entry screen and route:** `/admin/hr/my-training` (own), `/admin/training/catalog` (manage), `/admin/hr/training-progress` (team view)

**Backend routes:** `server/trainingCatalogRoutes.ts`

**Database tables written:** `track_assignments`, `section_progress`
**Database tables read:** `learning_tracks`, `track_sections`, `track_assignments`, `section_progress`

**Workflow:** Training Assignment Lifecycle — `docs/workflows/WORKFLOW_STATE_MACHINES.md` §10.

**Business rules applied:** Compliance lock applies when `dueDate` passed, no exception granted, SOP wave enforcement is `full`. `CONFIRMED_IN_CODE`

**Notifications triggered:** Overdue reminders via scheduler cron. `CONFIRMED_IN_CODE`

**Audit events logged:** Bulk assignment events to `onboarding_audit_events`. `CONFIRMED_IN_CODE`

**Error behavior:** Compliance lock redirects to `/admin/policy-gate`. Exception granted by HR clears lock.

**Known limitations:** `excepted` status is a hard-block workaround — employee never completes the track.

---

### SOP Library and Compliance

**Priority:** P1 (behind `process_governance` flag)

**Purpose:** Standard Operating Procedure lifecycle management with a full state machine, wave-based rollout enforcement (soft → measured → full), and per-employee acknowledgement with cryptographic hashing.

**Current users:** super_admin, admin, hr, operations, manager (manage SOPs); all roles (acknowledge own). `CONFIRMED_IN_CODE`

**Entry screens:** `/admin/sops` (library), `/admin/sops/compliance` (employee view), `/admin/sops/my-reviews`

**Backend routes:** `server/sopGovernance.ts`, `server/sopRollout.ts`

**Database tables written:** `sop_documents`, `sop_role_assignments`, `sop_employee_progress`, `rollout_waves`, `wave_sops`
**Database tables read:** All above tables, `admin_users`

**Workflow:** SOP Lifecycle — `docs/workflows/WORKFLOW_STATE_MACHINES.md` §6. SOP Employee Progress — §7.

**Business rules applied:** Full SOP compliance rules in `docs/workflows/BUSINESS_RULES_CATALOGUE.md` §SOP Compliance. 4-condition lock gate, 15-day grace, ≤2 operational SOPs per week, acknowledgement hash. `CONFIRMED_IN_CODE`

**Known limitations:** `sop_employee_progress` stores one row per (sopMasterId, userId) — re-publication overwrites prior acknowledgement. No version history per acknowledgement. `CONFIRMED_IN_CODE`

**Feature flag required:** `process_governance` must be ON.

---

## Domain: Recruitment

### Job Board (Public) and Job Management

**Priority:** P0

**Purpose (public):** Public-facing job listings for candidates to browse, filter, and apply. Jobs are sourced from Ceipal ATS sync or CSV upload.

**Purpose (internal):** Internal job requisition management — create, edit, bulk-update, mark hot, push applicants to Ceipal.

**Current users (public):** Candidates (no auth). `CONFIRMED_IN_CODE`
**Current users (internal):** super_admin, admin, operations, recruiter, manager. `CONFIRMED_IN_CODE`

**Entry screens:** `/jobs` (public), `/admin/recruitment` (internal)

**Backend routes:** `GET /api/jobs` (public), `POST /api/jobs`, `PATCH /api/jobs/:id`, `POST /api/jobs/sync-ceipal`, `POST /api/jobs/bulk-upload`

**Database tables written:** `jobs`, `applications`
**Database tables read:** `jobs`

**Business rules applied:** Ceipal token refresh every 55 minutes. CSV/XLSX bulk import via column mapping. `CONFIRMED_IN_CODE`

**Notifications triggered:** None on job creation.
**Error behavior:** Ceipal sync failure is logged; partial sync succeeds for valid jobs.

---

### New Hire Section

**Priority:** P0

**Purpose:** Unified pre-employment pipeline accessible at `/admin/new-hire`. Three tabs: Offer Letters (manage full lifecycle), Onboarding (status table of employees joined within 90 days or with NULL joining_date), Users (inline user management).

**Current users:** super_admin, admin, hr, operations, manager. Employee role explicitly excluded. `CONFIRMED_IN_CODE`

**Entry screen and route:** `/admin/new-hire`

**Backend routes:** `GET /api/offer-letters`, `GET /api/users`, `GET /api/hr/onboarding-status`

**Database tables read:** `offer_letters`, `admin_users`, `track_assignments`, `employee_documents`, `employee_bank_details`
**Database tables written:** None (page is read-only aggregate; writes go via individual sub-feature routes).

**Permissions required:** `requirePermission('hr.newHire', ...)`. Employee role returns 403. `CONFIRMED_IN_CODE`

**Business rules applied:** New hire eligibility: `joiningDate` within 90 days OR NULL. Onboarding status computes training %, document upload count, bank details presence, night-shift consent status. `CONFIRMED_IN_CODE`

**Notifications triggered:** None from the page itself (notifications triggered by individual sub-feature actions, e.g., offer letter dispatch).

**Audit events logged:** None from the page itself.

**Error behavior:** Error toast if any of the three data sources fail to load.

**Known limitations:** Manager can only access offer letters they originally created in the Offer Letters tab.

---

### Applications and Contacts

**Priority:** P1

**Purpose:** Candidate application management (view, filter, push to Ceipal, retry failed pushes). Client/candidate inquiry management from the contact form.

**Current users:** super_admin, admin, hr, operations, recruiter, manager (applications); super_admin, admin, operations (contacts). `CONFIRMED_IN_CODE`

**Entry screens:** `/admin/recruitment` (Applications tab), `/admin/contacts`

**Backend routes:**
- `GET /api/applications` — list applications
- `POST /api/applications/:id/push-ceipal` — push applicant to Ceipal ATS
- `GET /api/contacts` — list contact inquiries
- `DELETE /api/contacts/:id` — delete contact inquiry

**Database tables written:** `applications`, `contacts`
**Database tables read:** `applications`, `contacts`, `jobs`

**Permissions required:** `requirePermission('admin.applications', ...)` for application management; `requirePermission('admin.contacts', ...)` for contacts. `CONFIRMED_IN_CODE`

**Business rules applied:** Applications pushed to Ceipal use JWT-authenticated API calls; token refreshes every 55 minutes. Failed pushes can be retried. `CONFIRMED_IN_CODE`

**Notifications triggered:** None on application creation.

**Audit events logged:** Ceipal push attempts and outcomes logged.

**Error behavior:** Ceipal push failure logs the error and marks application status accordingly — does not block other applications.

**Known limitations:** Ceipal JWT token caching means a token refresh mid-session may cause a brief retry delay.

---

## Domain: Finance and Contracts

### Contracts

**Priority:** P1

**Purpose:** Client contract lifecycle — draft, dispatch approval, client signing (token-gated URL), countersignature.

**Current users:** super_admin, admin, hr, operations, manager (create/view); super_admin, admin (countersign); client contacts (sign via token). `CONFIRMED_IN_CODE`

**Entry screen and route:** `/admin/finance`

**Backend routes:**
- `GET /api/contracts` — list contracts
- `POST /api/contracts` — create draft
- `POST /api/contracts/:id/dispatch` — dispatch to client (generates signing token)
- `GET /api/contracts/sign/:token` — client load (public)
- `POST /api/contracts/sign/:token/sign` — client signature (public)
- `POST /api/contracts/:id/countersign` — HR/admin countersignature

**Database tables written:** `contracts`
**Database tables read:** `contracts`, `admin_users`

**Permissions required:** `requirePermission('finance.contracts', ...)` for internal management; token-gated public route for client signing. `CONFIRMED_IN_CODE`

**Workflow:** Contract Lifecycle — `docs/workflows/WORKFLOW_STATE_MACHINES.md` §13.

**Business rules applied:** Document hash stored on countersignature for integrity. Contract verifiable via `/verify`. Client cannot sign an expired or revoked contract. `CONFIRMED_IN_CODE`

**Notifications triggered:** Email with signing link sent to client contact on dispatch. HR notified on client signature. `CONFIRMED_IN_CODE`

**Audit events logged:** Dispatch, client signature, and countersignature events logged.

**Error behavior:** Signing already-signed or expired contract returns 400.

**Known limitations:** None confirmed.

---

### Travel Calculator

**Priority:** P1

**Purpose:** Healthcare recruiter blended rate computation tool. Calculates blended pay and margin from job parameters using cached GSA rates.

**Current users:** All authenticated roles (healthcare recruiters primarily). `CONFIRMED_IN_CODE`

**Entry screen and route:** `/admin/travel-calculator`

**Backend routes:** `GET /api/travel-calculator/gsa-rates`, `POST /api/travel-calculator/compute`, `GET /api/travel-calculator/quotes`

**Database tables written:** `travel_quotes`, `travel_quote_outputs`
**Database tables read:** `gsa_rate_snapshots`

**Permissions required:** `requireAuth` only — no role restriction beyond authentication. `CONFIRMED_IN_CODE`

**Business rules applied:** GSA rate snapshots are pre-cached; stale rates are served if refresh fails. Blended rate computation uses pay package components (base, housing, M&IE) and margin percentage. `CONFIRMED_IN_CODE`

**Notifications triggered:** None.

**Audit events logged:** Quote saves logged with input parameters and output.

**Error behavior:** Missing GSA rate for the requested location returns an error message; calculator still allows manual rate entry.

**Known limitations:** GSA rate data requires periodic refresh; stale snapshots will produce outdated blended rates without a visible warning.

---

## Domain: Content Studio

### Article Pipeline, Idea Board, Campaigns, BD Agent, Social Cards, Brand Voice

**Priority:** P1 (collectively; behind `studio_v2_enabled` flag for `/studio/*` routes)

**Purpose:** AI-assisted content creation platform. Article pipeline covers draft → review → approval → publish with brand voice injection. BD Agent is an AI-powered business development chat. Social cards are auto-generated on article approval via Puppeteer/Chromium.

**Current users:** super_admin, admin, marketing_manager, content_editor, and Studio add-on roles. `CONFIRMED_IN_CODE`

**Entry screens:** `/studio/*` (v2) or `/admin/studio/*` (legacy). Route depends on `studio_v2_enabled` flag.

**Backend files:** `server/services/aiDraftService.ts`, `server/bdDecksRoutes.ts`, `server/sopGovernance.ts`

**Database tables written:** `studio_articles`, `studio_article_versions`, `studio_content_ideas`, `studio_campaigns`, `bd_conversations`, `bd_messages`, `bd_decks`

**Business rules applied:** Final publish restricted to `super_admin` only — not grantable via Studio add-on. AI calls use `gpt-5-mini` (economy) or `gpt-5.4` (standard/strong) models via Replit AI Integrations proxy. No HR PII automatically injected into prompts. `CONFIRMED_IN_CODE`

**Known limitations:** Social card generation requires Chromium/Puppeteer at runtime. Studio add-on roles supplement base role without changing it. `CONFIRMED_IN_CODE`

---

## Domain: Vault

### Secrets Vault

**Priority:** P1

**Purpose:** Centralized secure credential storage. Roles can store, retrieve (reveal/copy), share grants, and revoke access to secrets. All access events are logged to `vault_audit_logs`.

**Current users:** All roles (read with grant); super_admin, admin (manage). `CONFIRMED_IN_CODE`

**Entry screens:** `/admin/vault`, `/admin/vault/audit`

**Backend routes:**
- `GET /api/vault-secrets` — list secrets accessible to the current user
- `POST /api/vault-secrets` — create secret
- `POST /api/vault-secrets/:id/reveal` — reveal/copy secret value (logs access)
- `POST /api/vault-secrets/:id/grant` — share access with another user
- `DELETE /api/vault-secrets/:id/grant/:userId` — revoke grant
- `GET /api/vault/audit-logs` — view all access events

**Database tables written:** `vaults`, `vault_secrets`, `vault_secret_grants`, `vault_audit_logs`
**Database tables read:** `vault_secrets`, `vault_secret_grants`, `vault_audit_logs`, `admin_users`

**Permissions required:** `requireAuth` to view/reveal (with grant); `requirePermission('admin.vault', ...)` to create, grant, revoke. `CONFIRMED_IN_CODE`

**Business rules applied:** Reveal action requires an active grant or the creator's own grant. Every reveal is logged to `vault_audit_logs`. Revoked grants immediately prevent further reveals. `CONFIRMED_IN_CODE`

**Notifications triggered:** None.

**Audit events logged:** Every reveal, grant, and revoke event logged to `vault_audit_logs` with actor, secret id, and timestamp. `CONFIRMED_IN_CODE`

**Error behavior:** Reveal without an active grant returns 403. Non-existent secret returns 404.

**Known limitations:** No application-layer encryption of secret values confirmed in code — security relies on DB-level access control.

---

## Domain: Help Desk

### Help Desk Tickets (HIRD)

**Priority:** P0

**Purpose:** Internal help desk and request system. Employees create tickets; HR and ops manage the queue, respond, and resolve. Supports a specialized `needs_info` → `returned_for_info` → `responded_to_info` flow.

**Current users:** All roles (create/view own); super_admin, admin, hr, operations (resolve queue). `CONFIRMED_IN_CODE`

**Entry screens:** `/admin/help-desk`, `/admin/help-desk/:id`

**Workflow:** Help Desk Ticket Lifecycle — `docs/workflows/WORKFLOW_STATE_MACHINES.md` §15.

**Database tables written:** `tickets`, `internal_requests`, `internal_request_audit_log`

**Business rules applied:** Regularization tickets restricted to 3-day window. `CONFIRMED_IN_CODE`

---

## Domain: Finance — Executive Dashboard

### Executive Dashboard

**Priority:** P1

**Purpose:** Executive-facing payroll overview and headcount analytics. Provides the `executive` role with a read-only view of payroll run summaries, statutory export data, and headcount history. The `executive` role is redirected here automatically on login instead of My Desk.

**Current users:** `executive`, `super_admin`. `CONFIRMED_IN_CODE`

**Entry screen and route:** `/admin/executive-cockpit` (landing), `/admin/payroll/executive` (detailed payroll view)

**Backend routes:**
- `GET /api/payroll/executive/summary` — payroll run history and totals
- `GET /api/payroll/executive/statutory-export` — PF/ESI/PT export for statutory filing
- `GET /api/payroll/executive/headcount-history` — joiners/leavers per month

**Database tables read:** `salary_report_runs`, `salary_slips`, `headcount_history`, `admin_users`
**Database tables written:** None (read-only role).

**Permissions required:** Role must be `executive` or `super_admin`. `CONFIRMED_IN_CODE`

**Business rules applied:** Executive role has no write access to any payroll or HR data — read-only enforcement at route middleware level. Statutory export reflects computation snapshot values written at slip generation (immutable). `CONFIRMED_IN_CODE`

**Notifications triggered:** None.

**Audit events logged:** None (read-only access).

**Error behavior:** Non-executive roles attempting to access `/admin/executive-cockpit` are redirected to `/admin/my-desk`.

**Known limitations:** Data refreshes on page load only — there is no push/live-update mechanism. Headcount history requires `jurisdiction` column to be present in the `headcount_history` table. `CONFIRMED_IN_CODE`

---

## P2 and P3 Feature Stubs

The following features exist in the codebase but are P2 or P3 priority. See `docs/platform/PRODUCT_CAPABILITY_MAP.md` for the full feature table with status, routes, and database tables.

- Communications / Release Notes (`/admin/communications`) — P2
- Notification Centre (`/admin/notifications`) — P2 (behind `notifications_enabled` flag)
- Rayo Academy Integration — P2 (thin-client, graceful fallback)
- Probation Guide (`/admin/probation-guide`) — P2
- SOP My Reviews (`/admin/sops/my-reviews`) — P2
- Analytics (Content Studio) — P2 (partial; self-contained cards only)
- IT Staffing landing (`/it-staffing`), eHealthcare Staffing (`/ehealthcare-staffing`), Why Hire In (`/why-hire-in-solutions`) — P2 (marketing)
- Settings pages (`/admin/settings/:group`) — P2
