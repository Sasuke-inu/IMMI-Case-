-- Optimize Supabase RPC performance for dashboard/filter metadata endpoints.
--
-- Root issues observed in production:
-- 1) get_case_filter_options() timed out on DISTINCT tags over large text values.
-- 2) get_case_statistics() performed multiple broad aggregations and timed out.
--
-- This migration addresses both with:
-- - additional selective indexes
-- - bounded sampling for high-cardinality dimensions
-- - explicit statement_timeout limits and safe fallbacks

-- ---------------------------------------------------------------------------
-- Indexes for common dashboard/filter dimensions
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_cases_court_code_nonempty
  ON immigration_cases (court_code)
  WHERE court_code IS NOT NULL AND court_code <> '';

CREATE INDEX IF NOT EXISTS idx_cases_year_positive
  ON immigration_cases (year DESC)
  WHERE year > 0;

CREATE INDEX IF NOT EXISTS idx_cases_source_nonempty
  ON immigration_cases (source)
  WHERE source IS NOT NULL AND source <> '';

CREATE INDEX IF NOT EXISTS idx_cases_case_nature_nonempty
  ON immigration_cases (case_nature)
  WHERE case_nature IS NOT NULL AND case_nature <> '';

-- ---------------------------------------------------------------------------
-- RPC: get_case_filter_options()
-- ---------------------------------------------------------------------------
-- Notes:
-- - Keep low-cardinality dimensions exact (court/year/source).
-- - Use recent-sample extraction for high-cardinality dimensions
--   (natures/visa types/tags) so query cost stays bounded.
-- - tags_raw now returns pre-split tags (already deduplicated tokens), which is
--   backward compatible with repository-side comma split logic.

CREATE OR REPLACE FUNCTION get_case_filter_options()
RETURNS JSON AS $$
DECLARE
    v_courts JSON := '[]'::json;
    v_years JSON := '[]'::json;
    v_sources JSON := '[]'::json;
    v_natures JSON := '[]'::json;
    v_visa_types JSON := '[]'::json;
    v_tags JSON := '[]'::json;
BEGIN
    SELECT COALESCE(json_agg(court_code ORDER BY court_code), '[]'::json)
    INTO v_courts
    FROM (
        SELECT DISTINCT court_code
        FROM immigration_cases
        WHERE court_code IS NOT NULL AND court_code <> ''
        ORDER BY court_code
        LIMIT 32
    ) q;

    SELECT COALESCE(json_agg(year ORDER BY year DESC), '[]'::json)
    INTO v_years
    FROM (
        SELECT DISTINCT year
        FROM immigration_cases
        WHERE year > 0
        ORDER BY year DESC
        LIMIT 40
    ) q;

    SELECT COALESCE(json_agg(source ORDER BY source), '[]'::json)
    INTO v_sources
    FROM (
        SELECT DISTINCT source
        FROM immigration_cases
        WHERE source IS NOT NULL AND source <> ''
        ORDER BY source
        LIMIT 64
    ) q;

    -- Sample high-cardinality text dimensions from most recent records.
    WITH sampled AS MATERIALIZED (
        SELECT case_nature, visa_type
        FROM immigration_cases
        ORDER BY COALESCE(date_sort, year * 10000) DESC NULLS LAST
        LIMIT 50000
    )
    SELECT
        COALESCE(
            (
                SELECT json_agg(case_nature ORDER BY case_nature)
                FROM (
                    SELECT DISTINCT case_nature
                    FROM sampled
                    WHERE case_nature IS NOT NULL AND case_nature <> ''
                    ORDER BY case_nature
                    LIMIT 300
                ) n
            ),
            '[]'::json
        ),
        COALESCE(
            (
                SELECT json_agg(visa_type ORDER BY visa_type)
                FROM (
                    SELECT DISTINCT visa_type
                    FROM sampled
                    WHERE visa_type IS NOT NULL AND visa_type <> ''
                    ORDER BY visa_type
                    LIMIT 300
                ) v
            ),
            '[]'::json
        )
    INTO v_natures, v_visa_types;

    -- Tags can still be expensive; isolate and degrade gracefully on timeout.
    BEGIN
        SELECT COALESCE(json_agg(tag ORDER BY tag), '[]'::json)
        INTO v_tags
        FROM (
            SELECT tag
            FROM (
                SELECT DISTINCT btrim(split.tag) AS tag
                FROM (
                    SELECT tags
                    FROM immigration_cases
                    WHERE tags IS NOT NULL AND tags <> ''
                    ORDER BY COALESCE(date_sort, year * 10000) DESC NULLS LAST
                    LIMIT 5000
                ) sampled_tags
                CROSS JOIN LATERAL regexp_split_to_table(sampled_tags.tags, ',') AS split(tag)
                WHERE btrim(split.tag) <> ''
            ) deduped
            ORDER BY tag
            LIMIT 500
        ) limited_tags;
    EXCEPTION WHEN query_canceled THEN
        v_tags := '[]'::json;
    END;

    RETURN json_build_object(
        'courts', v_courts,
        'years', v_years,
        'sources', v_sources,
        'natures', v_natures,
        'visa_types', v_visa_types,
        'tags_raw', v_tags
    );
EXCEPTION WHEN query_canceled THEN
    -- Fast, deterministic fallback for UI stability.
    RETURN json_build_object(
        'courts', to_json(ARRAY['AATA','ARTA','FCA','FCCA','FMCA','FedCFamC2G','HCA','MRTA','RRTA']),
        'years', (
            SELECT COALESCE(json_agg(y ORDER BY y DESC), '[]'::json)
            FROM generate_series(2000, EXTRACT(YEAR FROM now())::int) AS g(y)
        ),
        'sources', '["AustLII"]'::json,
        'natures', '[]'::json,
        'visa_types', '[]'::json,
        'tags_raw', '[]'::json
    );
END;
$$ LANGUAGE plpgsql STABLE
SET statement_timeout = '2500ms';

-- ---------------------------------------------------------------------------
-- RPC: get_case_statistics()
-- ---------------------------------------------------------------------------
-- Notes:
-- - Keep key aggregates exact for low-cardinality dimensions.
-- - Use bounded recent sample for high-cardinality dimensions to
--   prevent full-table sort/group timeouts.

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
                FROM recent
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
