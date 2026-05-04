-- Migration: Leave Management Overhaul (Task #112)
-- Adds new columns to support legal-compliant EL/SL accrual policy

-- leave_types: conditional accrual flag + carry-forward cap
ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS is_conditional boolean NOT NULL DEFAULT true;
ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS carry_forward_cap integer DEFAULT 0;

-- leave_accruals: accrual type tag + skip reason
ALTER TABLE leave_accruals ADD COLUMN IF NOT EXISTS accrual_type text DEFAULT 'monthly';
ALTER TABLE leave_accruals ADD COLUMN IF NOT EXISTS skip_reason text;

-- Unique constraint for natural key deduplication (makes onConflictDoNothing effective).
-- Deduplicate existing rows first (keep oldest per group), then add constraint.
DELETE FROM leave_accruals a
  USING (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY user_id, leave_type_id, year, month, accrual_type
      ORDER BY created_at ASC
    ) AS rn
    FROM leave_accruals
  ) ranked
  WHERE a.id = ranked.id AND ranked.rn > 1;

-- ADD CONSTRAINT IF NOT EXISTS is not valid SQL; use DO block for safe idempotent add
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leave_accruals_unique_period'
  ) THEN
    ALTER TABLE leave_accruals
      ADD CONSTRAINT leave_accruals_unique_period
      UNIQUE (user_id, leave_type_id, year, month, accrual_type);
  END IF;
END $$;

-- leave_requests: half-day support + split-leave columns
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS half_day boolean NOT NULL DEFAULT false;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS half_day_part text;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS split_paid_days numeric;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS split_lwp_days numeric;

-- EL (Earned Leave / Annual Leave / Privilege Leave):
--   isConditional=true, carryForwardCap=45, monthly 1 day, min 128h worked
UPDATE leave_types
  SET is_conditional = true,
      carry_forward_cap = 45,
      monthly_accrual = '1.00',
      min_hours_for_accrual = '128',
      default_days = 15
  WHERE LOWER(name) IN ('earned leave', 'el', 'annual leave', 'privilege leave', 'pl');

-- SL (Sick Leave): isConditional=false, no carry-forward, 0.67/month
-- min_hours_for_accrual=0 means "no minimum" for unconditional leave (column is NOT NULL)
UPDATE leave_types
  SET is_conditional = false,
      carry_forward_cap = 0,
      monthly_accrual = '0.67',
      min_hours_for_accrual = 0,
      default_days = 8
  WHERE LOWER(name) IN ('sick leave', 'sl', 'medical leave');

-- Casual Leave (if renamed/active): also set min_hours_for_accrual=0 not NULL
UPDATE leave_types
  SET min_hours_for_accrual = 0
  WHERE LOWER(name) IN ('casual leave', 'cl');

-- Casual Leave / CL: deactivate if Sick Leave already exists as the correct SL record;
--   otherwise rename and apply SL policy
UPDATE leave_types
  SET is_active = false
  WHERE LOWER(name) IN ('casual leave', 'cl')
    AND EXISTS (
      SELECT 1 FROM leave_types WHERE LOWER(name) IN ('sick leave', 'sl') AND is_active = true
    );

UPDATE leave_types
  SET name = 'Sick Leave',
      is_conditional = false,
      carry_forward_cap = 0,
      monthly_accrual = '0.67',
      min_hours_for_accrual = 0,
      default_days = 8
  WHERE LOWER(name) IN ('casual leave', 'cl')
    AND NOT EXISTS (
      SELECT 1 FROM leave_types WHERE LOWER(name) IN ('sick leave', 'sl') AND is_active = true
    );

-- Ensure Sick Leave is active after the above deactivation logic
UPDATE leave_types SET is_active = true
  WHERE LOWER(name) IN ('sick leave', 'sl')
    AND is_conditional = false;

-- Seed 2026 Indian national and company holidays (excludes US-specific holidays
-- like Labour Day USA, Thanksgiving to prevent day-count errors in leave calculations)
INSERT INTO holidays (id, date, name, type, created_at) VALUES
  ('28d6d407-89e6-428b-9a40-cc24a2d20024', '2026-01-01', 'New Year',               'public',   NOW()),
  ('31c1d91a-fb9f-4387-9ede-49d3e6385304', '2026-01-26', 'Republic Day',            'national', NOW()),
  ('d85398b0-bc01-49ca-b365-440af82eef59', '2026-03-03', 'Holi',                    'regional', NOW()),
  ('8bd0fdbc-eb4b-4f82-9393-66438c6737a7', '2026-03-20', 'Eid-ul-Fitr',             'regional', NOW()),
  ('5dd3db09-9195-4fb2-95a1-72fb54439184', '2026-04-14', 'Ambedkar Jayanti',        'national', NOW()),
  ('8317a5db-35b6-4bf7-8cf5-66a806a55fd2', '2026-04-18', 'Good Friday',             'national', NOW()),
  ('0123fa4a-097e-446b-a95e-ca0b6d986d27', '2026-05-27', 'Eid-ul-Adha (Bakrid)',    'regional', NOW()),
  ('b46e45d8-64f4-427d-a33c-68a0a8104606', '2026-08-15', 'Independence Day',        'national', NOW()),
  ('aa555d0e-3d0e-4777-abcc-c7d40601a87d', '2026-10-02', 'Gandhi Jayanti',          'national', NOW()),
  ('b2ef44e7-7555-4e37-8bdf-1f1e6d19ebf1', '2026-10-23', 'Dussehra',                'public',   NOW()),
  ('2de88008-e8e6-4e5e-80a4-ecfe4a5ab62b', '2026-11-04', 'Guru Nanak Jayanti',      'public',   NOW()),
  ('537523eb-c01f-49fa-a406-2b55a374d61b', '2026-11-12', 'Diwali',                  'regional', NOW()),
  ('b4bd01f2-5a0e-426b-9d5a-40e5ff3362b2', '2026-12-25', 'Christmas',               'public',   NOW())
ON CONFLICT (id) DO NOTHING;
