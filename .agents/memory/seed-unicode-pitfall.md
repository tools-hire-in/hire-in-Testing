---
name: Seed data Unicode pitfall
description: Unicode chars in plan_goal_templates seed titles silently fail ON CONFLICT matching
---

When seeding plan_goal_templates (or any table with a unique text constraint), Unicode characters
in goal_title strings must exactly match what is in the DB.

**Why:** `ON CONFLICT (plan_type, role_slug, goal_title) DO NOTHING` does a byte-exact match.
If the seed file has `×` (U+00D7 multiplication sign) but the DB row has `x` (ASCII 120), the
conflict clause never fires — the seed inserts a duplicate with the Unicode variant.

**How to apply:** When writing or updating seeds with text unique keys:
1. Avoid special Unicode chars in seed titles — use plain ASCII equivalents (x not ×, - not —, etc.)
2. If a seed reports "0 new rows" but expected rows are missing, check for Unicode/ASCII mismatch
   between the seed array and the live DB rows.
3. The fix: run a direct pg.query() to delete old rows and insert with the exact ASCII titles,
   then update the seed file to match.
