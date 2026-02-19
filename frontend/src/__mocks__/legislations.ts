import type { Legislation, PaginatedLegislations, SearchLegislations, LegislationDetail } from "@/lib/api";

export const mockLegislations: Legislation[] = [
  {
    id: "migration-act-1958",
    title: "Migration Act 1958",
    shortcode: "MA",
    jurisdiction: "Commonwealth",
    type: "Act",
    version: "1.0",
    updated_date: "2024-01-15",
    description: "The primary legislation governing immigration to Australia",
    full_text: "MIGRATION ACT 1958\n\nBeing an Act relating to immigration...",
    sections: 500,
    last_amended: "2023-12-01",
  },
  {
    id: "migration-regulations-1994",
    title: "Migration Regulations 1994",
    shortcode: "MR",
    jurisdiction: "Commonwealth",
    type: "Regulation",
    version: "2.1",
    updated_date: "2024-02-10",
    description: "Regulations made under the Migration Act 1958",
    full_text: "MIGRATION REGULATIONS 1994\n\nMade under the Migration Act...",
    sections: 1200,
    last_amended: "2024-01-20",
  },
  {
    id: "character-test-2016",
    title: "Character Test Amendment 2016",
    shortcode: "CT16",
    jurisdiction: "Commonwealth",
    type: "Amendment",
    version: "1.2",
    updated_date: "2023-11-05",
    description: "Amendment relating to character requirements",
    full_text: "CHARACTER TEST AMENDMENT 2016\n\nThis amendment...",
    sections: 50,
    last_amended: "2023-10-15",
  },
];

export const mockPaginatedLegislations: PaginatedLegislations = {
  success: true,
  data: mockLegislations.slice(0, 2),
  meta: {
    total: 3,
    pages: 2,
    page: 1,
    limit: 2,
  },
};

export const mockLegislationDetail: LegislationDetail = {
  success: true,
  data: mockLegislations[0],
};

export const mockSearchLegislations: SearchLegislations = {
  success: true,
  data: [mockLegislations[0]],
  meta: {
    query: "migration",
    total_results: 1,
    limit: 20,
  },
};

export const mockEmptyPaginatedLegislations: PaginatedLegislations = {
  success: true,
  data: [],
  meta: {
    total: 0,
    pages: 0,
    page: 1,
    limit: 20,
  },
};

export const mockEmptySearchLegislations: SearchLegislations = {
  success: true,
  data: [],
  meta: {
    query: "xyz",
    total_results: 0,
    limit: 20,
  },
};
