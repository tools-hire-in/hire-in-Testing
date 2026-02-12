# Hire'in Solutions - AI-Powered Recruitment Platform

## Overview

Hire'in Solutions is a professional staffing agency website combining AI-powered recruitment with human expertise. The platform specializes in Healthcare, IT, Engineering, and Professional Services recruitment. It features a public-facing marketing website with job listings and an admin portal for managing jobs, applications, contacts, and team members.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite with custom build script for production
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack Query for server state and data fetching
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support)
- **Component Library**: Shadcn/ui (Radix UI primitives) with custom styling
- **Forms**: React Hook Form with Zod validation
- **Icons**: Lucide React

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript (ESM modules)
- **API Style**: RESTful JSON APIs under `/api/*` routes
- **File Uploads**: Multer for multipart handling, presigned URLs for object storage
- **Authentication**: Replit Auth (OpenID Connect) with Passport.js
- **Session Management**: Express-session with PostgreSQL store (connect-pg-simple)

### Database Layer
- **Database**: PostgreSQL (provisioned via Replit)
- **ORM**: Drizzle ORM with drizzle-kit for migrations
- **Schema Location**: `shared/schema.ts` (shared between client and server)
- **Key Tables**: jobs, applications, contacts, admin_users, users, sessions, holidays, attendance, leave_types, leave_balances, leave_requests, tickets

### Project Structure
```
├── client/           # React frontend (Vite)
│   └── src/
│       ├── components/   # UI components (layout, forms, sections, ui)
│       ├── pages/        # Route pages (public + admin)
│       ├── hooks/        # Custom React hooks
│       └── lib/          # Utilities, constants, query client
├── server/           # Express backend
│   ├── routes.ts     # API route handlers
│   ├── storage.ts    # Database operations layer
│   └── replit_integrations/  # Auth and object storage modules
├── shared/           # Shared code (schema, types)
└── migrations/       # Drizzle database migrations
```

### Authentication Flow
- **Custom Email/Password Authentication**: bcrypt password hashing (12 salt rounds)
- Admin portal restricted to `@hire-in.com` email domain only
- Session-based authentication with 7-day cookie expiry using PostgreSQL-backed sessions
- Initial setup flow creates first Super Admin when no users exist (`POST /api/auth/setup`)

### Role-Based Access Control (RBAC)
Role hierarchy from highest to lowest access:
- **super_admin**: Full access to everything, including user/team management
- **admin**: Full access to all operational routes (jobs, applications, contacts) but NOT user management
- **hr**: Access to applications, contacts, all leave requests/approvals, team attendance, HR settings
- **operations**: Access to jobs, applications (view + status updates), contacts (view), holiday calendar
- **manager**: Employee features + view direct reports' attendance + approve/reject direct reports' leave requests
- **employee**: Dashboard access only (view stats)

Key files:
- `server/auth.ts`: Session setup and password hashing utilities
- `server/authRoutes.ts`: Login, logout, register, setup API routes
- `client/src/hooks/use-auth.ts`: Frontend auth state management
- `client/src/components/admin/AdminLayout.tsx`: Role-based menu filtering

### HR Portal System
The HR Portal is an internal employee management system integrated into the admin panel. It provides:

**Employee Features** (all roles):
- **Dashboard** (`/admin/hr`): Punch in/out widget, monthly stats, leave balances, upcoming holidays
- **Attendance** (`/admin/hr/attendance`): Monthly attendance records with status tracking
- **Leave Management** (`/admin/hr/leaves`): Apply for leave, view leave balances, cancel pending requests
- **Holiday Calendar** (`/admin/hr/holidays`): Company holidays grouped by month
- **Profile** (`/admin/hr/profile`): Personal info, attendance overview, leave balances
- **Tickets** (`/admin/hr/tickets`): Attendance regularization requests
- **Org Chart** (`/admin/hr/org-chart`): Interactive company hierarchy tree showing reporting structure

