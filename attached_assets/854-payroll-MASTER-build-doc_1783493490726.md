# #854 — Payroll Structure Templates & Statutory Engine
# FINAL MASTER BUILD DOCUMENT · v3.0
### India MVP · multi-country-ready · remote company · Delhi HQ · UP/Punjab/Bihar cluster (+ J&K/Ladakh)

> **This is the single source of truth.** It consolidates the technical spec and the build plan into
> one document and closes every open gap. It supersedes `854-payroll-engine-final-spec.md` and
> `854-payroll-build-plan.md` — use this one. Nothing here should require the executor to guess: every
> edge case has a decision, every statutory rule is stated, and the three items still needing an owner
> call are collected in §10.
>
> **Compliance is a hard gate (§14), not a footnote.** A flawless engine still remits wrong numbers off
> a stale seed table. A practising Indian CA must sign off on the seed rates *and* the golden-vector
> expected outputs before the first live run.

---

## Table of contents
1. Executive summary
2. Company context
3. Scope & the #854-A / #854-B split
4. Compliance foundation (locked statutory rules)
5. Data model (consolidated schema)
6. Engines & signatures
7. **Master gap register — all gaps, all decisions**
8. Golden test vectors
9. Open decisions for the owner
10. Missing inputs (CA / owner checklist)
11. Top-1% product layer (what makes it easy to use)
12. Build sequence
13. Pre-production hard gate
14. Definition of done + compliance disclaimer

---

## 1. Executive summary

Salary slips today are typed by hand — Basic, HRA, PF, ESI, PT — every employee, every month. This
builds the computation layer so a slip auto-generates from a single gross figure, applying India's
statutory rules exactly (EPF & MP Act 1952, ESI Act 1948, Labour Codes 2025), with per-component
LOP handling, employer-side CTC breakdown, and full HR override with audit trail. Employees without a
structure keep the existing manual path (backward compatible).

**Three things define correctness:** the **Labour Codes 50% wage floor** (without it the MVP is
non-compliant day one), **effective-dated statutory rates** (so a rate change is a data edit, not a
redeploy, and historical slips stay correct), and **per-slip computation snapshots** (so a regenerated
slip reproduces the original numbers for audit).

**Three things make it best-in-class:** show-your-work transparency on every figure, preview-before-
commit with a plain-language diff, and error *prevention* at structure-creation time.

The task is L-sized and splits into **#854-A (engine + CA-verified vectors)** and **#854-B (UI / PDF /
Settings)**, engine first so the compliance path is never blocked behind a settings screen.

---

## 2. Company context

Fully remote, one physical establishment (**Delhi HQ**), employees clustered in **UP / Punjab / Bihar**,
with possible **J&K / Ladakh**. Consequences baked into this design:

- **Professional Tax is largely inert.** Delhi, UP, Bihar, J&K, and Ladakh all levy **no PT**. So the
  multi-state PT machinery exists as data model but touches almost nobody today — rank it low, don't
  gold-plate it.
- **Punjab is the one live trap.** Punjab has no "PT" but has the **Punjab State Development Tax (PSDT)
  — ₹200/month**, employer-deducted for employees whose taxable income exceeds the IT exemption limit,
  requiring a separate Punjab registration. Modelled as a row in the state-deduction table (§4.4).
- **PF and ESI are central** — one registration via Delhi HQ covers the whole remote workforce
  nationwide; the harder half of the engine needs zero geography handling.
- **J&K/Ladakh add two ₹0 seed rows and no engine logic** (§4.5).

---

## 3. Scope & the #854-A / #854-B split

| Ticket | Contains | Exit criterion |
|---|---|---|
| **#854-A — Engine + Vectors** *(backend, no UI)* | `statutory_rates` + `state_deductions` + all schema migrations · ESI backfill migration · `computeComponentsFromGross` · `computeIndiaStatutory` behind `StatutoryEngine` interface · wiring into generate/regenerate · computation snapshot · golden test-vector suite | 🔒 **Golden vectors pass against CA-confirmed expected outputs.** (Not "vectors pass" alone — expected values need CA sign-off. This couples the CA gate to the engine.) |
| **#854-B — UI / PDF / Settings** | Salary Structures tab · rule builder + live preview · State Registrations panel + exposure banner · slip form auto-fill + override toggles · `salarySlipHtml.ts` earnings/deductions/employer sections · My Team assignment · MVP UX (§11) | Structured / unstructured / override slips render correctly; Settings round-trips all config; §11 MVP UX present. |

#854-B may start once #854-A's engine interface is stable, but #854-A ships first and independently.

