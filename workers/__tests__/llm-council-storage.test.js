/**
 * llm-council-storage.test.js
 *
 * Vitest unit tests for workers/llm-council/storage.js
 *
 * WHY MOCKING IS REQUIRED:
 *   The postgres package opens real TCP connections to Hyperdrive/PostgreSQL.
 *   In a unit-test environment there is no Hyperdrive binding and no DB.
 *   We mock the entire `postgres` module so we can intercept the SQL
 *   tagged-template calls and assert on the string + parameters produced
 *   by each storage function — without any network I/O.
 *
 * MOCK SCOPE:
 *   vi.mock("postgres") replaces the module for this test file only.
 *   Each test configures mockSqlFn.mockReturnValue(...) to control what
 *   the fake sql`` call returns.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock setup — must be declared before the module under test is imported
// ---------------------------------------------------------------------------

/** The fake tagged-template function returned by postgres(connectionString) */
const mockSqlFn = vi.fn();

/**
 * postgres(connectionString, opts) returns the sql tagged-template fn.
 * We also need sql.json(val) for JSONB params.
 */
vi.mock("postgres", () => {
  const sqlFn = vi.fn((...args) => mockSqlFn(...args));
  // sql.json wraps a value so storage.js can call sql.json(payload)
  sqlFn.json = (val) => ({ __json: val });
  // postgres() factory returns sqlFn
  const postgresFactory = vi.fn(() => sqlFn);
  return { default: postgresFactory };
});

// Import AFTER mock is set up
import {
  getSql,
  createSession,
  addTurn,
  getSession,
  listSessions,
  deleteSession,
  loadHistory,
} from "../llm-council/storage.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fake env with a minimal HYPERDRIVE binding */
const makeEnv = () => ({
  HYPERDRIVE: { connectionString: "postgres://test:test@localhost/test" },
});

/** Extract the raw SQL string from a tagged-template call.
 *  vitest captures args[0] (the TemplateStringsArray) and args[1..] (values).
 *  We join the strings array to get the SQL text for assertion. */
