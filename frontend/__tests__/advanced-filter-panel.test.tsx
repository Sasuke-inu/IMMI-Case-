import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();
Object.defineProperty(window, "localStorage", { value: localStorageMock });

// Must import after mocking localStorage
import { AdvancedFilterPanel } from "@/components/analytics/AdvancedFilterPanel";

const defaultProps = {
  caseNatures: ["Visa Refusal", "Protection Visa", "Judicial Review"],
  visaSubclasses: ["866", "457", "500", "309"],
  outcomeTypes: ["Affirmed", "Dismissed", "Remitted", "Set Aside"],
  selectedNatures: [] as string[],
  selectedSubclasses: [] as string[],
  selectedOutcomes: [] as string[],
  onNaturesChange: vi.fn(),
  onSubclassesChange: vi.fn(),
  onOutcomesChange: vi.fn(),
};

describe("AdvancedFilterPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  it("renders three filter sections", () => {
    render(<AdvancedFilterPanel {...defaultProps} />);
    expect(screen.getByText(/Case Nature/i)).toBeInTheDocument();
    expect(screen.getByText(/Visa Subclass/i)).toBeInTheDocument();
    expect(screen.getByText(/Outcome/i)).toBeInTheDocument();
  });

  it("renders case nature pills", () => {
    render(<AdvancedFilterPanel {...defaultProps} />);
    expect(screen.getByRole("button", { name: "Visa Refusal" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Protection Visa" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Judicial Review" })).toBeInTheDocument();
  });

  it("calls onNaturesChange when nature pill clicked", () => {
    const onNaturesChange = vi.fn();
    render(
      <AdvancedFilterPanel
        {...defaultProps}
        onNaturesChange={onNaturesChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Protection Visa" }));
    expect(onNaturesChange).toHaveBeenCalledWith(["Protection Visa"]);
  });

  it("deselects nature when already selected", () => {
    const onNaturesChange = vi.fn();
    render(
      <AdvancedFilterPanel
        {...defaultProps}
        selectedNatures={["Protection Visa"]}
        onNaturesChange={onNaturesChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Protection Visa" }));
    expect(onNaturesChange).toHaveBeenCalledWith([]);
  });

  it("renders visa subclass pills", () => {
    render(<AdvancedFilterPanel {...defaultProps} />);
    expect(screen.getByRole("button", { name: "866" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "457" })).toBeInTheDocument();
  });

  it("calls onSubclassesChange when subclass pill clicked", () => {
    const onSubclassesChange = vi.fn();
    render(
      <AdvancedFilterPanel
        {...defaultProps}
        onSubclassesChange={onSubclassesChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "866" }));
    expect(onSubclassesChange).toHaveBeenCalledWith(["866"]);
  });

  it("renders outcome pills", () => {
    render(<AdvancedFilterPanel {...defaultProps} />);
    expect(screen.getByRole("button", { name: "Affirmed" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dismissed" })).toBeInTheDocument();
  });

  it("shows active count badge when filters are selected", () => {
    render(
      <AdvancedFilterPanel
        {...defaultProps}
        selectedNatures={["Visa Refusal", "Protection Visa"]}
        selectedOutcomes={["Affirmed"]}
      />,
    );
    expect(screen.getByTestId("active-filter-count")).toHaveTextContent("3");
  });

  it("has a clear all button that resets all filters", () => {
    const onNaturesChange = vi.fn();
    const onSubclassesChange = vi.fn();
    const onOutcomesChange = vi.fn();
    render(
      <AdvancedFilterPanel
        {...defaultProps}
        selectedNatures={["Visa Refusal"]}
        selectedOutcomes={["Affirmed"]}
        onNaturesChange={onNaturesChange}
        onSubclassesChange={onSubclassesChange}
        onOutcomesChange={onOutcomesChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /clear/i }));
    expect(onNaturesChange).toHaveBeenCalledWith([]);
    expect(onSubclassesChange).toHaveBeenCalledWith([]);
    expect(onOutcomesChange).toHaveBeenCalledWith([]);
  });

  it("saves preset to localStorage", () => {
    render(
      <AdvancedFilterPanel
        {...defaultProps}
        selectedNatures={["Visa Refusal"]}
        selectedOutcomes={["Affirmed"]}
      />,
    );
    // Type preset name
    const input = screen.getByPlaceholderText(/preset name/i);
    fireEvent.change(input, { target: { value: "My Filter" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(localStorageMock.setItem).toHaveBeenCalled();
    const [key, value] = localStorageMock.setItem.mock.calls[0];
    expect(key).toBe("analytics-filter-presets");
    const parsed = JSON.parse(value);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].name).toBe("My Filter");
    expect(parsed[0].natures).toEqual(["Visa Refusal"]);
    expect(parsed[0].outcomes).toEqual(["Affirmed"]);
  });

  it("loads preset from localStorage", () => {
    const presets = [
      {
        name: "Saved Preset",
        natures: ["Protection Visa"],
        subclasses: ["866"],
        outcomes: ["Remitted"],
      },
    ];
    localStorageMock.getItem.mockReturnValue(JSON.stringify(presets));

    const onNaturesChange = vi.fn();
    const onSubclassesChange = vi.fn();
    const onOutcomesChange = vi.fn();
    render(
      <AdvancedFilterPanel
        {...defaultProps}
        onNaturesChange={onNaturesChange}
        onSubclassesChange={onSubclassesChange}
        onOutcomesChange={onOutcomesChange}
      />,
    );

    // Click the preset button
    fireEvent.click(screen.getByRole("button", { name: "Saved Preset" }));
    expect(onNaturesChange).toHaveBeenCalledWith(["Protection Visa"]);
    expect(onSubclassesChange).toHaveBeenCalledWith(["866"]);
    expect(onOutcomesChange).toHaveBeenCalledWith(["Remitted"]);
  });
});
