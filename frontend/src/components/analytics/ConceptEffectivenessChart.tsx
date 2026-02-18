import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";
import type { ConceptEffectivenessData } from "@/types/case";

interface ConceptEffectivenessChartProps {
  data: ConceptEffectivenessData;
}

export function ConceptEffectivenessChart({ data }: ConceptEffectivenessChartProps) {
  const chartData = data.concepts.slice(0, 12).map((item) => ({
    name: item.name,
    liftDelta: Number((item.lift - 1).toFixed(2)),
    winRate: item.win_rate,
    total: item.total,
  }));

  if (!chartData.length) {
    return <p className="text-sm text-muted-text">No concept effectiveness data.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(chartData.length * 32, 260)}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
          tickFormatter={(v) => `${v > 0 ? "+" : ""}${v.toFixed(2)}`}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={140}
          tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value: number | string | undefined, key) => {
            const numeric = Number(value ?? 0);
            if (key === "liftDelta") return [numeric.toFixed(2), "Lift delta"];
            return [String(value ?? 0), "Value"];
          }}
          labelFormatter={(label) => String(label)}
          contentStyle={{
            backgroundColor: "var(--color-background-card)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius)",
          }}
        />
        <Bar dataKey="liftDelta" radius={[3, 3, 3, 3]}>
          {chartData.map((entry) => (
            <Cell key={entry.name} fill={entry.liftDelta >= 0 ? "#1f8a4d" : "#b64040"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
