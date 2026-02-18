import type { JudgeLeaderboardEntry } from "@/types/case";

interface JudgeLeaderboardProps {
  data: JudgeLeaderboardEntry[];
  selectedNames: string[];
  onToggleCompare: (name: string) => void;
  onOpen: (name: string) => void;
}

export function JudgeLeaderboard({
  data,
  selectedNames,
  onToggleCompare,
  onOpen,
}: JudgeLeaderboardProps) {
  if (!data.length) {
    return <p className="text-sm text-muted-text">No judge records found for selected filters.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b border-border bg-surface text-left text-xs uppercase tracking-wide text-muted-text">
            <th className="px-3 py-2">Compare</th>
            <th className="px-3 py-2">Judge / Member</th>
            <th className="px-3 py-2">Cases</th>
            <th className="px-3 py-2">Approval Rate</th>
            <th className="px-3 py-2">Courts</th>
            <th className="px-3 py-2">Top Visa</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={row.name}
              className="cursor-pointer border-b border-border-light/60 hover:bg-surface/50"
              onClick={() => onOpen(row.name)}
            >
              <td
                className="px-3 py-2"
                onClick={(event) => {
                  event.stopPropagation();
                }}
              >
                <input
                  aria-label={`Compare ${row.name}`}
                  type="checkbox"
                  checked={selectedNames.includes(row.name)}
                  onChange={() => onToggleCompare(row.name)}
                />
              </td>
              <td className="px-3 py-2 font-medium text-foreground">{row.name}</td>
              <td className="px-3 py-2 text-secondary-text">{row.total_cases.toLocaleString()}</td>
              <td className="px-3 py-2">
                <div className="w-40">
                  <div className="mb-1 text-xs text-secondary-text">{row.approval_rate.toFixed(1)}%</div>
                  <div className="h-2 rounded bg-surface">
                    <div className="h-2 rounded bg-accent" style={{ width: `${Math.min(row.approval_rate, 100)}%` }} />
                  </div>
                </div>
              </td>
              <td className="px-3 py-2 text-secondary-text">{row.courts.join(", ") || "-"}</td>
              <td className="px-3 py-2 text-secondary-text">
                {row.top_visa_subclasses[0]
                  ? `${row.top_visa_subclasses[0].subclass} (${row.top_visa_subclasses[0].count})`
                  : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
