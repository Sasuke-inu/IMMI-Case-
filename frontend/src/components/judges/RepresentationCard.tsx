import type { RepresentationStats } from "@/types/case";

interface RepresentationCardProps {
  data: RepresentationStats;
}

export function RepresentationCard({ data }: RepresentationCardProps) {
  const rep = data.represented;
  const selfRep = data.self_represented;

  const totalKnown = (rep?.total ?? 0) + (selfRep?.total ?? 0);
  if (totalKnown < 5) return null;

  const delta =
    rep && selfRep
      ? Number((rep.win_rate - selfRep.win_rate).toFixed(1))
      : null;

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 text-base font-semibold text-foreground">
        Representation Analysis
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <StatBox
          label="With Lawyer"
          total={rep?.total ?? 0}
          winRate={rep?.win_rate ?? 0}
        />
        <StatBox
          label="Self-Represented"
          total={selfRep?.total ?? 0}
          winRate={selfRep?.win_rate ?? 0}
        />
      </div>

      {delta !== null && (
        <p className="mt-3 text-xs text-secondary-text">
          Represented applicants have a{" "}
          <span
            className={
              delta > 0
                ? "font-semibold text-green-600"
                : delta < 0
                  ? "font-semibold text-red-600"
                  : "font-semibold"
            }
          >
            {delta > 0 ? "+" : ""}
            {delta}pp
          </span>{" "}
          difference in approval rate vs self-represented.
        </p>
      )}

      {data.unknown_count > 0 && (
        <p className="mt-1 text-xs text-muted-text">
          {data.unknown_count.toLocaleString()} cases with unknown
          representation status.
        </p>
      )}
    </section>
  );
}

function StatBox({
  label,
  total,
  winRate,
}: {
  label: string;
  total: number;
  winRate: number;
}) {
  if (total === 0) {
    return (
      <div className="rounded-md border border-border-light/60 p-3">
        <p className="text-xs uppercase tracking-wide text-muted-text">
          {label}
        </p>
        <p className="mt-1 text-sm text-muted-text">No data</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border-light/60 p-3">
      <p className="text-xs uppercase tracking-wide text-muted-text">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground">
        {total.toLocaleString()} cases
      </p>
      <span
        className={`mt-1 inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
          winRate >= 50
            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
        }`}
      >
        {winRate.toFixed(1)}% win rate
      </span>
    </div>
  );
}
