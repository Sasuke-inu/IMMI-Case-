import { cn } from "@/lib/utils";

const COURTS = [
  "AATA",
  "ARTA",
  "FCA",
  "FCCA",
  "FedCFamC2G",
  "HCA",
  "MRTA",
  "RRTA",
  "FMCA",
];
const CURRENT_YEAR = new Date().getFullYear();

interface TimePreset {
  readonly label: string;
  readonly from: number;
  readonly to: number;
}

const TIME_PRESETS: readonly TimePreset[] = [
  { label: "All Time", from: 2000, to: CURRENT_YEAR },
  { label: "Last 5y", from: CURRENT_YEAR - 5, to: CURRENT_YEAR },
  { label: "Last 10y", from: CURRENT_YEAR - 10, to: CURRENT_YEAR },
  { label: "2020\u2013" + CURRENT_YEAR, from: 2020, to: CURRENT_YEAR },
];

interface AnalyticsFiltersProps {
  court: string;
  yearFrom: number;
  yearTo: number;
  onCourtChange: (court: string) => void;
  onYearRangeChange: (from: number, to: number) => void;
}

export function AnalyticsFilters({
  court,
  yearFrom,
  yearTo,
  onCourtChange,
  onYearRangeChange,
}: AnalyticsFiltersProps) {
  const isPresetActive = (p: TimePreset) =>
    yearFrom === p.from && yearTo === p.to;
  const isCustom = !TIME_PRESETS.some(isPresetActive);

  return (
    <div className="space-y-2">
      {/* Timeframe presets */}
      <div className="flex flex-wrap items-center gap-1.5">
        {TIME_PRESETS.map((preset) => (
          <button
            key={preset.label}
            onClick={() => onYearRangeChange(preset.from, preset.to)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              isPresetActive(preset)
                ? "bg-accent text-white"
                : "bg-surface text-secondary-text hover:bg-accent-muted hover:text-accent",
            )}
          >
            {preset.label}
          </button>
        ))}
        {/* Custom year pickers */}
        <span className="ml-1 text-xs text-muted-text">|</span>
        <select
          value={yearFrom}
          onChange={(e) => onYearRangeChange(Number(e.target.value), yearTo)}
          className={cn(
            "rounded-md border border-border bg-card px-1.5 py-1 text-xs text-foreground",
            isCustom && "border-accent",
          )}
        >
          {Array.from({ length: CURRENT_YEAR - 1999 }, (_, i) => 2000 + i).map(
            (y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ),
          )}
        </select>
        <span className="text-xs text-muted-text">&ndash;</span>
        <select
          value={yearTo}
          onChange={(e) => onYearRangeChange(yearFrom, Number(e.target.value))}
          className={cn(
            "rounded-md border border-border bg-card px-1.5 py-1 text-xs text-foreground",
            isCustom && "border-accent",
          )}
        >
          {Array.from({ length: CURRENT_YEAR - 1999 }, (_, i) => 2000 + i).map(
            (y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ),
          )}
        </select>
      </div>

      {/* Court pills */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => onCourtChange("")}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            !court
              ? "bg-accent text-white"
              : "bg-surface text-secondary-text hover:bg-accent-muted hover:text-accent",
          )}
        >
          All Courts
        </button>
        {COURTS.map((c) => (
          <button
            key={c}
            onClick={() => onCourtChange(court === c ? "" : c)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              court === c
                ? "bg-accent text-white"
                : "bg-surface text-secondary-text hover:bg-accent-muted hover:text-accent",
            )}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}
