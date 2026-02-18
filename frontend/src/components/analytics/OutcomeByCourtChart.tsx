import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"

const OUTCOME_COLORS: Record<string, string> = {
  Affirmed: "#2d7d46",
  Dismissed: "#a83232",
  Remitted: "#2a6496",
  "Set Aside": "#6c3483",
  Allowed: "#117864",
  Refused: "#b9770e",
  Withdrawn: "#8b8680",
  Other: "#c0b8a8",
}

interface OutcomeByCourtChartProps {
  data: Record<string, Record<string, number>>
}

export function OutcomeByCourtChart({ data }: OutcomeByCourtChartProps) {
  // Collect all outcome labels
  const outcomeSet = new Set<string>()
  for (const outcomes of Object.values(data)) {
    for (const key of Object.keys(outcomes)) outcomeSet.add(key)
  }
  const outcomeLabels = [...outcomeSet].sort()

  // Build chart data: each row is a court, values are percentages
  const chartData = Object.entries(data).map(([court, outcomes]) => {
    const total = Object.values(outcomes).reduce((a, b) => a + b, 0)
    const row: Record<string, string | number> = { court }
    for (const label of outcomeLabels) {
      row[label] = total > 0 ? Math.round(((outcomes[label] ?? 0) / total) * 1000) / 10 : 0
    }
    return row
  })

  return (
    <ResponsiveContainer width="100%" height={Math.max(280, chartData.length * 36)}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 80 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis
          type="number"
          domain={[0, 100]}
          tickFormatter={(v: number) => `${v}%`}
          tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
        />
        <YAxis
          type="category"
          dataKey="court"
          tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
          width={75}
        />
        <Tooltip
          formatter={(value: number | undefined, name: string | undefined) => [`${Number(value ?? 0).toFixed(1)}%`, name ?? ""]}
          contentStyle={{
            backgroundColor: "var(--color-background-card)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius)",
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {outcomeLabels.map((label) => (
          <Bar
            key={label}
            dataKey={label}
            stackId="stack"
            fill={OUTCOME_COLORS[label] ?? "#8b8680"}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
