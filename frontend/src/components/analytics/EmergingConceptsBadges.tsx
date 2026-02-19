import { useTranslation } from "react-i18next";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import type { ConceptTrendData } from "@/types/case";

interface EmergingConceptsBadgesProps {
  data: ConceptTrendData;
}

export function EmergingConceptsBadges({ data }: EmergingConceptsBadgesProps) {
  const { t } = useTranslation();
  const hasEmerging = data.emerging.length > 0;
  const hasDeclining = data.declining.length > 0;

  if (!hasEmerging && !hasDeclining) {
    return (
      <p className="text-sm text-muted-text">
        {t("analytics.no_concepts_detected")}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {hasEmerging && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-text">
            {t("analytics.emerging")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {data.emerging.slice(0, 8).map((item) => (
              <span
                key={item.name}
                className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
              >
                <ArrowUpRight className="h-3 w-3" />
                {item.name} ({item.growth_pct.toFixed(1)}%)
              </span>
            ))}
          </div>
        </div>
      )}

      {hasDeclining && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-text">
            {t("analytics.declining")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {data.declining.slice(0, 8).map((item) => (
              <span
                key={item.name}
                className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-1 text-xs font-medium text-rose-800 dark:bg-rose-900/40 dark:text-rose-200"
              >
                <ArrowDownRight className="h-3 w-3" />
                {item.name} ({item.decline_pct.toFixed(1)}%)
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
