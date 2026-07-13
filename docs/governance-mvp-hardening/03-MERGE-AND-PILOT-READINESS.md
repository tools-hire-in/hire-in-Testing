# Merge and Pilot Readiness Assessment

**Task**: #1014 — Governance MVP Trust Hardening  
**Date**: 2026-07-13  
**Reviewer**: Task Agent — Evidence-based, no assumptions

---

## Summary Judgements

| Question | Answer |
|----------|--------|
| Task #1013 + #1014 safe to merge? | **YES — with limitations documented below** |
| Authorization exposure remaining? | **No unmitigated exposure** — one intentional full-table HR read; all other routes row-scoped |
| External AI payloads allowlist-only? | **YES** — `buildAllowlistedCeoPayload()` enforces explicit field picking; `auditPromptForPII()` retained as defense-in-depth |
| Reassignment creates duplicate controls? | **No** (for synced controls) — new unique index + `(type, ref_id)` idempotency key prevent duplicates. Manual controls (no ref_id) can still duplicate — limitation documented. |
| Event history operational? | **YES** — `governance_events` table created; events emitted at all key transitions |
| CEO report semantics corrected? | **YES** — all three corrections applied (A, B, C) |
| Healthcare shadow pilot recommended? | **YES — with one precaution** (see below) |
| Any blockers to merge? | **None critical** |
| Any blockers to shadow mode? | **None critical** |

---

## Explicit Recommendation

```
READY_TO_MERGE_WITH_LIMITATIONS
READY_FOR_SHADOW_PILOT
```

---

## Authorization Exposure Assessment

### Routes with confirmed adequate enforcement

| Route | Enforcement Level | Verified |
|-------|-------------------|---------|
| `GET /api/governance/my` | SQL WHERE owner_id | ✅ |
| `GET /api/governance/manager` | SQL WHERE manager_id + role check | ✅ |
| `GET /api/governance/manager/:employeeId` | Pre-query scope check + role check | ✅ |
| `GET /api/governance/:id` | `resolveReadScopeForControl()` (added this task) | ✅ |
| `GET /api/governance/:id/events` | Same as parent control (added this task) | ✅ |
| `GET /api/governance/admin` | HR role required — intentional full access | ✅ |
| `GET /api/governance/ceo-report` | CEO role required — aggregate only | ✅ |
| POST mutations | Manager scope + HR role as appropriate | ✅ |

### Remaining intentional full-table reads

`GET /api/governance/admin` returns all controls to users with `governance.hr` permission. This is by design — HR oversight requires visibility into all escalations and disputes. Not an exposure.

---

## External AI Payload Assessment

**Before this task**: Payload built by direct projection of `reportData`, including `highPriority` items with `requiredAction` free text (redacted by `redactFreeTextForAI()`, but still text).

**After this task**:
- `buildAllowlistedCeoPayload()` constructs payload by **explicit field picking** from an approved-fields interface.
- `requiredAction` and `description` fields are **excluded by construction** — they are not in the `CeoAiPayload` interface.
- `auditPromptForPII()` check retained before every AI call — fails closed (aborts AI call, not request).
- Deterministic fallback narrative is always set before the AI call — the CEO report is never blank if AI fails.
- AI system prompt explicitly instructs: "Disputed controls are NOT confirmed noncompliance."

---

## Duplicate Control Risk Assessment

**Synced controls** (reference_id set): Protected by partial unique index `idx_gc_ref_identity ON governance_controls(control_type, reference_id) WHERE reference_id IS NOT NULL AND status NOT IN ('closed','completed')`. Idempotency check updated to match.

**Manual controls** (no reference_id): No uniqueness constraint. HR users could create two controls of the same type for the same employee. Risk is low in practice (HR UI would require intentional duplicate creation). Mitigation: UI validation recommended as follow-up.

---

## Event History Assessment

- `governance_events` table created with FK to `governance_controls`.
- Events emitted at: `created`, `sync_updated`, `status_changed`, `evidence_submitted`, `disputed`, `escalated`, `closed`, `reassigned`.
- Authorization: event reads gated by same `resolveReadScopeForControl()` as the parent control.
- Non-fatal: event write failures do not block primary operations.
- **Limitation**: No events for controls created before this deployment. Event history is forward-only.

