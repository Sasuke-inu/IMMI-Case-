-- Multi-turn LLM Council sessions.
-- Persists conversation state for council interactions; enables review/recall.

CREATE TABLE council_sessions (
  session_id   TEXT PRIMARY KEY,                    -- 21-char nanoid
  case_id      TEXT,                                -- optional anchor to immigration_cases
  title        TEXT,                                -- auto-derived from turn 1 user_message
  status       TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'complete', 'abandoned')),
  total_turns  INT NOT NULL DEFAULT 0
                 CHECK (total_turns >= 0 AND total_turns <= 15),
  hmac_sig     TEXT NOT NULL,                       -- HMAC-SHA256(session_id, CSRF_SECRET) in base64url
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE council_turns (
  turn_id           TEXT PRIMARY KEY,               -- 21-char nanoid
  session_id        TEXT NOT NULL REFERENCES council_sessions(session_id) ON DELETE CASCADE,
  turn_index        INT NOT NULL
                       CHECK (turn_index >= 0 AND turn_index < 15),
  user_message      TEXT NOT NULL,
  user_case_context TEXT,
  payload           JSONB NOT NULL,                  -- full council response (opinions + moderator)
  retrieved_cases   JSONB,                           -- RAG matches snapshot
  total_tokens      INT,                             -- sum of expert + moderator usage
  total_latency_ms  INT,                             -- end-to-end Worker time
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, turn_index)
);

CREATE INDEX idx_council_turns_session ON council_turns(session_id, turn_index);
CREATE INDEX idx_council_sessions_updated ON council_sessions(updated_at DESC);
