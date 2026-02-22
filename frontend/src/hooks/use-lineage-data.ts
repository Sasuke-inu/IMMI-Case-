import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchLineageData } from "@/lib/api";

export function useLineageData() {
  return useQuery({
    queryKey: ["lineage"],
    queryFn: () => fetchLineageData(),
    staleTime: 300_000,
    placeholderData: keepPreviousData,
  });
}
