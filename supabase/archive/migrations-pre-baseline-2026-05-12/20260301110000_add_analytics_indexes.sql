-- Indexes to support server-side analytics GROUP BY aggregations.
-- Without these, get_analytics_outcomes() etc. do full seq scans on 149k rows
-- and exceed Supabase's default statement_timeout (~8-10s on the free tier).
-- These partial indexes are narrow and fast to build (~5-10s each on Supabase).

-- ─── Outcome analytics ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ic_court_outcome
    ON immigration_cases (court_code, outcome)
    WHERE court_code IS NOT NULL AND court_code <> '';

CREATE INDEX IF NOT EXISTS idx_ic_year_outcome
    ON immigration_cases (year, outcome)
    WHERE year IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ic_visa_outcome
    ON immigration_cases (visa_subclass, outcome)
    WHERE visa_subclass IS NOT NULL AND visa_subclass <> '';

-- ─── Nature × Outcome ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ic_nature_outcome
    ON immigration_cases (case_nature, outcome)
    WHERE case_nature IS NOT NULL AND case_nature <> '';

-- ─── Judge / concept text columns ────────────────────────────────────────
-- Covering partial index so the LATERAL unnest() queries touch fewer heap pages.
-- Including court_code so get_analytics_judges_raw() can filter without heap fetch.
CREATE INDEX IF NOT EXISTS idx_ic_judges_court
    ON immigration_cases (court_code)
    INCLUDE (judges)
    WHERE judges IS NOT NULL AND judges <> '';

CREATE INDEX IF NOT EXISTS idx_ic_concepts
    ON immigration_cases (case_id)
    INCLUDE (legal_concepts)
    WHERE legal_concepts IS NOT NULL AND legal_concepts <> '';

-- ─── Bump statement_timeout inside each analytics function ────────────────
-- The Supabase PostgREST connection has a project-level statement_timeout that
-- can kill long-running GROUP BY queries. Raising it to 30 s inside the
-- SECURITY DEFINER functions lets them finish without hitting the project limit.

CREATE OR REPLACE FUNCTION get_analytics_outcomes()
RETURNS TABLE(group_type text, group_key text, outcome text, cnt bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER
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
LANGUAGE plpgsql STABLE SECURITY DEFINER
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
LANGUAGE plpgsql STABLE SECURITY DEFINER
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
LANGUAGE plpgsql STABLE SECURITY DEFINER
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
