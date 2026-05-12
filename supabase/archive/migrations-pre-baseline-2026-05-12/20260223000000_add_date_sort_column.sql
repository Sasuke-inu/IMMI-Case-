-- Migration: add date_sort INTEGER column for correct chronological sorting
--
-- Problem: the "date" column stores free-text English dates ("14 May 2003").
-- PostgreSQL/PostgREST sorts these as text, so "September" > "January"
-- alphabetically, meaning 2025-Sep sorts above 2026-Jan.
--
-- Solution: add a YYYYMMDD integer column "date_sort" that sorts numerically.

-- 1. Helper function: safely parse "DD Month YYYY" → YYYYMMDD integer
--    Returns NULL for empty/unparseable values instead of raising an error.
CREATE OR REPLACE FUNCTION safe_date_to_sortint(d TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  parsed DATE;
BEGIN
  IF d IS NULL OR TRIM(d) = '' THEN
    RETURN NULL;
  END IF;
  parsed := TO_DATE(TRIM(d), 'DD Month YYYY');
  RETURN (EXTRACT(YEAR  FROM parsed)::INTEGER * 10000)
       + (EXTRACT(MONTH FROM parsed)::INTEGER * 100)
       + (EXTRACT(DAY   FROM parsed)::INTEGER);
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- 2. Add the column (idempotent)
ALTER TABLE immigration_cases
  ADD COLUMN IF NOT EXISTS date_sort INTEGER;

-- 3. Populate from existing "date" values
UPDATE immigration_cases
SET date_sort = safe_date_to_sortint(date)
WHERE date_sort IS NULL;

-- 4. Index for fast ORDER BY date_sort
CREATE INDEX IF NOT EXISTS idx_immigration_cases_date_sort
  ON immigration_cases (date_sort);
