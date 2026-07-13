# Governance MVP — Readiness Scan

**Document type:** Pre-build audit — read-only inspection of live code.
**Date:** 2026-07-13
**Inspected commit:** `e5d21b2` (HEAD, branch `main`)

## Git Status

```
Before inspection:
  On branch main — nothing to commit, working tree clean (e5d21b2)

After inspection:
  On branch main — nothing to commit, working tree clean (e5d21b2)
```

No code, schema, data, configuration, or environment variables were modified during this scan.

---

## Section 1 — Employee-Manager Hierarchy

### What was inspected

- `shared/schema.ts` — `adminUsers` table definition and Drizzle relations
- `shared/accessControl.ts` — feature-level role registry
- `server/accessControlService.ts` — runtime hydration of access matrix
- `server/storage.ts` — `getTeamMembers` query implementation
- `server/routes.ts` — enforcement at team-scoped endpoints

### What was found

**Schema layer.** `adminUsers` carries a `managerId` column declared as `varchar("manager_id")` with **no database-level foreign-key constraint**. It is an unkeyed pointer. Drizzle ORM declares the relationship at the ORM layer via `relations()` — `manager` (one-to-one up) and `directReports` (one-to-many down) with `relationName: "managerRelation"` — but these relations do not create a DB constraint; they are resolved only when the ORM executes a join. There is no `ON DELETE` rule, no index declared on `managerId` in `adminUsers`, and no referential integrity guarantee at the PostgreSQL level for this column.

The same `managerId` is propagated (with a proper `.references(() => adminUsers.id)` FK) into `employee_plans`, `performance_goals`, and `check_ins` at plan-creation time via `ensurePlanFromDocument`, so the hierarchy flows through into the governance tables as a properly constrained FK there.

**Access control layer.** `shared/accessControl.ts` defines role-gated features (`admin.myTeam`, `hr.attendance.myTeam`, `hr.leaveRequests.myTeam`, `performance.reviews.team`, etc.) but only governs *whether* a user can reach a feature — it does not filter *which employees* they see within it.

**Server-side enforcement.** Data filtering is enforced in the route and storage layers:

1. `storage.getTeamMembers(managerId)` issues a `WHERE manager_id = $1` SQL filter on `adminUsers`. All team-scoped attendance, leave, and performance routes call this helper.
2. For write operations (leave approval, check-in completion) the backend explicitly loads the manager's direct-report list and verifies the target employee is in it before proceeding, returning 403 otherwise.
3. Skip-level queries (salary reports, escalation routing in `server/scheduler.ts`) join `adminUsers` back to itself to walk one extra hop up the tree.

**Limitations.** Hierarchy is *flat* — one `managerId` per employee, no secondary reporting line, and no DB constraint enforcing referential integrity on the `admin_users.manager_id` column itself. If an employee's `managerId` is NULL, they fall through all team filters. A corrupt or stale `managerId` value (pointing to a deleted user or wrong ID) will not be caught by the database; the application must handle it.

### Classification

**READY**

The system can reliably determine who a manager's direct reports are at runtime, and that determination is enforced server-side both at the query level and at the write-guard level. The absence of a DB-level FK on `admin_users.manager_id` is a noted risk but does not prevent the governance MVP from functioning — all governance tables (`employee_plans`, `check_ins`, `performance_goals`) carry properly constrained FKs to `admin_users`.

---

## Section 2 — Workflow Status for Goals, Check-ins, Training, SOPs, Probation, PIP

### What was inspected

- `shared/schema.ts` — `performance_goals`, `goal_milestones`, `check_ins`, `employee_plans`, `track_assignments`, `sectionProgress`, `training_sop_links`, probation scoring tables
- `server/performanceRoutes.ts` — plan creation, check-in scheduling, probation cadence
- `server/trainingCatalogRoutes.ts` — training assignments and SOP→track linkage
- `server/sopGovernance.ts` — SOP lifecycle state machine

### What was found

**Performance goals (`performance_goals`).**
- `status` enum: `not_started | in_progress | completed | cancelled`
- Due date: `targetDate` (date column, nullable); start date: `startDate`
- Completion evidence: `progress` (integer %), `lastProgressUpdatedAt`, optional `rating` via linked check-in, `linkedSopId` for KPI linkage
- No explicit evidence-attachment field; completion is declared by status + progress change

