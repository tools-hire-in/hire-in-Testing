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
  - **Salary Slip Generator**: Create payslips matching company template (Rayomind Solutions DBA Hire'in Solutions format) with employee info grid, earnings (Basic/HRA/Conveyance/Special Allowance), deductions (PF/ESI/PT/TDS), auto-calculated totals, and number-to-words. Can load from existing salary data or enter custom values. Preview inline and download as PDF.
  - **Offer Letter Generator**: Produce Word (DOCX) offer letters matching the company legal template with 12 sections + Annexure-R (BYOD). Form-driven with auto-fill from employee records, department dropdown, reporting manager dropdown, candidate personal email. Uses `docx` npm package for server-side DOCX generation. Can download DOCX or send offer letter directly via email for digital acceptance.
  - **Offer Letters Dashboard**: Tracks all sent offer letters with statuses (sent/viewed/accepted/onboarded/expired/cancelled). Actions: cancel sent/viewed offers, start onboarding for accepted offers. Start Onboarding modal: enter @hire-in.com email → creates employee profile (with cool employee ID) → sends comprehensive 10-step onboarding welcome email.
- **Offer Acceptance Flow**: Public page at `/onboard/:token` — candidate views full offer letter, accepts via checkbox + typed name (audit trail with IP/user-agent). Offer letters table tracks token, status, acceptance details, and resulting employee profile.
- **Manual Adjustments**: HR can manually adjust leave balances with an audit trail.
- **Employee ID System**: Format `HIS-{DEPT}-{WORD}` (e.g., HIS-IT-NOVA, HIS-HC-LYNX). Uses ~200 curated memorable 4-letter words, checks for collisions against existing IDs, fallback to random 4 letters if exhausted.
- **Post-Onboarding Documents**: A system for managing employee documents, bank details, and emergency contacts with compliance tracking and reminders.
- **Security**: Mandatory TOTP 2FA for all users (enforced on both frontend and backend), 30-minute auto session timeout with 15-minute idle warning, rolling sessions.

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