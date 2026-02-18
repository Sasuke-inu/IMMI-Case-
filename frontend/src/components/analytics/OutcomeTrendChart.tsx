import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"

interface OutcomeTrendChartProps {
  data: Record<string, Record<string, number>>
}

export function OutcomeTrendChart({ data }: OutcomeTrendChartProps) {
  // Compute affirmed rate and applicant-win rate per year
  const chartData = Object.entries(data)
    .map(([yearStr, outcomes]) => {
      const total = Object.values(outcomes).reduce((a, b) => a + b, 0)
      const affirmed = outcomes["Affirmed"] ?? 0
      const setAside = outcomes["Set Aside"] ?? 0
      const remitted = outcomes["Remitted"] ?? 0
      const allowed = outcomes["Allowed"] ?? 0
      const applicantWin = setAside + remitted + allowed
      return {
        year: Number(yearStr),
        affirmedRate: total > 0 ? Math.round((affirmed / total) * 1000) / 10 : 0,
        applicantWinRate: total > 0 ? Math.round((applicantWin / total) * 1000) / 10 : 0,
        total,
      }
    })
    .filter((d) => d.total >= 10) // Skip years with very few cases
    .sort((a, b) => a.year - b.year)

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis
          dataKey="year"
          tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
          tickFormatter={(v: number) => String(v)}
        />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(v: number) => `${v}%`}
          tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
        />
        <Tooltip
          formatter={(value: number | undefined, name: string | undefined) => [`${Number(value ?? 0).toFixed(1)}%`, name ?? ""]}
          labelFormatter={(label: unknown) => `Year ${label}`}
          contentStyle={{
            backgroundColor: "var(--color-background-card)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius)",
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line
          type="monotone"
          dataKey="affirmedRate"
          name="Affirmed Rate"
          stroke="#2d7d46"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="applicantWinRate"
          name="Applicant Win Rate"
          stroke="#2a6496"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
