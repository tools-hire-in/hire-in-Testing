---
name: employee_plans.employee_id is nullable by design
description: Why employee_plans.employee_id must stay nullable, and the publish-migration trap if it isn't.
---

# employee_plans.employee_id must stay nullable

A pending `employee_plans` row is seeded at **offer acceptance** with
`employee_id = NULL` (and `manager_id = NULL`, `status = 'pending'`). The real
`employee_id` is backfilled later at **onboarding/activation**, when the pending
row is located by `offer_letter_id` + `status = 'pending'`.

**Why:** the candidate has no `admin_users` record until they are onboarded, so
the plan template attached to the offer has to be persisted against the offer,
not a person, until then.

**The trap:** if `shared/schema.ts` declares `employeeId.notNull()`, the Replit
Publish migration generates
`ALTER TABLE "employee_plans" ALTER COLUMN "employee_id" SET NOT NULL;`
which FAILS in production the moment any unaccepted/pending plan exists
(`column "employee_id" ... contains null values`). A read-replica spot check can
show 0 NULLs one day and fail the next, because pending plans accumulate as offers
are accepted. Do NOT "fix" this by backfilling/deleting the NULL rows — they are
legitimate pending plans.

**How to apply:** keep `employeeId` nullable in schema.ts. Reads that should only
see activated plans already use `JOIN admin_users emp ON ep.employee_id = emp.id`
(inner join), which naturally excludes pending rows. Never use a blanket NOT NULL.

**The invariant is now enforced** by a partial CHECK constraint
`ck_employee_plans_nonpending_has_employee` = `status = 'pending' OR employee_id IS NOT NULL`
(table-level `check()` in schema.ts). Consequences for future work:
- A NULL-employee placeholder may ONLY be in `status = 'pending'`. To dispose of an
  orphan placeholder you must **DELETE it, never transition it** to closed/cancelled/
  any non-pending status — that would violate the CHECK and 500. Placeholders have no
  check-ins/goals (those seed only at activation), so deletion has no dependents
  (no FK from check_ins.plan_id / performance_goals.plan_id either).
- Any code path that sets `employee_plans.status` must pre-check: refuse non-pending
  when employee_id is NULL (the `/api/hr/plans/:id` PATCH returns 400 for this).
- Orphan placeholders (offer cancelled/withdrawn/missing, or start_date >60d past)
  are swept/deleted: immediately at offer cancel+withdraw, and daily in the 9AM IST
  signing-reminder cron in scheduler.ts.
