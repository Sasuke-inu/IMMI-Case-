import { Fragment } from "react";
import type { NatureOutcomeData } from "@/types/case";

interface NatureOutcomeHeatmapProps {
  data: NatureOutcomeData;
}

export function NatureOutcomeHeatmap({ data }: NatureOutcomeHeatmapProps) {
  const { natures, outcomes, matrix } = data;

  // Find global max for opacity scaling
  let maxCount = 1;
  for (const nature of natures) {
    for (const outcome of outcomes) {
      const val = matrix[nature]?.[outcome] ?? 0;
      if (val > maxCount) maxCount = val;
    }
  }

  // Truncate long nature names
  const truncate = (s: string, max: number) =>
    s.length > max ? s.slice(0, max - 1) + "\u2026" : s;

  return (
    <div className="overflow-x-auto">
      <div
        className="grid gap-px text-xs"
        style={{
          gridTemplateColumns: `160px repeat(${outcomes.length}, minmax(70px, 1fr))`,
        }}
      >
        {/* Header row */}
        <div className="p-1.5 font-medium text-muted-text" />
        {outcomes.map((outcome) => (
          <div
            key={outcome}
            className="p-1.5 text-center text-[10px] font-semibold text-secondary-text"
          >
            {outcome}
          </div>
        ))}

        {/* Data rows */}
        {natures.map((nature) => (
          <Fragment key={nature}>
            <div
              className="truncate p-1.5 text-[11px] font-medium text-foreground"
              title={nature}
            >
              {truncate(nature, 25)}
            </div>
            {outcomes.map((outcome) => {
              const count = matrix[nature]?.[outcome] ?? 0;
              const intensity = count / maxCount;
              return (
                <div
                  key={`${nature}-${outcome}`}
                  className="flex items-center justify-center rounded-sm p-1.5 text-[10px]"
                  style={{
                    backgroundColor: `rgba(26, 82, 118, ${Math.max(intensity * 0.85, 0.03)})`,
                    color:
                      intensity > 0.4 ? "#fff" : "var(--color-text-secondary)",
                  }}
                  title={`${nature} \u2192 ${outcome}: ${count.toLocaleString()}`}
                >
                  {count > 0 ? count.toLocaleString() : "\u2013"}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
