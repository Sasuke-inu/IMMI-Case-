import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import React from "react";

// -------------------------------------------------------------------
// Hoisted mock factories
// -------------------------------------------------------------------
const { mockUseJudgeLeaderboard, mockUseJudgeProfile, mockUseJudgeBio, mockUseJudgeCompare } =
  vi.hoisted(() => ({
    mockUseJudgeLeaderboard: vi.fn(),
    mockUseJudgeProfile: vi.fn(),
    mockUseJudgeBio: vi.fn(),
    mockUseJudgeCompare: vi.fn(),
  }));

// -------------------------------------------------------------------
// Module-level mocks
// -------------------------------------------------------------------
vi.mock("@/hooks/use-judges", () => ({
  useJudgeLeaderboard: mockUseJudgeLeaderboard,
  useJudgeProfile: mockUseJudgeProfile,
  useJudgeBio: mockUseJudgeBio,
  useJudgeCompare: mockUseJudgeCompare,
}));

// Mock heavy sub-components to avoid deep rendering complexity
vi.mock("@/components/shared/AnalyticsFilters", () => ({
  AnalyticsFilters: () => <div data-testid="analytics-filters" />,
}));
vi.mock("@/components/judges/JudgeLeaderboard", () => ({
  JudgeLeaderboard: ({ data }: { data: unknown[] }) => (
    <div data-testid="judge-leaderboard">{data.length} judges</div>
  ),
}));
vi.mock("@/components/judges/JudgeCard", () => ({
  JudgeCard: ({ judge }: { judge: { name: string } }) => (
    <div data-testid="judge-card">{judge.name}</div>
  ),
}));
vi.mock("@/components/judges/JudgeHero", () => ({
  JudgeHero: ({ profile }: { profile: { name: string } }) => (
    <div data-testid="judge-hero">{profile.name}</div>
  ),
}));
vi.mock("@/components/judges/CourtComparisonCard", () => ({
  CourtComparisonCard: () => <div data-testid="court-comparison-card" />,
}));
vi.mock("@/components/judges/RepresentationCard", () => ({
  RepresentationCard: () => <div data-testid="representation-card" />,
}));
vi.mock("@/components/judges/CountryOriginChart", () => ({
  CountryOriginChart: () => <div data-testid="country-origin-chart" />,
}));
vi.mock("@/components/judges/VisaBreakdownChart", () => ({
  VisaBreakdownChart: () => <div data-testid="visa-breakdown-chart" />,
}));
vi.mock("@/components/judges/NatureBreakdownChart", () => ({
  NatureBreakdownChart: () => <div data-testid="nature-breakdown-chart" />,
}));
vi.mock("@/components/judges/ConceptEffectivenessTable", () => ({
  ConceptEffectivenessTable: () => <div data-testid="concept-effectiveness-table" />,
}));
vi.mock("@/components/shared/OutcomeStackedBar", () => ({
  OutcomeStackedBar: () => <div data-testid="outcome-stacked-bar" />,
}));
vi.mock("@/components/judges/JudgeCompareCard", () => ({
  JudgeCompareCard: ({ judge }: { judge: { judge: { name: string } } }) => (
    <div data-testid="judge-compare-card">{judge.judge.name}</div>
  ),
}));

// Mock recharts to avoid canvas issues
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AreaChart: () => <div data-testid="area-chart" />,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}));

