import { useTranslation } from "react-i18next";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

interface NatureBreakdownChartProps {
  data: Array<{ nature: string; total: number; win_rate: number }>;
}

export function NatureBreakdownChart({ data }: NatureBreakdownChartProps) {
  const { t } = useTranslation();

  if (!data.length) {
    return (
      <p className="text-sm text-muted-text">
        {t("judges.no_nature_data")}
      </p>
    );
  }

  const rows = data.slice(0, 15).map((item) => ({
    name: item.nature,
    winRate: item.win_rate,
    total: item.total,
  }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(rows.length * 32, 260)}>
      <BarChart
        data={rows}
        layout="vertical"
        margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
      >
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={120}
          tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value: number | string | undefined, key) => {
            const numeric = Number(value ?? 0);
            if (key === "winRate")
              return [`${numeric.toFixed(1)}%`, t("judges.win_rate")];
            return [String(value ?? 0), t("judges.cases")];
          }}
          contentStyle={{
            backgroundColor: "var(--color-background-card)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius)",
            color: "var(--color-text)",
          }}
        />
        <Bar dataKey="winRate" fill="#6c3483" radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
