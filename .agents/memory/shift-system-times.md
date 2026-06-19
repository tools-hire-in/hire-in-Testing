---
name: Shift system times
description: Durable decisions for the shift-time correction — warning cutoff design, seed idempotency, and schedule label convention.
---

# Shift system times — durable decisions

## Seed idempotency
`shifts.updated_at` must only advance when an IST timing column actually changes. Using `updated_at = NOW()` unconditionally in a seed upsert makes any time-based warning compare against a drifting value. The guard in the upsert uses `CASE WHEN ... THEN NOW() ELSE COALESCE(updated_at, NOW())` to prevent this.

**Why:** A regularization "pre-correction warning" that resets on every restart produces broad false positives unrelated to any real correction event.

## Regularization warning cutoff
The "this record predates a shift correction" warning must compare attendance dates against a fixed `system_settings` key (`shift_correction_applied_at`), not against `shifts.updated_at`. The cutoff key is seeded with `ON CONFLICT DO NOTHING` so it locks to the first deploy date.

**Why:** `shifts.updated_at` is mutable (see above). The cutoff date needs to be immutable to remain meaningful.

## Schedule label convention
Use "Summer schedule" (DST active) / "Winter schedule" (STD active) in all UI strings — not "DST/STD". Pill badge: blue, inline after U.S. coverage text.

## SHIFT_C STD punch-out policy clarification
Punch at shift end (07:30 IST) → "on_time" (delta 0). Punch at 07:00 IST (30 min early) → "early" (delta −30). The pre-correction wrong STD end of 05:30 caused 07:00 IST to give delta +90 → "overtime". The test suite has both cases with full delta arithmetic documented.

## Absent sweep window
All overnight shifts (A/B/C) end by 07:30 IST at the latest. Sweep cron is `0 8 * * *` (08:00 IST) so all shifts have ended before the sweep runs. Sweep targets yesterday's IST date (the shift start date). Overnight guard remains as belt-and-suspenders.
