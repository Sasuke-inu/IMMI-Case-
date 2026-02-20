import { memo } from "react";
import { useTranslation } from "react-i18next";
import { ChartCard } from "./ChartCard";
import { OutcomeByCourtChart } from "./OutcomeByCourtChart";
import { OutcomeTrendChart } from "./OutcomeTrendChart";
import { OutcomeBySubclassChart } from "./OutcomeBySubclassChart";
import { TopJudgesChart } from "./TopJudgesChart";
import { LegalConceptsChart } from "./LegalConceptsChart";
import { NatureOutcomeHeatmap } from "./NatureOutcomeHeatmap";
import {
  useOutcomes,
  useJudges,
  useLegalConcepts,
  useNatureOutcome,
} from "@/hooks/use-analytics";
import type { AnalyticsFilterParams } from "@/types/case";

interface Props {
  filters: AnalyticsFilterParams;
}

function OutcomeAnalysisSectionInner({ filters }: Props) {
  const { t } = useTranslation();
  const { data: outcomes, isLoading: loadingOutcomes } = useOutcomes(filters);
  const { data: judgesData, isLoading: loadingJudges } = useJudges(filters);
  const { data: conceptsData, isLoading: loadingConcepts } =
    useLegalConcepts(filters);
  const { data: natureOutcome, isLoading: loadingHeatmap } =
    useNatureOutcome(filters);

  return (
    <>
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
          {conceptsData && (
            <LegalConceptsChart data={conceptsData.concepts} />
          )}
        </ChartCard>
      </div>

      <ChartCard
        title={t("analytics.nature_outcome_matrix")}
        isLoading={loadingHeatmap}
        isEmpty={!natureOutcome || natureOutcome.natures.length === 0}
      >
        {natureOutcome && <NatureOutcomeHeatmap data={natureOutcome} />}
      </ChartCard>
    </>
  );
}

export const OutcomeAnalysisSection = memo(OutcomeAnalysisSectionInner);
