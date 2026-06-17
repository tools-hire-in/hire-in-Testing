# Hire'in v1 Social Card — Character Budgets

These templates use CSS `-webkit-line-clamp` to truncate overflow gracefully, so
content never breaks the layout. The numbers below are the **recommended** copy
lengths that fill each card without being clamped. Going over is safe (text is
cut with an ellipsis); going well under leaves whitespace.

Fonts: titles/quotes use **Playfair Display 800**, body uses **Inter**.

## Slots

| Slot | Used by | Notes |
| --- | --- | --- |
| `title` | all layouts | Headline / checklist title / pull-quote text |
| `excerpt` | (data attribute only) | Stored on `<body data-excerpt>` for engine use |
| `supporting_line` | standard, checklist | One-line subhead under the title |
| `category` | all | Pill label (rendered UPPERCASE) |
| `category_color` | all | Pill background; falls back to brand orange `#F47C20` |
| `brand_color` | all | Accent bar / corner logo; falls back to `#F96D3E` |
| `author_name` | all | |
| `author_title` | all | |
| `author_photo_url` | all | Avatar; if missing/broken the image self-removes (icon fallback) |
| `logo_url` | all | Optional override; default monogram is embedded base64 |
| `footer_url` | all | e.g. `hire-in.com/insights` |
| `publish_date` | standard, quote | e.g. `June 2026` |
| `tips` (`tip_title`, `tip_desc`) | checklist | Repeatable list |

## Per-layout / per-platform budgets

### standard
Title clamps at **3 lines** (landscape) / **4 lines** (square + story).
Supporting line clamps at **2 lines**.

| Platform | Size | Title (chars) | Supporting (chars) | Category (chars) |
| --- | --- | --- | --- | --- |
| linkedin | 1200×627 | ~70 (3 lines) | ~110 | ~28 |
| instagram-square | 1080×1080 | ~60 (4 lines) | ~90 | ~28 |
| instagram-story | 1080×1920 | ~60 (4 lines) | ~90 | ~28 |
| twitter | 1600×900 | ~80 (3 lines) | ~120 | ~28 |

### checklist
Title clamps at **2 lines** (landscape) / **3 lines** (square).
Tips: each `tip_title` ~40 chars, `tip_desc` ~80 chars.

| Platform | Size | Title (chars) | Max tips |
| --- | --- | --- | --- |
| linkedin | 1200×627 | ~46 (2 lines) | 4 |
| instagram-square | 1080×1080 | ~40 (3 lines) | 5 |

### quote
Quote text clamps at **3 lines** (landscape) / **4 lines** (square).

| Platform | Size | Quote (chars) | Category (chars) |
| --- | --- | --- | --- |
| linkedin | 1200×627 | ~90 (3 lines) | ~28 |
| instagram-square | 1080×1080 | ~110 (4 lines) | ~28 |
| twitter | 1600×900 | ~100 (3 lines) | ~28 |

## Self-containment

Every HTML file is standalone: fonts and the default logo are embedded as
base64 data URIs, all CSS is inline in a `<style>` block, and there are **no
external network fetches**. Color slots use `var(--token, <brand default>)` so an
unsubstituted card still renders in full brand color.
