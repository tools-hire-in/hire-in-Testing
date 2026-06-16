---
name: Centralized Access Control (RBAC)
description: How the central feature→roles registry works, the safety flag, and the parity invariant that must hold.
---

# Centralized Access Control

Single source of truth: `shared/accessControl.ts`.
- `CENTRALIZED_ACCESS_CONTROL` flag (env `=== "true"`, default false). OFF = legacy behavior.
- `ACCESS_REGISTRY` is **auto-generated** by `scripts/genAccessControl.mjs` (scans guard sites and also rewrites call sites). Do NOT hand-edit registry rows — re-run the generator.
- `resolveRoles(key, fallback)` / `isRoleAllowed(role, key, fallback)`: flag OFF (or missing key) → returns `fallback`; flag ON → returns registry value.

## The parity invariant (critical)
For every guard site, the registry entry for its key MUST equal that site's legacy fallback role list. That equality is the only reason the flag is safe to flip ON (zero behavior change). `scripts/verifyAccessParity.mjs` is the standing read-only check — run it after any edit to a call site or the registry.

## Auto-grant asymmetry (easy to get wrong)
- `routes.ts` / `contractRoutes.ts` / `performanceRoutes.ts` middleware **auto-grant** super_admin+admin → their registry fallbacks bake those in.
- `auth.ts` `requirePermission`, `onboardingRoutes.ts` `hasAccess`, `attendanceReportRoutes.ts` use **exact lists, NO auto-grant**.

**Why:** each helper mirrors the pre-existing legacy middleware semantics of its file; mixing them up silently widens or narrows access.

## Phase 2: DB-driven editable matrix
A second flag layers on top: `access_control_db_enabled` (system_settings, boolean). When ON, `resolveRoles` consults a live in-memory matrix (`setLiveAccessMatrix`) seeded from `ACCESS_REGISTRY` and persisted as `access_control_matrix` (system_settings jsonb). When OFF, Phase 1 env behavior is unchanged.
- Service: `server/accessControlService.ts` (seed/hydrate on boot, sanitize, save, reset). Boot hydration runs after `registerRoutes` in `server/index.ts`.
- `sanitizeMatrix` **force-adds super_admin to every feature** — guardrail so the matrix can never lock out super admins. Editor checkbox for super_admin is locked.
- Endpoints are hardcoded **super_admin-only** (`requireSuperAdmin`), NOT matrix-gated, so the editor can never be locked out of itself: `GET /api/me/permissions` (any auth), `GET/PUT /api/admin/access-control`, `POST .../reset`.
- Frontend: `usePermissions()` hook (`can(featureKey)` returns true while loading to avoid flash-hide). Gates sidebar groups in AdminLayout (AND with role booleans) + key buttons (Jobs add, Users invite).

**Why super_admin force-add + non-matrix-gated endpoints:** without both, a bad save could remove all access to the editor permanently with no recovery path.

## What stays in code (not centralized)
Scoped/per-request authorization is intentionally left in handlers: `validateMyTeamAccess`, ROLE_RANK hierarchy, self-access, reviewer-membership, endorser checks, NIGHT_SHIFT_EXEMPT, secondary view-all arrays. These aren't static feature→role maps.

Coverage map: `.local/tasks/rbac-coverage-inventory.md`.
