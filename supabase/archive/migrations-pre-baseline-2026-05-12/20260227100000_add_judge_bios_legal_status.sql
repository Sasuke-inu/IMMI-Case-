-- Add legal_status and notes columns to judge_bios
-- Populated by manual research session 2026-02-27
-- legal_status values: confirmed_lawyer | confirmed_non_lawyer | null

ALTER TABLE judge_bios
    ADD COLUMN IF NOT EXISTS legal_status TEXT,
    ADD COLUMN IF NOT EXISTS notes        TEXT;

-- Index for filtering by legal qualification status
CREATE INDEX IF NOT EXISTS judge_bios_legal_status_idx
    ON judge_bios (legal_status)
    WHERE legal_status IS NOT NULL;

COMMENT ON COLUMN judge_bios.legal_status IS
    'confirmed_lawyer | confirmed_non_lawyer | null (unknown)';
COMMENT ON COLUMN judge_bios.notes IS
    'Research notes with source citations for legal_status determination';
