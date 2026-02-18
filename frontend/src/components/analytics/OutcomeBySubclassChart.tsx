import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"

interface OutcomeBySubclassChartProps {
  data: Record<string, Record<string, number>>
  limit?: number
}

export function OutcomeBySubclassChart({ data, limit = 15 }: OutcomeBySubclassChartProps) {
  // Compute affirmed rate per subclass and sort by total volume
  const chartData = Object.entries(data)
    .map(([subclass, outcomes]) => {
      const total = Object.values(outcomes).reduce((a, b) => a + b, 0)
      const affirmed = outcomes["Affirmed"] ?? 0
      return {
        subclass,
        affirmedRate: total > 0 ? Math.round((affirmed / total) * 1000) / 10 : 0,
        total,
      }
    })
    .filter((d) => d.total >= 20)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)

  const getBarColor = (rate: number) => {
    if (rate >= 55) return "#2d7d46" // High affirm = green (govt wins)
    if (rate >= 35) return "#b9770e" // Medium = amber
    return "#a83232" // Low affirm = red (applicant wins more)
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(280, chartData.length * 28)}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 55 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis
          type="number"
          domain={[0, 100]}
          tickFormatter={(v: number) => `${v}%`}
          tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
        />
        <YAxis
          type="category"
          dataKey="subclass"
          tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
          width={50}
        />
        <Tooltip
          formatter={(value: number | undefined) => [`${Number(value ?? 0).toFixed(1)}%`, "Affirmed Rate"]}
          labelFormatter={(label: unknown) => `Subclass ${label}`}
          contentStyle={{
            backgroundColor: "var(--color-background-card)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius)",
            fontSize: 12,
          }}
        />
        <Bar dataKey="affirmedRate" name="Affirmed Rate">
          {chartData.map((entry) => (
            <Cell key={entry.subclass} fill={getBarColor(entry.affirmedRate)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
