# Hardening Evidence Report

**Task**: #1014 — Governance MVP Trust Hardening  
**Date**: 2026-07-13  
**Status**: Implementation complete — ready for CEO merge review

This report is the primary merge-review artifact. It covers all six approved scope items, evidence of the defect or gap, changes applied, and remaining limitations.

---

## Scope Item Results

| Item | Verification Status | Evidence | Files Changed | Behavior Before | Behavior After | Tests Added | Remaining Limitation |
|------|---------------------|----------|---------------|-----------------|----------------|-------------|----------------------|
| 1. Governance GET-route row-level authorization | `CONFIRMED` (partial gap) | No `GET /api/governance/:id` single-control detail route existed. Evidence/dispute routes were already owner-scoped at the service layer. Manager team routes were already manager_id-filtered. | `server/governanceRoutes.ts` | Any authenticated user with a control ID had no route to fetch details (404). Employee could not directly confirm their own control details. | `GET /:id` now enforces owner OR manager_id OR HR role via `resolveReadScopeForControl()` before querying. `GET /:id/events` applies the same check. | Yes — 4 access-control role resolution tests in `server/governance.test.ts` | `GET /admin` returns all records to HR roles — intentional. No filtering by department for HR. Documented. |
| 2. Structured allowlisted payload for CEO AI report | `CONFIRMED` | `scheduler.ts` L1593-1601 built `anonymizedSummary` by directly projecting `reportData` fields including `highPriority` items that contain `requiredAction` (free text after `redactFreeTextForAI`). Free text, even partially redacted, should not reach external AI via any path. | `server/services/aiPrivacyGuard.ts`, `server/scheduler.ts` | Payload built by manual projection of `reportData`; `requiredAction` text included (post-redaction); `description` fields from exception categories included. | Payload built by `buildAllowlistedCeoPayload()` — explicit field picking. `requiredAction` and `description` excluded. Only: `controlType`, `roleCategory`, `department`, `daysOverdue`, `escalationLevel`, `status`. `auditPromptForPII()` check retained as defense-in-depth. Deterministic fallback narrative always set before AI call. | Yes — 6 allowlist enforcement tests in `server/governance.test.ts` | `requiredAction` for synced controls is template text ("Complete assigned training...") — low risk regardless. Human-created control free text is excluded. |
| 3. Per-control-type escalation configuration | `PARTIALLY_CONFIRMED` | Single `governance_escalation_hours` system_setting applied identically to all types. Inspected `runGovernanceEscalationSweep()` — confirmed single threshold, no per-type differentiation. | `server/governanceService.ts` | Global 48h threshold for all control types. PIP and probation escalated at same rate as goals. | `DEFAULT_ESCALATION_POLICIES` typed constant with per-type config for all 6 types. Sweep loops per-type and applies per-type thresholds. System_settings overrides supported via key pattern `governance_escalation_{type}_{field}`. | Yes — 5 escalation policy tests | Per-type config is a static constant with system_settings override, not a DB table. A DB table was not needed and would have added schema complexity. No general-purpose rules engine built. |
| 4. Stable governance-control identity across ownership reassignment | `PARTIALLY_CONFIRMED` | Idempotency check in `createGovernanceControl()` used `(control_type, reference_id, owner_id)` — so changing `owner_id` would create a new control for the same source obligation. No reassignment mechanism existed. No DB-level unique constraint existed (application-level only). | `server/governanceService.ts`, `server/index.ts`, `server/governanceRoutes.ts` | Ownership change (rare in practice) would create duplicate active control. Source obligation identity not separated from current owner. | Idempotency check now uses `(control_type, reference_id)` — owner is mutable, not identity. DB partial unique index added: `CREATE UNIQUE INDEX idx_gc_ref_identity ON governance_controls(control_type, reference_id) WHERE reference_id IS NOT NULL AND status NOT IN ('closed','completed')`. `reassignGovernanceControl()` function preserves evidence, disputes, and audit trail. `POST /:id/reassign` route added for HR. | Yes — 1 reference_id format test | Index covers only reference_id-keyed (synced) controls. Manually-created controls (reference_id IS NULL) have no uniqueness constraint — two manual controls of the same type can be created for the same employee. Documented. |
| 5. Minimum append-only governance event history | `NOT_FOUND` (new) | No `governance_events` table existed in schema, index.ts, or schema.ts. | `shared/schema.ts`, `server/index.ts`, `server/governanceEvents.ts`, `server/governanceService.ts`, `server/governanceRoutes.ts` | No event history existed. All status transitions were silent. | `governance_events` table created (append-only). Events emitted for: created, sync_updated, status_changed (overdue, closed, escalated), evidence_submitted, disputed, reassigned. `GET /:id/events` route returns history to authorized users. | Yes — 2 event type/source tests | No replay, projection, or event-sourcing. Table is audit-only. Events are non-fatal (emitted in `.catch(console.error)` so primary operation never blocked). Old controls created before this task have no historical events (no backfill — event history is forward-only). |
| 6. Three CEO-report semantic corrections | `CONFIRMED` | A: `buildCeoReportData()` queried employees with no goal *control* but labelled it as missing goal. No query for goals without controls (inverse). B: "Repeated Unresolved Blockers" derived from count of overdue/escalated, conflating non-completion with employee-raised blockers. C: Disputed controls (dispute_note set) not separated from confirmed noncompliance in report. AI prompt contained no instruction to distinguish disputed from confirmed. | `server/governanceService.ts`, `server/scheduler.ts` | A: Only "no goal control" reported. B: Single "Repeated Unresolved Blockers" bucket mixed patterns with disputes. C: Disputed controls counted in same escalated/overdue totals with no separation. | A: Two separate queries: employees without goal governance control AND active goals without corresponding control. B: "Multiple Overdue Obligations" excludes disputed controls (`dispute_note IS NULL`). Separate `employeesWithExplicitBlockers` count. C: `totalDisputed` field. `confirmedNonCompliance = max(0, totalOverdue + totalEscalated - totalDisputed)`. "Controls Under Dispute" exception category added. AI system prompt explicitly instructs not to describe disputed records as confirmed noncompliance. | Yes — 4 semantic correction tests | `confirmedNonCompliance` formula is approximate (subtracts all disputed from overdue+escalated). A disputed control that is also genuinely overdue is removed from confirmed count — this is the conservative/safe direction (avoids false positive noncompliance claims). |

