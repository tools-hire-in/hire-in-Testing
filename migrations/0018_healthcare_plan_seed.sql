-- Add seed_probation_plan preference to offer_letters
ALTER TABLE offer_letters ADD COLUMN IF NOT EXISTS seed_probation_plan BOOLEAN NOT NULL DEFAULT false;

-- Add employee-editable notes field to performance_goals (used by My Plan view)
ALTER TABLE performance_goals ADD COLUMN IF NOT EXISTS notes TEXT;
