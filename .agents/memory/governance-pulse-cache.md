---
name: Governance pulse cache trap
description: The 5-min in-memory pulse cache in governanceRoutes.ts causes governance_controls counts to go stale; counts must be computed outside the cache.
---

# Governance pulse cache trap

The `/api/governance/pulse` route uses a 5-minute in-memory cache (`pulseCache`). This means any data that changes between requests within that window returns stale values.

**Why this is a problem for governance_controls counts:**
- `buildGovernancePulse()` (the cached function) cannot include counts sourced from `governance_controls` (overdue goal/check_in/pip counts) — those rows are inserted/updated dynamically (by obligation sync, tests, users).
- If the baseline call populates the cache before rows are inserted, all subsequent calls return 0 counts.

**How to apply:**
- `buildControlCounts()` is exported from `governancePulse.ts` and called **inside the route handler** (not inside `buildGovernancePulse()`), so it runs fresh on every request.
- The route spreads the cached base pulse and overrides `goals.overdueCount`, `checkins.overdueCount`, and the top-level `pip` key with live counts.
- `buildControlCounts()` is a lightweight `GROUP BY` on `governance_controls WHERE status='overdue'` — fast enough to run uncached.

**Pattern for new live-count fields:**
Any count that reads from `governance_controls` (or another frequently-mutated table) must NOT be cached inside `buildGovernancePulse()`. Compute it in the route handler and merge it over the cached response.
