-- Judge biographical data for AAT/ART/MRT/RRT decision-makers
-- Source: downloaded_cases/judge_bios.json (104 members, manually researched)

CREATE TABLE IF NOT EXISTS judge_bios (
    -- Primary key: lowercase name key matching judge_bios.json
    id                      TEXT PRIMARY KEY,
    full_name               TEXT NOT NULL,
    role                    TEXT,
    court                   TEXT,
    appointed_year          TEXT,
    registry                TEXT,
    specialization          TEXT,
    formerly_known_as       TEXT,
    birth_year              INTEGER,

    -- Career & biography (TEXT for long prose)
    previously              TEXT,
    current_role_desc       TEXT,
    source_url              TEXT,
    photo_url               TEXT,

    -- Legal qualification fields
    has_legal_qualification BOOLEAN,
    no_legal_qualification  BOOLEAN,
    qualification_confidence TEXT,
    qualification_notes     TEXT,

    -- Research metadata
    found                   BOOLEAN,
    source                  TEXT,

    -- JSONB for arrays/nested objects
    education               JSONB,   -- string[]
    notable_cases           JSONB,   -- {citation, year, description}[]
    appointment_history     JSONB,   -- {role, tribunal, state, start, end, notes}[]
    sources                 JSONB,   -- string[] or object[]
    social_media            JSONB,   -- {platform, url}[]

    -- Timestamps
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Full-text search index on name + role + previously
CREATE INDEX IF NOT EXISTS judge_bios_fts_idx
    ON judge_bios USING gin(to_tsvector('english',
        coalesce(full_name, '') || ' ' ||
        coalesce(role, '') || ' ' ||
        coalesce(previously, '') || ' ' ||
        coalesce(current_role_desc, '')
    ));

-- Lookup by qualification status
CREATE INDEX IF NOT EXISTS judge_bios_qualification_idx
    ON judge_bios (has_legal_qualification, no_legal_qualification);

-- Updated-at trigger
CREATE OR REPLACE FUNCTION update_judge_bios_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER judge_bios_updated_at
    BEFORE UPDATE ON judge_bios
    FOR EACH ROW EXECUTE FUNCTION update_judge_bios_updated_at();

-- RLS: public read-only (matches cases table policy)
ALTER TABLE judge_bios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read on judge_bios"
    ON judge_bios FOR SELECT USING (true);
CREATE POLICY "Allow service role all on judge_bios"
    ON judge_bios FOR ALL USING (auth.role() = 'service_role');
