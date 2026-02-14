import { cn } from "@/lib/utils"

function classifyOutcome(outcome: string): "positive" | "negative" | "neutral" {
  const lower = outcome.toLowerCase()
  if (
    lower.includes("allowed") ||
    lower.includes("granted") ||
    lower.includes("upheld") ||
    lower.includes("remit")
  ) {
    return "positive"
  }
  if (
    lower.includes("dismissed") ||
    lower.includes("refused") ||
    lower.includes("rejected") ||
    lower.includes("affirmed")
  ) {
    return "negative"
  }
  return "neutral"
}

const colorMap = {
  positive: "bg-success/10 text-success border-success/20",
  negative: "bg-danger/10 text-danger border-danger/20",
  neutral: "bg-muted-text/10 text-muted-text border-muted-text/20",
}

interface OutcomeBadgeProps {
  outcome: string
  className?: string
}

export function OutcomeBadge({ outcome, className }: OutcomeBadgeProps) {
  if (!outcome) return null
  const type = classifyOutcome(outcome)

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-medium",
        colorMap[type],
        className
      )}
    >
      {outcome}
    </span>
  )
}
