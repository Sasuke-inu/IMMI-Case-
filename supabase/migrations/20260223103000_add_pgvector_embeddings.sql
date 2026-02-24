-- =============================================================================
-- Add pgvector-based semantic search support for immigration_cases.
-- =============================================================================

-- 1) Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2) Add embedding columns (single active embedding per case row)
ALTER TABLE immigration_cases
    ADD COLUMN IF NOT EXISTS embedding vector,
    ADD COLUMN IF NOT EXISTS embedding_provider TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS embedding_model TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS embedding_dimensions INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS embedding_content_hash TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMPTZ;

-- Ensure metadata consistency when an embedding exists.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_embedding_metadata_consistency'
    ) THEN
        ALTER TABLE immigration_cases
            ADD CONSTRAINT chk_embedding_metadata_consistency
            CHECK (
                embedding IS NULL OR (
                    embedding_provider <> '' AND
                    embedding_model <> '' AND
                    embedding_dimensions = vector_dims(embedding) AND
                    embedding_content_hash <> ''
                )
            );
    END IF;
END $$;

-- 3) Helper index for provider/model filtering
CREATE INDEX IF NOT EXISTS idx_cases_embedding_provider_model
    ON immigration_cases(embedding_provider, embedding_model)
    WHERE embedding IS NOT NULL;

-- 4) Approximate NN indexes for common models (partial + expression cast)
-- OpenAI text-embedding-3-small (1536 dims)
CREATE INDEX IF NOT EXISTS idx_cases_embedding_openai_1536_hnsw
    ON immigration_cases
    USING hnsw ((embedding::vector(1536)) vector_cosine_ops)
    WHERE embedding IS NOT NULL
      AND embedding_provider = 'openai'
      AND embedding_model = 'text-embedding-3-small'
      AND embedding_dimensions = 1536;

-- Gemini embedding (3072 dims)
-- pgvector vector index is limited to 2000 dims; use halfvec expression index.
CREATE INDEX IF NOT EXISTS idx_cases_embedding_gemini_3072_hnsw
    ON immigration_cases
    USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops)
    WHERE embedding IS NOT NULL
      AND embedding_provider = 'gemini'
      AND embedding_model = 'models/gemini-embedding-001'
      AND embedding_dimensions = 3072;

-- 5) Semantic search RPC
-- Returns case_id + cosine similarity in descending similarity order.
CREATE OR REPLACE FUNCTION search_cases_semantic(
    p_query_embedding vector,
    p_provider TEXT DEFAULT 'openai',
    p_model TEXT DEFAULT 'text-embedding-3-small',
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    case_id TEXT,
    similarity DOUBLE PRECISION
) AS $$
BEGIN
    p_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 500);

    -- Fast path for indexed OpenAI 1536 model
    IF p_provider = 'openai' AND p_model = 'text-embedding-3-small' THEN
        RETURN QUERY
        SELECT
            ic.case_id,
            1 - ((ic.embedding::vector(1536)) <=> (p_query_embedding::vector(1536))) AS similarity
        FROM immigration_cases ic
        WHERE ic.embedding IS NOT NULL
          AND ic.embedding_provider = p_provider
          AND ic.embedding_model = p_model
          AND ic.embedding_dimensions = 1536
        ORDER BY (ic.embedding::vector(1536)) <=> (p_query_embedding::vector(1536))
        LIMIT p_limit;
        RETURN;
    END IF;

    -- Fast path for indexed Gemini 3072 model
    IF p_provider = 'gemini' AND p_model = 'models/gemini-embedding-001' THEN
        RETURN QUERY
        SELECT
            ic.case_id,
            1 - ((ic.embedding::halfvec(3072)) <=> (p_query_embedding::halfvec(3072))) AS similarity
        FROM immigration_cases ic
        WHERE ic.embedding IS NOT NULL
          AND ic.embedding_provider = p_provider
          AND ic.embedding_model = p_model
          AND ic.embedding_dimensions = 3072
        ORDER BY (ic.embedding::halfvec(3072)) <=> (p_query_embedding::halfvec(3072))
        LIMIT p_limit;
        RETURN;
    END IF;

    -- Generic fallback for other models (same-dimension rows only)
    RETURN QUERY
    SELECT
        ic.case_id,
        1 - (ic.embedding <=> p_query_embedding) AS similarity
    FROM immigration_cases ic
    WHERE ic.embedding IS NOT NULL
      AND ic.embedding_provider = p_provider
      AND ic.embedding_model = p_model
      AND ic.embedding_dimensions = vector_dims(p_query_embedding)
    ORDER BY ic.embedding <=> p_query_embedding
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- 6) Hybrid search RPC (semantic + full-text via reciprocal-rank style fusion)
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
        -- Weighted reciprocal-rank fusion (semantic-biased)
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
