/**
 * Pure transform functions for court lineage data.
 * Used by CourtLineagePage and its child components for filtering,
 * normalization, and statistical calculations.
 */
import type { LineageData, CourtMetadata } from "@/lib/lineage-data";

// ── Court group definitions ─────────────────────────────────────

export type CourtGroup = "all" | "lower-court" | "tribunal" | "independent";

const COURT_GROUPS: Record<Exclude<CourtGroup, "all">, readonly string[]> = {
  "lower-court": ["FMCA", "FCCA", "FedCFamC2G"],
  tribunal: ["MRTA", "RRTA", "AATA", "ARTA"],
  independent: ["FCA", "HCA"],
};

/** Transition years where one court/tribunal replaced another */
export const TRANSITION_YEARS = [
  { year: 2013, label: "FMCA→FCCA" },
  { year: 2015, label: "MRTA/RRTA→AATA" },
  { year: 2021, label: "FCCA→FedCFamC2G" },
  { year: 2024, label: "AATA→ARTA" },
] as const;

// ── Filtering ───────────────────────────────────────────────────

/** Return court codes belonging to a given group */
export function filterCourtsByGroup(group: CourtGroup): string[] {
  if (group === "all") {
    return Object.values(COURT_GROUPS).flat();
  }
  return [...COURT_GROUPS[group]];
}

/** Chart data row: { year: 2020, FMCA: 100, FCCA: 200, ... } */
export type ChartDataRow = Record<string, number>;

/** Filter chart data by year range and hidden courts */
export function filterChartData(
  chartData: ChartDataRow[],
  yearFrom: number,
  yearTo: number,
  hiddenCourts: Set<string>,
): ChartDataRow[] {
  return chartData
    .filter((row) => row.year >= yearFrom && row.year <= yearTo)
    .map((row) => {
      const filtered: ChartDataRow = { year: row.year };
      for (const [key, value] of Object.entries(row)) {
        if (key !== "year" && !hiddenCourts.has(key)) {
          filtered[key] = value;
        }
      }
      return filtered;
    });
}

// ── Normalization ───────────────────────────────────────────────

/** Normalize each row so values sum to 100 (percentage mode) */
export function normalizeToPercent(chartData: ChartDataRow[]): ChartDataRow[] {
  return chartData.map((row) => {
    const total = Object.entries(row)
      .filter(([k]) => k !== "year")
      .reduce((sum, [, v]) => sum + v, 0);
    if (total === 0) return { ...row };

    const normalized: ChartDataRow = { year: row.year };
    for (const [key, value] of Object.entries(row)) {
      if (key === "year") continue;
      normalized[key] = Math.round((value / total) * 1000) / 10;
    }
    return normalized;
  });
}

// ── Statistics ───────────────────────────────────────────────────

export interface CourtStats {
  code: string;
  name: string;
  years: [number, number];
  totalCases: number;
  peakYear: number;
  peakCount: number;
  avgPerYear: number;
  isActive: boolean;
}

/** Gather all courts from lineage data into a flat list */
function getAllCourts(data: LineageData): CourtMetadata[] {
  const courts: CourtMetadata[] = [];
  for (const lineage of data.lineages) {
    for (const court of lineage.courts) {
      courts.push(court);
    }
  }
  // Add FCA and HCA if present (they may be outside lineage groups)
  return courts;
}

/** Calculate summary stats for each court */
export function calculateCourtStats(data: LineageData): CourtStats[] {
  const courts = getAllCourts(data);
  return courts.map((court) => {
    const entries = Object.entries(court.case_count_by_year);
    const totalCases = entries.reduce((sum, [, count]) => sum + count, 0);
    const activeYears = entries.filter(([, count]) => count > 0).length;

    let peakYear = court.years[0];
    let peakCount = 0;
    for (const [yearStr, count] of entries) {
      if (count > peakCount) {
        peakCount = count;
        peakYear = parseInt(yearStr, 10);
      }
    }

    return {
      code: court.code,
      name: court.name,
      years: court.years,
      totalCases,
      peakYear,
      peakCount,
      avgPerYear: activeYears > 0 ? Math.round(totalCases / activeYears) : 0,
      isActive: court.years[1] === 9999,
    };
  });
}

/** Find the year with the highest total case count across visible courts */
export function findPeakYear(
  data: LineageData,
  hiddenCourts: Set<string>,
): { year: number; count: number } {
  const yearTotals = new Map<number, number>();

  for (const lineage of data.lineages) {
    for (const court of lineage.courts) {
      if (hiddenCourts.has(court.code)) continue;
      for (const [yearStr, count] of Object.entries(court.case_count_by_year)) {
        const year = parseInt(yearStr, 10);
        yearTotals.set(year, (yearTotals.get(year) ?? 0) + count);
      }
    }
  }

  let peakYear = 0;
  let peakCount = 0;
  for (const [year, count] of yearTotals) {
    if (count > peakCount) {
      peakYear = year;
      peakCount = count;
    }
  }

  return { year: peakYear, count: peakCount };
}

// ── Transition Impact ────────────────────────────────────────────

export interface TransitionImpact {
  from: string;
  to: string;
  year: number;
  beforeAvg: number;
  afterAvg: number;
  changePercent: number;
}

/** Calculate before/after 2-year averages around each transition */
export function calculateTransitionImpacts(
  data: LineageData,
): TransitionImpact[] {
  const impacts: TransitionImpact[] = [];

  for (const lineage of data.lineages) {
    for (const transition of lineage.transitions) {
      const fromCourt = lineage.courts.find(
        (c) => c.code === transition.from,
      );
      const toCourt = lineage.courts.find((c) => c.code === transition.to);
      if (!fromCourt || !toCourt) continue;

      // 2 years before transition (from the source court)
      const beforeYears = [transition.year - 2, transition.year - 1];
      const beforeCounts = beforeYears.map(
        (y) => fromCourt.case_count_by_year[String(y)] ?? 0,
      );
      const beforeAvg = Math.round(
        beforeCounts.reduce((a, b) => a + b, 0) / beforeCounts.length,
      );

      // 2 years after transition (from the destination court)
      const afterYears = [transition.year, transition.year + 1];
      const afterCounts = afterYears.map(
        (y) => toCourt.case_count_by_year[String(y)] ?? 0,
      );
      const afterAvg = Math.round(
        afterCounts.reduce((a, b) => a + b, 0) / afterCounts.length,
      );

      const changePercent =
        beforeAvg > 0
          ? Math.round(((afterAvg - beforeAvg) / beforeAvg) * 100)
          : 0;

      impacts.push({
        from: transition.from,
        to: transition.to,
        year: transition.year,
        beforeAvg,
        afterAvg,
        changePercent,
      });
    }
  }

  return impacts;
}

/** Count total visible cases after filters */
export function countFilteredCases(
  data: LineageData,
  hiddenCourts: Set<string>,
): number {
  let total = 0;
  for (const lineage of data.lineages) {
    for (const court of lineage.courts) {
      if (hiddenCourts.has(court.code)) continue;
      total += Object.values(court.case_count_by_year).reduce(
        (a, b) => a + b,
        0,
      );
    }
  }
  return total;
}

/** Count visible courts after filters */
export function countVisibleCourts(
  data: LineageData,
  hiddenCourts: Set<string>,
): number {
  let count = 0;
  for (const lineage of data.lineages) {
    for (const court of lineage.courts) {
      if (!hiddenCourts.has(court.code)) count++;
    }
  }
  return count;
}
