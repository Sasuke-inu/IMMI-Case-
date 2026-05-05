import { useTranslation } from "react-i18next";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  LabelList,
  ReferenceLine,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "@/components/shared/ChartTooltip";
import { cn } from "@/lib/utils";
import { formatCourtTypeLabel } from "@/lib/display";
import { OUTCOME_COLORS, approvalBadgeClass } from "./constants";
import type { JudgeProfile } from "@/types/case";

interface JudgeCompareCardProps {
  judge: JudgeProfile;
}

function formatVisaSubclass(raw: string): string {
  const value = raw.trim();
  if (!value) return raw;
  const num = Number(value);
  if (Number.isFinite(num) && Number.isInteger(num)) {
    return String(num);
  }
  return value;
}

export function JudgeCompareCard({ judge }: JudgeCompareCardProps) {
  const { t } = useTranslation();
  const courtTypeLabel = formatCourtTypeLabel(judge.court_type, t);

  const first = judge.judge.active_years.first ?? "-";
  const last = judge.judge.active_years.last ?? "-";

  const outcomeRows = Object.entries(judge.outcome_distribution)
    .map(([outcome, count]) => ({ outcome, count }))
    .sort((a, b) => b.count - a.count);
  const totalOutcomeCases = outcomeRows.reduce((sum, row) => sum + row.count, 0);
  const topOutcome = outcomeRows[0];
  const topOutcomeShare =
    topOutcome && totalOutcomeCases > 0
      ? (topOutcome.count / totalOutcomeCases) * 100
      : 0;

  const topVisa = judge.visa_breakdown.slice(0, 5).map((row) => ({
    ...row,
    subclass_label: formatVisaSubclass(row.subclass),
  }));
  const topVisaRow = topVisa[0];
  const topVisaShare =
    topVisaRow && judge.judge.total_cases > 0
      ? (topVisaRow.total / judge.judge.total_cases) * 100
      : 0;
  const visaChartHeight = Math.max(140, topVisa.length * 28 + 20);

  const trendRates = judge.yearly_trend.map((point) => point.approval_rate);
  const trendMin = trendRates.length > 0 ? Math.min(...trendRates) : 0;
  const trendMax = trendRates.length > 0 ? Math.max(...trendRates) : 0;
  const trendSpan = Math.max(2, trendMax - trendMin);
  const trendPadding = Math.max(1, trendSpan * 0.2);
  const trendAxisMin = Math.max(0, Math.floor((trendMin - trendPadding) / 5) * 5);
  const trendAxisMax = Math.min(100, Math.ceil((trendMax + trendPadding) / 5) * 5);
  const trendAverage =
    trendRates.length > 0
      ? trendRates.reduce((sum, rate) => sum + rate, 0) / trendRates.length
      : 0;

  const trendStart = judge.yearly_trend[0];
  const trendEnd = judge.yearly_trend[judge.yearly_trend.length - 1];
  const trendDelta =
    trendStart && trendEnd
      ? Number((trendEnd.approval_rate - trendStart.approval_rate).toFixed(1))
      : null;
  const trendDeltaLabel =
    trendDelta === null
      ? null
      : `${trendDelta >= 0 ? "+" : ""}${trendDelta.toFixed(1)}`;

  return (
    <div className="flex flex-col rounded-lg border border-border bg-card">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-border-light/60 p-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {judge.judge.name}
          </h2>
          <p className="mt-0.5 text-xs text-muted-text">
            {courtTypeLabel} · {judge.judge.total_cases.toLocaleString()}{" "}
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
        {topOutcome && (
          <p className="mb-2 text-[11px] text-muted-text">
            {t("judges.outcome_lead_summary", {
              defaultValue:
                "Leading outcome: {{outcome}} ({{cases}} cases, {{share}}%)",
              outcome: topOutcome.outcome,
              cases: topOutcome.count.toLocaleString(),
              share: topOutcomeShare.toFixed(1),
            })}
          </p>
        )}
        {outcomeRows.length > 0 ? (
          <ResponsiveContainer width="100%" height={176}>
            <PieChart>
              <Pie
                data={outcomeRows}
                dataKey="count"
                nameKey="outcome"
                outerRadius={64}
                innerRadius={34}
                paddingAngle={outcomeRows.length > 1 ? 1 : 0}
                label={({ percent }) =>
                  typeof percent === "number" && percent >= 0.18
                    ? `${(percent * 100).toFixed(0)}%`
                    : ""
                }
                labelLine={false}
              >
                {outcomeRows.map((row, idx) => (
                  <Cell
                    key={row.outcome}
                    fill={OUTCOME_COLORS[idx % OUTCOME_COLORS.length]}
                  />
                ))}
              </Pie>
              <ChartTooltip
                formatter={(
                  value: number | string | undefined,
                  name: string | number | undefined,
                ) => {
                  const count = Number(value ?? 0);
                  const pct =
                    totalOutcomeCases > 0
                      ? ((count / totalOutcomeCases) * 100).toFixed(1)
                      : "0.0";
                  return [
                    `${count.toLocaleString()} (${pct}%)`,
                    String(
                      name ||
                        t("components.badges.outcome", {
                          defaultValue: "Outcome",
                        }),
                    ),
                  ];
                }}
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
        {outcomeRows.length > 0 && (
          <div className="mt-2 grid gap-1 text-[11px] text-muted-text sm:grid-cols-2">
            {outcomeRows.slice(0, 6).map((row, idx) => {
              const pct =
                totalOutcomeCases > 0
                  ? ((row.count / totalOutcomeCases) * 100).toFixed(1)
                  : "0.0";
              return (
                <div
                  key={row.outcome}
                  className="flex items-center justify-between gap-2 rounded-sm border border-border-light/40 px-2 py-1"
                >
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          OUTCOME_COLORS[idx % OUTCOME_COLORS.length],
                      }}
                    />
                    <span className="truncate">{row.outcome}</span>
                  </span>
                  <span className="shrink-0">
                    {row.count.toLocaleString()} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Top Visa Subclasses */}
      <div className="border-b border-border-light/60 p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-text">
          {t("judges.top_visa_subclasses")}
        </p>
        {topVisaRow && (
          <p className="mb-2 text-[11px] text-muted-text">
            {t("judges.visa_lead_summary", {
              defaultValue:
                "Top subclass {{subclass}}: {{cases}} cases ({{share}}% of this judge's caseload)",
              subclass: topVisaRow.subclass_label,
              cases: topVisaRow.total.toLocaleString(),
              share: topVisaShare.toFixed(1),
            })}
          </p>
        )}
        {topVisa.length > 0 ? (
          <ResponsiveContainer width="100%" height={visaChartHeight}>
            <BarChart
              data={topVisa}
              layout="vertical"
              margin={{ top: 2, right: 40, left: 6, bottom: 2 }}
            >
              <CartesianGrid
                horizontal={false}
                stroke="var(--color-border)"
                strokeDasharray="3 3"
                opacity={0.4}
              />
              <XAxis
                type="number"
                tick={{ fontSize: 10, fill: "var(--color-text-secondary)" }}
                tickFormatter={(value) => Number(value ?? 0).toLocaleString()}
              />
              <YAxis
                type="category"
                dataKey="subclass_label"
                width={68}
                tick={{ fontSize: 10, fill: "var(--color-text-secondary)" }}
              />
              <ChartTooltip
                cursor={false}
                formatter={(value: number | string | undefined) => [
                  Number(value ?? 0).toLocaleString(),
                  t("judges.cases"),
                ]}
                labelFormatter={(label) =>
                  `${t("components.badges.visa_subclass", {
                    defaultValue: "Visa Subclass",
                  })}: ${String(label)}`
                }
                contentStyle={{
                  backgroundColor: "var(--color-background-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius)",
                  color: "var(--color-text)",
                  fontSize: 11,
                }}
              />
              <Bar dataKey="total" fill="#1a5276" radius={[0, 4, 4, 0]}>
                <LabelList
                  dataKey="total"
                  position="right"
                  offset={8}
                  formatter={(value: unknown) =>
                    Number(value ?? 0).toLocaleString()
                  }
                  style={{
                    fill: "var(--color-text-secondary)",
                    fontSize: 10,
                  }}
                />
              </Bar>
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
        {judge.yearly_trend.length > 1 && (
          <p className="mb-2 text-[11px] text-muted-text">
            {t("judges.trend_average_line", {
              defaultValue: "Dashed line = period average ({{avg}}%)",
              avg: trendAverage.toFixed(1),
            })}
          </p>
        )}
        {judge.yearly_trend.length > 0 ? (
          <ResponsiveContainer width="100%" height={130}>
            <AreaChart
              data={judge.yearly_trend}
              margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                stroke="var(--color-border)"
                strokeDasharray="3 3"
                opacity={0.4}
              />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 9, fill: "var(--color-text-secondary)" }}
                minTickGap={16}
              />
              <YAxis
                width={38}
                domain={[trendAxisMin, trendAxisMax]}
                tick={{ fontSize: 9, fill: "var(--color-text-secondary)" }}
                tickFormatter={(value) => `${Number(value ?? 0).toFixed(0)}%`}
              />
              <ChartTooltip
                labelFormatter={(label, payload) => {
                  const row = payload?.[0]?.payload as
                    | { total?: number }
                    | undefined;
                  const total = Number(row?.total ?? 0).toLocaleString();
                  return `${String(label)} · ${total} ${t("judges.cases")}`;
                }}
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
              <ReferenceLine
                y={trendAverage}
                stroke="var(--color-border)"
                strokeDasharray="4 4"
                ifOverflow="extendDomain"
              />
              <Area
                type="monotone"
                dataKey="approval_rate"
                stroke="#2d7d46"
                fill="#2d7d4630"
                strokeWidth={1.75}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-muted-text">{t("judges.no_trend_data")}</p>
        )}
        {trendStart && trendEnd && trendDeltaLabel && (
          <p className="mt-2 text-[11px] text-muted-text">
            {t("judges.trend_period_summary", {
              defaultValue:
                "{{fromYear}}→{{toYear}}: {{fromRate}}% → {{toRate}}% ({{delta}} pp)",
              fromYear: trendStart.year,
              toYear: trendEnd.year,
              fromRate: trendStart.approval_rate.toFixed(1),
              toRate: trendEnd.approval_rate.toFixed(1),
              delta: trendDeltaLabel,
            })}
          </p>
        )}
      </div>
    </div>
  );
}
