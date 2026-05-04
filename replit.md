# Hire'in Solutions - AI-Powered Recruitment Platform

## Overview
Hire'in Solutions is an AI-powered recruitment platform designed to streamline recruitment, enhance candidate matching, and provide robust internal HR management for a professional staffing agency specializing in Healthcare, IT, Engineering, and Professional Services. It comprises a public-facing marketing website with job listings and a comprehensive admin portal. The platform aims to achieve efficient operations and significant market impact by leveraging AI.

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
- **HR Tools**: Salary Slip Generator (PDF, LOP deductions), Offer Letter Generator (DOCX, auto-fill, email, digital acceptance, status tracking, addendum generation with HMAC-SHA256), Template-based Letter Generator (Experience, Internship, Relieving letters with controlled wording). **Amendment Letters**: Salary Revision, Designation/Promotion, Combined, Device Allocation — with system employee picker or manual entry, DOCX generation via existing addendum engine, optional email delivery. Verifiable via /verify page.
- **Public Document Verification**: A `/verify` page for HR letters using reference number and auth code.
- **Offer Acceptance & Counter-Signature**: Candidate acceptance and HR/Admin counter-signing with cryptographic document hashing.
- **My Team Management**: Role-based employee management page (`/admin/hr/my-team`) with read-only views, edit capabilities (e.g., punch corrections, profile updates), leave tracking, and an audit trail for all changes.
- **Break Tracking System**: Employees can start/end Lunch (1×30min) and Tea (2×15min) breaks via a BreakWidget on the dashboard. Live timer, policy tooltip with soft warnings. Backend break_records table. Managers see on_lunch/on_tea status badges in Team Attendance.
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