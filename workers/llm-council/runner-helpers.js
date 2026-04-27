/**
 * runner-helpers.js — Pure utility helpers for the LLM Council Worker.
 *
 * Ported 1:1 from immi_case_downloader/llm_council.py.
 * All functions are pure (no I/O, no side effects) for easy unit testing.
 */

// ---------------------------------------------------------------------------
// normalizeGatewayModel
// ---------------------------------------------------------------------------

/**
 * Ensure model name carries a CF Gateway provider prefix.
 *
 * The compat endpoint requires `<provider>/<model>` form. Bare model names
 * (e.g. legacy env values like `claude-sonnet-4-6`) get auto-prefixed.
 *
 * @param {string} model
 * @param {string} defaultPrefix
 * @returns {string}
 */
export function normalizeGatewayModel(model, defaultPrefix) {
  const name = (model || "").trim();
  if (name.includes("/")) return name;
  return name ? `${defaultPrefix}/${name}` : name;
}

// ---------------------------------------------------------------------------
// extractChatCompletionText
// ---------------------------------------------------------------------------

/**
 * Parse OpenAI Chat Completions response: choices[0].message.content.
 *
 * Some providers return content as a list of parts (each with `text` or
 * `content` key); those are joined with double-newlines.
 *
 * @param {object} payload
 * @returns {string}
 */
export function extractChatCompletionText(payload) {
  const choices = payload?.choices;
  if (!Array.isArray(choices) || choices.length === 0) return "";
  const first = choices[0];
  if (!first || typeof first !== "object") return "";
  const message = first.message;
  if (!message || typeof message !== "object") return "";
  let content = message.content ?? "";
  if (Array.isArray(content)) {
    // Some providers return content as parts list
    const parts = [];
    for (const part of content) {
      if (part && typeof part === "object") {
        const text = part.text || part.content || "";
        if (typeof text === "string" && text) parts.push(text);
      } else if (typeof part === "string") {
        parts.push(part);
      }
    }
    content = parts.join("\n\n");
  }
  return (content || "").trim();
}

// ---------------------------------------------------------------------------
// stripReasoningArtifacts
// ---------------------------------------------------------------------------

/**
 * Drop reasoning-model `<think>...</think>` chain-of-thought from output.
 *
 * Handles two shapes:
 * 1. Properly fenced: `<think>...</think>actual answer` → return only the answer.
 * 2. QwQ-style (no opening tag, just trailing close):
 *    `reasoning text </think>actual answer`
 *    — find the LAST `</think>` and discard everything before it.
 *
 * @param {string} text
 * @returns {string}
 */
export function stripReasoningArtifacts(text) {
  if (!text) return text;
  // Step 1: remove any well-fenced think blocks anywhere in the text.
  // Use a fresh regex each call to avoid stateful lastIndex issues.
  let cleaned = text.replace(/<think\s*>[\s\S]*?<\/think\s*>/gi, "");
  // Step 2: if a stray `</think>` remains (QwQ-style, no opening tag),
  // treat everything before the last close-tag as reasoning and drop it.
  const closeRe = /<\/think\s*>/gi;
  let lastMatch = null;
  let m;
  while ((m = closeRe.exec(cleaned)) !== null) {
    lastMatch = m;
  }
  if (lastMatch !== null) {
    cleaned = cleaned.slice(lastMatch.index + lastMatch[0].length);
  }
  return cleaned.trim();
}

// ---------------------------------------------------------------------------
// repairTruncatedJson
// ---------------------------------------------------------------------------

/**
 * Best-effort close of LLM-truncated JSON so it parses.
 *
 * Walks the stream tracking string/escape/brace/bracket state, truncates
 * back to the last complete value, then appends matching close characters
 * in reverse stack order. Lossy: incomplete trailing fields are discarded.
 *
 * Returns the repaired body (no leading prose), or the original text if
 * no opening `{` is found.
 *
 * @param {string} text
 * @returns {string}
 */
