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
