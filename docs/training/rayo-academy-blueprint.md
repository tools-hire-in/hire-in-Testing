# Rayo Academy — Architecture Blueprint & Build Plan

### Prepared for: Rayo Academy Development Team
### Source: Hire'in Solutions — Architecture & Product
### Version: 1.0 | April 2026

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Capability Matrix](#2-capability-matrix)
3. [Auth Flow Specification](#3-auth-flow-specification)
4. [Data Model](#4-data-model)
5. [Public API for Hire'in Integration](#5-public-api-for-hirein-integration)
6. [Certificate Engine Requirements](#6-certificate-engine-requirements)
7. [Manager Capabilities](#7-manager-capabilities)
8. [Learner Experience](#8-learner-experience)
9. [Content Structure & Migration Mapping](#9-content-structure--migration-mapping)
10. [Phased Build Roadmap](#10-phased-build-roadmap)

---

## 1. Architecture Overview

### System Separation

Rayo Academy and Hire'in are **two independent web applications** that communicate over a REST API bridge. Neither system has direct access to the other's database.

```
┌──────────────────────────────┐        REST API (HTTPS)        ┌──────────────────────────────┐
│                              │ ◄────────────────────────────► │                              │
│        HIRE'IN               │                                │      RAYO ACADEMY            │
│   (HR Operations Portal)    │  POST /api/v1/provision-user   │  (Training & Certification)  │
│                              │  POST /api/v1/assign-track     │                              │
│   hire.in domain             │  GET  /api/v1/users/:email/*   │   rayo.academy domain        │
│                              │  GET  /api/v1/tracks           │                              │
│   Own database               │  POST /api/v1/users/:email/    │   Own database               │
│   Own auth (sessions)        │       deactivate               │   Own auth (email+password)   │
│   Own frontend               │                                │   Own frontend               │
│                              │     Authenticated via          │                              │
│                              │     API key (env secret)       │                              │
└──────────────────────────────┘                                └──────────────────────────────┘
```

**Rayo Academy** is the **source of truth** for:
- All training content (courses, tracks, sections, quizzes)
- Track and section management
- Learner progress, dwell time, quiz results
- Digital acknowledgements and sign-offs
- Certificates (issuance, storage, verification)
- XP, badges, leaderboard
- Quiz grading and attempt tracking

**Hire'in** is the **source of truth** for:
- Employee records, departments, roles
- Development plans and SMART goals
- Performance reviews and check-ins
- TA metrics dashboards
- Competency proficiency levels
- Coaching and mentoring records

**Shared identity model:** Users are provisioned from Hire'in to Rayo Academy via API. The employee's **email address** is the linking key between the two systems. Rayo Academy manages its own session/auth after the initial provisioning.

### Recommended Tech Stack (Rayo Academy)

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript (Vite) |
| Styling | Tailwind CSS + shadcn/ui |
| State Management | TanStack Query (React Query) |
| Routing | Wouter |
| Backend | Node.js + Express (TypeScript) |
| Database | PostgreSQL |
| ORM | Drizzle ORM |
| Auth | Email/password (bcrypt) + express-session |
| File Storage | S3-compatible (certificate PDFs) |
| Email | SendGrid (invitations, welcome emails) |
| PDF Generation | Puppeteer or html-pdf-node (certificates) |

### Design Principles

1. **API-first** — Every feature in Rayo Academy is accessible through a well-defined REST API. The Hire'in integration endpoints are a subset of the full internal API.
2. **Multi-tenant from Day 1** — Every table includes an `org_id` column. Phase 1 uses a single org (Rayomind Solutions), but the schema supports multiple organizations for future B2B SaaS.
3. **Immutable audit trail** — All progress events, acknowledgements, and certificate issuances are recorded in an append-only audit log.
4. **Separation of concerns** — Rayo Academy never stores HR data (salaries, reviews, attendance). Hire'in never stores training content or quiz answers.

---

## 2. Capability Matrix

| Capability | Hire'in | Rayo Academy |
|---|---|---|
| Course content, lessons, quizzes | No | Yes — source of truth |
| Track creation and management | No | Yes — admin panel |
| Track assignment by manager | Triggers via API | Stores and executes |
| Progress tracking and XP | Shows summary via API | Source of truth |
| Certificates | Shows link/download via API | Issues, stores, verifies |
| Dwell timer enforcement | No | Yes |
| Quiz grading and attempts | No | Yes |
| Digital acknowledgements/sign-offs | No | Yes |
| Scenario-based assessments | No | Yes — manager-graded |
| Leaderboard and badges | No | Yes |
| Development plan goals | Yes — source of truth | No |
| Check-ins and coaching | Yes | No |
| Performance reviews | Yes | No |
| TA metrics dashboard | Yes | No |
| Competency proficiency levels | Yes | Maps to track recommendations |
| Employee HR records | Yes — source of truth | Minimal profile only (email, name, role) |

---

## 3. Auth Flow Specification

### Overview

Rayo Academy uses a **simple email + password** auth model for the MVP. Users are provisioned from Hire'in via API. There is no SSO/OAuth in Phase 1 — this is documented as a future enhancement.

### Step-by-Step Sequence

```
Step 1: Hire'in admin creates employee
   │
   ▼
Step 2: Hire'in calls POST /api/v1/provision-user
        Body: { email, firstName, lastName, role, department }
   │
   ▼
Step 3: Rayo Academy creates account
        - Generates bcrypt-hashed temp password
        - Sets mustResetPassword = true
        - Returns { userId, tempPassword }
   │
   ▼
Step 4: Hire'in delivers temp password to employee
        - Option A: Show in UI after provisioning
        - Option B: Send via email (SendGrid)
   │
   ▼
Step 5: Employee visits rayo.academy/login
        - Enters email + temp password
        - Login succeeds → session created
   │
   ▼
Step 6: Forced password reset
        - If mustResetPassword === true, redirect to /reset-password
        - Employee sets new password (min 8 chars, 1 uppercase, 1 number)
        - mustResetPassword set to false
   │
   ▼
Step 7: Subsequent logins
        - Employee uses email + self-set password
        - Standard session-based auth (express-session + PostgreSQL session store)
```

### Error Handling

| Scenario | Behavior |
|---|---|
| Duplicate email in provision-user | Return `409 Conflict` with `{ error: "User already exists", userId }` |
| Invalid/expired temp password | Return `401 Unauthorized` with `{ error: "Invalid credentials" }` |
| Account deactivated | Return `403 Forbidden` with `{ error: "Account deactivated" }` |
| Password reset — weak password | Return `400 Bad Request` with `{ error: "Password does not meet requirements" }` |
| Session expired | Return `401 Unauthorized` — frontend redirects to /login |
| API key missing/invalid (integration endpoints) | Return `401 Unauthorized` with `{ error: "Invalid API key" }` |

### Role System

| Role | Description | Permissions |
|---|---|---|
| `learner` | Default role for provisioned users | View assigned tracks, complete sections, take quizzes, download certificates |
| `manager` | Team leads and assistant managers | All learner permissions + assign tracks, view team progress, grade scenarios |
| `org_admin` | Organization administrators | All manager permissions + manage tracks/content, manage users, view all org data |
| `rayo_super_admin` | Rayo Academy platform admin | All org_admin permissions + manage organizations, platform settings |

### Future Enhancement: OAuth2/OIDC

In Phase 2, implement OAuth2 Authorization Code flow so employees can click "Log in with Hire'in" on rayo.academy and be seamlessly authenticated. This requires:
- Hire'in acting as an OAuth2 provider (or both systems using a shared identity provider)
- PKCE flow for frontend security
- Token refresh mechanism

---

## 4. Data Model

### Entity Relationship Overview

```
organizations
  └── academy_users (org_id)
        ├── track_assignments
        │     ├── section_progress
        │     ├── section_acknowledgements
        │     └── track_completions → certificates
        ├── xp_ledger
        ├── badges_earned
        └── extension_requests

learning_tracks (org_id)
  └── track_sections
        ├── section_quiz_questions
        │     └── section_quiz_options
        └── section_scenarios
```

### Table Definitions

#### `organizations`
Multi-tenant root. Every data table references this.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, auto-generated | Organization ID |
| name | VARCHAR(255) | NOT NULL | Organization display name |
| domain | VARCHAR(255) | UNIQUE | Company domain (e.g., rayomind.com) |
| plan_tier | VARCHAR(50) | NOT NULL, DEFAULT 'internal' | Subscription tier (internal, starter, growth, enterprise) |
| api_key_hash | VARCHAR(255) | | Bcrypt hash of API key for integration auth |
| created_at | TIMESTAMP | DEFAULT NOW() | |

#### `academy_users`
User accounts in Rayo Academy. Provisioned from Hire'in via API.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, auto-generated | |
| org_id | UUID | FK → organizations.id, NOT NULL | |
| email | VARCHAR(255) | NOT NULL, UNIQUE per (org_id, email) | Link key to Hire'in |
| password_hash | VARCHAR(255) | NOT NULL | bcrypt hash |
| first_name | VARCHAR(100) | NOT NULL | |
| last_name | VARCHAR(100) | NOT NULL | |
| role | VARCHAR(50) | NOT NULL, DEFAULT 'learner' | learner, manager, org_admin, rayo_super_admin |
| department | VARCHAR(100) | | Department from Hire'in (e.g., Healthcare, IT) |
| must_reset_password | BOOLEAN | NOT NULL, DEFAULT true | Forces password reset on first login |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | Set to false when employee leaves |
| total_xp | INTEGER | NOT NULL, DEFAULT 0 | All-time XP |
| monthly_xp | INTEGER | NOT NULL, DEFAULT 0 | Current month XP (resets on 1st) |
| provisioned_from | VARCHAR(50) | DEFAULT 'hirein' | Source system |
| created_at | TIMESTAMP | DEFAULT NOW() | |
| updated_at | TIMESTAMP | DEFAULT NOW() | |

#### `learning_tracks`
Certification tracks (CFC, CHTP, CITP, custom).

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, auto-generated | |
| org_id | UUID | FK → organizations.id, NOT NULL | |
| code | VARCHAR(20) | NOT NULL, UNIQUE per (org_id, code) | Track code (CFC, CHTP, CITP) |
| title | VARCHAR(255) | NOT NULL | Full track name |
| description | TEXT | | Track overview |
| accent_color | VARCHAR(7) | | Hex color (#1F4E79, #117A65, #6C3483) |
| target_role | VARCHAR(100) | | Recommended role (null = all roles) |
| prerequisite_track_id | UUID | FK → learning_tracks.id | Must complete this track first |
| version | VARCHAR(10) | NOT NULL, DEFAULT '1.0' | |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'draft' | draft, published, archived |
| estimated_hours | INTEGER | | Total estimated hours |
| total_xp | INTEGER | NOT NULL, DEFAULT 0 | Total XP available in this track |
| created_by | UUID | FK → academy_users.id | |
| created_at | TIMESTAMP | DEFAULT NOW() | |
| updated_at | TIMESTAMP | DEFAULT NOW() | |

#### `track_sections`
Individual lessons/sections within a track.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, auto-generated | |
| track_id | UUID | FK → learning_tracks.id, ON DELETE CASCADE, NOT NULL | |
| title | VARCHAR(255) | NOT NULL | Section title |
| body | TEXT | NOT NULL, DEFAULT '' | Markdown/rich text content |
| section_type | VARCHAR(20) | NOT NULL, DEFAULT 'content' | content, scenario, quiz, summary |
| order_index | INTEGER | NOT NULL, DEFAULT 0 | Sort order within track |
| min_dwell_seconds | INTEGER | NOT NULL, DEFAULT 30 | Minimum reading time before advancing |
| estimated_minutes | INTEGER | NOT NULL, DEFAULT 5 | Estimated reading time |
| xp_value | INTEGER | NOT NULL, DEFAULT 0 | XP for completing this section |
| created_at | TIMESTAMP | DEFAULT NOW() | |

#### `section_quiz_questions`
Quiz questions per section (one question per section for inline quizzes, or multiple for assessments).

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, auto-generated | |
| section_id | UUID | FK → track_sections.id, ON DELETE CASCADE, NOT NULL | |
| question_text | TEXT | NOT NULL | The question |
| explanation | TEXT | | Shown after answering |
| time_limit_seconds | INTEGER | DEFAULT 60 | Per-question timer (null = no limit) |
| order_index | INTEGER | NOT NULL, DEFAULT 0 | Order within section |
| created_at | TIMESTAMP | DEFAULT NOW() | |

#### `section_quiz_options`
Answer options for quiz questions.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, auto-generated | |
| question_id | UUID | FK → section_quiz_questions.id, ON DELETE CASCADE, NOT NULL | |
| option_text | TEXT | NOT NULL | Answer option text |
| is_correct | BOOLEAN | NOT NULL, DEFAULT false | |
| order_index | INTEGER | NOT NULL, DEFAULT 0 | |

#### `section_scenarios`
Scenario-based assessment sections (written response, manager-graded).

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, auto-generated | |
| section_id | UUID | FK → track_sections.id, ON DELETE CASCADE, NOT NULL | |
| situation | TEXT | NOT NULL | The scenario description |
| question | TEXT | NOT NULL | What the learner must answer |
| ideal_response | TEXT | | Model answer (shown after grading) |
| rubric_criteria | JSONB | | Array of grading criteria |
| min_response_chars | INTEGER | DEFAULT 100 | Minimum written response length |
| created_at | TIMESTAMP | DEFAULT NOW() | |

#### `track_assignments`
Which user is assigned which track, with due dates.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, auto-generated | |
| track_id | UUID | FK → learning_tracks.id, NOT NULL | |
| user_id | UUID | FK → academy_users.id, NOT NULL | |
| assigned_by | UUID | FK → academy_users.id | Manager or admin who assigned |
| assigned_at | TIMESTAMP | DEFAULT NOW() | |
| due_date | TIMESTAMP | | Assignment deadline |
| assignment_reason | TEXT | | Why this track was assigned (scorecard justification) |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'not_started' | not_started, in_progress, completed |
| completed_at | TIMESTAMP | | |
| UNIQUE | | (track_id, user_id) | Prevent duplicate assignments |

#### `section_progress`
Per-user, per-section progress tracking.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, auto-generated | |
| assignment_id | UUID | FK → track_assignments.id, ON DELETE CASCADE, NOT NULL | |
| section_id | UUID | FK → track_sections.id, NOT NULL | |
| user_id | UUID | FK → academy_users.id, NOT NULL | |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'not_started' | not_started, in_progress, completed |
| dwell_seconds | INTEGER | NOT NULL, DEFAULT 0 | Accumulated reading time |
| quiz_passed | BOOLEAN | | null = not attempted |
| quiz_score | INTEGER | | Percentage score (0-100) |
| quiz_attempts | INTEGER | NOT NULL, DEFAULT 0 | |
| scenario_response | TEXT | | Written scenario response |
| scenario_graded | BOOLEAN | DEFAULT false | Whether manager has graded |
| scenario_score | INTEGER | | Manager-assigned score (0-100) |
| completed_at | TIMESTAMP | | |
| last_viewed_at | TIMESTAMP | | |

#### `section_acknowledgements`
Immutable digital sign-off records.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, auto-generated | |
| assignment_id | UUID | FK → track_assignments.id, NOT NULL | |
| section_id | UUID | FK → track_sections.id, NOT NULL | |
| user_id | UUID | FK → academy_users.id, NOT NULL | |
| typed_name | VARCHAR(200) | NOT NULL | Full name typed by the learner |
| acknowledged_at | TIMESTAMP | DEFAULT NOW() | |
| ip_address | VARCHAR(45) | | IPv4 or IPv6 |
| document_hash | VARCHAR(64) | | SHA-256 of section body at time of acknowledgement |
| UNIQUE | | (assignment_id, section_id) | One acknowledgement per section per assignment |

#### `certificates`
Issued on track completion. Publicly verifiable.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, auto-generated | |
| org_id | UUID | FK → organizations.id, NOT NULL | |
| user_id | UUID | FK → academy_users.id, NOT NULL | |
| track_id | UUID | FK → learning_tracks.id, NOT NULL | |
| assignment_id | UUID | FK → track_assignments.id, UNIQUE | |
| cert_code | VARCHAR(30) | NOT NULL, UNIQUE | Format: RAYO-CFC-2026-0001 |
| learner_name | VARCHAR(200) | NOT NULL | Full name at time of issuance |
| track_title | VARCHAR(255) | NOT NULL | Track name snapshot |
| issued_at | TIMESTAMP | DEFAULT NOW() | |
| verification_hash | VARCHAR(64) | NOT NULL, UNIQUE | SHA-256 for public verification |
| pdf_url | VARCHAR(500) | | S3 URL for the generated PDF |
| revoked | BOOLEAN | NOT NULL, DEFAULT false | |
| revoked_at | TIMESTAMP | | |
| revoked_reason | TEXT | | |

#### `xp_ledger`
Append-only XP transaction log.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, auto-generated | |
| user_id | UUID | FK → academy_users.id, NOT NULL | |
| org_id | UUID | FK → organizations.id, NOT NULL | |
| amount | INTEGER | NOT NULL | XP earned (positive) or deducted (negative) |
| reason | VARCHAR(100) | NOT NULL | section_complete, quiz_bonus, track_complete, scenario_champion |
| track_code | VARCHAR(20) | | Associated track code |
| section_id | UUID | | Associated section |
| created_at | TIMESTAMP | DEFAULT NOW() | |

#### `badges_earned`
Achievement badges.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, auto-generated | |
| user_id | UUID | FK → academy_users.id, NOT NULL | |
| org_id | UUID | FK → organizations.id, NOT NULL | |
| badge_code | VARCHAR(50) | NOT NULL | e.g., CFC-101-COMPLETE, EXCELLENCE-CFC-101, CERTIFIED-CFC |
| badge_type | VARCHAR(30) | NOT NULL | COMPLETION, EXCELLENCE, SCENARIO_CHAMPION, CERTIFIED |
| awarded_at | TIMESTAMP | DEFAULT NOW() | |
| awarded_by | UUID | FK → academy_users.id | null = auto-awarded, set = manager-awarded |
| UNIQUE | | (user_id, badge_code) | No duplicate badges |

#### `extension_requests`
Due date extension workflow.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, auto-generated | |
| assignment_id | UUID | FK → track_assignments.id, NOT NULL | |
| user_id | UUID | FK → academy_users.id, NOT NULL | |
| requested_by_id | UUID | FK → academy_users.id, NOT NULL | |
| reason | TEXT | NOT NULL | |
| new_due_date | TIMESTAMP | NOT NULL | |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'pending' | pending, endorsed, approved, rejected |
| endorsed_by_id | UUID | FK → academy_users.id | |
| endorsed_at | TIMESTAMP | | |
| endorser_comment | TEXT | | |
| resolved_by_id | UUID | FK → academy_users.id | |
| resolved_at | TIMESTAMP | | |
| resolver_comment | TEXT | | |
| created_at | TIMESTAMP | DEFAULT NOW() | |

#### `audit_events`
Immutable event stream for all training-related actions.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, auto-generated | |
| org_id | UUID | FK → organizations.id | |
| user_id | UUID | FK → academy_users.id | |
| event_type | VARCHAR(50) | NOT NULL | user_provisioned, track_assigned, section_viewed, quiz_answered, section_acknowledged, track_completed, certificate_issued, scenario_graded, badge_awarded, user_deactivated |
| target_id | VARCHAR(255) | | ID of the affected entity |
| metadata | JSONB | | Additional event data |
| created_at | TIMESTAMP | DEFAULT NOW() | |

---

## 5. Public API for Hire'in Integration

### Authentication

All integration endpoints are authenticated via **API key** passed in the `Authorization` header:

```
Authorization: Bearer ra_live_abc123def456...
```

The API key is generated per organization in Rayo Academy's admin panel and stored as a bcrypt hash. Hire'in stores the plaintext key as an environment secret (`RAYO_ACADEMY_API_KEY`).

**Rate limit:** 100 requests/minute per API key.

### Base URL

```
https://rayo.academy/api/v1
```

---

### `POST /api/v1/provision-user`

Create a new user account from Hire'in.

**Request:**
```json
{
  "email": "jane.doe@hirein.com",
  "firstName": "Jane",
  "lastName": "Doe",
  "role": "learner",
  "department": "Healthcare"
}
```

**Response (201 Created):**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "email": "jane.doe@hirein.com",
  "tempPassword": "TmpP@ss2026!xQ7",
  "mustResetPassword": true,
  "createdAt": "2026-04-10T14:30:00Z"
}
```

**Error Responses:**
| Status | Body | Condition |
|---|---|---|
| 400 | `{ "error": "email, firstName, and lastName are required" }` | Missing required fields |
| 409 | `{ "error": "User already exists", "userId": "..." }` | Email already provisioned |
| 401 | `{ "error": "Invalid API key" }` | Missing or invalid API key |

---

### `POST /api/v1/assign-track`

Manager assigns a learning track to a user.

**Request:**
```json
{
  "email": "jane.doe@hirein.com",
  "trackId": "550e8400-e29b-41d4-a716-446655440001",
  "dueDate": "2026-05-15T00:00:00Z",
  "reason": "Q1 scorecard: weak submission quality — CFC-106 addresses this directly"
}
```

**Response (201 Created):**
```json
{
  "assignmentId": "550e8400-e29b-41d4-a716-446655440002",
  "email": "jane.doe@hirein.com",
  "trackId": "550e8400-e29b-41d4-a716-446655440001",
  "trackTitle": "Common Foundation Certification (CFC)",
  "dueDate": "2026-05-15T00:00:00Z",
  "status": "not_started",
  "assignedAt": "2026-04-10T14:35:00Z"
}
```

**Error Responses:**
| Status | Body | Condition |
|---|---|---|
| 400 | `{ "error": "email and trackId are required" }` | Missing required fields |
| 404 | `{ "error": "User not found" }` | Email not provisioned |
| 404 | `{ "error": "Track not found" }` | Invalid trackId |
| 409 | `{ "error": "Track already assigned", "assignmentId": "..." }` | Duplicate assignment |

---

### `GET /api/v1/users/:email/progress`

Get all track assignments and progress for a user.

**Response (200 OK):**
```json
{
  "email": "jane.doe@hirein.com",
  "assignments": [
    {
      "assignmentId": "550e8400-e29b-41d4-a716-446655440002",
      "trackId": "550e8400-e29b-41d4-a716-446655440001",
      "trackCode": "CFC",
      "trackTitle": "Common Foundation Certification",
      "status": "in_progress",
      "dueDate": "2026-05-15T00:00:00Z",
      "assignedAt": "2026-04-10T14:35:00Z",
      "totalSections": 6,
      "completedSections": 3,
      "progressPercent": 50,
      "totalXpEarned": 300,
      "isOverdue": false
    }
  ],
  "totalXp": 300,
  "monthlyXp": 300
}
```

**Error Responses:**
| Status | Body | Condition |
|---|---|---|
| 404 | `{ "error": "User not found" }` | Email not provisioned |

---

### `GET /api/v1/users/:email/completions`

Get completed tracks with certificate IDs.

**Response (200 OK):**
```json
{
  "email": "jane.doe@hirein.com",
  "completions": [
    {
      "trackCode": "CFC",
      "trackTitle": "Common Foundation Certification",
      "completedAt": "2026-04-28T09:15:00Z",
      "certificateId": "RAYO-CFC-2026-0001",
      "certificateUrl": "https://rayo.academy/verify/RAYO-CFC-2026-0001",
      "totalXpEarned": 1100
    }
  ]
}
```

---

### `GET /api/v1/users/:email/certificates`

Get certificate details and download URLs.

**Response (200 OK):**
```json
{
  "email": "jane.doe@hirein.com",
  "certificates": [
    {
      "certCode": "RAYO-CFC-2026-0001",
      "trackCode": "CFC",
      "trackTitle": "Common Foundation Certification",
      "learnerName": "Jane Doe",
      "issuedAt": "2026-04-28T09:15:00Z",
      "verificationUrl": "https://rayo.academy/verify/RAYO-CFC-2026-0001",
      "downloadUrl": "https://rayo.academy/api/v1/certificates/RAYO-CFC-2026-0001/download",
      "revoked": false
    }
  ]
}
```

---

### `GET /api/v1/tracks`

List available tracks (for manager selection UI in Hire'in).

**Response (200 OK):**
```json
{
  "tracks": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "code": "CFC",
      "title": "Common Foundation Certification",
      "description": "Essential foundation for all TA professionals...",
      "sectionCount": 6,
      "estimatedHours": 15,
      "totalXp": 1100,
      "prerequisiteTrackCode": null,
      "status": "published"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440003",
      "code": "CHTP",
      "title": "Certified Healthcare TA Performance",
      "description": "Healthcare specialist certification track...",
      "sectionCount": 5,
      "estimatedHours": 16,
      "totalXp": 1250,
      "prerequisiteTrackCode": "CFC",
      "status": "published"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440004",
      "code": "CITP",
      "title": "Certified IT TA Performance",
      "description": "IT specialist certification track...",
      "sectionCount": 5,
      "estimatedHours": 16,
      "totalXp": 1250,
      "prerequisiteTrackCode": "CFC",
      "status": "published"
    }
  ]
}
```

---

### `GET /api/v1/tracks/:id`

Track details with section count and estimated duration.

**Response (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "code": "CFC",
  "title": "Common Foundation Certification",
  "description": "Essential foundation covering TA Expert identity, candidate care, communication, lifecycle, quality standards, and documentation.",
  "accentColor": "#1F4E79",
  "sectionCount": 6,
  "estimatedHours": 15,
  "totalXp": 1100,
  "prerequisiteTrackCode": null,
  "sections": [
    {
      "title": "Company Identity, Culture & TA Expert Mindset",
      "estimatedMinutes": 180,
      "sectionType": "content",
      "hasQuiz": true,
      "hasScenario": true
    },
    {
      "title": "Candidate Care Standard & Relationship Philosophy",
      "estimatedMinutes": 120,
      "sectionType": "content",
      "hasQuiz": true,
      "hasScenario": true
    }
  ]
}
```

---

### `POST /api/v1/users/:email/deactivate`

Disable a user account when an employee leaves. This preserves all historical data but prevents login.

**Request:**
```json
{
  "reason": "Employee resigned effective 2026-04-30"
}
```

**Response (200 OK):**
```json
{
  "email": "jane.doe@hirein.com",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "isActive": false,
  "deactivatedAt": "2026-04-10T16:00:00Z"
}
```

**Error Responses:**
| Status | Body | Condition |
|---|---|---|
| 404 | `{ "error": "User not found" }` | Email not provisioned |
| 409 | `{ "error": "User already deactivated" }` | Already inactive |

---

### Webhook Notifications (Optional — Phase 3+)

In addition to polling, Rayo Academy can push events to Hire'in:

| Event | Payload |
|---|---|
| `track.completed` | `{ email, trackCode, certCode, completedAt }` |
| `certificate.issued` | `{ email, certCode, verificationUrl, downloadUrl }` |
| `assignment.overdue` | `{ email, trackCode, assignmentId, dueDate }` |

Webhooks are registered via `POST /api/v1/webhooks` with a target URL and shared secret for HMAC signature verification.

---

## 6. Certificate Engine Requirements

### Auto-Generation Trigger

A certificate is automatically generated when:
1. All sections in the assigned track have `status = completed`
2. All section quizzes have `quiz_passed = true`
3. All section acknowledgements are signed
4. The track's final assessment (if applicable) has a score ≥ 80%

### Certificate Content

Each certificate includes:

| Element | Description |
|---|---|
| Rayo Academy logo | Top center, full-color wordmark |
| Rayomind Solutions attribution | "Powered by Rayomind Solutions" — smaller, bottom area |
| Learner full name | Large, prominent, serif font (Playfair Display) |
| Certification title | e.g., "Common Foundation Certification" |
| Track code badge | Color-coded badge (CFC = Navy, CHTP = Teal, CITP = Purple) |
| Certificate code | Format: `RAYO-{TRACK}-{YEAR}-{SEQUENCE}` (e.g., RAYO-CFC-2026-0001) |
| Issue date | Full date format (e.g., April 28, 2026) |
| QR code | Encodes verification URL |
| Verification URL | `rayo.academy/verify/RAYO-CFC-2026-0001` |
| Digital signature line | "Verified by Rayo Academy" |

### Sample Certificate Layout

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│                     [RAYO ACADEMY LOGO]                          │
│                                                                  │
│              ─────────────────────────────────                   │
│                                                                  │
│                   CERTIFICATE OF COMPLETION                      │
│                                                                  │
│                   This certifies that                            │
│                                                                  │
│                      Jane Doe                                    │
│                   (Playfair Display, 36pt)                       │
│                                                                  │
│               has successfully completed the                     │
│                                                                  │
│            Common Foundation Certification                       │
│                       (CFC)                                      │
│                                                                  │
│               Certificate ID: RAYO-CFC-2026-0001                │
│               Issued: April 28, 2026                             │
│                                                                  │
│        [QR CODE]     Verified by Rayo Academy                    │
│                      rayo.academy/verify/RAYO-CFC-2026-0001     │
│                                                                  │
│              ─────────────────────────────────                   │
│                   Powered by Rayomind Solutions                   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### PDF Specifications

| Property | Value |
|---|---|
| Page size | A4 Landscape (297mm × 210mm) |
| Resolution | 300 DPI (print quality) |
| Format | PDF/A (for archival) |
| File naming | `RAYO-CFC-2026-0001.pdf` |
| Storage | S3-compatible bucket, private access with signed URLs for download |
| Retention | Indefinite — certificates are never deleted |

### Public Verification Page

**URL:** `https://rayo.academy/verify/:certCode`

This is a **public page** — no login required. Designed for LinkedIn profiles, resumes, and employer verification.

**Valid certificate display:**
- Green checkmark icon
- "This certificate is valid"
- Learner name
- Certification title
- Issue date
- Issuing organization (from organizations table)

**Invalid/not found display:**
- Red X icon
- "Certificate not found or has been revoked"
- No additional details

**Revoked certificate display:**
- Orange warning icon
- "This certificate has been revoked"
- Revocation date (no reason shown publicly)

### Tracks Issuing Certificates

| Track Code | Certificate Title | Color |
|---|---|---|
| CFC | Common Foundation Certification | Navy (#1F4E79) |
| CHTP | Certified Healthcare TA Performance | Teal (#117A65) |
| CITP | Certified IT TA Performance | Purple (#6C3483) |

Each tier within CHTP and CITP also issues a certificate (e.g., "CHTP Tier 1 — Healthcare TA Foundations").

---

## 7. Manager Capabilities

### Track Assignment

Managers can assign tracks to their direct reports through:
1. **Rayo Academy UI** — Manager panel → Assign Training tab
2. **Hire'in integration** — Hire'in calls `POST /api/v1/assign-track`

Assignment includes:
- Track selection (from published tracks)
- Due date (defaults to 15 days from assignment)
- Assignment reason (free text — scorecard justification)
- Prerequisite validation — system blocks assignment if prerequisite track is not completed

### Progress Monitoring

**Team Progress Matrix:**
- Rows: team members
- Columns: track sections
- Color-coded cells: locked (gray) / not started (white) / in progress (amber) / completed (green)
- Click cell → section detail: dwell time, quiz score, scenario submission status
- CSV export for reporting

**Individual Learner Detail:**
- All assignments with status
- Section-by-section progress
- Quiz scores and attempts
- Dwell time vs. minimum required
- Acknowledgement status
- XP earned
- Overdue/due-soon alerts

### Scenario Review Queue

- List of all scenario submissions pending manager grading
- Review modal: learner's response + rubric criteria checklist
- Score (0–100) + optional feedback
- "Award Scenario Champion Badge" checkbox → triggers +200 XP + SCENARIO_CHAMPION badge
- Graded submissions update the learner's section progress in real time

### Due Date Management

- Managers can view overdue assignments
- Extension requests flow through an approval workflow (request → endorse → approve/reject)
- Managers cannot extend their own assignments — requires org_admin approval

---

## 8. Learner Experience

### Track Player

The track player is the core learning interface. Focused, distraction-free layout.

**Navigation:**
- Left sidebar: section list with completion checkmarks
- Main content area: section body (rendered markdown)
- Bottom bar: Previous / Next section buttons
- Top bar: track title, progress bar, XP counter

### Section Types

| Type | Behavior |
|---|---|
| **CONTENT** | Markdown rendered with rich typography, callout boxes (tip/warning/important), tables. Dwell timer runs in the background. |
| **SCENARIO** | Situation description + question + textarea for written response. Minimum 100 characters. Submitted for manager review. Rubric shown after submission. |
| **QUIZ** | Multiple-choice questions (4 options). Timed (60 seconds per question by default). Immediate feedback with explanation. Score and XP displayed at the end. |
| **SUMMARY** | Key takeaways list. "Complete Section → +XP" CTA button. |

### Dwell Timer

- Each section has a `min_dwell_seconds` value
- Timer starts when the section is opened
- Timer pauses when the tab is not visible (Page Visibility API)
- Section cannot be marked complete until `dwell_seconds >= min_dwell_seconds`
- Timer updates are sent to the backend every 10 seconds via `POST /api/onboarding/progress/:assignmentId/:sectionId/dwell`
- Displayed as a soft indicator: "Suggested reading: ~5 min" — not a countdown timer

### Quiz Flow

1. Section displays quiz question with 4 options
2. Learner selects an answer and submits
3. Immediate feedback: correct/incorrect + explanation
4. Quiz can be retried (attempts tracked)
5. Section marked complete when `quiz_passed = true`
6. XP bonus for score ≥ 90%

### Acknowledgement Sign-Off

After completing a section's content and quiz:
1. Learner sees acknowledgement prompt
2. Must type their full legal name
3. System captures: typed name, timestamp, IP address, SHA-256 hash of section content
4. Acknowledgement is immutable — cannot be edited or deleted
5. Section is marked as fully complete

### XP System

| Action | XP Awarded |
|---|---|
| Complete any module/section | +100 XP |
| Quiz score 80–89% | +0 bonus |
| Quiz score 90–100% | +50 XP bonus |
| Scenario Champion (manager-awarded) | +200 XP |
| Complete full track (all sections) | +500 XP |
| Pass final assessment (80–89%) | +150 XP |
| Pass final assessment (90%+) | +250 XP |

XP is tracked in the `xp_ledger` as an append-only transaction log. Each user has:
- `total_xp` — all-time cumulative (never resets)
- `monthly_xp` — resets on the 1st of each month (drives leaderboard)

### Badge System

| Badge Type | Trigger | Auto/Manual |
|---|---|---|
| COMPLETION | Module/section completed | Auto |
| EXCELLENCE | Quiz score ≥ 90% | Auto |
| SCENARIO_CHAMPION | Manager awards after grading scenario response | Manual (manager) |
| CERTIFIED | All sections in a track completed + assessment passed | Auto |

Badge display: earned = full color + shine effect, locked = grayscale + lock icon + tooltip with unlock condition.

### Certificate Download

After completing a track:
1. System auto-generates certificate (PDF)
2. Learner sees congratulations screen with certificate preview
3. Download button for PDF
4. Share button with verification URL (for LinkedIn)
5. Certificate appears in the learner's certificates page permanently

---

## 9. Content Structure & Migration Mapping

### Existing Hire'in Content → Rayo Academy Tracks

The existing training content in Hire'in's `onboardingSeed.ts` maps to Rayo Academy tracks as follows:

### CFC Track — Common Foundation Certification

**Source:** `COMMON_ONBOARDING` seed in `onboardingSeed.ts` + CFC module definitions from Curriculum Framework

| Rayo Academy Section | Source Content | Est. Time | Quiz Questions |
|---|---|---|---|
| **CFC-101: Company Identity, Culture & TA Expert Mindset** | | 3 hours | 5 |
| CFC-101-S1: Welcome to Hire'in Solutions | `onboardingSeed.ts` → "Welcome to Hire'in Solutions" section | 5 min | 1 |
| CFC-101-S2: Core Work Principles | `onboardingSeed.ts` → "Core Work Principles" section | 5 min | 1 |
| CFC-101-S3: TA Expert Identity (new content) | Curriculum Framework → CFC-101 learning objectives | 45 min | 1 |
| CFC-101-S4: Scenario — The TA Expert Mindset Test | Curriculum Framework → CFC-101 scenario | 30 min | Scenario |
| CFC-101-S5: Module Quiz | Aggregate quiz from learning objectives | 15 min | 5 |
| **CFC-102: Candidate Care Standard & Relationship Philosophy** | | 2 hours | 5 |
| CFC-102-S1: Candidate Relationship Lifecycle | Curriculum Framework → CFC-102 learning objectives | 30 min | 1 |
| CFC-102-S2: Closure Messaging & Controlled Persistence | Curriculum Framework → CFC-102 learning objectives | 20 min | 1 |
| CFC-102-S3: Scenario — The Communication Test | Curriculum Framework → CFC-102 scenario | 30 min | Scenario |
| CFC-102-S4: Module Quiz | Aggregate quiz | 15 min | 5 |
| **CFC-103: Companywide Policies & Communication Standards** | | 2 hours | 5 |
| CFC-103-S1: Microsoft Teams — Official Communication Platform | `onboardingSeed.ts` → "Official Communication Platform" section | 5 min | 1 |
| CFC-103-S2: Documentation Discipline | `onboardingSeed.ts` → "Documentation Discipline" section | 5 min | 1 |
| CFC-103-S3: Confidentiality and Professional Conduct | `onboardingSeed.ts` → "Confidentiality and Professional Conduct" section | 5 min | 1 |
| CFC-103-S4: Scenario — The Escalation Test | Curriculum Framework → CFC-103 scenario | 30 min | Scenario |
| CFC-103-S5: Module Quiz | Aggregate quiz | 15 min | 5 |
| **CFC-104: Recruitment Lifecycle & Definition of Done** | | 3 hours | 6 |
| CFC-104-S1: The 6-Stage Recruitment Lifecycle | Curriculum Framework → CFC-104 learning objectives | 30 min | 1 |
| CFC-104-S2: Definition of Done — Intake through Screening | `onboardingSeed.ts` → Healthcare SOP Steps 1-3 + IT SOP Steps 1-3 (generalized) | 30 min | 2 |
| CFC-104-S3: Definition of Done — Submission through Close | `onboardingSeed.ts` → Healthcare SOP Steps 4-5 + IT SOP Steps 4-5 (generalized) | 30 min | 2 |
| CFC-104-S4: Module Quiz | One question per lifecycle stage | 20 min | 6 |
| **CFC-105: Communication Excellence** | | 3 hours | 5 |
| CFC-105-S1: First-Time Call Structure | Curriculum Framework → CFC-105 learning objectives | 30 min | 1 |
| CFC-105-S2: Voicemail, SMS, and Email Standards | Curriculum Framework → CFC-105 learning objectives | 30 min | 1 |
| CFC-105-S3: Objection Handling Matrix | Curriculum Framework → CFC-105 objection matrix | 30 min | 1 |
| CFC-105-S4: Scenario — Candidate says "I'm not actively looking" | Curriculum Framework → CFC-105 scenario | 30 min | Scenario |
| CFC-105-S5: Module Quiz | Quiz on scripts, cadence, objection handling | 15 min | 5 |
| **CFC-106: Quality Standards, Documentation & Systems** | | 2 hours | 5 |
| CFC-106-S1: 8 Required Submission Elements | Curriculum Framework → CFC-106 learning objectives | 20 min | 1 |
| CFC-106-S2: Resume Red Flag Identification | Curriculum Framework → CFC-106 Red Flag Spotter | 30 min | 1 |
| CFC-106-S3: ATS Documentation Standards | Curriculum Framework → CFC-106 learning objectives | 20 min | 1 |
| CFC-106-S4: Module Quiz | Quiz on submission quality, red flags, ATS hygiene | 15 min | 5 |

**CFC Final Assessment:** 25 questions spanning all 6 modules, 80% pass threshold, +500 XP + CFC Certified badge + certificate.

### CHTP Track — Certified Healthcare TA Performance (Tier 1)

**Source:** `HEALTHCARE_SOP` seed in `onboardingSeed.ts` + CHTP module definitions from Curriculum Framework

| Rayo Academy Section | Source Content | Est. Time |
|---|---|---|
| **CHTP-101: Healthcare Industry Fundamentals** | | 4 hours |
| CHTP-101-S1: Healthcare Role Families | Curriculum Framework → RN specialties, LPN, CNA, Allied Health, etc. | 60 min |
| CHTP-101-S2: Assignment Types | Travel 13-week, local contract, per diem, permanent | 30 min |
| CHTP-101-S3: Care Settings and Shift Models | New content from Curriculum Framework | 30 min |
| CHTP-101-S4: Scenario — The Specialty Mismatch | Curriculum Framework → CHTP-101 scenario | 30 min |
| CHTP-101-S5: Module Quiz | 5 questions on healthcare fundamentals | 15 min |
| **CHTP-102: Healthcare Compliance, Licensure & Credentialing** | | 4 hours |
| CHTP-102-S1: License Verification & State Boards | Curriculum Framework → CHTP-102 learning objectives | 45 min |
| CHTP-102-S2: Compact vs. Single-State Licensure | Curriculum Framework → CHTP-102 learning objectives | 30 min |
| CHTP-102-S3: Required Certifications (BLS, ACLS, PALS, etc.) | `onboardingSeed.ts` → Healthcare screening compliance section | 30 min |
| CHTP-102-S4: Pre-Employment Requirements | Background, drug screen, immunizations, TB, physical | 30 min |
| CHTP-102-S5: Scenario — The Expired Certification | Curriculum Framework → CHTP-102 scenario | 30 min |
| CHTP-102-S6: Module Quiz | 5 questions on compliance | 15 min |
| **CHTP-103: Healthcare Recruitment SOP & Definition of Done** | | 3 hours |
| CHTP-103-S1: Healthcare-Specific 6-Stage SOP | `onboardingSeed.ts` → Healthcare SOP all 5 steps | 60 min |
| CHTP-103-S2: Healthcare Definition of Done per Stage | `onboardingSeed.ts` → "Definition of Done" sections from each step | 30 min |
| CHTP-103-S3: Healthcare Red Flags | Curriculum Framework → CHTP-103 learning objectives | 20 min |
| CHTP-103-S4: Scenario — The Incomplete Submission | Curriculum Framework → CHTP-103 scenario | 30 min |
| CHTP-103-S5: Module Quiz | 5 questions on healthcare SOP | 15 min |
| **CHTP-104: Healthcare Communication, Outreach & Screening** | | 3 hours |
| CHTP-104-S1: Healthcare-Specific Call Scripts | Curriculum Framework → CHTP-104 learning objectives | 30 min |
| CHTP-104-S2: Structured Healthcare Screening Checklist | `onboardingSeed.ts` → Healthcare Step 3 screening checklist | 30 min |
| CHTP-104-S3: Healthcare Objection Handling | Shift, float, location, pay packages | 30 min |
| CHTP-104-S4: Live Drill — Travel ICU RN Role | Curriculum Framework → CHTP-104 drill | 30 min |
| CHTP-104-S5: Module Quiz | 5 questions on healthcare communication | 15 min |
| **CHTP-105: Healthcare Submission Quality & Documentation** | | 2 hours |
| CHTP-105-S1: Complete Healthcare Submission Package | `onboardingSeed.ts` → Healthcare Step 4 submission requirements | 30 min |
| CHTP-105-S2: Recruiter Summary Writing for Healthcare | Curriculum Framework → CHTP-105 learning objectives | 30 min |
| CHTP-105-S3: Submission Showdown Exercise | Curriculum Framework → CHTP-105 submission showdown | 30 min |
| CHTP-105-S4: Module Quiz | 5 questions on submission quality | 15 min |

### CITP Track — Certified IT TA Performance (Tier 1)

**Source:** `IT_SOP` seed in `onboardingSeed.ts` + CITP module definitions from Curriculum Framework

| Rayo Academy Section | Source Content | Est. Time |
|---|---|---|
| **CITP-101: IT Industry Fundamentals & Role Families** | | 4 hours |
| CITP-101-S1: IT Role Families | Curriculum Framework → SWE, QA, Data, DevOps, Cloud, Security, etc. | 60 min |
| CITP-101-S2: Engagement Types (W2, C2C, CTH) | Curriculum Framework → CITP-101 learning objectives | 30 min |
| CITP-101-S3: Work Authorization Categories | US Citizen, Green Card, H-1B, OPT, CPT, EAD, L1 | 30 min |
| CITP-101-S4: Scenario — The Role Family Confusion | Curriculum Framework → CITP-101 scenario | 30 min |
| CITP-101-S5: Module Quiz | 5 questions on IT fundamentals | 15 min |
| **CITP-102: Technology Stack Awareness & Technical Fluency** | | 4 hours |
| CITP-102-S1: Common Tech Groupings | Frontend, backend, database, cloud, DevOps, data, QA | 45 min |
| CITP-102-S2: Similar-Sounding Technologies | Java vs JavaScript, SQL vs NoSQL, React vs Angular | 30 min |
| CITP-102-S3: Resume Red Flag Identification for IT | Curriculum Framework → CITP-102 Red Flag Spotter | 30 min |
| CITP-102-S4: Technical Validation Without Coding | Basic questions to validate hands-on depth | 30 min |
| CITP-102-S5: Module Quiz | 5 questions on tech awareness | 15 min |
| **CITP-103: IT Recruitment SOP, Authorization & Definition of Done** | | 3 hours |
| CITP-103-S1: IT-Specific 6-Stage SOP | `onboardingSeed.ts` → IT SOP all 5 steps | 60 min |
| CITP-103-S2: Must-Have vs. Nice-to-Have Separation | Curriculum Framework → CITP-103 learning objectives | 20 min |
| CITP-103-S3: Work Authorization Verification | `onboardingSeed.ts` → IT screening work authorization section | 20 min |
| CITP-103-S4: IT Definition of Done per Stage | `onboardingSeed.ts` → "Definition of Done" sections from each IT step | 30 min |
| CITP-103-S5: Module Quiz | 5 questions on IT SOP | 15 min |
| **CITP-104: IT Communication, Outreach & Technical Screening** | | 3 hours |
| CITP-104-S1: IT-Specific Call Scripts | Curriculum Framework → CITP-104 learning objectives | 30 min |
| CITP-104-S2: Presenting Roles with Stack Relevance | Curriculum Framework → CITP-104 learning objectives | 20 min |
| CITP-104-S3: IT Screening — Validating Hands-On Depth | `onboardingSeed.ts` → IT Step 3 screening checklist | 30 min |
| CITP-104-S4: Live Drill — Senior QA Automation Engineer | Curriculum Framework → CITP-104 drill | 30 min |
| CITP-104-S5: Module Quiz | 5 questions on IT communication | 15 min |
| **CITP-105: IT Submission Quality & Recruiter Summary Writing** | | 2 hours |
| CITP-105-S1: Complete IT Submission Package | `onboardingSeed.ts` → IT Step 4 submission requirements | 30 min |
| CITP-105-S2: Recruiter Summary Writing for IT | Curriculum Framework → CITP-105 learning objectives | 30 min |
| CITP-105-S3: Submission Showdown Exercise | Curriculum Framework → CITP-105 submission showdown | 30 min |
| CITP-105-S4: Module Quiz | 5 questions on submission quality | 15 min |

### CHTP & CITP Tiers 2–4 (Content Authoring Required)

These tiers are defined in the Curriculum Framework but require original content authoring. Structure is ready for implementation.

**CHTP Tiers 2–4:**
| Module | Title |
|---|---|
| CHTP-201 | Advanced Healthcare Credentialing and Compliance |
| CHTP-202 | Healthcare Consultative Intake and Client Advisory |
| CHTP-203 | Healthcare Negotiation: Pay Packages and Close |
| CHTP-204 | Healthcare Post-Placement Care and Redeployment |
| CHTP-301 | Healthcare Market Dynamics and Specialty Depth |
| CHTP-302 | Complex Healthcare Close Scenarios |
| CHTP-303 | Healthcare Client Partnership and Account Growth |
| CHTP-304 | Healthcare Mentoring and Knowledge Transfer |
| CHTP-401 | Healthcare Team Leadership and Performance Coaching |
| CHTP-402 | Strategic Healthcare Account Management |
| CHTP-403 | Healthcare Training Design and Delivery |
| CHTP-404 | Healthcare Business Development Fundamentals |

**CITP Tiers 2–4:**
| Module | Title |
|---|---|
| CITP-201 | Advanced IT Stack Assessment and Market Intelligence |
| CITP-202 | IT Consultative Intake and Client Advisory |
| CITP-203 | IT Negotiation: Rates, Counteroffers, and Close |
| CITP-204 | IT Post-Placement Care and Redeployment |
| CITP-301 | Emerging Technology Trends and Architecture Awareness |
| CITP-302 | Complex IT Close Scenarios and Competing Offers |
| CITP-303 | IT Client Partnership and Account Expansion |
| CITP-304 | IT Mentoring and Knowledge Transfer |
| CITP-401 | IT Team Leadership and Performance Coaching |
| CITP-402 | Strategic IT Account Management |
| CITP-403 | IT Training Design and Delivery |
| CITP-404 | IT Business Development Fundamentals |

### Prerequisite Chain

```
CFC-101 (entry point)
    ↓
CFC-102 + CFC-103 (parallel, both require CFC-101)
    ↓
CFC-104 (requires both CFC-102 and CFC-103)
    ↓
CFC-105 + CFC-106 (parallel, both require CFC-104)
    ↓
CFC Final Assessment → CFC Certified

CFC Certified → CHTP Tier 1 → Tier 2 (3 months + performance) → Tier 3 → Tier 4
CFC Certified → CITP Tier 1 → Tier 2 (3 months + performance) → Tier 3 → Tier 4
```

### Scorecard-to-Module Mapping (for Manager Assignments)

This mapping connects Hire'in scorecard metrics to Rayo Academy training recommendations:

| Weak Metric | Root Cause | Assign Module |
|---|---|---|
| Low submission quality | Weak screening or poor summaries | CFC-106 or CHTP/CITP-105 |
| Low submittal-to-interview ratio | Poor requirement understanding | CFC-104 or CHTP/CITP-103 |
| Low interview-to-offer ratio | Weak candidate prep | CFC-105 or CHTP/CITP-104 |
| Low offer-to-start ratio | Weak negotiation | CHTP/CITP-203 or CFC-105 |
| Low post-placement touchpoints | No follow-through | CHTP/CITP-204 |
| Low documentation completeness | Discipline gap | CFC-103 or CFC-106 |
| Low candidate experience score | Communication gaps | CFC-102 or CFC-105 |
| Healthcare credential issues | Compliance knowledge gap | CHTP-202 |
| IT authorization rejections | Work auth process gap | CITP-203 |

---

## 10. Phased Build Roadmap

### Phase 1 — Foundation (Weeks 1–3)

**Goal:** Functioning Rayo Academy with user provisioning and basic admin.

| Task | Description |
|---|---|
| Project setup | React + Express + PostgreSQL + Drizzle ORM, Tailwind + shadcn/ui |
| Database schema | All tables from Section 4 with multi-tenant org_id |
| Organizations | Seed Rayomind Solutions as the first org |
| User model | academy_users table with email + bcrypt password |
| Provisioning API | `POST /api/v1/provision-user` endpoint |
| Auth system | Login page, session management, forced password reset flow |
| Admin panel | CRUD for tracks, sections, quiz questions |
| Role-based access | learner, manager, org_admin, rayo_super_admin permissions |

**Deliverable:** Admin can create tracks and sections. Hire'in can provision users via API. Users can log in and reset their passwords.

### Phase 2 — Track Player (Weeks 4–6)

**Goal:** Learners can consume content and be assessed.

| Task | Description |
|---|---|
| Track player UI | Section reader with markdown rendering, callout boxes |
| Dwell timer | Background timer with Page Visibility API, backend sync |
| Quiz engine | Multiple-choice with timed questions, immediate feedback, retry |
| Scenario sections | Written response submission, rubric display |
| Acknowledgement sign-offs | Typed name, IP capture, content hash |
| Progress tracking | Per-section progress, assignment status updates |
| XP system | XP ledger, earning events, user XP counters |
| Academy dashboard | Welcome banner, XP bar, action cards, recent badges |

**Deliverable:** Learners can work through assigned tracks section by section with quizzes, dwell timers, and acknowledgements. XP is awarded.

### Phase 3 — Certificates & Public API (Weeks 7–9)

**Goal:** Certificates generated automatically. Full integration API for Hire'in.

| Task | Description |
|---|---|
| Certificate generation | HTML → PDF via Puppeteer, branded template |
| Certificate storage | S3 upload, signed download URLs |
| Public verification page | `rayo.academy/verify/:code` — public, no login |
| Integration API | All endpoints from Section 5 (assign-track, progress, completions, certificates, deactivate) |
| API key management | Per-org API key generation, hash storage, auth middleware |
| Manager assignment flow | Assign tracks via Rayo Academy UI + API |
| Manager progress view | Team progress matrix, individual learner detail |
| Scenario review queue | Pending submissions, grading modal, badge award |

**Deliverable:** Certificates auto-generate on track completion. Hire'in can assign tracks and query progress via API. Managers can view progress and grade scenarios.

### Phase 4 — Content Migration (Weeks 10–11)

**Goal:** All existing curriculum content is live in Rayo Academy.

| Task | Description |
|---|---|
| CFC content migration | All 6 CFC modules with full section content from onboardingSeed.ts + Curriculum Framework |
| CHTP Tier 1 migration | 5 modules from Healthcare SOP seed + Curriculum Framework |
| CITP Tier 1 migration | 5 modules from IT SOP seed + Curriculum Framework |
| Quiz content | All quiz questions and options from seed data |
| Scenario content | All scenario challenges from Curriculum Framework |
| Content parity verification | Verify all seed content is present and correct in Rayo Academy |
| CFC Final Assessment | 25-question assessment, 80% pass threshold |

**Deliverable:** All three tracks (CFC, CHTP Tier 1, CITP Tier 1) fully populated with content, quizzes, and scenarios. Content parity with existing Hire'in training verified.

### Phase 5 — Polish (Weeks 12–14)

**Goal:** Gamification, analytics, and user experience refinements.

| Task | Description |
|---|---|
| Badge system | Auto-award badges (completion, excellence, certified), manager-award (scenario champion) |
| Badge page | Grid display with earned/locked states |
| Leaderboard | Monthly XP ranking, team filter, Hall of Fame |
| Learner dashboard | Enhanced dashboard with badges shelf, quick stats, motivational counters |
| Manager analytics | Team performance summary, completion rates, overdue alerts |
| Extension request workflow | Request → endorse → approve/reject flow |
| Email notifications | SendGrid integration for assignments, due date reminders, certificate issuance |
| Public landing page | Marketing homepage for future B2B SaaS |

**Deliverable:** Full gamification system live. Manager analytics operational. Extension workflow functional. Platform ready for internal rollout.

### Future Phases

| Phase | Scope | Timeline |
|---|---|---|
| Phase 6 | CHTP/CITP Tiers 2–4 content authoring | TBD |
| Phase 7 | OAuth2/OIDC SSO with Hire'in | TBD |
| Phase 8 | Multi-tenant B2B SaaS (billing, white-label, org admin panel) | TBD |
| Phase 9 | Mobile app (React Native or PWA) | TBD |
| Phase 10 | Content authoring tool for org_admins | TBD |

---

*Document prepared by Rayomind Solutions — Architecture & Product*
*For Rayo Academy development team use*
*Version 1.0 — April 2026*
