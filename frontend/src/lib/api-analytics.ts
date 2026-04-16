import { apiFetch } from "@/lib/api";
import type {
  AnalyticsFilterParams,
  AnalyticsAdvancedFilterOptions,
  OutcomeData,
  JudgeEntry,
  ConceptEntry,
  NatureOutcomeData,
  SuccessRateData,
  JudgeLeaderboardEntry,
  JudgeProfile,
  JudgeBio,
  ConceptEffectivenessData,
  ConceptCooccurrenceData,
  ConceptTrendData,
  FlowMatrixData,
  MonthlyTrendsData,
  VisaFamiliesData,
} from "@/types/case";

const CURRENT_YEAR = new Date().getFullYear();
const ANALYTICS_TIMEOUT_MS = 15_000;
const ANALYTICS_HEAVY_TIMEOUT_MS = 20_000;

function appendAdvancedFilters(
  params: URLSearchParams,
  filters?: AnalyticsFilterParams,
): void {
  if (!filters) return;
  if (filters.caseNatures?.length)
    params.set("case_natures", filters.caseNatures.join(","));
  if (filters.visaSubclasses?.length)
    params.set("visa_subclasses", filters.visaSubclasses.join(","));
  if (filters.outcomeTypes?.length)
    params.set("outcome_types", filters.outcomeTypes.join(","));
}

