---
name: CSS var() fallback vs empty custom property
description: Why var(--x, default) silently fails when --x is set-but-empty, and the Mustache pattern that fixes it for templated inline styles.
---

`var(--x, fallback)` only uses the fallback when `--x` is the *guaranteed-invalid
value* (never declared / unset). If `--x` is declared with an **empty** value
(e.g. `--x:;`), var() substitutes that empty value into the using declaration,
making it invalid → the property drops to its initial value (transparent for
backgrounds), **not** the fallback.

**Why:** This bit the hirein-v1 social-card templates. A templated inline style
`style="--brand:{{brand_color}};--cat:{{category_color}};"` becomes `--brand:;`
when the engine substitutes an empty string, so every `var(--brand, #F96D3E)` /
`var(--cat, #F47C20)` rendered transparent (white text on white pills, invisible
accents, missing corner logo).

**How to apply:** For templated/optional CSS custom properties, declare them only
when a value exists. Use Mustache conditional sections so the property is simply
absent (unset) otherwise:
`style="{{#brand_color}}--brand:{{brand_color}};{{/brand_color}}{{#category_color}}--cat:{{category_color}};{{/category_color}}"`.
A raw unsubstituted template (literal `{{#brand_color}}...`) is invalid style text
the browser ignores → property stays unset → fallback works → self-contained file
still renders in full brand color.

Unrelated gotcha found same session: `position:absolute` with no `top/right/bottom/left`
leaves the element at its static position (often top-left), not the corner you
expect — always set explicit offsets (e.g. `right:0;bottom:0`) for corner badges.
