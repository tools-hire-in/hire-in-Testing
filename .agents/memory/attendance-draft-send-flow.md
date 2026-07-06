---
name: Attendance report draft/send flow
description: How manual attendance runs are held as drafts and the pitfalls when adding a notified_at "sent" flag
---

# Attendance report preview-before-email (draft) flow

Manual attendance report generate/regenerate no longer emails managers on
creation. A run is a DRAFT while `attendance_report_runs.notified_at IS NULL`;
HR reviews the month then POSTs `/runs/:id/send-for-approval` which restarts the
24h deadline and emails managers. `notifyManagersForRun` sets
`notified_at = COALESCE(notified_at, NOW())` on any real (non-reminder) send.

**Rule:** every path that emails managers must check `notified_at` first, or it
will leak emails on an un-sent draft. There are MANY such paths:
- global per-request `/api/hr` reconcile hook (throttled) — auto-notifies new managers
- status endpoint auto-sync — auto-notifies new managers
- `notify-missed` and `resend-approval` endpoints
- scheduler T-2h reminder cron + processExpiredDeadlines (must skip `notified_at IS NULL` or a draft auto-expires on its generation-time deadline)
The automated month-end path (`ensureRunForMonthAndNotify`) is exempt — it IS the
auto-send, and it must mark `notified_at` even when there are zero managers, else
an automated run is mislabeled a forever-draft.

**Why:** a code review REJECTED a version that added `notified_at` because the
ensure-block backfill `UPDATE ... SET notified_at = created_at WHERE notified_at
IS NULL` ran on EVERY boot, flipping every fresh draft to "sent" on restart.

**How to apply:** one-time backfills for a newly-added "state" column must be
guarded by a `system_settings` marker key (pattern: SELECT marker; if absent,
run UPDATE + INSERT marker ON CONFLICT DO NOTHING). Never leave an unconditional
UPDATE-where-null in a startup ensure block if NULL is a legitimate live state.

Option A (chosen): drafts are only email-held; managers can still SEE/act on a
draft via my-run/my-team (those endpoints intentionally NOT gated). Option B
(hide drafts from managers + block approve on draft) is follow-up work.
