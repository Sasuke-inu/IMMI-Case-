/**
 * runner.js — Main LLM Council runner for the Cloudflare Worker.
 *
 * Ports run_immi_council, _run_moderator, _run_gateway_expert, and
 * _gateway_chat_completion from immi_case_downloader/llm_council.py.
 *
 * New: buildHistoryMessages(prevTurns) — injects prior conversation turns
 * (D2: moderator composed_answer as assistant content) into expert + moderator
 * prompts so each expert sees the panel's prior meeting summaries.
 */

import {
  normalizeGatewayModel,
  extractChatCompletionText,
  stripReasoningArtifacts,
  extractFirstJsonObject,
  isGpt5ReasoningModel,
} from "./runner-helpers.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CF_GATEWAY_DEFAULT_URL =
  "https://gateway.ai.cloudflare.com/v1/30ffcfbf8c4103048bc38a5398b7ec99" +
  "/immi-council/compat/chat/completions";

const DEFAULT_OPENAI_MODEL = "openai/gpt-5-mini-2025-08-07";
const DEFAULT_GEMINI_PRO_MODEL = "google-ai-studio/gemini-3.1-pro-preview";
const DEFAULT_ANTHROPIC_MODEL = "anthropic/claude-sonnet-4-6";
const DEFAULT_GEMINI_FLASH_MODEL = "google-ai-studio/gemini-2.5-flash";

// 6144 verified probe: gives gpt-5 reasoning models headroom for hidden
// reasoning tokens before visible output. 4096 was probe-known to starve
// reasoning models on heavy legal prompts (gpt-5-mini, gemini-2.5-pro).
const DEFAULT_MAX_OUTPUT_TOKENS = 6144;
const DEFAULT_MODERATOR_MAX_TOKENS = 8192;

// Per-model timeout ceilings (Sprint 1 P1). Different providers have different
// reasoning latency profiles; one-size-fits-all 120s either starves anthropic
// or wastes 90s on a hung gemini call. Override via env.
//   anthropic claude-sonnet-4-6 with thinking: 50-90s typical, 150s ceiling
//   gpt-5-mini reasoning_effort=low: 30-60s typical, 90s ceiling
//   gemini pro/flash: 10-30s typical, 60-90s ceiling
const DEFAULT_PER_MODEL_TIMEOUT_MS = {
  anthropic: 150_000,
  openai: 90_000,
  "google-ai-studio": 60_000,
  moderator: 90_000,
};

function timeoutForModel(env, model, isModerator = false) {
  if (isModerator) {
    return parseInt(env.LLM_COUNCIL_MODERATOR_TIMEOUT_MS, 10) || DEFAULT_PER_MODEL_TIMEOUT_MS.moderator;
  }
  const m = (model || "").toLowerCase();
  if (m.startsWith("anthropic/")) {
    return parseInt(env.LLM_COUNCIL_ANTHROPIC_TIMEOUT_MS, 10) || DEFAULT_PER_MODEL_TIMEOUT_MS.anthropic;
  }
  if (m.startsWith("openai/")) {
    return parseInt(env.LLM_COUNCIL_OPENAI_TIMEOUT_MS, 10) || DEFAULT_PER_MODEL_TIMEOUT_MS.openai;
  }
  if (m.startsWith("google-ai-studio/")) {
    return parseInt(env.LLM_COUNCIL_GEMINI_TIMEOUT_MS, 10) || DEFAULT_PER_MODEL_TIMEOUT_MS["google-ai-studio"];
  }
  return 90_000;
}

// Structured log helper (Sprint 1 P1). Emits JSON lines suitable for
// Cloudflare Logpush → Grafana/Datadog filtering. Schema:
//   {ts, event, provider_key, model, latency_ms, ok, error_class?, attempt?}
function logCouncilEvent(fields) {
  try {
    console.log(JSON.stringify({ ts: new Date().toISOString(), ...fields }));
  } catch (_) {
    // logging must never throw
  }
}

function classifyError(err) {
  const msg = String((err && err.message) || err || "").toLowerCase();
  if (msg.includes("timeout") || msg.includes("aborted")) return "timeout";
  if (msg.includes("http 4")) return "client_error";
  if (msg.includes("http 5")) return "server_error";
  if (msg.includes("did not include text output")) return "empty_output";
  if (msg.includes("missing cf_aig_token")) return "auth_missing";
  return "unknown";
}

// ---------------------------------------------------------------------------
// System prompts (ported verbatim from llm_council.py DEFAULT_*_SYSTEM_PROMPT)
// ---------------------------------------------------------------------------

export const DEFAULT_OPENAI_SYSTEM_PROMPT =
  "Role: Senior legal research counsel for Australian immigration matters. " +
  "Output objective: produce rigorous legal research analysis, not legal advice. " +
  "Required method: issue framing, governing rule identification, application, counterarguments, and confidence assessment. " +
  "Evidence discipline: never invent authorities, never fabricate quotations, and distinguish verified facts from assumptions. " +
  "Jurisdiction discipline: prioritize Australian legislation, tribunal/court reasoning, procedural fairness, jurisdictional error, and evidentiary burden. " +
  "Output format requirements: " +
  "(1) Key legal issues, " +
  "(2) Strongest arguments, " +
  "(3) Weaknesses and litigation risks, " +
  "(4) Evidence gaps and what to verify next, " +
  "(5) Targeted research actions. " +
  "If uncertainty exists, state it explicitly and explain why.";

