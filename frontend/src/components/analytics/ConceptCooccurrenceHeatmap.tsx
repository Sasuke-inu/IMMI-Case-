import type { ConceptCooccurrenceData } from "@/types/case";
import { Fragment } from "react";

interface ConceptCooccurrenceHeatmapProps {
  data: ConceptCooccurrenceData;
}

function toColor(winRate: number, count: number): string {
  if (count === 0) return "rgba(26, 82, 118, 0.04)";
  const intensity = Math.max(0.12, Math.min(winRate / 100, 1));
  return `rgba(26, 82, 118, ${intensity})`;
}

export function ConceptCooccurrenceHeatmap({ data }: ConceptCooccurrenceHeatmapProps) {
  const concepts = data.concepts.slice(0, 12);

  if (!concepts.length) {
    return <p className="text-sm text-muted-text">No co-occurrence data for current filters.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <div
        className="grid gap-px text-xs"
        style={{ gridTemplateColumns: `180px repeat(${concepts.length}, minmax(70px, 1fr))` }}
      >
        <div className="p-1.5 text-muted-text" />
        {concepts.map((concept) => (
          <div key={`head-${concept}`} className="p-1.5 text-center text-[10px] font-semibold text-secondary-text">
            {concept}
          </div>
        ))}

        {concepts.map((rowConcept) => (
          <Fragment key={rowConcept}>
            <div key={`row-${rowConcept}`} className="truncate p-1.5 text-[11px] font-medium text-foreground" title={rowConcept}>
              {rowConcept}
            </div>
            {concepts.map((colConcept) => {
              const cell = data.matrix[rowConcept]?.[colConcept];
              const count = cell?.count ?? 0;
              const winRate = cell?.win_rate ?? 0;
              return (
                <div
                  key={`${rowConcept}-${colConcept}`}
                  className="flex items-center justify-center rounded-sm p-1.5 text-[10px]"
                  style={{
                    backgroundColor: toColor(winRate, count),
                    color: count > 0 ? "#fff" : "var(--color-text-secondary)",
                  }}
                  title={`${rowConcept} + ${colConcept}: ${count.toLocaleString()} cases, ${winRate.toFixed(1)}%`}
                >
                  {count > 0 ? count.toLocaleString() : "-"}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
