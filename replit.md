# Hire'in Solutions - AI-Powered Recruitment Platform

## Overview
Hire'in Solutions is an AI-powered recruitment platform serving as a professional staffing agency specializing in Healthcare, IT, Engineering, and Professional Services. The platform includes a public-facing marketing website with job listings and a comprehensive admin portal. Its core purpose is to streamline recruitment, enhance candidate matching, and provide robust internal HR management, aiming for efficient operations and significant market impact.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS, Shadcn/ui, CSS variables for theming
- **State Management**: TanStack Query
- **Routing**: Wouter
- **Forms**: React Hook Form with Zod validation

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript
- **API Style**: RESTful JSON APIs
- **Authentication**: Replit Auth (OpenID Connect) and custom email/password (bcrypt)
- **Session Management**: Express-session with PostgreSQL store
- **File Uploads**: Multer with presigned URLs for object storage
- **Authorization**: Role-Based Access Control (RBAC) with granular roles.

### Database
- **Type**: PostgreSQL
- **ORM**: Drizzle ORM
- **Schema**: Shared, including tables for jobs, applications, contacts, admin_users, and a comprehensive HR portal system.

### HR Portal System
An integrated internal employee management system within the admin panel:
- **Employee Features**: Dashboard, attendance, leave management, holiday calendar, profile, tickets, org chart.
- **Manager Features**: Team attendance viewing, leave request approvals with escalation, configurable attendance thresholds. Proactive training extension requests (before and after due date) with direct manager approval for direct reports.
- **HR/Admin Features**: Comprehensive HR settings for leave types, holidays, departments, and user management.
- **Leave Accrual**: Hours-based, monthly leave earning system.
- **Holiday Management**: Support for regional and mandatory holidays with automated attendance stamping.
- **Salary Processing**: Automated monthly salary reports with CSV attachments and individual PDF salary slip generation. Configurable report recipients.
- **HR Tools**:
    - **Salary Slip Generator**: Generates payslips matching company template, auto-calculates LOP deductions, provides inline preview and PDF download.
    - **Offer Letter Generator**: Produces DOCX offer letters (Rayomind Solutions branded) with auto-fill from employee records, server-side DOCX generation, and email functionality for digital acceptance.
    - **Offer Letters Dashboard**: Tracks offer letter statuses (sent, viewed, accepted, countersigned, onboarded, expired, cancelled) with actions for status updates and onboarding initiation.
- **Offer Acceptance Flow**: Public page for candidates to view, verify name, and accept offers, generating cryptographic document hashes.
- **Counter-Signature Flow**: HR/Admin counter-signs accepted offers, generating additional cryptographic codes.
- **Manual Adjustments**: HR can manually adjust leave balances with audit trails.
- **Employee ID System**: Unique ID generation (`HIS-{DEPT}-{WORD}`) with collision avoidance.
- **My Team Management**: Comprehensive role-based employee management page (`/admin/hr/my-team`). Managers see direct + indirect reports; HR/Ops/Admin/Super Admin see all employees. Features include:
    - **Read-only views**: Profile, salary & slip history, attendance with punch times, regional holidays, leave balances
    - **Edit capabilities**: Punch-in/out corrections, profile updates (designation, department, hierarchy level), regional holiday selection changes, emergency contact management, ticket resolution
    - **Leave tracking**: Leave balances, accrual history, leave request history, apply leave on behalf for past dates (auto-approved)
    - **Audit trail**: All edits require a mandatory note/reason. Change History tab shows who changed what, before/after diff, when, and why.
- **Post-Onboarding Documents**: Management of employee documents, bank details, and emergency contacts.
- **Security**: Mandatory TOTP 2FA, 30-minute auto session timeout with warning, rolling sessions.
- **Onboarding Training & SOPs System**: Structured learning tracks with sections, markdown content, quizzes, and acknowledgements.
    - **HR Admin — Training Management**: Authors tracks, assigns to employees, publishes/unpublishes, and can seed pre-built SOP tracks.
    - **Employee — My Training**: Displays assigned tracks, provides a player with dwell time gates, quiz logic, and sign-off.
    - **Manager/HR — Training Progress**: Matrix view of employee training progress with drill-down details and CSV export.
    - **Feature Flag**: `onboarding_training_enabled` controls visibility for employees.
    - **Training Compliance Lock**: Overdue training locks portal access for certain roles, blocking actions like punch-in/out. Includes an extension request endorsement workflow.