function capturedSql(callArgs) {
  // callArgs[0] is the TemplateStringsArray (strings); rest are interpolated values
  return callArgs[0].join("?").trim();
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: most calls return an empty array (no rows)
  mockSqlFn.mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// getSql
// ---------------------------------------------------------------------------

describe("getSql", () => {
  it("calls postgres() with env.HYPERDRIVE.connectionString", async () => {
    const { default: postgres } = await import("postgres");
    const env = makeEnv();
    getSql(env);
    expect(postgres).toHaveBeenCalledWith(
      "postgres://test:test@localhost/test",
      expect.objectContaining({ max: 1 })
    );
  });

  it("returns a new client on every call (never singleton)", async () => {
    const { default: postgres } = await import("postgres");
    const env = makeEnv();
    getSql(env);
    getSql(env);
    // Two separate calls to the postgres factory
    expect(postgres).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// createSession
// ---------------------------------------------------------------------------

describe("createSession", () => {
  it("issues INSERT INTO council_sessions ... RETURNING *", async () => {
    const fakeRow = {
      session_id: "sess_abc",
      case_id: null,
      title: "Test session",
      hmac_sig: "sig123",
      status: "active",
      total_turns: 0,
    };
    mockSqlFn.mockResolvedValue([fakeRow]);

    const result = await createSession({
      env: makeEnv(),
      sessionId: "sess_abc",
      caseId: null,
      title: "Test session",
      hmacSig: "sig123",
    });

    expect(result).toEqual(fakeRow);

    const sqlStr = capturedSql(mockSqlFn.mock.calls[0]);
    expect(sqlStr).toContain("INSERT INTO council_sessions");
    expect(sqlStr).toContain("RETURNING *");
  });

  it("passes hmacSig as a parameter (not embedded in SQL string)", async () => {
    mockSqlFn.mockResolvedValue([{ session_id: "s1", hmac_sig: "mysig" }]);

    await createSession({
      env: makeEnv(),
      sessionId: "s1",
      caseId: null,
      title: null,
      hmacSig: "mysig",
    });

    // The interpolated values passed to the tagged template should include the hmacSig
    const callArgs = mockSqlFn.mock.calls[0];
    const interpolatedValues = callArgs.slice(1);
    expect(interpolatedValues).toContain("mysig");
  });
});

// ---------------------------------------------------------------------------
// addTurn — normal path
// ---------------------------------------------------------------------------

describe("addTurn (normal path)", () => {
  it("issues INSERT INTO council_turns with ON CONFLICT DO NOTHING RETURNING", async () => {
    const fakeTurnRow = {
      turn_id: "turn_001",
      session_id: "sess_abc",
      turn_index: 0,
      user_message: "What are the grounds?",
    };
    // First call = INSERT (returns the row); second call = UPDATE session
    mockSqlFn
      .mockResolvedValueOnce([fakeTurnRow])  // INSERT ... RETURNING
      .mockResolvedValueOnce([]);             // UPDATE council_sessions

    const result = await addTurn({
      env: makeEnv(),
      sessionId: "sess_abc",
      turnId: "turn_001",
      turnIndex: 0,
      userMessage: "What are the grounds?",
      userCaseContext: null,
      payload: { moderator: { composed_answer: "Answer" } },
      retrievedCases: null,
      totalTokens: 500,
      totalLatencyMs: 1200,
    });

    expect(result).toEqual(fakeTurnRow);

    const sqlStr = capturedSql(mockSqlFn.mock.calls[0]);
    expect(sqlStr).toContain("INSERT INTO council_turns");
    expect(sqlStr).toContain("ON CONFLICT (session_id, turn_index) DO NOTHING");
    expect(sqlStr).toContain("RETURNING *");
  });

  it("also UPDATE council_sessions (bumps total_turns) after successful insert", async () => {
    mockSqlFn
      .mockResolvedValueOnce([{ turn_id: "t1" }])
      .mockResolvedValueOnce([]);

    await addTurn({
      env: makeEnv(),
      sessionId: "sess_xyz",
      turnId: "t1",
      turnIndex: 1,
      userMessage: "Follow up",
      userCaseContext: null,
      payload: { moderator: { composed_answer: "" } },
      retrievedCases: null,
      totalTokens: null,
      totalLatencyMs: null,
    });

    // Two sql calls total: INSERT + UPDATE
    expect(mockSqlFn).toHaveBeenCalledTimes(2);
    const updateSql = capturedSql(mockSqlFn.mock.calls[1]);
    expect(updateSql).toContain("UPDATE council_sessions");
    expect(updateSql).toContain("total_turns = total_turns + 1");
  });
});

// ---------------------------------------------------------------------------
// addTurn — race condition (ON CONFLICT returns no rows → null)
// ---------------------------------------------------------------------------

describe("addTurn (race condition)", () => {
  it("returns null when INSERT conflicts (duplicate turn_index)", async () => {
    // DB returns empty array — the ON CONFLICT DO NOTHING swallowed the insert
    mockSqlFn.mockResolvedValueOnce([]);

    const result = await addTurn({
      env: makeEnv(),
      sessionId: "sess_abc",
      turnId: "turn_dup",
      turnIndex: 0,            // same index as an existing turn → conflict
      userMessage: "Duplicate",
      userCaseContext: null,
      payload: { moderator: { composed_answer: "" } },
      retrievedCases: null,
      totalTokens: null,
      totalLatencyMs: null,
    });

    expect(result).toBeNull();
  });

  it("does NOT call UPDATE council_sessions when there is a conflict", async () => {
    mockSqlFn.mockResolvedValueOnce([]); // conflict → no rows

    await addTurn({
      env: makeEnv(),
      sessionId: "sess_abc",
      turnId: "turn_dup",
      turnIndex: 0,
      userMessage: "Duplicate",
      userCaseContext: null,
      payload: { moderator: { composed_answer: "" } },
      retrievedCases: null,
      totalTokens: null,
      totalLatencyMs: null,
    });

    // Only one sql call (the INSERT); the UPDATE must NOT fire
    expect(mockSqlFn).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// getSession
// ---------------------------------------------------------------------------

describe("getSession", () => {
  it("returns null when session is not found", async () => {
    mockSqlFn.mockResolvedValue([]); // empty for both queries

    const result = await getSession({ env: makeEnv(), sessionId: "missing" });
    expect(result).toBeNull();
  });

  it("returns {session, turns} when session exists", async () => {
    const fakeSession = { session_id: "sess_abc", total_turns: 2 };
    const fakeTurns = [
      { turn_id: "t1", turn_index: 0 },
      { turn_id: "t2", turn_index: 1 },
    ];

    mockSqlFn
      .mockResolvedValueOnce([fakeSession]) // SELECT council_sessions
      .mockResolvedValueOnce(fakeTurns);    // SELECT council_turns

    const result = await getSession({ env: makeEnv(), sessionId: "sess_abc" });

    expect(result).not.toBeNull();
    expect(result.session).toEqual(fakeSession);
    expect(result.turns).toHaveLength(2);
  });

  it("issues SELECT ... WHERE session_id = ? for sessions", async () => {
    const fakeSession = { session_id: "sess_abc" };
    mockSqlFn
      .mockResolvedValueOnce([fakeSession])
      .mockResolvedValueOnce([]);

    await getSession({ env: makeEnv(), sessionId: "sess_abc" });

    const sqlStr = capturedSql(mockSqlFn.mock.calls[0]);
    expect(sqlStr).toContain("SELECT * FROM council_sessions");
    expect(sqlStr).toContain("WHERE session_id =");
  });
});

// ---------------------------------------------------------------------------
// listSessions
// ---------------------------------------------------------------------------

describe("listSessions", () => {
  it("issues SELECT from council_sessions ORDER BY updated_at DESC", async () => {
    mockSqlFn.mockResolvedValue([{ session_id: "s1" }]);

    await listSessions({ env: makeEnv() });

    const sqlStr = capturedSql(mockSqlFn.mock.calls[0]);
    expect(sqlStr).toContain("SELECT * FROM council_sessions");
    expect(sqlStr).toContain("ORDER BY updated_at DESC");
  });

  it("adds WHERE updated_at < cursor when before is provided", async () => {
    mockSqlFn.mockResolvedValue([]);

    await listSessions({
      env: makeEnv(),
      limit: 10,
      before: "2026-04-01T00:00:00Z",
    });

    const sqlStr = capturedSql(mockSqlFn.mock.calls[0]);
    expect(sqlStr).toContain("WHERE updated_at <");
  });

  it("clamps limit to 100", async () => {
    mockSqlFn.mockResolvedValue([]);

    await listSessions({ env: makeEnv(), limit: 999 });

    // The clamped value (100) should be among the interpolated params
    const callArgs = mockSqlFn.mock.calls[0];
    const interpolatedValues = callArgs.slice(1);
    expect(interpolatedValues).toContain(100);
  });

  it("returns empty array when no sessions exist", async () => {
    mockSqlFn.mockResolvedValue([]);
    const result = await listSessions({ env: makeEnv() });
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// deleteSession
// ---------------------------------------------------------------------------

describe("deleteSession", () => {
  it("issues DELETE FROM council_sessions WHERE session_id = ?", async () => {
    mockSqlFn.mockResolvedValue([{ session_id: "sess_abc" }]);

    await deleteSession({ env: makeEnv(), sessionId: "sess_abc" });

    const sqlStr = capturedSql(mockSqlFn.mock.calls[0]);
    expect(sqlStr).toContain("DELETE FROM council_sessions");
    expect(sqlStr).toContain("WHERE session_id =");
  });

  it("returns true when a row was deleted", async () => {
    mockSqlFn.mockResolvedValue([{ session_id: "sess_abc" }]);

    const result = await deleteSession({
      env: makeEnv(),
      sessionId: "sess_abc",
    });
    expect(result).toBe(true);
  });

  it("returns false when session was not found (no rows returned)", async () => {
    mockSqlFn.mockResolvedValue([]);

    const result = await deleteSession({
      env: makeEnv(),
      sessionId: "nonexistent",
    });
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// loadHistory
// ---------------------------------------------------------------------------

describe("loadHistory", () => {
  it("returns array of {user_message, assistant_message} pairs", async () => {
    mockSqlFn.mockResolvedValue([
      {
        user_message: "What are the grounds?",
        payload: { moderator: { composed_answer: "The main grounds are..." } },
      },
      {
        user_message: "Can you elaborate?",
        payload: { moderator: { composed_answer: "Elaborating..." } },
      },
    ]);

    const result = await loadHistory({ env: makeEnv(), sessionId: "sess_abc" });

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      user_message: "What are the grounds?",
      assistant_message: "The main grounds are...",
    });
    expect(result[1]).toEqual({
      user_message: "Can you elaborate?",
      assistant_message: "Elaborating...",
    });
  });

  it("uses empty string when payload.moderator.composed_answer is missing", async () => {
    mockSqlFn.mockResolvedValue([
      {
        user_message: "Question without answer",
        payload: { moderator: {} }, // no composed_answer key
      },
    ]);

    const result = await loadHistory({ env: makeEnv(), sessionId: "sess_abc" });

    expect(result[0].assistant_message).toBe("");
  });

  it("uses empty string when payload.moderator is entirely absent", async () => {
    mockSqlFn.mockResolvedValue([
      {
        user_message: "Another question",
        payload: {}, // no moderator at all
      },
    ]);

    const result = await loadHistory({ env: makeEnv(), sessionId: "sess_abc" });

    expect(result[0].assistant_message).toBe("");
  });

  it("issues SELECT user_message, payload FROM council_turns ORDER BY turn_index ASC", async () => {
    mockSqlFn.mockResolvedValue([]);

    await loadHistory({ env: makeEnv(), sessionId: "sess_abc" });

    const sqlStr = capturedSql(mockSqlFn.mock.calls[0]);
    expect(sqlStr).toContain("SELECT user_message, payload");
    expect(sqlStr).toContain("FROM council_turns");
    expect(sqlStr).toContain("ORDER BY turn_index ASC");
  });

  it("returns empty array when no turns exist", async () => {
    mockSqlFn.mockResolvedValue([]);
    const result = await loadHistory({ env: makeEnv(), sessionId: "sess_abc" });
    expect(result).toEqual([]);
  });
});
