---
name: Plan activation from signed offers/addendums (generalized)
description: How a signed offer-letter/addendum instantiates a real tracked employee_plan of any type (probation/growth/pip), and the goal-category enum trap
---

**Any document can carry an attached plan of any type.** Offers and addendums persist a
nullable plan attachment (type + dept/role/level key); on accept/countersign/onboard a
single generic activation entrypoint instantiates a real tracked plan (plan + check-ins +
template goals). **Why:** previously only growth-clause addendums activated; the engine was
generalized so probation/growth/pip all flow through one idempotent path instead of N
bespoke hooks. **Invariants to preserve:** idempotency key is (employee, planType, window);
activation aborts when zero goals resolve EXCEPT pip (a pip with no template goals is still
a valid empty plan); the legacy growth-from-addendum hook must keep delegating so existing
back-compat/backfill behavior is unchanged. The picker pre-selects the framework-resolved
default but every choice is overridable, so never assume the stored attachment equals the
default.

A signed offer-letter addendum that carries a 90-day growth-plan clause
(`include_growth_plan_clause=true`) now instantiates a REAL, active, fully-tracked
growth `employee_plan` (active status + SOP check-in schedule + template goals) via
`ensureGrowthPlanFromAddendum()` in `server/performanceRoutes.ts`. It mirrors
POST /api/hr/plans so the plan follows the normal SOP (check-in reminders, manager+HR
notifications, escalations driven by the scheduler off check_ins/plans).

**Three call sites, all idempotent:** the accept endpoint, the countersign endpoint
(both in routes.ts, non-fatal try/catch), and a startup backfill in server/index.ts
(`backfillGrowthPlansFromAddendums`, runs post-listen with other seeds). Idempotency
key = (employee, plan_type=growth, start_date, end_date), so all three are safe to run
repeatedly. The backfill is what brings ALREADY-signed growth addendums "into effect"
on the next deploy (the original trigger was an already-countersigned salary-revision
addendum whose growth plan was never instantiated).

**createdBy resolution:** employee_plans.created_by is NOT NULL. Hooks pass the audit
actor / session user. Backfill uses `COALESCE(addendum.issued_by, offer.created_by)`,
falling back to the first super_admin/admin/hr if both are null.

**GOTCHA — goal-category enum mismatch (was a latent bug).** `plan_goal_templates.goal_category`
uses a richer vocabulary than the `performance_goals.category` enum. The enum only allows
`individual|team|company|development`, but templates contain `production` (and could add more).
Inserting a template's raw category into performance_goals throws `invalid input value for
enum performance_goal_category: "production"`. **This affected POST /api/hr/plans too**, not
just the activation engine. Fixed centrally in `insertPlanGoalsFromTemplates` via
`normalizeGoalCategory()` (production→individual; any unknown→individual). Keep all goal-category
writes going through that helper so the enum is never violated.

**Not transactional:** the engine inserts plan → check-ins → goals as separate statements.
A mid-sequence failure (e.g. the enum bug above) leaves a plan+check-ins without goals; the
idempotency guard then reports "exists" on retry rather than completing the goals. Acceptable
given goals now insert cleanly, but if you change goal insertion, consider repair-on-exists.
