Status: Current-state practitioner reference
Generated from: client/src/App.tsx (full route list) and Phase 1 documents
Date: 2026-07-13
Human approval required: Yes — for all UNABLE_TO_CONFIRM items listed within
Unresolved items: 2

---

# Current Screen Inventory

P0 and P1 screens receive full entries. P2 and P3 screens are stub rows at the end of this document.

**Priority basis:** Feature tiers from `docs/platform/PRODUCT_CAPABILITY_MAP.md`. Route evidence from `client/src/App.tsx`. `CONFIRMED_IN_ROUTE`

---

## Public Screens

### Home

| Field | Value |
|---|---|
| Route | `/` |
| Applicable roles | Public (no auth) |
| Priority | P0 |
| Purpose | Marketing landing page. Entry point for candidates, clients, and the general public. |
| Primary actions | Navigate to Jobs, Contact, Services, Insights |
| Data displayed | Static marketing content; hero carousel images (Unsplash URLs) |
| APIs called | None confirmed |
| Loading state | Static page — no async load |
| Empty state | Not applicable |
| Error state | Not applicable |
| Permission behavior | No restriction |
| Known UX issue | None confirmed |
| Status | Active |

---

### Jobs (Public Job Board)

| Field | Value |
|---|---|
| Route | `/jobs` |
| Applicable roles | Public (no auth) |
| Priority | P0 |
| Purpose | Browse and filter all active job listings. |
| Primary actions | Browse listings, filter by category/location, click through to Job Detail |
| Data displayed | Job title, location, category, date posted |
| APIs called | `GET /api/jobs` |
| Loading state | Skeleton cards while fetching |
| Empty state | "No jobs found" message |
| Error state | Error toast; empty list fallback |
| Permission behavior | No restriction |
| Known UX issue | None confirmed |
| Status | Active |

---

### Job Detail

| Field | Value |
|---|---|
| Route | `/jobs/:id` |
| Applicable roles | Public (no auth) |
| Priority | P0 |
| Purpose | Full job description with apply form. Resume upload included. |
| Primary actions | Apply (submit name, email, resume file) |
| Data displayed | Job title, description, requirements, location |
| APIs called | `GET /api/jobs/:id`, `POST /api/applications` |
| Loading state | Spinner while loading job |
| Empty state | Redirect to `/jobs` if job not found |
| Error state | Error message on failed application submit |
| Permission behavior | No restriction |
| Known UX issue | None confirmed |
| Status | Active |

---

### Contact

| Field | Value |
|---|---|
| Route | `/contact` |
| Applicable roles | Public (no auth) |
| Priority | P0 |
| Purpose | Inquiry form for candidates and employers. Captures lead data. |
| Primary actions | Submit inquiry (name, email, phone, message, type) |
| Data displayed | Static contact details and form |
| APIs called | `POST /api/contacts` |
| Loading state | Button spinner on submit |
| Empty state | Not applicable |
| Error state | Validation errors inline; toast on API failure |
| Permission behavior | No restriction |
| Known UX issue | None confirmed |
| Status | Active |

---

### Insights Blog

| Field | Value |
|---|---|
| Route | `/insights` |
| Applicable roles | Public (no auth) |
| Priority | P1 |
| Purpose | Published content articles for brand awareness. |
| Primary actions | Browse articles, click through to article detail, subscribe to newsletter |
| Data displayed | Article title, author, date, category, preview |
| APIs called | `GET /api/studio/articles?status=published` |
| Loading state | Skeleton cards |
| Empty state | "No articles yet" |
| Error state | Error toast |
| Known UX issue | Requires at least one published article; `studio_articles` must be in `published` status |
| Status | Active |

---

### Insight Article

| Field | Value |
|---|---|
| Route | `/insights/:slug` |
| Applicable roles | Public (no auth) |
| Priority | P1 |
| Purpose | Individual article full-page read view. |
| Primary actions | Read article, navigate to author profile, subscribe to newsletter |
| Data displayed | Article title, author name, publication date, body content, tags |
| APIs called | `GET /api/studio/articles/:slug` |
| Loading state | Spinner while loading article |
| Empty state | Not applicable (redirect to `/insights` if slug not found) |
| Error state | 404 message if article not found or not in published status |
| Permission behavior | No restriction |
| Known UX issue | Requires article status = `published`; drafts and archived articles return not-found |
| Status | Active |

---

### Verify Letter

| Field | Value |
|---|---|
| Route | `/verify` |
| Applicable roles | Public (no auth) |
| Priority | P0 |
| Purpose | Anti-fraud document verification. Allows any member of the public to verify an HR letter or contract. |
| Primary actions | Enter reference number and auth code; receive verification result |
| Data displayed | Letter type, issue date, employee first name, revocation status |
| APIs called | `POST /api/verify-letter` |
| Loading state | Button spinner |
| Empty state | Initial state — form only |
| Error state | "Not found" for invalid reference |
| Permission behavior | Rate-limited only |
| Known UX issue | None confirmed |
| Status | Active |

---

### Offer Acceptance

