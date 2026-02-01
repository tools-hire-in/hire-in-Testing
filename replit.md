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
- **Key Tables**: jobs, applications, contacts, admin_users, users, sessions

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
- Replit Auth integration via OpenID Connect
- Admin portal restricted to `@hire-in.com` email domain
- Session-based authentication with 7-day cookie expiry
- User data synced to PostgreSQL users table

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
- **Replit Auth**: OpenID Connect provider for user authentication
- **Environment Variables**: `ISSUER_URL`, `REPL_ID`, `SESSION_SECRET`

### File Storage
- **Google Cloud Storage**: Object storage via `@google-cloud/storage`
- **Uppy**: Client-side file upload UI with AWS S3-compatible presigned URLs
- **Environment Variable**: `PUBLIC_OBJECT_SEARCH_PATHS` for public file access

### External Services
- **Google Fonts**: Inter and Open Sans typography (loaded via CDN)
- **Unsplash**: Hero carousel images (external URLs in constants)

### Key NPM Packages
- Form validation: `zod`, `@hookform/resolvers`, `react-hook-form`
- Date handling: `date-fns`
- CSV parsing: `csv-parse` (for job CSV uploads)
- UI utilities: `class-variance-authority`, `clsx`, `tailwind-merge`