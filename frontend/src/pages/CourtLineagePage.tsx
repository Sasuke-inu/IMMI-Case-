import { useTranslation } from "react-i18next";
import { GitBranch, Info } from "lucide-react";
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

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-text">
            {t("lineage.total_cases", "Total Cases")}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
            {lineageData.total_cases.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-text">
            {t("lineage.year_range", "Year Range")}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
            {lineageData.year_range[0]}–{lineageData.year_range[1]}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-text">
            {t("lineage.courts_count", "Courts / Tribunals")}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
            9
          </p>
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
              {t(
                "lineage.timeline_chart_title",
                "Case Volume by Court and Year",
              )}
            </h3>
            <div className="overflow-x-auto">
              <div className="min-w-[600px]">
                <TimelineChart data={lineageData} />
              </div>
            </div>

            {/* Compact colour legend */}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border-light pt-3">
              {allCourts.map((court) => (
                <div key={court.code} className="flex items-center gap-1.5">
                  <div
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{
                      backgroundColor: courtColors[court.code] ?? "#8b8680",
                    }}
                  />
                  <span className="font-mono text-[11px] text-muted-text">
                    {court.code}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Help text – no emoji */}
      <div className="flex items-start gap-3 rounded-md border border-border-light bg-surface p-4 text-sm text-muted-text">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <p>
          {t(
            "lineage.help_text",
            "Click any bar segment in the volume chart to view cases from that court and year. The succession timeline on the left shows proportional active periods — notice how MRTA and RRTA dominated 2000–2015, AATA took over until 2024, and ARTA continues from there.",
          )}
        </p>
      </div>
    </div>
  );
}
