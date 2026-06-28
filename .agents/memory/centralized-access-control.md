---
name: Centralized Access Control (RBAC)
description: How the central feature→roles registry works, the safety flag, and the parity invariant that must hold.
---

# Centralized Access Control

Single source of truth: `shared/accessControl.ts`.
- `CENTRALIZED_ACCESS_CONTROL` env flag is **GONE** (collapsed). `requireRole` exact-string middleware is **GONE** — every decision flows through a `requirePermission`/`resolveRoles` helper keyed on `ACCESS_REGISTRY`.
- `ACCESS_REGISTRY` is now the **authoritative default and is hand-maintained**. Do NOT run `scripts/genAccessControl.mjs` — it wipes keys whose call sites it can't scan (travel/releaseNotes/etc.) and reverts hand-reconciled values.
- `resolveRoles(key, fallback)`: `if (dbDriven && liveMatrix) → live value`; else → `ACCESS_REGISTRY[key] ?? fallback`. So with the DB layer OFF, the **registry is what runs** (fallback only for keys absent from the registry).

## The parity invariant (critical)
For every guard site, the registry entry for its key MUST equal that site's call-site fallback role list. Because the registry is now authoritative even with the DB flag off, any divergence is a **live behavior change**, not dormant config. `scripts/verifyAccessParity.mjs` is the standing read-only check — run it after any edit to a call site or the registry. It encodes the per-file auto-grant rule (below); getting that rule wrong silently mis-reports parity.

## Auto-grant asymmetry (THIS is the foot-gun — caused a privilege-escalation near-miss)
Each file's `requirePermission` helper has its own semantics; the verifier must mirror them exactly per file:
- **Auto-grant super_admin+admin:** `routes.ts`, `contractRoutes.ts`, `travelRoutes.ts`, `performanceRoutes.ts`.
- **NO auto-grant (exact list):** `salaryAdvanceRoutes.ts`, `releaseNotesRoutes.ts`, `auth.ts`/`authRoutes.ts`, `onboardingRoutes.ts` (`hasAccess`), `attendanceReportRoutes.ts`.

**Why it bites:** `salaryAdvance.finalApprove` registry is `["super_admin"]` ON PURPOSE (admin must be rejected — guarded by `salaryAdvanceAccess.test.ts`). Its helper deliberately does NOT inject admin. If the verifier assumes auto-grant for salaryAdvanceRoutes it "sees" `[super_admin,admin]` and tempts you to widen the registry to match — that grants admin final-approval = privilege escalation. The helper's own comment is the source of truth for whether it auto-grants.

## studio.* drift reconciliation (2026-06)
`studio.*` registry rows had carried aspirational roles that never took effect while the registry was dormant: `content_manager` (NOT a real role in `ACCESS_CONTROL_ROLES` — phantom, harmless but misleading) and extra `hr`. When the flag collapse made the registry authoritative, those had to be trimmed back to the live call-site sets to stay byte-for-byte. `studio.marketing_approve` had inconsistent call sites (bulk-approve endpoint = admin-only, others allow marketing_manager) → split out a dedicated `studio.marketing_approve.bulk` key so each endpoint keeps its exact prior access.

## Phase 2: DB-driven editable matrix
A DB flag layers on top: `access_control_db_enabled` (system_settings, boolean; currently UNSET/OFF in dev → registry runs). When ON, `resolveRoles` consults a live in-memory matrix (`setLiveAccessMatrix`) seeded from `ACCESS_REGISTRY` and persisted as `access_control_matrix` (system_settings jsonb). When OFF, `resolveRoles` falls through to `ACCESS_REGISTRY[key]`. Note the persisted DB matrix does NOT contain studio/salaryAdvance/travel/releaseNotes keys, so those always resolve from the registry default even with the DB layer on (`sanitizeMatrix` keeps defaults for absent keys).
- Service: `server/accessControlService.ts` (seed/hydrate on boot, sanitize, save, reset). Boot hydration runs after `registerRoutes` in `server/index.ts`.
- `sanitizeMatrix` **force-adds super_admin to every feature** — guardrail so the matrix can never lock out super admins. Editor checkbox for super_admin is locked.
- Endpoints are hardcoded **super_admin-only** (`requireSuperAdmin`), NOT matrix-gated, so the editor can never be locked out of itself: `GET /api/me/permissions` (any auth), `GET/PUT /api/admin/access-control`, `POST .../reset`.
- Frontend: `usePermissions()` hook (`can(featureKey)` returns true while loading to avoid flash-hide). Gates sidebar groups in AdminLayout (AND with role booleans) + key buttons (Jobs add, Users invite).

**Why super_admin force-add + non-matrix-gated endpoints:** without both, a bad save could remove all access to the editor permanently with no recovery path.

## What stays in code (not centralized)
Scoped/per-request authorization is intentionally left in handlers: `validateMyTeamAccess`, ROLE_RANK hierarchy, self-access, reviewer-membership, endorser checks, NIGHT_SHIFT_EXEMPT, secondary view-all arrays. These aren't static feature→role maps.

Coverage map: `.local/tasks/rbac-coverage-inventory.md`.