**Manager Features** (super_admin, admin, hr, manager roles):
- **Team Attendance** (`/admin/hr/team-attendance`): View direct reports' daily attendance with punch in/out times and hours
- **Leave Approvals** (`/admin/hr/leave-approvals`): Review/approve/reject team leave requests (managers see direct reports only; HR sees all)

**Leave Approval Escalation**: When an employee submits leave, it goes to their manager. If the manager is on approved leave, it escalates to the manager's manager, continuing up the chain. If no available manager is found, it falls through to HR. HR always has full access to approve/reject any leave request.

**HR/Admin Features** (super_admin, admin, hr roles):
- **HR Settings** (`/admin/hr/settings`): Manage leave types, holidays, and departments (CRUD)

**Organization Hierarchy**:
- Departments table for company-wide department management
- Hierarchy levels: CEO, VP, Director, Manager, Team Lead, Delivery Manager, Team Member
- Manager assignment creates reporting chains visible in the Org Chart
- Hierarchy editing available in Team Management page (super_admin, admin, hr)

**Hours-Based Leave Accrual System**:
- Leaves are NOT granted upfront — they are earned monthly based on hours worked
- Each leave type has: `monthlyAccrual` (days earned per month), `minHoursForAccrual` (minimum hours required in the month to qualify)
- Default: Annual Leave accrues 2 days/month (24/year max), requires 128 hours/month minimum (80% of 160 standard hours)
- `leave_accruals` table tracks: userId, leaveTypeId, year, month, accruedDays, hoursWorked, qualified (audit trail)
- HR runs accrual via POST `/api/hr/leave-accruals/run` with optional `{year, month}` body
- Unique constraint on (userId, leaveTypeId, year, month) prevents duplicate accruals
- Uses `ON CONFLICT DO NOTHING` for race-safety
- Sick Leave and Casual Leave are deactivated; only Annual Leave is active with accrual

**Key HR Tables**: holidays, attendance, leave_types, leave_balances, leave_requests, leave_accruals, tickets, departments

**HR Portal Key Files**:
- `client/src/pages/admin/hr/*`: All HR Portal frontend pages
- `server/routes.ts`: HR API routes under `/api/hr/*`
- `server/storage.ts`: HR storage operations
- `shared/schema.ts`: HR database tables and schemas

### Data Flow Pattern
- Frontend uses TanStack Query for API calls with automatic caching
- API requests go through `apiRequest` helper with JSON handling
- Backend storage layer abstracts database operations via `IStorage` interface
- Drizzle schemas generate Zod validators for type-safe API validation

## External Dependencies

### Database
- **PostgreSQL**: Primary data store, connection via `DATABASE_URL` environment variable
- **Session Storage**: PostgreSQL-backed sessions via connect-pg-simple

### Authentication
- **Custom Auth**: Email/password with bcrypt hashing
- **Environment Variables**: `SESSION_SECRET` for session encryption

### File Storage
- **Google Cloud Storage**: Object storage via `@google-cloud/storage`
- **Uppy**: Client-side file upload UI with AWS S3-compatible presigned URLs
- **Environment Variable**: `PUBLIC_OBJECT_SEARCH_PATHS` for public file access

### Email Service
- **SendGrid**: Transactional emails via Replit's SendGrid connector integration
- **Email Module**: `server/email.ts` with `sendInvitationEmail` and `sendWelcomeEmail` functions
- **Invitation Emails**: Sent when inviting new team members (includes temp password and login link)
- **Welcome Emails**: Sent on initial Super Admin setup
- **Resend Invitation**: Super Admin can resend invitations with fresh credentials via Team Management

### External Services
- **Google Fonts**: Inter and Open Sans typography (loaded via CDN)
- **Unsplash**: Hero carousel images (external URLs in constants)
- **SendGrid**: Email delivery for invitations and welcome emails

### Key NPM Packages
- Form validation: `zod`, `@hookform/resolvers`, `react-hook-form`
- Date handling: `date-fns`
- CSV parsing: `csv-parse` (for job CSV uploads)
- UI utilities: `class-variance-authority`, `clsx`, `tailwind-merge`
- Email: `@sendgrid/mail` (via Replit connector)
- TOTP/2FA: `otpauth`, `qrcode`