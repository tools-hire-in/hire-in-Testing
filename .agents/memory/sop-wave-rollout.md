---
name: SOP Wave Rollout & Enforcement
description: How the Wave 0-5 SOP rollout, cadence guardrail, and soft/measured/full enforcement model is structured and gated.
---

# SOP Wave Rollout & Enforcement

`server/sopRollout.ts` is the single source for the wave model. `WAVE_DEFS` is the canonical
seed (Wave 0-5 → name/audience/enforcement/SOP-code membership); `seedSopWaves()` seeds
idempotently (ON CONFLICT). Do NOT duplicate wave membership lists elsewhere — edit WAVE_DEFS.

**Wave 5 = all active SOPs.** Its membership is resolved dynamically via
`resolveWaveMembership()` (queries every `is_current` SOP), not a fixed list. So a SOP belongs
to BOTH its launch wave and Wave 5. `buildAssignmentRows` therefore resolves the *strongest
operational+active* membership per SOP (rank soft<measured<full); otherwise the lowest wave for
display. Never assume one membership per SOP.

**Enforcement is a free-text varchar (no DB enum): `soft | measured | full`.**
- soft → coaching only. `SopCoachingBanner` (MySops.tsx, on MyDesk dashboard) nudges for
  operational + (soft|measured) + un-acked. Banner is dismissible via `sessionStorage`
  (reappears next login). Never locks.
- measured → same banner surface as soft (audit visibility), no lock.
- full → folded into the existing **training compliance lock** via
  `getEnforceableOverdueSopsForUser` in onboardingRoutes `getComplianceStatus`. Only full +
  operational + overdue + un-acked count (pure predicate `isSopLockEligible`). Wave 5 seeds `full`.

**Lock is PER-USER, never gate on doc lifecycle enum `active`.** A SOP doc only flips to
lifecycle `active` once EVERY impacted user has acknowledged the current version (acknowledge
route: `allAck` → acknowledged → active). So gating the lock on `lifecycleStatus === "active"`
makes it unreachable for the exact straggler it exists to compel (their non-ack keeps the doc out
of `active`). The spec's word "ACTIVE in a full-enforcement wave" means *operational/live*
(`operationalAt` set on a published SOP), NOT the terminal enum. **Why:** a code review once
pushed the `=== "active"` gate in; it silently killed enforcement — reverted. `buildAssignmentRows`
already excludes non-impacting statuses (draft/in_review/approved/retired) via IMPACTING_STATUSES.

**Why varchar not enum:** lets enforcement values evolve without an enum migration; seed
backfill (UPDATE … WHERE audience IS NULL) repairs pre-model rows once without clobbering admin
changes — `audience IS NULL` is the "not yet migrated" sentinel.

**Cadence guardrail**: `CADENCE_MAX_PER_WEEK=2` operational activations per **calendar week**
(Monday 00:00 → now), NOT a trailing 7-day window — `cadenceWindowCount()` over
`wave_sops.operationalAt`. Wave 0 exempt (waveNumber>=1). Override via `force:true` (route 409
`cadenceBlocked` otherwise), audit-logged `sop_operational_cadence_override`.

**Activating a wave PUBLISHES its SOPs** (routes.ts wave-activate handler): for each member
whose current doc is `approved`, run setSopLifecycleStatus published + `assignSopTraining` +
training_assigned (drafts/in-review skipped; already-published untouched). Activation ≠
operational — `operationalAt` (employee-visible/enforced clock) is still a separate per-SOP step
behind the cadence guardrail.

**Access gating (critical)**: all employee-facing enforcement goes through
`resolveSopAccessForUser` so users *outside the rollout pilot* are never locked out. Wave-mgmt
endpoints require `sops.rollout` (super_admin/admin only).

**Grace**: `SOP_ACK_GRACE_DAYS=15` from operationalAt before an un-acked SOP is "overdue".
