import { apiFetch } from "@/lib/api";
import type { ApiRequestOptions } from "@/lib/api";
import type {
  ImmigrationCase,
  CaseFilters,
  PaginatedCases,
  FilterOptions,
} from "@/types/case";

export type CaseCountMode = "exact" | "planned" | "estimated";

// ─── Cases ─────────────────────────────────────────────────────
export function fetchCases(filters: CaseFilters): Promise<PaginatedCases> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }
  return apiFetch(`/api/v1/cases?${params}`);
}

export function fetchCaseCount(
  filters: CaseFilters,
  countMode: CaseCountMode = "planned",
  options?: ApiRequestOptions,
): Promise<{ total: number; count_mode: CaseCountMode }> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }
  params.set("count_mode", countMode);
  return apiFetch(`/api/v1/cases/count?${params}`, options);
}

export function fetchCase(
  id: string,
): Promise<{ case: ImmigrationCase; full_text: string | null }> {
  return apiFetch(`/api/v1/cases/${id}`);
}

export async function createCase(
  data: Partial<ImmigrationCase>,
): Promise<ImmigrationCase> {
  const res = await apiFetch<{ case: ImmigrationCase }>("/api/v1/cases", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.case;
}

export async function updateCase(
  id: string,
  data: Partial<ImmigrationCase>,
): Promise<ImmigrationCase> {
  const res = await apiFetch<{ case: ImmigrationCase }>(`/api/v1/cases/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  return res.case;
}

export function deleteCase(id: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/v1/cases/${id}`, { method: "DELETE" });
}

export function batchCases(
  action: string,
  ids: string[],
  tag?: string,
): Promise<{ affected: number }> {
  return apiFetch("/api/v1/cases/batch", {
    method: "POST",
    body: JSON.stringify({ action, case_ids: ids, tag }),
  });
}

export function compareCases(
  ids: string[],
): Promise<{ cases: ImmigrationCase[] }> {
  const params = new URLSearchParams();
  ids.forEach((id) => params.append("ids", id));
  return apiFetch(`/api/v1/cases/compare?${params}`);
}

export function fetchRelated(
  id: string,
): Promise<{ cases: ImmigrationCase[] }> {
  return apiFetch(`/api/v1/cases/${id}/related`);
}

// ─── Search ────────────────────────────────────────────────────
export function searchCases(
  query: string,
  limit = 50,
): Promise<{ cases: ImmigrationCase[] }> {
  return apiFetch(
    `/api/v1/search?q=${encodeURIComponent(query)}&limit=${limit}`,
  );
}

// ─── Filters ───────────────────────────────────────────────────
export function fetchFilterOptions(): Promise<FilterOptions> {
  return apiFetch("/api/v1/filter-options", {
    timeoutMs: 8_000,
  });
}
