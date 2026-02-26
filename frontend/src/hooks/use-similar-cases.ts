import { useQuery } from "@tanstack/react-query";
import { fetchSimilarCases } from "@/lib/api";
import type { SimilarCasesResponse } from "@/lib/api";

export function useSimilarCases(caseId: string, enabled = true) {
  return useQuery<SimilarCasesResponse, Error>({
    queryKey: ["similar-cases", caseId],
    queryFn: () => fetchSimilarCases(caseId),
    enabled: enabled && !!caseId,
    staleTime: 10 * 60_000,
    retry: 0,
  });
}
