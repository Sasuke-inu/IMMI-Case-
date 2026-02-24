-- Optimize court-lineage aggregation for Supabase RPC consumers.
--
-- Problem:
--   get_court_year_trends() was aggregating directly from immigration_cases on
--   every request, which can exceed statement timeout on large datasets.
--
-- Solution:
--   1) Pre-aggregate year/court counts into a materialized view.
--   2) Rewrite get_court_year_trends() to read from the materialized view.
--   3) Provide refresh_court_year_counts_mv() for post-import refresh.

CREATE MATERIALIZED VIEW IF NOT EXISTS court_year_counts_mv AS
SELECT
    year,
    COALESCE(NULLIF(court_code, ''), 'Unknown') AS court_code,
    count(*)::bigint AS cnt
FROM immigration_cases
WHERE year > 0
GROUP BY
    year,
    COALESCE(NULLIF(court_code, ''), 'Unknown');

CREATE UNIQUE INDEX IF NOT EXISTS idx_court_year_counts_mv_year_court
    ON court_year_counts_mv(year, court_code);

CREATE INDEX IF NOT EXISTS idx_court_year_counts_mv_year
    ON court_year_counts_mv(year);

CREATE OR REPLACE FUNCTION refresh_court_year_counts_mv()
RETURNS void AS $$
BEGIN
    -- Prefer non-blocking concurrent refresh when possible.
    REFRESH MATERIALIZED VIEW CONCURRENTLY court_year_counts_mv;
EXCEPTION
    WHEN feature_not_supported THEN
        -- Fallback path for environments where concurrent refresh is unavailable.
        REFRESH MATERIALIZED VIEW court_year_counts_mv;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_court_year_trends()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT COALESCE(
        json_agg(
            (
                jsonb_build_object('year', yearly.year)
                || COALESCE(yearly.courts_json, '{}'::jsonb)
            )::json
            ORDER BY yearly.year
        ),
        '[]'::json
    )
    INTO result
    FROM (
        SELECT
            year,
            jsonb_object_agg(court_code, cnt ORDER BY court_code) AS courts_json
        FROM court_year_counts_mv
        GROUP BY year
    ) yearly;

    RETURN result;
END;
$$ LANGUAGE plpgsql STABLE
SET statement_timeout = '2500ms';

-- Optional operational step after bulk upserts/imports:
--   SELECT refresh_court_year_counts_mv();