| Field | Value |
|---|---|
| Route | `/onboard/:token` |
| Applicable roles | Candidates (token-gated, no account required) |
| Priority | P0 |
| Purpose | Candidate reviews and signs their offer letter. Token is single-use. |
| Primary actions | Review offer terms, sign (accept) |
| Data displayed | Offer letter content, candidate name, role, compensation |
| APIs called | `GET /api/offer-letters/token/:token`, `POST /api/offer-letters/token/:token/accept` |
| Loading state | Spinner while loading offer |
| Empty state | Redirect or error if token invalid |
| Error state | "Link expired" or "already accepted" |
| Permission behavior | Token validation only |
| Known UX issue | None confirmed |
| Status | Active |

---

### Addendum Acceptance

| Field | Value |
|---|---|
| Route | `/addendum/:token` |
| Applicable roles | Employees (token-gated, no account required) |
| Priority | P1 |
| Purpose | Employee reviews and countersigns an addendum clause (growth plan, device allocation, salary revision). |
| Primary actions | Review addendum, countersign |
| Data displayed | Addendum type, clause content, employee name, effective date |
| APIs called | `GET /api/offer-letter-addendums/token/:token`, `POST /api/offer-letter-addendums/token/:token/accept` |
| Loading state | Spinner while loading addendum |
| Empty state | Not applicable |
| Error state | "Link invalid or already signed" if token used or expired |
| Permission behavior | Token validation only — no portal login required |
| Known UX issue | None confirmed |
| Status | Active |

---

### Contract Sign (Client)

| Field | Value |
|---|---|
| Route | `/contracts/sign/:token` |
| Applicable roles | Client contacts (token-gated, no account required) |
| Priority | P1 |
| Purpose | Client reviews and signs a dispatched contract. |
| Primary actions | Review contract, sign |
| Data displayed | Contract content, client contact name, service terms |
| APIs called | `GET /api/contracts/sign/:token`, `POST /api/contracts/sign/:token/sign` |
| Loading state | Spinner while loading contract |
| Empty state | Not applicable |
| Error state | "Link invalid or contract already signed" |
| Permission behavior | Token validation only — no portal login required |
| Known UX issue | None confirmed |
| Status | Active |

---

### Service Vertical Pages

| Field | Value |
|---|---|
| Routes | `/services/healthcare-recruitment`, `/services/it-software`, `/services/engineering-technical`, `/services/non-it-professional`, `/services/contract-staffing` |
| Applicable roles | Public (no auth) |
| Priority | P1 |
| Purpose | Marketing pages for each staffing vertical. |
| Primary actions | Learn about services, navigate to Contact or Jobs |
| Data displayed | Static marketing content per vertical |
| APIs called | None |
| Loading state | Static pages — no async load |
| Empty state | Not applicable |
| Error state | Not applicable |
| Permission behavior | No restriction |
| Known UX issue | None confirmed |
| Status | Active |

---

## Admin Auth Screens

### Admin Login

| Field | Value |
|---|---|
| Route | `/admin/login` |
| Applicable roles | Unauthenticated users |
| Priority | P0 |
| Purpose | Email/password authentication entry point. TOTP verification follows in production. |
| Primary actions | Enter credentials, submit, enter TOTP code |
| Data displayed | Login form |
| APIs called | `POST /api/auth/login` |
| Loading state | Button spinner on submit |
| Error state | "Invalid credentials" toast; TOTP prompt if required |
| Permission behavior | Redirects to My Desk if already authenticated |
| Status | Active |

---

### Forgot Password / Reset Password

| Field | Value |
|---|---|
| Routes | `/admin/forgot-password`, `/admin/reset-password` |
| Applicable roles | Unauthenticated users |
| Priority | P0 |
| Purpose | Self-service password reset via email link. Token expires in 1 hour. |
| Primary actions | Enter email (forgot-password); enter new password and confirm (reset-password) |
| Data displayed | Forgot-password: email input form only. Reset-password: new-password form with token from URL. |
| APIs called | `POST /api/auth/forgot-password`, `POST /api/auth/reset-password` |
| Loading state | Button spinner on submit |
| Empty state | Not applicable |
| Error state | "Email not found" toast; "Token expired or invalid" on expired reset link |
| Permission behavior | Redirects authenticated users to My Desk |
| Known UX issue | Reset link expires in 1 hour — expired links show generic error, no re-send prompt on the reset page |
| Status | Active |

---

## Admin Portal Screens

### My Desk (Command Center)

| Field | Value |
|---|---|
| Route | `/admin/my-desk` |
| Applicable roles | All authenticated roles |
| Priority | P0 |
| Purpose | Role-specific daily work hub. Tabs: Dashboard, Time Card (attendance), Leave Balance, Apply Leave, Leave History, Accrual Log, Leave Calendar (holidays), Regularizations. |
| Primary actions | Punch in/out, start/end breaks, apply for leave, view team pulse (manager/HR) |
| Data displayed | Current punch status, today's hours, leave balances, team attendance summary (manager/HR) |
| APIs called | `GET /api/auth/me`, `GET /api/hr/dashboard-stats`, `GET /api/attendance`, `GET /api/leave-requests`, `GET /api/leave-balances`, `GET /api/attendance/breaks/today` |
| Loading state | Skeleton cards per tab |
| Empty state | "No records" per section |
| Error state | Error toast; punch button may not render if dashboard-stats fails |
| Permission behavior | All roles access this page; layout adapts by role |
| Known UX issue | No calendar view for attendance — action-first design only |
| Status | Active |

