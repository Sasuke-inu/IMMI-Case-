-- Fix: STABLE functions cannot use SET LOCAL (side effect restriction).
-- Switch to VOLATILE so SET LOCAL statement_timeout = '30s' is allowed.
-- VOLATILE is fine here — these functions do live aggregation, not row lookups.

CREATE OR REPLACE FUNCTION get_analytics_outcomes()
RETURNS TABLE(group_type text, group_key text, outcome text, cnt bigint)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
AS $$
BEGIN
  SET LOCAL statement_timeout = '30s';
  RETURN QUERY
    SELECT 'court'::text, ic.court_code, COALESCE(ic.outcome, ''), COUNT(*)
    FROM immigration_cases ic
    WHERE ic.court_code IS NOT NULL AND ic.court_code <> ''
    GROUP BY ic.court_code, ic.outcome

    UNION ALL

    SELECT 'year'::text, ic.year::text, COALESCE(ic.outcome, ''), COUNT(*)
    FROM immigration_cases ic
    WHERE ic.year IS NOT NULL
    GROUP BY ic.year, ic.outcome

    UNION ALL

    SELECT 'visa_subclass'::text, COALESCE(ic.visa_subclass, ''), COALESCE(ic.outcome, ''), COUNT(*)
    FROM immigration_cases ic
    WHERE ic.visa_subclass IS NOT NULL AND ic.visa_subclass <> ''
    GROUP BY ic.visa_subclass, ic.outcome;
END;
$$;

CREATE OR REPLACE FUNCTION get_analytics_judges_raw()
RETURNS TABLE(judge_raw text, court_code text, cnt bigint)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
AS $$
BEGIN
  SET LOCAL statement_timeout = '30s';
  RETURN QUERY
    SELECT
      trim(j) AS judge_raw,
      ic.court_code,
      COUNT(*) AS cnt
    FROM immigration_cases ic,
      LATERAL unnest(
        string_to_array(
          regexp_replace(ic.judges, ';', ',', 'g'),
          ','
        )
      ) AS j
    WHERE ic.judges IS NOT NULL AND ic.judges <> '' AND trim(j) <> ''
    GROUP BY trim(j), ic.court_code
    ORDER BY cnt DESC;
END;
$$;

CREATE OR REPLACE FUNCTION get_analytics_concepts_raw()
RETURNS TABLE(concept_raw text, cnt bigint)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
AS $$
BEGIN
  SET LOCAL statement_timeout = '30s';
  RETURN QUERY
    SELECT
      trim(c) AS concept_raw,
      COUNT(*) AS cnt
    FROM immigration_cases ic,
      LATERAL unnest(
        string_to_array(
          regexp_replace(ic.legal_concepts, ';', ',', 'g'),
          ','
        )
      ) AS c
    WHERE ic.legal_concepts IS NOT NULL AND ic.legal_concepts <> '' AND trim(c) <> ''
    GROUP BY trim(c)
    ORDER BY cnt DESC;
END;
$$;

CREATE OR REPLACE FUNCTION get_analytics_nature_outcome()
RETURNS TABLE(case_nature text, outcome text, cnt bigint)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
AS $$
BEGIN
  SET LOCAL statement_timeout = '30s';
  RETURN QUERY
    SELECT
      ic.case_nature,
      COALESCE(ic.outcome, '') AS outcome,
      COUNT(*) AS cnt
    FROM immigration_cases ic
    WHERE ic.case_nature IS NOT NULL AND ic.case_nature <> ''
    GROUP BY ic.case_nature, ic.outcome
    ORDER BY ic.case_nature, cnt DESC;
END;
$$;
