# Governance Route Authorization Inventory

**Produced by**: Task #1014 — Governance MVP Trust Hardening  
**Date**: 2026-07-13  
**Scope**: All `/api/governance/*` routes registered by `registerGovernanceRoutes()`

---

## Route Inventory

| Method | Route | Data Returned or Changed | Permission Key | Required Row Scope | Current Enforcement | Finding | Action |
|--------|-------|--------------------------|----------------|--------------------|---------------------|---------|--------|
| GET | `/api/governance/my` | Employee's own open obligations + summary counts | Any authenticated user (`getSession`) | `WHERE owner_id = session.userId` in SQL | ✅ Server-side SQL filter | OK — self-scoped by userId in query | No change |
| GET | `/api/governance/manager` | Team's open controls (non-closed/completed) | `governance.manager` | `WHERE manager_id = session.userId` in `getManagerGovernanceControls()` | ✅ Server-side SQL filter | OK — filtered by manager_id; HR/admin role bypass returns only their team | No change |
| GET | `/api/governance/manager/:employeeId` | Specific employee's controls + summary | `governance.manager` | `resolveManagerScopeForEmployee()` → admin_users manager_id check | ✅ Server-side scope check + SQL WHERE owner_id | OK — explicit scope validation before query | No change |
| GET | `/api/governance/admin` | All controls (any status/flagged filter) | `governance.hr` | Full table access for HR role — intentional | ✅ Role permission check | OK — HR role is intended to see all; status/flagged filters are additive query opts | No change |
| GET | `/api/governance/:id` | Single control detail | Any authenticated user | `resolveReadScopeForControl()` — owner OR manager_id match OR HR role | ✅ Server-side scope check added by this task | **CONFIRMED GAP** — route did not exist; added in this task | Added `GET /:id` with `resolveReadScopeForControl()` |
| GET | `/api/governance/:id/events` | Append-only event history for one control | Any authenticated user | Same `resolveReadScopeForControl()` as parent control | ✅ Server-side scope check | **NEW** — route did not exist; added in this task | Added `GET /:id/events` with parent control scope |
| GET | `/api/governance/ceo-report` | Aggregate-only CEO exception report (no PII) | `governance.ceo` | Aggregate query — no individual row scope needed | ✅ Role permission check | OK — returns anonymized aggregates only | No change to authorization; AI payload hardened |
| POST | `/api/governance` | Creates a new governance control | `governance.hr` | Creator must have HR role | ✅ Role permission check | OK | No change |
| POST | `/api/governance/:id/close` | Closes a control; records evidence + resolution | `governance.manager` | `resolveManagerScopeForControl()` — manager_id check or HR bypass | ✅ Server-side scope check | OK | No change |
| POST | `/api/governance/:id/escalate` | Sets status=escalated, flags for HR review | `governance.manager` | `resolveManagerScopeForControl()` — manager_id check or HR bypass | ✅ Server-side scope check | OK | No change |
| POST | `/api/governance/:id/evidence` | Submits evidence record; sets status=in_progress | Any authenticated user | `WHERE id = controlId AND owner_id = userId` in `submitEmployeeEvidence()` | ✅ Server-side SQL scope | OK — owner enforced in service function | No change |
| POST | `/api/governance/:id/dispute` | Sets dispute_note, flags for HR review | Any authenticated user | `WHERE id = controlId AND owner_id = userId` in `disputeGovernanceControl()` | ✅ Server-side SQL scope | OK — owner enforced in service function | No change |
| POST | `/api/governance/:id/review-dispute` | Clears flagged_for_hr_review; sets resolution | `governance.hr` | Full HR access — intentional for HR dispute resolution | ✅ Role permission check | OK — no single-control scope needed; HR sees all disputes | No change |
| POST | `/api/governance/:id/reassign` | Changes owner_id + manager_id on existing control | `governance.hr` | HR role required; `reassignGovernanceControl()` checks control exists and is not closed | ✅ Role check + service validation | **NEW** — added by this task for stable identity support | Added route with HR permission |

---

## Route Classification Summary

| Route | Classification |
|-------|----------------|
| `/api/governance/my` | Employee-self |
| `/api/governance/manager` | Manager/direct-report (aggregate) |
| `/api/governance/manager/:employeeId` | Manager/direct-report (specific employee) |
| `/api/governance/:id` | Employee-self OR Manager/direct-report OR HR-sensitive |
| `/api/governance/:id/events` | Event history (same scope as parent control) |
| `/api/governance/admin` | HR-sensitive |
| `/api/governance/ceo-report` | CEO/Super Admin — Aggregate/reporting |
| POST `/api/governance` | HR-sensitive |
| POST `/:id/close` | Manager/direct-report mutation |
| POST `/:id/escalate` | Manager/direct-report mutation |
| POST `/:id/evidence` | Employee-self mutation |
| POST `/:id/dispute` | Employee-self mutation |
| POST `/:id/review-dispute` | HR-sensitive mutation |
| POST `/:id/reassign` | HR-sensitive mutation (new) |

---

## Authorization Enforcement Pattern

All routes use one of three server-side enforcement patterns:

1. **SQL-level filter** (`WHERE owner_id = userId`, `WHERE manager_id = userId`): Applied in query construction; no frontend filtering relied upon.
2. **Pre-query scope check** (`resolveManagerScopeForControl`, `resolveManagerScopeForEmployee`, `resolveReadScopeForControl`): Separate DB lookup before the main query; returns 403 before any data is fetched if scope is denied.
3. **Role permission check** (`checkPermission` with `resolveRoles`): Uses the centralized access control registry (`shared/accessControl.ts`); does not create a parallel authorization system.

---

## Gaps Identified and Resolved

| Gap | Classification | Resolution |
|-----|----------------|------------|
| No `GET /api/governance/:id` route existed — anyone with a control ID and a valid session could not fetch details, but the missing route also meant no scope enforcement | `CONFIRMED` | Added route with `resolveReadScopeForControl()` |
| CEO AI report payload built from full `reportData` object (not explicit allowlist); `requiredAction` free text sent to external AI | `CONFIRMED` | Replaced with `buildAllowlistedCeoPayload()` — explicit field picking; `requiredAction` excluded from AI payload |
| No event history table | `NOT_FOUND` (new requirement) | Created `governance_events` table and `emitGovernanceEvent()` service |
| No reassignment mechanism — ownership change would create duplicate active control | `CONFIRMED` | Added `reassignGovernanceControl()` function and `POST /:id/reassign` route |

---

## Scope Note on `GET /api/governance/admin`

The `/admin` endpoint returns all controls to HR roles. This is intentional — HR is the oversight function and must be able to see all disputes, flagged records, and escalations regardless of the owning manager. The route enforces `governance.hr` permission, which requires `hr`, `admin`, `executive`, or `super_admin` role. No additional row-level filtering is needed for this endpoint.
