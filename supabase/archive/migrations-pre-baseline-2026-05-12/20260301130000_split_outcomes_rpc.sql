-- Split get_analytics_outcomes() into 3 focused functions so each
-- runs well under Supabase's 8-second statement_timeout limit.
-- The UNION ALL in the original combined function created a query plan
-- that exceeded the limit on 149k rows.

-- ─── 1a. Outcome by court ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_analytics_outcomes_court()
RETURNS TABLE(court_code text, outcome text, cnt bigint)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
AS $$
BEGIN
  SET LOCAL statement_timeout = '30s';
  RETURN QUERY
    SELECT ic.court_code, COALESCE(ic.outcome, ''), COUNT(*)::bigint
    FROM immigration_cases ic
    WHERE ic.court_code IS NOT NULL AND ic.court_code <> ''
    GROUP BY ic.court_code, ic.outcome;
END;
$$;

-- ─── 1b. Outcome by year ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_analytics_outcomes_year()
RETURNS TABLE(year_key text, outcome text, cnt bigint)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
AS $$
BEGIN
  SET LOCAL statement_timeout = '30s';
  RETURN QUERY
    SELECT ic.year::text, COALESCE(ic.outcome, ''), COUNT(*)::bigint
    FROM immigration_cases ic
    WHERE ic.year IS NOT NULL
    GROUP BY ic.year, ic.outcome;
END;
$$;

-- ─── 1c. Outcome by visa subclass ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_analytics_outcomes_visa()
RETURNS TABLE(visa_subclass text, outcome text, cnt bigint)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
AS $$
BEGIN
  SET LOCAL statement_timeout = '30s';
  RETURN QUERY
    SELECT COALESCE(ic.visa_subclass, ''), COALESCE(ic.outcome, ''), COUNT(*)::bigint
    FROM immigration_cases ic
    WHERE ic.visa_subclass IS NOT NULL AND ic.visa_subclass <> ''
    GROUP BY ic.visa_subclass, ic.outcome;
END;
$$;
