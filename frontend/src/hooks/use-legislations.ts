import { useQuery } from "@tanstack/react-query";
import {
  fetchLegislations,
  fetchLegislation,
  searchLegislations,
  type PaginatedLegislations,
  type SearchLegislations,
} from "@/lib/api";

/**
 * Hook to fetch a paginated list of legislations
 *
 * @param page - Page number (1-indexed)
 * @param limit - Items per page (1-100, default 10)
 * @returns Query result with paginated legislations and metadata
 *
 * @example
 * const { data, isLoading, error } = useLegislations(1, 20)
 */
export function useLegislations(page: number = 1, limit: number = 10) {
  return useQuery({
    queryKey: ["legislations", page, limit],
    queryFn: () => fetchLegislations(page, limit),
    staleTime: 10_000, // 10 seconds
    placeholderData: (previousData) => previousData, // Smooth pagination
  });
}

/**
 * Hook to fetch a single legislation by ID
 *
 * @param legislationId - The legislation ID (e.g., 'migration-act-1958')
 * @returns Query result with legislation detail
 *
 * @example
 * const { data, isLoading } = useLegislationDetail('migration-act-1958')
 */
export function useLegislationDetail(legislationId: string | null) {
  return useQuery({
    queryKey: ["legislation", legislationId],
    queryFn: () => fetchLegislation(legislationId!),
    enabled: !!legislationId, // Don't fetch if no ID
    staleTime: 60_000, // 1 minute
  });
}

/**
 * Hook to search legislations by query string
 *
 * Searches across title, description, shortcode, and id fields.
 *
 * @param query - Search query (min 2 characters)
 * @param limit - Max results to return (1-100, default 20)
 * @returns Query result with search results
 *
 * @example
 * const { data, isLoading } = useLegislationSearch('migration', 50)
 */
export function useLegislationSearch(query: string = "", limit: number = 20) {
  return useQuery({
    queryKey: ["legislations-search", query, limit],
    queryFn: () => searchLegislations(query, limit),
    enabled: query.length > 0, // Don't fetch if query is empty
    staleTime: 15_000, // 15 seconds
  });
}