function buildFilterParams(filters?: AnalyticsFilterParams): string {
  if (!filters) return "";
  const params = new URLSearchParams();
  if (filters.court) params.set("court", filters.court);
  if (filters.yearFrom && filters.yearFrom > 2000)
    params.set("year_from", String(filters.yearFrom));
  if (filters.yearTo && filters.yearTo < CURRENT_YEAR)
    params.set("year_to", String(filters.yearTo));
  appendAdvancedFilters(params, filters);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function appendAnalyticsFilters(
  params: URLSearchParams,
  filters?: AnalyticsFilterParams,
): void {
  if (!filters) return;
  if (filters.court) params.set("court", filters.court);
  if (filters.yearFrom && filters.yearFrom > 2000) {
    params.set("year_from", String(filters.yearFrom));
  }
  if (filters.yearTo && filters.yearTo < CURRENT_YEAR) {
    params.set("year_to", String(filters.yearTo));
  }
  appendAdvancedFilters(params, filters);
}

// ─── Analytics ─────────────────────────────────────────────────
export function fetchOutcomes(
  filters?: AnalyticsFilterParams,
): Promise<OutcomeData> {
  return apiFetch(`/api/v1/analytics/outcomes${buildFilterParams(filters)}`, {
    timeoutMs: ANALYTICS_TIMEOUT_MS,
  });
}

export function fetchAnalyticsFilterOptions(
  filters: Pick<AnalyticsFilterParams, "court" | "yearFrom" | "yearTo"> = {},
): Promise<AnalyticsAdvancedFilterOptions> {
  const qs = new URLSearchParams();
  if (filters.court) {
    qs.set("court", filters.court);
  }
  if (filters.yearFrom && filters.yearFrom > 2000) {
    qs.set("year_from", String(filters.yearFrom));
  }
  if (filters.yearTo && filters.yearTo < CURRENT_YEAR) {
    qs.set("year_to", String(filters.yearTo));
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch(`/api/v1/analytics/filter-options${suffix}`, {
    timeoutMs: ANALYTICS_HEAVY_TIMEOUT_MS,
  });
}

export function fetchJudges(
  filters?: AnalyticsFilterParams,
  limit = 20,
): Promise<{ judges: JudgeEntry[] }> {
  const qs = buildFilterParams(filters);
  const sep = qs ? "&" : "?";
  return apiFetch(`/api/v1/analytics/judges${qs}${sep}limit=${limit}`, {
    timeoutMs: ANALYTICS_HEAVY_TIMEOUT_MS,
  });
}

export function fetchLegalConcepts(
  filters?: AnalyticsFilterParams,
  limit = 20,
): Promise<{ concepts: ConceptEntry[] }> {
  const qs = buildFilterParams(filters);
  const sep = qs ? "&" : "?";
  return apiFetch(`/api/v1/analytics/legal-concepts${qs}${sep}limit=${limit}`, {
    timeoutMs: ANALYTICS_TIMEOUT_MS,
  });
}

export function fetchNatureOutcome(
  filters?: AnalyticsFilterParams,
): Promise<NatureOutcomeData> {
  return apiFetch(
    `/api/v1/analytics/nature-outcome${buildFilterParams(filters)}`,
    { timeoutMs: ANALYTICS_TIMEOUT_MS },
  );
}

export function fetchSuccessRate(
  params: AnalyticsFilterParams & {
    visa_subclass?: string;
    case_nature?: string;
    legal_concepts?: string[];
  } = {},
): Promise<SuccessRateData> {
  const qs = new URLSearchParams();
  appendAnalyticsFilters(qs, params);
  if (params.visa_subclass) qs.set("visa_subclass", params.visa_subclass);
  if (params.case_nature) qs.set("case_nature", params.case_nature);
  if (params.legal_concepts && params.legal_concepts.length > 0) {
    qs.set("legal_concepts", params.legal_concepts.join(","));
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch(`/api/v1/analytics/success-rate${suffix}`, {
    timeoutMs: ANALYTICS_TIMEOUT_MS,
  });
}

export function fetchJudgeLeaderboard(
  params: AnalyticsFilterParams & {
    sort_by?: "cases" | "approval_rate" | "name";
    limit?: number;
    name_q?: string;
    min_cases?: number;
  } = {},
): Promise<{ judges: JudgeLeaderboardEntry[]; total_judges: number }> {
  const qs = new URLSearchParams();
  appendAnalyticsFilters(qs, params);
  if (params.sort_by) qs.set("sort_by", params.sort_by);
  if (typeof params.limit === "number") qs.set("limit", String(params.limit));
  if (params.name_q && params.name_q.trim()) {
    qs.set("name_q", params.name_q.trim());
  }
  if (typeof params.min_cases === "number") {
    qs.set("min_cases", String(params.min_cases));
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch(`/api/v1/analytics/judge-leaderboard${suffix}`, {
    timeoutMs: ANALYTICS_TIMEOUT_MS,
  });
}

export function fetchJudgeProfile(
  name: string,
  params: { yearFrom?: number; yearTo?: number } = {},
): Promise<JudgeProfile> {
  const qs = new URLSearchParams();
  qs.set("name", name);
  if (params.yearFrom && params.yearFrom > 2000) {
    qs.set("year_from", String(params.yearFrom));
  }
  if (params.yearTo && params.yearTo < CURRENT_YEAR) {
    qs.set("year_to", String(params.yearTo));
  }
  return apiFetch(`/api/v1/analytics/judge-profile?${qs.toString()}`, {
    timeoutMs: ANALYTICS_TIMEOUT_MS,
  });
}

export function fetchJudgeCompare(
  names: string[],
  params: { yearFrom?: number; yearTo?: number } = {},
): Promise<{ judges: JudgeProfile[] }> {
  const qs = new URLSearchParams();
  qs.set("names", names.join(","));
  if (params.yearFrom && params.yearFrom > 2000) {
    qs.set("year_from", String(params.yearFrom));
  }
  if (params.yearTo && params.yearTo < CURRENT_YEAR) {
    qs.set("year_to", String(params.yearTo));
  }
  return apiFetch(`/api/v1/analytics/judge-compare?${qs.toString()}`, {
    timeoutMs: ANALYTICS_TIMEOUT_MS,
  });
}

export function fetchJudgeBio(name: string): Promise<JudgeBio> {
  return apiFetch(
    `/api/v1/analytics/judge-bio?name=${encodeURIComponent(name)}`,
    { timeoutMs: ANALYTICS_TIMEOUT_MS },
  );
}

export function fetchConceptEffectiveness(
  params: AnalyticsFilterParams & { limit?: number } = {},
): Promise<ConceptEffectivenessData> {
  const qs = new URLSearchParams();
  appendAnalyticsFilters(qs, params);
  if (typeof params.limit === "number") qs.set("limit", String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch(`/api/v1/analytics/concept-effectiveness${suffix}`, {
    timeoutMs: ANALYTICS_TIMEOUT_MS,
  });
}

export function fetchConceptCooccurrence(
  params: AnalyticsFilterParams & { limit?: number; min_count?: number } = {},
): Promise<ConceptCooccurrenceData> {
  const qs = new URLSearchParams();
  appendAnalyticsFilters(qs, params);
  if (typeof params.limit === "number") qs.set("limit", String(params.limit));
  if (typeof params.min_count === "number") {
    qs.set("min_count", String(params.min_count));
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch(`/api/v1/analytics/concept-cooccurrence${suffix}`, {
    timeoutMs: ANALYTICS_TIMEOUT_MS,
  });
}

export function fetchConceptTrends(
  params: AnalyticsFilterParams & { limit?: number } = {},
): Promise<ConceptTrendData> {
  const qs = new URLSearchParams();
  appendAnalyticsFilters(qs, params);
  if (typeof params.limit === "number") qs.set("limit", String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch(`/api/v1/analytics/concept-trends${suffix}`, {
    timeoutMs: ANALYTICS_TIMEOUT_MS,
  });
}

export function fetchMonthlyTrends(
  params: AnalyticsFilterParams = {},
): Promise<MonthlyTrendsData> {
  const qs = new URLSearchParams();
  appendAnalyticsFilters(qs, params);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch(`/api/v1/analytics/monthly-trends${suffix}`, {
    timeoutMs: ANALYTICS_HEAVY_TIMEOUT_MS,
  });
}

export function fetchFlowMatrix(
  params: AnalyticsFilterParams & { top_n?: number } = {},
): Promise<FlowMatrixData> {
  const qs = new URLSearchParams();
  appendAnalyticsFilters(qs, params);
  if (typeof params.top_n === "number") qs.set("top_n", String(params.top_n));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch(`/api/v1/analytics/flow-matrix${suffix}`, {
    timeoutMs: ANALYTICS_TIMEOUT_MS,
  });
}

export function fetchVisaFamilies(
  params: AnalyticsFilterParams = {},
): Promise<VisaFamiliesData> {
  const qs = new URLSearchParams();
  appendAnalyticsFilters(qs, params);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch(`/api/v1/analytics/visa-families${suffix}`, {
    timeoutMs: ANALYTICS_TIMEOUT_MS,
  });
}
