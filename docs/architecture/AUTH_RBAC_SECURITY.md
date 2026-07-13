Status: Current-state automated system reference
Generated from: code, schema, routes, configuration, and existing documents
Date: 2026-07-13
Human approval required: Yes — for all UNABLE_TO_CONFIRM items listed within
Unresolved items: 3 — see OWNER_REVIEW_REQUIRED sections within

---

# Authentication, RBAC & Security Reference

## Product View — Role Capability Matrix

### Core Roles

The system defines nine core roles via the `user_role` PostgreSQL enum. `CONFIRMED_IN_SCHEMA`

| Feature Area | super_admin | admin | executive | hr | finance | manager | operations | recruiter | employee |
|---|---|---|---|---|---|---|---|---|---|
| User management (create/patch/delete) | Full | Create/patch | No access | Create/patch | No access | Create/patch | No access | No access | No access |
| Super Admin soft-delete | Full | No access | No access | No access | No access | No access | No access | No access | No access |
| TOTP admin reset | Full | Own team only | No access | No access | No access | No access | No access | No access | No access |
| TOTP disable (self) | Full | No access | No access | No access | No access | No access | No access | No access | No access |
| Audit logs view | Full | Full | Read only | No access | No access | No access | No access | No access | No access |
| Department management | Full | Full | No access | Create/patch | No access | No access | No access | No access | No access |
| Job postings (CRUD) | Full | Full | No access | No access | No access | Full | Full | Full | No access |
| Ceipal sync | Full | Full | No access | No access | No access | Full | Full | Full | No access |
| Applications management | Full | Full | No access | Full | No access | Full | Full | Full | No access |
| Contacts management | Full | Full | No access | Full | No access | Full | Full | Full | No access |
| Leave management (admin) | Full | Full | No access | Full | No access | Own team | No access | No access | Own records |
| Leave approval | Full | Full | No access | Full | No access | Own team | No access | No access | No access |
| Attendance correction | Full | Full | No access | Full | No access | Own team | No access | No access | No access |
| Salary slips (admin generate) | Full | Full | No access | Full | Full | No access | No access | No access | No access |
| Salary reports | Full | Full | Read only | Full | Read only | No access | No access | No access | No access |
| Payroll run (generate/execute) | Full | Full | Full | Full | No access | No access | No access | No access | No access |
| Payroll run (approve/disburse) | Full | Full | Full | No access | No access | No access | No access | No access | No access |
| Salary structures | Full | Full | Full | Full | Read only | No access | No access | No access | No access |
| Offer letters (generate) | Full | Full | No access | Full | No access | Full | No access | No access | No access |
| Offer letters (approve/reject) | Full | Full | No access | No access | No access | No access | No access | No access | No access |
| Offer letters (countersign) | Full | Full | No access | Full | No access | No access | No access | No access | No access |
| HR letters (generate/issue) | Full | Full | No access | Full | No access | No access | No access | No access | No access |
| Amendment letters | Full | Full | No access | Full | No access | No access | No access | No access | No access |
| Salary advance (self-request) | Full | Full | Full | Full | Full | Full | Full | Full | Full |
| Salary advance (manager approve) | Full | Full | No access | Full | No access | Full | No access | No access | No access |
| Salary advance (final approve) | Full | No access | No access | No access | No access | No access | No access | No access | No access |
| Salary advance (manual record) | Full | Full | Full | No access | No access | No access | No access | No access | No access |
| Salary advance (accounts view) | Full | Full | Full | Full | No access | No access | No access | No access | No access |
| Performance goals | Full | Full | No access | Full | No access | Full | Full | No access | Own records |
| Performance check-ins | Full | Full | No access | Full | No access | Full | Full | No access | Own records |
| Performance reviews | Full | Full | No access | Full | No access | Own team | Full | No access | Own records |
| Review cycles (manage) | Full | Full | No access | Full | No access | No access | No access | No access | No access |
| My Team view | Full | Full | No access | Full | No access | Own team | Full | No access | No access |
| Training track management | Full | Full | No access | Full | No access | Full | Full | No access | No access |
| Training compliance | Full | Full | Read only | Full | No access | Read only | Read only | No access | No access |
| SOP management | Full | Full | No access | Full | No access | Full | Full | No access | No access |
| SOP rollout config | Full | Full | No access | No access | No access | No access | No access | No access | No access |
| Vault (read) | Full | Full | No access | Full | No access | Full | Full | Full | Full |
| Vault (manage/create secrets) | Full | Full | No access | No access | No access | No access | No access | No access | No access |
| Help desk (create/view own) | Full | Full | Full | Full | Full | Full | Full | Full | Full |
| Help desk (resolve/queue) | Full | Full | No access | Full | No access | No access | Full | No access | No access |
| Content Studio | Full | Full | No access | No access | No access | No access | No access | No access | No access |
| Announcements | Full | Full | No access | Full | No access | No access | No access | No access | No access |
| System feature flags | Full | Full | No access | No access | No access | No access | No access | No access | No access |
| Access control matrix edit | Full | Full | No access | No access | No access | No access | No access | No access | No access |
| New Hire section | Full | Full | No access | Full | No access | Full | Full | No access | No access |
| Governance controls (view) | Full | Full | Full | Full | Full | Full | Full | Full | Full |
| Governance controls (HR-level) | Full | Full | Full | Full | No access | No access | No access | No access | No access |
| Governance controls (CEO-level) | Full | Full | Full | No access | No access | No access | No access | No access | No access |
| Contracts | Full | Full | No access | Full | No access | Full | Full | No access | No access |
| Invoices | Full | Full | No access | Full | Full | No access | Full | No access | No access |
| Release notes | Full | Full | No access | Full | No access | No access | No access | No access | No access |
| Company profile | Full | Full | No access | No access | No access | No access | No access | No access | No access |
| Employee dossier | Full | Full | Full | Full | No access | No access | No access | No access | No access |

