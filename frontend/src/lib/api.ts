import type {
  ImmigrationCase,
  CaseFilters,
  PaginatedCases,
  DashboardStats,
  FilterOptions,
  JobStatus,
} from "@/types/case"

let csrfToken: string | null = null

async function fetchCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken
  const res = await fetch("/api/v1/csrf-token")
  const data = await res.json()
  csrfToken = data.csrf_token
  return csrfToken!
}

async function apiFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }

  if (options.method && options.method !== "GET") {
    headers["X-CSRFToken"] = await fetchCsrfToken()
  }

  const res = await fetch(url, { ...options, headers })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(error.error || `API error: ${res.status}`)
  }

  return res.json()
}

// ─── Dashboard ─────────────────────────────────────────────────
export function fetchStats(): Promise<DashboardStats> {
  return apiFetch("/api/v1/stats")
}

// ─── Cases ─────────────────────────────────────────────────────
export function fetchCases(filters: CaseFilters): Promise<PaginatedCases> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value))
    }
  }
  return apiFetch(`/api/v1/cases?${params}`)
}

export function fetchCase(id: string): Promise<{ case: ImmigrationCase; full_text: string | null }> {
  return apiFetch(`/api/v1/cases/${id}`)
}

export function createCase(data: Partial<ImmigrationCase>): Promise<ImmigrationCase> {
  return apiFetch("/api/v1/cases", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export function updateCase(id: string, data: Partial<ImmigrationCase>): Promise<ImmigrationCase> {
  return apiFetch(`/api/v1/cases/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  })
}

export function deleteCase(id: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/v1/cases/${id}`, { method: "DELETE" })
}

export function batchCases(action: string, ids: string[], tag?: string): Promise<{ affected: number }> {
  return apiFetch("/api/v1/cases/batch", {
    method: "POST",
    body: JSON.stringify({ action, case_ids: ids, tag }),
  })
}

export function compareCases(ids: string[]): Promise<{ cases: ImmigrationCase[] }> {
  const params = new URLSearchParams()
  ids.forEach((id) => params.append("ids", id))
  return apiFetch(`/api/v1/cases/compare?${params}`)
}

export function fetchRelated(id: string): Promise<{ cases: ImmigrationCase[] }> {
  return apiFetch(`/api/v1/cases/${id}/related`)
}

// ─── Search ────────────────────────────────────────────────────
export function searchCases(query: string, limit = 50): Promise<{ cases: ImmigrationCase[] }> {
  return apiFetch(`/api/v1/search?q=${encodeURIComponent(query)}&limit=${limit}`)
}

// ─── Filters ───────────────────────────────────────────────────
export function fetchFilterOptions(): Promise<FilterOptions> {
  return apiFetch("/api/v1/filter-options")
}

// ─── Jobs ──────────────────────────────────────────────────────
export function fetchJobStatus(): Promise<JobStatus> {
  return apiFetch("/api/v1/job-status")
}

export function startSearch(params: Record<string, unknown>): Promise<{ started: boolean }> {
  return apiFetch("/api/v1/search/start", {
    method: "POST",
    body: JSON.stringify(params),
  })
}

export function startDownload(params: Record<string, unknown>): Promise<{ started: boolean }> {
  return apiFetch("/api/v1/download/start", {
    method: "POST",
    body: JSON.stringify(params),
  })
}

export function startUpdateDb(params: Record<string, unknown>): Promise<{ started: boolean }> {
  return apiFetch("/api/v1/update-db/start", {
    method: "POST",
    body: JSON.stringify(params),
  })
}

// ─── Pipeline ──────────────────────────────────────────────────
export function fetchPipelineStatus(): Promise<Record<string, unknown>> {
  return apiFetch("/api/v1/pipeline-status")
}

export function pipelineAction(action: string, params?: Record<string, unknown>): Promise<Record<string, unknown>> {
  return apiFetch("/api/v1/pipeline-action", {
    method: "POST",
    body: JSON.stringify({ action, ...params }),
  })
}

// ─── Data Dictionary ───────────────────────────────────────────
export function fetchDataDictionary(): Promise<{ fields: Array<{ name: string; type: string; description: string; example: string }> }> {
  return apiFetch("/api/v1/data-dictionary")
}

// ─── Export (file downloads) ───────────────────────────────────
export function downloadExportFile(format: "csv" | "json"): void {
  window.location.href = `/api/v1/export/${format}`
}

// ─── Invalidate CSRF (call on auth errors) ─────────────────────
export function clearCsrfToken(): void {
  csrfToken = null
}
