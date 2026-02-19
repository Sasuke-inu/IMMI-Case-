import { Briefcase, Scale } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CourtBadge } from "@/components/shared/CourtBadge";
import { courtColors } from "@/tokens/tokens";
import { cn } from "@/lib/utils";
import type { JudgeLeaderboardEntry } from "@/types/case";

interface JudgeCardProps {
  judge: JudgeLeaderboardEntry;
  isSelected: boolean;
  onToggleCompare: (name: string) => void;
  onOpen: (name: string) => void;
}

function approvalBadgeClass(rate: number): string {
  if (rate >= 35) return "bg-semantic-success/15 text-semantic-success";
  if (rate >= 20) return "bg-semantic-warning/15 text-semantic-warning";
  return "bg-semantic-danger/15 text-semantic-danger";
}

export function JudgeCard({
  judge,
  isSelected,
  onToggleCompare,
  onOpen,
}: JudgeCardProps) {
  const { t } = useTranslation();
  const accentColor = courtColors[judge.primary_court ?? ""] ?? "#6b7585";
  const yearsLabel =
    judge.active_years.first && judge.active_years.last
      ? judge.active_years.first === judge.active_years.last
        ? `${judge.active_years.first}`
        : `${judge.active_years.first} – ${judge.active_years.last}`
      : null;

  return (
    <button
      type="button"
      onClick={() => onOpen(judge.name)}
      className="group flex min-h-[180px] flex-col rounded-lg border border-border bg-card text-left shadow-xs transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
      style={{ borderLeftWidth: "3px", borderLeftColor: accentColor }}
    >
      <div className="flex flex-1 flex-col p-4">
        {/* Top row: court badges + approval rate */}
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {judge.courts.map((c) => (
            <CourtBadge key={c} court={c} />
          ))}
          <span
            className={cn(
              "ml-auto shrink-0 rounded-sm px-2 py-0.5 text-xs font-semibold",
              approvalBadgeClass(judge.approval_rate),
            )}
          >
            {judge.approval_rate.toFixed(1)}%
          </span>
        </div>

        {/* Judge name */}
        <h3 className="line-clamp-1 text-sm font-semibold text-foreground transition-colors group-hover:text-accent">
          {judge.name}
        </h3>

        {/* Active years */}
        {yearsLabel && (
          <p className="mt-0.5 text-xs text-muted-text">{yearsLabel}</p>
        )}

        {/* Spacer */}
        <div className="mt-auto" />

        {/* Bottom metadata */}
        <div className="mt-3 border-t border-border-light pt-2.5">
          <div className="flex items-center justify-between gap-2 text-xs text-muted-text">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span className="inline-flex items-center gap-1">
                <Scale className="h-3 w-3 shrink-0" />
                {judge.total_cases.toLocaleString()} {t("judges.cases")}
              </span>
              {judge.top_visa_subclasses[0] && (
                <span
                  className="inline-flex items-center gap-1 truncate"
                  title={judge.top_visa_subclasses[0].subclass}
                >
                  <Briefcase className="h-3 w-3 shrink-0" />
                  {judge.top_visa_subclasses[0].subclass}
                </span>
              )}
            </div>

            {/* Compare checkbox */}
            <label
              className="inline-flex shrink-0 cursor-pointer items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                aria-label={`Compare ${judge.name}`}
                checked={isSelected}
                onChange={() => onToggleCompare(judge.name)}
              />
              <span className="select-none text-[11px]">
                {t("judges.compare")}
              </span>
            </label>
          </div>
        </div>
      </div>
    </button>
  );
}
