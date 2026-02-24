import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

type OutcomeType = "positive" | "negative" | "neutral";

function classifyOutcome(outcome: string): OutcomeType {
  const lower = outcome.toLowerCase();
  if (
    lower.includes("allow") ||
    lower.includes("grant") ||
    lower.includes("upheld") ||
    lower.includes("uphold") ||
    lower.includes("remit") ||
    lower.includes("set aside") ||
    lower.includes("writ") ||
    lower.includes("quash")
  ) {
    return "positive";
  }
  if (
    lower.includes("dismiss") ||
    lower.includes("refuse") ||
    lower.includes("reject") ||
    lower.includes("affirm") ||
    lower.includes("cancel")
  ) {
    return "negative";
  }
  return "neutral";
}

function summarizeOutcome(outcome: string): { key: string; fallback: string } {
  const lower = outcome.toLowerCase();

  // Positive outcomes (check specific terms first)
  if (lower.includes("remit"))
    return { key: "outcomes.remitted", fallback: "Remitted" };
  if (lower.includes("set aside"))
    return { key: "outcomes.set_aside", fallback: "Set Aside" };
  if (lower.includes("writ"))
    return { key: "outcomes.writs_issued", fallback: "Writs Issued" };
  if (lower.includes("uphold") || lower.includes("upheld"))
    return { key: "outcomes.upheld", fallback: "Upheld" };
  if (lower.includes("allow"))
    return { key: "outcomes.allowed", fallback: "Allowed" };
  if (lower.includes("grant"))
    return { key: "outcomes.granted", fallback: "Granted" };
  if (lower.includes("quash"))
    return { key: "outcomes.quashed", fallback: "Quashed" };

  // Negative outcomes
  if (lower.includes("dismiss"))
    return { key: "outcomes.dismissed", fallback: "Dismissed" };
  if (lower.includes("affirm"))
    return { key: "outcomes.affirmed", fallback: "Affirmed" };
  if (lower.includes("refuse"))
    return { key: "outcomes.refused", fallback: "Refused" };
  if (lower.includes("reject"))
    return { key: "outcomes.rejected", fallback: "Rejected" };
  if (lower.includes("cancel"))
    return { key: "outcomes.cancelled", fallback: "Cancelled" };

  // Neutral outcomes
  if (lower.includes("no jurisdiction"))
    return { key: "outcomes.no_jurisdiction", fallback: "No Jurisdiction" };
  if (lower.includes("varied"))
    return { key: "outcomes.varied", fallback: "Varied" };
  if (lower.includes("withdrawn"))
    return { key: "outcomes.withdrawn", fallback: "Withdrawn" };
  if (lower.includes("discontinu"))
    return { key: "outcomes.discontinued", fallback: "Discontinued" };
  if (lower.includes("consent order"))
    return { key: "outcomes.consent_order", fallback: "Consent Order" };
  if (lower.includes("decision record") || /^decision\b/i.test(outcome.trim()))
    return { key: "outcomes.decision", fallback: "Decision" };
  if (/^order/i.test(outcome.trim()))
    return { key: "outcomes.orders", fallback: "Orders" };

  // Short enough to display as-is (cleaned)
  const trimmed = outcome.replace(/\s+/g, " ").trim();
  if (trimmed.length <= 24) return { key: "", fallback: trimmed };

  return { key: "outcomes.other", fallback: "Other" };
}

const colorMap: Record<OutcomeType, string> = {
  positive: "bg-success/10 text-success border-success/20",
  negative: "bg-danger/10 text-danger border-danger/20",
  neutral: "bg-muted-text/10 text-muted-text border-muted-text/20",
};

interface OutcomeBadgeProps {
  outcome: string;
  className?: string;
}

export function OutcomeBadge({ outcome, className }: OutcomeBadgeProps) {
  const { t } = useTranslation();
  if (!outcome) return null;
  const type = classifyOutcome(outcome);
  const { key, fallback } = summarizeOutcome(outcome);
  const label = key ? t(key, { defaultValue: fallback }) : fallback;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-sm border px-2 py-0.5 text-xs font-medium",
        colorMap[type],
        className,
      )}
      title={outcome.replace(/\s+/g, " ").trim()}
    >
      {label}
    </span>
  );
}
