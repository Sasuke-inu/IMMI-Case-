-- Optimize get_case_statistics: use court_code (indexed) instead of court (unindexed text)
-- Also add index on full_text_path for the with_full_text count
CREATE INDEX IF NOT EXISTS idx_cases_full_text_path ON immigration_cases(full_text_path) WHERE full_text_path != '';
CREATE INDEX IF NOT EXISTS idx_cases_visa_type ON immigration_cases(visa_type) WHERE visa_type != '';

-- Rewrite function with SET statement_timeout and use indexed columns
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