**Executive role access:** every new API route registers `executive` in allowed roles via
`shared/accessControl.ts` (registry pattern, per Task #856 — never hard-code role checks). All frontend
checks use `usePermission` / `hasPermission` with registry keys. Executive can do everything: create/
edit/deactivate structures, assign them, set PF mode / state registrations / slab overrides, mark
PF-exempt, generate/regenerate slips, override any field (with reason).

---

## 4. Compliance foundation (locked statutory rules)

All rates below live in the **effective-dated `statutory_rates` table** and are resolved **as of the
slip's pay period**, never "now." Figures are current as of mid-2026 and must be CA-confirmed.

### 4.1 Labour Codes 2025 — the 50% wage floor 🔴
In force since **21 Nov 2025**. Basic + DA + retaining allowance must be **at least 50% of total
remuneration**; if excluded allowances exceed 50%, the excess is added back into "wages" for PF /
gratuity. **Engine rule:** `wageFloor = 0.50 × grossAfterLOP`; `pfBasis = max(basicAfterLOP, wageFloor)`
**before** the ₹15,000 restricted cap. Default seed structure Basic = **50%**. Settings shows a
**persistent** warning (not a toast) when a structure defines Basic < 50%, displaying the effective
statutory basis that will actually be used.

### 4.2 Provident Fund (EPF & MP Act 1952)
- 🔴 **Establishment applicability gate (see §4.7) comes first.** PF is computed **only if the
  establishment's EPF coverage is active** (`mandatory` or `voluntary`) and the slip period is on/after
  `applicable_from`. Below the 20-employee threshold and not voluntarily registered → **PF = 0 for
  everyone**, regardless of per-employee flags. **This is the current default for this company.**
- PF basis = `max(basicAfterLOP, 0.50 × grossAfterLOP)`, then mode cap.
- **Restricted mode** (default): basis capped at **₹15,000** → max employee PF **₹1,800**.
- **Unrestricted mode**: basis = actual (no cap). Per-structure toggle.
- Employee PF = **12%** of basis (0 if `pf_exempt`).
- Employer EPS = **min(8.33% of basis, ₹1,250)**.
- Employer EPF = **12% of basis − EPS** (absorbs the remainder above the EPS cap — computed as a
  difference, per EPFO rules).
- Employer EDLI = **min(0.5% of basis, ₹75)**.
- EPF admin = **0.5% of PF wages, min ₹500/establishment/month** — establishment-level cost, **not a
  per-slip line** → deferred to the payroll-run summary in **#855** (G3).
- `pf_exempt`: existing UAN members stay enrolled regardless of salary; new joiners with Basic > ₹15,000
  may be flagged exempt, which skips PF entirely. All employer-side PF amounts are **CTC/reporting only,
  never deducted from Net Pay.**

> The ₹15,000 ceiling is **retained but under active Supreme Court review**. Effective-dating is what
> makes a future hike a data edit, not a redeploy.

### 4.3 ESI (ESI Act 1948)
- 🔴 **Establishment applicability gate (see §4.7) comes first, at a *different* threshold.** ESI is
  computed only if the establishment's ESI coverage is active — the ESIC threshold is **10 employees**
  (20 in some states), *not* 20. **This is the catch: at 10–19 employees ESI is mandatory while PF is
  not.** Confirm the company's current ESI status before go-live (§9).
- Applicable if gross ≤ **₹21,000/month** (**₹25,000** if disability — flag on employee).
- Employee ESI = **0.75%** of gross; Employer ESI = **3.25%** of gross.
- 🔴 **Contribution-period coverage (correct direction):** periods run **Apr–Sep** / **Oct–Mar**. Once
  covered at period start, the employee **stays covered and contributions continue until the period
  ends**, even if gross crosses ₹21,000 mid-period. (The original spec had this backwards — evaluating
  fresh each month *stops* deducting mid-period, which is under-remittance.) Implemented via
  `esi_covered_until` + the shared `endOfContributionPeriod()` helper (§4.6, G16). Backfill on deploy
  (G2). `esi_applicable` per-employee override for non-ESIC-implemented areas.
- 🔴 **₹176/day employee exemption** (G28): employees whose average daily wage ≤ **₹176** are exempt
  from the *employee* 0.75% share, but the employer **still pays 3.25%**. Rare for salaried staff; store
  as an edge flag.

### 4.4 State deductions — PT / PSDT / LWF (state-keyed, single table)
All state-level deductions live in one `state_deductions` table keyed by `(state, levy_type)`, each with
a **registration status** and an `is_flat` flag (G6).

| State | Levy | Rule | Cluster? |
|---|---|---|---|
| **Delhi (HQ)** · **UP** · **Bihar** · **J&K** · **Ladakh** | PT | **₹0** (no PT) | ✅ / ✅ / ✅ / poss. / poss. |
| **Punjab** | 🔴 **PSDT** | **₹200/mo** if annualised gross ≥ `psdt_annual_threshold` (G1) · **flat** | ✅ |
| Maharashtra | PT | > ₹10,000 → ₹200 (**₹300 in Feb**) · flat | future |
| Karnataka | PT | > **₹25,000** → ₹200 (revised Apr-2023) · flat | future |
| Telangana | PT | > ₹20,000 → ₹200 · flat | future |
| Tamil Nadu | PT | half-yearly graded (~₹208/mo approx — flag) · cadence=half-yearly | future |
| West Bengal | PT | graded ₹110/₹130/₹150/₹200 · flat | future |

**Registered vs not-registered (the remote-company feature):** registered state → compute and deduct;
not-registered → deduct **₹0 but set `stateDeductionApplicableButUnremitted = true`**, surfaced as a
**sticky exposure banner** in the State Registrations panel (G14). One toggle turns real deduction on
the day you register. **PT/PSDT basis:** slab check on gross *before* LOP; flat levies not LOP-prorated
(G6). **LWF** deferred but slots into this same table (cadence flag ready).

### 4.5 Special jurisdictions — Jammu & Kashmir + Ladakh
Zero new engine logic. Three build-relevant facts: **(a)** both UTs are PT-exempt → **seed each at ₹0**,
storing **Ladakh as a separate UT** from J&K (not merged); **(b)** PF is **fully central since 1 Jan
2020** (J&K was excluded from the EPF Act before that) — HQ registration covers it, and effective-dating
keeps a pre-2020 slip correct (no PF then) if ever regenerated; **(c)** ESI is **area-dependent** (ESIC-
implemented areas only) — handled by the `esi_applicable` per-employee flag, set by locality. Labour
Codes apply. Operationally, the Kashmir Valley's periodic internet shutdowns argue for an offline slip-
export fallback; small J&K headcount is often run via an Employer-of-Record.

### 4.6 Rounding & dates (verified) 🔴
- **EPF: round each contribution to the NEAREST rupee** — employee share, EPS, and EDLI each rounded
  independently. **Employer EPF = (employer 12% share) − EPS**, taken as the difference (not
  independently rounded). Admin charges nearest rupee, min ₹500 (G3).
- **ESI: round UP to the NEXT HIGHER rupee** — **both** employee 0.75% and employer 3.25%, per Rule 51
  of the ESI (Central) Rules (amended 1-10-2004). *This differs from EPF* — do not use "nearest" for
  ESI, or you underpay ESIC.
- **Earnings residual:** Special Allowance absorbs the sub-rupee remainder so Earnings sum to
  `grossAfterLOP` exactly (G8, G23).
- **Remittance dates (not the payment date):** PF and ESI challans (ECR) are due by the **15th of the
  following month**; separately, the Code on Wages requires **wages paid by the 7th**. Neither changes
  the computation engine, but both are surfaced on the payroll run (#855) (G9).

### 4.7 Establishment coverage — headcount thresholds & the irrevocability latch 🔴
PF and ESI applicability is an **establishment-level** condition driven by headcount — distinct from the
per-employee `pf_exempt` / `esi_applicable` flags, and it gates them. Verified against the Social
Security Code, 2020 and the Social Security (Central) Rules, 2026:

- **Thresholds (independent):** EPF applies at **20+ employees**; ESI at **10+ employees** (20 in some
  states). A growing company sits in three bands: **<10** (neither), **10–19** (**ESI only**), **20+**
  (both). These are configurable + effective-dated (the Central Govt can notify sub-20 applicability;
  the EPF 20-threshold was retained through the 2026 rules but is a policy lever).
- **Count is broad:** the headcount includes **all workers — part-time and contractor-engaged** — not
  just PF-eligible salaried staff. The counting rule has nuance → **surface the count and let HR confirm**
  (CA-territory); do not silently auto-decide it (G35).
- **One-way latch (compliance-critical):** once coverage becomes active, it is **irreversible** — if
  headcount later drops below the threshold, coverage **continues** and does not require re-registration.
  So naive `headcount ≥ 20 → PF on` logic is *wrong*: it would switch PF **off** at 19, which is illegal
  (G32). Model coverage as a **latch**, not a live comparison.
- **Detect → alert → confirm, never auto-flip (G33):** the system tracks a **monthly headcount history**
  and **alerts** HR/executive when the threshold is first crossed — it does **not** silently start
  deductions. HR confirms the **effective crossing date** (backdatable, from the tracked history), because
  registration is due **within one month** and **contributions apply retrospectively from the crossing
  date** (12% p.a. interest accrues on arrears from 21 Nov 2025 onward). On confirmation → status
  `mandatory`, `applicable_from` set, latched.
- **Voluntary opt-in:** an establishment below threshold may **voluntarily register** (an employee-
  benefit lever to attract talent); once opted in it is bound by all provisions and latched.
- **How it gates the engine:** `employeePf > 0` requires `epfCoverage active` **AND** `period ≥ applicable_from`
  **AND** `!pf_exempt`; ESI likewise requires `esiCoverage active` **AND** the ≤₹21,000 rule **AND**
  `esi_applicable`. Because `applicable_from` is effective-dated, **regenerating a slip for a period before
  coverage began correctly yields ₹0** — the same mechanism that handles J&K's pre-2020 PF (§4.5).

**Current state for this company:** **EPF = `not_applicable`** (below 20 — PF off for everyone, as
requested). **ESI status must be confirmed:** if headcount already exceeds **10**, ESI is **mandatory
now** even though PF is not — do not let "PF off" imply "ESI off" (§9, G34).

> *Out of scope:* the reduced **10% PF rate** for certain notified sub-20 establishments (sick units,
> etc.) — doesn't apply to a standard remote company; note for the rate table if ever relevant.

---

## 5. Data model (consolidated schema)

DB drift guard: all columns in `shared/schema.ts`, no startup DDL to owned columns. Store **all money
as integer paise** (G24) — format to rupees only at display.

**`salary_structures`** — `id, name, description, effective_date, is_active, pf_mode [restricted|unrestricted], jurisdiction (default 'IN')`
> `pf_mode` is **per-structure** (firms run both modes across bands); removed from `system_settings`.

**`salary_structure_rules`** — `id, structure_id, component_name, rule_type [percent_of_gross|percent_of_component|fixed|residual], value, reference_component, lop_mode [proportional|fixed]`

**`admin_users`** (add) — `salary_structure_id (FK, nullable), pf_exempt (bool), pt_state, work_city (nullable — /* Phase 3: HRA metro/non-metro + pt_state derivation */ G4), esi_disability (bool), esi_applicable (bool default true), esi_covered_until (date nullable), esi_daily_wage_exempt (bool default false, G28)`

**`state_deductions`** (new) — `id, state, levy_type [PT|PSDT|LWF], condition_type [salary_gt|annual_gt|graded], threshold, amount, feb_amount (nullable), is_flat (bool, G6), cadence [monthly|half_yearly], deduction_months (for half-yearly, G26), is_registered (bool), registration_number (nullable), basis [gross_pre_lop|gross_post_lop], psdt_annual_threshold (nullable, G1), jurisdiction`

**`establishment_coverage`** (new, §4.7) — `id, scheme [EPF|ESI], status [not_applicable|voluntary|mandatory], threshold (int — 20 EPF / 10 ESI, configurable), applicable_from (date nullable — the irrevocability anchor, set once), is_latched (bool default false — once true never auto-reverts, G32), trigger_reason [headcount_crossed|voluntary_optin|manual], registration_number (nullable), effective_from, jurisdiction`
> Seeded for this company: EPF `not_applicable`; ESI status per §9 confirmation. **`is_latched` is the compliance latch** — headcount drops never clear it (G32).

**`headcount_history`** (new, §4.7/G33) — `id, period (month), total_count, breakdown (JSONB — salaried/part-time/contractor), recorded_at` — drives threshold-crossing alerts and provides the backdatable crossing date for audit.

**`statutory_rates`** (new) — `id, jurisdiction, levy [EPF|EPS|EDLI|ESI_EE|ESI_ER|EPF_ADMIN|...], key, value, rounding [nearest|up], effective_from, effective_to (nullable)`
> `rounding` is per-rate so ESI (up) and EPF (nearest) are data, not code (G8/§4.6).

**`salary_slips`** (add) — `computation_snapshot (JSONB — full inputs + rules + resolved rates + itemised output + formula per line)`; **idempotency key = (employee_id, pay_month, jurisdiction)** (G25).

**`system_settings`** (add) — `lop_basis [calendar_days|fixed_26|fixed_30|actual_working_days] (default actual_working_days, G7), show_employer_contribution_on_slip (bool, default true — G5), esi_disability_threshold, default_jurisdiction`
> PT state removed (now per-employee); `pf_mode` removed (now per-structure).

**Seed:** default **"Standard"** structure (Basic **50%**, HRA 50% of Basic, Conveyance ₹1,600 fixed,
LTA 8.33% of Basic, Special Allowance residual); `state_deductions` per §4.4 (Punjab PSDT active;
Delhi/UP/Bihar/J&K/Ladakh ₹0; MH/KA/TN/WB/TG `is_registered=false`); `statutory_rates` per §4.2–4.3
with `effective_from` dates and correct `rounding` (G8).

---

## 6. Engines & signatures

**Layer separation is the multi-country seam:** the component engine is country-agnostic; the statutory
engine sits behind a generic interface with India as the first implementation.

**6.1 `computeComponentsFromGross(gross, structureRules, presentDays, workingDays)`** — pure, country-agnostic.
1. Compute raw components from rules in **dependency order** (topologically sort by `reference_component`
   — not declaration order; HRA-as-%-of-Basic needs Basic first; reject cycles) (G27).
2. Clamp `presentDays ≤ workingDays` (proration factor ≤ 1.0; flag if exceeded) (G21).
3. Apply LOP **proportionally per component** by each rule's `lop_mode` (fixed components don't scale).
4. **Special Allowance residual** absorbs the rounding remainder so Earnings sum to `grossAfterLOP`
   exactly. If the residual would go **negative** (fixed components exceed reduced gross under heavy
   LOP), clamp at 0 and **flag for HR review** — do not emit negative earnings (G23).
5. Return itemised breakdown with **both pre-LOP and post-LOP** amounts for audit.

**6.2 `StatutoryEngine` interface (generic — keep it clean):**
```
StatutoryEngine.compute(period, components, employeeConfig, resolvedRates) → StatutoryLine[]
```
`IndiaStatutoryEngine` **destructures its India-specific fields** (pfMode, pfExempt, state,
esiCoveredUntil, disability, dailyWageExempt, …) **from `employeeConfig` internally** — they never
appear in the interface signature (G11). Country #2 (e.g. UK NI/PAYE) implements the same interface
with its own config shape, no rewrite.

**6.3 `IndiaStatutoryEngine.compute(...)`** returns, each rounded per §4.6:
- 🔴 **Establishment gates first (§4.7):** `epfActive = epfCoverage.status ≠ 'not_applicable' && period ≥ epfCoverage.applicable_from`; `esiActive = esiCoverage.status ≠ 'not_applicable' && period ≥ esiCoverage.applicable_from`. If a scheme's gate is closed, **all its lines = 0** regardless of per-employee flags (G31/G34). For this company today, `epfActive = false`.
- `employeePf` = **epfActive** ? (round_nearest(12% × pfBasis) or 0 if exempt) : 0 · `employerEps` = min(round_nearest(8.33% × pfBasis), 1250) · `employerEpf` = round_nearest(12% × pfBasis) − employerEps · `employerEdli` = min(round_nearest(0.5% × pfBasis), 75) — all employer PF lines also gated by `epfActive`
- `employeeEsi` = (**esiActive** && esiCovered) ? round_up(0.75% × grossAfterLOP) : 0 (and 0 if `dailyWageExempt`, employer still pays) · `employerEsi` = (**esiActive** && esiCovered) ? round_up(3.25% × grossAfterLOP) : 0
- `stateDeduction` = lookup(state, grossAfterLOP) — 0 if not registered, with `applicableButUnremitted` flagged; flat levies not prorated (G6)
- each figure returned **separately** for individual slip/report display.

**6.4 Net-pay waterfall (G19/G20/G22):** apply in strict order —
`grossAfterLOP → less statutory deductions (PF, ESI, PT/PSDT) → less advance recovery → less other → Net Pay`.
- **Advance recovery is capped** at the amount remaining after statutory deductions; any **shortfall
  carries forward** to the next slip. Multiple advances recovered **oldest-first (FIFO)**.
- **Net Pay floored at ₹0** — never negative.
- **Zero present days** (full-month LWP): `grossAfterLOP = 0` → all statutory = 0, Net Pay = 0; a ₹0
  slip is still generated; ESI period-coverage status is unchanged (0 contribution on 0 wages).

**6.5 Wire into `POST /api/hr/salary-slips/generate` + regenerate:** call both engines when a structure
is assigned; response includes full breakdown + employer-side amounts + per-line formula; **persist the
computation snapshot**; merge with advance-recovery/override logic; **regenerate replaces the slip and
snapshots the prior version to audit history** (never silent overwrite) (G25). Unstructured employees
fall through to the existing manual path unchanged.

---

## 7. Master gap register — all gaps, all decisions

**Legend:** 🔴 compliance-correctness · 🟢 architecture/robustness · executor must not re-litigate; the
three genuine owner calls are in §9.

| # | Gap | Decision |
|---|---|---|
| **G1** | 🔴 PSDT applicability undefined pre-TDS ("taxable income" is circular) | Configurable **`psdt_annual_threshold`** on the `state_deductions` row (CA sets it); deduct for Punjab employees with annualised gross ≥ threshold. Not a hard-coded ₹20,833 (regime-dependent, stale). |
| **G2** | 🔴 ESI `esi_covered_until` NULL on deploy → silent under-deduction | **Mandatory one-time backfill migration**: set `= endOfContributionPeriod(currentMonth)` for active employees with gross ≤ ₹21,000 (₹25,000 if disability). **Log the affected set** for manual review. Highest-risk gap. |
| **G3** | 🔴 EPF admin (₹500/estab) has no per-slip home | Exclude from per-slip output; **defer to #855** payroll-run summary. |
| **G4** | 🟢 `work_city` purpose ambiguous | Keep with schema comment: "Phase 3 — HRA metro/non-metro (50/40%) + pt_state derivation." |
| **G5** | 🟢 Employer-contribution slip section hard-coded | `show_employer_contribution_on_slip` in settings, **default `true`** (honors ticket's "for transparency"), toggleable. 🟠 owner confirms (§9). |
| **G6** | 🔴 Flat levies (PSDT, MH/KA/TG/WB PT) wrongly LOP-prorated | `is_flat` on `state_deductions`; flat → full amount if slab met, **no proration**. |
| **G7** | 🟢 `workingDays` / LOP basis undefined | `lop_basis` setting, default **`actual_working_days`**. 🟠 owner confirms (§9). Definition in G12. |
| **G8** | 🔴 Rounding under-specified / **wrong for ESI** | **EPF = nearest rupee** (employee/EPS/EDLI each; employer EPF = difference). **ESI = round UP to next rupee** (both shares, Rule 51). Stored as `rounding` per rate. Residual absorbs sub-rupee (G23). |
| **G9** | 🟢 Wage/remittance dates not tracked | Surface on #855: **PF/ESI ECR by 15th** of following month; **wages by 7th** (Code on Wages). No engine change. |
| **G10** | 🟢 `presentDays` source undefined | Engine input; **MVP source = HR manual entry per slip** (#854-B field); integration point documented for later. |
| **G11** | 🟢 `StatutoryEngine` interface vs fat India signature | Interface stays `compute(period, components, employeeConfig, resolvedRates)`; India impl **destructures its fields from `employeeConfig` internally**. Reconcile the engine signature to the interface. |
| **G12** | 🟢 `actual_working_days` computation undefined | `workingDays = calendar days in month − non-working days per the employee's **work-week pattern** (5-day / 6-day / alternate-Saturday) − public holidays in the employee's holiday calendar`. Reference the pattern + calendar, **not a hard-coded weekend**. |
| **G13** | 🟢 Month-over-month diff boundary (structured vs unstructured) | Diff shown **only when current AND immediately-prior slip both used the structured engine**; else "First structured slip — no prior comparison available." |
| **G14** | 🟢 Exposure report has no UI surface | **Sticky banner in the State Registrations panel** ("N Punjab employees · PSDT not registered · ₹X/mo exposure"), visible on every Settings visit. Explicit **#854-B** deliverable (not #855). |
| **G15** | 🔴 Mid-month join `esi_covered_until` init | On first slip for a new employee, set `= endOfContributionPeriod(joinMonth)`. Add as explicit vector (§8). |
| **G16** | 🔴 ESI period date expression + duplication | **Shared helper `endOfContributionPeriod(month)`** used by G2/G15/re-evaluation: Apr–Sep → 30 Sep (current yr); **Oct/Nov/Dec → 31 Mar next yr; Jan/Feb/Mar → 31 Mar current yr**. Own vectors at all four quarter boundaries. (The "next year" shorthand is wrong for Q4 — this helper prevents the off-by-a-year.) |
| **G17** | 🟢 Gratuity basis under 50% floor (affects #855 CTC) | **Flag-now**: persistent CTC note "Gratuity basis = Basic; Labour Codes 50% floor may apply — verify with CA." Fix in #855. 🟠 owner confirms (§9). |
| **G18** | 🟢 Data-residency decision owner | **Business owner** accepts the risk (not engineering, which only documents controls). Named in §13. |
| **G19** | 🔴 Negative/zero net pay undefined | Net Pay **floored at ₹0** (§6.4). |
| **G20** | 🔴 Advance-recovery order & cap undefined | Waterfall: statutory before recovery; recovery **capped at remaining**, **shortfall carries forward**, multiple advances **FIFO** (§6.4). |
| **G21** | 🟢 `presentDays > workingDays` inflates everything | **Clamp** presentDays ≤ workingDays (factor ≤ 1.0); flag data error (§6.1). |
| **G22** | 🟢 Zero present days (full-month LWP) | `grossAfterLOP = 0` → statutory 0, Net 0; **still generate a ₹0 slip**; ESI coverage unchanged (§6.4). |
| **G23** | 🔴 Negative Special-Allowance residual (fixed > reduced gross) | Clamp residual at 0, **flag for HR review**; never emit negative earnings (§6.1). |
| **G24** | 🟢 Float money drift | Store **all money as integer paise**; format to rupees only at display. |
| **G25** | 🟢 Slip idempotency / silent overwrite | Idempotency key **(employee, pay_month, jurisdiction)**; regenerate **replaces + snapshots prior** to audit history. |
| **G26** | 🟢 Half-yearly levy (TN, WB, future LWF) cadence undefined | `cadence` + `deduction_months`; half-yearly levies deduct the full amount in configured months (**default: Sep & Mar**), ₹0 otherwise. |
| **G27** | 🔴 Structure validation is only a banner | **Hard validation at save**: exactly one `residual` component; sum of `percent_of_gross` ≤ 100%; dependency graph resolvable (no cycles). **Reject** on failure. **Warn** (persistent) on Basic < 50%. |
| **G28** | 🔴 ₹176/day ESI employee exemption missing | `esi_daily_wage_exempt` flag: employee 0.75% = 0, **employer still pays 3.25%**. Rare for salaried; store the flag. |
| **G29** | 🟢 "Gross" definition per threshold ambiguous | State explicitly: **PF basis** = Basic+DA post-LOP (then floor+cap); **ESI** = gross wages post-LOP; **PT/PSDT slab** = gross pre-LOP (deduction on the flat/graded rule). |
| **G30** | 🟢 February / leap year | MH PT = ₹300 in Feb (`feb_amount`); if `lop_basis = calendar_days`, denominator = **actual days in month** (28/29). |
| **G31** | 🔴 PF/ESI applicability modeled per-employee only; **establishment headcount threshold missing** | Add **`establishment_coverage`** (§4.7): EPF gate at **20**, ESI gate at **10**. Engine computes a scheme only if its coverage is active + `period ≥ applicable_from`. **Current default: EPF off.** |
| **G32** | 🔴 Irrevocability — coverage must not auto-revert when headcount drops | **One-way latch** (`is_latched`): once active, headcount falling below threshold **never** turns it off (re-registration not required by law). Naive `headcount ≥ 20 → PF` is illegal (switches off at 19). |
| **G33** | 🔴 Threshold crossing must not silently auto-trigger a permanent obligation | **Detect → alert → HR confirms** (with **backdatable** effective date from `headcount_history`). Registration due within 1 month; contributions **retrospective from crossing date** (12% p.a. interest on arrears). |
| **G34** | 🔴 PF and ESI thresholds are **independent** (20 vs 10) | At **10–19 employees, ESI is mandatory while PF is not.** "PF off" must **not** imply "ESI off." Confirm current ESI status (§9). |
| **G35** | 🟢 Headcount count basis ambiguous | Count **includes part-time + contractor** workers. **Surface the count + breakdown; HR confirms** what counts (CA-territory) — don't hard-code or silently auto-decide. |

---

## 8. Golden test vectors (build as automated tests; CA confirms expected outputs)

30–50 cases, verified against a CA or known-good calculator. Must cover:

- **Gross levels:** ₹18k · **₹21,000 exactly** (ESI boundary) · ₹21,001 · ₹50k · ₹1.5L.
- **Basic %:** 40% (triggers 50% floor) · 50% · 60%.
- **PF mode:** restricted vs unrestricted at Basic > ₹15,000; **EPS cap** → basis > ₹15k unrestricted gives EPS = ₹1,250, EPF absorbs excess.
- **LOP:** 0 days · half-month · present = working (no LOP). Assert **Earnings sum == grossAfterLOP exactly**.
- **Mid-month join (G15):** present 10 / working 26 → correct proration **and** `esi_covered_until = end of the contribution period containing the join month`.
- **ESI period (G16):** covered → crosses ₹21k mid-period (keep deducting to period end) → next period start (re-evaluate/stop). Vectors at **all four quarter boundaries** for `endOfContributionPeriod()`.
- **Rounding (G8):** a value where **ESI rounds up** and **EPF rounds to nearest** diverge; assert both directions.
- **Disability:** ESI at ₹24k (covered) vs ₹26k (not). **₹176/day exemption (G28):** employee 0 / employer pays.
- **`pf_exempt`:** PF = 0, ESI still computes.
- **Establishment coverage (G31/G32/G34):** EPF `not_applicable` → **PF = 0 for everyone** even at high Basic; ESI `mandatory` at 12 employees → ESI computes while PF is 0 (the 10–19 band); slip period **before** `applicable_from` → scheme = 0; coverage latched → headcount drops below threshold → **still computes** (no auto-revert).
- **State:** Delhi/UP/Bihar/J&K/Ladakh → ₹0; **Punjab → ₹200 PSDT (flat, not prorated even with LOP — G6)**; Punjab not-registered → ₹0 **but flagged** (G14).
- **Edge amounts:** deduction > earnings → **Net Pay floored at ₹0** (G19); advance recovery capped + **carry-forward** (G20); **negative residual clamp + flag** (G23); **zero present days → ₹0 slip** (G22); `presentDays > workingDays` **clamped** (G21).
- **Structure validation (G27):** reject no-residual / two-residual / percent-sum > 100% / cyclic-dependency structures.

---

## 9. Open decisions for the owner (before #854-A starts)

1. 🟠 **G34 — Current ESI status (act on this first).** EPF is correctly off (below 20). But **what is your current headcount?** If it exceeds **10**, ESI is **mandatory now** and the establishment ESI coverage should be seeded `mandatory` with the correct `applicable_from` — "PF off" does not mean "ESI off." Confirm headcount and whether ESIC registration exists.
2. 🟠 **G5 — Employer Contribution slip default.** Recommend **`true`** (honors ticket). Confirm/override.
3. 🟠 **G7 — LOP basis default.** Recommend **`actual_working_days`** (per G12 definition). Confirm this matches your attendance policy (some firms standardise on fixed 26).
4. 🟠 **G17 — Gratuity basis (affects #855 CTC).** Recommend **flag-now, fix-in-#855**. Confirm, or fix now with CA.

---

## 10. Missing inputs — required before code is trustworthy

| Input | Owner | For | ☐ |
|---|---|---|---|
| Golden-vector **expected outputs** (30–50) confirmed | **CA** | #854-A gate | ☐ |
| `statutory_rates` seed + **`effective_from`** + **`rounding`** per rate (EPF nearest / ESI up) | **CA** | Engine | ☐ |
| **PSDT annual threshold** (G1) | **CA** | Punjab | ☐ |
| EPF admin ₹500 min confirmed (G3, for #855) | **CA** | #855 | ☐ |
| PT seed re-confirmed (KA ₹25k, WB graded, TN half-yearly approx, MH Feb ₹300) | **CA** | State ded. | ☐ |
| **LOP basis** + work-week pattern per employee (G7/G12) | **Owner + HR** | Engine | ☐ |
| ESI backfill affected-set reviewed (G2) | **Eng + HR** | Migration | ☐ |
| Employer-contribution default (G5) · Gratuity basis (G17) | **Owner** | UI / #855 | ☐ |
| ₹176/day exemption applicability (G28) | **HR** | Edge flag | ☐ |

> Not one-and-done: the ₹15,000 EPF ceiling is under Supreme Court review and Labour Code *Rules* are
> still being detailed. Re-run this at each fiscal year and on any notification.

---

## 11. Top-1% product layer (what makes it easy to use)

Compliance gets you legal; these get you trusted. Payroll's core problem is trust — people dispute
numbers they can't understand, and HR fears the generate button.

- **11.1 Show-your-work (flagship).** Every slip figure is **explainable on click** — inputs, formula,
  and the rate version used (you already snapshot this; surface it). "PF ₹1,800 = 12% × min(₹18,000,
  ₹15,000 ceiling), restricted, EPF Act rate eff. 2014." Kills most disputes. **MVP.**
- **11.2 Preview-before-commit + diff.** Generate = preview → confirm. Preview shows a **plain-language
  diff vs last month** ("Net ↓ ₹2,400 — 3 days LOP"). Diff only across two structured slips (G13). **MVP.**
- **11.3 Error prevention.** Validate structures at **creation** (G27) — one residual, ≤100%,
  dependency-orderable — plus a **persistent** Basic-<50% banner. Don't let a broken structure exist. **MVP.**
- **11.4 Progressive disclosure.** Daily path is dead simple (assign → preview → generate); PF mode,
  state registrations, slab overrides live one layer down in Settings. **MVP.**
- **11.5 Audit trail as a surface.** Every override (with reason), rate change, and regeneration logged
  and **visible**; regenerating a shared/paid slip warns; snapshot preserves the original. Mostly **free**
  (data already exists) — just surface it.
- **11.6 Proactive compliance.** "ESI period ends 30 Sep — N employees re-evaluated." "N Punjab
  employees, PSDT not registered — ₹X/mo exposure." "EPF ceiling under SC review." **Fast-follow.**
- **11.6b Coverage-threshold dashboard & alerts (§4.7).** A **Coverage** panel in Settings: "EPF: Not
  applicable (18/20). ESI: Mandatory since 12 Aug 2026." Proactive nudges as headcount climbs
  ("18/20 — at 20, EPF is mandatory within 1 month, **irreversible**, with retrospective liability"),
  and a **blocking confirmation** at crossing with the irreversibility warning + backdatable date. The
  status panel is **MVP** (it drives the engine gate); the climb-nudges are **fast-follow**.
- **11.7 Config-change impact preview.** Flipping PF mode / registering a state / **activating EPF
  coverage** shows **who + how much** before apply. **Fast-follow.**
- **11.8 Working first-run.** Ship with the seeded "Standard" structure already generating a correct
  slip — never a blank rule builder. **MVP.**
- **11.9 Explain-to-employee mode.** Plain-language, mobile-friendly slip. Every answer here is an HR
  ticket that never gets filed. **Fast-follow.**
- **11.10 Graceful fallback.** Unstructured/manual path always works — never a dead end. **MVP (in spec).**

---

## 12. Build sequence

**#854-A — Engine (do first, in order):**
1. `statutory_rates` table + **period-resolving** resolver (with per-rate `rounding`).
2. Schema migrations (§5) — all tables/columns, integer-paise money (G24), idempotency key (G25).
3. **ESI backfill migration** (G2) + `endOfContributionPeriod()` helper (G16) with its vectors.
4. **Seed** `state_deductions` (Punjab PSDT; Delhi/UP/Bihar/**J&K/Ladakh** ₹0; MH/KA/TN/WB/TG unregistered), `statutory_rates`, and **`establishment_coverage`** (EPF `not_applicable`; ESI per §9) (G31).
5. `computeComponentsFromGross` — topological ordering (G27), presentDays clamp (G21), residual clamp+flag (G23), pre/post-LOP output.
6. `IndiaStatutoryEngine` behind the `StatutoryEngine` interface (G11) — **establishment gates first** (G31/G32/G34), 50% floor, PF caps/split, ESI period + **round-up** (G8) + ₹176 exemption (G28), flat-vs-proportional state deductions (G6).
7. **Net-pay waterfall** (G19/G20/G22) — statutory → capped/FIFO advance recovery + carry-forward → floor at ₹0.
8. Wire into generate/regenerate; write snapshot; regenerate replaces + archives prior (G25); keep unstructured path intact.
9. **Golden vectors as passing tests** (§8) — print computed-vs-expected table.
10. 🔒 **Gate: CA confirms expected outputs → vectors pass → #854-A done.**

> **Instruct the Replit agent:** *"Statutory numbers come from `statutory_rates` resolved by pay period
> with per-rate rounding — never hard-code ₹15000/₹21000/₹1250/12%/0.75% or 'nearest rupee' for ESI
> (ESI rounds UP). Keep `IndiaStatutoryEngine` behind the generic `StatutoryEngine` interface, taking an
> opaque `employeeConfig`. Store money as integer paise. Write golden vectors as passing tests before
> wiring slip generation."* Agents inline rates, use float money, and scaffold UI early — all three
> defeat the point.

**#854-B — UI / PDF / Settings (starts once engine interface is stable):**
11. Salary Structures tab: list · rule builder with **save-time validation** (G27) · **live preview** · per-structure PF mode toggle.
12. **State Registrations panel** + **sticky exposure banner** (G14); **Coverage panel** showing EPF/ESI applicability + headcount (§4.7 / 11.6b), with the blocking irreversibility confirmation on threshold crossing (G33).
13. Slip form: auto-filled read-only fields · per-field **Override** toggle (requires audit reason).
14. `salarySlipHtml.ts`: Earnings · Deductions · Employer Contribution (toggle G5) · Net Pay — via **locale formatter** (₹ Indian grouping).
15. My Team: assign structure · set pf_exempt / disability / esi_applicable / esi_daily_wage_exempt / pt_state / work_city.
16. **MVP UX (§11):** show-your-work (11.1), preview+diff (11.2), creation-time validation + persistent 50% banner (11.3), working first-run (11.8), progressive disclosure (11.4).

**Phase 2 fast-follows:** proactive nudges (11.6), config-change impact preview (11.7), explain-to-
employee (11.9), LWF (table ready), bulk payroll run (#855), executive compliance dashboard, gratuity-
basis fix (#855).

**Out of scope (unchanged):** TDS / income tax / Form 16 (Phase 3), ESIC/EPF challan generation,
gratuity *deduction* (CTC view only), government-portal submission, multi-state mid-year change +
proration, full-and-final settlement.

---

## 13. Pre-production hard gate (no live payroll until every box is green)

- ☐ **CA has signed off** on `statutory_rates` seed **and** golden-vector expected outputs.
- ☐ CA confirmed: PSDT threshold (G1), **EPF-nearest / ESI-up rounding** (G8), EPF admin ₹500 (G3), PT seed values, ₹176 exemption applicability (G28).
- ☐ ESI backfill run; affected-set log reviewed by HR (G2); `endOfContributionPeriod()` vectors pass at all four boundaries (G16).
- ☐ LOP basis + work-week pattern confirmed against policy (G7/G12).
- ☐ Owner confirmed employer-contribution default (G5) and gratuity-basis stance (G17).
- ☐ **Establishment coverage seeded & confirmed (§4.7):** EPF = `not_applicable` (below 20); **ESI status confirmed against current headcount** — if > 10, seeded `mandatory` with correct `applicable_from` and ESIC registration (G34). Latch behavior (G32) and gate-before-`applicable_from` verified in vectors.
- ☐ Punjab PSDT registration status set; **exposure banner** verified (G14).
- ☐ Golden vectors pass incl. boundaries: gross = ₹21,000 exactly, EPS cap, 50%-floor trigger, ESI mid-period crossing + all four period boundaries, disability, pf_exempt, **flat-levy no-proration** (G6), **ESI round-up vs EPF nearest** (G8), **negative residual clamp** (G23), **net-pay floor + advance carry-forward** (G19/G20), **zero-days ₹0 slip** (G22), structure-validation rejections (G27).
- ☐ Regeneration reproduces original numbers (snapshot verified, G25).
- ☐ **Business owner** (not engineering) has reviewed and **accepted data-residency & access controls** for salary/PII on the hosting environment (G18).
- ☐ Rate tables under change control (who can edit, logged).

---

## 14. Definition of done + compliance disclaimer

**#854-A done:** all schema + engines shipped; ESI backfill run; net-pay waterfall + all edge cases
(G19–G30) handled; golden vectors pass against **CA-confirmed** outputs; snapshot reproduces historical
slips; unstructured path unchanged.

**#854-B done:** structured / unstructured / override slips render correctly; save-time structure
validation live; State Registrations + exposure banner present; Settings round-trips all config; §11 MVP
UX present; matches §6/§11.

**Program done:** the §13 gate is fully green and a live run has been reconciled against a CA-verified
sample.

---

*This document is engineering + product guidance, not tax or legal advice. Indian statutory rules change
by state/union budget and notification; the ₹15,000 EPF ceiling is under Supreme Court review and Labour
Code Rules are still being detailed. A practising Indian CA / labour consultant must sign off on the seed
rate tables and golden-vector expected outputs before the first live payroll run, and re-verify at each
fiscal year and on any notification. Statutory figures herein were verified against EPFO and ESIC source
rules as of mid-2026.*
