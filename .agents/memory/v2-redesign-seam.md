---
name: App redesign (v2) theme seam
description: How the opt-in "new look" redesign is scoped so flag-OFF stays classic
---

The app-wide redesign is gated behind a per-user opt-in (`admin_users.preferences.newLook`, default OFF), surfaced as "Try the new look" / "Switch back to classic".

**Theme seam:** v2 design tokens live entirely under a `.app-v2` scope class in `client/src/index.css`. AdminLayout adds `app-v2` to its outer wrapper only when the flag is ON. The scope re-maps the existing shadcn `--sidebar*` chrome tokens to the navy cockpit, so the EXISTING Sidebar primitives (collapse, command-center, studio sections) render in the new look automatically — no duplicate sidebar component needed.

**Why:** Re-using the shadcn token contract avoids forking ~400 lines of nav/query logic. Content tokens (`--background`, `--card`, `--muted`) are deliberately NOT overridden — strategy is "dark navy chrome + clean light content area", so feature page content stays classic until redesigned per-surface later.

**How to apply:** To extend v2 to a new surface, add v2 vars under `.app-v2` and branch the component on `useNewLook().enabled`. Keep the classic branch intact so flag-OFF is unchanged. The only classic-shell change required by the opt-in is the entry-point button in the header.

**Preference plumbing:** GET via `/api/auth/me` (getCurrentUser now selects `preferences`); write via `PATCH /api/auth/me/preferences` (zod-validated, merges into existing jsonb). Client `useNewLook()` hook optimistically updates the `["/api/auth/me"]` cache.

**Schema note:** `preferences jsonb` was added to `admin_users` via direct `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` — NOT db:push, which wanted to drop ~10 drifted columns (data loss). Surgical SQL is the safe path here (see db-push-interactive-prompt.md).
