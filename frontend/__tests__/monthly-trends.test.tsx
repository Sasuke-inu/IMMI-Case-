import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { MonthlyTrendsChart } from "@/components/analytics/MonthlyTrendsChart";

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

const sampleData = {
  series: [
    { month: "2020-01", total: 100, wins: 40, win_rate: 40.0 },
    { month: "2020-02", total: 120, wins: 60, win_rate: 50.0 },
    { month: "2020-03", total: 80, wins: 35, win_rate: 43.8 },
  ],
  events: [{ month: "2020-02", label: "Policy change" }],
};

describe("MonthlyTrendsChart", () => {
  it("renders the container", () => {
    renderWithProviders(<MonthlyTrendsChart data={sampleData} />);
    expect(screen.getByTestId("monthly-trends-chart")).toBeInTheDocument();
  });

  it("renders empty state when no data", () => {
    renderWithProviders(
      <MonthlyTrendsChart data={{ series: [], events: [] }} />,
    );
    expect(screen.getByText(/no monthly data/i)).toBeInTheDocument();
  });

  it("renders event markers", () => {
    renderWithProviders(<MonthlyTrendsChart data={sampleData} />);
    const matches = screen.getAllByText("Policy change");
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });
});
