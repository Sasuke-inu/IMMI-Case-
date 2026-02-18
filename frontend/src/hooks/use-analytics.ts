import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  fetchOutcomes,
  fetchJudges,
  fetchLegalConcepts,
  fetchNatureOutcome,
} from "@/lib/api";
import type { AnalyticsFilterParams } from "@/types/case";

const filterKey = (f?: AnalyticsFilterParams) => [
  f?.court,
  f?.yearFrom,
  f?.yearTo,
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
