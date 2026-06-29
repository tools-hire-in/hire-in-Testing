# Hire'in Solutions - AI-Powered Staffing & Talent Acquisition Firm

## Overview
Hire'in Solutions is an AI-powered staffing & talent acquisition firm designed to streamline recruitment, enhance candidate matching, and provide robust internal HR management for a professional staffing agency specializing in Healthcare, IT, Engineering, and Professional Services. It comprises a public-facing marketing website with job listings and a comprehensive admin portal. The platform aims to achieve efficient operations and significant market impact by leveraging AI.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The platform features a modern UI with React 18, TypeScript, Tailwind CSS, and Shadcn/ui for components. Styling uses CSS variables for theming. A public-facing IT Staffing Marketing Page (`/it-staffing`) includes a hero section, stats strip, interactive slide viewer, and download options, adhering to specific brand colors (Navy #1F3A6E, Orange #F47C20/#F96D3E). Mockup sandboxes exist for design artifacts like LinkedIn cover pages and payslips.

### Technical Implementations
- **Frontend**: React 18, TypeScript, Tailwind CSS, Shadcn/ui, TanStack Query for state, Wouter for routing, React Hook Form with Zod for forms.
- **Backend**: Node.js with Express.js, TypeScript, RESTful JSON APIs.
- **Authentication**: Replit Auth (OpenID Connect) and custom email/password (bcrypt), Express-session with PostgreSQL store.
- **Authorization**: Role-Based Access Control (RBAC) with granular roles.
- **File Uploads**: Multer with presigned URLs for object storage.
- **Database**: PostgreSQL with Drizzle ORM, sharing a schema for jobs, applications, contacts, admin users, and the HR portal.

### Feature Specifications
The platform includes a comprehensive HR Portal System with:
- **Employee Management**: Dashboard, attendance, leave management (EL 15 days/year with bonus months + SL 8 days/year; monthly accrual engine; LWP gating; weekend/holiday exclusion; year-end carry-forward/lapse batch; 4-tab employee UI: Balance/Apply/History/Accrual), holiday calendar, profile, tickets, org chart. Support for employee exit statuses: Relieved (involuntary) and Left Company (voluntary).
- **Manager Features**: Team attendance viewing, leave request approvals, configurable attendance thresholds, proactive training extension requests.
- **HR/Admin Features**: Comprehensive settings for leave types, holidays, departments, and user management. Super Admin soft-delete functionality.
- **New Hire Section** (`/admin/new-hire`): Dedicated page for the pre-employment pipeline accessible to all roles except employee (super_admin, admin, hr, operations, manager). Three tabs: **Offer Letters** (OfferLetterGenerator + OfferLettersDashboard; managers can generate/track, HR/admin can approve/countersign), **Onboarding** (status table of employees joined within last 90 days or with NULL joining_date, including non-admin roles, showing training %, documents uploaded, bank details, night-shift consent), and **Users** (inline user management panel, same as People & HR > Users).
- **HR Tools**: Salary Slip Generator (PDF, LOP deductions), Template-based Letter Generator (Experience, Internship, Relieving letters with controlled wording). **Amendment Letters**: Salary Revision, Designation/Promotion, Combined, Device Allocation — with system employee picker or manual entry, DOCX generation via existing addendum engine, optional email delivery. Verifiable via /verify page. (Offer Letter features moved to New Hire section.)
- **Salary Advance — Manual Recording**: super_admin/admin/hr can record advances/overpayments for any employee directly from Active Advances ("Record for Employee"), bypassing the request/approval flow. Two kinds: a **backfilled advance** (pick amount, repayment months, start month) and an **overpayment** (recovered full next cycle, remainder carries forward). Records are created as `disbursed` so the existing monthly payroll recovery engine handles them; rows show Advance/Overpayment badges + a "Manually recorded" marker, with the acting user logged in the audit trail. This tool works even when the self-service `salary_advance_enabled` flag is OFF.
- **Public Document Verification**: A `/verify` page for HR letters using reference number and auth code.
- **Offer Acceptance & Counter-Signature**: Candidate acceptance and HR/Admin counter-signing with cryptographic document hashing.
- **My Team Management**: Role-based employee management page (`/admin/hr/my-team`) with read-only views, edit capabilities (e.g., punch corrections, profile updates), leave tracking, and an audit trail for all changes.
- **Break Tracking System**: Employees can start/end Lunch (1×30min) and Tea (2×15min) breaks via a BreakWidget on the dashboard and on the Attendance tab. Live timer, policy tooltip with soft warnings. Backend break_records table. Managers see on_lunch/on_tea status badges in Team Attendance.
- **Attendance Tab (Employee)**: Redesigned as an action-first "Time Card" — no calendar. Shows: live hours counter + progress bar toward 8h target, full-width Punch In/Out button, Punch In/Out times, Breaks card (appears when punched in), month summary (days present / total hours / avg), recent records table (newest first). Bug fixed: missing `today` variable in `dashboard-stats` endpoint caused 500 error hiding the Punch In button; duplicate endpoint removed.
- **Role-Specific Dashboards**: HRDashboard adapts by role — manager/admin/HR see a "Your Team Today" pulse card with present/absent/on-leave/pending-leave counts and quick actions. Employee view shows personal attendance, leave balance, break widget.
- **Consolidated Navigation & Sidebar**: New AdminLayout with profile avatar header, collapsible icon sidebar (persisted via localStorage), and consolidated nav items: My Work, My Profile, My Growth, My Team, Recruitment, People & HR.
- **Tab-Based Page Consolidation**: My Work (/admin/hr) has 4 tabs: Dashboard/Attendance/Leaves/Holidays. My Team (/admin/hr/my-team) has 4 tabs. People & HR (/admin/hr/people) consolidates HR management views.
- **`/admin` Redirect**: Root /admin now redirects to /admin/hr (My Work dashboard).
- **Post-Onboarding Documents**: Management of employee documents, bank details, and emergency contacts.
- **Feature Flags**: Centralized management via `system_settings` table for features like notifications, document reminder emails, onboarding training, and performance management.
- **In-App Notifications**: System with unread count badge, dependent on feature flags.
- **Security**: Mandatory TOTP 2FA, 30-minute auto session timeout with warning, rolling sessions.
- **Onboarding Training & SOPs System**: Structured learning tracks with sections, content, quizzes, and acknowledgements. Includes HR Admin management, employee "My Training" views, and manager/HR progress tracking. Features a "Training Compliance Lock" for overdue training.
- **Performance Management Module**: (Enabled by feature flag) Includes performance goals, check-ins, review cycles, reviews (self/manager), and feedback. Dedicated UI pages for 'My Goals', 'Team Goals', 'Check-Ins', 'My Reviews', 'Team Reviews', 'Review Cycles', 'Feedback', and 'Analytics'. Role-based access and audit logging for all operations.