---

### My Profile

| Field | Value |
|---|---|
| Route | `/admin/profile` |
| Applicable roles | All authenticated roles |
| Priority | P1 |
| Purpose | Personal profile page. View and update LinkedIn URL, profile photo, and notification preferences. |
| Primary actions | Edit LinkedIn URL, upload profile photo, toggle notification preferences |
| Data displayed | Display name, email, role, department, LinkedIn URL, avatar, notification preference toggles |
| APIs called | `GET /api/auth/me`, `PATCH /api/auth/me/preferences`, `GET /api/hr/my-profile` |
| Loading state | Skeleton card while loading |
| Empty state | Not applicable (always shows authenticated user) |
| Error state | Error toast on save failure |
| Permission behavior | Every authenticated user sees their own profile only |
| Known UX issue | None confirmed |
| Status | Active |

---

### My Growth

| Field | Value |
|---|---|
| Route | `/admin/growth` |
| Applicable roles | All authenticated roles |
| Priority | P1 |
| Purpose | Employee's development hub — growth plan goals, training management, performance views. |
| Primary actions | View growth plan, submit progress updates, access training management |
| Data displayed | Active growth plan (if any), goal list, training track assignments |
| APIs called | `GET /api/hr/plans`, `GET /api/performance/goals`, `GET /api/learning-tracks` |
| Loading state | Skeleton cards per section |
| Empty state | "No active plan" / "No training assigned" per section |
| Error state | Error toast on load failure |
| Permission behavior | Employee sees own plan and goals only; manager/HR see via My Team path |
| Known UX issue | Growth plan visible only after a signed growth-clause addendum activates it |
| Status | Active |

---

### My Team (Tabs)

| Field | Value |
|---|---|
| Route | `/admin/hr/my-team` |
| Applicable roles | super_admin, admin, hr, manager, operations |
| Priority | P0 |
| Purpose | Manager and HR hub for team oversight. Sidebar sub-navigation with internal tabs: Team (roster), Corrections (punch corrections), Plans (employee plans). |
| Primary actions | View team attendance, correct punches, manage employee plans, view audit trail |
| Data displayed | Direct reports list, attendance status, leave status, plan status |
| APIs called | `GET /api/hr/team`, `GET /api/attendance`, `GET /api/hr/plans`, `POST /api/attendance/:id/correct` |
| Loading state | Skeleton table |
| Empty state | "No team members" if direct reports = 0 |
| Error state | Error toast on correction failure |
| Permission behavior | Manager sees own direct reports only; HR/admin see all |
| Known UX issue | None confirmed |
| Status | Active |

---

### People & HR

| Field | Value |
|---|---|
| Route | `/admin/hr/people` |
| Applicable roles | super_admin, admin, hr, manager, operations |
| Priority | P0 |
| Purpose | Consolidated HR management view. Tabs: Users, Salary Reports, Compliance Documents, Audit Logs. |
| Primary actions | Create/edit/deactivate users, view salary reports, verify documents, review audit trail |
| Data displayed | Employee list (name, role, department, status); salary slip index; document compliance table; audit log table |
| APIs called | `GET /api/users`, `GET /api/salary-slips`, `GET /api/employee-documents`, `GET /api/audit-logs` |
| Loading state | Skeleton table per tab |
| Empty state | "No users found" / "No records" per tab |
| Error state | Error toast on load or action failure |
| Permission behavior | Super_admin sees all; manager scoped to own direct reports on Users tab |
| Known UX issue | None confirmed |
| Status | Active |

---

### Recruitment

| Field | Value |
|---|---|
| Route | `/admin/recruitment` |
| Applicable roles | super_admin, admin, hr, operations, recruiter, manager |
| Priority | P0 |
| Purpose | Job postings management and candidate applications. Tabs: Jobs, Applications. |
| Primary actions | Create/edit jobs, sync from Ceipal, bulk upload via CSV, view and filter applications, push to Ceipal |
| Data displayed | Job list (title, location, category, date, status, hot flag); application list (candidate name, email, job, status) |
| APIs called | `GET /api/jobs`, `POST /api/jobs`, `POST /api/jobs/sync-ceipal`, `GET /api/applications` |
| Loading state | Skeleton table |
| Empty state | "No jobs found" / "No applications" |
| Error state | Error toast; Ceipal sync failure shows partial results with error count |
| Permission behavior | All listed roles can access; recruiter role cannot delete jobs |
| Known UX issue | Ceipal sync partial failure (some jobs fail) shows success count only — no per-job error detail |
| Status | Active |

---

### New Hire

