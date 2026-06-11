---
name: Goal milestones & auto-progress
description: How performance-goal milestones drive progress, and the manual-vs-auto split
---

# Goal milestones & auto-progress

Performance goals can have ordered milestones (`goal_milestones` table). A goal's
`auto_progress_from_milestones` flag, when on, makes `recomputeGoalProgress()`
set `progress = round(done/total * 100)` after any milestone create/toggle/delete
and when the flag is flipped on.

**Rule:** auto-progress recompute touches **progress only — never `status`**.
Status stays a fully manual field even when auto-progress is enabled.

**Why:** the task explicitly required keeping the lifecycle/status manual while
optionally letting milestone completion drive the numeric progress bar. Mixing
status into the recompute would silently override deliberate manager/owner status
choices (e.g. marking a goal at_risk).

**How to apply:** any new code that changes milestone done-state must call
`recomputeGoalProgress(goalId)`; do not add status mutation there. Access control
for milestone/goal-check-in endpoints goes through `getAccessibleGoal(userId, role,
goalId)` which permits the goal owner, ADMIN_ROLES, and the owner's manager.

Annexure "push to goals" supports two modes via `AnnexureGoalPush.asMilestones`:
one-goal-per-row (default) or one goal whose milestones are the selected rows.
The shared mapper is `buildGoalsFromAnnexures()` in `AnnexureEditor.tsx`, reused by
both HRTools and LetterGenerator push flows — keep them on that helper, don't
re-inline the row loop.
