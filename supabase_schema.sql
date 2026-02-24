-- =============================================================================
-- IMMI-Case Supabase Schema
-- Run this SQL in the Supabase SQL Editor to set up the database.
-- =============================================================================

-- 1. Main table + indexes
-- Using "immigration_cases" to avoid the SQL reserved word "cases".
CREATE TABLE IF NOT EXISTS immigration_cases (
    case_id TEXT PRIMARY KEY,
    citation TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    court TEXT NOT NULL DEFAULT '',
    court_code TEXT NOT NULL DEFAULT '',
    date TEXT NOT NULL DEFAULT '',
    date_sort INTEGER,
    year INTEGER NOT NULL DEFAULT 0,
    url TEXT NOT NULL DEFAULT '' UNIQUE,
    judges TEXT NOT NULL DEFAULT '',
    catchwords TEXT NOT NULL DEFAULT '',
    outcome TEXT NOT NULL DEFAULT '',
    visa_type TEXT NOT NULL DEFAULT '',
    legislation TEXT NOT NULL DEFAULT '',
    text_snippet TEXT NOT NULL DEFAULT '',
    full_text_path TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT '',
    user_notes TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '',
    visa_subclass TEXT NOT NULL DEFAULT '',
    visa_class_code TEXT NOT NULL DEFAULT '',
    case_nature TEXT NOT NULL DEFAULT '',
    legal_concepts TEXT NOT NULL DEFAULT '',
    applicant_name TEXT NOT NULL DEFAULT '',
    respondent TEXT NOT NULL DEFAULT '',
    country_of_origin TEXT NOT NULL DEFAULT '',
    visa_subclass_number TEXT NOT NULL DEFAULT '',
    hearing_date TEXT NOT NULL DEFAULT '',
    is_represented TEXT NOT NULL DEFAULT '',
    representative TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_court_code ON immigration_cases(court_code);
CREATE INDEX IF NOT EXISTS idx_year ON immigration_cases(year);
CREATE INDEX IF NOT EXISTS idx_court_year ON immigration_cases(court_code, year);
CREATE INDEX IF NOT EXISTS idx_source ON immigration_cases(source);
CREATE INDEX IF NOT EXISTS idx_cases_case_nature ON immigration_cases(case_nature);
CREATE INDEX IF NOT EXISTS idx_cases_country ON immigration_cases(country_of_origin);
CREATE INDEX IF NOT EXISTS idx_cases_court_code_nonempty ON immigration_cases(court_code) WHERE court_code IS NOT NULL AND court_code <> '';
CREATE INDEX IF NOT EXISTS idx_cases_year_positive ON immigration_cases(year DESC) WHERE year > 0;
CREATE INDEX IF NOT EXISTS idx_cases_source_nonempty ON immigration_cases(source) WHERE source IS NOT NULL AND source <> '';
CREATE INDEX IF NOT EXISTS idx_cases_case_nature_nonempty ON immigration_cases(case_nature) WHERE case_nature IS NOT NULL AND case_nature <> '';

-- 2. Full-Text Search: generated tsvector column + GIN index
ALTER TABLE immigration_cases ADD COLUMN IF NOT EXISTS fts tsvector
GENERATED ALWAYS AS (
    to_tsvector('english',
        coalesce(citation, '') || ' ' ||
        coalesce(title, '') || ' ' ||
        coalesce(catchwords, '') || ' ' ||
        coalesce(judges, '') || ' ' ||
        coalesce(outcome, '') || ' ' ||
        coalesce(user_notes, '') || ' ' ||
        coalesce(case_nature, '') || ' ' ||
        coalesce(legal_concepts, ''))
) STORED;

CREATE INDEX IF NOT EXISTS idx_fts ON immigration_cases USING GIN(fts);

-- 3. Auto-update updated_at on every UPDATE
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_immigration_cases_modtime ON immigration_cases;
CREATE TRIGGER update_immigration_cases_modtime
    BEFORE UPDATE ON immigration_cases
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

-- =============================================================================
-- 4. RPC Functions (called from Supabase SDK via .rpc())
-- =============================================================================

-- NOTE:
-- Semantic search (pgvector) schema and RPC functions are defined in:
--   supabase/migrations/20260223103000_add_pgvector_embeddings.sql
-- Keep this base schema minimal; apply all migrations after initial setup.

-- 4a. Dashboard statistics
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

-- 4b. Filter dropdown options
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

-- 4c. Court/year trends acceleration (used by /stats/trends and /court-lineage)
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
    REFRESH MATERIALIZED VIEW CONCURRENTLY court_year_counts_mv;
EXCEPTION
    WHEN feature_not_supported THEN
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

-- 4d. Find related cases (scored by nature/visa_type/court similarity)
CREATE OR REPLACE FUNCTION find_related_cases(
    p_case_id TEXT,
    p_case_nature TEXT DEFAULT '',
    p_visa_type TEXT DEFAULT '',
    p_court_code TEXT DEFAULT '',
    p_limit INTEGER DEFAULT 5
)
RETURNS SETOF immigration_cases AS $$
BEGIN
    RETURN QUERY
    SELECT ic.*
    FROM immigration_cases ic
    WHERE ic.case_id != p_case_id
      AND (
          (p_case_nature != '' AND ic.case_nature = p_case_nature) OR
          (p_visa_type != '' AND ic.visa_type = p_visa_type) OR
          (p_court_code != '' AND ic.court_code = p_court_code)
      )
    ORDER BY
        (CASE WHEN p_case_nature != '' AND ic.case_nature = p_case_nature THEN 3 ELSE 0 END) +
        (CASE WHEN p_visa_type != '' AND ic.visa_type = p_visa_type THEN 2 ELSE 0 END) +
        (CASE WHEN p_court_code != '' AND ic.court_code = p_court_code THEN 1 ELSE 0 END) DESC,
        ic.year DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- 4e. Get all existing URLs (for deduplication during scraping)
CREATE OR REPLACE FUNCTION get_existing_urls()
RETURNS JSON AS $$
BEGIN
    RETURN (
        SELECT coalesce(json_agg(url), '[]'::json)
        FROM immigration_cases
        WHERE url != ''
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- Row Level Security
-- ============================================================

-- Enable Row Level Security on immigration_cases table
-- Prevents direct client-side data manipulation via anon key
ALTER TABLE immigration_cases ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read cases (public data)
CREATE POLICY "allow_public_read" ON immigration_cases
    FOR SELECT USING (true);

-- Only service_role can insert new cases
CREATE POLICY "deny_anon_insert" ON immigration_cases
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Only service_role can update cases
CREATE POLICY "deny_anon_update" ON immigration_cases
    FOR UPDATE
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Only service_role can delete cases
CREATE POLICY "deny_anon_delete" ON immigration_cases
    FOR DELETE USING (auth.role() = 'service_role');