| Field | Value |
|---|---|
| Route | `/admin/new-hire` |
| Applicable roles | super_admin, admin, hr, operations, manager (employee role excluded) |
| Priority | P0 |
| Purpose | Pre-employment pipeline. Tabs: Offer Letters, Onboarding (new hire status table), Users (inline user management). |
| Primary actions | Generate offer letters, approve/reject offers, countersign accepted offers, track onboarding progress, create users |
| Data displayed | Offer letter pipeline, onboarding checklist progress (training %, documents, bank details, consent), user list |
| APIs called | `GET /api/offer-letters`, `GET /api/users`, `GET /api/hr/onboarding-status` |
| Loading state | Skeleton table |
| Empty state | "No offers" / "No recent new hires" |
| Error state | Error toast |
| Permission behavior | Employee role blocked (403/redirect) |
| Known UX issue | None confirmed |
| Status | Active |

---

### Team Attendance

| Field | Value |
|---|---|
| Route | `/admin/hr/team-attendance` |
| Applicable roles | super_admin, admin, hr, manager, operations |
| Priority | P0 |
| Purpose | Real-time team attendance board with break status badges and date-range reporting. |
| Primary actions | View today's status per employee, view range report, export |
| Data displayed | Attendance status, punch times, break status (on_lunch, on_tea), hours worked |
| APIs called | `GET /api/hr/team-attendance`, `GET /api/attendance/range` |
| Loading state | Skeleton table |
| Empty state | "No team members" if direct reports = 0; "No records" for date range with no data |
| Error state | Error toast on load failure |
| Permission behavior | Manager sees own direct reports only; HR/admin see all employees |
| Known UX issue | Break status is a live derived field, not a stored enum — may lag if break API is slow |
| Status | Active |

---

### Leave Approvals

| Field | Value |
|---|---|
| Route | `/admin/hr/leave-approvals` |
| Applicable roles | super_admin, admin, hr, manager |
| Priority | P0 |
| Purpose | Queue for reviewing and deciding on pending leave requests. |
| Primary actions | Approve leave, reject with reason |
| Data displayed | Pending requests, employee name, leave type, dates, current balance |
| APIs called | `GET /api/leave-requests?status=pending`, `POST /api/leave-requests/:id/approve`, `POST /api/leave-requests/:id/reject` |
| Loading state | Skeleton list |
| Empty state | "No pending requests" |
| Error state | Error toast |
| Permission behavior | Manager sees own team only |
| Known UX issue | No bulk approve action |
| Status | Active |

---

### HR Tools

| Field | Value |
|---|---|
| Route | `/admin/hr/tools` |
| Applicable roles | super_admin, admin, hr |
| Priority | P0 |
| Purpose | HR letter generation (Experience, Internship, Relieving, Amendment types). Salary slip generation. |
| Primary actions | Generate letter, issue, revoke, email, download PDF, generate amendment letter |
| APIs called | `POST /api/hr-letters`, `POST /api/hr-letters/:id/issue`, `GET /api/hr-letters/:id/download` |
| Loading state | Spinner on generation |
| Error state | Error toast on generation failure |
| Permission behavior | Only hr, admin, super_admin access this page |
| Status | Active |

---

### My Training

| Field | Value |
|---|---|
| Route | `/admin/hr/my-training` |
| Applicable roles | All authenticated roles |
| Priority | P0 |
| Purpose | Employee's own training assignments. Complete sections, pass quizzes, acknowledge content. |
| Primary actions | Start track, complete section, pass quiz, acknowledge |
| Data displayed | Assigned tracks, section progress, due dates, completion status |
| APIs called | `GET /api/track-assignments`, `POST /api/track-assignments/:id/progress`, `POST /api/section-progress` |
| Loading state | Skeleton cards |
| Empty state | "No training assigned" |
| Error state | Error toast |
| Permission behavior | Employee sees own assignments only |
| Status | Active |

---

### Training Progress

| Field | Value |
|---|---|
| Route | `/admin/hr/training-progress` |
| Applicable roles | super_admin, admin, hr, manager, operations, executive |
| Priority | P1 |
| Purpose | Team/org-wide training compliance view. Per-employee progress, CSV export. |
| Primary actions | Filter by employee/track, export CSV |
| Data displayed | Per-employee track completion percentage, section completion count, due date, overdue flag |
| APIs called | `GET /api/training-progress` |
| Loading state | Skeleton table |
| Empty state | "No training assignments found" |
| Error state | Error toast |
| Permission behavior | Manager sees own direct reports; HR/admin see all |
| Known UX issue | None confirmed |
| Status | Active |

---

### Training Catalog

| Field | Value |
|---|---|
| Route | `/admin/training/catalog` |
| Applicable roles | super_admin, admin, hr, manager, operations |
| Priority | P1 |
| Purpose | Browse, create, and assign learning tracks to employees. |
| Primary actions | Create track, assign to employee(s), set due date |
| Data displayed | Learning track list (title, sections, assigned count, completion rate) |
| APIs called | `GET /api/learning-tracks`, `POST /api/track-assignments` |
| Loading state | Skeleton cards |
| Empty state | "No tracks available" |
| Error state | Error toast on assignment failure |
| Permission behavior | All listed roles can view and assign |
| Known UX issue | None confirmed |
| Status | Active |

---

### SOP Library

