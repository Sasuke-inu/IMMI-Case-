-- Fix return-type mismatch in search_cases_hybrid (numeric -> double precision).

CREATE OR REPLACE FUNCTION search_cases_hybrid(
    p_query_text TEXT,
    p_query_embedding vector,
    p_provider TEXT DEFAULT 'openai',
    p_model TEXT DEFAULT 'text-embedding-3-small',
    p_limit INTEGER DEFAULT 50,
    p_candidate_limit INTEGER DEFAULT 200
)
RETURNS TABLE (
    case_id TEXT,
    hybrid_score DOUBLE PRECISION,
    semantic_score DOUBLE PRECISION,
    lexical_score DOUBLE PRECISION
) AS $$
BEGIN
    p_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 500);
    p_candidate_limit := LEAST(GREATEST(COALESCE(p_candidate_limit, 200), p_limit), 1000);

    RETURN QUERY
    WITH semantic AS (
        SELECT
            s.case_id,
            s.similarity AS semantic_score,
            ROW_NUMBER() OVER (ORDER BY s.similarity DESC) AS semantic_rank
        FROM search_cases_semantic(
            p_query_embedding => p_query_embedding,
            p_provider => p_provider,
            p_model => p_model,
            p_limit => p_candidate_limit
        ) s
    ),
    lexical AS (
        SELECT
            ic.case_id,
            ts_rank(ic.fts, websearch_to_tsquery('english', p_query_text)) AS lexical_score,
            ROW_NUMBER() OVER (
                ORDER BY ts_rank(ic.fts, websearch_to_tsquery('english', p_query_text)) DESC
            ) AS lexical_rank
        FROM immigration_cases ic
        WHERE p_query_text IS NOT NULL
          AND btrim(p_query_text) <> ''
          AND ic.fts @@ websearch_to_tsquery('english', p_query_text)
        ORDER BY ts_rank(ic.fts, websearch_to_tsquery('english', p_query_text)) DESC
        LIMIT p_candidate_limit
    )
    SELECT
        COALESCE(s.case_id, l.case_id) AS case_id,
        (
            COALESCE(0.65::DOUBLE PRECISION / (60 + s.semantic_rank), 0.0::DOUBLE PRECISION) +
            COALESCE(0.35::DOUBLE PRECISION / (60 + l.lexical_rank), 0.0::DOUBLE PRECISION)
        )::DOUBLE PRECISION AS hybrid_score,
        COALESCE(s.semantic_score, 0.0)::DOUBLE PRECISION AS semantic_score,
        COALESCE(l.lexical_score, 0.0)::DOUBLE PRECISION AS lexical_score
    FROM semantic s
    FULL OUTER JOIN lexical l ON s.case_id = l.case_id
    ORDER BY hybrid_score DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

