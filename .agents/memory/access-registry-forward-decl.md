---
name: Access registry forward-declared keys
description: How to add permission keys to ACCESS_REGISTRY for a module whose routes don't exist yet, without breaking parity or losing them.
---

When introducing a new feature module's permission keys before all its guarded
routes exist, you can add the keys directly to `ACCESS_REGISTRY` in
`shared/accessControl.ts` and to `ACCESS_CONTROL_ROLES` (the editable grid
universe). New roles can live in `ACCESS_CONTROL_ROLES` even if they are NOT in
the `user_role` pgEnum — the grid is just a column universe, no enum migration
needed for the access UI to show them.

**Parity:** `scripts/verifyAccessParity.mjs` only iterates *call sites* and
checks each site's key exists in the registry with matching effective roles. It
does NOT fail on registry keys that have no call site. So forward-declared keys
(no `requirePermission` yet) pass parity fine. For any key you DO attach to a
`requirePermission("key", ...roles)` site, the registry entry must equal
`["super_admin","admin", ...roles]` exactly (auto-grant is baked in).

**Why this matters / gotcha:** `scripts/genAccessControl.mjs` regenerates
`ACCESS_REGISTRY` purely from call sites. Running it would WIPE any
forward-declared key that lacks a call site. Only keys with a live guard survive
regeneration. So: don't run genAccessControl while a module is mid-build with
forward-declared keys, and re-verify registry after future route work adds the
real guards.