| Field | Value |
|---|---|
| Route | `/admin/sops` |
| Applicable roles | super_admin, admin, hr, operations, manager |
| Priority | P1 |
| Purpose | SOP document management — create, review, publish, retire SOPs. Configure role assignments and wave rollout. |
| Primary actions | Create SOP, submit for review, approve, publish, configure wave |
| Data displayed | SOP list (title, status, version, category, last updated); role assignments; wave configuration |
| APIs called | `GET /api/sops`, `POST /api/sops`, `PATCH /api/sops/:id/transition` |
| Loading state | Skeleton table |
| Empty state | "No SOPs yet" |
| Error state | Error toast on transition failure |
| Permission behavior | Wave rollout configuration restricted to super_admin, admin only |
| Known UX issue | ≤2 operational SOPs per week cadence limit — publishing beyond limit returns error |
| Status | Active (behind `process_governance` flag) |

---

### SOP Compliance

| Field | Value |
|---|---|
| Route | `/admin/sops/compliance` |
| Applicable roles | All authenticated roles |
| Priority | P1 |
| Purpose | Employee view of their assigned SOPs with acknowledgement flow. |
| Primary actions | View SOP content, acknowledge |
| Data displayed | Assigned SOPs (title, status, due date, acknowledged/pending), acknowledgement hash on completion |
| APIs called | `GET /api/sops/my-assignments`, `POST /api/sops/:id/acknowledge` |
| Loading state | Skeleton list |
| Empty state | "No SOPs assigned" |
| Error state | Error toast on acknowledge failure |
| Permission behavior | Employee sees own assigned SOPs only; HR can view all via a separate admin path |
| Known UX issue | None confirmed |
| Status | Active (behind `process_governance` flag) |

---

### Policy Gate

| Field | Value |
|---|---|
| Route | `/admin/policy-gate` |
| Applicable roles | All authenticated roles (redirect target) |
| Priority | P0 |
| Purpose | Compliance lock page. Displayed when an employee has overdue SOP training and is blocked from portal access. Shows which SOPs/tracks are overdue and how to resolve. |
| Primary actions | View overdue items, contact HR for exception |
| APIs called | `GET /api/sops/compliance-lock-status` |
| Permission behavior | Replaces all admin portal content when lock conditions are met |
| Status | Active |

---

### Policy Signing

| Field | Value |
|---|---|
| Route | `/admin/hr/documents/policy/:signingId` |
| Applicable roles | All authenticated roles |
| Priority | P1 |
| Purpose | Employee views and e-signs a company policy document. |
| Primary actions | Read policy, sign |
| Data displayed | Policy document content, signing request details, signature prompt |
| APIs called | `GET /api/policy-signing-requests/:signingId`, `POST /api/policy-signing-requests/:signingId/sign` |
| Loading state | Spinner while loading document |
| Empty state | Not applicable |
| Error state | "Already signed" if signing request already completed; "Not found" if signingId invalid |
| Permission behavior | Authenticated users only; signingId must be assigned to the authenticated user |
| Known UX issue | None confirmed |
| Status | Active |

---

### Reports and Compliance

| Field | Value |
|---|---|
| Route | `/admin/hr/reports` |
| Applicable roles | super_admin, admin, hr, executive |
| Priority | P1 |
| Purpose | Attendance report generation and salary slip management. |
| Primary actions | Generate attendance report, review, approve, notify employees; generate salary slip per employee |
| Data displayed | Attendance report runs list (month, status, is_active flag); per-employee attendance summary |
| APIs called | `GET /api/attendance-reports`, `POST /api/attendance-reports/generate`, `POST /api/salary-slips/generate` |
| Loading state | Skeleton table; spinner on generate |
| Empty state | "No reports generated yet" |
| Error state | Error toast on generation failure |
| Permission behavior | All listed roles can generate and view; notify action requires super_admin or admin |
| Known UX issue | Multiple active rows possible if is_active filter not applied — UI should always filter is_active = true |
| Status | Active |

---

### Salary Advance

| Field | Value |
|---|---|
| Route | `/admin/salary-advance` |
| Applicable roles | All roles (self-request); hr, admin, super_admin (manage/record) |
| Priority | P0 |
| Purpose | Self-service advance request and management. Manual recording for HR. Active advances dashboard with installment tracking. |
| Primary actions | Submit request, view status, HR: approve/disburse/record manually |
| Data displayed | Active advance list (amount, type, status, outstanding balance, monthly installment); advance history |
| APIs called | `GET /api/salary-advance-requests`, `POST /api/salary-advance-requests`, `POST /api/salary-advance-requests/:id/approve` |
| Loading state | Skeleton table |
| Empty state | "No active advances" |
| Error state | Error toast on submission or approval failure |
| Permission behavior | Employee sees own advances; HR/admin see all; manual record button visible only to hr/admin/super_admin |
| Known UX issue | Advance request button hidden when `salary_advance_enabled` flag is OFF; HR manual recording still available |
| Status | Active |

---

### Payroll Run

