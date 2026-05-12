-- Migration: improve safe_date_to_sortint to handle abbreviated month names
-- and clean up embedded newlines/whitespace before parsing.
--
-- Handles both "14 May 2003" (full) and "6 Sep 2018" / "8 OCT 2003" (abbrev).

CREATE OR REPLACE FUNCTION safe_date_to_sortint(d TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  cleaned  TEXT;
  parsed   DATE;
  fmt      TEXT;
BEGIN
  IF d IS NULL OR TRIM(d) = '' THEN
    RETURN NULL;
  END IF;

  -- Normalise: collapse internal whitespace/newlines, trim edges
  cleaned := TRIM(REGEXP_REPLACE(d, '\s+', ' ', 'g'));

  -- Try full month name first ("14 May 2003")
  BEGIN
    parsed := TO_DATE(cleaned, 'DD Month YYYY');
    RETURN (EXTRACT(YEAR  FROM parsed)::INTEGER * 10000)
         + (EXTRACT(MONTH FROM parsed)::INTEGER * 100)
         + (EXTRACT(DAY   FROM parsed)::INTEGER);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Try 3-letter abbreviated month ("6 Sep 2018", "8 OCT 2003")
  BEGIN
    parsed := TO_DATE(cleaned, 'DD Mon YYYY');
    RETURN (EXTRACT(YEAR  FROM parsed)::INTEGER * 10000)
         + (EXTRACT(MONTH FROM parsed)::INTEGER * 100)
         + (EXTRACT(DAY   FROM parsed)::INTEGER);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Unparseable — return NULL
  RETURN NULL;
END;
$$;

-- Re-populate date_sort for all rows where it is still NULL but date is not empty
UPDATE immigration_cases
SET date_sort = safe_date_to_sortint(date)
WHERE (date_sort IS NULL) AND (date IS NOT NULL) AND (TRIM(date) != '');
