import { useTranslation } from "react-i18next";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { CountryBreakdownEntry } from "@/types/case";

interface CountryOriginChartProps {
  data: CountryBreakdownEntry[];
}

export function CountryOriginChart({ data }: CountryOriginChartProps) {
  const { t } = useTranslation();

  if (data.length < 3) return null;

  const chartData = data.slice(0, 15);

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 text-base font-semibold text-foreground">
        {t("judges.country_origin")}
      </h2>
      <ResponsiveContainer
        width="100%"
        height={Math.max(260, chartData.length * 28)}
      >
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border)"
            opacity={0.35}
            horizontal={false}
          />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
          />
          <YAxis
            dataKey="country"
            type="category"
            width={120}
            tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
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
            }}
          />
          <Bar
            dataKey="total"
            name={t("judges.cases")}
            fill="#64748b"
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-left uppercase tracking-wide text-muted-text">
              <th className="py-1.5 pr-2">{t("judges.country")}</th>
              <th className="py-1.5 pr-2 text-right">{t("judges.cases")}</th>
              <th className="py-1.5 text-right">{t("judges.win_rate")}</th>
            </tr>
          </thead>
          <tbody>
            {chartData.map((row) => (
              <tr key={row.country} className="border-b border-border-light/40">
                <td className="py-1.5 pr-2 text-foreground">{row.country}</td>
                <td className="py-1.5 pr-2 text-right text-secondary-text">
                  {row.total.toLocaleString()}
                </td>
                <td className="py-1.5 text-right">
                  <span
                    className={`font-medium ${
                      row.win_rate >= 50
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {row.win_rate.toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
