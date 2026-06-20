---
name: New Look (v2 redesign) two-tier rollout gate
description: How the app-redesign "new look" opt-in is gated — global master flag + per-user opt-in composed into one signal.
---

# New Look v2 — two-tier rollout gate

Two independent "new look" signals exist and are **composed**, not duplicated:

- **Tier 1 — admin master / rollout gate**: global feature flag `new_look` in
  `system_settings.feature_flags` (toggled in HR Settings → Feature Flags,
  super_admin/admin). Acts as the prod rollout switch AND an instant kill-switch.
- **Tier 2 — per-user opt-in**: `admin_users.preferences.newLook` (PATCH
  `/api/auth/me/preferences`), toggled from the profile menu "Try the new look".

**Single source of truth:** `client/src/hooks/use-new-look.ts` returns
`available` (Tier 1), `optedIn` (Tier 2), and `enabled = available && optedIn`.
- Gate every v2 surface (AdminLayout `app-v2` shell, MyDesk CommandCenterV2
  cockpit) on `useNewLook().enabled`.
- Gate the "Try the new look" control visibility on `available` — hidden until
  admin enables the rollout.

**Why:** Two tasks converged — #543 built the per-user opt-in + v2 shell; the
cockpit pilot independently added the global flag. Rather than delete one, they
were combined so admin controls availability/rollout and each user opts in.
Master OFF ⇒ everyone classic regardless of personal opt-in (kill-switch);
personal opt-in persists and re-activates when master is turned back on.

**Naming trap:** Tier 1 key is snake_case `new_look`; Tier 2 pref is camelCase
`newLook`. They are different stores — do not conflate.

**Not yet done:** staged/controlled rollout (by %/role/department) would require
Tier 1 to carry more than a boolean; cockpit still uses inline brand hex rather
than #543's v2 design tokens (`--v2-orange` etc.).
