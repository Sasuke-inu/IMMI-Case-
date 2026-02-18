import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import type { ConceptEffectivenessData } from "@/types/case";

interface ConceptCourtBreakdownProps {
  data: ConceptEffectivenessData;
}

export function ConceptCourtBreakdown({ data }: ConceptCourtBreakdownProps) {
  const concepts = data.concepts.slice(0, 8);
  const courts = Array.from(
    new Set(concepts.flatMap((concept) => Object.keys(concept.by_court))),
  ).slice(0, 4);

  const rows = concepts.map((concept) => {
    const row: Record<string, string | number> = { name: concept.name };
    courts.forEach((court) => {
      row[court] = concept.by_court[court]?.win_rate ?? 0;
    });
    return row;
  });

  if (!rows.length || !courts.length) {
    return <p className="text-sm text-muted-text">Not enough court-specific concept data.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(rows.length * 38, 260)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 10, left: 20, bottom: 0 }}>
        <XAxis type="number" tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }} />
        <YAxis
          type="category"
          dataKey="name"
          width={140}
          tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value: number | string | undefined) => [
            `${Number(value ?? 0).toFixed(1)}%`,
            "Win Rate",
          ]}
          contentStyle={{
            backgroundColor: "var(--color-background-card)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius)",
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {courts.map((court, idx) => (
          <Bar
            key={court}
            dataKey={court}
            fill={["#1a5276", "#2d7d46", "#6c3483", "#b9770e"][idx % 4]}
            radius={[2, 2, 2, 2]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