**Check-ins (`check_ins`).**
- `status` enum: `scheduled | completed | cancelled`
- Due date: `scheduledDate`
- Completion evidence: `completedAt` (timestamp), `rating` (integer), `reviewScores` (JSONB — full probation scorecard on Day 30/60/90), `employeeNotes`, `managerNotes`, `actionItems`
- Escalation markers: `overdueRemindedOn`, `milestoneEscalatedAt` (separate from status)
- Ownership: both `employeeId` and `managerId` stored per row; `planId` links back to the parent plan

**Employee plans — Probation, Growth, PIP (`employee_plans`).**
- `planType` enum: `probation | growth | pip`
- `status` enum: `pending | active | completed | extended | closed`
- `outcome` enum: `confirmed | extended | released | passed | terminated | rolled_over`
- Date range: `startDate`, `endDate`, `durationDays`
- Digital acknowledgement: `acknowledgedAt`, `acknowledgedBy`, `acknowledgedName` (employee countersigns the plan)
- Manager briefed: `managerBriefedAt`
- Escalation: `strikeEscalatedAt` (3-strike threshold)

**Probation cadence.** `generatePlanCheckIns` schedules 8 check-ins at Days 1, 7, 15, 30, 45, 60, 75, 90. Days 30/60/90 are formal milestone reviews (`milestone` type, `reviewScores` JSONB expected). Other days are lightweight pulse reviews (`weekly` type). Scoring bands, final weights, and pass rules live in dedicated tables (`probation_scoring_bands`, `probation_final_weights`, `probation_pass_rule`).

**PIP.** Weekly `pip_review` check-ins auto-generated for the full plan duration (default 30 days). No separate PIP-checkpoints table — `check_ins` carries the full PIP cadence.

**Training (`track_assignments`).**
- `status`: `not_started | in_progress | completed | excepted` (excepted = HR-granted exception; employee does not need to complete the track)
- `dueDate`: timestamp, set at assignment time
- Completion evidence: `completedAt`, `signedVersion` (version of the track content the employee completed)
- Exception evidence: `exceptionGrantedById`, `exceptionGrantedAt`, `exceptionReason`
- Per-section quiz and dwell data live in the `sectionProgress` table (linked via `assignmentId`), not on `trackAssignments` directly
- Ownership: `assignedBy` recorded for auditability

**SOP assignments.** Two complementary records exist per employee per SOP:

1. `training_sop_links` links a SOP code to a training track; the employee's `track_assignments` row (with `completedAt`, `signedVersion`) records training completion.
2. `sop_employee_progress` is a dedicated per-employee SOP acknowledgement table (unique index on `sopMasterId` × `userId`) with fields:
   - `trainingCompletedAt` — when training for this SOP was finished
   - `quizPassedAt` — when the linked quiz was passed
   - `acknowledgedAt` — formal acknowledgement timestamp
   - `acknowledgmentHash` — cryptographic proof of the content that was acknowledged
   - `evidenceText`, `evidenceFileUrl` — supporting evidence attachments
   - `overdueNudgeSentDate` — dedup guard for daily overdue nudge notifications
   - `sopVersion` — the SOP version number at time of acknowledgement

Storage methods `setSopAcknowledged`, `markSopTrainingComplete`, and `updateSopEvidence` in `server/storage.ts` write to this table. A dedicated routes flow calls `setSopAcknowledged` to capture signature metadata (hash, version, timestamp) when an employee signs off. There is also a `sopAuditRecords` table for weekly audit scoring.

**Minor gap.** `sop_employee_progress` stores one row per (sopMasterId, userId). When a SOP is revised and re-published, `sopVersion` is updated in-place. The table records the current acknowledgement state only — historical version-by-version sign-off history is not retained. If an employee acknowledged v1 and a SOP is later revised to v3, there is no record that v1 was separately acknowledged.

**SOP lifecycle.** `server/sopGovernance.ts` enforces a formal state machine (`draft → in_review → approved → published → training_assigned → acknowledged → active → retired`) with illegal transition guards. SOP-level status is stored on `sop_documents.status`.

