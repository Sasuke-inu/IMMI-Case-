import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
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
function transformToChartData(data: LineageData): Array<Record<string, number>> {
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
  const { t } = useTranslation();
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
            return (
              <div
                style={{
                  backgroundColor: "var(--color-background-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius)",
                  color: "var(--color-text)",
                  padding: "8px 12px",
                  fontSize: 12,
                }}
              >
                <p style={{ fontWeight: 600, marginBottom: 4 }}>
                  {t("filters.date")}: {label}
                </p>
                {nonZero.map((entry) => (
                  <p
                    key={entry.dataKey as string}
                    style={{ color: entry.color, margin: "2px 0" }}
                  >
                    {entry.name}: {Number(entry.value).toLocaleString()}
                  </p>
                ))}
              </div>
            );
          }}
        />
        <Legend
          verticalAlign="bottom"
          height={36}
          wrapperStyle={{ fontSize: 11, color: "var(--color-text-secondary)" }}
        />
        {courts.map((court) => (
          <Bar
            key={court}
            dataKey={court}
            stackId="stack"
            fill={courtColors[court] ?? "#8b8680"}
            cursor="pointer"
            onClick={(data) => {
              if (data && typeof data.year === "number") {
                handleBarClick(court, data.year);
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
