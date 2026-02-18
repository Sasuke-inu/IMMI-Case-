import { useState, useMemo } from "react"
import { AnalyticsFilters } from "@/components/shared/AnalyticsFilters"
import { ChartCard } from "@/components/analytics/ChartCard"
import { OutcomeByCourtChart } from "@/components/analytics/OutcomeByCourtChart"
import { OutcomeTrendChart } from "@/components/analytics/OutcomeTrendChart"
import { OutcomeBySubclassChart } from "@/components/analytics/OutcomeBySubclassChart"
import { TopJudgesChart } from "@/components/analytics/TopJudgesChart"
import { LegalConceptsChart } from "@/components/analytics/LegalConceptsChart"
import { NatureOutcomeHeatmap } from "@/components/analytics/NatureOutcomeHeatmap"
import {
  useOutcomes,
  useJudges,
  useLegalConcepts,
  useNatureOutcome,
} from "@/hooks/use-analytics"
import type { AnalyticsFilterParams } from "@/types/case"

const CURRENT_YEAR = new Date().getFullYear()

export function AnalyticsPage() {
  const [court, setCourt] = useState("")
  const [yearFrom, setYearFrom] = useState(2000)
  const [yearTo, setYearTo] = useState(CURRENT_YEAR)

  const filters: AnalyticsFilterParams = useMemo(
    () => ({ court: court || undefined, yearFrom, yearTo }),
    [court, yearFrom, yearTo]
  )

  const { data: outcomes, isLoading: loadingOutcomes } = useOutcomes(filters)
  const { data: judgesData, isLoading: loadingJudges } = useJudges(filters)
  const { data: conceptsData, isLoading: loadingConcepts } = useLegalConcepts(filters)
  const { data: natureOutcome, isLoading: loadingHeatmap } = useNatureOutcome(filters)

  const handleYearRangeChange = (from: number, to: number) => {
    setYearFrom(from)
    setYearTo(to)
  }

  return (
    <div className="space-y-6">
      {/* Header + Filters */}
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

      {/* Row 1: Outcome Rate by Court (full width) */}
      <ChartCard
        title="Outcome Rate by Court"
        isLoading={loadingOutcomes}
        isEmpty={!outcomes || Object.keys(outcomes.by_court).length === 0}
      >
        {outcomes && <OutcomeByCourtChart data={outcomes.by_court} />}
      </ChartCard>

      {/* Row 2: Affirmed Rate Trend + Outcome by Visa Subclass */}
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

      {/* Row 3: Top Judges + Legal Concepts */}
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

      {/* Row 4: Nature x Outcome Heatmap (full width) */}
      <ChartCard
        title="Case Nature \u00d7 Outcome Matrix"
        isLoading={loadingHeatmap}
        isEmpty={!natureOutcome || natureOutcome.natures.length === 0}
      >
        {natureOutcome && <NatureOutcomeHeatmap data={natureOutcome} />}
      </ChartCard>
    </div>
  )
}
