---
name: Content Studio social card engine
description: How branded social PNG cards are rendered, stored, and auto-triggered
---

# Social card engine (Content Studio)

Renders branded PNG social cards from pre-coded HTML templates. Template family
default `hirein-v1`, dir `templates/social-cards/<family>/` with `manifest.json`.

- **Template seeding**: `ensureCardTemplatesAndBrand()` at startup upserts `card_templates`
  from the manifest (idempotent) and seeds `studio_brand_settings`. Do NOT add a second seeder.
- **Resolution**: `getCardTemplateFor(family, layout, platform, projectId?)` = project override → global fallback. Missing (layout,platform) combos are skipped, not errors.
- **Active vs inactive**: `getCardTemplates()` defaults to active-only (drives generation). The Template Settings admin UI must pass `includeInactive` — otherwise a toggled-off variant disappears and can't be re-enabled.
- **Render scale**: Chromium renders at `deviceScaleFactor: 2`, so the actual PNG is 2× the stored CSS width/height; UI displays via aspect-ratio from the CSS dims. `waitUntil: "networkidle0"` needs `as any` (puppeteer-core type is narrower) — it's valid at runtime; don't downgrade to "load" or fonts/images may not settle.
- **Layout/platform matrix**: `LAYOUT_PLATFORMS` in `shared/socialCards.ts`. Platforms are hyphenated: `linkedin`, `instagram-square`, `instagram-story`, `twitter`.
- **Char budgets**: `CARD_BUDGETS` / `cardBudget(layout,platform)` are soft limits surfaced in the Social Kit UI; overflow is safe (CSS line-clamp truncates).
- **Storage**: uploaded via `objectStorageService.uploadBuffer` to `studio/social-cards/{articleId}/{layout}-{platform}.png`; public URL `/objects/<relativePath>` (served by object-storage GET route, no read ACL).
- **Persistence/contract**: `studio_articles.social_cards_jsonb = {family, layout, generatedAt, cards:[{layout,platform,url,width,height}]}`. Frontend reads `stored.layout` + `stored.cards`.
- **Auto-trigger**: non-blocking generation fires in the status transition handler when `to === 'approved'`. Manual regenerate via the article's regenerate-cards route (optional `layout` override).

**Why:** the 2× scale + networkidle0 cast and the active-only-vs-includeInactive split are easy to regress; the global-fallback resolution and skip-missing behavior are deliberate for multi-brand support.
