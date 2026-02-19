import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  fetchOutcomes,
  fetchJudges,
  fetchLegalConcepts,
  fetchNatureOutcome,
  fetchSuccessRate,
  fetchConceptEffectiveness,
  fetchConceptCooccurrence,
  fetchConceptTrends,
  fetchFlowMatrix,
  fetchMonthlyTrends,
} from "@/lib/api";
import type { AnalyticsFilterParams } from "@/types/case";

const filterKey = (f?: AnalyticsFilterParams) => [
  f?.court,
  f?.yearFrom,
  f?.yearTo,
  f?.caseNatures?.join(","),
  f?.visaSubclasses?.join(","),
  f?.outcomeTypes?.join(","),
];

export function useOutcomes(filters?: AnalyticsFilterParams) {
  return useQuery({
    queryKey: ["analytics", "outcomes", ...filterKey(filters)],
    queryFn: () => fetchOutcomes(filters),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useJudges(filters?: AnalyticsFilterParams, limit = 20) {
  return useQuery({
    queryKey: ["analytics", "judges", limit, ...filterKey(filters)],
    queryFn: () => fetchJudges(filters, limit),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useLegalConcepts(filters?: AnalyticsFilterParams, limit = 20) {
  return useQuery({
    queryKey: ["analytics", "concepts", limit, ...filterKey(filters)],
    queryFn: () => fetchLegalConcepts(filters, limit),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useNatureOutcome(filters?: AnalyticsFilterParams) {
  return useQuery({
    queryKey: ["analytics", "nature-outcome", ...filterKey(filters)],
    queryFn: () => fetchNatureOutcome(filters),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useSuccessRate(
  params: AnalyticsFilterParams & {
    visa_subclass?: string;
    case_nature?: string;
    legal_concepts?: string[];
  },
) {
  return useQuery({
    queryKey: [
      "analytics",
      "success-rate",
      ...filterKey(params),
      params.visa_subclass,
      params.case_nature,
      ...(params.legal_concepts ?? []),
    ],
    queryFn: () => fetchSuccessRate(params),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useConceptEffectiveness(
  params?: AnalyticsFilterParams & { limit?: number },
) {
  return useQuery({
    queryKey: [
      "analytics",
      "concept-effectiveness",
      ...filterKey(params),
      params?.limit ?? 30,
    ],
    queryFn: () => fetchConceptEffectiveness(params),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useConceptCooccurrence(
  params?: AnalyticsFilterParams & { limit?: number; min_count?: number },
) {
  return useQuery({
    queryKey: [
      "analytics",
      "concept-cooccurrence",
      ...filterKey(params),
      params?.limit ?? 15,
      params?.min_count ?? 50,
    ],
    queryFn: () => fetchConceptCooccurrence(params),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useConceptTrends(
  params?: AnalyticsFilterParams & { limit?: number },
) {
  return useQuery({
    queryKey: [
      "analytics",
      "concept-trends",
      ...filterKey(params),
      params?.limit ?? 10,
    ],
    queryFn: () => fetchConceptTrends(params),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useFlowMatrix(
  params?: AnalyticsFilterParams & { top_n?: number },
) {
  return useQuery({
    queryKey: [
      "analytics",
      "flow-matrix",
      ...filterKey(params),
      params?.top_n ?? 8,
    ],
    queryFn: () => fetchFlowMatrix(params),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useMonthlyTrends(params?: AnalyticsFilterParams) {
  return useQuery({
    queryKey: ["analytics", "monthly-trends", ...filterKey(params)],
    queryFn: () => fetchMonthlyTrends(params),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}
