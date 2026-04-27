/**
 * llm-council-runner-helpers.test.js
 *
 * Vitest unit tests for workers/llm-council/runner-helpers.js
 * Mirrors test cases from tests/test_llm_council_module.py.
 */

import { describe, it, expect } from "vitest";
import {
  normalizeGatewayModel,
  extractChatCompletionText,
  stripReasoningArtifacts,
  repairTruncatedJson,
  extractFirstJsonObject,
  isGpt5ReasoningModel,
} from "../llm-council/runner-helpers.js";

// ---------------------------------------------------------------------------
// normalizeGatewayModel
// ---------------------------------------------------------------------------

describe("normalizeGatewayModel", () => {
  it("passes through model that already has a provider prefix", () => {
    expect(normalizeGatewayModel("openai/gpt-5-mini", "openai")).toBe(
      "openai/gpt-5-mini"
    );
  });

  it("prepends defaultPrefix to a bare model name", () => {
    expect(normalizeGatewayModel("claude-sonnet-4-6", "anthropic")).toBe(
      "anthropic/claude-sonnet-4-6"
    );
  });

  it("returns empty string unchanged when model is empty", () => {
    expect(normalizeGatewayModel("", "anthropic")).toBe("");
  });

  it("trims whitespace and prepends prefix to bare model", () => {
    expect(normalizeGatewayModel("  gemini-flash  ", "google-ai-studio")).toBe(
      "google-ai-studio/gemini-flash"
    );
  });
});

// ---------------------------------------------------------------------------
// extractChatCompletionText
// ---------------------------------------------------------------------------

describe("extractChatCompletionText", () => {
  it("extracts and trims string content from choices[0].message.content", () => {
    const payload = {
      choices: [{ message: { content: "  Hello world  " } }],
    };
    expect(extractChatCompletionText(payload)).toBe("Hello world");
  });

  it("joins list-of-parts content with double newlines", () => {
    const payload = {
      choices: [
        {
          message: {
            content: [
              { text: "Part one" },
              { content: "Part two" },
              "Part three",
            ],
          },
        },
      ],
    };
    expect(extractChatCompletionText(payload)).toBe(
      "Part one\n\nPart two\n\nPart three"
    );
  });

  it("returns empty string when choices is empty array", () => {
    expect(extractChatCompletionText({ choices: [] })).toBe("");
  });

  it("returns empty string when payload has no choices key", () => {
    expect(extractChatCompletionText({})).toBe("");
  });

  it("returns empty string when message.content is null", () => {
    const payload = { choices: [{ message: { content: null } }] };
    expect(extractChatCompletionText(payload)).toBe("");
  });
});

// ---------------------------------------------------------------------------
// stripReasoningArtifacts
// ---------------------------------------------------------------------------

describe("stripReasoningArtifacts", () => {
  it("removes properly fenced <think>...</think> block and returns the answer", () => {
    const fenced = "<think>internal chain of thought</think>The answer is 42.";
    expect(stripReasoningArtifacts(fenced)).toBe("The answer is 42.");
  });

  it("handles QwQ-style: no opening tag, just trailing </think>", () => {
    const qwq = "Okay, let me think about this... </think>\n\nFinal answer: 42.";
    expect(stripReasoningArtifacts(qwq)).toBe("Final answer: 42.");
  });

  it("passes through plain text unchanged (only strips outer whitespace)", () => {
    expect(stripReasoningArtifacts("  Just a regular answer.  ")).toBe(
      "Just a regular answer."
    );
  });

  it("strips multiple fenced think blocks", () => {
    const multi = "<think>step1</think>Hello <think>step2</think>world.";
    expect(stripReasoningArtifacts(multi)).toBe("Hello world.");
  });

  it("returns empty string for empty input", () => {
    expect(stripReasoningArtifacts("")).toBe("");
  });

  it("is case-insensitive on think tags", () => {
    expect(stripReasoningArtifacts("<THINK>ignored</THINK>answer")).toBe(
      "answer"
    );
  });
});

// ---------------------------------------------------------------------------
// repairTruncatedJson
// ---------------------------------------------------------------------------

