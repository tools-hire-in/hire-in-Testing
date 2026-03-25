# Hire'in Solutions - AI-Powered Recruitment Platform

## Overview
Hire'in Solutions is an AI-powered recruitment platform that combines advanced technology with human expertise. It functions as a professional staffing agency specializing in Healthcare, IT, Engineering, and Professional Services. The platform includes a public-facing marketing website with job listings and a comprehensive admin portal for managing jobs, applications, contacts, and team members. The business vision is to streamline recruitment processes, enhance candidate matching, and provide a robust internal HR management system for efficient operations.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode) and Shadcn/ui component library
- **State Management**: TanStack Query
- **Routing**: Wouter
- **Forms**: React Hook Form with Zod validation

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript
- **API Style**: RESTful JSON APIs
- **Authentication**: Replit Auth (OpenID Connect) with Passport.js and custom email/password authentication (bcrypt hashing)
- **Session Management**: Express-session with PostgreSQL store (30-minute TTL, rolling sessions)
- **File Uploads**: Multer with presigned URLs for object storage
- **Authorization**: Role-Based Access Control (RBAC) with roles: super_admin, admin, hr, operations, manager, employee.

### Database
- **Type**: PostgreSQL
- **ORM**: Drizzle ORM
- **Schema**: Shared between client and server, includes tables for jobs, applications, contacts, admin_users, sessions, holidays, attendance, leave types, leave requests, and more.

### HR Portal System
An integrated internal employee management system within the admin panel featuring:
- **Employee Features**: Dashboard, attendance tracking, leave management, holiday calendar, profile management, tickets, and an organizational chart.
- **Manager Features**: Team attendance viewing and leave request approvals for direct reports. Leave approval includes an escalation mechanism. Attendance threshold: 8 hours (8 PM - 4 AM IST shift).
- **HR/Admin Features**: Comprehensive HR settings for managing leave types, holidays, departments, and user management.
- **Leave Accrual**: Hours-based leave accrual system where leaves are earned monthly based on hours worked.
- **Regional Holidays**: Employees can select optional regional holidays. Holiday attendance is auto-stamped: creating a public/mandatory holiday auto-creates "holiday" attendance records for all active employees; selecting a regional holiday stamps that employee's attendance. Backfill runs on server startup for the current year.
- **Salary Processing**: Automated monthly salary reports with CSV attachments and individual salary slip generation. Report recipients (To/CC) are configurable by HR/super_admin on the Salary Reports page, stored in system_settings table.
- **HR Tools**: Admin/HR tools page (`/admin/hr/tools`) with three tabs:
  - **Salary Slip Generator**: Create payslips matching company template (Rayomind Solutions format) with employee info grid, earnings (Basic/HRA/Conveyance/Special Allowance), deductions (PF/ESI/PT/TDS), auto-calculated totals, and number-to-words. LOP deduction auto-calculated on 365-day basis: `(totalEarnings × 12) / 365 × lopDays`. Can load from existing salary data or enter custom values. Preview inline and download as PDF.
  - **Offer Letter Generator**: Produce Word (DOCX) offer letters. Shows Annual CTC (monthly × 12). Company name: Rayomind Solutions. Form-driven with auto-fill from employee records, department dropdown, reporting manager dropdown, candidate personal email. Uses `docx` npm package for server-side DOCX generation. Can download DOCX or send offer letter directly via email for digital acceptance.
  - **Offer Letters Dashboard**: Tracks all sent offer letters with statuses (sent/viewed/accepted/countersigned/onboarded/expired/cancelled). Actions: cancel sent/viewed offers, counter-sign accepted offers, start onboarding for countersigned offers. Start Onboarding modal: enter @hire-in.com email → creates employee profile (with cool employee ID) → sends comprehensive 10-step onboarding welcome email.
