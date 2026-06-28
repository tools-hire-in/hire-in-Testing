---
name: Coaching log & probation check-in cadence
description: Where coaching notes live and the 8-point probation check-in schedule
---

- Coaching notes are ad-hoc manager/HR observations on an employee_plan, stored in `coaching_log_entries` (planId, employeeId, authorId, note, entryDate). They are NOT plan check-ins and never appear on the PlanTimeline (which filters `check_in_type === "milestone"`).
- The plan detail (`GET /api/hr/plans/:id`) and `GET /api/hr/my-plan` responses carry a `coachingLog` array. Managers add via `POST /api/hr/plans/:planId/coaching-log` (feature key `hr.plans.coachingLog`, MANAGER_ROLES, object-level team/admin gate, note ≥5 chars).
- Probation check-ins cadence is Day 1/7/15/30/45/60/75/90 (8 points), all `check_in_type = "milestone"`. **Why:** aligned to the 90-day probation framework spec (was 4 points: 15/30/60/90). Changing this list in `generatePlanCheckIns` is the single source of cadence.

**How to apply:** new plan-scoped sub-resources can rely on `resolveRoles(key, fallback)` falling back to the passed roles when the key is absent from ACCESS_REGISTRY — no registry migration needed for it to work, but parity stays intact only because the key is absent (not half-registered).