export const DEFAULT_GEMINI_PRO_SYSTEM_PROMPT =
  "Role: Senior legal research counsel specialized in grounded-source verification for Australian immigration matters. " +
  "Primary duty: use grounded search evidence and clearly cite source links when available. " +
  "Source hierarchy: legislation and delegated legislation first, then tribunal/court decisions, then official policy guidance. " +
  "Reasoning discipline: separate legal rules, factual premises, inferences, and unresolved uncertainties. " +
  "Strict constraints: do not invent citations, do not overclaim source content, and mark any point that is not source-verified. " +
  "Output format requirements: " +
  "(1) Verified legal framework, " +
  "(2) Argument map for applicant vs decision-maker, " +
  "(3) Procedural and evidentiary vulnerabilities, " +
  "(4) Authorities and source links used, " +
  "(5) Next research and document-check steps. " +
  "Do not provide legal advice; provide research-oriented analysis only.";

export const DEFAULT_ANTHROPIC_SYSTEM_PROMPT =
  "Role: Senior adversarial legal analyst for Australian immigration research. " +
  "Primary duty: stress-test the case theory by identifying strongest and weakest arguments on both sides. " +
  "Reasoning standard: high-depth chain of legal analysis including assumptions, counterfactuals, and failure modes. " +
  "Risk focus: procedural fairness defects, jurisdictional error theories, credibility findings, statutory criteria mismatch, and proof deficiencies. " +
  "Strict constraints: no fabricated authorities, no unsupported factual claims, and explicit confidence levels for each major conclusion. " +
  "Output format requirements: " +
  "(1) Best-case arguments, " +
  "(2) Best rebuttals, " +
  "(3) Critical risks likely to fail review, " +
  "(4) Evidence required to improve position, " +
  "(5) Prioritized litigation/research checklist. " +
  "Do not provide legal advice; provide research-oriented analysis only.";

export const DEFAULT_MODERATOR_SYSTEM_PROMPT =
  "Role: Presiding legal moderator for an Australian immigration LLM council (research-only, not legal advice). " +
  "Decision standard: evaluate each model answer as if preparing counsel's internal legal memorandum. " +
  "Mandatory scoring criteria (equal weight): " +
  "(1) legal correctness against Australian migration law framework, " +
  "(2) authority discipline and verifiability, " +
  "(3) quality of statutory interpretation and application to facts, " +
  "(4) procedural fairness and review-ground issue spotting, " +
  "(5) practical usefulness for litigation/research next steps. " +
  "Evidence discipline: do not invent facts, authorities, citations, quotations, holdings, or confidence levels. " +
  "Attribution discipline: any conclusion must be traceable to at least one model output; if not, mark as uncertainty. " +
  "Comparative duty: identify true convergence vs superficial wording overlap, and preserve material minority reasoning. " +
  "Authority mapping duty: extract statutory/regulatory sections for each model separately, then identify only sections genuinely common to all successful models. " +
  "Output discipline: concise but auditable findings in strict JSON, with conflict-aware synthesis.";

// ---------------------------------------------------------------------------
// buildHistoryMessages  (Decision D2)
// ---------------------------------------------------------------------------

/**
 * Convert prior turn records into OpenAI-format [{role, content},...] history.
 *
 * Decision D2: each expert gets the panel's prior moderator composed_answer
 * as the assistant turn — simulating reading the meeting summary before the
 * next question. This saves tokens vs. repeating all expert answers.
 *
 * @param {Array<{user_message: string, payload?: {moderator?: {composed_answer?: string}}}>} prevTurns
 *   Ordered array of prior turns (oldest first).
 * @returns {Array<{role: string, content: string}>}
 */
export function buildHistoryMessages(prevTurns) {
  if (!Array.isArray(prevTurns) || prevTurns.length === 0) return [];
  const messages = [];
  for (const turn of prevTurns) {
    const userMsg = (turn.user_message || "").trim();
    if (!userMsg) continue;
    messages.push({ role: "user", content: userMsg });
    const assistantMsg = (
      turn.payload?.moderator?.composed_answer || ""
    ).trim();
    messages.push({
      role: "assistant",
      content: assistantMsg || "(No summary available for this turn.)",
    });
  }
  return messages;
}

// ---------------------------------------------------------------------------
// buildUserPrompt
// ---------------------------------------------------------------------------

function buildUserPrompt(question, caseContext) {
  const structure =
    "Please provide a structured research answer with: " +
    "(1) Key legal issues and governing tests, " +
    "(2) How the user-provided case-study facts (which may not be in public records) map to those legal tests, " +
    "(3) Viable defense/argument strategies for the applicant, " +
    "(4) Most likely outcome with confidence level and conditions, " +
    "(5) Counterarguments and failure risks, " +
    "(6) Case-based support: cite which cases support each key conclusion " +
    "(prefer case_id/citation from provided context when available), " +
    "(7) Draft mock judgment outline (non-binding, research simulation only) including findings, reasoning path, and likely orders, " +
    "(8) Evidence gaps and next research steps.";
  if (caseContext) {
    return (
      `User question:\n${question}\n\nCase context:\n${caseContext}\n\n${structure}`
    );
  }
  return `User question:\n${question}\n\n${structure}`;
}

