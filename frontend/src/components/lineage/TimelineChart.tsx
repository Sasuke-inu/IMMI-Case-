import { memo, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { LineageData } from "@/lib/lineage-data";
import { courtColors } from "@/tokens/tokens";

// All 9 courts in order of priority
const ALL_COURTS = [
  "MRTA",
  "RRTA",
  "AATA",
  "ARTA",
  "FMCA",
  "FCCA",
  "FedCFamC2G",
  "FCA",
  "HCA",
];

interface TimelineChartProps {
  data: LineageData;
}

/**
 * Transform LineageData into Recharts format:
 * [
 *   { year: 2000, FMCA: 100, MRTA: 50, ... },
 *   { year: 2001, FMCA: 120, MRTA: 60, ... },
 *   ...
 * ]
 */
function transformToChartData(
  data: LineageData,
): Array<Record<string, number>> {
  const yearMap = new Map<number, Record<string, number>>();

  // Extract all case counts by year from all courts
  for (const lineage of data.lineages) {
    for (const court of lineage.courts) {
      for (const [yearStr, count] of Object.entries(court.case_count_by_year)) {
        const year = parseInt(yearStr, 10);
        if (!yearMap.has(year)) {
          yearMap.set(year, { year });
        }
        const entry = yearMap.get(year)!;
        entry[court.code] = count;
      }
    }
  }

  // Convert to array and sort by year
  return Array.from(yearMap.values()).sort((a, b) => a.year - b.year);
}

function TimelineChartInner({ data }: TimelineChartProps) {
  const navigate = useNavigate();

  const chartData = useMemo(() => transformToChartData(data), [data]);

  if (!chartData || chartData.length === 0) return null;

  // Discover which courts appear in the data
  const courtSet = new Set<string>();
  for (const entry of chartData) {
    for (const key of Object.keys(entry)) {
      if (key !== "year") courtSet.add(key);
    }
  }

  // Order courts by ALL_COURTS preference
  const courts = ALL_COURTS.filter((c) => courtSet.has(c));

  // Handle click on bar segment
  const handleBarClick = (courtCode: string, year: number) => {
    navigate(`/cases?court=${courtCode}&year=${year}`);
  };

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart
        data={chartData}
        margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis
          dataKey="year"
          tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
          tickFormatter={(v: number) => String(v)}
        />
        <YAxis tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }} />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload) return null;
            const nonZero = payload.filter(
              (p) => typeof p.value === "number" && p.value > 0,
            );
            if (nonZero.length === 0) return null;
            const total = nonZero.reduce((s, p) => s + Number(p.value), 0);
            return (
              <div
                style={{
                  backgroundColor: "var(--color-background-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius)",
                  color: "var(--color-text)",
                  padding: "10px 14px",
                  fontSize: 12,
                  minWidth: 160,
                }}
              >
                <p style={{ fontWeight: 700, marginBottom: 6 }}>{label}</p>
                {nonZero.map((entry) => (
                  <div
                    key={entry.dataKey as string}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      margin: "2px 0",
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 2,
                        backgroundColor: entry.color as string,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontFamily: "monospace",
                        color: entry.color as string,
                      }}
                    >
                      {entry.name}
                    </span>
                    <span
                      style={{
                        marginLeft: "auto",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {Number(entry.value).toLocaleString()}
                    </span>
                  </div>
                ))}
                {nonZero.length > 1 && (
                  <div
                    style={{
                      marginTop: 6,
                      paddingTop: 6,
                      borderTop: "1px solid var(--color-border)",
                      fontWeight: 600,
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>Total</span>
                    <span>{total.toLocaleString()}</span>
                  </div>
                )}
              </div>
            );
          }}
        />
        {courts.map((court) => (
          <Bar
            key={court}
            dataKey={court}
            stackId="stack"
            fill={courtColors[court] ?? "#8b8680"}
            cursor="pointer"
            onClick={(data: unknown) => {
              const d = data as Record<string, unknown>;
              if (d && typeof d.year === "number") {
                handleBarClick(court, d.year);
              }
            }}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${court}-${index}`}
                style={{ cursor: entry[court] ? "pointer" : "default" }}
              />
            ))}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export const TimelineChart = memo(TimelineChartInner);
