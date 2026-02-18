import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  LabelList,
} from "recharts";

interface OutcomeFunnelChartProps {
  winCount: number;
  lossCount: number;
}

export function OutcomeFunnelChart({
  winCount,
  lossCount,
}: OutcomeFunnelChartProps) {
  const data = [
    {
      name: "Cases",
      win: winCount,
      loss: lossCount,
    },
  ];

  return (
    <ResponsiveContainer width="100%" height={72}>
      <BarChart data={data} layout="vertical" margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" hide />
        <Tooltip
          formatter={(value: number | string | undefined, name: string | undefined) => [
            Number(value ?? 0).toLocaleString(),
            name === "win" ? "Wins" : "Losses",
          ]}
          contentStyle={{
            backgroundColor: "var(--color-background-card)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius)",
          }}
        />
        <Bar dataKey="win" stackId="total" radius={[4, 0, 0, 4]}>
          <Cell fill="#1f8a4d" />
          <LabelList dataKey="win" position="insideLeft" fill="#ffffff" fontSize={11} />
        </Bar>
        <Bar dataKey="loss" stackId="total" radius={[0, 4, 4, 0]}>
          <Cell fill="#b64040" />
          <LabelList dataKey="loss" position="insideRight" fill="#ffffff" fontSize={11} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
