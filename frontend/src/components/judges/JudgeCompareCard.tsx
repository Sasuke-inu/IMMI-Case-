import { useTranslation } from "react-i18next";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { OUTCOME_COLORS, approvalBadgeClass } from "./constants";
import type { JudgeProfile } from "@/types/case";

interface JudgeCompareCardProps {
  judge: JudgeProfile;
}

export function JudgeCompareCard({ judge }: JudgeCompareCardProps) {
  const { t } = useTranslation();

  const first = judge.judge.active_years.first ?? "-";
  const last = judge.judge.active_years.last ?? "-";

  const outcomeRows = Object.entries(judge.outcome_distribution).map(
    ([outcome, count]) => ({ outcome, count }),
  );

  const topVisa = judge.visa_breakdown.slice(0, 5);

  return (
    <div className="flex flex-col rounded-lg border border-border bg-card">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-border-light/60 p-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {judge.judge.name}
          </h2>
          <p className="mt-0.5 text-xs text-muted-text">
            {judge.court_type} · {judge.judge.total_cases.toLocaleString()}{" "}
            {t("judges.cases")} · {first} – {last}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-sm px-2 py-0.5 text-sm font-semibold",
            approvalBadgeClass(judge.approval_rate),
          )}
        >
          {judge.approval_rate.toFixed(1)}%
        </span>
      </div>

      {/* Outcome Distribution */}
      <div className="border-b border-border-light/60 p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-text">
          {t("judges.outcome_distribution")}
        </p>
        {outcomeRows.length > 0 ? (
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={outcomeRows}
                dataKey="count"
                nameKey="outcome"
                outerRadius={60}
                innerRadius={30}
              >
                {outcomeRows.map((row, idx) => (
                  <Cell
                    key={row.outcome}
                    fill={OUTCOME_COLORS[idx % OUTCOME_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number | string | undefined) => [
                  Number(value ?? 0).toLocaleString(),
                  t("judges.cases"),
                ]}
                contentStyle={{
                  backgroundColor: "var(--color-background-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius)",
                  color: "var(--color-text)",
                  fontSize: 11,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-muted-text">
            {t("judges.no_outcome_data")}
          </p>
        )}
      </div>

      {/* Top Visa Subclasses */}
      <div className="border-b border-border-light/60 p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-text">
          {t("judges.top_visa_subclasses")}
        </p>
        {topVisa.length > 0 ? (
          <ResponsiveContainer width="100%" height={120}>
            <BarChart
              data={topVisa}
              layout="vertical"
              margin={{ top: 0, right: 30, left: 0, bottom: 0 }}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="subclass"
                width={60}
                tick={{ fontSize: 10, fill: "var(--color-text-secondary)" }}
              />
              <Tooltip
                formatter={(value: number | string | undefined) => [
                  Number(value ?? 0).toLocaleString(),
                  t("judges.cases"),
                ]}
                contentStyle={{
                  backgroundColor: "var(--color-background-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius)",
                  color: "var(--color-text)",
                  fontSize: 11,
                }}
              />
              <Bar dataKey="total" fill="#1a5276" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-muted-text">
            {t("judges.no_visa_subclass_data")}
          </p>
        )}
      </div>

      {/* Yearly Trend Sparkline */}
      <div className="p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-text">
          {t("judges.yearly_approval_trend")}
        </p>
        {judge.yearly_trend.length > 0 ? (
          <ResponsiveContainer width="100%" height={100}>
            <AreaChart
              data={judge.yearly_trend}
              margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
            >
              <XAxis
                dataKey="year"
                tick={{ fontSize: 9, fill: "var(--color-text-secondary)" }}
              />
              <YAxis hide />
              <Tooltip
                formatter={(value: number | string | undefined) => [
                  `${Number(value ?? 0).toFixed(1)}%`,
                  t("judges.approval_rate"),
                ]}
                contentStyle={{
                  backgroundColor: "var(--color-background-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius)",
                  color: "var(--color-text)",
                  fontSize: 11,
                }}
              />
              <Area
                type="monotone"
                dataKey="approval_rate"
                stroke="#2d7d46"
                fill="#2d7d4630"
                strokeWidth={1.5}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-muted-text">{t("judges.no_trend_data")}</p>
        )}
      </div>
    </div>
  );
}
