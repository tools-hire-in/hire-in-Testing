---
name: Settings vs Control Tower vs My Growth — single home per config
description: Where each cross-cutting admin config lives, and the access/parity rules that constrain moving them.
---

Each cross-cutting admin config has ONE home; don't re-add a second copy elsewhere.
- System Settings → only Leave & Attendance + Organization groups.
- Control Tower → Feature Flags (incl. Training toggle), Access Control, Data Maintenance, Audit Logs, Communications, Automated Changes, Users.
- My Growth → Goal Templates + Performance (settings), Rayo Academy (training mgmt).

**Why:** these were duplicated across Settings and Control Tower (Control Tower even embedded the whole Settings page). De-dup gives one canonical home each.

**Access-parity trap (learned the hard way):** Control Tower is super-admin-only, but **Data Maintenance is super_admin + hr**. Moving an hr-accessible feature into a super-admin-only surface silently removes hr access. Before relocating ANY config, check the moved section's own internal role gate and preserve that audience. The fix kept Data Maintenance in Control Tower but lets hr in for that one tab (role-filtered tab list) with its own correctly-labelled nav entry — Control Tower itself stays super-admin-only for everything else.

**How to apply:**
- A config's reachable audience = its host page's access gate ∩ the section component's own internal role check. Both must still admit the prior audience after a move.
- Legacy `?tab=` deep-links must keep resolving to the new home — both the in-app settings redirect and any moved-away Control Tower tab (e.g. the old `system-settings` tab now redirects out to System Settings). When you remove a tab/section, add/verify its redirect AND a unit test.
- Prefer extracting access decisions (allowed tabs per role, legacy redirects) into a pure helper so they're unit-testable without rendering React.
