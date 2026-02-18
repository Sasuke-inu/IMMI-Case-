import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  fetchJudgeLeaderboard,
  fetchJudgeProfile,
  fetchJudgeCompare,
} from "@/lib/api";

export function useJudgeLeaderboard(params: {
  court?: string;
  yearFrom?: number;
  yearTo?: number;
  sort_by?: "cases" | "approval_rate" | "name";
  limit?: number;
}) {
  return useQuery({
    queryKey: [
      "judges",
      "leaderboard",
      params.court,
      params.yearFrom,
      params.yearTo,
      params.sort_by,
      params.limit,
    ],
    queryFn: () => fetchJudgeLeaderboard(params),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useJudgeProfile(
  name: string,
  params: { yearFrom?: number; yearTo?: number } = {},
) {
  return useQuery({
    queryKey: ["judges", "profile", name, params.yearFrom, params.yearTo],
    queryFn: () => fetchJudgeProfile(name, params),
    enabled: !!name,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useJudgeCompare(
  names: string[],
  params: { yearFrom?: number; yearTo?: number } = {},
) {
  return useQuery({
    queryKey: [
      "judges",
      "compare",
      ...names,
      params.yearFrom,
      params.yearTo,
    ],
    queryFn: () => fetchJudgeCompare(names, params),
    enabled: names.length >= 2,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}
