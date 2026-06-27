-- Guided onboarding checklist fields.
-- admin_users: self-service profile extras surfaced/edited from the onboarding checklist.
-- learning_tracks: policy_key maps a policy track to an offer-acceptance annexure key,
--   so annexures already initialed at offer acceptance are bridged (not re-signed).
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS linkedin_url varchar;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS photo_url varchar;
ALTER TABLE learning_tracks ADD COLUMN IF NOT EXISTS policy_key varchar;

-- Backfill policy_key for existing universal policy tracks by title so the
-- annexure->policy bridge credits already-onboarded employees on upgraded DBs.
UPDATE learning_tracks SET policy_key = 'leave_policy'
  WHERE title = 'Break & Leave Policy' AND policy_key IS NULL;
UPDATE learning_tracks SET policy_key = 'attendance_policy'
  WHERE title = 'Attendance Regularization Policy' AND policy_key IS NULL;
