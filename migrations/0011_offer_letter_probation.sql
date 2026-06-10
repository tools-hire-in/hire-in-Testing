-- Migration: add probation and post-probation salary tiers to offer_letters
ALTER TABLE offer_letters
  ADD COLUMN IF NOT EXISTS probation_salary numeric,
  ADD COLUMN IF NOT EXISTS probation_salary_in_words varchar,
  ADD COLUMN IF NOT EXISTS post_probation_salary numeric,
  ADD COLUMN IF NOT EXISTS post_probation_salary_in_words varchar,
  ADD COLUMN IF NOT EXISTS probation_period_months integer DEFAULT 3,
  ADD COLUMN IF NOT EXISTS extended_probation_months integer;
