---
name: Pending changes guardrail
description: How automated jobs avoid clobbering user-entered attendance/leave/salary data
---

Automated/scheduled jobs that could overwrite human-entered values must PROPOSE into the
`pending_changes` store instead of writing directly. A Super Admin reviews and approves
(applies transactionally + audit log) or rejects (discards). Nothing auto-applies.

**Why:** users were losing manually-entered attendance to the nightly absent sweep.

**How to apply:**
- Guardrailed today: the end-of-day absent sweep (`runAbsentSweep` in server/scheduler.ts)
  calls `storage.proposePendingChange(...)`, never inserts attendance.
- EXEMPT (may keep writing directly because additive + idempotent, never clobbering a typed
  value): monthly leave accrual, year-end carry-forward/lapse batch, holiday/weekend stamping,
  per-shift grace-zero normalization, salary report run creation (saved pending_approval).
  Startup ensure/`CREATE ... IF NOT EXISTS` blocks are no-clobber and re-run-safe.
- Dedupe: uniqueIndex `uq_pending_change_dedupe` on (sourceJob, targetUserId, targetTable,
  runDate, field) + onConflictDoNothing makes re-runs idempotent and never resurrects a
  reviewed proposal.
- Approve re-checks no attendance row was created after the proposal (stale guard) inside a
  `db.transaction` with `.for("update")`.
- Endpoints are strictly super_admin (`requireSuperAdmin`, not requireAdminLevel which
  auto-grants admin): /api/admin/pending-changes[/count|/:id/approve|/:id/reject|/bulk-approve|/bulk-reject].
- UI: client/src/pages/admin/AutomatedChanges.tsx ("Automated Changes" nav, super-admin only).
- To guardrail a NEW job: propose with a payload the approve handler understands, then extend
  the `approvePendingChange` apply switch (currently only handles targetTable "attendance").
