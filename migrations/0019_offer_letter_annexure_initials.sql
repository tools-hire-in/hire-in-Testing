-- Add per-annexure candidate initials to offer_letters.
-- Stored as a JSONB array of { key, initials, initialedAt } captured at acceptance,
-- folded into the acceptance SHA-256 hash and rendered in the generated Word document.
ALTER TABLE offer_letters ADD COLUMN IF NOT EXISTS annexure_initials jsonb;
