import { vi } from "vitest";
import type { UseQueryResult } from "@tanstack/react-query";
import type {
  PaginatedLegislations,
  LegislationDetail,
  SearchLegislations,
} from "@/lib/api";

const baseResult = {
  data: undefined,
  isLoading: false,
  isError: false,
  error: null,
  status: "pending" as const,
  isPending: false,
  isSuccess: false,
  dataUpdatedAt: 0,
  failureCount: 0,
  failureReason: null,
  isFetching: false,
  isStale: false,
  remove: vi.fn(),
  refetch: vi.fn(),
};

export const mockUseLegislations = vi.fn(
  () => ({ ...baseResult }) as unknown as UseQueryResult<PaginatedLegislations>,
);

export const mockUseLegislationDetail = vi.fn(
  () => ({ ...baseResult }) as unknown as UseQueryResult<LegislationDetail>,
);

export const mockUseLegislationSearch = vi.fn(
  () => ({ ...baseResult }) as unknown as UseQueryResult<SearchLegislations>,
);
