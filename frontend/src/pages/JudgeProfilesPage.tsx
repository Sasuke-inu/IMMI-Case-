import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnalyticsFilters } from "@/components/shared/AnalyticsFilters";
import { JudgeLeaderboard } from "@/components/judges/JudgeLeaderboard";
import { ApiErrorState } from "@/components/shared/ApiErrorState";
import { useJudgeLeaderboard } from "@/hooks/use-judges";

const CURRENT_YEAR = new Date().getFullYear();

export function JudgeProfilesPage() {
  const navigate = useNavigate();
  const [court, setCourt] = useState("");
  const [yearFrom, setYearFrom] = useState(2000);
  const [yearTo, setYearTo] = useState(CURRENT_YEAR);
  const [sortBy, setSortBy] = useState<"cases" | "approval_rate" | "name">("cases");
  const [selectedNames, setSelectedNames] = useState<string[]>([]);

  const params = useMemo(
    () => ({
      court: court || undefined,
      yearFrom,
      yearTo,
      sort_by: sortBy,
      limit: 100,
    }),
    [court, yearFrom, yearTo, sortBy],
  );

  const { data, isLoading, isError, error, refetch } = useJudgeLeaderboard(params);

  const toggleCompare = (name: string) => {
    setSelectedNames((prev) => {
      const exists = prev.includes(name);
      if (exists) return prev.filter((item) => item !== name);
      if (prev.length >= 4) return prev;
      return [...prev, name];
    });
  };

  const openCompare = () => {
    if (selectedNames.length < 2) return;
    const names = selectedNames.map((name) => encodeURIComponent(name)).join(",");
    navigate(`/judge-profiles/compare?names=${names}`);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Judge Profiles</h1>
        <p className="text-sm text-muted-text">
          Explore approval rates, workload, and case composition by judge/member.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <AnalyticsFilters
            court={court}
            yearFrom={yearFrom}
            yearTo={yearTo}
            onCourtChange={setCourt}
            onYearRangeChange={(from, to) => {
              setYearFrom(from);
              setYearTo(to);
            }}
          />

          <div className="flex items-center gap-2">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-text">Sort</label>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as "cases" | "approval_rate" | "name")}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            >
              <option value="cases">Most Cases</option>
              <option value="approval_rate">Highest Approval</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>

        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm text-secondary-text">
            {data?.total_judges ?? 0} judges found
          </p>
          <button
            type="button"
            onClick={openCompare}
            disabled={selectedNames.length < 2}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Compare Selected ({selectedNames.length})
          </button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-text">Loading judges...</p>
        ) : isError ? (
          <ApiErrorState
            title="Judge leaderboard failed to load"
            message={error instanceof Error ? error.message : "Judge API request failed."}
            onRetry={() => {
              void refetch();
            }}
          />
        ) : (
          <JudgeLeaderboard
            data={data?.judges ?? []}
            selectedNames={selectedNames}
            onToggleCompare={toggleCompare}
            onOpen={(name) => navigate(`/judge-profiles/${encodeURIComponent(name)}`)}
          />
        )}
      </div>
    </div>
  );
}