### Classification

**READY_WITH_MINOR_GAP**

Goals, check-ins, probation, PIP, and training assignments all have status fields, due dates, owner linkages, and completion evidence. The minor gap is SOP-to-employee acknowledgement: the current implementation uses training track completion as the proxy for SOP acknowledgement rather than a direct per-employee SOP sign-off record. For the governance MVP this means SOP compliance must be queried via `track_assignments` rather than a single `sop_acknowledgements` table. This is workable but requires a two-hop query and breaks if a SOP exists without a linked published training track.

---

## Section 3 — Notification vs. Action Completion

### What was inspected

- `server/notifications.ts` — centralized notification gateway
- `server/scheduler.ts` — all plan-related cron jobs (lines 500–1547)
- `shared/schema.ts` — `check_ins` notification columns
- `shared/notificationTypes.ts` — preference key mapping

### What was found

**Notification infrastructure.** `server/notifications.ts` provides `notifyUser()` as a fire-and-forget gateway. It writes to the `notifications` table (in-app) and optionally dispatches email via `dispatchAutomatedEmail`. The function returns `{ inApp: boolean; email: boolean }` to indicate delivery but does not link the notification record back to a required action.

**Scheduled notification flows.** The scheduler distinguishes multiple notification types with dedicated tracking columns on the `check_ins` table:

| Event | Tracking column | What it marks |
|---|---|---|
| Day-before employee reminder | `notified_at` | Reminder sent |
| Same-day manager reminder | `manager_notified_at` | Reminder sent |
| Overdue reminder (daily) | `overdue_reminded_on` | Reminder sent date |
| Milestone escalation | `milestone_escalated_at` | Escalation sent |
| Strike (3-miss) escalation | `strike_escalated_at` (on `employee_plans`) | Escalation sent |

**Action completion tracking.** Separate columns on `check_ins` record actual completion:

| Completion signal | Column |
|---|---|
| Manager completes check-in | `status = 'completed'`, `completedAt` timestamp |
| Probation score submitted | `reviewScores` JSONB populated |
| Rating given | `rating` integer populated |

**Are they the same event?** No — they are structurally separate states. `notified_at` (a reminder was sent) and `completedAt` (the action was done) are distinct columns. The scheduler's overdue sweep only fires when `status != 'completed'` — confirming that the system already treats "sent" and "done" as independent states.

**Gap.** There is no formal **action-required record** that is created when a check-in becomes due and then explicitly **closed** when completed. The current model is: check-in row is seeded in `scheduled` status → notification sent (marked on a separate column) → manager manually updates status to `completed`. There is no join table or ledger that says "action X was required, notification Y was sent, action was closed by user Z at time T." This closed-loop traceability must be constructed at query time by joining `check_ins.notified_at` with `check_ins.completedAt`. It exists in the data but not as a first-class record.

### Classification

**READY_WITH_MINOR_GAP**

"Notification sent" and "action completed" are trackable as separate states from existing DB columns. The gap is that there is no closed-loop action-record with a formal open/close lifecycle. The governance MVP will need to surface these as a derived view rather than a dedicated action ledger. Recommended (but not blocking) to introduce a `governance_actions` table in the MVP build to make this explicit.

---

## Section 4 — Auditability of Probation, PIP, and Manager Check-ins

### What was inspected

- `server/vaultAudit.ts` — vault-specific audit log writer
- `shared/schema.ts` — `auditLogs`, `onboardingAuditEvents`, `check_ins`, `employee_plans` table definitions
- `server/performanceRoutes.ts` — `createAuditLog` call sites

### What was found

**`audit_logs` table.** Generic table with columns: `actorId`, `targetId` (both reference `adminUsers`), `action` (varchar), `changes` (JSONB), `createdAt`. It is systematically written to by `performanceRoutes.ts` via a local `createAuditLog` helper.

**What is actually audited.** `server/performanceRoutes.ts` calls `createAuditLog` for a comprehensive set of state transitions:

