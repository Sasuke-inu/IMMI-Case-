-- Fix get_case_statistics() to query visa_subclass from full table.
--
-- Root cause: by_visa_subclass was querying FROM the `recent` CTE which
-- samples the 50,000 most-recent cases ordered by date_sort DESC. Because
-- structured field extraction (visa_subclass) was batch-processed historically,
-- the most-recent cases have the lowest fill rate — causing the dashboard
-- "Leading Subclass" card to show "No data available" despite 91.6% fill
-- across all 149k records.
--
-- Fix: change by_visa_subclass to query FROM immigration_cases directly,
-- using the existing idx_cases_visa_subclass index. All other subqueries
-- are unchanged.

CREATE OR REPLACE FUNCTION get_case_statistics()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    WITH recent AS MATERIALIZED (
        SELECT
            case_nature,
            visa_subclass,
            visa_type
        FROM immigration_cases
        ORDER BY COALESCE(date_sort, year * 10000) DESC NULLS LAST
        LIMIT 50000
    )
    SELECT json_build_object(
        'total', (SELECT count(*) FROM immigration_cases),
        'by_court', (
            SELECT COALESCE(json_object_agg(court_name, cnt), '{}'::json)
            FROM (
                SELECT COALESCE(NULLIF(court_code, ''), 'Unknown') AS court_name,
                       count(*) AS cnt
                FROM immigration_cases
                GROUP BY court_name
                ORDER BY court_name
            ) sub
        ),
        'by_year', (
            SELECT COALESCE(json_object_agg(year::text, cnt), '{}'::json)
            FROM (
                SELECT year, count(*) AS cnt
                FROM immigration_cases
                WHERE year > 0
                GROUP BY year
                ORDER BY year
            ) sub
        ),
        'by_nature', (
            SELECT COALESCE(json_object_agg(case_nature, cnt), '{}'::json)
            FROM (
                SELECT case_nature, count(*) AS cnt
                FROM recent
                WHERE case_nature IS NOT NULL AND case_nature <> ''
                GROUP BY case_nature
                ORDER BY cnt DESC
                LIMIT 40
            ) sub
        ),
        'by_visa_subclass', (
            SELECT COALESCE(json_object_agg(visa_subclass, cnt), '{}'::json)
            FROM (
                SELECT visa_subclass, count(*) AS cnt
                FROM immigration_cases
                WHERE visa_subclass IS NOT NULL AND visa_subclass <> ''
                GROUP BY visa_subclass
                ORDER BY cnt DESC
                LIMIT 30
            ) sub
        ),
        'by_source', (
            SELECT COALESCE(json_object_agg(src, cnt), '{}'::json)
            FROM (
                SELECT COALESCE(NULLIF(source, ''), 'Unknown') AS src,
                       count(*) AS cnt
                FROM immigration_cases
                GROUP BY src
                ORDER BY cnt DESC
            ) sub
        ),
        'visa_types', (
            SELECT COALESCE(json_agg(visa_type ORDER BY visa_type), '[]'::json)
            FROM (
                SELECT DISTINCT visa_type
                FROM recent
                WHERE visa_type IS NOT NULL AND visa_type <> ''
                ORDER BY visa_type
                LIMIT 300
            ) sub
        ),
        'with_full_text', (
            SELECT count(*)
            FROM immigration_cases
            WHERE full_text_path IS NOT NULL AND full_text_path <> ''
        ),
        'sources', (
            SELECT COALESCE(json_agg(source ORDER BY source), '[]'::json)
            FROM (
                SELECT DISTINCT source
                FROM immigration_cases
                WHERE source IS NOT NULL AND source <> ''
                ORDER BY source
                LIMIT 64
            ) sub
        )
    ) INTO result;

    RETURN result;
EXCEPTION WHEN query_canceled THEN
    RETURN json_build_object(
        'total', 0,
        'by_court', '{}'::json,
        'by_year', '{}'::json,
        'by_nature', '{}'::json,
        'by_visa_subclass', '{}'::json,
        'by_source', '{}'::json,
        'visa_types', '[]'::json,
        'with_full_text', 0,
        'sources', '[]'::json
    );
END;
$$ LANGUAGE plpgsql STABLE
SET statement_timeout = '5000ms';
