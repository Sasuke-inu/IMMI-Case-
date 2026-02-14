import { Calendar, User, Briefcase } from "lucide-react"
import { CourtBadge } from "@/components/shared/CourtBadge"
import { OutcomeBadge } from "@/components/shared/OutcomeBadge"
import { courtColors } from "@/tokens/tokens"
import type { ImmigrationCase } from "@/types/case"

interface CaseCardProps {
  case_: ImmigrationCase
  onClick: () => void
}

export function CaseCard({ case_: c, onClick }: CaseCardProps) {
  const accentColor = courtColors[c.court_code] ?? "#6b7585"

  return (
    <button
      onClick={onClick}
      className="group flex min-h-[180px] flex-col rounded-lg border border-border bg-card text-left shadow-xs transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
      style={{ borderLeftWidth: "3px", borderLeftColor: accentColor }}
    >
      <div className="flex flex-1 flex-col p-4">
        {/* Top row: court badge + outcome */}
        <div className="mb-2 flex items-center justify-between gap-2">
          <CourtBadge court={c.court_code} />
          {c.outcome && <OutcomeBadge outcome={c.outcome} />}
        </div>

        {/* Title */}
        <h3
          className="line-clamp-2 text-sm font-semibold text-foreground transition-colors group-hover:text-accent"
          title={c.title || c.citation}
        >
          {c.title || c.citation}
        </h3>

        {/* Citation */}
        {c.citation && (
          <p className="mt-1 truncate text-xs text-muted-text" title={c.citation}>
            {c.citation}
          </p>
        )}

        {/* Spacer pushes metadata to bottom */}
        <div className="mt-auto" />

        {/* Metadata section */}
        {(c.date || c.judges || c.visa_type) && (
          <div className="mt-3 border-t border-border-light pt-2.5">
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-text">
              {c.date && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3 shrink-0" />
                  {c.date}
                </span>
              )}
              {c.judges && (
                <span className="inline-flex max-w-[180px] items-center gap-1 truncate" title={c.judges}>
                  <User className="h-3 w-3 shrink-0" />
                  {c.judges}
                </span>
              )}
            </div>
            {c.visa_type && (
              <span
                className="mt-1.5 inline-flex max-w-full items-center gap-1 truncate text-xs text-muted-text"
                title={c.visa_type}
              >
                <Briefcase className="h-3 w-3 shrink-0" />
                {c.visa_type}
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  )
}
