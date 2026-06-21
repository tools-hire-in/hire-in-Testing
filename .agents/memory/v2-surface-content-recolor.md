---
name: v2-surface content recolor pattern
description: How per-surface v2 rollout recolors off-brand decorative utilities without touching classic
---

The v2 "new look" leaves content tokens un-overridden (chrome is navy, content stays classic). To brand a content surface under v2 WITHOUT rewriting it, add the class `v2-surface` to that page's content root and let a scoped CSS layer in `client/src/index.css` (under `.app-v2 .v2-surface`) remap off-brand Tailwind utility classes to brand navy.

**Rule:** only COOL decorative families (blue, indigo, purple, teal, pink) get remapped to navy. STATUS colors (green = success, amber/yellow = warning, red = destructive) are left intact — they carry meaning.

**Why it stays classic when flag OFF:** the recolor rules require an `.app-v2` ancestor, which AdminLayout only adds when `useNewLook().enabled`. `v2-surface` itself is an otherwise-styleless class, so adding it unconditionally to a page root is inert in classic — visually byte-for-byte unchanged.

**Specificity trick:** `.app-v2 .v2-surface .text-blue-700` is (0,3,0), which outranks base utilities (0,1,0) AND `.dark`-gated `dark:` variants (0,2,0). So a single base-class override also wins in dark mode — no separate `dark:` rules needed. `hover:` variants must be matched explicitly (`.app-v2 .v2-surface .hover\:bg-blue-50:hover`), escaping `:` as `\:` and `/` as `\/`.

**How to apply:** add `v2-surface` to the leaf "Content" component root (e.g. MyGoalsContent, not the page wrapper) so every usage — standalone route AND embedded MyGrowth tab — is covered once. Embedded-only surfaces (PraiseBoard, MyPlanView) are covered by marking the parent (MyGrowth). Nesting v2-surface inside v2-surface is harmless.

**Charts/analytics caveat:** the generic remap keeps green/amber, so rainbow stat tiles still show non-brand colors. For analytics that must be brand-ONLY, gate the tile colors on `useNewLook().enabled` and use arbitrary hex classes (`bg-[#1F3A6E]`, `bg-[#F47C20]`) which the remap layer leaves untouched.

**Scope discipline:** never put the recolor on AdminLayout's shared content container — that bleeds into out-of-scope surfaces (Recruitment, People & HR). Keep it per-page via `v2-surface`.
