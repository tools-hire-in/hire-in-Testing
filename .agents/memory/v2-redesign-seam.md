---
name: App redesign (v2) theme seam
description: How the opt-in "new look" redesign is scoped so flag-OFF stays classic
---

The app-wide redesign is gated behind a per-user opt-in (`admin_users.preferences.newLook`, default OFF), surfaced as "Try the new look" / "Switch back to classic".

**Theme seam:** v2 design tokens live entirely under a `.app-v2` scope class in `client/src/index.css`. AdminLayout adds `app-v2` to its outer wrapper only when the flag is ON. The scope re-maps the existing shadcn `--sidebar*` chrome tokens to the navy cockpit, so the EXISTING Sidebar primitives (collapse, command-center, studio sections) render in the new look automatically — no duplicate sidebar component needed.

**Why:** Re-using the shadcn token contract avoids forking ~400 lines of nav/query logic. Content tokens (`--background`, `--card`, `--muted`) are deliberately NOT overridden — strategy is "dark navy chrome + clean light content area", so feature page content stays classic until redesigned per-surface later.

**How to apply:** To extend v2 to a new surface, add v2 vars under `.app-v2` and branch the component on `useNewLook().enabled`. Keep the classic branch intact so flag-OFF is unchanged. The only classic-shell change required by the opt-in is the entry-point button in the header.

**Per-surface content scope (`.v2-surface`):** Rolling v2 content styling page-by-page is done WITHOUT touching shared feature components. Wrap a page's content div in a `v2-surface` class and put all content rules under `.app-v2 .v2-surface ...` in index.css (cards/tabs/tables/headers + a `.v2-page-head` navy gradient band). Because the rules require BOTH ancestors, the classes are completely inert with the flag off AND on surfaces that don't opt in — so the personal area can be redesigned while HR/recruitment/growth stay classic until their own rollout. The added class names are harmless no-ops in classic; no `useNewLook()` branch is needed just to apply them. Specificity: `.app-v2 .v2-surface [role=tab][data-state=active]` (0,4,0) reliably beats Tailwind's `data-[state=active]:bg-background` (0,2,0), so no `!important` needed. Personal surfaces wired this way: My Work (MyDesk), My Team (MyTeamTabs), My Profile (MyProfile).

**Preference plumbing:** GET via `/api/auth/me` (getCurrentUser now selects `preferences`); write via `PATCH /api/auth/me/preferences` (zod-validated, merges into existing jsonb). Client `useNewLook()` hook optimistically updates the `["/api/auth/me"]` cache.

**Schema note:** `preferences jsonb` was added to `admin_users` via direct `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` — NOT db:push, which wanted to drop ~10 drifted columns (data loss). Surgical SQL is the safe path here (see db-push-interactive-prompt.md).

**Launch consistency (two-pattern gotchas):** (1) Page headers have TWO interchangeable systems that must be kept visually in sync — the `V2PageHeader` component (used by Recruitment/PeopleHR/NewHire/Jobs/Applications/ServiceDesk) and the `.v2-page-head` CSS class (MyProfile/MyTeamTabs). Both must share radius/padding/gradient (navy→#16294d→orange@165%) or the areas drift. (2) Tab-strip styling is defined ONCE at the global `.app-v2` scope (track + radius + white active pill + orange underline), NOT per `.v2-surface`, so every tab strip matches whether or not the page opts into the content surface. Don't re-add a `.v2-surface`-scoped tab rule. (3) Every page that branches on `useNewLook()` should also carry `v2-surface` on its content wrapper, else you get a v2 navy header sitting on classic white cards/tables. (4) Recolor layer handles blue/indigo/purple/violet/teal/pink → navy; if a page introduces another cool family (sky/violet/fuchsia/cyan), add it to the recolor groups rather than editing the page (keeps flag-OFF byte-for-byte).
