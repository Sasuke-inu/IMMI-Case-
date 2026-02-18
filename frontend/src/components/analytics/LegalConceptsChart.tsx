import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { ConceptEntry } from "@/types/case";

interface LegalConceptsChartProps {
  data: ConceptEntry[];
}

export function LegalConceptsChart({ data }: LegalConceptsChartProps) {
  const chartData = data.slice(0, 12).map((c) => ({
    ...c,
    displayName: c.name.length > 18 ? c.name.slice(0, 16) + "\u2026" : c.name,
  }));

  return (
    <ResponsiveContainer width="100%" height={chartData.length * 38 + 35}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 0, right: 45, bottom: 0, left: 5 }}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="displayName"
          tick={{ fontSize: 12, fill: "var(--color-text-secondary)" }}
          width={120}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value: number | undefined) => [
            Number(value ?? 0).toLocaleString(),
            "Cases",
          ]}
          labelFormatter={(
            _: unknown,
            payload: ReadonlyArray<{ payload?: ConceptEntry }>,
          ) => payload?.[0]?.payload?.name ?? ""}
          contentStyle={{
            backgroundColor: "var(--color-background-card)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius)",
            fontSize: 12,
            padding: "8px 12px",
          }}
          itemStyle={{ fontSize: 12, padding: "1px 0" }}
          labelStyle={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}
        />
        <Bar
          dataKey="count"
          fill="#6c3483"
          radius={[0, 3, 3, 0]}
          maxBarSize={22}
          label={{
            position: "right",
            fontSize: 11,
            fill: "var(--color-text-secondary)",
            formatter: (v: unknown) => {
              const n = Number(v);
              return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
            },
          }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
