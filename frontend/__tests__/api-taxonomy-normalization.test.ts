import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchCountries,
  fetchJudgeAutocomplete,
  submitGuidedSearch,
} from "@/lib/api";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

describe("taxonomy API normalization", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes countries from both `country` and legacy `name` fields", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        countries: [
          { name: "China", case_count: 5 },
          { country: " India ", case_count: "3" },
          { name: "", case_count: 999 },
        ],
        meta: { total_countries: 2, limit: 30 },
      }),
    );

    const result = await fetchCountries(10);

    expect(result.countries).toEqual([
      { country: "China", case_count: 5 },
      { country: "India", case_count: 3 },
    ]);
    expect(result.meta).toEqual({ total_countries: 2, limit: 30 });
  });

  it("normalizes judge autocomplete from legacy `data` field", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: [
          { name: " Alex Tan ", case_count: "7" },
          { name: "Alex Tan", case_count: 5 },
        ],
        meta: { query: "al", total_results: 1, limit: 20 },
      }),
    );

    const result = await fetchJudgeAutocomplete("al");

    expect(result.judges).toEqual([{ name: "Alex Tan", case_count: 7 }]);
    expect(result.meta).toEqual({ query: "al", total_results: 1, limit: 20 });
  });

  it("maps guided-search `meta.total_results` to top-level `total`", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/api/v1/csrf-token")) {
        return jsonResponse({ csrf_token: "test-csrf" });
      }
      if (url.endsWith("/api/v1/taxonomy/guided-search")) {
        return jsonResponse({
          success: true,
          flow: "find-precedents",
          results: [],
          meta: { total_results: 42, returned_results: 0 },
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await submitGuidedSearch({
      flow: "find-precedents",
      visa_subclass: "866",
    });

    expect(result.total).toBe(42);
    expect(result.meta?.returned_results).toBe(0);
  });

  it("normalizes assess-judge payload into `judge_profile`", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/api/v1/csrf-token")) {
        return jsonResponse({ csrf_token: "test-csrf" });
      }
      if (url.endsWith("/api/v1/taxonomy/guided-search")) {
        return jsonResponse({
          success: true,
          flow: "assess-judge",
          judge_name: "Jane Smith",
          profile_url: "/judge-profiles/Jane Smith",
          meta: { total_cases: 88 },
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await submitGuidedSearch({
      flow: "assess-judge",
      judge_name: "Jane Smith",
    });

    expect(result.judge_profile).toMatchObject({
      name: "Jane Smith",
      url: "/judge-profiles/Jane Smith",
      case_count: 88,
    });
  });
});
