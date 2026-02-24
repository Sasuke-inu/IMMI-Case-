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
  const {
    data: outcomes,
    isLoading: loadingOutcomes,
    isError: isOutcomesError,
    error: outcomesError,
    refetch: refetchOutcomes,
  } = useOutcomes(filters);
  const {
    data: judgesData,
    isLoading: loadingJudges,
    isError: isJudgesError,
    error: judgesError,
    refetch: refetchJudges,
  } = useJudges(filters);
  const {
    data: conceptsData,
    isLoading: loadingConcepts,
    isError: isConceptsError,
    error: conceptsError,
    refetch: refetchConcepts,
  } = useLegalConcepts(filters);
  const {
    data: natureOutcome,
    isLoading: loadingHeatmap,
    isError: isHeatmapError,
    error: heatmapError,
    refetch: refetchHeatmap,
  } = useNatureOutcome(filters);

  const errorText = (error: unknown) =>
    error instanceof Error ? error.message : t("errors.unable_to_load_message");

  return (
    <section className="space-y-4" data-testid="outcome-analysis-section">
      <div>
        <h2 className="font-semibold text-foreground">
          {t("analytics.outcome_snapshot")}
        </h2>
        <p className="text-sm text-muted-text">
          {t("analytics.outcome_snapshot_desc")}
        </p>
      </div>

      <ChartCard
        title={t("analytics.outcome_rate_by_court")}
        isLoading={loadingOutcomes}
        isError={isOutcomesError}
        errorMessage={errorText(outcomesError)}
        onRetry={() => {
          void refetchOutcomes();
        }}
        isEmpty={!outcomes || Object.keys(outcomes.by_court).length === 0}
        emptyMessage={t("analytics.no_outcome_by_court_data")}
      >
        {outcomes && <OutcomeByCourtChart data={outcomes.by_court} />}
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title={t("analytics.affirmed_rate_trend")}
          isLoading={loadingOutcomes}
          isError={isOutcomesError}
          errorMessage={errorText(outcomesError)}
          onRetry={() => {
            void refetchOutcomes();
          }}
          isEmpty={!outcomes || Object.keys(outcomes.by_year).length === 0}
          emptyMessage={t("analytics.no_affirmed_trend_data")}
        >
          {outcomes && <OutcomeTrendChart data={outcomes.by_year} />}
        </ChartCard>

        <ChartCard
          title={t("analytics.affirmed_rate_visa")}
          isLoading={loadingOutcomes}
          isError={isOutcomesError}
          errorMessage={errorText(outcomesError)}
          onRetry={() => {
            void refetchOutcomes();
          }}
          isEmpty={!outcomes || Object.keys(outcomes.by_subclass).length === 0}
          emptyMessage={t("analytics.no_affirmed_subclass_data")}
        >
          {outcomes && <OutcomeBySubclassChart data={outcomes.by_subclass} />}
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title={t("analytics.active_judges")}
          isLoading={loadingJudges}
          isError={isJudgesError}
          errorMessage={errorText(judgesError)}
          onRetry={() => {
            void refetchJudges();
          }}
          isEmpty={!judgesData || judgesData.judges.length === 0}
          emptyMessage={t("analytics.no_active_judges_data")}
        >
          {judgesData && <TopJudgesChart data={judgesData.judges} />}
        </ChartCard>

        <ChartCard
          title={t("analytics.legal_concepts_frequency")}
          isLoading={loadingConcepts}
          isError={isConceptsError}
          errorMessage={errorText(conceptsError)}
          onRetry={() => {
            void refetchConcepts();
          }}
          isEmpty={!conceptsData || conceptsData.concepts.length === 0}
          emptyMessage={t("analytics.no_legal_concepts_data")}
        >
          {conceptsData && (
            <LegalConceptsChart data={conceptsData.concepts} />
          )}
        </ChartCard>
      </div>

      <ChartCard
        title={t("analytics.nature_outcome_matrix")}
        isLoading={loadingHeatmap}
        isError={isHeatmapError}
        errorMessage={errorText(heatmapError)}
        onRetry={() => {
          void refetchHeatmap();
        }}
        isEmpty={!natureOutcome || natureOutcome.natures.length === 0}
        emptyMessage={t("analytics.no_nature_outcome_matrix_data")}
      >
        {natureOutcome && <NatureOutcomeHeatmap data={natureOutcome} />}
      </ChartCard>
    </section>
  );
}

export const OutcomeAnalysisSection = memo(OutcomeAnalysisSectionInner);
