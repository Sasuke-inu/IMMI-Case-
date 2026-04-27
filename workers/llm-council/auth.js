/**
 * auth.js — HMAC-signed session token mint + verify for LLM Council sessions.
 *
 * Token shape:  base64url(HMAC-SHA256(env.CSRF_SECRET, sessionId))
 *
 * Stateless: no DB lookup needed for verification. Reuses the existing
 * `CSRF_SECRET` Wrangler secret (already used by proxy.js CSRF infra).
 *
 * Constant-time comparison: verifyToken decodes the candidate signature and
 * passes it directly to `crypto.subtle.verify("HMAC", ...)`, which is
 * constant-time by Web Crypto specification. We never use `===` on token
 * bytes / strings (timing leak).
 *
 * NOTE: never log token values. Use `token.slice(0, 8) + "…(" + len + ")"`
 * if you need a debug breadcrumb.
 */

// ---------------------------------------------------------------------------
// base64url encode / decode (Worker-safe; mirrors proxy.js helpers)
// ---------------------------------------------------------------------------

/**
 * Encode a Uint8Array / ArrayBuffer to base64url (no padding).
 * @param {ArrayBuffer | Uint8Array} bytes
 * @returns {string}
 */
function b64urlEncode(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return btoa(String.fromCharCode(...u8))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Decode a base64url string back to bytes. Throws on malformed input
 * (non-base64url characters); callers MUST wrap in try/catch when validating
 * untrusted tokens — see verifyToken below.
 * @param {string} s
 * @returns {Uint8Array}
 */
function b64urlDecode(s) {
  let str = s.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  // atob throws on invalid characters — caller must catch.
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---------------------------------------------------------------------------
// HMAC key import (lazy; one per call — Workers prohibit cross-request keys)
// ---------------------------------------------------------------------------

/**
 * Import the secret string as a raw HMAC-SHA256 key.
 * @param {string} secret
 * @returns {Promise<CryptoKey>}
 */
async function importHmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

// ---------------------------------------------------------------------------
// nanoid21 — 21-char URL-safe random ID
// ---------------------------------------------------------------------------

const NANOID_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
// 64 chars → exactly 6 bits per output char → use mask 0b00111111 (63).
// Since 64 divides 256 evenly, every random byte yields a uniformly-distributed
// alphabet index when masked — no rejection sampling needed.
const NANOID_MASK = 63;
const NANOID_LENGTH = 21;

/**
 * Generate a 21-character URL-safe random identifier.
 *
 * Alphabet: [A-Za-z0-9_-] (64 chars). Cryptographically random via
 * `crypto.getRandomValues`. Equivalent in entropy to nanoid v3 default
 * (~126 bits over 21 chars).
 *
 * @returns {string}
 */
export function nanoid21() {
  const bytes = new Uint8Array(NANOID_LENGTH);
  crypto.getRandomValues(bytes);
  let id = "";
  for (let i = 0; i < NANOID_LENGTH; i++) {
    id += NANOID_ALPHABET[bytes[i] & NANOID_MASK];
  }
  return id;
}

// ---------------------------------------------------------------------------
// mintToken
// ---------------------------------------------------------------------------

/**
 * Compute base64url(HMAC-SHA256(env.CSRF_SECRET, sessionId)).
 *
 * @param {{CSRF_SECRET?: string}} env
 * @param {string} sessionId
 * @returns {Promise<string>}
 * @throws {Error} when env.CSRF_SECRET is missing or sessionId is empty.
 */
export async function mintToken(env, sessionId) {
  if (!env || !env.CSRF_SECRET) {
    throw new Error("CSRF_SECRET not configured");
  }
  if (typeof sessionId !== "string" || sessionId.length === 0) {
    throw new Error("sessionId required");
  }
  const key = await importHmacKey(env.CSRF_SECRET);
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(sessionId),
  );
  return b64urlEncode(sig);
}

// ---------------------------------------------------------------------------
// verifyToken
// ---------------------------------------------------------------------------

/**
 * Constant-time verify a session token against a sessionId.
 *
 * Uses `crypto.subtle.verify("HMAC", ...)`, which by Web Crypto specification
 * compares MAC bytes in constant time. We deliberately do NOT short-circuit
 * on first byte mismatch and we never use `===` on the token itself.
 *
 * Returns false (never throws) for any malformed input, missing secret,
 * decode failure, or signature mismatch — callers should treat the boolean
 * as the sole authority.
 *
 * @param {{CSRF_SECRET?: string}} env
 * @param {string} sessionId
 * @param {string | null | undefined} token  base64url-encoded HMAC
 * @returns {Promise<boolean>}
 */
export async function verifyToken(env, sessionId, token) {
  if (!env || !env.CSRF_SECRET) return false;
  if (typeof sessionId !== "string" || sessionId.length === 0) return false;
  if (typeof token !== "string" || token.length === 0) return false;

  let sigBytes;
  try {
    sigBytes = b64urlDecode(token);
  } catch {
    return false;
  }

  // HMAC-SHA256 always produces 32 bytes. The length of an HMAC tag is not
  // secret, so a length pre-check is not a timing leak.
  if (sigBytes.length !== 32) return false;

  let key;
  try {
    key = await importHmacKey(env.CSRF_SECRET);
  } catch {
    return false;
  }

  try {
    return await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      new TextEncoder().encode(sessionId),
    );
  } catch {
    return false;
  }
}
