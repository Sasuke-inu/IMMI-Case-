import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfidenceBadge } from "@/components/analytics/ConfidenceBadge";
import { describe, it, expect, beforeEach } from "vitest";

describe("ConfidenceBadge - Sample Size Indicator", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>,
    );
  };

  it("displays sample size and confidence badge (N>=100)", () => {
    renderWithProviders(<ConfidenceBadge totalMatching={150} />);

    expect(screen.getByText("N=150")).toBeInTheDocument();
    expect(screen.getByTestId("confidence-badge-high")).toBeInTheDocument();
    expect(screen.getByTestId("confidence-badge-high")).toHaveClass(
      "bg-green-100",
    );
  });

  it("displays medium confidence badge (50-99)", () => {
    renderWithProviders(<ConfidenceBadge totalMatching={75} />);

    expect(screen.getByText("N=75")).toBeInTheDocument();
    expect(screen.getByTestId("confidence-badge-medium")).toBeInTheDocument();
    expect(screen.getByTestId("confidence-badge-medium")).toHaveClass(
      "bg-yellow-100",
    );
  });

  it("displays low confidence badge (<50)", () => {
    renderWithProviders(<ConfidenceBadge totalMatching={30} />);

    expect(screen.getByText("N=30")).toBeInTheDocument();
    expect(screen.getByTestId("confidence-badge-low")).toBeInTheDocument();
    expect(screen.getByTestId("confidence-badge-low")).toHaveClass(
      "bg-red-100",
    );
  });

  it("includes tooltip explaining confidence levels", () => {
    renderWithProviders(<ConfidenceBadge totalMatching={100} />);

    const tooltip = screen.getByRole("button", { name: /confidence/i });
    expect(tooltip).toBeInTheDocument();
  });
});
