/**
 * workers/llm-council/storage.js
 *
 * Postgres CRUD layer for council_sessions + council_turns via Hyperdrive.
 *
 * IMPORTANT: getSql(env) creates a NEW postgres client per call.
 * Module-level singletons cause "Cannot perform I/O on behalf of a different
 * request" errors in Cloudflare Workers. Hyperdrive manages actual connection
 * pooling — the per-request client overhead is negligible.
 */

import postgres from "postgres";

// ── Client factory ────────────────────────────────────────────────────────────

/**
 * Create a per-request postgres client via Hyperdrive.
 * Call this at the top of each exported function; never cache the result.
 *
 * @param {object} env - Cloudflare Worker env bindings (must have HYPERDRIVE)
 * @returns {import("postgres").Sql} postgres.js tagged-template client
 */
export function getSql(env) {
  return postgres(env.HYPERDRIVE.connectionString, {
    max: 1,          // one logical slot per request; Hyperdrive pools beyond this
    idle_timeout: 5, // seconds — Workers are short-lived, release promptly
  });
}

// ── createSession ─────────────────────────────────────────────────────────────

/**
 * Insert a new council_sessions row.
 *
 * @param {object} params
 * @param {object} params.env
 * @param {string} params.sessionId  - 21-char nanoid
 * @param {string|null} params.caseId
 * @param {string|null} params.title
 * @param {string} params.hmacSig    - base64url HMAC-SHA256 of sessionId
 * @returns {Promise<object>} the inserted row
 */
export async function createSession({ env, sessionId, caseId, title, hmacSig }) {
  const sql = getSql(env);
  const rows = await sql`
    INSERT INTO council_sessions (session_id, case_id, title, hmac_sig)
    VALUES (${sessionId}, ${caseId ?? null}, ${title ?? null}, ${hmacSig})
    RETURNING *
  `;
  return rows[0];
}

// ── addTurn ───────────────────────────────────────────────────────────────────

/**
 * Insert a new council_turns row, race-safe via ON CONFLICT DO NOTHING.
 * Returns the inserted row, or null if a row with the same
 * (session_id, turn_index) already exists (concurrent duplicate).
 *
 * After a successful insert the session's total_turns and updated_at are
 * incremented/updated atomically.
 *
 * @param {object} params
 * @param {object} params.env
 * @param {string} params.sessionId
 * @param {string} params.turnId          - 21-char nanoid for this turn
 * @param {number} params.turnIndex       - 0-based index (< 15)
 * @param {string} params.userMessage
 * @param {string|null} params.userCaseContext
 * @param {object} params.payload         - full council response JSONB
 * @param {object|null} params.retrievedCases
 * @param {number|null} params.totalTokens
 * @param {number|null} params.totalLatencyMs
 * @returns {Promise<object|null>} inserted row or null on conflict
 */
export async function addTurn({
  env,
  sessionId,
  turnId,
  turnIndex,
  userMessage,
  userCaseContext,
  payload,
  retrievedCases,
  totalTokens,
  totalLatencyMs,
}) {
  const sql = getSql(env);
  const rows = await sql`
    INSERT INTO council_turns
      (turn_id, session_id, turn_index, user_message, user_case_context,
       payload, retrieved_cases, total_tokens, total_latency_ms)
    VALUES
      (${turnId}, ${sessionId}, ${turnIndex}, ${userMessage},
       ${userCaseContext ?? null},
       ${sql.json(payload)}, ${retrievedCases ? sql.json(retrievedCases) : null},
       ${totalTokens ?? null}, ${totalLatencyMs ?? null})
    ON CONFLICT (session_id, turn_index) DO NOTHING
    RETURNING *
  `;

  if (!rows || rows.length === 0) {
    // Conflict: duplicate (session_id, turn_index) — race condition hit
    return null;
  }

  // Update session: bump total_turns + refresh updated_at
  await sql`
    UPDATE council_sessions
    SET total_turns = total_turns + 1,
        updated_at  = now()
    WHERE session_id = ${sessionId}
  `;

  return rows[0];
}

// ── getSession ────────────────────────────────────────────────────────────────

/**
 * Fetch a session row plus all its turns (ordered by turn_index).
 *
 * @param {object} params
 * @param {object} params.env
 * @param {string} params.sessionId
 * @returns {Promise<{session: object, turns: object[]}|null>}
 */
export async function getSession({ env, sessionId }) {
  const sql = getSql(env);
  const sessions = await sql`
    SELECT * FROM council_sessions WHERE session_id = ${sessionId}
  `;
  if (!sessions || sessions.length === 0) return null;

  const turns = await sql`
    SELECT * FROM council_turns
    WHERE session_id = ${sessionId}
    ORDER BY turn_index ASC
  `;

  return { session: sessions[0], turns: turns ?? [] };
}

// ── listSessions ──────────────────────────────────────────────────────────────

/**
 * List recent sessions, newest first, with cursor-based pagination.
 *
 * @param {object} params
 * @param {object} params.env
 * @param {number} [params.limit=20]  - max rows (clamped to 100)
 * @param {string|null} [params.before] - ISO timestamp cursor (exclusive)
 * @returns {Promise<object[]>}
 */
export async function listSessions({ env, limit = 20, before = null }) {
  const sql = getSql(env);
  const clampedLimit = Math.min(Math.max(1, limit), 100);

  let rows;
  if (before) {
    rows = await sql`
      SELECT * FROM council_sessions
      WHERE updated_at < ${before}
      ORDER BY updated_at DESC
      LIMIT ${clampedLimit}
    `;
  } else {
    rows = await sql`
      SELECT * FROM council_sessions
      ORDER BY updated_at DESC
      LIMIT ${clampedLimit}
    `;
  }

  return rows ?? [];
}

// ── deleteSession ─────────────────────────────────────────────────────────────

/**
 * Delete a session (CASCADE removes its turns).
 *
 * @param {object} params
 * @param {object} params.env
 * @param {string} params.sessionId
 * @returns {Promise<boolean>} true if a row was deleted, false if not found
 */
export async function deleteSession({ env, sessionId }) {
  const sql = getSql(env);
  const rows = await sql`
    DELETE FROM council_sessions
    WHERE session_id = ${sessionId}
    RETURNING session_id
  `;
  return rows.length > 0;
}

// ── loadHistory ───────────────────────────────────────────────────────────────

/**
 * Load prior conversation history for expert + moderator prompt injection.
 * Returns an array of {user_message, assistant_message} pairs where
 * assistant_message = turn.payload.moderator.composed_answer || "".
 * Decision D2: only the moderator's composed_answer is fed back, not raw
 * expert opinions — simulates "reading the meeting summary".
 *
 * @param {object} params
 * @param {object} params.env
 * @param {string} params.sessionId
 * @param {number} [params.limit=15]
 * @returns {Promise<{user_message: string, assistant_message: string}[]>}
 */
export async function loadHistory({ env, sessionId, limit = 15 }) {
  const sql = getSql(env);
  const turns = await sql`
    SELECT user_message, payload
    FROM council_turns
    WHERE session_id = ${sessionId}
    ORDER BY turn_index ASC
    LIMIT ${limit}
  `;

  return (turns ?? []).map((t) => ({
    user_message: t.user_message,
    assistant_message: t.payload?.moderator?.composed_answer ?? "",
  }));
}