| Audit event | Trigger |
|---|---|
| `check_in_created` | Manual check-in scheduled |
| `check_in_updated` | Any update to a check-in (status, notes, rating) |
| `plan_check_in_completed` | Check-in status set to completed |
| `employee_plan_created` | New plan created |
| `employee_plan_updated` | Any update to a plan (status, outcome, etc.) |
| `employee_plan_acknowledged` | Employee countersigns the plan |
| `performance_goal_created/updated/deleted` | Goal lifecycle events |
| `goal_milestone_created/updated/deleted` | Milestone lifecycle events |

The actor, target employee, and a `changes` JSONB payload are recorded for each event. This means the existence of every key transition can be confirmed from `audit_logs`.

**`vaultAuditLogs`.** Tracks credential-vault interactions only (reveal, copy, create, edit, archive). Not relevant to governance.

**`onboardingAuditEvents`.** Records bulk training assignment events. Individual training completions are tracked by `track_assignments.completedAt`.

**Largest gap — missing old-value capture.** The `check_in_updated` and `employee_plan_updated` audit events record the new values being written (e.g., `changes: { rating: 4, status: "completed" }` from `req.body`) but do NOT capture the **old values** that were overwritten. If a manager edits a check-in rating from 3 to 5 and then to 4, the audit log will show two `check_in_updated` entries — each with the new value — but the sequence `3 → 5 → 4` cannot be reconstructed because the pre-edit value was never captured. This is the forensic limitation, not an absence of transition logging.

Concretely: a probation process **can** be reconstructed (who created the plan, when each check-in was completed, who completed it, what score was submitted, what the final outcome was). What **cannot** be reconstructed is whether any of those values were changed after initial submission, and what the original values were.

**What CAN be reconstructed today.**
- Was a check-in scheduled? — YES (`check_in_created` audit entry + `check_ins.scheduledDate`)
- Was it completed and when? — YES (`plan_check_in_completed` entry + `check_ins.completedAt`)
- What was the final rating/score? — YES (from `check_ins.rating` / `reviewScores`)
- Did escalations fire? — YES (`milestoneEscalatedAt`, `strikeEscalatedAt` columns)
- What was the final plan outcome? — YES (`employee_plans.outcome`)
- Who created and acknowledged the plan? — YES (`employee_plans.createdBy`, `acknowledgedBy`)

**What CANNOT be reconstructed today.**
- Were any values edited after initial submission? — Undetectable
- What were the values before an edit? — Not recorded (old-value capture absent)

### Classification

**NEEDS_EXTENSION**

Transition-level audit events exist for all key governance actions. The gap is forensic-grade immutability: the `changes` JSONB records new values only, not old values. For legally sensitive records (probation outcomes, PIP scores) this means the audit trail can confirm that transitions happened but cannot detect or disprove post-hoc edits to submitted data. An old-value/new-value capture pattern (or an immutable append-only event store) must be introduced in the MVP build before these records can be considered legally defensible. This is the most significant gap identified in the scan.

---

## Section 5 — AI Privacy: Employee PII in Prompts

### What was inspected

- `server/services/aiDraftService.ts` — Content Studio AI generation (article drafts, social kits, release notes, quality review)
- `server/replit_integrations/chat/routes.ts` — conversational AI chat
- `shared/studioAi.ts` — schema definitions, compliance guardrails, brand voice composition

### What was found

**`aiDraftService.ts` — Content Studio.** All AI calls go through the Replit AI Integrations OpenAI-compatible endpoint (`AI_INTEGRATIONS_OPENAI_*` env vars). Data assembled into prompts:

| Param | Source | Contains employee PII? |
|---|---|---|
| `brand_name`, `brand_tagline`, `brand_voice` | Hard-coded `DEFAULT_BRAND` constant | No |
| `topic`, `industry`, `platform`, `content_type` | User-selected in Studio UI | No |
| `author_name`, `author_title` | User-typed in Studio form | Name only (intentional, not restricted) |
| `userSuppliedFacts` | User-typed free text | Risk: user could paste PII voluntarily |
| `contentGoal`, `audience`, `marketContext` | Enum-selected in Studio UI | No |
| Release notes input: `changelogInput` | Raw git commit messages | Risk: commit messages may contain employee names |

