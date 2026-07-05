---
name: Salary adjustment flow has two frontends
description: The record/approve salary-adjustment UI exists in two places sharing one backend; field changes must be mirrored.
---

The "salary adjustment" (salary advance / overpayment / salary_credit) record+approve
UI is implemented **twice**, both hitting the same backend endpoints
(`POST /api/salary-advances/backfill`, `PATCH /api/salary-advances/:id/approve-adjustment`):

1. `client/src/pages/admin/hr/MyTeam.tsx` — the "Advances & Adjustments" card inside a
   My Team employee view (Record dialog + inline approve/return/reject).
2. `client/src/pages/admin/SalaryAdvance.tsx` — the dedicated `/admin/salary-advance` page
   (Record dialog + pending-adjustments approve table with per-row month picker).

**Why:** any UI/field change (e.g. adding a "First Recovery Month" input) must be
propagated to BOTH surfaces or the flow silently diverges by entry point.

**How to apply:** when touching salary-adjustment forms, always check both files. For
**overpayment**, the First Recovery Month is captured at record time and stored
(`repaymentStartMonth/Year`); the approve endpoint resolves it from the request body
OR the stored value, so approval works one-click for new rows. Legacy rows recorded
before the field existed have NULL start — MyTeam handles them via an inline
approve-time month picker (prefilled from stored/next month).
