---
name: Pending plan engine
description: Plans (probation/growth/PIP) are created as pending with NULL dates at document signing; managers activate them with a chosen start date.
---

# Pending Plan Engine

## The Rule
Plans created via `ensurePlanFromDocument` start with `status='pending'`, `start_date=NULL`, `end_date=NULL`. Check-ins, governance controls, and goal target_dates are seeded only when a manager calls `POST /api/hr/plans/:id/activate`.

**Why:** Prevents plans from starting "in the past" when a manager signs off on a document weeks after it was issued. Gives the manager deliberate control over when the clock starts.

## How to Apply
- `ensurePlanFromDocument` — creates pending plan, seeds goals with NULL dates, skips check-ins/governance
- `POST /api/hr/plans/:id/activate` — sets start_date+end_date, seeds check-ins, updates goal target_dates from `plan_goal_templates.due_day_offset`, registers governance control, notifies employee, briefs manager
- `PATCH /api/hr/plans/:id/acknowledge-pip` — HR/Admin only; sets `pip_hr_acknowledged_at`; required before PIP activation
- `briefManagerOnce` — safe to call after activation because it reloads the plan fresh from DB (dates will be populated)

## Idempotency
`ensurePlanFromDocument` deduplicates by:
1. `offer_letter_id` match (primary, for document-triggered plans)
2. Legacy date-window match (`start_date + end_date`) for plans created before this flow change

## Schema Changes Made (applied via SQL migration)
- `employee_plans.start_date` — nullable (was NOT NULL)
- `employee_plans.end_date` — nullable (was NOT NULL)
- `employee_plans.pip_hr_acknowledged_at` — new TIMESTAMPTZ column
- `plan_goal_templates.due_day_offset` — new INTEGER; NULL = due at plan end_date

## Back-Compat
- `backfillProbationCadence` in `probationEngine.ts` already filters `status = 'active'` — safe
- Existing active plans (pre-change) are unaffected; their dates are non-null
- `computePlanPhases` in MyTeam.tsx receives `effectiveStartDate = plan.start_date ?? todayStr()` for pending plans to avoid crashes
