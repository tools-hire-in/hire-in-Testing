---
name: Studio occasions & idea creative cards
description: How the occasion-aware calendar and Social-idea card gallery are wired, and the constraints future Studio work must respect.
---

# Studio occasions & idea creative cards (T4)

- Curated `studio_occasions` rows (projectId NULL) are read-only via API; custom rows are per-project and soft-deleted via `isActive=false`. Reads must filter `isActive`.
- Per-project `studio_projects.occasion_preferences` jsonb (`{regions,categories}`): NULL/empty = show NO curated occasions (opt-in), but project custom occasions ALWAYS show. Empty arrays are normalized to NULL on PATCH.
- **Why:** projects have different regional audiences; leaking wrong-region holidays into planning was the concern.
- Curated seed covers 2026–2027 only; moveable festivals (Diwali, Easter, Thanksgiving) need re-curation for 2028+ or badges silently vanish.
- Content ideas (`studio_content_ideas`) are surfaced ONLY as calendar chips + a card-gallery dialog (T1 ideas workspace was never merged). If a T1-style workspace lands, migrate the chips/gallery entry points rather than duplicating.
- Idea creative cards: `generateIdeaCards()` in cardGenerationService renders hook/quote/stat/story-frame layouts per idea channel platforms; result persisted in `socialCardsJsonb` (`{hookText, cards:[{layout,platform,url,width,height}]}`); regenerating one layout merges, full regen replaces. "Use this card" just writes the PNG url into `creativeLink`.
- **How to apply:** any new UI over ideas should reuse `IdeaCardGallery` (exported from SocialKitPreview.tsx) and invalidate `["/api/admin/studio/content-ideas"]`.
