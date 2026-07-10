---
name: App.tsx duplicate route blocks
description: The client router declares the same studio/legacy route lists twice; edits must hit both.
---

The client `App.tsx` router contains TWO copies of the `/studio/*` (StudioV2) route block and TWO copies of the `/admin/studio/*` (LegacyStudio) route block (different router contexts). Adding a new studio page requires registering the route in **all** matching blocks.

**Why:** A single-context edit leaves the page 404ing in the other context; exact-match `edit` calls fail with "2 matches" because the blocks are byte-identical.

**How to apply:** When adding studio routes, use `replace_all: true` with the identical anchor lines (e.g. insert before the catch-all `/studio` route), then grep the path to confirm it appears twice.