`CONFIRMED_IN_CODE` — values derived from `shared/accessControl.ts` ACCESS_REGISTRY entries.

### Studio Add-On Roles (Supplementary Section)

The `studio_add_on` column on `admin_users` grants Content Studio permissions without changing the employee's base role. `CONFIRMED_IN_SCHEMA`

| Studio Add-On Level | Permissions Granted |
|---|---|
| `marketing_manager` | view, create_article, edit_article, generate_ai_draft, manage_assets, review_article, cm_review, manage_authors, marketing_approve, view_analytics |
| `content_creator` | view, create_article, edit_article, generate_ai_draft, manage_assets, view_analytics |
| `influencer` | view, create_article |

Final publish (`studio.publish_article`) is permanently restricted to `super_admin` and is not grantable via add-on. `CONFIRMED_IN_CODE`

---

## Engineering View — Permission Enforcement Map

### Login Flow

**Email/Password path** `CONFIRMED_IN_CODE` — `server/authRoutes.ts`:
1. Email domain checked against `allowed_email_domains` system setting (default: `hire-in.com`). Returns 403 if domain not allowed.
2. User record fetched from `admin_users`. Returns 401 for unknown email or soft-deleted account (checks `deletedAt`). Returns 403 for deactivated account (`isActive = false`).
3. Password verified with `bcrypt.compare` (salt rounds: 12). Returns 401 on mismatch.
4. If `totpEnabled = true` and `totpSecret` is set: the request must include a `totpCode`. If absent, returns 200 with `{ totpRequired: true }` (client must re-submit). If present, validates TOTP with 1-step window tolerance (SHA1, 6-digit, 30-second period via `otpauth` library). Returns 401 if code is invalid.
5. On success, session is created via `createSession()`.

