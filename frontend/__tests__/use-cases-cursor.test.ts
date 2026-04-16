/**
 * TDD: Cursor pagination support for useCases / fetchCases
 *
 * RED  → types don't expose cursor / next_cursor → tsc --noEmit fails on
 *         the type-assertion tests below.
 * GREEN → after adding cursor to CaseFilters, next_cursor to PaginatedCases,
 *          and updating fetchCases to forward the cursor query param, tsc
 *          and all runtime assertions pass.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchCases } from "@/lib/api";
import type { CaseFilters, PaginatedCases } from "@/types/case";

// ── helpers ────────────────────────────────────────────────────────────────

function jsonResponse<T>(data: T): Response {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => data,
  } as Response;
}

function capturedUrl(fetchMock: ReturnType<typeof vi.fn>): string {
  return String(fetchMock.mock.calls[0][0]);
}

// ── fixtures ───────────────────────────────────────────────────────────────

const CURSOR_TOKEN = "eyJ5ZWFyIjoyMDI0LCJjYXNlX2lkIjoiYWJjMTIzIn0";

const baseFilters: CaseFilters = {
  court: "",
  keyword: "",
  page: 1,
  page_size: 20,
};

function makePaginatedResponse(nextCursor: string | null = null) {
  return {
    cases: [],
    total: 0,
    page: 1,
    page_size: 20,
    total_pages: 1,
    next_cursor: nextCursor,
  };
}

// ── tests ──────────────────────────────────────────────────────────────────

describe("fetchCases — cursor pagination", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("does NOT include cursor param when cursor is not provided", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(makePaginatedResponse()));
    vi.stubGlobal("fetch", fetchMock);

    await fetchCases(baseFilters);

    const url = capturedUrl(fetchMock);
    expect(url).not.toContain("cursor=");
  });

  it("includes cursor query param in URL when cursor is provided", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(makePaginatedResponse()));
    vi.stubGlobal("fetch", fetchMock);

    const filtersWithCursor: CaseFilters = {
      ...baseFilters,
      cursor: CURSOR_TOKEN,
    };

    await fetchCases(filtersWithCursor);

    const url = capturedUrl(fetchMock);
    expect(url).toContain(`cursor=${CURSOR_TOKEN}`);
  });

  it("returns next_cursor from API response when backend provides it", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(makePaginatedResponse(CURSOR_TOKEN)));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchCases(baseFilters);

    expect(result.next_cursor).toBe(CURSOR_TOKEN);
  });

  it("returns next_cursor as null when backend omits it", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(makePaginatedResponse(null)));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchCases(baseFilters);

    expect(result.next_cursor).toBeNull();
  });

  it("still passes page param when no cursor given (backward compat)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(makePaginatedResponse()));
    vi.stubGlobal("fetch", fetchMock);

    await fetchCases({ ...baseFilters, page: 3 });

    const url = capturedUrl(fetchMock);
    expect(url).toContain("page=3");
  });
});

// ── Compile-time type assertions (RED before types are updated) ────────────
// These use `satisfies` so excess-property check fires and tsc/vitest --typecheck
// catches the missing fields before implementation.

// CaseFilters must accept optional cursor field
const _filtersWithCursor = { cursor: "some-token" } satisfies CaseFilters;
void _filtersWithCursor;

// PaginatedCases must have next_cursor field
const _paginatedShape = {
  cases: [],
  total: 0,
  page: 1,
  page_size: 20,
  total_pages: 1,
  next_cursor: null,
} satisfies PaginatedCases;
void _paginatedShape;
