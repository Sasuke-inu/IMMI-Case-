-- Add by_visa_subclass, by_source to get_case_statistics()
-- Add new get_court_year_trends() RPC function
-- Add index on visa_subclass for faster aggregation

CREATE INDEX IF NOT EXISTS idx_cases_visa_subclass ON immigration_cases(visa_subclass) WHERE visa_subclass IS NOT NULL AND visa_subclass != '';

-- Update get_case_statistics to include visa_subclass and source breakdown
CREATE OR REPLACE FUNCTION get_case_statistics()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total', (SELECT count(*) FROM immigration_cases),
        'by_court', (
            SELECT coalesce(json_object_agg(court_name, cnt), '{}'::json)
            FROM (
                SELECT coalesce(nullif(court_code, ''), 'Unknown') AS court_name,
                       count(*) AS cnt
                FROM immigration_cases
                GROUP BY court_code
                ORDER BY court_code
            ) sub
        ),
        'by_year', (
            SELECT coalesce(json_object_agg(year::text, cnt), '{}'::json)
            FROM (
                SELECT year, count(*) AS cnt
                FROM immigration_cases
                WHERE year > 0
                GROUP BY year
                ORDER BY year
            ) sub
        ),
        'by_nature', (
            SELECT coalesce(json_object_agg(case_nature, cnt), '{}'::json)
            FROM (
                SELECT case_nature, count(*) AS cnt
                FROM immigration_cases
                WHERE case_nature IS NOT NULL AND case_nature != ''
                GROUP BY case_nature
                ORDER BY cnt DESC
            ) sub
        ),
        'by_visa_subclass', (
            SELECT coalesce(json_object_agg(visa_subclass, cnt), '{}'::json)
            FROM (
                SELECT visa_subclass, count(*) AS cnt
                FROM immigration_cases
                WHERE visa_subclass IS NOT NULL AND visa_subclass != ''
                GROUP BY visa_subclass
                ORDER BY cnt DESC
                LIMIT 20
            ) sub
        ),
        'by_source', (
            SELECT coalesce(json_object_agg(src, cnt), '{}'::json)
            FROM (
                SELECT coalesce(nullif(source, ''), 'Unknown') AS src,
                       count(*) AS cnt
                FROM immigration_cases
                GROUP BY source
                ORDER BY cnt DESC
            ) sub
        ),
        'visa_types', (
            SELECT coalesce(json_agg(visa_type ORDER BY visa_type), '[]'::json)
            FROM (
                SELECT DISTINCT visa_type
                FROM immigration_cases
                WHERE visa_type IS NOT NULL AND visa_type != ''
            ) sub
        ),
        'with_full_text', (
            SELECT count(*) FROM immigration_cases
            WHERE full_text_path IS NOT NULL AND full_text_path != ''
        ),
        'sources', (
            SELECT coalesce(json_agg(source ORDER BY source), '[]'::json)
            FROM (
                SELECT DISTINCT source
                FROM immigration_cases
                WHERE source IS NOT NULL AND source != ''
            ) sub
        )
    ) INTO result;
    RETURN result;
END;
$$ LANGUAGE plpgsql STABLE
SET statement_timeout = '30s';

-- New RPC: court x year cross-tabulation for trend chart
CREATE OR REPLACE FUNCTION get_court_year_trends()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT coalesce(json_agg(row_data ORDER BY year), '[]'::json)
    INTO result
    FROM (
        SELECT
            year,
            json_object_agg(
                coalesce(nullif(court_code, ''), 'Unknown'),
                cnt
            ) AS row_data
        FROM (
            SELECT year, court_code, count(*) AS cnt
            FROM immigration_cases
            WHERE year > 0
            GROUP BY year, court_code
        ) sub
        GROUP BY year
        ORDER BY year
    ) outer_sub;

    -- Flatten: each element needs year embedded
    SELECT coalesce(json_agg(
        json_build_object('year', year) || courts_json
        ORDER BY year
    ), '[]'::json)
    INTO result
    FROM (
        SELECT
            year,
            (SELECT json_object_agg(court_code, cnt)
             FROM (
                 SELECT court_code, count(*) AS cnt
                 FROM immigration_cases ic
                 WHERE ic.year = y.year AND court_code IS NOT NULL AND court_code != ''
                 GROUP BY court_code
             ) sub
            ) AS courts_json
        FROM (
            SELECT DISTINCT year
            FROM immigration_cases
            WHERE year > 0
        ) y
        ORDER BY year
    ) final;

    RETURN result;
END;
$$ LANGUAGE plpgsql STABLE
SET statement_timeout = '30s';