---

## Items Skipped

None. All six approved scope items were addressed.

---

## Items Hard-Stopped

None. No hard-stop criteria were triggered.

---

## Assumptions Avoided

| Assumption Avoided | Evidence Basis Instead |
|--------------------|------------------------|
| "Manager team endpoint returns all controls" | Inspected `getManagerGovernanceControls()` — confirmed SQL `WHERE manager_id = session.userId` |
| "Existing identity key is (type, ref_id)" | Inspected `createGovernanceControl()` — found key was `(type, ref_id, owner_id)` |
| "AI prompt was already allowlist-only" | Inspected `scheduler.ts` L1593-1601 — found direct projection with `requiredAction` |
| "Event history table existed" | Searched schema.ts and server/index.ts — confirmed not present |

---

## Schema Changes

| Change | Type | Risk |
|--------|------|------|
| Added `governance_event_source` enum | New PostgreSQL ENUM type | Low — IF NOT EXISTS guard |
| Added `governance_event_type` enum | New PostgreSQL ENUM type | Low — IF NOT EXISTS guard |
| Added `governance_events` table | New table | Low — CREATE TABLE IF NOT EXISTS; append-only |
| Added `idx_gc_ref_identity` partial unique index | New unique index on `governance_controls(control_type, reference_id)` WHERE reference_id IS NOT NULL AND status NOT IN ('closed','completed') | **Medium** — could fail if duplicate active controls exist for the same reference_id. Expected to succeed on fresh data (Task #1013 not yet merged to production). |
| Added `GovernanceEvent` type and enums to `shared/schema.ts` | Schema type only | Low — no migration needed; ensure block handles DDL |

---

## Migration Risks

| Risk | Assessment | Mitigation |
|------|------------|------------|
| `idx_gc_ref_identity` unique index fails on duplicate active ref_ids | **Low** — governance is newly implemented; unlikely to have duplicates in production | Ensure block wrapped in try/catch; startup continues even if index creation fails |
| `idempotency check` changed from (type, ref_id, owner_id) → (type, ref_id) | **Low** — only affects future sync runs; existing records unaffected | Change is application-level; DB constraint enforces the new identity rule going forward |
| `governance_events` FK to governance_controls | **None** — all emits reference valid control IDs at emit time | Events are non-fatal; FK violation would fail silently in `.catch()` |

---

## Known Limitations

1. **Manual control deduplication**: Controls created without a `reference_id` (HR-manual) have no uniqueness constraint. Two HR users could create duplicate controls for the same employee and type. Mitigation: HR-created controls require explicit selection of employee and type; UI validation recommended.
2. **No event backfill**: Controls created before this task have no historical events. Event history is forward-only from the date of deployment.
3. **confirmedNonCompliance approximation**: The formula `max(0, totalOverdue + totalEscalated - totalDisputed)` counts all disputed controls as non-confirmed, even if the dispute is later resolved as invalid. This is the safe direction (avoids false noncompliance claims).
4. **Per-type escalation config in static constant**: Policies are in code, not in a DB-managed table. Changes require a deployment. This is intentional — no general-purpose policy engine was built per task scope.
5. **`GET /admin` has no row-level scope**: Returns all controls to HR role. Correct by design — HR is the oversight function.

---

## Test Summary

**File**: `server/governance.test.ts`  
**Runner**: `node:test` (consistent with other server tests in this repo)  
**Run command**: `npx tsx --test server/governance.test.ts`

| Test Group | Count | Coverage |
|-----------|-------|---------|
| AI allowlist enforcement | 6 | `buildAllowlistedCeoPayload`, `auditPromptForPII`, `buildAnonymizedControlSummary`, `sanitizeObjectForAI`, `sanitizeEmployee`, `redactFreeTextForAI` |
| CEO report semantic corrections | 4 | confirmed vs disputed separation, explicit blockers vs multiple-overdue, exception category labels |
| Escalation policy structure | 5 | all 6 types present, PIP/probation faster escalation, recipient levels, CEO threshold, required fields |
| Access control role resolution | 3 | governance.manager, governance.hr, governance.ceo role lists |
| Control identity / reference_id format | 1 | all source prefixes |
| Event type / source completeness | 2 | all required event types, all required sources |
| **Total** | **21** | |
