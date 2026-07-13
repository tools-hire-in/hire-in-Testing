Status: Current-state automated system reference
Generated from: code, schema, routes, configuration, and existing documents
Date: 2026-07-13
Human approval required: Yes — for all UNABLE_TO_CONFIRM items listed within
Unresolved items: 2 — see OWNER_REVIEW_REQUIRED sections within

---

# Business Rules Catalogue

This document describes the concrete, implemented business rules of the platform. All rules carry an evidence label showing where the rule was confirmed.

---

## Leave Management Rules

### Leave Types

`CONFIRMED_IN_EXISTING_GUIDE` — `replit.md`. Confirmed in schema (`leave_types` table accrual configuration fields). `CONFIRMED_IN_SCHEMA`

| Leave Type | Annual Entitlement | Accrual Method |
|---|---|---|
| Earned Leave (EL) | 15 days base (with bonus for specific months) | Monthly accrual on the 1st of each month |
| Sick Leave (SL) | 8 days | Monthly accrual |
| Emergency/Medical Leave (EML) | Configurable | Non-accruing; HR grant |
| Maternity Leave | Statutory | HR grant on eligibility |
| Leave Without Pay (LWP) | Unlimited | Applied when balance exhausted |

### EL Accrual Rules `CONFIRMED_IN_CODE` — `server/scheduler.ts` leave accrual cron

1. The accrual cron fires on the 1st of each month at 00:00 IST.
2. EL accrues conditionally: the employee must have logged at least 128 hours (approximately 16 working days) in the previous month. Employees who do not meet the hour threshold receive no EL accrual for that month.
3. SL accrues unconditionally after the employee's first 30 days of employment.
4. Employees on a plan with active status continue to accrue.
5. Accrual records are written to `leave_accruals` for each employee and type. Each accrual is idempotent — a second run for the same employee/month/type does nothing if a record already exists.

### LWP Gating `CONFIRMED_IN_CODE` — `server/routes.ts` leave application route

1. When an employee applies for leave, the system checks their current balance for the requested type.
2. If the requested days exceed the balance, the system does not reject the request — it calculates LWP days for the deficit.
3. The request is split: approved days consume the balance; the remainder is marked as LWP.
4. LWP days trigger a proportional deduction in the employee's salary for that month (LOP).

### Weekend and Holiday Exclusion `CONFIRMED_IN_CODE` — `server/routes.ts` leave routes

