import { Link, useLocation } from "react-router-dom";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ApiErrorState } from "@/components/shared/ApiErrorState";
import { JudgeCompareCard } from "@/components/judges/JudgeCompareCard";
import { useJudgeCompare } from "@/hooks/use-judges";

function useQueryNames() {
  const { search } = useLocation();
  return useMemo(() => {
    const params = new URLSearchParams(search);
    const raw = params.get("names") ?? "";
    return raw
      .split(",")
      .map((name) => decodeURIComponent(name.trim()))
      .filter(Boolean)
      .slice(0, 4);
  }, [search]);
}

export function JudgeComparePage() {
  const { t } = useTranslation();
  const names = useQueryNames();
  const { data, isLoading, isError, error, refetch } = useJudgeCompare(names);

  const gridCols =
    (data?.judges.length ?? 0) >= 4
      ? "lg:grid-cols-2 xl:grid-cols-4"
      : "lg:grid-cols-2";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">
          {t("pages.judge_comparison.title")}
        </h1>
        <Link
          to="/judge-profiles"
          className="text-sm font-medium text-accent hover:underline"
        >
          ← {t("pages.judge_comparison.back_to_profiles")}
        </Link>
      </div>

      {names.length < 2 ? (
        <p className="text-sm text-muted-text">
          {t("pages.judge_comparison.min_judges")}
        </p>
      ) : isLoading ? (
        <p className="text-sm text-muted-text">
          {t("common.loading_ellipsis")}
        </p>
      ) : isError ? (
        <ApiErrorState
          title={t("judges.profile_load_failed")}
          message={
            error instanceof Error
              ? error.message
              : t("errors.api_request_failed", { name: "Judge Compare" })
          }
          onRetry={() => {
            void refetch();
          }}
        />
      ) : !data ? (
        <ApiErrorState
          title={t("judges.profile_not_found")}
          message={t("errors.payload_error", { name: "Judge Compare" })}
          onRetry={() => {
            void refetch();
          }}
        />
      ) : (
        <div className={`grid gap-4 ${gridCols}`}>
          {data.judges.map((judge) => (
            <JudgeCompareCard key={judge.judge.name} judge={judge} />
          ))}
        </div>
      )}
    </div>
  );
}
