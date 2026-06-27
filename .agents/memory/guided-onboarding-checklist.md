---
name: Guided onboarding checklist (non-blocking)
description: How the new-hire onboarding checklist + annexure→policy bridge work, and the non-blocking rule.
---
# Guided onboarding checklist

Onboarding is **informational/nudge only — it must NEVER block Punch In/Out or navigation.** The old AdminLayout hard-redirect to `/admin/policy-gate` was removed; the policy gate is now reachable from the dashboard checklist but never forced.

- Source of truth for checklist status: `server/onboardingChecklist.ts` `computeOnboardingChecklist(userId, role)` — shared by the GET `/api/onboarding/checklist` endpoint, the AdminLayout nav badges, and the weekly reminder cron. Keep all three using this one function.
- Personal items (profile/linkedin/headshot/bank/emergency/documents) are `applicable` only for role `employee`; policies + 2FA apply to everyone. `complete`/`overallPct` are computed over applicable items only.
- Self-service profile extras saved via PATCH `/api/onboarding/my-profile` (gender, linkedinUrl, photoUrl on adminUsers).

## Annexure → policy bridge
`server/annexureBridge.ts` prevents new hires from re-signing policies they already initialed at offer acceptance.
- `learningTracks.policyKey` maps a policy track to an annexure key; seeded in `seedUniversalPolicies` via `POLICY_TRACK_ANNEXURE_KEY` ("Break & Leave Policy"→leave_policy, "Attendance Regularization Policy"→attendance_policy).
- `offerLetters.annexureInitials` is a jsonb array of `{key, initials, initialedAt}`. Bridge matches offer by `resultingUserId` OR lower(hireInEmail/candidatePersonalEmail)=email.
- `bridgeAnnexuresForUser` is idempotent: marks track assignment completed + writes trackCompletion(signedVersion=track.versionNumber) + audit `policy_track_bridged_from_annexure`. Called at onboarding user-creation (routes.ts), lazily in policy-gate-status, and inside computeOnboardingChecklist.
- **Why:** the same policies live both as offer annexures and as signable policy tracks; without bridging the employee is asked to sign twice.