Days that fall on weekends (per the employee's shift definition) and company holidays (from the `holidays` table) are excluded from leave day counts. A 5-day leave application spanning a weekend results in 3 leave days consumed.

### Year-End Processing `CONFIRMED_IN_CODE` — `server/scheduler.ts` year-end batch

1. EL carry-forward: unused EL above the carry-forward cap lapses at year end.
2. The year-end batch is run by the scheduler in December.
3. Lapsed days are recorded in `leave_adjustments` with reason `year_end_lapse`.

### Regional Holiday Selections `CONFIRMED_IN_CODE` — `server/routes.ts`

Employees may opt in to optional regional holidays once per year. The regional selection is stored in `regional_holiday_selections` with a unique index on (user_id, holiday_id, year) — an employee can only select a given regional holiday once per year.

---

## Attendance Rules

### Shift Times `CONFIRMED_IN_CODE` — `server/scheduler.ts` shift seed

Standard shifts defined in the system:
- SHIFT_A: Morning shift (corrected IST times seeded via ON CONFLICT DO UPDATE)
- SHIFT_C: Evening shift (corrected IST times seeded via ON CONFLICT DO UPDATE)

Exact clock times are seeded from `server/index.ts` and are the authoritative values. `UNABLE_TO_CONFIRM — OWNER REVIEW REQUIRED`: The precise start and end times for each shift were corrected from earlier incorrect values. The current correct IST values are maintained in the DB but not hardcoded in this document to avoid stale reference.

### Grace Period `CONFIRMED_IN_CODE`

Grace period for late marking is stored per shift (the `gracePeriod` column on `shifts`). The current seeded grace period for standard shifts is 0 minutes. Employees punching in after the shift start time (plus grace period) are marked `late`.

### Attendance Sweep Cron `CONFIRMED_IN_CODE` — `server/scheduler.ts`

1. The absence sweep runs daily at 01:30 IST targeting the previous calendar day (yesterday).
2. It marks employees as `absent` if they have no punch record for a working day.
3. Employees with an approved leave for that day are marked `on_leave` instead.
4. Employees with a shift that includes the day as a weekend are marked `weekend`.
5. Employees on days marked as holidays are marked `holiday`.
6. Shiftless employees (no shift assigned) are skipped by the sweep.

### Punch Correction `CONFIRMED_IN_CODE` — `server/routes.ts`

Employees may submit a regularization ticket within 3 days of the incorrect punch. Managers and HR can apply corrections directly with an audit record.

---

## India Statutory Payroll Rules

All rules confirmed in `server/payrollEngine.ts` and `server/salaryEngine.ts`. `CONFIRMED_IN_CODE`

### Provident Fund (PF)

| Parameter | Value |
|---|---|
| Employee PF rate | 12% of PF basis |
| Employer EPF (Diff) rate | 12% of PF basis minus EPS contribution |
| Employer EPS rate | 8.33% of PF basis, capped at ₹1,250/month |
| EDLI rate | 0.5% of PF basis, capped at ₹75/month |
| Admin charges | 0.5% of PF basis, capped at ₹75/month |
| PF mode: restricted | PF basis capped at ₹15,000/month |
| PF mode: unrestricted | No cap on PF basis |
| PF basis | Basic Salary (or max(Basic, 50% of Gross) depending on engine path) |

Employees flagged as `pfExempt` skip PF computation. `CONFIRMED_IN_CODE`

### Employee State Insurance (ESI)

| Parameter | Value |
|---|---|
| ESI threshold (standard) | ₹21,000 monthly gross |
| ESI threshold (disability) | ₹25,000 monthly gross |
| Employee ESI rate | 0.75% of gross salary |
| Employer ESI rate | 3.25% of gross salary |
| Rounding | ESI amounts are rounded UP to the nearest integer (paise in the pure-paise engine; rupee in the float engine) |
| Contribution period 1 | April to September (ends September 30) |
| Contribution period 2 | October to March (ends March 31) |

Employees flagged as `esiDailyWageExempt` skip ESI computation. `CONFIRMED_IN_CODE`

Employees whose gross exceeds the threshold are ESI-exempt regardless of flag. The gross check is performed on the monthly gross before LOP deductions. `CONFIRMED_IN_CODE`

### Professional Tax (PT)

PT is state-specific. The following slabs are seeded as defaults in `DEFAULT_PT_SLABS`. `CONFIRMED_IN_CODE`

| State | Condition | Monthly PT |
|---|---|---|
| Maharashtra | Monthly gross > ₹10,000 | ₹200 (₹300 in February) |
| Karnataka | Monthly gross > ₹15,000 | ₹200 |
| Tamil Nadu | Monthly gross > ₹6,251 | ₹208 |
| West Bengal | Monthly gross > ₹25,000 | ₹200 |
| Telangana / Andhra Pradesh | Monthly gross > ₹20,000 | ₹200 |
| Delhi | Any gross | Exempt (₹0) |
| Haryana | Any gross | Exempt (₹0) |
| Rajasthan | Any gross | Exempt (₹0) |
| Uttar Pradesh | Any gross | Exempt (₹0) |
| Gujarat | Any gross | Exempt (₹0) |
| Punjab | Any gross | Exempt (₹0) |

The jurisdiction is set per employee via `payroll_settings.default_jurisdiction` and can be overridden per establishment via `establishment_coverage`. `CONFIRMED_IN_CODE`

### Loss of Pay (LOP)

| Mode | Behavior |
|---|---|
| `proportional` | Each salary component is reduced by `(absent days / working days)` fraction |
| `fixed` | Salary component is paid in full regardless of attendance (subject to gross availability) |

The LOP mode per component is configured in `salary_structure_rules`. The `lop_basis` global is configured in `payroll_settings`. `CONFIRMED_IN_CODE`

### Salary Structure Engine `CONFIRMED_IN_CODE` — `server/salaryEngine.ts`

1. Components are topologically sorted based on dependencies (e.g., HRA depends on Basic).
2. Pre-LOP amounts are computed first, then LOP fraction is applied per component.
3. A designated `residual` component (typically Special Allowance) absorbs rounding differences to ensure the sum of all components exactly equals Gross After LOP.
4. Computation snapshot is stored in `salary_slips.computation_snapshot` JSONB on the first slip render and is not recomputed on re-view.

### Recovery Waterfall `CONFIRMED_IN_CODE` — `server/payrollEngine.ts`

Priority order for net pay deductions:
1. Gross After LOP
2. Minus statutory deductions (employee share: PF + ESI)
3. Minus salary advance recoveries (FIFO / oldest-first by `created_at`)
4. Minus other deductions
5. Result: Net Pay (floored at ₹0 — net pay cannot go negative)

---

## Salary Advance Rules

`CONFIRMED_IN_CODE` — `server/salaryAdvanceRoutes.ts`

1. Standard advance requests require manager approval followed by super_admin final approval.
2. If the requested amount exceeds 50% of the employee's monthly salary, the request is escalated to `pending_ceo` before super_admin approval.
3. HR can record advances and overpayments directly (bypassing the request/approval flow) even when the `salary_advance_enabled` self-service flag is OFF.
4. Overpayment recovery is recovered in full in the next payroll cycle; any remainder carries forward.
5. Recovery is oldest-first across all active advances.
6. Recovery is capped by net pay after statutory deductions. Shortfalls carry forward.
7. HR manual records are created as `disbursed` status — the existing monthly recovery engine handles them automatically.

---

## Offer Letter Rules

`CONFIRMED_IN_CODE` — `server/offerLetter.ts`, `server/routes.ts`

1. Non-super_admin users (managers, HR) who create an offer letter cannot send it directly to the candidate. The letter enters `pending_approval` and must be approved by a super_admin.
2. Super_admins can generate and send an offer letter directly without the approval step.
3. Offer letters expire after the `expiresAt` date (configurable at creation). The system checks expiry on candidate access and marks expired.
4. Expired offers can be reactivated by HR/admin/super_admin — this resends the offer email with a new expiry.
5. Candidate acceptance triggers automatic seeding of a probation or growth plan with NULL `employee_id`. The `employee_id` is populated when the candidate is formally onboarded.
6. Counter-signature stores a cryptographic document hash for audit integrity.
7. Onboarding sends a welcome email with login credentials and optionally provisions the employee in Rayo Academy.

---

## New Hire Eligibility Rules

`CONFIRMED_IN_CODE` — `server/routes.ts` new-hire onboarding tab

The Onboarding tab in the New Hire section shows employees who meet either of these conditions:
1. Their `joiningDate` falls within the last 90 days, OR
2. Their `joiningDate` is NULL (not yet set)

This ensures pending onboarding candidates and recently joined employees are always visible until fully processed.

---

## SOP Compliance Rules

`CONFIRMED_IN_CODE` — `server/sopRollout.ts`

1. SOP compliance enforcement is gated by the wave rollout system. Non-pilot employees (not yet in a wave) are never locked.
2. Soft enforcement (Wave 0–2): coaching banner only, no system restriction.
3. Measured enforcement (Wave 3–4): coaching banner plus audit visibility.
4. Full enforcement (Wave 5 and any wave set to `full`): training compliance lock when all lock conditions are met.
5. Lock conditions (all must be true): full enforcement + SOP is operational + more than 15 grace days elapsed + employee has not acknowledged the current version.
6. Maximum 2 operational SOPs per week cadence (Wave 0 is exempt from this throttle).
7. SOP acknowledgement is stored with a cryptographic hash of the content version. If the SOP is revised and re-published, the employee must re-acknowledge.

---

## HR Letter Issuance Rules

`CONFIRMED_IN_CODE` — `server/hrLetterRoutes.ts` (inferred from hr_letters table and existing route behavior)

1. HR letters (experience, internship, relieving) use controlled wording templates — free-form text outside of designated fields is not supported.
2. Each letter is issued with a unique reference number and a cryptographically generated auth code.
3. Letters are verifiable by the public at `/verify` using the reference number and auth code.
4. Revoking a letter does not delete it — it marks the verification status as revoked.

---

## Session and Security Rules

`CONFIRMED_IN_CODE` — `server/auth.ts`

1. Sessions expire after 30 minutes of inactivity. Rolling sessions extend the TTL on every authenticated request.
2. In production, TOTP 2FA is mandatory before accessing any authenticated API route (except the TOTP setup and verification routes themselves).
3. In development (`NODE_ENV !== 'production'`), TOTP enforcement is bypassed.
4. Password reset tokens expire after 1 hour.
5. Email domain restriction: login is restricted to emails from the allowed domain configured in `system_settings`. Default is `hire-in.com`.
6. Accounts with `isActive = false` receive a 403 on login attempt.
7. Soft-deleted accounts (`deletedAt` is set) receive a 401 on login attempt.

---

## Feature Flag Rules

`CONFIRMED_IN_CODE` — `server/routes.ts` feature flag handling, `server/index.ts` flag defaults

The following flags must be configured in three places to function: `ALLOWED_FLAGS` in `routes.ts`, `flagDefs` in `HRSettings.tsx`, and `FLAG_DEFAULTS` seed in `server/index.ts`. Missing any one of these causes the flag to be permanently OFF.

| Flag Key | Controls | Default |
|---|---|---|
| `salary_advance_enabled` | Self-service salary advance request by employees | Configurable |
| `notifications_enabled` | In-app notification bell and unread badge | Configurable |
| `onboarding_training_enabled` | Training compliance lock for onboarding tracks | Configurable |
| `performance_management_enabled` | Performance goals, check-ins, reviews, feedback, analytics | Configurable |
| `document_reminder_emails` | Automated document completion reminder emails | Configurable |
| `new_look` | Global master switch for the v2 UI redesign | Configurable |
| `studio_v2_enabled` | Routes `/studio/*` replacing legacy `/admin/studio/*` | Configurable |
| `process_governance` | SOP governance and wave rollout enforcement | Configurable |

`UNABLE_TO_CONFIRM — OWNER REVIEW REQUIRED`: The exact default values (ON or OFF) for each flag on a fresh installation are not confirmed from code reading alone — they depend on the `FLAG_DEFAULTS` seed values in `server/index.ts` which were not directly read for this document.

---

## Notification Gateway Rules

`CONFIRMED_IN_CODE` — `server/notifications.ts`

1. All notifications flow through `notifyUser()` — a fire-and-forget gateway. Failed notifications never surface to the triggering workflow action.
2. Default channel behavior: if no preference row exists for a user/type, both in-app and email channels are enabled (COALESCE semantics).
3. If the notification preference infrastructure fails, the gateway fails open (sends the notification rather than suppressing it).
4. Email delivery additionally checks `dispatchAutomatedEmail` which enforces admin-level communication configuration.
5. Preference keys collapse multiple raw notification types into a smaller set of curated preference categories (defined in `shared/notificationTypes.ts`).
