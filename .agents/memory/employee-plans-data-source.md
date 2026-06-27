---
name: Employee Plans data source
description: Why the Employee Plans dashboard can legitimately show very few rows, and how probation-extension addendums relate to employee_plans
---

The `employee_plans` table is NOT populated by every probation event. Historically rows
were created in exactly one place: the offer-letter **acceptance** flow, and only when
`offer_letters.seed_probation_plan` is set (then activated at start-onboarding once an
employee_id exists). Probation-**extension** addendums generated via the Letter Generator
(offer-letter-linked and standalone) created an addendum document but never an
`employee_plans` row.

**Consequence:** the Employee Plans dashboard ("Plans Overview" / `GET /api/hr/plans`)
can correctly show only 1–few rows even when many employees went through probation —
because most never had a plan row. The list endpoint already returns ALL statuses
(`WHERE TRUE`, ordered by created_at, LIMIT 200); it is NOT hiding rows by status. So a
"only one plan shows" report is a data-population issue, not a query/filter bug. Verify
against the live DB before assuming a filter bug.

**Fix added:** `ensureProbationExtensionPlan()` in `server/routes.ts` is now called from
both addendum-creation endpoints when `addendumType === "probation_extension"`. It
resolves the employee (directly for standalone `forEmployeeId`, or via an existing
offer-letter-linked plan's `employee_id`), marks any open probation plan as
`status='extended'`, and inserts a new active probation plan for the extension window
(idempotent on employee_id + plan_type + end_date). This is forward-fix only; pre-existing
extensions without plan rows are not backfilled.

**Why:** so extended employees surface in Employee Plans going forward without a risky
historical data migration against prod.