// -------------------------------------------------------------------
// Import pages AFTER mocks
// -------------------------------------------------------------------
import { JudgeProfilesPage } from "@/pages/JudgeProfilesPage";
import { JudgeDetailPage } from "@/pages/JudgeDetailPage";
import { JudgeComparePage } from "@/pages/JudgeComparePage";

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------
function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderWithRouter(ui: React.ReactElement, initialEntries: string[] = ["/"]) {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter initialEntries={initialEntries}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function renderWithRoute(path: string, routePath: string, element: React.ReactElement) {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={routePath} element={element} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Loading hook result */
function loadingResult() {
  return {
    data: undefined,
    isLoading: true,
    isError: false,
    error: null,
    refetch: vi.fn(),
  };
}

/** Minimal judge entry for leaderboard */
function makeJudge(overrides: Partial<{
  name: string;
  display_name: string;
  total_cases: number;
  approval_rate: number;
}> = {}) {
  return {
    name: overrides.name ?? "Judge Smith",
    display_name: overrides.display_name ?? "Judge Smith",
    total_cases: overrides.total_cases ?? 100,
    approval_rate: overrides.approval_rate ?? 65.0,
  };
}

/** Minimal judge profile data */
function makeJudgeProfileData(name: string) {
  return {
    name,
    display_name: name,
    total_cases: 200,
    approval_rate: 70.0,
    outcome_distribution: [],
    yearly_trend: [],
    recent_3yr_trend: [],
    court_comparison: [],
    visa_breakdown: [],
    nature_breakdown: [],
    representation_analysis: {},
    country_breakdown: [],
    concept_effectiveness: [],
    recent_cases: [],
  };
}

// -------------------------------------------------------------------
// Tests: JudgeProfilesPage
// -------------------------------------------------------------------
describe("JudgeProfilesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders page heading", () => {
    mockUseJudgeLeaderboard.mockReturnValue(loadingResult());
    renderWithRouter(<JudgeProfilesPage />);
    expect(screen.getByText("judges.title")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    mockUseJudgeLeaderboard.mockReturnValue(loadingResult());
    renderWithRouter(<JudgeProfilesPage />);
    expect(screen.getByText("judges.loading_judges")).toBeInTheDocument();
  });

  it("renders judge leaderboard in table view", () => {
    mockUseJudgeLeaderboard.mockReturnValue({
      data: {
        judges: [makeJudge({ name: "Alpha" }), makeJudge({ name: "Beta" })],
        total_judges: 2,
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    renderWithRouter(<JudgeProfilesPage />);
    expect(screen.getByTestId("judge-leaderboard")).toBeInTheDocument();
    expect(screen.getByTestId("judge-leaderboard")).toHaveTextContent("2 judges");
  });

  it("shows empty state when no judges match", () => {
    mockUseJudgeLeaderboard.mockReturnValue({
      data: { judges: [], total_judges: 0 },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    renderWithRouter(<JudgeProfilesPage />);
    expect(screen.getByText("judges.empty_state")).toBeInTheDocument();
  });

  it("shows error state when API fails", () => {
    mockUseJudgeLeaderboard.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("Network failure"),
      refetch: vi.fn(),
    });
    renderWithRouter(<JudgeProfilesPage />);
    expect(screen.getByText("Network failure")).toBeInTheDocument();
  });
});

// -------------------------------------------------------------------
// Tests: JudgeDetailPage
// -------------------------------------------------------------------
describe("JudgeDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state", () => {
    mockUseJudgeProfile.mockReturnValue(loadingResult());
    mockUseJudgeBio.mockReturnValue(loadingResult());
    renderWithRoute(
      "/judge-profiles/Judge%20Smith",
      "/judge-profiles/:name",
      <JudgeDetailPage />,
    );
    // PageLoader renders "Loading" text via defaultValue
    expect(screen.getByText("Loading")).toBeInTheDocument();
  });

  it("renders judge profile with hero component", () => {
    mockUseJudgeProfile.mockReturnValue({
      data: makeJudgeProfileData("Judge Smith"),
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseJudgeBio.mockReturnValue({
      data: { found: false },
      isLoading: false,
      isError: false,
      error: null,
    });
    renderWithRoute(
      "/judge-profiles/Judge%20Smith",
      "/judge-profiles/:name",
      <JudgeDetailPage />,
    );
    expect(screen.getByTestId("judge-hero")).toBeInTheDocument();
    expect(screen.getByTestId("judge-hero")).toHaveTextContent("Judge Smith");
  });

  it("shows error state when profile load fails", () => {
    mockUseJudgeProfile.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("Judge not found"),
      refetch: vi.fn(),
    });
    mockUseJudgeBio.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    });
    renderWithRoute(
      "/judge-profiles/Unknown",
      "/judge-profiles/:name",
      <JudgeDetailPage />,
    );
    expect(screen.getByText("Judge not found")).toBeInTheDocument();
  });
});

// -------------------------------------------------------------------
// Tests: JudgeComparePage
// -------------------------------------------------------------------
describe("JudgeComparePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders heading", () => {
    mockUseJudgeCompare.mockReturnValue(loadingResult());
    renderWithRouter(
      <JudgeComparePage />,
      ["/judge-profiles/compare?names=Alice,Bob"],
    );
    expect(screen.getByText("pages.judge_comparison.title")).toBeInTheDocument();
  });

  it("shows empty state when fewer than 2 judges selected", () => {
    mockUseJudgeCompare.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    renderWithRouter(<JudgeComparePage />, ["/judge-profiles/compare"]);
    expect(screen.getByText("pages.judge_comparison.min_judges")).toBeInTheDocument();
  });

  it("renders judge compare cards when data is loaded", () => {
    mockUseJudgeCompare.mockReturnValue({
      data: {
        judges: [
          { judge: { name: "Alice", canonical_name: "Alice" } },
          { judge: { name: "Bob", canonical_name: "Bob" } },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    renderWithRouter(
      <JudgeComparePage />,
      ["/judge-profiles/compare?names=Alice,Bob"],
    );
    const cards = screen.getAllByTestId("judge-compare-card");
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent("Alice");
    expect(cards[1]).toHaveTextContent("Bob");
  });
});
