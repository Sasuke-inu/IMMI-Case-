import { useState, useMemo } from "react";
import { AnalyticsFilters } from "@/components/shared/AnalyticsFilters";
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
import {
  useOutcomes,
  useJudges,
  useLegalConcepts,
  useNatureOutcome,
  useConceptEffectiveness,
  useConceptCooccurrence,
  useConceptTrends,
} from "@/hooks/use-analytics";
import type { AnalyticsFilterParams } from "@/types/case";

const CURRENT_YEAR = new Date().getFullYear();

export function AnalyticsPage() {
  const [court, setCourt] = useState("");
  const [yearFrom, setYearFrom] = useState(2000);
  const [yearTo, setYearTo] = useState(CURRENT_YEAR);

  const filters: AnalyticsFilterParams = useMemo(
    () => ({ court: court || undefined, yearFrom, yearTo }),
    [court, yearFrom, yearTo],
  );

  const { data: outcomes, isLoading: loadingOutcomes } = useOutcomes(filters);
  const { data: judgesData, isLoading: loadingJudges } = useJudges(filters);
  const { data: conceptsData, isLoading: loadingConcepts } = useLegalConcepts(filters);
  const { data: natureOutcome, isLoading: loadingHeatmap } = useNatureOutcome(filters);

  const { data: conceptEffectiveness, isLoading: loadingEffectiveness } =
    useConceptEffectiveness({ ...filters, limit: 30 });
  const { data: cooccurrence, isLoading: loadingCooccurrence } = useConceptCooccurrence({
    ...filters,
    limit: 15,
    min_count: 2,
  });
  const { data: conceptTrends, isLoading: loadingConceptTrends } = useConceptTrends({
    ...filters,
    limit: 10,
  });

  const handleYearRangeChange = (from: number, to: number) => {
    setYearFrom(from);
    setYearTo(to);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Analytics & Insights</h1>
          <p className="text-sm text-muted-text">
            Cross-analysis of {court || "all"} court outcomes, trends, and patterns
          </p>
        </div>
        <AnalyticsFilters
          court={court}
          yearFrom={yearFrom}
          yearTo={yearTo}
          onCourtChange={setCourt}
          onYearRangeChange={handleYearRangeChange}
        />
      </div>

      <SuccessRateCalculator filters={filters} />

      <ChartCard
        title="Outcome Rate by Court"
        isLoading={loadingOutcomes}
        isEmpty={!outcomes || Object.keys(outcomes.by_court).length === 0}
      >
        {outcomes && <OutcomeByCourtChart data={outcomes.by_court} />}
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Affirmed Rate Trend"
          isLoading={loadingOutcomes}
          isEmpty={!outcomes || Object.keys(outcomes.by_year).length === 0}
        >
          {outcomes && <OutcomeTrendChart data={outcomes.by_year} />}
        </ChartCard>

        <ChartCard
          title="Affirmed Rate by Visa Subclass"
          isLoading={loadingOutcomes}
          isEmpty={!outcomes || Object.keys(outcomes.by_subclass).length === 0}
        >
          {outcomes && <OutcomeBySubclassChart data={outcomes.by_subclass} />}
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Most Active Judges / Members"
          isLoading={loadingJudges}
          isEmpty={!judgesData || judgesData.judges.length === 0}
        >
          {judgesData && <TopJudgesChart data={judgesData.judges} />}
        </ChartCard>

        <ChartCard
          title="Legal Concepts Frequency"
          isLoading={loadingConcepts}
          isEmpty={!conceptsData || conceptsData.concepts.length === 0}
        >
          {conceptsData && <LegalConceptsChart data={conceptsData.concepts} />}
        </ChartCard>
      </div>

      <ChartCard
        title="Case Nature × Outcome Matrix"
        isLoading={loadingHeatmap}
        isEmpty={!natureOutcome || natureOutcome.natures.length === 0}
      >
        {natureOutcome && <NatureOutcomeHeatmap data={natureOutcome} />}
      </ChartCard>

      <section className="space-y-4" data-testid="concept-intelligence-section">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Concept Intelligence</h2>
          <p className="text-sm text-muted-text">
            Identify legal concepts that correlate with better outcomes and how they evolve over time.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Concept Effectiveness"
            isLoading={loadingEffectiveness}
            isEmpty={!conceptEffectiveness || conceptEffectiveness.concepts.length === 0}
          >
            {conceptEffectiveness && <ConceptEffectivenessChart data={conceptEffectiveness} />}
          </ChartCard>

          <ChartCard
            title="Concept Effectiveness by Court"
            isLoading={loadingEffectiveness}
            isEmpty={!conceptEffectiveness || conceptEffectiveness.concepts.length === 0}
          >
            {conceptEffectiveness && <ConceptCourtBreakdown data={conceptEffectiveness} />}
          </ChartCard>
        </div>

        <ChartCard
          title="Concept Co-occurrence Heatmap"
          isLoading={loadingCooccurrence}
          isEmpty={!cooccurrence || cooccurrence.concepts.length === 0}
        >
          {cooccurrence && <ConceptCooccurrenceHeatmap data={cooccurrence} />}
        </ChartCard>

        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Concept Trends"
            isLoading={loadingConceptTrends}
            isEmpty={!conceptTrends || Object.keys(conceptTrends.series).length === 0}
          >
            {conceptTrends && <ConceptTrendChart data={conceptTrends} />}
          </ChartCard>

          <ChartCard
            title="Emerging / Declining Concepts"
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
