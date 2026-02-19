import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AnalyticsFilters } from "@/components/shared/AnalyticsFilters";
import { AdvancedFilterPanel } from "@/components/analytics/AdvancedFilterPanel";
import { ChartCard } from "@/components/analytics/ChartCard";
import { SuccessRateCalculator } from "@/components/analytics/SuccessRateCalculator";
import { OutcomeByCourtChart } from "@/components/analytics/OutcomeByCourtChart";
import { OutcomeTrendChart } from "@/components/analytics/OutcomeTrendChart";
import { OutcomeBySubclassChart } from "@/components/analytics/OutcomeBySubclassChart";
import { TopJudgesChart } from "@/components/analytics/TopJudgesChart";
import { LegalConceptsChart } from "@/components/analytics/LegalConceptsChart";
import { NatureOutcomeHeatmap } from "@/components/analytics/NatureOutcomeHeatmap";
import { ConceptEffectivenessChart } from "@/components/analytics/ConceptEffectivenessChart";
import { ConceptCourtBreakdown } from "@/components/analytics/ConceptCourtBreakdown";
import { ConceptCooccurrenceHeatmap } from "@/components/analytics/ConceptCooccurrenceHeatmap";
import { ConceptTrendChart } from "@/components/analytics/ConceptTrendChart";
import { EmergingConceptsBadges } from "@/components/analytics/EmergingConceptsBadges";
import { FlowSankeyChart } from "@/components/analytics/FlowSankeyChart";
import { MonthlyTrendsChart } from "@/components/analytics/MonthlyTrendsChart";
import { useFilterOptions } from "@/hooks/use-cases";
import {
  useOutcomes,
  useJudges,
  useLegalConcepts,
  useNatureOutcome,
  useConceptEffectiveness,
  useConceptCooccurrence,
  useConceptTrends,
  useFlowMatrix,
  useMonthlyTrends,
} from "@/hooks/use-analytics";
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
  const [court, setCourt] = useState("");
  const [yearFrom, setYearFrom] = useState(2000);
  const [yearTo, setYearTo] = useState(CURRENT_YEAR);
  const [selectedNatures, setSelectedNatures] = useState<string[]>([]);
  const [selectedSubclasses, setSelectedSubclasses] = useState<string[]>([]);
  const [selectedOutcomes, setSelectedOutcomes] = useState<string[]>([]);

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

  const { data: outcomes, isLoading: loadingOutcomes } = useOutcomes(filters);
  const { data: judgesData, isLoading: loadingJudges } = useJudges(filters);
  const { data: conceptsData, isLoading: loadingConcepts } =
    useLegalConcepts(filters);
  const { data: natureOutcome, isLoading: loadingHeatmap } =
    useNatureOutcome(filters);

  const { data: conceptEffectiveness, isLoading: loadingEffectiveness } =
    useConceptEffectiveness({ ...filters, limit: 30 });
  const { data: cooccurrence, isLoading: loadingCooccurrence } =
    useConceptCooccurrence({
      ...filters,
      limit: 15,
      min_count: 2,
    });
  const { data: conceptTrends, isLoading: loadingConceptTrends } =
    useConceptTrends({
      ...filters,
      limit: 10,
    });
  const { data: flowMatrix, isLoading: loadingFlowMatrix } =
    useFlowMatrix(filters);
  const { data: monthlyTrends, isLoading: loadingMonthlyTrends } =
    useMonthlyTrends(filters);

  const handleYearRangeChange = (from: number, to: number) => {
    setYearFrom(from);
    setYearTo(to);
  };

  return (
    <div className="space-y-6">
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
          onCourtChange={setCourt}
          onYearRangeChange={handleYearRangeChange}
        />
        <AdvancedFilterPanel
          caseNatures={filterOptions?.natures ?? []}
          visaSubclasses={filterOptions?.visa_types ?? []}
          outcomeTypes={OUTCOME_TYPES}
          selectedNatures={selectedNatures}
          selectedSubclasses={selectedSubclasses}
          selectedOutcomes={selectedOutcomes}
          onNaturesChange={setSelectedNatures}
          onSubclassesChange={setSelectedSubclasses}
          onOutcomesChange={setSelectedOutcomes}
        />
      </div>

      <SuccessRateCalculator filters={filters} />

      <ChartCard
        title={t("analytics.outcome_rate_by_court")}
        isLoading={loadingOutcomes}
        isEmpty={!outcomes || Object.keys(outcomes.by_court).length === 0}
      >
        {outcomes && <OutcomeByCourtChart data={outcomes.by_court} />}
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title={t("analytics.affirmed_rate_trend")}
          isLoading={loadingOutcomes}
          isEmpty={!outcomes || Object.keys(outcomes.by_year).length === 0}
        >
          {outcomes && <OutcomeTrendChart data={outcomes.by_year} />}
        </ChartCard>

        <ChartCard
          title={t("analytics.affirmed_rate_visa")}
          isLoading={loadingOutcomes}
          isEmpty={!outcomes || Object.keys(outcomes.by_subclass).length === 0}
        >
          {outcomes && <OutcomeBySubclassChart data={outcomes.by_subclass} />}
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title={t("analytics.active_judges")}
          isLoading={loadingJudges}
          isEmpty={!judgesData || judgesData.judges.length === 0}
        >
          {judgesData && <TopJudgesChart data={judgesData.judges} />}
        </ChartCard>

        <ChartCard
          title={t("analytics.legal_concepts_frequency")}
          isLoading={loadingConcepts}
          isEmpty={!conceptsData || conceptsData.concepts.length === 0}
        >
          {conceptsData && <LegalConceptsChart data={conceptsData.concepts} />}
        </ChartCard>
      </div>

      <ChartCard
        title={t("analytics.nature_outcome_matrix")}
        isLoading={loadingHeatmap}
        isEmpty={!natureOutcome || natureOutcome.natures.length === 0}
      >
        {natureOutcome && <NatureOutcomeHeatmap data={natureOutcome} />}
      </ChartCard>

      <ChartCard
        title={t("analytics.flow_sankey", {
          defaultValue: "Case Flow (Court → Nature → Outcome)",
        })}
        isLoading={loadingFlowMatrix}
        isEmpty={!flowMatrix || flowMatrix.nodes.length === 0}
      >
        {flowMatrix && <FlowSankeyChart data={flowMatrix} />}
      </ChartCard>

      <ChartCard
        title={t("analytics.monthly_trends", {
          defaultValue: "Monthly Trends & Policy Events",
        })}
        isLoading={loadingMonthlyTrends}
        isEmpty={!monthlyTrends || monthlyTrends.series.length === 0}
      >
        {monthlyTrends && <MonthlyTrendsChart data={monthlyTrends} />}
      </ChartCard>

      <section className="space-y-4" data-testid="concept-intelligence-section">
        <div>
          <h2 className="font-semibold text-foreground">
            {t("analytics.concept_intelligence")}
          </h2>
          <p className="text-sm text-muted-text">
            {t("analytics.concept_intelligence_desc") ||
              "Identify legal concepts that correlate with better outcomes and how they evolve over time."}
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title={t("analytics.concept_effectiveness")}
            isLoading={loadingEffectiveness}
            isEmpty={
              !conceptEffectiveness ||
              conceptEffectiveness.concepts.length === 0
            }
          >
            {conceptEffectiveness && (
              <ConceptEffectivenessChart data={conceptEffectiveness} />
            )}
          </ChartCard>

          <ChartCard
            title={t("analytics.concept_by_court")}
            isLoading={loadingEffectiveness}
            isEmpty={
              !conceptEffectiveness ||
              conceptEffectiveness.concepts.length === 0
            }
          >
            {conceptEffectiveness && (
              <ConceptCourtBreakdown data={conceptEffectiveness} />
            )}
          </ChartCard>
        </div>

        <ChartCard
          title={t("analytics.concept_cooccurrence")}
          isLoading={loadingCooccurrence}
          isEmpty={!cooccurrence || cooccurrence.concepts.length === 0}
        >
          {cooccurrence && <ConceptCooccurrenceHeatmap data={cooccurrence} />}
        </ChartCard>

        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title={t("analytics.concept_trends")}
            isLoading={loadingConceptTrends}
            isEmpty={
              !conceptTrends || Object.keys(conceptTrends.series).length === 0
            }
          >
            {conceptTrends && <ConceptTrendChart data={conceptTrends} />}
          </ChartCard>

          <ChartCard
            title={t("analytics.emerging_concepts")}
            isLoading={loadingConceptTrends}
            isEmpty={!conceptTrends}
          >
            {conceptTrends && <EmergingConceptsBadges data={conceptTrends} />}
          </ChartCard>
        </div>
      </section>
    </div>
  );
}
