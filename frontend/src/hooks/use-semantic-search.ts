import { useQuery } from "@tanstack/react-query";
import { fetchSemanticSearch } from "@/lib/api";
import type { SemanticSearchResponse } from "@/lib/api";

export function useSemanticSearch(
  query: string,
  limit = 10,
  provider = "openai",
  enabled = true,
) {
  return useQuery<SemanticSearchResponse, Error>({
    queryKey: ["semantic-search", query, limit, provider],
    queryFn: () => fetchSemanticSearch(query, limit, provider),
    enabled: enabled && query.length >= 3,
    staleTime: 5 * 60_000,
    retry: 0,
  });
}
