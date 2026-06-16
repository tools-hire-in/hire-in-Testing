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

## What stays in code (not centralized)
Scoped/per-request authorization is intentionally left in handlers: `validateMyTeamAccess`, ROLE_RANK hierarchy, self-access, reviewer-membership, endorser checks, NIGHT_SHIFT_EXEMPT, secondary view-all arrays. These aren't static feature→role maps.

Coverage map: `.local/tasks/rbac-coverage-inventory.md`.