| Field | Value |
|---|---|
| Route | `/admin/payroll/run` |
| Applicable roles | super_admin, admin, hr, executive |
| Priority | P0 |
| Purpose | Monthly payroll batch — generate, review, approve, dispatch slips, confirm payments. |
| Primary actions | Generate run, review per-employee amounts, approve, send slips, mark deposited |
| Data displayed | Run list (month, status); per-employee breakdown (gross, PF, ESI, PT, LOP, advance repayment, net pay) |
| APIs called | `POST /api/payroll/run`, `GET /api/payroll/run`, `POST /api/payroll/run/:id/approve`, `POST /api/payroll/run/:id/send` |
| Loading state | Skeleton table; spinner on generate |
| Empty state | "No runs generated yet" |
| Error state | Error toast; locked-run edit attempt returns 400 |
| Permission behavior | Final approve and disburse restricted to super_admin, admin, executive |
| Known UX issue | Slips cannot be recalled after dispatch — all corrections must be applied in next month's run |
| Status | Active |

---

### Payroll Setup

| Field | Value |
|---|---|
| Route | `/admin/payroll/setup` |
| Applicable roles | super_admin, admin, hr, executive |
| Priority | P1 |
| Purpose | Salary structure configuration — create/edit component breakdowns (Basic, HRA, allowances), assign structures to employees. |
| Primary actions | Create structure, add components, set computation rules, assign to employee |
| Data displayed | Structure list (name, components, assigned employees); component editor (type, percentage/amount, dependency) |
| APIs called | `GET /api/salary-structures`, `POST /api/salary-structures`, `POST /api/salary-structures/:id/assign` |
| Loading state | Skeleton table |
| Empty state | "No salary structures defined" |
| Error state | Error toast on save failure; circular dependency in components returns validation error |
| Permission behavior | All listed roles can view and configure; executive role is read-only on structures |
| Known UX issue | Employees without an assigned structure are skipped in payroll run without visible warning on this page |
| Status | Active |

---

### Performance Goals, Check-ins, Reviews, Review Cycles, Feedback

| Field | Value |
|---|---|
| Routes | `/admin/performance/goals`, `/admin/performance/check-ins`, `/admin/performance/reviews`, `/admin/performance/review-cycles`, `/admin/performance/feedback` |
| Applicable roles | All roles (varied per page) |
| Priority | P1 |
| Purpose | OKR-style goals, recurring check-ins, formal reviews, review cycles management, peer feedback. |
| Primary actions | Create goals, set milestones, complete check-ins, submit self-reviews, submit manager reviews, give feedback |
| Data displayed | Goal list (title, progress, due date); check-in list (employee, date, rating, notes); review cycle list; feedback feed |
| APIs called | `GET /api/performance/goals`, `GET /api/performance/check-ins`, `GET /api/performance/reviews` (per route) |
| Loading state | Skeleton cards per page |
| Empty state | "No goals yet" / "No check-ins scheduled" per section |
| Error state | Error toast; 404 if feature flag is OFF |
| Permission behavior | All pages hidden when `performance_management_enabled` flag is OFF; router redirects to My Desk |
| Known UX issue | Audit log does not capture old values on update — issue flagged in governance audit (NEEDS_EXTENSION) |
| Status | Active (when flag ON) |

---

### Control Tower

| Field | Value |
|---|---|
| Route | `/admin/control-tower` |
| Applicable roles | All roles (view); hr, admin, executive (manage) |
| Priority | P1 |
| Purpose | Governance obligations tracking — pending changes review, automated-changes audit. |
| Primary actions | Review pending obligation changes, approve/reject, escalate, dispute |
| Data displayed | Obligation list (title, status, owner, due date, severity); automated-changes queue |
| APIs called | `GET /api/governance-controls`, `PATCH /api/governance-controls/:id/transition` |
| Loading state | Skeleton table |
| Empty state | "No obligations recorded" |
| Error state | Error toast on transition failure |
| Permission behavior | All roles can view; hr/admin/executive can transition status; super_admin for CEO-level escalations |
| Known UX issue | None confirmed |
| Status | Active |

---

### Help Desk

| Field | Value |
|---|---|
| Routes | `/admin/help-desk`, `/admin/help-desk/:id` |
| Applicable roles | All roles |
| Priority | P0 |
| Purpose | Internal help desk ticket submission and management. |
| Primary actions | Create ticket, view own tickets, HR/ops: view queue, resolve, request more info |
| Data displayed | Ticket list (title, type, status, created date); ticket detail (messages, audit trail) |
| APIs called | `GET /api/help-desk`, `POST /api/help-desk`, `PATCH /api/help-desk/:id` |
| Loading state | Skeleton list |
| Empty state | "No tickets" |
| Error state | Error toast on create or transition failure |
| Permission behavior | Employee sees own tickets; HR/ops see all tickets in queue |
| Known UX issue | None confirmed |
| Status | Active |

---

### Systems Vault

| Field | Value |
|---|---|
| Routes | `/admin/vault`, `/admin/vault/audit` |
| Applicable roles | All roles (read with grant); super_admin, admin (manage) |
| Priority | P1 |
| Purpose | Secure shared credential storage. Audit page shows all access events. |
| Primary actions | Store secret, reveal/copy secret, share grant, revoke access, view audit log |
| Data displayed | Secret list (name, shared with, last accessed); audit log (event type, user, timestamp) |
| APIs called | `GET /api/vault-secrets`, `POST /api/vault-secrets`, `POST /api/vault-secrets/:id/reveal`, `GET /api/vault/audit-logs` |
| Loading state | Skeleton list |
| Empty state | "No secrets stored" / "No audit events" |
| Error state | Error toast on reveal failure if grant revoked |
| Permission behavior | Reveal/copy requires an active grant; super_admin/admin can manage all secrets |
| Known UX issue | None confirmed |
| Status | Active |

