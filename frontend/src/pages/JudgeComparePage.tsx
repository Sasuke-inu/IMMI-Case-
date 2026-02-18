import { Link, useLocation } from "react-router-dom";
import { useMemo } from "react";
import { ApiErrorState } from "@/components/shared/ApiErrorState";
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
  const names = useQueryNames();
  const { data, isLoading, isError, error, refetch } = useJudgeCompare(names);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Judge Comparison</h1>
        <Link to="/judge-profiles" className="text-sm font-medium text-accent hover:underline">
          ← Back to Judge Profiles
        </Link>
      </div>

      {names.length < 2 ? (
        <p className="text-sm text-muted-text">Select at least two judges to compare.</p>
      ) : isLoading ? (
        <p className="text-sm text-muted-text">Loading comparison...</p>
      ) : isError ? (
        <ApiErrorState
          title="Judge comparison failed to load"
          message={error instanceof Error ? error.message : "Judge compare API request failed."}
          onRetry={() => {
            void refetch();
          }}
        />
      ) : !data ? (
        <ApiErrorState
          title="Comparison data unavailable"
          message="No comparison payload was returned."
          onRetry={() => {
            void refetch();
          }}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.judges.map((judge) => (
            <section key={judge.judge.name} className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-lg font-semibold text-foreground">{judge.judge.name}</h2>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <Stat label="Cases" value={judge.judge.total_cases.toLocaleString()} />
                <Stat label="Approval" value={`${judge.approval_rate.toFixed(1)}%`} />
                <Stat label="Court Type" value={judge.court_type} />
                <Stat
                  label="Active Years"
                  value={`${judge.judge.active_years.first ?? "-"} - ${judge.judge.active_years.last ?? "-"}`}
                />
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border-light/60 p-3">
      <p className="text-xs uppercase tracking-wide text-muted-text">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