export function repairTruncatedJson(text) {
  if (!text) return text;
  const start = text.indexOf("{");
  if (start < 0) return text;
  let body = text.slice(start);

  /** @type {string[]} tracks unclosed '{' or '[' */
  const stack = [];
  let inStr = false;
  let escape = false;
  let lastSafe = 0;         // index right after the last complete top-level value
  let stackAtLastSafe = []; // snapshot of stack at lastSafe

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inStr) {
      if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inStr = false;
      }
      continue;
    }
    if (ch === '"') {
      inStr = true;
    } else if (ch === "{" || ch === "[") {
      stack.push(ch);
    } else if (ch === "}" || ch === "]") {
      if (
        stack.length > 0 &&
        ((ch === "}" && stack[stack.length - 1] === "{") ||
          (ch === "]" && stack[stack.length - 1] === "["))
      ) {
        stack.pop();
        lastSafe = i + 1;
        stackAtLastSafe = [...stack];
        if (stack.length === 0) {
          return body.slice(0, lastSafe);
        }
      }
    } else if (ch === "," && !inStr) {
      lastSafe = i; // before this comma is a complete value
      stackAtLastSafe = [...stack];
    }
  }

  // Truncated input — walk back to the last clean checkpoint
  if (stack.length > 0) {
    body = lastSafe > 0 ? body.slice(0, lastSafe) : body;
  }
  // Drop trailing whitespace, commas, and colons (orphan key separators)
  body = body.replace(/[,:\n\r\t ]+$/, "");
  // Close containers that were open AT lastSafe
  while (stackAtLastSafe.length > 0) {
    const opener = stackAtLastSafe.pop();
    body += opener === "{" ? "}" : "]";
  }
  return body;
}

// ---------------------------------------------------------------------------
// extractFirstJsonObject
// ---------------------------------------------------------------------------

/**
 * Parse the first JSON object out of a possibly noisy LLM response.
 *
 * Tries (in order):
 * 1. Strip markdown ```json fence if present, then direct JSON.parse.
 * 2. Brace-balancing extraction — walks from first `{`, honors string/escape.
 * 3. Truncation repair via repairTruncatedJson, then parse.
 * 4. Legacy greedy regex fallback.
 *
 * Returns null if no valid JSON object can be parsed.
 *
 * @param {string} text
 * @returns {object|null}
 */
export function extractFirstJsonObject(text) {
  if (!text) return null;
  let stripped = text.trim();

  // 1. Strip ```json ... ``` fence if present
  const fenceMatch = stripped.match(/^```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    stripped = fenceMatch[1].trim();
  }

  // 2. Direct parse on the (possibly de-fenced) text
  try {
    const payload = JSON.parse(stripped);
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      return payload;
    }
  } catch (_) {
    // fall through
  }

  // 3. Brace-balanced walk
  const startIdx = stripped.indexOf("{");
  if (startIdx >= 0) {
    let depth = 0;
    let inStr = false;
    let escape = false;
    for (let idx = startIdx; idx < stripped.length; idx++) {
      const ch = stripped[idx];
      if (escape) {
        escape = false;
        continue;
      }
      if (inStr) {
        if (ch === "\\") escape = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') {
        inStr = true;
      } else if (ch === "{") {
        depth++;
      } else if (ch === "}") {
        depth--;
        if (depth === 0) {
          const candidate = stripped.slice(startIdx, idx + 1);
          try {
            const payload = JSON.parse(candidate);
            if (payload && typeof payload === "object" && !Array.isArray(payload)) {
              return payload;
            }
          } catch (_) {
            // break to next strategy
          }
          break;
        }
      }
    }
  }

  // 4. Truncation repair
  const repaired = repairTruncatedJson(stripped);
  if (repaired && repaired !== stripped) {
    try {
      const payload = JSON.parse(repaired);
      if (payload && typeof payload === "object" && !Array.isArray(payload)) {
        return payload;
      }
    } catch (_) {
      // fall through
    }
  }

  // 5. Legacy greedy regex fallback
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const payload = JSON.parse(match[0]);
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      return payload;
    }
  } catch (_) {
    return null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// isGpt5ReasoningModel
// ---------------------------------------------------------------------------

/**
 * gpt-5 family models reject `max_tokens` and `temperature != 1`.
 *
 * Covers `openai/gpt-5`, `openai/gpt-5-mini`, future gpt-5 variants.
 *
 * @param {string} model
 * @returns {boolean}
 */
export function isGpt5ReasoningModel(model) {
  return (model || "").toLowerCase().startsWith("openai/gpt-5");
}