- **Offer Acceptance Flow**: Public page at `/onboard/:token` — candidate views full offer letter (Annual CTC display, Rayomind Solutions branding, unique Ref: OL-{8-char-uid}). Candidate must type exact name (cross-verification) + signing date. Server generates SHA-256 document hash + HMAC-SHA256 auth code (OFFER_SIGNING_KEY) → displayed as XXXX-XXXX-XXXX-XXXX-XXXX-XXXX. Typed name shown in Dancing Script cursive font.
- **Counter-Signature Flow**: After candidate accepts, HR/super_admin counter-signs via Offer Letters Dashboard. Pre-filled "Alina Carter" as HR signatory. Generates counterAuthCode via same cryptographic method. Status → "countersigned". Start Onboarding only available after counter-sign.
- **Manual Adjustments**: HR can manually adjust leave balances with an audit trail.
- **Employee ID System**: Format `HIS-{DEPT}-{WORD}` (e.g., HIS-IT-NOVA, HIS-HC-LYNX). Uses ~200 curated memorable 4-letter words, checks for collisions against existing IDs, fallback to random 4 letters if exhausted.
- **Post-Onboarding Documents**: A system for managing employee documents, bank details, and emergency contacts with compliance tracking and reminders.
- **Security**: Mandatory TOTP 2FA for all users (enforced on both frontend and backend), 30-minute auto session timeout with 15-minute idle warning, rolling sessions.
- **Onboarding Training & SOPs System**: Structured learning track system for employee onboarding. Hierarchy: Track → Section → Content + Quiz Question → Section Acknowledgement → Track Completion Receipt.
  - **HR Admin — Training Management** (`/admin/hr/training`): Authors tracks with sections, per-section markdown content, comprehension quiz (4 options, 1 correct, explanation), assign to employees with optional due date. Publish/unpublish/archive tracks. "Load SOP Content" button seeds 3 pre-built tracks from company SOPs.
  - **Employee — My Training** (`/admin/hr/my-training`): Card list of assigned tracks with progress bars. Track player with 3 steps per section: (1) Read with minimum dwell timer gate, (2) Quiz with retry logic (max 3 attempts), (3) Sign-off by typing full name. Track completion generates a receipt with cryptographic hash.
  - **Manager/HR — Training Progress** (`/admin/hr/training-progress`): Matrix of employees × published tracks with colour-coded status cells. Click to drill into per-section detail (dwell time, quiz attempts, acknowledgement timestamp). CSV export.
  - **Feature Flag**: `onboarding_training_enabled` in `system_settings`. Admins/HR/managers bypass flag; employees require flag=true to see "My Training" nav item. Toggle in HR Settings page under "Training & Onboarding" section.
  - **Training Compliance Lock**: Portal lock for overdue training (hr/manager/operations/employee roles). Super_admin and admin are exempt. Locked users are redirected to My Training; sidebar items grayed out. Punch-in/out blocked with auto-absent record creation. Users can request due date extensions (must provide reason for non-completion + reason for extension + new date). Hierarchical endorsement flow: employee→manager, manager→hr/admin, hr→admin, operations→admin must endorse before super_admin can approve/reject. Super_admin sees only endorsed requests in Training Management "Extensions" panel. Endorsers see "Endorse" button with pending count. Approval updates assignment due date; if new date is future, lock lifts immediately.
  - **Database Tables**: `learning_tracks`, `track_sections`, `section_quiz_questions`, `section_quiz_options`, `track_assignments`, `section_progress`, `section_acknowledgements`, `track_completions`, `onboarding_audit_events`, `training_extension_requests`.
  - **Backend**: `server/onboardingRoutes.ts` (registered in routes.ts). `server/onboardingSeed.ts` with 3 full tracks: Common Onboarding (6 sections), Healthcare Recruitment SOP (5 steps), IT Recruitment SOP (5 steps).
  - **System Settings API**: `GET/PUT /api/system-settings/:key` (HR_ROLES only) for generic key-value settings.

