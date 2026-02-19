import type { CourtComparisonEntry } from "@/types/case";

interface CourtComparisonCardProps {
  data: CourtComparisonEntry[];
}

export function CourtComparisonCard({ data }: CourtComparisonCardProps) {
  if (data.length === 0) return null;

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-1 text-base font-semibold text-foreground">
        Court Comparison
      </h2>
      <p className="mb-3 text-xs text-muted-text">
        This judge&apos;s approval rate compared to the court-wide average.
        Positive delta = more applicant-favourable.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-text">
              <th className="py-2 pr-2">Court</th>
              <th className="py-2 pr-2 text-right">Cases</th>
              <th className="py-2 pr-2 text-right">Judge Rate</th>
              <th className="py-2 pr-2 text-right">Court Avg</th>
              <th className="py-2 text-right">Delta</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr
                key={row.court_code}
                className="border-b border-border-light/60"
              >
                <td className="py-2 pr-2 font-medium text-foreground">
                  {row.court_code}
                </td>
                <td className="py-2 pr-2 text-right text-secondary-text">
                  {row.judge_total.toLocaleString()}
                </td>
                <td className="py-2 pr-2 text-right text-foreground">
                  {row.judge_rate.toFixed(1)}%
                </td>
                <td className="py-2 pr-2 text-right text-secondary-text">
                  {row.court_avg_rate.toFixed(1)}%
                </td>
                <td className="py-2 text-right">
                  <DeltaBadge delta={row.delta} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DeltaBadge({ delta }: { delta: number }) {
  const isPositive = delta > 0;
  const isNegative = delta < 0;

  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-medium ${
        isPositive
          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
          : isNegative
            ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
            : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
      }`}
    >
      {isPositive ? "▲" : isNegative ? "▼" : "─"}{" "}
      {isPositive ? "+" : ""}
      {delta.toFixed(1)}pp
    </span>
  );
}
