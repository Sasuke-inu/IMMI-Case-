import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import type { JudgeEntry } from "@/types/case"

interface TopJudgesChartProps {
  data: JudgeEntry[]
}

export function TopJudgesChart({ data }: TopJudgesChartProps) {
  // Truncate long names for display
  const chartData = data.map((j) => ({
    ...j,
    displayName: j.name.length > 25 ? j.name.slice(0, 23) + "\u2026" : j.name,
  }))

  return (
    <ResponsiveContainer width="100%" height={Math.max(280, chartData.length * 28)}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 140 }}>
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
          width={135}
        />
        <Tooltip
          formatter={(value: number | undefined) => [Number(value ?? 0).toLocaleString(), "Cases"]}
          labelFormatter={(_: unknown, payload: ReadonlyArray<{ payload?: JudgeEntry }>) => {
            const judge = payload?.[0]?.payload
            if (!judge) return ""
            return `${judge.name} (${judge.courts.join(", ")})`
          }}
          contentStyle={{
            backgroundColor: "var(--color-background-card)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius)",
            fontSize: 12,
          }}
        />
        <Bar dataKey="count" fill="#1a5276" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
