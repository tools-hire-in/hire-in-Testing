---
name: SOP A/R/C Training Levels
description: Machine-readable Awareness/Required/Certification training depth for SOPs, role-group wiring, quiz player level gating, and evidence submission flow.
---

## System Overview
Each SOP assignment now carries a depth level: `awareness | required | certification | optional_reference`.

## Role Group Resolver
`resolveTrainingGroups(user)` in `server/sopAssignmentEngine.ts` maps role+dept to 13 business group keys:
- CEO-SuperAdmin, Managers-All, TA-Recruiter, Ops-HR, Finance-Team (role-based)
- Healthcare-Team, IT-Team, Engineering-Prof-Services-Team, Sales-AM, BD-Team, Marketing-Team (dept-based)
- ALL (always included)
Highest-wins across all matching groups.

## DB Columns (via ensureSopArcSchema, must run before seedUniversalPolicies)
- `sop_role_assignments`: assignment_level, assignment_reason, role_group_key, department_key, applies_to_all
- `track_assignments`: assignment_level, assignment_reason, source_sop_role_assignment_id, resolved_role_group, required_question_count, required_pass_score, evidence_required, manager_signoff_required, manager_signoff_status, sop_code, sop_version
- `section_quiz_questions`: include_for_awareness
- New table: `training_evidence_submissions` (submit + review flow)

## Level Parameters (LEVEL_PARAMS in sopAssignmentEngine.ts)
| Level | Questions | Pass% | Evidence | Mgr Signoff |
|---|---|---|---|---|
| awareness | 5 | 70% | No | No |
| required | 8 | 80% | No | No |
| certification | 8 | 85% | Yes | Yes |
| optional_reference | 0 | 0% | No | No |

## Quiz Awareness Filtering
In `/api/onboarding/assignments/:id` (onboardingRoutes.ts): for awareness-level assignments, sections with quiz questions where `include_for_awareness=false` have their quiz hidden (quiz=null).

## Evidence Flow
- POST `/api/training/evidence` — employee submits evidence (returns submissionId)
- GET `/api/training/evidence/:trackAssignmentId` — employee checks review status
- PATCH `/api/training/evidence/:submissionId/review` — HR/admin/manager reviews (approved | resubmit_requested)

## WaveImpactDrawer
PreviewEmployee now has `sopLevels: Record<string,string>` (sopCode→level). A/R/C badges render inline next to each SOP code chip in the employee table.

## Seeder
`seedSopLibrary` in server/index.ts: ON CONFLICT (sop_master_id, role) DO UPDATE now sets all new group/level fields. The new unique index `sop_role_assignments_master_group_unique` on (sop_master_id, role_group_key) supports idempotent group upserts.

## Critical Enforcement Rules
- **Certification completion is DOUBLY gated**: (1) auto-complete in section acknowledge skips if `managerSignoffStatus !== 'approved'`; (2) explicit `/complete` endpoint returns 400 `SIGNOFF_REQUIRED` if not approved. UI gate alone is not sufficient.
- **Evidence review manager scoping**: `PATCH /evidence/:id/review` for `manager` role checks `admin_users.manager_id = reviewerId` before allowing review; HR/admin can review anyone's.
- **Evidence approval auto-completes**: On `approved`, endpoint checks if all sections are acknowledged and auto-advances to `completed` + fires `sop_certification_approved` notification.
- **optional_reference inserts as `not_required`** status (no notification sent).
- **Certification quiz**: only passes on correct answer (no 3-attempt auto-pass like required/awareness).
- **Awareness quiz**: sections with `include_for_awareness=false` return `quiz: null` so player skips them.

## DB Constraints (added to ensureSopArcSchema)
- FK: `training_evidence_submissions.track_assignment_id` → `track_assignments(id)` ON DELETE CASCADE
- Partial unique index: `track_assignments_sop_idempotent ON track_assignments(user_id, track_id, sop_code) WHERE sop_code IS NOT NULL`

**Why:** ensureSopArcSchema must run before seedUniversalPolicies (seedUniversalPolicies may reference sop_role_assignments which now has NOT NULL DEFAULT column).
