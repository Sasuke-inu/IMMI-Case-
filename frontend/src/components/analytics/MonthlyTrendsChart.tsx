import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

interface MonthlyEntry {
  month: string;
  total: number;
  wins: number;
  win_rate: number;
}

interface PolicyEvent {
  month: string;
  label: string;
}

interface MonthlyTrendsData {
  series: MonthlyEntry[];
  events: PolicyEvent[];
}

interface MonthlyTrendsChartProps {
  data: MonthlyTrendsData;
}

export function MonthlyTrendsChart({ data }: MonthlyTrendsChartProps) {
  if (!data.series.length) {
    return (
      <div data-testid="monthly-trends-chart" className="py-12 text-center text-muted-text">
        No monthly data available
      </div>
    );
  }

  return (
    <div data-testid="monthly-trends-chart" className="space-y-2">
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart
          data={data.series}
          margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border)"
            opacity={0.35}
          />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 10, fill: "var(--color-text-secondary)" }}
            interval="preserveStartEnd"
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 10, fill: "var(--color-text-secondary)" }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 10, fill: "var(--color-text-secondary)" }}
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-background-card)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius)",
              color: "var(--color-text)",
            }}
          />
          <Bar
            yAxisId="left"
            dataKey="total"
            fill="var(--color-primary)"
            fillOpacity={0.3}
            name="Cases"
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="win_rate"
            stroke="var(--color-accent)"
            strokeWidth={2}
            dot={false}
            name="Win Rate %"
          />
          {data.events.map((evt) => (
            <ReferenceLine
              key={evt.month}
              yAxisId="left"
              x={evt.month}
              stroke="var(--color-danger, #ef4444)"
              strokeDasharray="4 4"
              label={{
                value: evt.label,
                position: "top",
                fontSize: 10,
                fill: "var(--color-danger, #ef4444)",
              }}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>

      {data.events.length > 0 && (
        <div className="flex flex-wrap gap-3 text-xs text-muted-text">
          {data.events.map((evt) => (
            <span key={evt.month} className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
              <span className="font-medium">{evt.month}</span>
              <span>{evt.label}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
