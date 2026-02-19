import { cn } from "@/lib/utils";

interface SpecializationBadgeProps {
  specialty: string;
  caseCount: number;
  successRate: number;
  isHighest?: boolean;
}

/**
 * Badge displaying judge specialization area
 * Highlights judges with high case counts and success rates in specific visa/nature categories
 */
export function SpecializationBadge({
  specialty,
  caseCount,
  successRate,
  isHighest = false,
}: SpecializationBadgeProps) {
  // Determine color based on success rate
  const getColorClass = (rate: number) => {
    if (rate >= 0.75)
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
    if (rate >= 0.6)
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
    return "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200";
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium",
        getColorClass(successRate),
        isHighest && "ring-2 ring-offset-1 ring-accent",
      )}
      title={`${specialty}: ${caseCount} cases, ${(successRate * 100).toFixed(1)}% success rate`}
    >
      <span className="font-semibold">{specialty}</span>
      <span className="opacity-75">
        {caseCount} • {(successRate * 100).toFixed(0)}%
      </span>
    </div>
  );
}