**Replit Auth (OpenID Connect) path** `CONFIRMED_IN_EXISTING_GUIDE` — referenced in `replit.md` as installed integration (`javascript_log_in_with_replit==2.0.0`). Detailed route implementation in `server/authRoutes.ts` handles the OIDC callback and session creation. `UNABLE_TO_CONFIRM — OWNER REVIEW REQUIRED`: The precise data sharing agreement and which user fields are synchronized from Replit identity to `admin_users` cannot be confirmed from code alone.

**Initial Super Admin setup** `CONFIRMED_IN_CODE` — `POST /api/auth/setup` creates the first `super_admin` account only when the `admin_users` table is empty. Protected by a check: returns 403 if any user already exists.

### Session Management

`CONFIRMED_IN_CODE` — `server/auth.ts`:
- Session store: PostgreSQL via `connect-pg-simple`, reusing the application's bounded connection pool (never opens a separate pool).
- Session TTL: 30 minutes (1,800 seconds).
- Rolling sessions: `rolling: true` — the TTL resets on every authenticated request.
- Cookie: `httpOnly: true`, `sameSite: 'lax'`, `secure: true` in production.
- Cookie domain: configurable via `COOKIE_DOMAIN` env var.
- Session secret: `SESSION_SECRET` env var.
- Session data stored: `userId`, `email`, `role`, `firstName`, `lastName`, anonymous visitor ID (`anonId`), and per-article Studio view timestamps.
- The client-side session warning (30-minute auto-logout with warning) is referenced in `replit.md`. `CONFIRMED_IN_EXISTING_GUIDE`

### TOTP 2FA Enforcement

`CONFIRMED_IN_CODE` — `server/auth.ts` (`require2FA` middleware):
- Applies only in `NODE_ENV === 'production'`.
- Exempt paths: `/api/auth/me`, `/api/auth/logout`, `/api/auth/totp/status`, `/api/auth/totp/setup`, `/api/auth/totp/verify`, `/api/auth/totp/disable`, `/api/auth/totp/admin-reset`, `/api/hr/my-profile`.
- For all other authenticated paths: if the user does not have `totpEnabled = true`, the request returns 403 with message `"Two-factor authentication must be enabled before accessing this resource."`.
- In development (`NODE_ENV !== 'production'`), `require2FA` passes all requests through without checking.
- TOTP algorithm: SHA1, 6 digits, 30-second period. Stored as base32 secret.
- TOTP setup: generates a new secret, stores it to `admin_users.totpSecret`, returns QR code. TOTP not enabled until separately verified with a valid code.
- TOTP disable: requires a valid current TOTP code and is restricted to `super_admin` role only.
- Admin TOTP reset: `super_admin` and `admin` can reset another user's TOTP. Admins cannot reset TOTP for accounts at `super_admin` or `admin` level.

### Password Handling

`CONFIRMED_IN_CODE` — `server/auth.ts`:
- Passwords hashed with `bcryptjs`, 12 salt rounds.
- Password reset: generates a 32-byte cryptographically random token, stores it to `admin_users.passwordResetToken` with a 1-hour expiry (`passwordResetExpiry`). Reset link sent via email.
- Passwords are never stored in plaintext and are never returned in any API response (routes return only `id`, `email`, `firstName`, `lastName`, `role`, and similar non-sensitive fields).

### Centralized Access Control Flag

`CONFIRMED_IN_CODE` — `shared/accessControl.ts`, `server/accessControlService.ts`:
- The `CENTRALIZED_ACCESS_CONTROL` feature is controlled by a `system_settings` key (`ACCESS_CONTROL_ENABLED_KEY`).
- When enabled: `resolveRoles(featureKey, defaultRoles)` reads from the live DB-backed matrix (stored in `system_settings` under `ACCESS_CONTROL_MATRIX_KEY`).
- When disabled: `resolveRoles` falls back to the static `ACCESS_REGISTRY` defaults in `shared/accessControl.ts`.
- The matrix is sanitized on every save: only valid roles and known feature keys are accepted; `super_admin` is always present on every feature key (cannot be locked out).
- Matrix hydration on boot: `hydrateAccessControl()` is called at server startup; if no persisted matrix exists, the static `ACCESS_REGISTRY` is seeded as the initial matrix.
- Phase 2 DB-driven access is the same code path; the flag enables it.

