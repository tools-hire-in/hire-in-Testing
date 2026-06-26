---
name: My Team nav flattening
description: Why /admin/hr/my-team uses sidebar sub-nav instead of horizontal tabs, and the one-tab-level rule.
---

# My Team navigation model

The My Team page (`/admin/hr/my-team`, component `MyTeamTabs`) presents its
destinations as **left-nav sub-items in the sidebar** (a collapsible `TeamSection`
in `AdminLayout`), NOT as a horizontal tab row. It mirrors the My Desk
(`CommandCenterSection` + `MyDesk`) and Settings (`SettingsSection`) pattern:
sub-items link to `?tab=<section>`, and the page reads the active section reactively
via wouter's `useSearch()`.

**Why:** Phase-1 navigation rule = at most ONE level of horizontal tabs per page;
no tabs-inside-tabs. My Team has ~8 manager destinations (Team, Attendance,
Exceptions, Overtime, Leave Approvals, Training, Month Approval, Req. Approvals) —
too many for one tab row, so they were promoted to sidebar sub-categories instead.

**How to apply:**
- Because page-level nav lives in the sidebar (not a horizontal tab bar), a child
  destination may keep its OWN single level of horizontal tabs and still satisfy
  the rule. `MyTeam` (the "Team"/overview destination) keeps its internal
  Team/Corrections/Plans tab bar for this reason — that is allowed, do NOT flatten
  it into the top level.
- `TeamAttendance` takes an optional `view` prop ("attendance"|"exceptions"|"overtime").
  When set it renders one view with no internal `TabsList`; with no prop (standalone
  `/admin/hr/team-attendance` route) it shows all three internal tabs.
- Deep-link aliases for retired nested params are normalized in BOTH places:
  `MyTeamTabs` (TAB_ALIASES) and `TeamSection` active-state logic —
  exception-review→exceptions, overtime-alerts→overtime, team-attendance→attendance.
- `MyTeam`'s own `?tab=corrections|plans` still works: `MyTeamTabs` treats unknown
  tabs as "overview" and renders `MyTeam`, which reads `?tab=` itself.
