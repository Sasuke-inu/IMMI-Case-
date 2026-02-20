import { useState, useMemo, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { AnalyticsFilters } from "@/components/shared/AnalyticsFilters";
import { AdvancedFilterPanel } from "@/components/analytics/AdvancedFilterPanel";
import { SuccessRateCalculator } from "@/components/analytics/SuccessRateCalculator";
import { OutcomeAnalysisSection } from "@/components/analytics/OutcomeAnalysisSection";
import { FlowTrendsSection } from "@/components/analytics/FlowTrendsSection";
import { ConceptIntelligenceSection } from "@/components/analytics/ConceptIntelligenceSection";
import { useFilterOptions } from "@/hooks/use-cases";
import type { AnalyticsFilterParams } from "@/types/case";

const CURRENT_YEAR = new Date().getFullYear();

const OUTCOME_TYPES = [
  "Affirmed",
  "Dismissed",
  "Remitted",
  "Set Aside",
  "Allowed",
  "Refused",
  "Withdrawn",
  "Other",
];

export function AnalyticsPage() {
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [court, setCourt] = useState("");
  const [yearFrom, setYearFrom] = useState(2000);
  const [yearTo, setYearTo] = useState(CURRENT_YEAR);
  const [selectedNatures, setSelectedNatures] = useState<string[]>([]);
  const [selectedSubclasses, setSelectedSubclasses] = useState<string[]>([]);
  const [selectedOutcomes, setSelectedOutcomes] = useState<string[]>([]);

  const handleCourtChange = (value: string) => {
    startTransition(() => setCourt(value));
  };
  const handleYearRangeChange = (from: number, to: number) => {
    startTransition(() => {
      setYearFrom(from);
      setYearTo(to);
    });
  };
  const handleNaturesChange = (value: string[]) => {
    startTransition(() => setSelectedNatures(value));
  };
  const handleSubclassesChange = (value: string[]) => {
    startTransition(() => setSelectedSubclasses(value));
  };
  const handleOutcomesChange = (value: string[]) => {
    startTransition(() => setSelectedOutcomes(value));
  };

  const { data: filterOptions } = useFilterOptions();

  const filters: AnalyticsFilterParams = useMemo(
    () => ({
      court: court || undefined,
      yearFrom,
      yearTo,
      caseNatures: selectedNatures.length ? selectedNatures : undefined,
      visaSubclasses: selectedSubclasses.length
        ? selectedSubclasses
        : undefined,
      outcomeTypes: selectedOutcomes.length ? selectedOutcomes : undefined,
    }),
    [
      court,
      yearFrom,
      yearTo,
      selectedNatures,
      selectedSubclasses,
      selectedOutcomes,
    ],
  );

  return (
    <div
      className={`space-y-6 ${isPending ? "opacity-70 transition-opacity" : ""}`}
    >
      <div className="space-y-3">
        <div>
          <h1 className="font-semibold text-foreground">
            {t("analytics.title")}
          </h1>
          <p className="text-sm text-muted-text">{t("analytics.subtitle")}</p>
        </div>
        <AnalyticsFilters
          court={court}
          yearFrom={yearFrom}
          yearTo={yearTo}
          onCourtChange={handleCourtChange}
          onYearRangeChange={handleYearRangeChange}
        />
        <AdvancedFilterPanel
          caseNatures={filterOptions?.natures ?? []}
          visaSubclasses={filterOptions?.visa_types ?? []}
          outcomeTypes={OUTCOME_TYPES}
          selectedNatures={selectedNatures}
          selectedSubclasses={selectedSubclasses}
          selectedOutcomes={selectedOutcomes}
          onNaturesChange={handleNaturesChange}
          onSubclassesChange={handleSubclassesChange}
          onOutcomesChange={handleOutcomesChange}
        />
      </div>

      <SuccessRateCalculator filters={filters} />

      <OutcomeAnalysisSection filters={filters} />

      <FlowTrendsSection filters={filters} />

      <ConceptIntelligenceSection filters={filters} />
    </div>
  );
}