### System Design Choices
- **Modular Design**: Features like the HR Portal and Performance Management are designed as integrated modules within the admin panel.
- **Role-Based Access Control**: Granular access control applied across the system.
- **Audit Trails**: All significant actions, especially write operations and manual adjustments, are logged.
- **Internationalization**: Support for regional holidays and potentially other localized content.
- **Email Integration**: Extensive use of transactional emails for various system events.

### Database Schema & Migration Policy
- **Single source of truth**: `shared/schema.ts`. Schema reaches the DB via `drizzle-kit push` (`npm run db:push`). Any column/table that startup "ensure" blocks in `server/index.ts` create MUST also be declared in `shared/schema.ts` — otherwise `db:push` treats it as an orphan and tries to DELETE it (data loss). Ensure-blocks are for idempotent backfills/seeds, not for owning columns that schema.ts doesn't know about.
- **Drift guard**: `scripts/check-schema-drift.sh` (registered as the `schema-drift` validation) fails if the live DB diverges destructively from `shared/schema.ts`. It answers "No, abort" to every drizzle prompt, so it never applies a destructive change; it only flags drops/renames. Run it before any prod release.
- **Merge guard**: `scripts/post-merge.sh` runs the same pre-flight before applying `db:push --force`, and aborts the merge on any destructive/ambiguous change. Note: drizzle's data-loss wording is "delete <x> column" (NOT "drop column") — guards must match that.
- **Never** resolve a drizzle "is created or renamed" prompt as a rename — it is data-destructive. Never hand-run a generated migration file blindly against prod; the committed `migrations/` files are dormant (only applied when `RUN_MIGRATIONS=true`).

## External Dependencies

### Database
- **PostgreSQL**: Primary data store and session management.

### Authentication
- **Replit Auth**: OpenID Connect provider for user authentication.

### File Storage
- **Google Cloud Storage**: Object storage for file uploads.

### Email Service
- **SendGrid**: For transactional emails.

### ATS Integration
- **Ceipal ATS**: Integration for job synchronization and applicant data pushing using JWT.

### External Services
- **Google Fonts**: For typography.
- **Unsplash**: For hero carousel images.
- **Rayo Academy**: Optional external training platform integration (thin-client) with API calls and graceful fallback.