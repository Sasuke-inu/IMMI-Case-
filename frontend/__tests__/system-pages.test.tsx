import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import React from "react";

// -------------------------------------------------------------------
// Hoisted mock factories
// -------------------------------------------------------------------
const { mockUseStats, mockFetchJobStatus, mockFetchPipelineStatus } =
  vi.hoisted(() => ({
    mockUseStats: vi.fn(),
    mockFetchJobStatus: vi.fn(),
    mockFetchPipelineStatus: vi.fn(),
  }));

// -------------------------------------------------------------------
// Module-level mocks
// -------------------------------------------------------------------
vi.mock("@/hooks/use-stats", () => ({
  useStats: mockUseStats,
  useTrends: vi.fn(() => ({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  })),
}));

vi.mock("@/lib/api", () => ({
  startDownload: vi.fn(),
  fetchJobStatus: mockFetchJobStatus,
  fetchPipelineStatus: mockFetchPipelineStatus,
  pipelineAction: vi.fn(),
  downloadExportFile: vi.fn(),
}));

// Mock ProgressRing to avoid canvas/SVG issues
vi.mock("@/components/shared/ProgressRing", () => ({
  ProgressRing: ({ label }: { label: string }) => (
    <div data-testid="progress-ring">{label}</div>
  ),
}));

// Mock StatCard — render title and value as text for assertions
vi.mock("@/components/dashboard/StatCard", () => ({
  StatCard: ({ title, value }: { title: string; value: number | string }) => (
    <div data-testid="stat-card">
      <span data-testid="stat-title">{title}</span>
      <span data-testid="stat-value">{typeof value === "number" ? value.toLocaleString() : value}</span>
    </div>
  ),
}));

// Mock DatabaseCard for PipelinePage
vi.mock("@/components/shared/DatabaseCard", () => ({
  DatabaseCard: ({ code }: { code: string }) => (
    <div data-testid="database-card">{code}</div>
  ),
}));

// -------------------------------------------------------------------
// Import pages AFTER mocks
// -------------------------------------------------------------------
import { DownloadPage } from "@/pages/DownloadPage";
import { PipelinePage } from "@/pages/PipelinePage";
import { JobStatusPage } from "@/pages/JobStatusPage";

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

function renderWithRouter(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Minimal stats data */
function makeStats(overrides: Partial<{
  total_cases: number;
  with_full_text: number;
  courts: Record<string, number>;
}> = {}) {
  return {
    total_cases: 10000,
    with_full_text: 9500,
    courts: { ARTA: 2000, FCA: 3000 },
    years: {},
    sources: {},
    natures: {},
    visa_subclasses: {},
    recent_cases: [],
    ...overrides,
  };
}

function defaultStatsResult(overrides: Partial<{
  total_cases: number;
  with_full_text: number;
  courts: Record<string, number>;
}> = {}) {
  return {
    data: makeStats(overrides),
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  };
}

// -------------------------------------------------------------------
// Tests: DownloadPage
// -------------------------------------------------------------------
describe("DownloadPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchJobStatus.mockResolvedValue({ running: false });
  });

  it("renders page heading", () => {
    mockUseStats.mockReturnValue(defaultStatsResult());
    renderWithRouter(<DownloadPage />);
    expect(screen.getByText("download.title")).toBeInTheDocument();
  });

  it("shows download settings form when cases remain", () => {
    mockUseStats.mockReturnValue(
      defaultStatsResult({ total_cases: 10000, with_full_text: 8000 }),
    );
    renderWithRouter(<DownloadPage />);
    expect(screen.getByText("download.download_settings")).toBeInTheDocument();
    expect(screen.getByText("download.start_download")).toBeInTheDocument();
  });

  it("shows stat cards with download progress", () => {
    mockUseStats.mockReturnValue(
      defaultStatsResult({ total_cases: 5000, with_full_text: 4500 }),
    );
    renderWithRouter(<DownloadPage />);
    const statCards = screen.getAllByTestId("stat-card");
    expect(statCards.length).toBe(3);
  });

  it("shows export data section", () => {
    mockUseStats.mockReturnValue(defaultStatsResult());
    renderWithRouter(<DownloadPage />);
    expect(screen.getByText("download.export_data_title")).toBeInTheDocument();
    expect(screen.getByText(/buttons.export_csv/)).toBeInTheDocument();
    expect(screen.getByText(/buttons.export_json/)).toBeInTheDocument();
  });
});

// -------------------------------------------------------------------
// Tests: PipelinePage
// -------------------------------------------------------------------
describe("PipelinePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchPipelineStatus.mockResolvedValue({
      running: false,
      log: [],
      errors: [],
    });
  });

  it("renders page heading", () => {
    mockUseStats.mockReturnValue(defaultStatsResult());
    renderWithRouter(<PipelinePage />);
    // "pipeline.title" appears in PageHeader and in a StatCard;
    // check the heading specifically
    const headings = screen.getAllByText("pipeline.title");
    expect(headings.length).toBeGreaterThan(0);
  });

  it("shows pipeline preset buttons", () => {
    mockUseStats.mockReturnValue(defaultStatsResult());
    renderWithRouter(<PipelinePage />);
    // "pipeline.quick_preset" appears as h2 heading and as button text
    const presetLabels = screen.getAllByText("pipeline.quick_preset");
    expect(presetLabels.length).toBeGreaterThan(0);
    expect(screen.getByText("pipeline.full_preset")).toBeInTheDocument();
  });

  it("shows how pipeline works section when not running", () => {
    mockUseStats.mockReturnValue(defaultStatsResult());
    renderWithRouter(<PipelinePage />);
    expect(screen.getByText("pipeline.how_pipeline_works")).toBeInTheDocument();
  });

  it("renders stat cards", () => {
    mockUseStats.mockReturnValue(defaultStatsResult());
    renderWithRouter(<PipelinePage />);
    const statCards = screen.getAllByTestId("stat-card");
    expect(statCards.length).toBe(4);
  });
});

// -------------------------------------------------------------------
// Tests: JobStatusPage
// -------------------------------------------------------------------
describe("JobStatusPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders page heading", () => {
    mockFetchJobStatus.mockResolvedValue({
      running: false,
      type: "",
      total: 0,
      completed: 0,
      errors: [],
      results: [],
    });
    renderWithRouter(<JobStatusPage />);
    expect(screen.getByText("pages.job_status.title")).toBeInTheDocument();
  });

  it("shows loading state initially", () => {
    // fetchJobStatus never resolves, so query stays in loading state
    mockFetchJobStatus.mockReturnValue(new Promise(() => {}));
    renderWithRouter(<JobStatusPage />);
    expect(screen.getByText("pages.job_status.title")).toBeInTheDocument();
    expect(screen.getByText("Loading")).toBeInTheDocument();
  });

  it("shows idle state when no job is running", async () => {
    mockFetchJobStatus.mockResolvedValue({
      running: false,
      type: "",
      total: 0,
      completed: 0,
      errors: [],
      results: [],
    });
    renderWithRouter(<JobStatusPage />);
    const noJobText = await screen.findByText("pages.job_status.no_active_job");
    expect(noJobText).toBeInTheDocument();
  });
});
