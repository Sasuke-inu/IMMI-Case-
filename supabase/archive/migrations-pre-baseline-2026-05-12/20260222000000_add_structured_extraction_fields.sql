-- Migration: Add structured extraction fields (visa_outcome_reason, legal_test_applied)
-- Date: 2026-02-22
-- Context: Enhanced structured field extraction pipeline adds two new fields

ALTER TABLE immigration_cases
  ADD COLUMN IF NOT EXISTS visa_outcome_reason TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS legal_test_applied TEXT DEFAULT '';

-- Update FTS index to include new fields
-- (Rebuild happens automatically on next tsvector update trigger)

COMMENT ON COLUMN immigration_cases.visa_outcome_reason IS 'Primary reason for visa refusal/grant/remittal, extracted from CATCHWORDS section (≤300 chars)';
COMMENT ON COLUMN immigration_cases.legal_test_applied IS 'Primary legal test or section applied, e.g. "s.36 refugee test", "s.501 character test" (≤80 chars)';
