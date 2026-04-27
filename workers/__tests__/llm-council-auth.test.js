/**
 * llm-council-auth.test.js
 *
 * Vitest tests for workers/llm-council/auth.js — HMAC session-token mint/verify
 * and nanoid21 generator.
 *
 * Test Integrity Rules (.omc/plans/llm-council-worker-migration.md §4) require
 * a red-green cycle per assertion. Each assertion below has been demonstrated
 * to fail when the expected value is flipped or when verifyToken is mutated
 * to bypass — see the executor's completion report.
 */

import { describe, it, expect } from "vitest";
import { mintToken, verifyToken, nanoid21 } from "../llm-council/auth.js";

// A non-secret fixture: the value of CSRF_SECRET in tests is fake; it just
// has to be stable across mint+verify within the same test.
const FAKE_ENV = { CSRF_SECRET: "test-secret-do-not-use-in-prod-9f8e7d6c" };
const OTHER_ENV = { CSRF_SECRET: "different-secret-1a2b3c4d5e6f" };
const SESSION_ID = "abc123def456ghi789jkl"; // shape resembles a 21-char nanoid

// ---------------------------------------------------------------------------
// nanoid21
// ---------------------------------------------------------------------------

describe("nanoid21", () => {
  it("returns a 21-character string", () => {
    const id = nanoid21();
    expect(id).toHaveLength(21);
  });

  it("uses only URL-safe characters [A-Za-z0-9_-]", () => {
    // Sample several IDs to reduce flakiness from any one rare draw.
    const samples = Array.from({ length: 50 }, () => nanoid21());
    const safeRe = /^[A-Za-z0-9_-]+$/;
    for (const id of samples) {
      expect(safeRe.test(id)).toBe(true);
    }
  });

  it("returns distinct values across successive calls (entropy sanity)", () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) ids.add(nanoid21());
    // 100 draws from a 64^21 space — collision probability is astronomically low.
    expect(ids.size).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// mintToken
// ---------------------------------------------------------------------------

describe("mintToken", () => {
  it("returns a non-empty base64url string", async () => {
    const token = await mintToken(FAKE_ENV, SESSION_ID);
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
    // base64url alphabet only — no padding, no '+' or '/'
    expect(/^[A-Za-z0-9_-]+$/.test(token)).toBe(true);
  });

  it("is deterministic for the same secret + sessionId pair", async () => {
    const a = await mintToken(FAKE_ENV, SESSION_ID);
    const b = await mintToken(FAKE_ENV, SESSION_ID);
    expect(a).toBe(b);
  });

  it("produces different tokens for different sessionIds (same secret)", async () => {
    const a = await mintToken(FAKE_ENV, "session-one");
    const b = await mintToken(FAKE_ENV, "session-two");
    expect(a).not.toBe(b);
  });

  it("produces different tokens for the same sessionId under different secrets", async () => {
    const a = await mintToken(FAKE_ENV, SESSION_ID);
    const b = await mintToken(OTHER_ENV, SESSION_ID);
    expect(a).not.toBe(b);
  });

  it("throws when env.CSRF_SECRET is missing", async () => {
    await expect(mintToken({}, SESSION_ID)).rejects.toThrow(/CSRF_SECRET/);
  });

  it("throws when env is null", async () => {
    await expect(mintToken(null, SESSION_ID)).rejects.toThrow(/CSRF_SECRET/);
  });

  it("throws when sessionId is empty", async () => {
    await expect(mintToken(FAKE_ENV, "")).rejects.toThrow(/sessionId/);
  });
});

// ---------------------------------------------------------------------------
// verifyToken — POSITIVE path
// ---------------------------------------------------------------------------

describe("verifyToken — happy path", () => {
  it("accepts a freshly minted token (round-trip)", async () => {
    const token = await mintToken(FAKE_ENV, SESSION_ID);
    const ok = await verifyToken(FAKE_ENV, SESSION_ID, token);
    expect(ok).toBe(true);
  });

  it("accepts the round-trip for a different session under same secret", async () => {
    const sid = "another-session-id-xyz";
    const token = await mintToken(FAKE_ENV, sid);
    expect(await verifyToken(FAKE_ENV, sid, token)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// verifyToken — NEGATIVE paths (security-critical)
// ---------------------------------------------------------------------------

describe("verifyToken — rejection paths", () => {
  it("rejects a tampered token with one byte flipped (still valid base64url)", async () => {
    const token = await mintToken(FAKE_ENV, SESSION_ID);
    // Flip the first character to a different valid base64url char.
    // We must guarantee the new char is in the alphabet AND differs from the
    // original so the underlying bytes change.
    const alphabet =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    const firstChar = token[0];
    const replacement =
      alphabet[(alphabet.indexOf(firstChar) + 1) % alphabet.length];
    const tampered = replacement + token.slice(1);

    // Sanity: the tampered token must actually differ AND remain base64url-shaped.
    expect(tampered).not.toBe(token);
    expect(/^[A-Za-z0-9_-]+$/.test(tampered)).toBe(true);

    const ok = await verifyToken(FAKE_ENV, SESSION_ID, tampered);
    expect(ok).toBe(false);
  });

  it("rejects a valid token presented for the wrong sessionId", async () => {
    const tokenForSessionA = await mintToken(FAKE_ENV, "session-A");
    const ok = await verifyToken(FAKE_ENV, "session-B", tokenForSessionA);
    expect(ok).toBe(false);
  });

  it("rejects when the verifier holds a different CSRF_SECRET", async () => {
    const token = await mintToken(FAKE_ENV, SESSION_ID);
    const ok = await verifyToken(OTHER_ENV, SESSION_ID, token);
    expect(ok).toBe(false);
  });

  it("rejects empty-string token", async () => {
    expect(await verifyToken(FAKE_ENV, SESSION_ID, "")).toBe(false);
  });

  it("rejects null token", async () => {
    expect(await verifyToken(FAKE_ENV, SESSION_ID, null)).toBe(false);
  });

  it("rejects undefined token", async () => {
    expect(await verifyToken(FAKE_ENV, SESSION_ID, undefined)).toBe(false);
  });

  it("rejects a token whose decoded length is not 32 bytes", async () => {
    // Decodes to 3 bytes (not the 32-byte HMAC-SHA256 tag size).
    const tooShort = "AAAA";
    expect(await verifyToken(FAKE_ENV, SESSION_ID, tooShort)).toBe(false);
  });

  it("rejects a token containing non-base64url characters", async () => {
    // '!' and '*' are not in the base64url alphabet — atob will throw, and
    // verifyToken must catch and return false (not propagate).
    expect(
      await verifyToken(FAKE_ENV, SESSION_ID, "!!!not*valid!!!"),
    ).toBe(false);
  });

  it("rejects when CSRF_SECRET is missing in env", async () => {
    const token = await mintToken(FAKE_ENV, SESSION_ID);
    expect(await verifyToken({}, SESSION_ID, token)).toBe(false);
  });

  it("rejects when env is null", async () => {
    const token = await mintToken(FAKE_ENV, SESSION_ID);
    expect(await verifyToken(null, SESSION_ID, token)).toBe(false);
  });

  it("rejects when sessionId is empty even with a structurally valid token", async () => {
    const token = await mintToken(FAKE_ENV, SESSION_ID);
    expect(await verifyToken(FAKE_ENV, "", token)).toBe(false);
  });
});
