---
name: SOP / Process Governance Center foundation
description: Two-tier gate, version-control clone rule, and seed/idempotency conventions for the SOP library.
---

# SOP / Process Governance Center

Master surface lives at `/admin/sops`. Data: `sop_documents` + child tables
(`sop_role_assignments`, `sop_employee_progress`, `sop_audit_records`,
`sop_audit_findings`). Child tables link by **`sopMasterId` (the SOP code string)**,
NOT the row UUID — a SOP "master" spans many version rows.

## Two-tier feature gate (mirrors new_look)
- Tier 1 master: `system_settings.feature_flags.process_governance` boolean.
- Tier 2 rollout: `system_settings.process_governance_rollout` =
  `{ mode:'pilot'|'all', roles[], userIds[] }`.
- Server resolves both in `resolveSopAccess` (server/routes.ts SOP block). Client
  never re-implements the gate — it reads `GET /api/sops/access` via
  `useSopAccess()`. super_admin/admin are ALWAYS in scope when master is ON.
- **Why:** governance owners must manage the library during a pilot even if their
  role isn't in the pilot roles list.

## Version-control clone rule (the core invariant)
- `lifecycleStatus` of `published` or `active` is LOCKED. Editing a locked version
  does NOT mutate it — `updateSopDocument` clones a new **draft** row at
  `version+1`, supersedes the old, and returns `{ doc, clonedNewVersion:true }`.
- Any other status edits in place.
- **How to apply:** the PATCH route returns `clonedNewVersion`; the UI must tell the
  user a new version was started rather than silently editing.

## Seed conventions
- `seedSopLibrary()` in server/index.ts seeds 21 SOPs (GOV-001..TPL-001) + role
  assignments from `server/sopSeedData.ts`. Idempotent via
  ON CONFLICT (sop_master_id, version)/(sop_master_id, role) DO NOTHING.
- Seed strings must be **plain ASCII** (no ×, em dash) or ON CONFLICT mismatches —
  see seed-unicode-pitfall.md.

## Governance lifecycle, review flow & training gate
- Lifecycle service is `server/sopGovernance.ts` (pure, unit-tested) — NOT a new
  engine; it sits on `sop_documents` versioning + `sop_review_assignments` +
  signature ledger. `TRANSITIONS` map is the legal-order source of truth;
  `published→acknowledged` is intentionally legal for SOPs with no linked track.
- Reviewer SLA = 5 business days (`addBusinessDays`). `evaluateApprovalGate`
  returns TWO distinct, never-conflated signals: `strictApprove` (all reviewers
  positively signed off, none pending, none blocking — SLA-independent) and
  `noObjectionEligible` (no blocking, but every outstanding reviewer is overdue).
  Auto-advance to `approved` in /review-action MUST use `strictApprove` ONLY.
  `noObjectionEligible` is a privileged override consumed SOLELY in /publish and
  ONLY after the override-role check. **Why:** if the overdue path could
  auto-approve, reviewers merely lapsing their SLA would push a SOP to `approved`,
  and any `sops.manage` user could then publish from `approved` with no override
  check — bypassing the CEO/Super-Admin-only no-objection control.
- Override (super_admin/admin) power is PUBLISH-ONLY: a no-objection force-publish
  from in_review. It must NOT let them record a reviewer decision on another
  reviewer's behalf — review-action accepts only the caller's own pending
  assignment. **Why:** impersonating reviewer decisions corrupts the approval trail.
- Review rounds: each (re)submit opens a new `round` on sop_review_assignments;
  the approval gate evaluates ONLY the latest round (`latestRound()` in
  sopGovernance.ts). **Why:** without round-scoping a prior round's
  changes_requested permanently blocks a resubmitted version — the
  CHANGES_REQUESTED→IN_REVIEW→APPROVED loop breaks. Apply at every gate site
  (/reviews, /review-action, no-objection /publish).
- Acknowledgment is ledger-backed AND version-bound: `documentType:'sop'`,
  `documentId='<sopMasterId>:<version>'`. Gated on the linked track reaching
  `completed` in `track_assignments` for that user. Auto-advance to
  acknowledged→active requires every CURRENTLY-impacted user
  (`impactedUserIdsForSop`) to have acked THIS version (progress.sopVersion ===
  current). **Why:** progress rows are unique on (master,user) and survive new
  versions, so a v1 ack must NOT satisfy a v2 publish; intersecting with the live
  impacted set also drops stale rows for users who changed roles out of scope.
- Role-based impact projection: `server/sopAssignmentEngine.ts`
  `syncSopProgressForUser(userId, role)` is called fire-and-forget from PATCH
  `/api/admin/users/:id` on role change; `upsertSopEmployeeProgress` keys on
  (master,user) NOT version so role churn never duplicates. Backfill via POST
  `/api/sops/assignments/sync`.
- Publish auto-assigns training filtered through `getSopRolloutScope()` — users
  outside the pilot get a progress row but NO track assignment/notification, so a
  later rollout-expand + sync picks them up. **Why:** rollout gate must suppress
  notifications for out-of-pilot users, not just hide the UI.
