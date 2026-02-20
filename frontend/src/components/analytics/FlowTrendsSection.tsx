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
  const { data: flowMatrix, isLoading: loadingFlowMatrix } =
    useFlowMatrix(filters);
  const { data: monthlyTrends, isLoading: loadingMonthlyTrends } =
    useMonthlyTrends(filters);

  return (
    <>
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
    </>
  );
}

export const FlowTrendsSection = memo(FlowTrendsSectionInner);