---

### Finance / Contracts Hub

| Field | Value |
|---|---|
| Route | `/admin/finance` |
| Applicable roles | super_admin, admin, hr, operations, manager |
| Priority | P1 |
| Purpose | Client contract lifecycle management — draft, dispatch, track signing. |
| Primary actions | Create contract, dispatch to client, track signing status, countersign |
| Data displayed | Contract list (title, client, status, dates); per-contract detail (status history, signing link) |
| APIs called | `GET /api/contracts`, `POST /api/contracts`, `POST /api/contracts/:id/dispatch` |
| Loading state | Skeleton table |
| Empty state | "No contracts yet" |
| Error state | Error toast on create or dispatch failure |
| Permission behavior | All listed roles can view and create; countersign restricted to admin/super_admin |
| Known UX issue | None confirmed |
| Status | Active |

---

### Settings

| Field | Value |
|---|---|
| Route | `/admin/settings/:group` |
| Applicable roles | super_admin, admin, hr (varies by group) |
| Priority | P1 |
| Purpose | Parameterized settings pages. Groups include: leave types, holidays, departments, feature flags, access control matrix, payroll settings. |
| Primary actions | CRUD leave types, add/edit holidays, manage departments, toggle feature flags, manage access control |
| Data displayed | Per-group configuration table or form |
| APIs called | Varies by group: `GET/POST/PATCH /api/leave-types`, `/api/holidays`, `/api/departments`, `/api/system-settings` |
| Loading state | Skeleton form per group |
| Empty state | Empty configuration table (e.g., "No holidays added") |
| Error state | Error toast on save failure |
| Permission behavior | Feature flags and access control matrix restricted to super_admin only; HR can access leave types and holidays |
| Known UX issue | None confirmed |
| Status | Active |

---

### Executive Cockpit

| Field | Value |
|---|---|
| Routes | `/admin/executive-cockpit`, `/admin/payroll/executive` |
| Applicable roles | executive, super_admin |
| Priority | P1 |
| Purpose | Executive/finance read-only dashboard — payroll stats, headcount history, statutory export. |
| Primary actions | View payroll summary, download statutory export, review headcount history |
| Data displayed | Payroll run list (month, total gross, total net, status); headcount history (joiners, leavers per month); statutory deduction totals |
| APIs called | `GET /api/payroll/executive/summary`, `GET /api/payroll/executive/statutory-export`, `GET /api/payroll/executive/headcount-history` |
| Loading state | Skeleton cards per section |
| Empty state | "No payroll runs yet" / "No headcount history" |
| Error state | Error toast |
| Permission behavior | `RequireRoles` gate (client-side). Backend enforces `requirePermission`. Non-executive roles redirected to My Desk. `UNABLE_TO_CONFIRM — OWNER REVIEW REQUIRED`: full backend permission audit not done. |
| Known UX issue | Data refreshes on page load only — no push/live-update |
| Status | Active |

---

### Admin Users

| Field | Value |
|---|---|
| Route | `/admin/users` |
| Applicable roles | super_admin, admin, hr, manager |
| Priority | P0 |
| Purpose | Direct user management table (also accessible within `/admin/hr/people`). |
| Primary actions | Create user, edit user, deactivate, soft-delete (super_admin only), CSV bulk upload |
| Data displayed | Employee list (name, email, role, department, status, joining date) |
| APIs called | `GET /api/users`, `POST /api/users`, `PATCH /api/users/:id`, `DELETE /api/users/:id` |
| Loading state | Skeleton table |
| Empty state | "No users found" |
| Error state | Error toast; duplicate email returns validation error |
| Permission behavior | Only super_admin can soft-delete; manager cannot delete |
| Known UX issue | None confirmed |
| Status | Active |

---

### Org Chart

| Field | Value |
|---|---|
| Route | `/admin/hr/org-chart` |
| Applicable roles | All authenticated roles |
| Priority | P1 |
| Purpose | Visual organization hierarchy built from manager_id relationships. |
| Primary actions | Browse hierarchy, click through to employee card |
| Data displayed | Tree/graph of employees by reporting relationship; each node shows name, role, department, avatar |
| APIs called | `GET /api/users` (full list, manager_id used for hierarchy) |
| Loading state | Spinner while building tree |
| Empty state | "No employees" if user list is empty |
| Error state | Error toast on load failure |
| Permission behavior | All authenticated roles can view; no write actions on this screen |
| Known UX issue | Orphan nodes possible if `manager_id` is NULL or points to deleted user |
| Status | Active |

---

### My Documents

