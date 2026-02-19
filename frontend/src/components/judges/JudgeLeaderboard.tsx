import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();

  if (!data.length) {
    return (
      <p className="text-sm text-muted-text">{t("judges.no_judge_records")}</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-[1000px] text-sm">
        <thead>
          <tr className="border-b border-border bg-surface text-left text-xs uppercase tracking-wide text-muted-text">
            <th className="px-3 py-2">{t("judges.compare")}</th>
            <th className="px-3 py-2">{t("judges.judge_member")}</th>
            <th className="px-3 py-2">{t("judges.total_cases")}</th>
            <th className="px-3 py-2">{t("judges.approval_rate")}</th>
            <th className="px-3 py-2">{t("judges.active_years_column")}</th>
            <th className="px-3 py-2">{t("judges.courts")}</th>
            <th className="px-3 py-2">{t("judges.top_visa_subclasses")}</th>
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
              <td className="px-3 py-2 font-medium text-foreground">
                {row.name}
              </td>
              <td className="px-3 py-2 text-secondary-text">
                {row.total_cases.toLocaleString()}
              </td>
              <td className="px-3 py-2">
                <div className="w-40">
                  <div className="mb-1 text-xs text-secondary-text">
                    {row.approval_rate.toFixed(1)}%
                  </div>
                  <div className="h-2 rounded bg-surface">
                    <div
                      className="h-2 rounded bg-accent"
                      style={{ width: `${Math.min(row.approval_rate, 100)}%` }}
                    />
                  </div>
                </div>
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-secondary-text">
                {row.active_years.first ?? "-"} – {row.active_years.last ?? "-"}
              </td>
              <td className="px-3 py-2 text-secondary-text">
                {row.courts.join(", ") || "-"}
              </td>
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
