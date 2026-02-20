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
  const { data: conceptEffectiveness, isLoading: loadingEffectiveness } =
    useConceptEffectiveness({ ...filters, limit: 30 });
  const { data: cooccurrence, isLoading: loadingCooccurrence } =
    useConceptCooccurrence({ ...filters, limit: 15, min_count: 2 });
  const { data: conceptTrends, isLoading: loadingConceptTrends } =
    useConceptTrends({ ...filters, limit: 10 });

  return (
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
  );
}

export const ConceptIntelligenceSection = memo(
  ConceptIntelligenceSectionInner,
);
