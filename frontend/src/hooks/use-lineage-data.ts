import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchLineageData } from "@/lib/api";

export function useLineageData() {
  return useQuery({
    queryKey: ["lineage"],
    queryFn: () => fetchLineageData(),
    retry: 0,
    staleTime: 300_000,
    placeholderData: keepPreviousData,
  });
}
