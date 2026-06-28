---
name: Probation framework templates (dept/role/level)
description: How probation goal templates are keyed/resolved across departments, and the design rules that keep it from regressing legacy healthcare templates
---

Probation goal templates are keyed by structured `department`/`role`/`level` columns
on `plan_goal_templates` (plus `weight`, `milestone`, `is_universal`). Legacy healthcare
templates keep using `role_slug` + `department_scope='healthcare'` with the new columns
NULL — they are NOT migrated and must keep working.

**Resolution rule:** a resolved plan = ALL active `is_universal=true` goals + the single
best-matching role group (scored: exact dept > NULL dept; exact level > 'all'/NULL level),
else fallback to legacy healthcare templates by `role_slug`.
**Why universal+role split:** the framework doc defines 6 universal goals applied to every
plan plus role cards (recruiter assoc/senior, lead_recruiter, account_manager, hr_ops,
marketing), each with Day 30/60/90 milestone goals. Recruiter cards are department-agnostic
(department NULL) so healthcare AND IT recruiters share them.

**Title-parsing precedence is load-bearing (`parseProbationKey`).** Branch order must be:
lead titles (`\blead\b|assistant manager|team lead` → lead_recruiter/lead) FIRST, then
recruiter (incl. "delivery specialist"), then narrow account-manager
(`account manager|delivery manager|key account|\baccount\b`), then marketing, then hr_ops.
**Why:** "Lead Recruiter" contains "recruit" so the recruiter branch would grab it as
recruiter/senior; and a broad `delivery` term once swallowed "Delivery Specialist" into
account_manager. Both = wrong scorecard. Covered by `server/probationTemplates.test.ts` —
keep those cases green.

**New DB objects must be ensured AND in schema.ts.** The probation columns + `probation_scoring_bands`
are created idempotently in `ensureHealthcarePlansTables` (startup) so boot never depends on
`db:push` running first, and are also declared in `shared/schema.ts` so db:push owns them
(per repl schema policy — an ensure-only column would get DELETED by db:push).

**Reference data now in DB tables, flag-gated & revertible.** ALL probation framework
reference data — scoring bands (`probation_scoring_bands`), pass rule (`probation_pass_rule`),
and Day-90 final weights (`probation_final_weights`) — now lives in dedicated DB tables, seeded
idempotently at startup. The legacy JSON copies in `system_settings` (`probation_pass_rule`/
`probation_final_weights`) are STILL seeded as a revert fallback. `GET /api/hr/probation-scoring-bands`
reads via feature flag `probation_framework_db` (default ON via `!== false`): ON → DB tables with
defensive JSON fallback if a table is empty; OFF → JSON. Response shape is unchanged (adds a
`source` field). Flag registered in routes.ts `ALLOWED_FLAGS` + HRSettings flagDefs. Flip OFF to
revert to JSON without code changes.

**Day-90 scoring is 5 dimensions, not 4.** Per TA-head spec the old combined "Quality and
process adherence" is split into separate "Quality" (15) and "Process discipline" (10). Full
set summing to 100: Role output 40, Quality 15, Process discipline 10, "Attendance, reliability,
and communication" 20, "Values, ownership, and coachability" 15. Startup migration in
`server/index.ts` rewrites the legacy `system_settings` JSON and DELETEs+reseeds
`probation_final_weights` rows (gated on the legacy combined row existing). HRSettings renders
weights dynamically so no client edit was needed.

**Probation milestone labels are server-owned, probation-only.** `PROBATION_MILESTONE_LABELS`
{30:"Calibration & Correction",60:"Consistency Check",90:"Confirmation Review"} +
`probationMilestoneLabel()` live in `performanceRoutes.ts`; GET `/api/performance/check-ins`
attaches `milestoneDay`/`milestoneLabel` only for `plan_type='probation'` milestone check-ins
(growth plans also have 30/60/90 milestones but get NO label). Client surfaces re-derive the
same label map from `start_date` + plan_type (CheckIns card/dialog, MyPlanView timeline tooltip,
HRPlansOverview rows) — keep the three client copies of the map in sync with the server.

**Edit/PATCH null semantics** (`PATCH /api/hr/plan-templates/:id`): presence-based, not
COALESCE. Matrix-key fields (department/role/level/weight/milestone) honor explicit null = unset;
content fields preserve on null/absent. **Why:** all-COALESCE made the edit form's "Unset"
options no-ops, so mis-keyed templates could only be fixed by delete+recreate. The inline edit
form must keep dept/role/level/universal controls in sync with the Add form or the gap returns.