### Performance Management Module (Phase 1)
An integrated performance management system behind the `performance_management_enabled` feature flag:
- **Database Tables**: `performance_goals`, `check_ins`, `review_cycles`, `reviews`, `performance_feedback` with full enum types.
- **API Routes**: All under `/api/performance/` namespace in `server/performanceRoutes.ts`. Includes Goals CRUD, Check-ins CRUD, Review Cycles management, Reviews (self/manager), Feedback (send/receive), and alerts badge endpoint.
- **Feature Flag**: `performance_management_enabled` in system_settings, toggleable from HR Settings page. Disabled by default. Admin/HR/Manager always have access; employees see menu items only when flag is enabled.
- **Sidebar**: "Performance" category with menu items: My Goals, Check-Ins, My Reviews, Feedback (employee-gated), Team Goals, Team Reviews (manager+), Review Cycles, Performance Analytics (HR/Admin).
- **Email Templates**: Review cycle opened notification, self-review due reminder, check-in reminder (24hr before) in `server/email.ts`.
- **Role-Based Access**: All endpoints enforce role-based access. Manager endpoints validate team membership via `getTeamMembers()`. All write operations create audit logs.
- **UI Pages**:
  - **My Goals** (`/admin/performance/goals`): Employee goal tracking with progress bars, status badges, filters (all/active/completed), create/edit/delete with validation. Categories include professional development, project delivery, leadership, technical skills, communication, innovation.
  - **Team Goals** (`/admin/performance/team-goals`): Manager/HR/Admin view of direct reports' goals grouped by employee in collapsible sections. Summary stats (total, % completed, % in progress). Ability to assign goals to team members.
  - **Check-Ins** (`/admin/performance/check-ins`): 1:1 meeting management with upcoming/past tabs. Create, edit, add notes (employee & manager), action items, star ratings, and mark complete. Manager sees all direct reports; employees see their own check-ins.
  - **My Reviews** (`/admin/performance/reviews`): Employees view active/past reviews and submit self-reviews (goals reflection, strengths, improvements, development needs, 1-5 star rating). Includes Rayo Academy CTA button.
  - **Team Reviews** (`/admin/performance/team-reviews`): Managers see direct reports' review status and submit manager assessments with side-by-side self-review reference.
  - **Review Cycles** (`/admin/performance/review-cycles`): HR/Admin create and manage review cycles (annual/semi-annual/quarterly) with status transitions (draft→active→in_review→closed) and participant breakdown.
  - **Feedback** (`/admin/performance/feedback`): Send/receive feedback with type badges (praise/constructive/general), recipient search, and optional goal linking.
  - **Analytics** (`/admin/performance/analytics`): Summary cards (active goals, completion %, review completion rate, avg rating, feedback count) with department breakdown for HR/Admin.
- **Rayo Academy CTA**: Configurable URL (via HR Settings) that opens in new tab with pre-filled employee email. Settings stored via system_settings API.
- **Sidebar Badge**: Performance alerts badge on "My Goals" showing count of pending self-reviews and upcoming check-ins.

### UI/UX & Design Artifacts
- **Mockup Sandbox**: Serves design-only components for LinkedIn cover pages, payslips, and a comprehensive IT Staffing Marketing Deck.
- **IT Staffing Marketing Deck**: An 11-slide deck focusing on IT Staffing, detailing services, models, AI tools, sourcing processes, and contact information. Uses specific brand colors: Navy #1F3A6E, Orange #F47C20/#F96D3E.
- **IT Staffing Marketing Page (`/it-staffing`)**: Public-facing page featuring a hero section, stats strip, interactive slide viewer, download options (PDF, PPT), highlights, and CTA footer. Includes SEO optimization and navigation integration.

## External Dependencies

### Database
- **PostgreSQL**: Primary data store and session management.

### Authentication
- **Replit Auth**: OpenID Connect provider.

### File Storage
- **Google Cloud Storage**: Object storage for file uploads.
- **Uppy**: Client-side file upload UI.

### Email Service
- **SendGrid**: For transactional emails (invitations, welcome, password resets, reminders).

### ATS Integration
- **Ceipal ATS**: Integration for job synchronization (pull from Ceipal) and applicant data pushing (`savecustomapplicantdetails` endpoint) using JWT token-based authentication. Supports both internal `ceipalJobId` and human-readable `ceipalJobCode`.

### External Services
- **Google Fonts**: Typography.
- **Unsplash**: Hero carousel images.