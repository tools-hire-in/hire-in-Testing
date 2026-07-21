# HR Admin Guide — Feature Flags

**Audience:** super_admin (toggle); hr, admin (read/understand)
**Last updated:** 2026-07-21
**Related source doc:** `hr-admin-onboarding-track-source.md` Topic 6

---

## Purpose

This guide explains every feature flag in the platform, what turning it OFF does, what risks exist when toggling flags, and which role can actually make changes.

---

## Who Uses It

| Role | What they can do |
|---|---|
| `super_admin` | Toggle all feature flags |
| `admin` | View flags (read only) |
| `hr` | View flags (read only) |

Only `super_admin` can toggle flags. Changes take effect **immediately** for all users — there is no staging, preview, or confirmation step.

---

## Where to Find It

`/admin/settings/feature-flags`

---

## Important Principles Before Toggling

1. **Changes are instant and global.** Turning a flag OFF immediately hides or disables the feature for every user across the platform, regardless of role.
2. **No per-user or per-role scoping.** Feature flags are platform-wide. You cannot turn a feature OFF for some users but not others using flags.
3. **Data is preserved.** Disabling a feature hides its UI — it does not delete underlying records. Turning the flag back ON restores access to existing data.
4. **No undo button.** Toggle back to the previous state manually if you made a mistake.
5. **Three-place rule (for engineers).** Adding a new flag requires registering it in ALLOWED_FLAGS, flagDefs, and FLAG_DEFAULTS. Missing any one means the flag is permanently OFF with no warning.

---

## Flag Reference

### `salary_advance_enabled`

**What it controls:** Employee self-service salary advance requests.

| State | Effect |
|---|---|
| ON | Employees see the "Request Advance" button at `/admin/salary-advance` |
| OFF | The request button is hidden; employees cannot submit new advance requests |

**What is NOT affected:**
- HR manual recording of advances (via Active Advances → "Record for Employee") — this always works regardless of this flag
- Recovery of existing advances continues in payroll even when flag is OFF
- HR-initiated advances created when flag was OFF remain active

**When to turn OFF:** When you want to pause self-service requests during a payroll cycle freeze or policy review, without losing existing advance records.

---

### `notifications_enabled`

**What it controls:** The in-app notification centre.

| State | Effect |
|---|---|
| ON | Notification bell icon appears in the top bar; unread count badge shows; employees and managers receive in-app alerts |
| OFF | Bell icon is hidden for all users; no new in-app notifications are created |

**What is NOT affected:**
- Email notifications continue to be sent via SendGrid regardless of this flag
- Existing unread notification records are preserved

**When to turn OFF:** Temporary troubleshooting if the notification feed is causing performance issues.

---

### `onboarding_training_enabled`

**What it controls:** Assignment of new training tracks to employees.

| State | Effect |
|---|---|
| ON | Training tracks can be assigned to employees; employees see My Training content |
| OFF | New track assignments cannot be created; the training assignment UI is hidden |

**What is NOT affected:**
- Existing track assignments remain active and visible
- Employees already in progress on a track can continue
- SOP compliance is controlled by `process_governance`, not this flag

**When to turn OFF:** During a content review period when you do not want new training assignments being created.

---

### `performance_management_enabled`

**What it controls:** All Performance Management pages.

| State | Effect |
|---|---|
| ON | Performance pages are accessible: My Goals, Team Goals, Check-Ins, My Reviews, Team Reviews, Review Cycles, Feedback, Analytics |
| OFF | All Performance pages are hidden for all users |

**What is NOT affected:**
- Existing goals, check-ins, review cycles, and reviews are preserved in the database
- Data is immediately accessible again when the flag is turned back ON

**When to turn OFF:** If the performance module has not been configured yet (no review cycles set up) and you don't want users navigating to empty pages.

---

### `document_reminder_emails`

**What it controls:** Automatic document checklist reminder emails sent to employees with incomplete onboarding documents.

| State | Effect |
|---|---|
| ON | System sends scheduled reminder emails to employees who haven't completed their document checklist |
| OFF | No reminder emails are sent; employees must be followed up with manually |

**What is NOT affected:**
- The document checklist itself remains visible to employees
- HR can still manually email employees about missing documents

**When to turn OFF:** When you are doing a bulk onboarding batch and want to manually manage the reminder cadence, or when the email content needs updating.

---

### `new_look`

**What it controls:** The v2 UI redesign (global kill-switch).

| State | Effect |
|---|---|
| ON | Users who have opted in (per-user `preferences.newLook = true`) see the v2 redesigned UI |
| OFF | ALL users see the classic UI, regardless of their individual preference |

**Important:** This flag is a master kill-switch. When OFF, even users who have opted into the new look are forced back to the classic UI. When ON, only users who have individually opted in see v2.

**When to turn OFF:** Emergency rollback if the v2 UI has a critical issue affecting all opt-in users.

---

### `studio_v2_enabled`

**What it controls:** The new Content Studio routing.

| State | Effect |
|---|---|
| ON | Studio URLs resolve to the new `/studio/*` path |
| OFF | Studio URLs redirect back to the legacy `/admin/studio/*` path |

**When to turn OFF:** If the new studio has a release issue and you need to redirect users to the stable legacy version.

---

### `process_governance`

**What it controls:** The SOP Library and Compliance pages.

| State | Effect |
|---|---|
| ON | SOP Library (`/admin/sops`), Compliance view, and the compliance lock mechanism are all active |
| OFF | SOP and compliance pages are hidden for all users; compliance lock does not activate |

**What is NOT affected:**
- Existing SOP content and acknowledgement records are preserved
- Records are accessible again when the flag is turned back ON

**When to turn OFF:** If the SOP rollout needs to be paused platform-wide (e.g., major content revision in progress).

---

## Toggle Checklist

Before toggling any flag, ask:
1. Who will be immediately affected, and are they expecting this change?
2. Is there a payroll run in progress? (Avoid toggling `salary_advance_enabled` mid-run)
3. Are there employees currently locked in the compliance gate? (Avoid toggling `process_governance` ON/OFF while employees are mid-acknowledgement)
4. Have you communicated the change to affected users if needed?

---

## Quick Reference

| Flag | What OFF does | Data preserved? | Who is affected |
|---|---|---|---|
| `salary_advance_enabled` | Hides self-service advance request button | Yes — existing advances continue | Employees (request only) |
| `notifications_enabled` | Hides notification bell for all users | Yes — unread notifications preserved | All users |
| `onboarding_training_enabled` | Stops new track assignments | Yes — existing assignments active | HR (assignment), all employees |
| `performance_management_enabled` | Hides all Performance pages | Yes — all records preserved | All users |
| `document_reminder_emails` | Stops automatic reminder emails | N/A — no records involved | New hire onboarding flow |
| `new_look` | Forces all users to classic UI | N/A — preference stored, just ignored | All users (opt-in overridden) |
| `studio_v2_enabled` | Redirects studio to legacy path | N/A — route change only | Studio users |
| `process_governance` | Hides SOP library and disables compliance lock | Yes — SOP records preserved | All users (SOP/compliance) |

---

## Where to Get Help

- Feature flag three-place registration rule (for engineers): `docs/engineering/ENGINEERING_RUNBOOK.md` §Feature Flags
- SOP compliance: `hr-admin-guide-sop-wave.md`
- For flag changes during business hours: coordinate with super_admin
