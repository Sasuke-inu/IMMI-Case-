-- Analytics RPC functions for server-side aggregation.
-- These replace Python-side load_all() + GROUP BY which required fetching
-- 149k rows (24s) over the network. Each function returns pre-aggregated
-- data that Python then normalises (outcome mapping, judge name lookup, etc.).

-- ─── 1. Outcome analytics ────────────────────────────────────────────────────
-- Returns raw outcome counts grouped by court, year, and visa_subclass.
-- Python applies _normalise_outcome() to the small result set (~500 rows).

CREATE OR REPLACE FUNCTION get_analytics_outcomes()
RETURNS TABLE(group_type text, group_key text, outcome text, cnt bigint)
LANGUAGE sql STABLE
AS $$
  SELECT 'court'::text, court_code, COALESCE(outcome, ''), COUNT(*)
  FROM immigration_cases
  WHERE court_code IS NOT NULL AND court_code <> ''
  GROUP BY court_code, outcome

  UNION ALL

  SELECT 'year'::text, year::text, COALESCE(outcome, ''), COUNT(*)
  FROM immigration_cases
  WHERE year IS NOT NULL
  GROUP BY year, outcome

  UNION ALL

  SELECT 'visa_subclass'::text, COALESCE(visa_subclass, ''), COALESCE(outcome, ''), COUNT(*)
  FROM immigration_cases
  WHERE visa_subclass IS NOT NULL AND visa_subclass <> ''
  GROUP BY visa_subclass, outcome;
$$;

-- ─── 2. Judge analytics ──────────────────────────────────────────────────────
-- Splits the comma/semicolon-separated judges field server-side and returns
-- raw name tokens with their court and total case count.
-- Python applies _judge_identity() normalisation to the result (~15k rows).

CREATE OR REPLACE FUNCTION get_analytics_judges_raw()
RETURNS TABLE(judge_raw text, court_code text, cnt bigint)
LANGUAGE sql STABLE
AS $$
  SELECT
    trim(j) AS judge_raw,
    court_code,
    COUNT(*) AS cnt
  FROM immigration_cases,
    LATERAL unnest(
      string_to_array(
        regexp_replace(judges, ';', ',', 'g'),
        ','
      )
    ) AS j
  WHERE judges IS NOT NULL AND judges <> '' AND trim(j) <> ''
  GROUP BY trim(j), court_code
  ORDER BY cnt DESC;
$$;

-- ─── 3. Legal concept analytics ──────────────────────────────────────────────
-- Splits the comma/semicolon-separated legal_concepts field and counts each
-- raw token. Python applies _normalise_concept() to map to canonical forms.

CREATE OR REPLACE FUNCTION get_analytics_concepts_raw()
RETURNS TABLE(concept_raw text, cnt bigint)
LANGUAGE sql STABLE
AS $$
  SELECT
    trim(c) AS concept_raw,
    COUNT(*) AS cnt
  FROM immigration_cases,
    LATERAL unnest(
      string_to_array(
        regexp_replace(legal_concepts, ';', ',', 'g'),
        ','
      )
    ) AS c
  WHERE legal_concepts IS NOT NULL AND legal_concepts <> '' AND trim(c) <> ''
  GROUP BY trim(c)
  ORDER BY cnt DESC;
$$;

-- ─── 4. Nature × Outcome cross-tabulation ────────────────────────────────────
-- Returns raw (case_nature, outcome, count) pairs.
-- Python applies _normalise_outcome() and builds the matrix.

CREATE OR REPLACE FUNCTION get_analytics_nature_outcome()
RETURNS TABLE(case_nature text, outcome text, cnt bigint)
LANGUAGE sql STABLE
AS $$
  SELECT
    case_nature,
    COALESCE(outcome, '') AS outcome,
    COUNT(*) AS cnt
  FROM immigration_cases
  WHERE case_nature IS NOT NULL AND case_nature <> ''
  GROUP BY case_nature, outcome
  ORDER BY case_nature, cnt DESC;
$$;
