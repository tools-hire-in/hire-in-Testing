---
name: My Desk router & embedded sub-pages
description: How /admin/my-desk routes its sub-tabs and the shared `tab` URL param collision gotcha
---

# My Desk (Command Center) routing

- Live employee home is `/admin/my-desk` → `MyDesk.tsx`. Default view (`?tab` absent) renders `CommandCenter.tsx`; `?tab=time-card|time-off|leave-calendar|regularizations` renders the embedded HR sub-pages (`Attendance`, `LeaveManagement`, `HolidayCalendar`, `MyRegularizations`).
- `MyWork.tsx` and `HRDashboard.tsx` are **dead code** (imported but unrouted; `/admin/hr` redirects to my-desk). The dashboard break controls users actually see are `CommandCenter`'s inline `BreakChips`, not the full `BreakWidget`. The full `BreakWidget` only appears on the Time Card tab (`Attendance.tsx`) and inside dead `HRDashboard`.
- `AdminLayout` self-dedupes nesting via the `AdminLayoutMounted` context, so sub-pages can keep their own `<AdminLayout>` wrapper while embedded — no double sidebar.

## Shared `tab` param collision (the bug that bounced Grace Period → Dashboard)
**Rule:** an embedded sub-page must NOT write to the parent's `tab` URL search param for its own internal tabs.

**Why:** `MyDesk` derives its active view from `?tab=` via wouter's `useSearch()` (reactive — wouter patches history.replaceState/pushState to emit nav events). `Attendance.tsx` had internal tabs (My Attendance / Grace Period Usage) that wrote `?tab=grace` via `window.history.replaceState`. `grace` isn't a MyDesk tab, so MyDesk recomputed activeTab=null and swapped Attendance out for the CommandCenter dashboard.

**How to apply:** give each embedded sub-page a private param namespace (Attendance now uses `att`, not `tab`). Any future sub-page with its own tab strip must do the same.
