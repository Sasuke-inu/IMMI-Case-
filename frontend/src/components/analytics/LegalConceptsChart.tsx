import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import type { ConceptEntry } from "@/types/case"

interface LegalConceptsChartProps {
  data: ConceptEntry[]
}

export function LegalConceptsChart({ data }: LegalConceptsChartProps) {
  const chartData = data.map((c) => ({
    ...c,
    displayName: c.name.length > 30 ? c.name.slice(0, 28) + "\u2026" : c.name,
  }))

  return (
    <ResponsiveContainer width="100%" height={Math.max(280, chartData.length * 28)}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 170 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
          tickFormatter={(v: number) => v.toLocaleString()}
        />
        <YAxis
          type="category"
          dataKey="displayName"
          tick={{ fontSize: 10, fill: "var(--color-text-secondary)" }}
          width={165}
        />
        <Tooltip
          formatter={(value: number | undefined) => [Number(value ?? 0).toLocaleString(), "Cases"]}
          labelFormatter={(_: unknown, payload: ReadonlyArray<{ payload?: ConceptEntry }>) => {
            return payload?.[0]?.payload?.name ?? ""
          }}
          contentStyle={{
            backgroundColor: "var(--color-background-card)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius)",
            fontSize: 12,
          }}
        />
        <Bar dataKey="count" fill="#6c3483" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