describe("repairTruncatedJson", () => {
  it("recovers mid-string truncation — incomplete field is dropped", () => {
    const truncated = '{"a":1,"b":"hello';
    const repaired = repairTruncatedJson(truncated);
    const parsed = JSON.parse(repaired);
    expect(parsed).toEqual({ a: 1 });
  });

  it("recovers array truncated mid-string item — complete items kept, partial dropped", () => {
    const truncated = '{"items":["one","two","incompl';
    const repaired = repairTruncatedJson(truncated);
    const parsed = JSON.parse(repaired);
    // Tight assertion — repaired array MUST be exactly two complete items;
    // a third (truncated) item leaking through is a regression we want to
    // catch immediately.
    expect(parsed.items).toEqual(["one", "two"]);
  });

  it("recovers nested objects truncated at deepest level", () => {
    const truncated = '{"outer":{"inner":{"k":"v","x":';
    const repaired = repairTruncatedJson(truncated);
    const parsed = JSON.parse(repaired);
    expect(parsed.outer.inner).toEqual({ k: "v" });
  });

  it("returns complete JSON with correct semantics unchanged", () => {
    const complete = '{"a":1}';
    const parsed = JSON.parse(repairTruncatedJson(complete));
    expect(parsed).toEqual({ a: 1 });
  });

  it("returns original text when no opening brace found", () => {
    expect(repairTruncatedJson("no json here")).toBe("no json here");
  });
});

// ---------------------------------------------------------------------------
// extractFirstJsonObject
// ---------------------------------------------------------------------------

describe("extractFirstJsonObject", () => {
  it("parses plain JSON directly", () => {
    expect(extractFirstJsonObject('{"a":1}')).toEqual({ a: 1 });
  });

  it("strips markdown ```json fence before parsing", () => {
    expect(
      extractFirstJsonObject('```json\n{"a":1,"b":[2,3]}\n```')
    ).toEqual({ a: 1, b: [2, 3] });
  });

  it("strips lowercase ``` fence", () => {
    expect(extractFirstJsonObject('```\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("extracts JSON followed by trailing prose via brace-balance walk", () => {
    expect(
      extractFirstJsonObject('{"a":1}\n\nNote: my reasoning above.')
    ).toEqual({ a: 1 });
  });

  it("handles strings with escaped quotes and braces inside", () => {
    expect(
      extractFirstJsonObject('{"a":"hello {world} \\"quoted\\""}')
    ).toEqual({ a: 'hello {world} "quoted"' });
  });

  it("recovers truncated moderator output — realistic Gemini Flash shape", () => {
    const truncated =
      "```json\n{\n" +
      '  "ranking": [{"provider_key":"openai","score":90,"reason":"good"}],\n' +
      '  "outcome_likelihood_percent": 65,\n' +
      '  "outcome_likelihood_label": "medium",\n' +
      '  "law_sections": ["Migration Act 1958 (Cth) s 36"],\n' +
      '  "follow_up_questions": ["What was the precise content';
    const parsed = extractFirstJsonObject(truncated);
    expect(parsed).not.toBeNull();
    expect(parsed.outcome_likelihood_percent).toBe(65);
    expect(parsed.outcome_likelihood_label).toBe("medium");
    expect(parsed.law_sections).toEqual(["Migration Act 1958 (Cth) s 36"]);
    expect(parsed.ranking[0].provider_key).toBe("openai");
  });

  it("returns null for empty string", () => {
    expect(extractFirstJsonObject("")).toBeNull();
  });

  it("returns null for pure prose with no JSON", () => {
    expect(extractFirstJsonObject("just prose")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isGpt5ReasoningModel
// ---------------------------------------------------------------------------

describe("isGpt5ReasoningModel", () => {
  it("returns true for openai/gpt-5 prefix", () => {
    expect(isGpt5ReasoningModel("openai/gpt-5")).toBe(true);
  });

  it("returns true for openai/gpt-5-mini-2025-08-07", () => {
    expect(isGpt5ReasoningModel("openai/gpt-5-mini-2025-08-07")).toBe(true);
  });

  it("returns false for openai/gpt-4o", () => {
    expect(isGpt5ReasoningModel("openai/gpt-4o")).toBe(false);
  });

  it("returns false for anthropic/claude-sonnet-4-6", () => {
    expect(isGpt5ReasoningModel("anthropic/claude-sonnet-4-6")).toBe(false);
  });

  it("returns false for google-ai-studio/gemini-flash", () => {
    expect(isGpt5ReasoningModel("google-ai-studio/gemini-flash")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isGpt5ReasoningModel("")).toBe(false);
  });

  it("is case-insensitive — openai/GPT-5 matches", () => {
    expect(isGpt5ReasoningModel("openai/GPT-5-mini")).toBe(true);
  });
});
