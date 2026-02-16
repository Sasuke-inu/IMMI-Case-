import { cn } from "@/lib/utils"
import { Database } from "lucide-react"

interface DatabaseCardProps {
  code: string
  name: string
  badge?: string
  badgeColor?: "success" | "warning" | "danger" | "info"
  disabled?: boolean
  disabledReason?: string
  selected: boolean
  onToggle: (code: string) => void
}

const badgeColorMap = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
  info: "bg-info/10 text-info",
}

export function DatabaseCard({
  code,
  name,
  badge,
  badgeColor = "info",
  disabled = false,
  disabledReason,
  selected,
  onToggle,
}: DatabaseCardProps) {
  return (
    <button
      onClick={() => !disabled && onToggle(code)}
      disabled={disabled}
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3 text-left transition-all",
        disabled
          ? "cursor-not-allowed border-border bg-surface opacity-50"
          : selected
            ? "border-accent bg-accent-muted shadow-sm"
            : "border-border bg-card hover:border-accent/50"
      )}
      title={disabled ? disabledReason : undefined}
    >
      <div
        className={cn(
          "mt-0.5 rounded-md p-1.5",
          selected ? "bg-accent/20 text-accent" : "bg-surface text-muted-text"
        )}
      >
        <Database className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold text-foreground">
            {code}
          </span>
          {badge && (
            <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", badgeColorMap[badgeColor])}>
              {badge}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-text truncate">{name}</p>
        {disabled && disabledReason && (
          <p className="mt-0.5 text-[10px] text-danger">{disabledReason}</p>
        )}
      </div>
      <input
        type="checkbox"
        checked={selected}
        readOnly
        className="mt-1 rounded"
        tabIndex={-1}
      />
    </button>
  )
}
