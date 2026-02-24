import { memo } from "react";
import { useTranslation } from "react-i18next";
import { ChartCard } from "./ChartCard";
import { ConceptEffectivenessChart } from "./ConceptEffectivenessChart";
import { ConceptCourtBreakdown } from "./ConceptCourtBreakdown";
import { ConceptCooccurrenceHeatmap } from "./ConceptCooccurrenceHeatmap";
import { ConceptTrendChart } from "./ConceptTrendChart";
import { EmergingConceptsBadges } from "./EmergingConceptsBadges";
import {
  useConceptEffectiveness,
  useConceptCooccurrence,
  useConceptTrends,
} from "@/hooks/use-analytics";
import type { AnalyticsFilterParams } from "@/types/case";

interface Props {
  filters: AnalyticsFilterParams;
}

function ConceptIntelligenceSectionInner({ filters }: Props) {
  const { t } = useTranslation();
  const {
    data: conceptEffectiveness,
    isLoading: loadingEffectiveness,
    isError: isEffectivenessError,
    error: effectivenessError,
    refetch: refetchEffectiveness,
  } = useConceptEffectiveness({ ...filters, limit: 30 });
  const {
    data: cooccurrence,
    isLoading: loadingCooccurrence,
    isError: isCooccurrenceError,
    error: cooccurrenceError,
    refetch: refetchCooccurrence,
  } = useConceptCooccurrence({ ...filters, limit: 15, min_count: 2 });
  const {
    data: conceptTrends,
    isLoading: loadingConceptTrends,
    isError: isConceptTrendsError,
    error: conceptTrendsError,
    refetch: refetchConceptTrends,
  } = useConceptTrends({ ...filters, limit: 10 });

  const errorText = (error: unknown) =>
    error instanceof Error ? error.message : t("errors.unable_to_load_message");

  return (
    <section className="space-y-4" data-testid="concept-intelligence-section">
      <div>
        <h2 className="font-semibold text-foreground">
          {t("analytics.concept_intelligence")}
        </h2>
        <p className="text-sm text-muted-text">
          {t("analytics.concept_intelligence_desc")}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title={t("analytics.concept_effectiveness")}
          isLoading={loadingEffectiveness}
          isError={isEffectivenessError}
          errorMessage={errorText(effectivenessError)}
          onRetry={() => {
            void refetchEffectiveness();
          }}
          isEmpty={
            !conceptEffectiveness || conceptEffectiveness.concepts.length === 0
          }
          emptyMessage={t("analytics.no_effectiveness_data")}
        >
          {conceptEffectiveness && (
            <ConceptEffectivenessChart data={conceptEffectiveness} />
          )}
        </ChartCard>

        <ChartCard
          title={t("analytics.concept_by_court")}
          isLoading={loadingEffectiveness}
          isError={isEffectivenessError}
          errorMessage={errorText(effectivenessError)}
          onRetry={() => {
            void refetchEffectiveness();
          }}
          isEmpty={
            !conceptEffectiveness || conceptEffectiveness.concepts.length === 0
          }
          emptyMessage={t("analytics.no_court_data")}
        >
          {conceptEffectiveness && (
            <ConceptCourtBreakdown data={conceptEffectiveness} />
          )}
        </ChartCard>
      </div>

      <ChartCard
        title={t("analytics.concept_cooccurrence")}
        isLoading={loadingCooccurrence}
        isError={isCooccurrenceError}
        errorMessage={errorText(cooccurrenceError)}
        onRetry={() => {
          void refetchCooccurrence();
        }}
        isEmpty={!cooccurrence || cooccurrence.concepts.length === 0}
        emptyMessage={t("analytics.no_cooccurrence_data")}
      >
        {cooccurrence && <ConceptCooccurrenceHeatmap data={cooccurrence} />}
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title={t("analytics.concept_trends")}
          isLoading={loadingConceptTrends}
          isError={isConceptTrendsError}
          errorMessage={errorText(conceptTrendsError)}
          onRetry={() => {
            void refetchConceptTrends();
          }}
          isEmpty={
            !conceptTrends || Object.keys(conceptTrends.series).length === 0
          }
          emptyMessage={t("analytics.no_trend_data")}
        >
          {conceptTrends && <ConceptTrendChart data={conceptTrends} />}
        </ChartCard>

        <ChartCard
          title={t("analytics.emerging_concepts")}
          isLoading={loadingConceptTrends}
          isError={isConceptTrendsError}
          errorMessage={errorText(conceptTrendsError)}
          onRetry={() => {
            void refetchConceptTrends();
          }}
          isEmpty={!conceptTrends}
          emptyMessage={t("analytics.no_concepts_detected")}
        >
          {conceptTrends && <EmergingConceptsBadges data={conceptTrends} />}
        </ChartCard>
      </div>
    </section>
  );
}

export const ConceptIntelligenceSection = memo(ConceptIntelligenceSectionInner);
