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
(inner join), which naturally excludes pending rows. If you ever need to enforce
"non-pending plans must have employee_id", do it with a partial CHECK constraint
(`status <> 'pending' => employee_id IS NOT NULL`), never a blanket NOT NULL.
