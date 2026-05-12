-- Fix get_court_year_trends() to use jsonb merge semantics.
-- Previous implementation used `json || json` which raises:
--   operator does not exist: json || json

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
            grouped.year,
            jsonb_object_agg(
                COALESCE(NULLIF(grouped.court_code, ''), 'Unknown'),
                grouped.cnt
            ) AS courts_json
        FROM (
            SELECT
                year,
                court_code,
                count(*) AS cnt
            FROM immigration_cases
            WHERE year > 0
            GROUP BY year, court_code
        ) grouped
        GROUP BY grouped.year
    ) yearly;

    RETURN result;
END;
$$ LANGUAGE plpgsql STABLE
SET statement_timeout = '10s';
