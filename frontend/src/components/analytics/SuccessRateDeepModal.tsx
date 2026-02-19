import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import {
  useNatureOutcome,
  useConceptEffectiveness,
  useConceptTrends,
} from "@/hooks/use-analytics";
import { NatureOutcomeHeatmap } from "@/components/analytics/NatureOutcomeHeatmap";
import { ConceptEffectivenessChart } from "@/components/analytics/ConceptEffectivenessChart";
import { ConceptTrendChart } from "@/components/analytics/ConceptTrendChart";
import { ConfidenceBadge } from "@/components/analytics/ConfidenceBadge";
import type { AnalyticsFilterParams } from "@/types/case";

interface SuccessRateDeepModalProps {
  open: boolean;
  onClose: () => void;
  filters: AnalyticsFilterParams;
  currentRate: number;
  totalMatching: number;
}

export function SuccessRateDeepModal({
  open,
  onClose,
  filters,
  currentRate,
  totalMatching,
}: SuccessRateDeepModalProps) {
  const { t } = useTranslation();

  const { data: natureOutcome, isLoading: loadingNature } =
    useNatureOutcome(filters);
  const { data: conceptEffectiveness, isLoading: loadingEffectiveness } =
    useConceptEffectiveness({ ...filters, limit: 15 });
  const { data: conceptTrends, isLoading: loadingTrends } = useConceptTrends({
    ...filters,
    limit: 8,
  });

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const formattedTotal = totalMatching.toLocaleString();

  return (
    <div
      data-testid="deep-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="relative z-10 mx-4 max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">
              {t("analytics.deep_analysis_title", {
                defaultValue: "Success Rate Deep Analysis",
              })}
            </h2>
            <div className="mt-2 flex items-baseline gap-4">
              <span className="text-3xl font-bold text-accent">
                {currentRate}%
              </span>
              <span className="text-sm text-muted-text">
                {formattedTotal}{" "}
                {t("analytics.matching_cases", { defaultValue: "cases" })}
              </span>
              <ConfidenceBadge totalMatching={totalMatching} />
            </div>
            {filters.court && (
              <span className="mt-1 inline-block rounded bg-surface px-2 py-0.5 text-xs text-muted-text">
                {filters.court}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-muted-text hover:bg-surface hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Analysis Panels */}
        <div className="space-y-6">
          <section>
            <h3 className="mb-3 text-lg font-semibold text-foreground">
              Nature vs Outcome Breakdown
            </h3>
            <div className="rounded-md border border-border bg-surface p-4">
              {loadingNature || !natureOutcome ? (
                <p className="text-sm text-muted-text">
                  {t("common.loading", { defaultValue: "Loading..." })}
                </p>
              ) : (
                <NatureOutcomeHeatmap data={natureOutcome} />
              )}
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-lg font-semibold text-foreground">
              Concept Effectiveness
            </h3>
            <div className="rounded-md border border-border bg-surface p-4">
              {loadingEffectiveness || !conceptEffectiveness ? (
                <p className="text-sm text-muted-text">
                  {t("common.loading", { defaultValue: "Loading..." })}
                </p>
              ) : (
                <ConceptEffectivenessChart data={conceptEffectiveness} />
              )}
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-lg font-semibold text-foreground">
              Concept Trends
            </h3>
            <div className="rounded-md border border-border bg-surface p-4">
              {loadingTrends || !conceptTrends ? (
                <p className="text-sm text-muted-text">
                  {t("common.loading", { defaultValue: "Loading..." })}
                </p>
              ) : (
                <ConceptTrendChart data={conceptTrends} />
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
