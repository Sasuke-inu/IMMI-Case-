import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { FlowSankeyChart } from "@/components/analytics/FlowSankeyChart";

// Mock the API
vi.mock("@/lib/api", () => ({
  fetchFlowMatrix: vi.fn().mockResolvedValue({
    nodes: [
      { name: "AATA", layer: "court" },
      { name: "Protection Visa", layer: "nature" },
      { name: "Affirmed", layer: "outcome" },
      { name: "Remitted", layer: "outcome" },
    ],
    links: [
      { source: 0, target: 1, value: 500 },
      { source: 1, target: 2, value: 300 },
      { source: 1, target: 3, value: 200 },
    ],
  }),
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("FlowSankeyChart", () => {
  it("renders container with test id", () => {
    renderWithProviders(
      <FlowSankeyChart
        data={{
          nodes: [
            { name: "AATA", layer: "court" },
            { name: "Protection", layer: "nature" },
            { name: "Affirmed", layer: "outcome" },
          ],
          links: [
            { source: 0, target: 1, value: 300 },
            { source: 1, target: 2, value: 300 },
          ],
        }}
      />,
    );
    expect(screen.getByTestId("flow-sankey-chart")).toBeInTheDocument();
  });

  it("renders empty state when no data", () => {
    renderWithProviders(
      <FlowSankeyChart data={{ nodes: [], links: [] }} />,
    );
    expect(screen.getByText(/no flow data/i)).toBeInTheDocument();
  });

  it("renders layer labels", () => {
    renderWithProviders(
      <FlowSankeyChart
        data={{
          nodes: [
            { name: "AATA", layer: "court" },
            { name: "Protection", layer: "nature" },
            { name: "Affirmed", layer: "outcome" },
          ],
          links: [
            { source: 0, target: 1, value: 300 },
            { source: 1, target: 2, value: 300 },
          ],
        }}
      />,
    );
    expect(screen.getByText("Court")).toBeInTheDocument();
    expect(screen.getByText("Case Nature")).toBeInTheDocument();
    expect(screen.getByText("Outcome")).toBeInTheDocument();
  });
});
