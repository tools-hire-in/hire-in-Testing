---
name: Login-blocking modals vs the 2FA gate
description: Any full-screen modal/redirect shown at login that calls /api/hr or /api/admin must be deferred until 2FA is set up, or it deadlocks in production.
---

# Login-blocking modals must defer to the 2FA gate

The `require2FA` middleware guards **all** `/api/hr/*` and `/api/admin/*` routes. It is **production-only** (returns `next()` when `NODE_ENV !== "production"`) and rejects users whose `totpEnabled` is false with `403 "Two-factor authentication must be enabled..."`, except for a small `TOTP_EXEMPT_PATHS` allowlist (TOTP setup + profile).

**Rule:** Any component that hard-blocks the screen at login (full-screen modal, forced redirect) and whose action calls a non-exempt `/api/hr` or `/api/admin` endpoint MUST be gated behind `!userNeeds2FASetup` (`user && !user.totpEnabled`). Otherwise a pre-2FA user sees the block overlay the mandatory "Set Up 2FA" prompt, the action 403s, and they are trapped.

**Why:** This exact deadlock shipped — the attendance-regularization policy modal rendered unconditionally over the 2FA-setup screen; its accept POST 403'd with no error feedback. Reproduces ONLY in production because the gate is prod-only.

**How to apply:** AdminLayout already defers the onboarding policy-gate redirect and compliance-lock redirect on `!userNeeds2FASetup`. Follow the same pattern for any new login-time gate. Also give such mutations an `onError` toast so a 403 is never silent.