No code path automatically injects HR records, salary data, leave balances, medical information, bank details, or any row from `admin_users` into a prompt. The architectural boundary between Content Studio and the HR/Payroll database is clean.

**Release notes security policy.** The system prompt injected into release notes generation explicitly states: *"NEVER include secrets, credentials, tokens, API keys… NEVER include file names, file paths, function names, table/column names, commit hashes… Skip purely internal or trivial changes."* This acts as an in-prompt filter but does not prevent commit messages carrying names from reaching the model; it only instructs the model not to reproduce them in output.

**`server/replit_integrations/chat/routes.ts` — Conversational chat.** Passes only the explicit message history stored in the `conversations`/`chatMessages` tables for the current session. There is no system prompt injected. No HR database tables are queried to enrich the context. Risk: a user could manually paste an employee's salary slip or personal data into the chat, which would then be sent to the external model. There is no guardrail warning users against this.

**`shared/studioAi.ts`.** A shared schema and compliance-guardrail module — defines JSON schemas, compliance mode constants, and brand voice templates. It is not itself an AI call site; it is referenced by `aiDraftService.ts`.

**Sensitive PII categories — assessment.**

| PII category | Architectural risk | Notes |
|---|---|---|
| Employee name | LOW | Only reaches AI if user types it (Studio) or via commit message text |
| Salary / compensation | NONE | No code path injects salary data |
| Medical / health information | NONE | No code path injects health data |
| Bank details | NONE | No code path injects bank details |
| TOTP secrets / passwords | NONE | Hash-only stored; never in prompts |
| Leave balances | NONE | No code path injects leave data |

### Classification

**READY_WITH_MINOR_GAP**

No call site currently passes salary, medical, or identity-document PII to an external AI provider automatically. The minor gaps are: (1) git commit messages passed to the release notes generator may contain employee names embedded in commit text — low probability and low sensitivity, but a scrubbing step is worth adding; (2) the conversational chat endpoint has no system prompt warning users not to paste restricted employee data. Neither gap requires blocking the MVP build.

---

## Final Recommendation

| Section | Classification |
|---|---|
| 1. Employee-Manager Hierarchy | **READY** |
| 2. Workflow Status (Goals / Check-ins / Training / SOPs / Probation / PIP) | **READY_WITH_MINOR_GAP** |
| 3. Notification vs. Action Completion | **READY_WITH_MINOR_GAP** |
| 4. Auditability of Probation / PIP / Check-ins | **NEEDS_EXTENSION** |
| 5. AI Privacy (Employee PII in Prompts) | **READY_WITH_MINOR_GAP** |

### **CLEARED TO BUILD MVP**

There are no BLOCKER items. The MVP build may proceed with the following prioritised requirements:

1. **(Auditability — must deliver in MVP)** Extend the audit log write pattern to capture old values alongside new values for every governance-critical update: `check_in_updated`, `employee_plan_updated`, and `performance_goal_updated`. The existing `createAuditLog` infrastructure is in place; the change needed is to load the pre-update row and include `{ before: oldRow, after: newRow }` in the `changes` JSONB. This closes the forensic gap without a new table. Without this, probation and PIP records are not forensically defensible against claims of post-hoc editing.

2. **(Action records — recommended for MVP)** Add a `governance_actions` table (or equivalent) that creates an explicit open/close record for each required action (check-in due → action created; check-in completed → action closed). This converts the current derived-state model to a first-class record and enables closed-loop reporting without complex joins.

3. **(SOP version history — post-MVP)** `sop_employee_progress` already provides direct per-employee SOP acknowledgement with cryptographic hashing. The residual gap is version history: the table stores one row per (sopMasterId, userId), so re-publication of a revised SOP overwrites the prior version's acknowledgement record in place. If proving "the employee acknowledged exactly v1 content before v3 was published" becomes a regulatory requirement, add a `sop_acknowledgement_history` append table. This is not needed for the MVP.

4. **(Chat guardrail — low priority)** Add a one-line system prompt to the conversational chat endpoint reminding users not to paste restricted employee data. Does not block the MVP.

5. **(Release notes commit scrub — low priority)** Before passing commit messages to the release notes AI, add a pre-processing step or post-processing filter. Does not block the MVP.
