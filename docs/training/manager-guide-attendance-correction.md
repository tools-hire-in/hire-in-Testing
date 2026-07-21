# Manager Guide — Attendance Correction

**Audience:** manager, hr, admin, super_admin
**Last updated:** 2026-07-21
**Related source doc:** `manager-onboarding-track-source.md` Topic 4

---

## Purpose

This guide explains how to view your team's attendance, make direct punch corrections within the 3-day window, and handle correction requests that are outside that window.

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

- Corrections form: `/admin/hr/my-team` → **Corrections** tab
- Team attendance view: `/admin/hr/my-team` → **Team** tab

---

## Two Types of Attendance Issues

| Issue type | What it means | Who resolves |
|---|---|---|
| **Punch correction** | A punch-in or punch-out time is wrong or missing | Manager directly (within 3 days) |
| **Regularization** | Employee couldn't punch due to a system issue, power outage, travel, etc. | Employee raises a Help Desk ticket; HR reviews |

Managers handle punch corrections directly. Regularizations go through Help Desk.

---

## Viewing Team Attendance

1. Go to `/admin/hr/my-team` → **Team** tab.
2. You see your direct reports with their attendance status for today:
   - Status badges: `present`, `absent`, `on_leave`, `on_lunch`, `on_tea`
3. Click on an employee row to see their attendance records for the month.
4. Review punch-in/out times, break records, and total hours.

Managers can also see which employees are currently on lunch or tea break via the status badges in real time.

---

## Step-by-Step: Making a Punch Correction (Within 3 Days)

1. Go to `/admin/hr/my-team` → **Corrections** tab.
2. **Select the employee** from the dropdown.
3. **Select the date** to correct. Only dates within the last 3 calendar days are available.
4. The current punch-in and punch-out times are shown.
5. Enter the correct time(s):
   - Correct punch-in: change the in-time
   - Correct punch-out: change the out-time
   - Both missing: enter both
6. Click **Submit Correction**.

An **audit log entry** is created with:
- Your name as the corrector
- Employee name
- Date corrected
- Old punch times
- New punch times

This cannot be undone through the UI. If a correction itself needs correction, submit a second correction — each correction is logged separately.

---

## The 3-Day Correction Window

Managers can only directly correct attendance records that are **3 calendar days old or fewer**.

| Date of missed punch | Manager can correct? |
|---|---|
| Today | Yes |
| Yesterday | Yes |
| 2 days ago | Yes |
| 3 days ago | Yes (edge of window) |
| 4+ days ago | No — employee must raise Help Desk ticket |

The 3-day limit exists because attendance records older than 3 days may already be factored into payroll processing or attendance reports.

---

## Handling Corrections Outside the 3-Day Window

If an employee needs a correction for a record older than 3 days:

1. The employee goes to `/admin/help-desk` and raises a regularization ticket.
2. The ticket specifies the date, the correct punch times, and the reason for the late request.
3. HR reviews the ticket and applies the correction via the audit review queue.
4. The employee receives notification when the correction is processed.

As a manager, you may be asked to endorse the employee's regularization ticket — check your Help Desk queue.

---

## Correction vs. Regularization — When to Use Each

| Scenario | Use |
|---|---|
| Employee forgot to punch in this morning | Punch correction (manager, within 3 days) |
| Employee's punch-in time is wrong from 2 days ago | Punch correction (manager, within 3 days) |
| Employee worked remotely last week and couldn't access the punch system | Regularization ticket via Help Desk |
| Employee was marked absent for a date 2 weeks ago they actually worked | Regularization ticket via Help Desk |
| Employee's entire last month has missing punches due to a system issue | Regularization ticket via Help Desk (bulk correction; HR handles) |

---

## Common Mistakes

**"I tried to correct a punch from 5 days ago but the date isn't available in the dropdown."**
The 3-day window has passed. The employee must raise a regularization ticket via Help Desk. Contact HR if it's urgent.

**"I entered the wrong correction — can I undo it?"**
No undo is available. Submit a new correction with the correct times — each correction is audited. If you're unsure of the correct times, check with the employee before submitting.

**"An employee says they punched in but the system shows absent."**
First check if the punch record exists — sometimes punch-outs are missing rather than punch-ins. Go to the employee's attendance record for that date. If both are genuinely missing, make the correction within 3 days or ask the employee to raise a Help Desk ticket.

**"A break record is wrong — can I correct that too?"**
The Corrections tab handles punch-in/punch-out records. Break record corrections go through HR — contact HR directly for break record adjustments.

---

## Quick Reference

| Rule | Detail |
|---|---|
| Correction window | 3 calendar days from the attendance date |
| After 3 days | Employee raises Help Desk regularization ticket |
| Audit trail | Every correction logged with corrector name, old/new times |
| Undo | Not available — submit a second correction |
| Scope | Managers: own direct reports only |
| Break records | HR handles, not manager corrections |

---

## Where to Get Help

- Attendance rules: `docs/workflows/BUSINESS_RULES_CATALOGUE.md` §Attendance
- Attendance state machine: `docs/workflows/WORKFLOW_STATE_MACHINES.md` §3
- For regularizations: HR via Help Desk at `/admin/help-desk`
