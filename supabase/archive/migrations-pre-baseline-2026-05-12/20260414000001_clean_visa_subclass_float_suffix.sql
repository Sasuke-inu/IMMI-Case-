-- One-time data cleanup: strip pandas ".0" float suffix from visa_subclass.
--
-- Root cause: pandas reads numeric CSV columns as float64 ("155" → "155.0").
-- When cases were bulk-migrated from CSV → Supabase, the raw float strings
-- were written to the visa_subclass column. This affects all 136,502 rows
-- that have a visa_subclass value.
--
-- Effect: "866.0" → "866", "457.0" → "457", etc.
-- Rows without ".0" suffix are unchanged (no-op for the regex).
--
-- This is a pure DML operation; no schema changes.

UPDATE immigration_cases
SET visa_subclass = regexp_replace(visa_subclass, '\.0$', '')
WHERE visa_subclass ~ '\.0$'
  AND visa_subclass IS NOT NULL;