// ---------------------------------------------------------------------------
// gatewayChatCompletion
// ---------------------------------------------------------------------------

/**
 * POST to Cloudflare AI Gateway compat endpoint (Unified Billing).
 *
 * Model-aware param remap: gpt-5 family → max_completion_tokens + temperature=1.
 *
 * @param {{
 *   env: object,
 *   model: string,
 *   systemPrompt: string,
 *   userPrompt: string,
 *   history?: Array<{role: string, content: string}>,
 *   maxTokens?: number,
 *   temperature?: number,
 * }} opts
 * @returns {Promise<object>} Raw OpenAI Chat Completions response JSON
 */
export async function gatewayChatCompletion({
  env,
  model,
  systemPrompt,
  userPrompt,
  history = [],
  maxTokens = DEFAULT_MAX_OUTPUT_TOKENS,
  temperature = 0.2,
  timeoutMs,
  isModerator = false,
}) {
  const gatewayUrl = env.CF_GATEWAY_URL || CF_GATEWAY_DEFAULT_URL;
  const token = env.CF_AIG_TOKEN || "";

  if (!token) throw new Error("Missing CF_AIG_TOKEN");
  if (!gatewayUrl) throw new Error("Missing CF_GATEWAY_URL");

  // messages: [system?, ...history, user]
  const messages = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  for (const msg of history) messages.push(msg);
  messages.push({ role: "user", content: userPrompt });

  const body = { model, messages };
  if (isGpt5ReasoningModel(model)) {
    body.max_completion_tokens = maxTokens;
    body.temperature = 1;
    // gpt-5 family supports reasoning_effort: minimal|low|medium|high.
    // Default medium burns latency + tokens on heavy legal prompts; "low"
    // cuts 50-80% latency while preserving research-quality output. Override
    // via env.LLM_COUNCIL_GPT5_REASONING_EFFORT for deeper analysis runs.
    body.reasoning_effort = (env.LLM_COUNCIL_GPT5_REASONING_EFFORT || "low").toLowerCase();
  } else {
    body.max_tokens = maxTokens;
    body.temperature = temperature;
  }

  // AbortController + per-model timeout (Sprint 1 P1). Without this,
  // Cloudflare Worker wall-time forcibly kills the entire invocation
  // when one provider hangs, surfacing as a generic 524 to the user.
  const effectiveTimeoutMs = timeoutMs || timeoutForModel(env, model, isModerator);
  const controller = new AbortController();
  let timedOut = false;
  const timeoutHandle = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, effectiveTimeoutMs);

  try {
    const res = await fetch(gatewayUrl, {
      method: "POST",
      headers: {
        "cf-aig-authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      let detail;
      try { detail = await res.json(); } catch (_) { detail = await res.text().catch(() => ""); }
      throw new Error(`HTTP ${res.status}: ${JSON.stringify(detail).slice(0, 800)}`);
    }

    return await res.json();
  } catch (err) {
    if (timedOut) {
      throw new Error(`Request timeout after ${effectiveTimeoutMs / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

// ---------------------------------------------------------------------------
// runExpert
// ---------------------------------------------------------------------------

/**
 * Run a single council expert via gatewayChatCompletion.
 *
 * @param {{
 *   env: object,
 *   providerKey: string,
 *   providerLabel: string,
 *   modelRaw: string,
 *   defaultPrefix: string,
 *   systemPrompt: string,
 *   question: string,
 *   caseContext: string,
 *   history?: Array<{role: string, content: string}>,
 *   maxTokens?: number,
 *   rawPrompt?: boolean,
 * }} opts
 * @returns {Promise<CouncilOpinion>}
 */
export async function runExpert({
  env,
  providerKey,
  providerLabel,
  modelRaw,
  defaultPrefix,
  systemPrompt,
  question,
  caseContext,
  history = [],
  maxTokens = DEFAULT_MAX_OUTPUT_TOKENS,
  rawPrompt = false,
  isModerator = false,
}) {
  const model = normalizeGatewayModel(modelRaw, defaultPrefix);
  const start = Date.now();

  if (!env.CF_AIG_TOKEN) {
    logCouncilEvent({
      event: "council.expert",
      provider_key: providerKey,
      model,
      ok: false,
      error_class: "auth_missing",
      latency_ms: 0,
    });
    return {
      provider_key: providerKey,
      provider_label: providerLabel,
      model,
      success: false,
      answer: "",
      error: "Missing CF_AIG_TOKEN (Unified Billing token required)",
      sources: [],
      latency_ms: 0,
    };
  }

  const userPrompt = rawPrompt ? question.trim() : buildUserPrompt(question, caseContext);

  // Single retry on transient failure (Sprint 1 P1). Backoff 1s before
  // attempt 2. Retries on: HTTP 5xx, network/timeout, empty response from
  // reasoning model. Does NOT retry: HTTP 4xx (caller error), auth missing.
  const MAX_ATTEMPTS = 2;
  let lastErr = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const data = await gatewayChatCompletion({
        env,
        model,
        systemPrompt,
        userPrompt,
        history,
        maxTokens,
        isModerator,
      });
      const raw = extractChatCompletionText(data);
      const answer = stripReasoningArtifacts(raw);
      const elapsed = Date.now() - start;

      if (!answer) {
        // Empty output from reasoning model — retry once before giving up
        if (attempt < MAX_ATTEMPTS) {
          lastErr = new Error(`${providerLabel} response did not include text output`);
          logCouncilEvent({
            event: "council.expert.retry",
            provider_key: providerKey,
            model,
            attempt,
            error_class: "empty_output",
            latency_ms: elapsed,
          });
          await sleep(1000 * attempt);
          continue;
        }
        logCouncilEvent({
          event: "council.expert",
          provider_key: providerKey,
          model,
          ok: false,
          error_class: "empty_output",
          attempt,
          latency_ms: elapsed,
        });
        return {
          provider_key: providerKey,
          provider_label: providerLabel,
          model,
          success: false,
          answer: "",
          error: `${providerLabel} response did not include text output`,
          sources: [],
          latency_ms: elapsed,
        };
      }

      const sources = [];
      const urlRe = /https?:\/\/[^\s)>"]+/g;
      let m;
      while ((m = urlRe.exec(answer)) !== null) {
        if (!sources.includes(m[0])) sources.push(m[0]);
      }

      logCouncilEvent({
        event: "council.expert",
        provider_key: providerKey,
        model,
        ok: true,
        attempt,
        latency_ms: elapsed,
      });
      return {
        provider_key: providerKey,
        provider_label: providerLabel,
        model,
        success: true,
        answer,
        error: "",
        sources,
        latency_ms: elapsed,
      };
    } catch (err) {
      lastErr = err;
      const errClass = classifyError(err);
      // Don't retry on client errors (4xx) — they won't get better
      const isRetryable =
        attempt < MAX_ATTEMPTS &&
        errClass !== "client_error" &&
        errClass !== "auth_missing";
      if (isRetryable) {
        logCouncilEvent({
          event: "council.expert.retry",
          provider_key: providerKey,
          model,
          attempt,
          error_class: errClass,
          latency_ms: Date.now() - start,
        });
        await sleep(1000 * attempt);
        continue;
      }
      const elapsed = Date.now() - start;
      logCouncilEvent({
        event: "council.expert",
        provider_key: providerKey,
        model,
        ok: false,
        error_class: errClass,
        attempt,
        latency_ms: elapsed,
      });
      return {
        provider_key: providerKey,
        provider_label: providerLabel,
        model,
        success: false,
        answer: "",
        error: `${providerLabel} request failed: ${String(err).slice(0, 700)}`,
        sources: [],
        latency_ms: elapsed,
      };
    }
  }

  // Unreachable in practice (loop always returns), but guards against
  // partial-fall-through if MAX_ATTEMPTS is misconfigured.
  return {
    provider_key: providerKey,
    provider_label: providerLabel,
    model,
    success: false,
    answer: "",
    error: `${providerLabel} request failed after ${MAX_ATTEMPTS} attempts: ${String(lastErr || "unknown").slice(0, 700)}`,
    sources: [],
    latency_ms: Date.now() - start,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// fallbackModerator (internal)
// ---------------------------------------------------------------------------

function fallbackModerator(opinions) {
  const successful = opinions.filter((o) => o.success && (o.answer || "").trim());
  if (!successful.length) {
    return {
      success: false,
      ranking: [],
      model_critiques: [],
      vote_summary: {
        winner_provider_key: "",
        winner_provider_label: "",
        winner_reason: "",
        support_count: 0,
        neutral_count: 0,
        oppose_count: 0,
      },
      agreement_points: [],
      conflict_points: ["No successful model output was available for comparison."],
      provider_law_sections: {},
      shared_law_sections: [],
      shared_law_sections_confidence_percent: 0,
      shared_law_sections_confidence_reason:
        "No successful expert outputs are available for consistency scoring.",
      composed_answer: "No model produced a usable answer.",
      mock_judgment: "",
      consensus: "Unavailable",
      disagreements: "Unavailable",
      outcome_likelihood_percent: 0,
      outcome_likelihood_label: "unknown",
      outcome_likelihood_reason:
        "Unavailable due to missing successful model outputs.",
      law_sections: [],
      follow_up_questions: [],
      raw_text: "",
      error: "All council models failed",
      latency_ms: 0,
    };
  }

  const sorted = [...successful].sort((a, b) => b.answer.length - a.answer.length);
  const ranking = sorted.map((op, idx) => ({
    rank: idx + 1,
    provider_key: op.provider_key,
    provider_label: op.provider_label,
    score: Math.max(1, 100 - idx * 8),
    reason: "Fallback ranking based on response completeness.",
  }));
  const model_critiques = sorted.map((op, idx) => ({
    provider_key: op.provider_key,
    provider_label: op.provider_label,
    score: Math.max(1, 100 - idx * 8),
    vote: idx === 0 ? "support" : "neutral",
    strengths: "Produced a usable structured answer under fallback mode.",
    weaknesses: "Detailed cross-model legal critique unavailable in fallback mode.",
    critique: "Fallback judgement based on response completeness only.",
  }));
  const winner = model_critiques[0] || null;
  const composed_answer = sorted
    .slice(0, 2)
    .map((op) => `[${op.provider_label}] ${op.answer}`)
    .join("\n\n");

  return {
    success: true,
    ranking,
    model_critiques,
    vote_summary: {
      winner_provider_key: winner ? winner.provider_key : "",
      winner_provider_label: winner ? winner.provider_label : "",
      winner_reason: "Fallback winner is selected by response completeness.",
      support_count: winner ? 1 : 0,
      neutral_count: Math.max(0, model_critiques.length - 1),
      oppose_count: 0,
    },
    agreement_points: [
      "All successful model outputs should be manually verified against legislation and authorities.",
    ],
    conflict_points: [
      "Fallback mode cannot reliably resolve doctrinal conflicts across model answers.",
    ],
    provider_law_sections: {},
    shared_law_sections: [],
    shared_law_sections_confidence_percent: 0,
    shared_law_sections_confidence_reason:
      "Fallback mode; no citation cross-check performed.",
    composed_answer,
    mock_judgment: composed_answer,
    consensus: "Partial consensus generated via fallback path.",
    disagreements: "Possible conflicts remain; review each model opinion.",
    outcome_likelihood_percent: 50,
    outcome_likelihood_label: "medium",
    outcome_likelihood_reason:
      "Fallback estimate based on limited synthesis confidence.",
    law_sections: [],
    follow_up_questions: [],
    raw_text: composed_answer,
    error: "",
    latency_ms: 0,
  };
}

// ---------------------------------------------------------------------------
// runModerator
// ---------------------------------------------------------------------------

/**
 * Run the Gemini Flash moderator to rank, critique, vote, and synthesise
 * the three expert opinions into a 14-field JSON judgement.
 *
 * @param {{
 *   env: object,
 *   opinions: Array,
 *   question: string,
 *   caseContext: string,
 *   history?: Array<{role: string, content: string}>,
 *   moderatorModel?: string,
 *   moderatorSystemPrompt?: string,
 *   moderatorMaxTokens?: number,
 * }} opts
 * @returns {Promise<object>}
 */
export async function runModerator({
  env,
  opinions,
  question,
  caseContext,
  history = [],
  moderatorModel,
  moderatorSystemPrompt,
  moderatorMaxTokens,
}) {
  const start = Date.now();
  const model =
    moderatorModel ||
    env.LLM_COUNCIL_GEMINI_FLASH_MODEL ||
    DEFAULT_GEMINI_FLASH_MODEL;
  const sysPrompt = moderatorSystemPrompt || DEFAULT_MODERATOR_SYSTEM_PROMPT;
  const maxTokens = moderatorMaxTokens || DEFAULT_MODERATOR_MAX_TOKENS;

  const promptPayload = {
    question,
    case_context: caseContext,
    opinions: opinions.map((o) => ({
      provider_key: o.provider_key,
      provider_label: o.provider_label,
      model: o.model,
      success: o.success,
      answer: o.answer,
      error: o.error,
      sources: o.sources,
    })),
  };

  const moderatorPrompt =
    "You are the judging and composition stage for an LLM council.\n" +
    "Input JSON:\n" +
    JSON.stringify(promptPayload) +
    "\n\nReturn STRICT JSON with this exact shape:\n" +
    '{\n  "ranking": [\n    {"provider_key":"openai|gemini_pro|anthropic","score":0-100,"reason":"..."}\n  ],\n' +
    '  "model_critiques": [\n    {"provider_key":"openai|gemini_pro|anthropic","score":0-100,"vote":"support|neutral|oppose","strengths":"...","weaknesses":"...","critique":"..."}\n  ],\n' +
    '  "vote_summary": {\n    "winner_provider_key":"openai|gemini_pro|anthropic",\n    "winner_reason":"...",\n    "support_count":0,\n    "neutral_count":0,\n    "oppose_count":0\n  },\n' +
    '  "agreement_points":["...", "..."],\n  "conflict_points":["...", "..."],\n' +
    '  "provider_law_sections": {"openai":["Migration Act 1958 (Cth) s 36"],"gemini_pro":["Migration Act 1958 (Cth) s 36"],"anthropic":["Migration Act 1958 (Cth) s 36"]},\n' +
    '  "shared_law_sections":["Migration Act 1958 (Cth) s 36"],\n' +
    '  "consensus":"... ","disagreements":"... ",\n' +
    '  "outcome_likelihood_percent":0-100,"outcome_likelihood_label":"high|medium|low|unknown","outcome_likelihood_reason":"... ",\n' +
    '  "law_sections":["Migration Act 1958 (Cth) s 36", "Migration Act 1958 (Cth) s 424A"],\n' +
    '  "mock_judgment":"... ","composed_answer":"... ","follow_up_questions":["...", "..."]\n}\n' +
    "Requirements:\n" +
    "- Rank only providers that succeeded.\n" +
    "- Use legal-memo style audit reasoning: issue, rule, application, vulnerability.\n" +
    "- Critique each successful model answer with concrete legal-quality reasoning.\n" +
    "- Cast one vote per successful model using support/neutral/oppose.\n" +
    "- Identify agreement_points (true overlap) and conflict_points (material divergence).\n" +
    "- Include provider_law_sections for each successful model using only statutes/regulations explicitly cited in that model answer.\n" +
    "- shared_law_sections must contain only sections present across all successful models.\n" +
    "- Focus on Australian immigration case research quality.\n" +
    "- Write mock_judgment as a non-binding research simulation, explicitly based on provided facts and precedent context.\n" +
    "- Provide a conservative outcome likelihood percentage with short justification.\n" +
    "- List likely relevant statutory or regulatory sections to review.\n" +
    "- Mention uncertainty explicitly when evidence is weak.\n" +
    "- Do not add unsupported legal claims, and do not output markdown or prose outside JSON.\n";

  const modOpinion = await runExpert({
    env,
    providerKey: "gemini_flash",
    providerLabel: "Google Gemini Flash (Moderator)",
    modelRaw: model,
    defaultPrefix: "google-ai-studio",
    systemPrompt: sysPrompt,
    question: moderatorPrompt,
    caseContext: "",
    history,
    maxTokens,
    rawPrompt: true,
  });

  const elapsed = Date.now() - start;

  if (!modOpinion.success) {
    const fb = fallbackModerator(opinions);
    fb.error = modOpinion.error || fb.error || "";
    fb.latency_ms = elapsed;
    return fb;
  }

  const parsed = extractFirstJsonObject(modOpinion.answer);
  if (!parsed) {
    const fb = fallbackModerator(opinions);
    fb.raw_text = modOpinion.answer;
    fb.latency_ms = elapsed;
    return fb;
  }

  const successfulKeys = new Set(
    opinions
      .filter((o) => o.success && (o.answer || "").trim())
      .map((o) => o.provider_key)
  );
  const providerLabels = Object.fromEntries(
    opinions.map((o) => [o.provider_key, o.provider_label])
  );

  // ranking
  const rankingRaw = Array.isArray(parsed.ranking) ? parsed.ranking : [];
  const seenRankKeys = new Set();
  let ranking = [];
  for (let idx = 0; idx < rankingRaw.length; idx++) {
    const item = rankingRaw[idx];
    if (!item || typeof item !== "object") continue;
    const pk = String(item.provider_key || "").trim();
    if (!pk || !successfulKeys.has(pk) || seenRankKeys.has(pk)) continue;
    const score = clampScore(item.score);
    ranking.push({
      rank: idx + 1,
      provider_key: pk,
      provider_label: providerLabels[pk] || pk,
      score,
      reason: String(item.reason || "").trim(),
    });
    seenRankKeys.add(pk);
  }

  if (!ranking.length) {
    ranking = fallbackModerator(opinions).ranking;
  } else {
    ranking.sort((a, b) => b.score - a.score);
    ranking.forEach((entry, idx) => { entry.rank = idx + 1; });
  }
  const rankingKeyOrder = ranking.map((e) => e.provider_key);

  // model_critiques
  const critiquesRaw = Array.isArray(parsed.model_critiques) ? parsed.model_critiques : [];
  const seenCritiqueKeys = new Set();
  let model_critiques = [];
  for (const item of critiquesRaw) {
    if (!item || typeof item !== "object") continue;
    const pk = String(item.provider_key || "").trim();
    if (!pk || !successfulKeys.has(pk) || seenCritiqueKeys.has(pk)) continue;
    model_critiques.push({
      provider_key: pk,
      provider_label: providerLabels[pk] || pk,
      score: clampScore(item.score),
      vote: normalizeVote(item.vote),
      strengths: String(item.strengths || "").trim(),
      weaknesses: String(item.weaknesses || "").trim(),
      critique: String(item.critique || "").trim(),
    });
    seenCritiqueKeys.add(pk);
  }

  if (!model_critiques.length) {
    for (const entry of ranking) {
      model_critiques.push({
        provider_key: entry.provider_key,
        provider_label: entry.provider_label,
        score: entry.score,
        vote: entry.rank === 1 ? "support" : "neutral",
        strengths: "",
        weaknesses: "",
        critique: entry.reason || "",
      });
      seenCritiqueKeys.add(entry.provider_key);
    }
  }

  for (const pk of [...successfulKeys].sort()) {
    if (seenCritiqueKeys.has(pk)) continue;
    model_critiques.push({
      provider_key: pk,
      provider_label: providerLabels[pk] || pk,
      score: 0,
      vote: "neutral",
      strengths: "",
      weaknesses: "",
      critique: "",
    });
  }

  const orderIndex = Object.fromEntries(rankingKeyOrder.map((k, i) => [k, i]));
  model_critiques.sort(
    (a, b) =>
      (orderIndex[a.provider_key] ?? 999) - (orderIndex[b.provider_key] ?? 999)
  );

  // vote_summary
  const vsRaw =
    parsed.vote_summary && typeof parsed.vote_summary === "object"
      ? parsed.vote_summary
      : {};
  let winnerKey = String(vsRaw.winner_provider_key || "").trim();
  if (!successfulKeys.has(winnerKey) && ranking.length)
    winnerKey = ranking[0].provider_key;
  const winnerLabel = providerLabels[winnerKey] || winnerKey;
  let winnerReason = String(vsRaw.winner_reason || "").trim();
  if (!winnerReason && ranking.length) winnerReason = ranking[0].reason || "";

  const supportCount = safeCount(
    vsRaw.support_count,
    model_critiques.filter((c) => c.vote === "support").length
  );
  const neutralCount = safeCount(
    vsRaw.neutral_count,
    model_critiques.filter((c) => c.vote === "neutral").length
  );
  const opposeCount = safeCount(
    vsRaw.oppose_count,
    model_critiques.filter((c) => c.vote === "oppose").length
  );

  // likelihood
  let likelihoodPct = 0;
  try {
    const n = parseInt(parsed.outcome_likelihood_percent, 10);
    likelihoodPct = isNaN(n) ? 0 : Math.max(0, Math.min(100, n));
  } catch (_) {}

  let likelihoodLabel = String(parsed.outcome_likelihood_label || "")
    .trim()
    .toLowerCase();
  if (!["high", "medium", "low", "unknown"].includes(likelihoodLabel))
    likelihoodLabel = "unknown";

  const asStringList = (val, max = 12) => {
    if (!Array.isArray(val)) return [];
    return val
      .map((x) => String(x || "").trim())
      .filter(Boolean)
      .slice(0, max);
  };

  const law_sections = asStringList(parsed.law_sections, 20);
  const follow_up_questions = asStringList(parsed.follow_up_questions, 10);
  const agreement_points = asStringList(parsed.agreement_points, 10);
  const conflict_points = asStringList(parsed.conflict_points, 10);
  const shared_law_sections = asStringList(parsed.shared_law_sections, 25);

  const providerLawSectionsRaw =
    parsed.provider_law_sections &&
    typeof parsed.provider_law_sections === "object"
      ? parsed.provider_law_sections
      : {};
  const provider_law_sections = {};
  for (const pk of [...successfulKeys].sort()) {
    const items = asStringList(providerLawSectionsRaw[pk], 25);
    if (items.length) provider_law_sections[pk] = items;
  }

  let consensus = String(parsed.consensus || "").trim();
  let disagreements = String(parsed.disagreements || "").trim();
  if (!consensus && agreement_points.length)
    consensus = agreement_points.slice(0, 3).join(" | ");
  if (!disagreements && conflict_points.length)
    disagreements = conflict_points.slice(0, 3).join(" | ");

  const composed_answer =
    String(parsed.composed_answer || "").trim() || modOpinion.answer;
  const mock_judgment =
    String(parsed.mock_judgment || "").trim() || composed_answer;

  return {
    success: true,
    ranking,
    model_critiques,
    vote_summary: {
      winner_provider_key: winnerKey,
      winner_provider_label: winnerLabel,
      winner_reason: winnerReason,
      support_count: supportCount,
      neutral_count: neutralCount,
      oppose_count: opposeCount,
    },
    agreement_points,
    conflict_points,
    provider_law_sections,
    shared_law_sections,
    shared_law_sections_confidence_percent: 0,
    shared_law_sections_confidence_reason:
      "Worker-side citation cross-check not implemented in v1.",
    consensus,
    disagreements,
    outcome_likelihood_percent: likelihoodPct,
    outcome_likelihood_label: likelihoodLabel,
    outcome_likelihood_reason: String(
      parsed.outcome_likelihood_reason || ""
    ).trim(),
    law_sections,
    mock_judgment,
    composed_answer,
    follow_up_questions,
    raw_text: modOpinion.answer,
    error: "",
    latency_ms: elapsed,
  };
}

// ---------------------------------------------------------------------------
// runCouncil
// ---------------------------------------------------------------------------

/**
 * Run the full 4-model LLM council: 3 experts in parallel, then moderator.
 *
 * @param {{
 *   env: object,
 *   question: string,
 *   caseContext?: string,
 *   history?: Array<{role: string, content: string}>,
 *   prevTurns?: Array,
 *   models?: {openai?: string, gemini_pro?: string, anthropic?: string, gemini_flash?: string},
 * }} opts
 * @returns {Promise<{question, case_context, gateway, models, opinions, moderator}>}
 */
export async function runCouncil({
  env,
  question,
  caseContext = "",
  history,
  prevTurns,
  models = {},
}) {
  const q = (question || "").trim();
  if (!q) throw new Error("question is required");

  const gatewayUrl = env.CF_GATEWAY_URL || CF_GATEWAY_DEFAULT_URL;

  const openaiModel = normalizeGatewayModel(
    models.openai || env.LLM_COUNCIL_OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
    "openai"
  );
  const geminiProModel = normalizeGatewayModel(
    models.gemini_pro || env.LLM_COUNCIL_GEMINI_PRO_MODEL || DEFAULT_GEMINI_PRO_MODEL,
    "google-ai-studio"
  );
  const anthropicModel = normalizeGatewayModel(
    models.anthropic || env.LLM_COUNCIL_ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL,
    "anthropic"
  );
  const geminiFlashModel = normalizeGatewayModel(
    models.gemini_flash || env.LLM_COUNCIL_GEMINI_FLASH_MODEL || DEFAULT_GEMINI_FLASH_MODEL,
    "google-ai-studio"
  );

  // D2: build history from prevTurns if explicit history not provided
  const historyMessages = history !== undefined ? history : buildHistoryMessages(prevTurns || []);

  // 3 experts in parallel. Promise.allSettled (Sprint 1 P1) lets the
  // moderator run even if 1 of 3 experts crashes hard (e.g. provider 5xx
  // exhausts retries). runExpert never throws on its own — it returns a
  // CouncilOpinion with success=false — so allSettled's `rejected` branch
  // is a defensive guard against unexpected throws bubbling up.
  const expertResults = await Promise.allSettled([
    runExpert({
      env,
      providerKey: "openai",
      providerLabel: "OpenAI",
      modelRaw: openaiModel,
      defaultPrefix: "openai",
      systemPrompt: DEFAULT_OPENAI_SYSTEM_PROMPT,
      question: q,
      caseContext,
      history: historyMessages,
    }),
    runExpert({
      env,
      providerKey: "gemini_pro",
      providerLabel: "Google Gemini Pro",
      modelRaw: geminiProModel,
      defaultPrefix: "google-ai-studio",
      systemPrompt: DEFAULT_GEMINI_PRO_SYSTEM_PROMPT,
      question: q,
      caseContext,
      history: historyMessages,
    }),
    runExpert({
      env,
      providerKey: "anthropic",
      providerLabel: "Anthropic",
      modelRaw: anthropicModel,
      defaultPrefix: "anthropic",
      systemPrompt: DEFAULT_ANTHROPIC_SYSTEM_PROMPT,
      question: q,
      caseContext,
      history: historyMessages,
    }),
  ]);

  const providerMeta = [
    { key: "openai", label: "OpenAI", model: openaiModel },
    { key: "gemini_pro", label: "Google Gemini Pro", model: geminiProModel },
    { key: "anthropic", label: "Anthropic", model: anthropicModel },
  ];

  const opinions = expertResults.map((result, idx) => {
    if (result.status === "fulfilled") return result.value;
    // Defensive synthetic CouncilOpinion for an expert that threw rather
    // than returning a failure result. Should be rare — runExpert catches
    // its own errors — but allSettled keeps the moderator from being held
    // hostage if e.g. a runtime crashes mid-fetch.
    const meta = providerMeta[idx];
    logCouncilEvent({
      event: "council.expert",
      provider_key: meta.key,
      model: meta.model,
      ok: false,
      error_class: "throw",
      latency_ms: 0,
    });
    return {
      provider_key: meta.key,
      provider_label: meta.label,
      model: meta.model,
      success: false,
      answer: "",
      error: `${meta.label} threw: ${String(result.reason || "unknown").slice(0, 700)}`,
      sources: [],
      latency_ms: 0,
    };
  });

  const successCount = opinions.filter((o) => o.success && (o.answer || "").trim()).length;
  logCouncilEvent({
    event: "council.experts.summary",
    success_count: successCount,
    total: opinions.length,
  });

  // Graceful degradation: as long as ≥1 expert succeeded the moderator can
  // still synthesize — if all failed, fallbackModerator returns a structured
  // failure shape rather than blowing up.
  const moderator = await runModerator({
    env,
    opinions,
    question: q,
    caseContext,
    history: historyMessages,
    moderatorModel: geminiFlashModel,
  });

  return {
    question: q,
    case_context: caseContext || "",
    gateway: { url: gatewayUrl },
    models: {
      openai: {
        provider: "OpenAI (via CF Gateway)",
        model: openaiModel,
        system_prompt: DEFAULT_OPENAI_SYSTEM_PROMPT,
      },
      gemini_pro: {
        provider: "Google AI Studio (via CF Gateway)",
        model: geminiProModel,
        system_prompt: DEFAULT_GEMINI_PRO_SYSTEM_PROMPT,
      },
      anthropic: {
        provider: "Anthropic (via CF Gateway)",
        model: anthropicModel,
        system_prompt: DEFAULT_ANTHROPIC_SYSTEM_PROMPT,
      },
      gemini_flash: {
        provider: "Google AI Studio (via CF Gateway)",
        model: geminiFlashModel,
        role: "judge_rank_vote_and_composer",
        system_prompt: DEFAULT_MODERATOR_SYSTEM_PROMPT,
      },
    },
    opinions,
    moderator,
  };
}

// ---------------------------------------------------------------------------
// Internal pure helpers
// ---------------------------------------------------------------------------

function normalizeVote(raw) {
  const v = String(raw || "").trim().toLowerCase();
  if (["support", "approve", "accept"].includes(v)) return "support";
  if (["oppose", "reject"].includes(v)) return "oppose";
  return "neutral";
}

function clampScore(raw) {
  try {
    const n = parseInt(raw, 10);
    return isNaN(n) ? 0 : Math.max(0, Math.min(100, n));
  } catch (_) {
    return 0;
  }
}

function safeCount(value, fallback) {
  try {
    const n = parseInt(value, 10);
    if (isNaN(n)) return fallback;
    return Math.max(0, n);
  } catch (_) {
    return fallback;
  }
}
