import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchLegislation,
  fetchLegislationUpdateStatus,
  fetchLegislations,
  searchLegislations,
  startLegislationUpdate,
} from "@/lib/api";

export function useLegislations(page: number = 1, limit: number = 10) {
  return useQuery({
    queryKey: ["legislations", page, limit],
    queryFn: () => fetchLegislations(page, limit),
    staleTime: 10_000,
    placeholderData: (previousData) => previousData,
  });
}

export function useLegislationDetail(legislationId: string | null) {
  return useQuery({
    queryKey: ["legislation", legislationId],
    queryFn: () => fetchLegislation(legislationId!),
    enabled: !!legislationId,
    staleTime: 60_000,
  });
}

export function useLegislationSearch(query: string = "", limit: number = 20) {
  return useQuery({
    queryKey: ["legislations-search", query, limit],
    queryFn: () => searchLegislations(query, limit),
    enabled: query.length >= 2,
    staleTime: 15_000,
  });
}

/** Poll the background scrape job status. Polls every 2s while running. */
export function useLegislationUpdateStatus() {
  return useQuery({
    queryKey: ["legislations-update-status"],
    queryFn: fetchLegislationUpdateStatus,
    refetchInterval: (query) =>
      query.state.data?.status?.running ? 2_000 : false,
    staleTime: 0,
  });
}

/** Start a background scrape job for one or all laws. */
export function useStartLegislationUpdate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (law_id?: string) => startLegislationUpdate(law_id),
    onSuccess: () => {
      // Kick off status polling immediately
      queryClient.invalidateQueries({ queryKey: ["legislations-update-status"] });
    },
    onSettled: () => {
      // Refresh legislation list after job completes
      queryClient.invalidateQueries({ queryKey: ["legislations"] });
    },
  });
}