## Canvas Design Artifacts (Mockup Sandbox)

The mockup sandbox serves design-only components at `/__mockup/preview/<path>`.

### Registered Canvas Iframes

| Shape | Preview URL | File |
|-------|-------------|------|
| Hire'in Solutions — LinkedIn Cover Page | `/__mockup/preview/linkedin/Cover` | `artifacts/mockup-sandbox/src/components/mockups/linkedin/Cover.tsx` |
| Enterprise Payslip Design | `/__mockup/preview/payslip/Enterprise` | `artifacts/mockup-sandbox/src/components/mockups/payslip/Enterprise.tsx` |
| Hire'in Solutions — IT Staffing Marketing Deck | `/__mockup/preview/hiring-deck/HiringDeck` | `artifacts/mockup-sandbox/src/components/mockups/hiring-deck/HiringDeck.tsx` |

### HiringDeck — IT Staffing Marketing Deck

10-slide marketing deck for Hire'in Solutions focused exclusively on IT Staffing:
1. **Cover** — Logo, Kleriq AI badge, tagline "The Right Tech Talent, Right Now"
2. **About Us** — Mission, Rayomind family, 4 value pillars
3. **IT Services** — Permanent, Contract, Project-Based, RPO
4. **Staffing Models** — Matrix: 4 models × 4 features
5. **Kleriq AI** — Dedicated slide: resume parsing, JD matching, screening, bias-free, real-time scoring
6. **The Hire'in Advantage** — 4 boxes: Kleriq AI, IT Experts, Compliance-First, Fastest Fill
7. **Sourcing Process** — 5-step pipeline: Intake → AI Sourcing → Screening → Submit → Onboard
8. **Demand Fulfillment** — 7-stage SLA flow with 4 SLA metrics
9. **IT Domains** — Domain grid × staffing model matrix
10. **Let's Connect** — hire-in.com, hello@hire-in.com, LinkedIn

Brand: Navy #1F3A6E, Orange #F47C20/#F96D3E. IT-only — no Healthcare/Engineering/Professional Services.

## External Dependencies

### Database
- **PostgreSQL**: Primary database and session store.

### Authentication
- **Replit Auth**: OpenID Connect provider.

### File Storage
- **Google Cloud Storage**: For object storage.
- **Uppy**: Client-side file upload UI.

### Email Service
- **SendGrid**: For transactional emails including invitations, welcome emails, password resets, and document reminders.

### ATS Integration
- **Ceipal ATS**: Integration for job synchronization (pull from Ceipal, upsert to platform) and applicant data pushing (push applications from platform to Ceipal via `savecustomapplicantdetails` endpoint — JSON array payload with `first_name`, `last_name`, `email_address`, `mobile_number`, `resume_content` (base64), `filename`, `source`). Uses JWT token-based authentication. Jobs have both `ceipalJobId` (internal hash) and `ceipalJobCode` (human-readable, e.g., JPC-3); the UI shows `ceipalJobCode` prominently.

### Admin Applications Page
- **Grouped View**: Applications page (`/admin/applications`) shows applications grouped by job as card tiles. Each tile shows job title, Req ID, Ceipal code, location, prominent application count, status breakdown, and latest applied date. Clicking navigates to `/admin/applications/job/:jobId`.
- **Job Applications Detail**: `/admin/applications/job/:jobId` shows all applications for a specific job with full table, detail modals, status updates, Ceipal retry sync, resume download. Supports `jobId=unlinked` for applications without a linked job.
- **Jobs Page Columns**: Admin jobs table includes Job ID column (Req ID / Ceipal code) and Applications count column with clickable badge navigating to the job's applications.
- **Backend**: `GET /api/admin/applications?jobId=X` filters by job (supports `unlinked` for null jobId). `GET /api/admin/jobs/application-counts` returns `{jobId: count}` map.

### External Services
- **Google Fonts**: For typography.
- **Unsplash**: For hero carousel images.