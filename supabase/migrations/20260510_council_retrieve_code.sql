-- Add 6-character retrieve_code to council_sessions for restore-by-code UX.
--
-- Frontend shows the code once when a streaming council session ends; the user
-- saves it (private-mode browsers wipe localStorage) and re-enters it on a
-- future visit to restore the conversation. Server-side restore exchanges
-- code → {session_id, session_token} so existing GET /sessions/:id keeps working.
--
-- Design:
--   * NULLABLE — pre-existing rows keep retrieve_code = NULL and are NOT exposed
--     to restore-by-code lookup (legacy sessions stay accessed only via session_id).
--   * Partial UNIQUE index — uniqueness enforced ONLY when retrieve_code IS NOT NULL,
--     avoiding NULL-collision pitfalls and preserving the additive guarantee.
--   * 6 chars at base32 (alphabet excludes 0/O/1/I/L for visual disambiguation)
--     yields ~30^6 ≈ 729M codes — collision-light at MVP scale (handful sessions/day).
--
-- Caller surface (after migration applied):
--   * workers/llm-council/storage.js — createSession() will accept retrieveCode
--   * workers/llm-council/storage.js — new getSessionByCode() function
--   * workers/llm-council/handlers.js — new handleRestoreByCode handler
--
-- Rollback (manual): DROP INDEX IF EXISTS council_sessions_retrieve_code_unique;
--                    ALTER TABLE council_sessions DROP COLUMN IF EXISTS retrieve_code;

ALTER TABLE council_sessions
  ADD COLUMN IF NOT EXISTS retrieve_code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS council_sessions_retrieve_code_unique
  ON council_sessions (retrieve_code)
  WHERE retrieve_code IS NOT NULL;

COMMENT ON COLUMN council_sessions.retrieve_code IS
  '6-char base32 user-facing code (excludes 0/O/1/I/L). NULL for legacy rows. Used by POST /api/v1/llm-council/sessions/restore.';
