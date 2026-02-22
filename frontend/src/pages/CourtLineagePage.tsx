import { useTranslation } from "react-i18next";
import { GitBranch } from "lucide-react";
import { useLineageData } from "@/hooks/use-lineage-data";
import { TimelineChart } from "@/components/lineage/TimelineChart";
import { LineageExplainer } from "@/components/lineage/LineageExplainer";
import { ApiErrorState } from "@/components/shared/ApiErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { courtColors } from "@/tokens/tokens";

export function CourtLineagePage() {
  const { t } = useTranslation();
  const {
    data: lineageData,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useLineageData();

  if (isLoading && !lineageData) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-text">
        {t("common.loading_ellipsis")}
      </div>
    );
  }

  if (isError && !lineageData) {
    const message =
      error instanceof Error
        ? error.message
        : t("errors.api_request_failed", { name: "Court Lineage" });
    return (
      <ApiErrorState
        title={t("errors.failed_to_load", { name: "Court Lineage" })}
        message={message}
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  if (!lineageData) {
    return (
      <ApiErrorState
        title={t("errors.data_unavailable", { name: "Court Lineage" })}
        message={t("errors.payload_error", { name: "Court Lineage" })}
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  if (lineageData.total_cases === 0 && !isFetching) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {t("lineage.title", "Court Lineage Timeline")}
          </h1>
          <p className="text-sm text-muted-text">
            {t(
              "lineage.subtitle_empty",
              "No case data available for lineage visualization",
            )}
          </p>
        </div>
        <EmptyState
          icon={<GitBranch className="h-10 w-10" />}
          title={t("lineage.no_data_title", "No Court Lineage Data")}
          description={t(
            "lineage.no_data_description",
            "Download cases first to visualize the court and tribunal succession timeline.",
          )}
        />
      </div>
    );
  }

  // All 9 courts for the legend
  const allCourts = [
    { code: "MRTA", name: t("courts.MRTA", "MRTA") },
    { code: "RRTA", name: t("courts.RRTA", "RRTA") },
    { code: "AATA", name: t("courts.AATA", "AATA") },
    { code: "ARTA", name: t("courts.ARTA", "ARTA") },
    { code: "FMCA", name: t("courts.FMCA", "FMCA") },
    { code: "FCCA", name: t("courts.FCCA", "FCCA") },
    { code: "FedCFamC2G", name: t("courts.FedCFamC2G", "FedCFamC2G") },
    { code: "FCA", name: t("courts.FCA", "FCA") },
    { code: "HCA", name: t("courts.HCA", "HCA") },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          {t("lineage.title", "Court Lineage Timeline")}
        </h1>
        <p className="text-sm text-muted-text">
          {t(
            "lineage.subtitle",
            "Interactive visualization of Australian immigration court and tribunal succession from 2000 to present",
          )}
        </p>
      </div>

      {/* Stats summary */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div>
          <span className="text-muted-text">{t("lineage.total_cases", "Total Cases")}:</span>{" "}
          <span className="font-medium text-foreground">
            {lineageData.total_cases.toLocaleString()}
          </span>
        </div>
        <div>
          <span className="text-muted-text">{t("lineage.year_range", "Years")}:</span>{" "}
          <span className="font-medium text-foreground">
            {lineageData.year_range[0]}–{lineageData.year_range[1]}
          </span>
        </div>
        <div>
          <span className="text-muted-text">{t("lineage.courts_count", "Courts/Tribunals")}:</span>{" "}
          <span className="font-medium text-foreground">9</span>
        </div>
      </div>

      {/* Explainer panel (top on mobile, left on desktop) */}
      <div className="grid gap-6 lg:grid-cols-[minmax(320px,400px)_1fr]">
        <div className="order-2 lg:order-1">
          <LineageExplainer data={lineageData} />
        </div>

        {/* Timeline chart */}
        <div className="order-1 lg:order-2">
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="mb-4 font-heading text-base font-semibold text-foreground">
              {t("lineage.timeline_chart_title", "Case Volume by Court and Year")}
            </h3>
            <div className="overflow-x-auto">
              <div className="min-w-[600px]">
                <TimelineChart data={lineageData} />
              </div>
            </div>

            {/* Legend with all 9 courts */}
            <div className="mt-4 border-t border-border-light pt-4">
              <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-text">
                {t("lineage.court_colors", "Court Colors")}
              </h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
                {allCourts.map((court) => (
                  <div key={court.code} className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-sm"
                      style={{
                        backgroundColor: courtColors[court.code] ?? "#8b8680",
                      }}
                    />
                    <span className="font-mono text-foreground">{court.code}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Help text */}
      <div className="rounded-md border border-border-light bg-surface p-4 text-sm text-muted-text">
        <p>
          {t(
            "lineage.help_text",
            "💡 Click any bar segment to view cases from that court and year. The chart shows the transition from older tribunals (MRTA, RRTA) to AATA and then ARTA, as well as the evolution of lower courts from FMCA through FCCA to FedCFamC2G.",
          )}
        </p>
      </div>
    </div>
  );
}
