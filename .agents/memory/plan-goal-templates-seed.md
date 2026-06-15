---
name: Plan goal templates seed
description: How the plan_goal_templates seed works, and how to update existing rows without breaking the idempotent design.
---

## Rule
The seed in `server/index.ts` uses `ON CONFLICT (plan_type, role_slug, goal_title) DO NOTHING`.
This means it only ever inserts rows that don't exist yet — it never overwrites admin edits or custom templates.

**To fix/update existing rows** (e.g. correcting target_metric values to match a doc), add an explicit UPDATE loop *before* the seed's INSERT loop, like the `pipMetricUpdates` block added for the PIP roles. The WHERE match on the old value is optional; matching only on plan_type + role_slug + goal_title is safest.

## Why
The design deliberately preserves admin-edited templates across restarts. Changing to DO UPDATE would silently clobber any HR admin customizations.

## How to apply
- New goals → add to the `templates` array; seed inserts them on next restart.
- Correcting existing goal fields → add a named UPDATE array before the INSERT loop in the same try block.
- Removing old/replaced goals → add a DELETE block (see the `oldFoundationTitles` example in the same file).

## Current state (as of June 2026)
102 rows total across 18 (plan_type × role_slug) combinations:
- Probation: 6 roles × ~4-5 goals each
- PIP: 6 roles × 5-6 goals each (metrics match the uploaded "Healthcare PIP Plans by Role" doc)
- Growth: 6 roles × 5-19 goals each (foundation_to_senior has 19 phase-specific goals)

## Meta endpoint
`GET /api/hr/plan-templates/meta?department_scope=healthcare` returns distinct
`{plan_type, role_slug, department_scope}` rows — used by the frontend
`LoadFromTemplateDialog` to build a DB-driven role dropdown (no hardcoded list).
