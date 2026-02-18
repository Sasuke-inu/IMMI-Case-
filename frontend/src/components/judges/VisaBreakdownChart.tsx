import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

interface VisaBreakdownChartProps {
  data: Array<{ subclass: string; total: number; win_rate: number }>;
}

export function VisaBreakdownChart({ data }: VisaBreakdownChartProps) {
  if (!data.length) {
    return <p className="text-sm text-muted-text">No visa subclass data for this judge.</p>;
  }

  const rows = data.slice(0, 12).map((item) => ({
    name: item.subclass,
    winRate: item.win_rate,
    total: item.total,
  }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(rows.length * 32, 260)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <XAxis type="number" tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }} />
        <YAxis
          type="category"
          dataKey="name"
          width={90}
          tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value: number | string | undefined, key) => {
            const numeric = Number(value ?? 0);
            if (key === "winRate") return [`${numeric.toFixed(1)}%`, "Win Rate"];
            return [String(value ?? 0), "Cases"];
          }}
          contentStyle={{
            backgroundColor: "var(--color-background-card)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius)",
          }}
        />
        <Bar dataKey="winRate" fill="#1a5276" radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
