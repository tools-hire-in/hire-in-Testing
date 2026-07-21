# Manager Guide — Employee Plans (Probation, PIP, Growth)

**Audience:** manager, hr, admin, super_admin
**Last updated:** 2026-07-21
**Related source doc:** `manager-onboarding-track-source.md` Topic 3

---

## Purpose

This guide explains how to manage probation plans, PIP (Performance Improvement Plans), and growth plans for your direct reports. It covers the 8-milestone probation cadence, what each check-in type means, how to record outcomes, and what escalation looks like.

---

## Who Uses It

| Role | Scope |
|---|---|
| `manager` | Own direct reports only |
| `hr` | All employees |
| `admin` | All employees |
| `super_admin` | All employees |

---

## Where to Find It

`/admin/hr/my-team` → **Plans** tab (sidebar sub-navigation)

---

## Plan Types

| Plan Type | When it applies | Who creates it |
|---|---|---|
| **Probation** | All new hires for the first 90 days | Seeded automatically at offer acceptance |
| **PIP** | When performance improvement is required | Created by HR or manager |
| **Growth** | Structured development path post-probation | Created at offer acceptance or promoted by HR |

---

## The Probation Plan — 8-Milestone Cadence

Probation plans auto-generate **8 check-in milestones** from the plan's start date:

| Milestone | Day | Type |
|---|---|---|
| Check-in 1 | Day 1 | Introductory |
| Check-in 2 | Day 7 | Weekly |
| Check-in 3 | Day 15 | Bi-weekly |
| Check-in 4 | Day 30 | **Formal milestone review** |
| Check-in 5 | Day 45 | Mid-point |
| Check-in 6 | Day 60 | **Formal milestone review** |
| Check-in 7 | Day 75 | Pre-final |
| Check-in 8 | Day 90 | **Formal milestone review** |

Days 30, 60, and 90 are formal milestone reviews. They require a numeric score (1–5) and are used in the plan outcome evaluation.

---

## Step-by-Step: Completing a Check-In

1. Go to `/admin/hr/my-team` → Plans tab.
2. Click the employee's active plan.
3. Find the overdue or upcoming check-in row (sorted by due date).
4. Click **Complete Check-In**.
5. Enter:
   - **Notes** — your observations about the employee's performance and progress
   - **Rating** (1–5) — overall performance rating for the period
   - **Observations** — specific behaviors observed (may prompt structured fields depending on plan type)
6. For Day 30, 60, and 90 milestones: add the formal **milestone review score**.
7. Click **Submit**.

The employee can view your notes after you submit the check-in.

---

## Step-by-Step: Recording a Plan Outcome

At the end of the probation period (typically Day 90), set the plan outcome:

1. Open the plan.
2. Click **Set Outcome**.
3. Choose from:
   - **Passed** — employee has met probation requirements; moves to full employment
   - **Extended** — probation extended (requires HR review); new end date is set
   - **Failed** — employee has not met probation requirements; HR is notified for exit process
   - **Converted to Growth** — probation converted to a growth development plan
   - **Terminated** — employment ended during probation

4. Enter a reason or summary.
5. Confirm. The outcome is **locked** after setting and cannot be changed through the UI.

**For failed or terminated outcomes:** notify HR before setting the outcome — HR must be involved in exit proceedings.

---

## PIP Plans

PIP plans are used when a confirmed employee needs structured improvement support.

- **Check-in cadence:** Weekly (auto-generated for the plan duration)
- **Duration:** Set at plan creation (typically 30–90 days)
- **Outcome options:** Same as probation (Passed, Extended, Failed, Terminated)

PIP plans should only be created after a documented performance conversation. HR must be involved in the creation process.

---

## Growth Plans

Growth plans are development-focused plans without a pass/fail outcome.

- Seeded at offer acceptance for some hire types (alongside probation)
- Created manually by HR for high-potential employees post-probation
- Check-in cadence is configurable
- No automatic failure outcome — focus is development tracking

Growth plans are activated when the signed growth-clause addendum is countersigned. If a growth plan shows status `pending` and no employee_id, it is waiting for the onboarding process to complete — this is expected and resolves automatically.

---

## Coaching Log Entries

Coaching log entries are **separate from plan check-ins**. They are informal ad-hoc notes you can record at any time:

1. Open the employee's plan.
2. Click **Add Coaching Note**.
3. Enter your observations.
4. Save.

Coaching notes do not count toward the check-in cadence. They do not affect milestone scoring. They are stored in the audit trail and are visible to HR.

---

## Escalation — 3 Consecutive Missed Check-Ins

If 3 consecutive check-ins are missed (not completed by their due date), the plan status is escalated:
- HR receives an escalation notification
- The plan status changes to `escalated`
- You receive a notification

**To prevent escalation:** complete check-ins by their due date. If you need more time (e.g., the employee was on leave), contact HR to adjust the due date rather than letting check-ins go overdue.

---

## About Plans with NULL employee_id

Plans seeded at offer acceptance will show `employee_id = NULL` until the candidate is formally onboarded. This is **expected** — not a data error. The plan resolves when HR clicks Onboard for the candidate. Do not delete or recreate plans with NULL employee_id.

---

## Common Mistakes

**"I can't find an employee's plan — their name isn't showing in Plans."**
Check that your user ID is set as their `manager_id`. If not, you cannot see their plan. Contact HR to set the reporting relationship. HR roles see all plans regardless of reporting line.

**"I set the outcome as Failed but the employee is still in the system."**
Setting a "Failed" outcome notifies HR — it does not automatically terminate the employee's account. HR must process the exit separately. Follow up with HR immediately after recording a failed outcome.

**"I completed a check-in but didn't add a formal score for Day 30."**
Day 30, 60, and 90 check-ins require a formal milestone score. If the check-in was submitted without it, contact HR — they can add a corrective note to the plan record.

**"The plan shows 'seeded at offer acceptance' but the employee started 2 weeks ago."**
This is correct. Probation plans are created when the offer is accepted. The start date aligns with the employee's joining date, not the acceptance date. The Day 1 check-in is triggered by the joining date, not the plan creation date.

---

## Quick Reference

| Plan type | Check-in cadence | Formal milestones |
|---|---|---|
| Probation | Day 1, 7, 15, 30, 45, 60, 75, 90 | Day 30, 60, 90 |
| PIP | Weekly | None (all are formal) |
| Growth | Configurable | Configurable |

| Outcome | Meaning |
|---|---|
| Passed | Employee confirmed in role |
| Extended | More time needed; new end date |
| Failed | Requirements not met; HR notified for exit |
| Converted to Growth | Transitions to development plan |
| Terminated | Employment ended |

| Rule | Detail |
|---|---|
| Escalation trigger | 3 consecutive missed check-ins |
| Outcome lock | Permanent after setting |
| NULL employee_id | Expected for plans seeded at offer acceptance |
| Coaching log | Informal; separate from check-in cadence |

---

## Where to Get Help

- Employee plan state machine: `docs/workflows/WORKFLOW_STATE_MACHINES.md` §8
- Check-in lifecycle: `docs/workflows/WORKFLOW_STATE_MACHINES.md` §11
- Probation business rules: `docs/workflows/BUSINESS_RULES_CATALOGUE.md` §Employee Plans
- For exit proceedings: contact HR before recording Failed or Terminated outcomes