### New Look v2 Two-Tier Gate

`CONFIRMED_IN_CODE` — `server/authRoutes.ts`, `shared/accessControl.ts`:
- Tier 1: Global `new_look` system flag (admin master switch stored in `system_settings`).
- Tier 2: Per-user `preferences.newLook` boolean stored in `admin_users.preferences` JSONB.
- Both tiers must be true for v2 to activate for a given user. The global flag acts as a kill switch regardless of individual preferences.
- User preference is updated via `PATCH /api/auth/me/preferences`.

### Permission Enforcement Locations by Feature

| Feature Area | Schema | Route middleware | Storage filter | UI only | Notes |
|---|---|---|---|---|---|
| Authentication (login) | — | Route-level (`/api/auth/login`) | — | — | `CONFIRMED_IN_CODE` |
| TOTP enforcement | — | `require2FA` middleware (production only) | — | — | `CONFIRMED_IN_CODE` |
| Role-based feature access | — | `requirePermission(featureKey, ...roles)` | — | — | `CONFIRMED_IN_CODE` |
| Admin-level access (super_admin/admin) | — | `requireAdminLevel` middleware | — | — | `CONFIRMED_IN_CODE` |
| Session authentication | — | `requireAuth` middleware | — | — | `CONFIRMED_IN_CODE` |
| Team-scoped data (manager sees own team) | — | Route-level role check | `WHERE manager_id = $1` filter | — | `CONFIRMED_IN_CODE` |
| Salary advance final approval (super_admin only) | — | `requirePermission` | — | — | `CONFIRMED_IN_CODE` |
| SOP rollout enforcement | — | `resolveSopAccessForUser` | — | — | `CONFIRMED_IN_CODE` |
| Vault secret access | — | `requirePermission` | Storage-level grant check | — | `CONFIRMED_IN_CODE` |
| Content Studio add-on permissions | — | `requirePermission` + add-on DB lookup | — | — | `CONFIRMED_IN_CODE` |
| Public document verification (`/verify`) | — | Rate limiter only | — | — | `CONFIRMED_IN_CODE` |
| Executive cockpit route | — | `RequireRoles` component | — | Client-side only for route | `CONFIRMED_IN_CODE` — note: route guard is client-side (`RequireRoles`); backend endpoints additionally use `requirePermission` |

**Risk note:** The `/admin/executive-cockpit` and `/admin/payroll/executive` routes use a client-side `RequireRoles` component for routing. Backend API endpoints for executive data additionally enforce `requirePermission` with the `executive` role. UI-only route guards are present but backend enforcement exists for the underlying data endpoints. `UNABLE_TO_CONFIRM — OWNER REVIEW REQUIRED`: A complete audit of whether every data endpoint called from executive-only pages enforces the role server-side has not been completed from code reading alone.

### PII Field Handling

`CONFIRMED_IN_CODE` — `server/auth.ts`, `shared/schema.ts`:
- Sensitive fields in `admin_users`: `password` (bcrypt hash), `totpSecret` (base32), `passwordResetToken`.
- These fields are never returned by `getCurrentUser()` — the select projection explicitly excludes `password` and `totpSecret`.
- Bank account details are stored in `employee_bank_details` table with no encryption at the application layer. `UNABLE_TO_CONFIRM — OWNER REVIEW REQUIRED`: Whether the database itself applies column-level encryption to bank details cannot be confirmed from application code alone.
- TOTP secrets are stored as base32 strings in the database without additional encryption at the application layer.
- Passwords are hashed with bcrypt before storage; plaintext is never persisted.
