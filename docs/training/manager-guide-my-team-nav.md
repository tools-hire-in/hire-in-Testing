# Manager Guide — My Team Navigation

**Audience:** manager
**Last updated:** 2026-07-21
**Related source doc:** `manager-onboarding-track-source.md` Topic 1

---

## Purpose

This guide explains the My Team section layout, what each area shows, and how to navigate between views without confusion — including why the nav is in the sidebar rather than as horizontal tabs.

---

## Who Uses It

| Role | Scope |
|---|---|
| `manager` | Own direct reports only |
| `hr`, `admin`, `super_admin` | All employees |

---

## Where to Find It

`/admin/hr/my-team`

Navigate using the **sidebar sub-navigation** — not horizontal tabs at the top of the page.

---

## My Team Layout — Three Views

My Team is organized into three views accessed via the sidebar:

### 1. Team
**Path:** `/admin/hr/my-team` (default view)

Shows the **roster of your direct reports** with real-time status:

| Column | What it shows |
|---|---|
| Name | Employee name and avatar |
| Status | present / absent / on_leave / on_lunch / on_tea |
| Hours today | Accumulated hours since punch-in |
| Leave balance | EL and SL remaining |

Click any employee row to see their full profile: attendance history, leave history, and contact details.

This view updates live — you can see at a glance who is working, on break, or away.

### 2. Corrections
**Path:** `/admin/hr/my-team?section=corrections` (via sidebar link)

The **punch correction form** for your direct reports. Use this to fix incorrect or missing attendance records within the 3-day window.

See `manager-guide-attendance-correction.md` for full instructions.

### 3. Plans
**Path:** `/admin/hr/my-team?section=plans` (via sidebar link)

Shows **all active employee development plans** for your direct reports: probation, PIP, and growth plans.

Displays:
- Plan type (Probation, PIP, Growth)
- Start date and end date
- Current status (active, escalated, extended, completed, etc.)
- Next due check-in date

Click a plan row to open the full plan, complete check-ins, add coaching notes, or set an outcome.

See `manager-guide-employee-plans.md` for full instructions.

---

## Why Sidebar Navigation, Not Tabs

My Team uses **sidebar sub-navigation** rather than horizontal tabs at the top of the page. This is a deliberate design choice:

- The Team, Corrections, and Plans views are distinct destinations, not sub-views of the same page
- Sidebar navigation allows deep-linking (each section has its own URL)
- It avoids nested tabs, which can be confusing when sub-pages themselves have their own tabs

When you navigate to Corrections or Plans, you are navigating to a separate section — the URL in your browser changes. Use the browser Back button or the sidebar link to return to Team.

---

## Scope — Who You Can See

Your team scope is determined by the `manager_id` field on each employee's record. You can only see employees where **your user ID is recorded as their direct manager**.

| If you see... | It means... |
|---|---|
| All your expected direct reports | Reporting relationships are set correctly |
| Zero employees | Your user ID is not set as `manager_id` for any employee — contact HR |
| Some missing employees | `manager_id` not set for those employees — contact HR |

**HR and admin roles see all employees** regardless of reporting relationships. If you are an HR user, you are not limited to a specific team.

---

## Team Status Badges

In the Team view, each employee shows a status badge:

| Badge | Meaning |
|---|---|
| `present` | Punched in, not on break |
| `absent` | Not punched in today (workday) |
| `on_leave` | On approved leave today |
| `on_lunch` | Currently in a lunch break |
| `on_tea` | Currently in a tea break |
| `pending_leave` | Leave request submitted but not yet approved for today |

`on_lunch` and `on_tea` badges are visible in real time. They disappear when the employee ends their break.

---

## Quick Navigation Reference

| Task | Where to go |
|---|---|
| See who is in / out today | My Team → Team tab |
| See an employee's leave balance | My Team → Team → click employee row |
| Correct a missed punch | My Team → Corrections (sidebar) |
| Review or complete a check-in | My Team → Plans (sidebar) → click plan |
| Add a coaching note | My Team → Plans → open plan → Add Coaching Note |
| Set a plan outcome | My Team → Plans → open plan → Set Outcome |

---

## Common Mistakes

**"I can't find the Plans section — there are no tabs at the top."**
My Team navigation is in the sidebar, not as horizontal tabs. Look for the sub-navigation items in the left sidebar panel under "My Team".

**"My team is empty — no employees show."**
Your `manager_id` is not linked to any employees. Contact HR to set up the reporting relationship for your direct reports.

**"I can see an employee in the Team view but not in Plans."**
That employee may not have an active plan. Plans only appear in the Plans view if a probation, PIP, or growth plan exists. If they should have a probation plan and don't, contact HR — the plan should have been seeded at offer acceptance.

**"I accidentally navigated to the Corrections section from Plans — where am I?"**
Check the sidebar — the active section is highlighted. The URL will also show the section (e.g., `?section=corrections`). Click the Team or Plans link in the sidebar to return.

---

## Where to Get Help

- Attendance corrections: `manager-guide-attendance-correction.md`
- Employee plans: `manager-guide-employee-plans.md`
- Leave approvals: `manager-guide-leave-approval.md`
- For reporting relationship updates: contact HR