---

## CEO Report Semantic Corrections

### A. Missing active source goal vs missing governance control

**Before**: Single query for "employees without goal governance control." No distinction from employees who have goals but no control.  
**After**: Two separate exception categories:
1. "Employees without Active Goal Controls" — employees with no open goal governance control (coverage gap in tracking).
2. "Active Goals Missing Governance Controls" — performance_goals records with no corresponding governance control (obligation exists, not tracked).

### B. Overdue obligations vs explicit blockers

**Before**: "Repeated Unresolved Blockers" derived from count of overdue/escalated (included disputed controls in the count).  
**After**:
- "Multiple Overdue Obligations (Pattern)" — employees with 2+ overdue/escalated controls WHERE `dispute_note IS NULL` (non-completion pattern).
- `employeesWithExplicitBlockers` — employees who have raised disputes (employee-reported concerns, not confirmed noncompliance).
- These two dimensions are tracked independently in `semanticSummary`.

### C. Disputed vs confirmed

**Before**: Disputed controls were indistinguishable from confirmed noncompliance in the CEO report. No field for disputed count. AI prompt contained no guidance on disputed status.  
**After**:
- `totalDisputed` field counts controls with `dispute_note IS NOT NULL`.
- `confirmedNonCompliance = max(0, totalOverdue + totalEscalated - totalDisputed)` — conservative (excludes disputed from confirmed count).
- "Controls Under Dispute" exception category explicitly labelled: "These are NOT confirmed noncompliance."
- AI system prompt contains: "CRITICAL: Disputed controls are NOT confirmed noncompliance — clearly distinguish them."

---

## Blockers to Merge

**None.** All six approved scope items are addressed or documented with evidence.

---

## Blockers to Shadow Mode

**None critical.**

**Recommended precaution for Healthcare shadow pilot**:

The `idx_gc_ref_identity` unique index is created at startup. If any reference_id duplicates exist from prior testing of Task #1013 (e.g., test data from sync runs), the index creation will fail silently (wrapped in try/catch) and the startup log will show an error. Before shadow pilot, verify with:

```sql
SELECT control_type, reference_id, COUNT(*) 
FROM governance_controls 
WHERE reference_id IS NOT NULL 
  AND status NOT IN ('closed','completed')
GROUP BY control_type, reference_id
HAVING COUNT(*) > 1;
```

If any rows are returned, they should be reviewed and one set closed before the shadow pilot begins.

---

## Limitations Accepted for Pilot

1. **Manual control deduplication**: HR-created controls with no reference_id can be duplicated. Low risk for shadow pilot (small cohort, HR oversight of creation).
2. **No event backfill**: Pre-deployment controls have no event history. Forward-only audit trail is adequate for a shadow pilot.
3. **Per-type escalation in static config**: Changing escalation thresholds requires a deployment, not a settings change. For shadow pilot, defaults are appropriate.
4. **`confirmedNonCompliance` approximation**: Conservative — may under-count genuine noncompliance where a dispute is later found invalid. Acceptable for shadow pilot; HR reviews all flagged disputes.

---

## Files Changed Summary

| File | Change |
|------|--------|
| `server/governanceRoutes.ts` | Added `GET /:id`, `GET /:id/events`, `POST /:id/reassign`; event emission on escalate/review-dispute/create |
| `server/governanceService.ts` | Updated idempotency key; added `reassignGovernanceControl()`; per-type escalation sweep; CEO report semantic corrections; event emission throughout |
| `server/governanceEvents.ts` | New — append-only event recorder service |
| `server/services/aiPrivacyGuard.ts` | Added `buildAllowlistedCeoPayload()` and `CeoAiPayload` interface |
| `server/scheduler.ts` | CEO report uses `buildAllowlistedCeoPayload()`; deterministic fallback narrative; updated AI system prompt |
| `server/index.ts` | Added `governance_events` table ensure block; added `idx_gc_ref_identity` unique index ensure |
| `shared/schema.ts` | Added `governanceEvents` table, `governanceEventSourceEnum`, `governanceEventTypeEnum` |
| `server/governance.test.ts` | New — 21 focused tests for hardening items |
| `docs/governance-mvp-hardening/` | New — three required deliverable documents |
