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
- **Regional Holidays**: Employees can select optional regional holidays.
- **Salary Processing**: Automated monthly salary reports with CSV attachments and individual salary slip generation.
- **Manual Adjustments**: HR can manually adjust leave balances with an audit trail.
- **Employee ID System**: Auto-generated unique employee IDs.
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
- **Ceipal ATS**: Integration for job synchronization (pull from Ceipal, upsert to platform) and applicant data pushing (push applications from platform to Ceipal). Uses JWT token-based authentication.

### External Services
- **Google Fonts**: For typography.
- **Unsplash**: For hero carousel images.