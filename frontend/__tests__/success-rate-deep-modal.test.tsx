import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { SuccessRateDeepModal } from "@/components/analytics/SuccessRateDeepModal";

// Mock API fetches
vi.mock("@/lib/api", () => ({
  fetchNatureOutcome: vi.fn().mockResolvedValue({
    natures: ["Visa Refusal", "Protection Visa"],
    outcomes: ["Affirmed", "Dismissed"],
    matrix: {
      "Visa Refusal": { Affirmed: 500, Dismissed: 200 },
      "Protection Visa": { Affirmed: 300, Dismissed: 150 },
    },
  }),
  fetchConceptEffectiveness: vi.fn().mockResolvedValue({
    concepts: [
      { name: "Refugee Status", win_rate: 42.5, lift: 1.15, total: 200 },
      { name: "Jurisdictional Error", win_rate: 38.0, lift: 0.95, total: 150 },
    ],
  }),
  fetchConceptTrends: vi.fn().mockResolvedValue({
    trends: [
      { year: 2022, concepts: [{ name: "Refugee Status", count: 100 }] },
      { year: 2023, concepts: [{ name: "Refugee Status", count: 120 }] },
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

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  filters: { court: "AATA" },
  currentRate: 45.2,
  totalMatching: 1500,
};

describe("SuccessRateDeepModal", () => {
  it("renders modal when open is true", () => {
    renderWithProviders(<SuccessRateDeepModal {...defaultProps} />);
    expect(screen.getByTestId("deep-modal-overlay")).toBeInTheDocument();
  });

  it("does not render when open is false", () => {
    renderWithProviders(
      <SuccessRateDeepModal {...defaultProps} open={false} />,
    );
    expect(screen.queryByTestId("deep-modal-overlay")).not.toBeInTheDocument();
  });

  it("displays current success rate prominently", () => {
    renderWithProviders(<SuccessRateDeepModal {...defaultProps} />);
    expect(screen.getByText("45.2%")).toBeInTheDocument();
  });

  it("displays total matching cases", () => {
    renderWithProviders(<SuccessRateDeepModal {...defaultProps} />);
    expect(screen.getByText(/1,500/)).toBeInTheDocument();
  });

  it("renders section headings for each analysis panel", () => {
    renderWithProviders(<SuccessRateDeepModal {...defaultProps} />);
    expect(screen.getByText(/Nature.*Outcome/i)).toBeInTheDocument();
    expect(screen.getByText(/Concept Effectiveness/i)).toBeInTheDocument();
    expect(screen.getByText(/Concept Trends/i)).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    renderWithProviders(
      <SuccessRateDeepModal {...defaultProps} onClose={onClose} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape is pressed", () => {
    const onClose = vi.fn();
    renderWithProviders(
      <SuccessRateDeepModal {...defaultProps} onClose={onClose} />,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when overlay backdrop is clicked", () => {
    const onClose = vi.fn();
    renderWithProviders(
      <SuccessRateDeepModal {...defaultProps} onClose={onClose} />,
    );
    fireEvent.click(screen.getByTestId("deep-modal-overlay"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