| Field | Value |
|---|---|
| Route | `/admin/hr/my-documents` |
| Applicable roles | All authenticated roles |
| Priority | P1 |
| Purpose | Employee's own document checklist — bank details, emergency contacts, uploaded compliance documents. |
| Primary actions | Upload document, add bank account details, add emergency contact, view verification status |
| Data displayed | Document checklist (required/optional, verified/pending/rejected); bank account details; emergency contact list |
| APIs called | `GET /api/employee-documents`, `POST /api/employee-documents/upload`, `GET /api/employee-bank-details`, `POST /api/employee-bank-details` |
| Loading state | Skeleton checklist |
| Empty state | "No documents uploaded yet" |
| Error state | Error toast on upload failure; rejected documents show rejection reason |
| Permission behavior | Employee sees own documents; HR/admin can manage documents for any employee via People & HR |
| Known UX issue | None confirmed |
| Status | Active |

---

### HR Profile

| Field | Value |
|---|---|
| Route | `/admin/hr/profile` |
| Applicable roles | All authenticated roles |
| Priority | P1 |
| Purpose | Detailed HR profile view for the authenticated user — employment details, shift, manager. |
| Primary actions | View employment details, update contact information |
| Data displayed | Full HR record: department, job title, joining date, shift, manager, employment type, salary (own only) |
| APIs called | `GET /api/hr/my-profile`, `PATCH /api/hr/my-profile` |
| Loading state | Skeleton card |
| Empty state | Not applicable (always shows authenticated user) |
| Error state | Error toast on update failure |
| Permission behavior | Employee sees own profile only; HR/admin can edit any employee's HR profile via People & HR |
| Known UX issue | None confirmed |
| Status | Active |

---

## P2 and P3 Screen Stubs

| Route | Applicable Roles | Status |
|---|---|---|
| `/admin/notifications` | All | Active (flag gated) |
| `/admin/communications` | All | Active |
| `/admin/travel-calculator` | All | Active |
| `/admin/salary-advance` (manual recording section) | super_admin, admin, hr | Active |
| `/admin/probation-guide` | All | Active |
| `/admin/sops/my-reviews` | All | Active |
| `/admin/performance/analytics` | All | Active (partial) |
| `/admin/service-desk` | All | Active |
| `/admin/hr/reports` (attendance report) | super_admin, admin, hr, executive | See P1 full entry above |
| `/studio/*` (all Content Studio v2 routes) | super_admin, admin, Studio add-on roles | Active (flag gated) |
| `/admin/studio/*` (all legacy Studio routes) | super_admin, admin, Studio add-on roles | Active (redirects to /studio when flag ON) |
| `/it-staffing` | Public | Active |
| `/ehealthcare-staffing` | Public | Active |
| `/why-hire-in-solutions` | Public | Active |
| `/it-staffing-guide` | Public | Active (`CURRENT_BUT_INCOMPLETE` — in router, no main nav entry confirmed) |
| `/healthcare-staffing-guide` | Public | Active (`CURRENT_BUT_INCOMPLETE` — in router, no main nav entry confirmed) |
| `/staffing-faq` | Public | Active (`CURRENT_BUT_INCOMPLETE` — in router, no main nav entry confirmed) |
| `/request-a-quote` | Public | Active |
| `/capability-deck` | Public | Active |
| `/terms` | Public | Active |
| `/privacy` | Public | Active |
| `/insights/authors` | Public | Active |
| `/insights/authors/:slug` | Public | Active |
| `/admin/hr/my-team` (Plans sub-tab) | super_admin, admin, hr, manager | Active |

---

## Legacy Routes (Redirect Only)

The following routes exist in the router as redirects and should not be documented as standalone screens. They are listed for completeness.

| Route | Redirects To |
|---|---|
| `/admin` | `/admin/my-desk` (or `/admin/executive-cockpit` for executive role) |
| `/admin/hr` | `/admin/my-desk` (tab-mapped) |
| `/admin/hr/dashboard` | `/admin/my-desk` |
| `/admin/hr/attendance` | `/admin/my-desk?tab=time-card` |
| `/admin/hr/leaves` | `/admin/my-desk?tab=leave-balance` |
| `/admin/hr/holidays` | `/admin/my-desk?tab=leave-calendar` |
| `/admin/hr/tickets` | `/admin/my-desk?tab=regularizations` |
| `/admin/hr/salary-slips` | `/admin/my-desk?tab=payslips` |
| `/admin/hr/training` | `/admin/growth?tab=training-mgmt` |
| `/admin/jobs` | `/admin/recruitment` |
| `/admin/applications` | `/admin/recruitment?tab=applications` |
| `/admin/hr/salary-reports` | `/admin/hr/people?tab=salary` |
| `/admin/hr/document-compliance` | `/admin/hr/people?tab=compliance` |
| `/admin/audit-logs` | `/admin/hr/people?tab=audit` |
| `/admin/automated-changes` | `/admin/control-tower?tab=automated-changes` |
| `/admin/performance/team-goals` | `/admin/growth?tab=team-goals` |
| `/admin/performance/team-reviews` | `/admin/growth?tab=team-reviews` |
| `/admin/hr/settings` | Settings (via `resolveSettingsRedirect`) |
| `/admin/settings` | Settings (via `resolveSettingsRedirect`) |
