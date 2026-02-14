import { cn } from "@/lib/utils"

type OutcomeType = "positive" | "negative" | "neutral"

function classifyOutcome(outcome: string): OutcomeType {
  const lower = outcome.toLowerCase()
  if (
    lower.includes("allow") ||
    lower.includes("grant") ||
    lower.includes("upheld") ||
    lower.includes("uphold") ||
    lower.includes("remit") ||
    lower.includes("set aside") ||
    lower.includes("writ")
  ) {
    return "positive"
  }
  if (
    lower.includes("dismiss") ||
    lower.includes("refuse") ||
    lower.includes("reject") ||
    lower.includes("affirm")
  ) {
    return "negative"
  }
  return "neutral"
}

function summarizeOutcome(outcome: string): string {
  const lower = outcome.toLowerCase()

  // Positive outcomes (check specific terms first)
  if (lower.includes("remit")) return "Remitted"
  if (lower.includes("set aside")) return "Set Aside"
  if (lower.includes("writ")) return "Writs Issued"
  if (lower.includes("uphold") || lower.includes("upheld")) return "Upheld"
  if (lower.includes("allow")) return "Allowed"
  if (lower.includes("grant")) return "Granted"

  // Negative outcomes
  if (lower.includes("dismiss")) return "Dismissed"
  if (lower.includes("affirm")) return "Affirmed"
  if (lower.includes("refuse")) return "Refused"
  if (lower.includes("reject")) return "Rejected"

  // Neutral outcomes
  if (lower.includes("withdrawn")) return "Withdrawn"
  if (lower.includes("discontinu")) return "Discontinued"
  if (lower.includes("consent order")) return "Consent Order"
  if (lower.includes("decision record") || /^decision\b/i.test(outcome.trim()))
    return "Decision"
  if (/^order/i.test(outcome.trim())) return "Orders"

  // Short enough to display as-is (cleaned)
  const trimmed = outcome.replace(/\s+/g, " ").trim()
  if (trimmed.length <= 24) return trimmed

  return "Other"
}

const colorMap: Record<OutcomeType, string> = {
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
  const label = summarizeOutcome(outcome)

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-sm border px-2 py-0.5 text-xs font-medium",
        colorMap[type],
        className
      )}
      title={outcome.replace(/\s+/g, " ").trim()}
    >
      {label}
    </span>
  )
}
