import { memo } from "react";
import { useTranslation } from "react-i18next";
import { ChartCard } from "./ChartCard";
import { FlowSankeyChart } from "./FlowSankeyChart";
import { MonthlyTrendsChart } from "./MonthlyTrendsChart";
import { useFlowMatrix, useMonthlyTrends } from "@/hooks/use-analytics";
import type { AnalyticsFilterParams } from "@/types/case";

interface Props {
  filters: AnalyticsFilterParams;
}

function FlowTrendsSectionInner({ filters }: Props) {
  const { t } = useTranslation();
  const {
    data: flowMatrix,
    isLoading: loadingFlowMatrix,
    isError: isFlowError,
    error: flowError,
    refetch: refetchFlow,
  } = useFlowMatrix(filters);
  const {
    data: monthlyTrends,
    isLoading: loadingMonthlyTrends,
    isError: isMonthlyError,
    error: monthlyError,
    refetch: refetchMonthly,
  } = useMonthlyTrends(filters);

  const errorText = (error: unknown) =>
    error instanceof Error ? error.message : t("errors.unable_to_load_message");

  return (
    <section className="space-y-4" data-testid="flow-trends-section">
      <div>
        <h2 className="font-semibold text-foreground">
          {t("analytics.flow_timing_analysis")}
        </h2>
        <p className="text-sm text-muted-text">
          {t("analytics.flow_timing_analysis_desc")}
        </p>
      </div>

      <ChartCard
        title={t("analytics.flow_sankey")}
        isLoading={loadingFlowMatrix}
        isError={isFlowError}
        errorMessage={errorText(flowError)}
        onRetry={() => {
          void refetchFlow();
        }}
        isEmpty={!flowMatrix || flowMatrix.nodes.length === 0}
        emptyMessage={t("analytics.no_flow_data")}
      >
        {flowMatrix && <FlowSankeyChart data={flowMatrix} />}
      </ChartCard>

      <ChartCard
        title={t("analytics.monthly_trends")}
        isLoading={loadingMonthlyTrends}
        isError={isMonthlyError}
        errorMessage={errorText(monthlyError)}
        onRetry={() => {
          void refetchMonthly();
        }}
        isEmpty={!monthlyTrends || monthlyTrends.series.length === 0}
        emptyMessage={t("analytics.no_monthly_trend_data")}
      >
        {monthlyTrends && <MonthlyTrendsChart data={monthlyTrends} />}
      </ChartCard>
    </section>
  );
}

export const FlowTrendsSection = memo(FlowTrendsSectionInner);
