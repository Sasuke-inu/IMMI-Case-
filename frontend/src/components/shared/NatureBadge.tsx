import { cn } from "@/lib/utils";

// Module-level Map: built once, O(1) lookup per render instead of O(n) find()
const NATURE_COLOR_MAP = new Map<string, string>([
  ["migration", "bg-info/10 text-info border-info/20"],
  ["refugee", "bg-warning/10 text-warning border-warning/20"],
  ["judicial review", "bg-accent/10 text-accent border-accent/20"],
  ["citizenship", "bg-success/10 text-success border-success/20"],
  ["visa cancellation", "bg-danger/10 text-danger border-danger/20"],
  ["deportation", "bg-danger/10 text-danger border-danger/20"],
  ["character", "bg-warning/10 text-warning border-warning/20"],
  ["bridging visa", "bg-primary/10 text-primary border-primary/20"],
]);

const FALLBACK_COLORS = "bg-muted-text/10 text-muted-text border-muted-text/20";

interface NatureBadgeProps {
  nature: string;
  className?: string;
}

export function NatureBadge({ nature, className }: NatureBadgeProps) {
  if (!nature) return null;

  const lower = nature.toLowerCase();
  // First try exact match, then substring match
  let colors = NATURE_COLOR_MAP.get(lower);
  if (!colors) {
    for (const [key, val] of NATURE_COLOR_MAP) {
      if (lower.includes(key)) {
        colors = val;
        break;
      }
    }
  }
  colors ??= FALLBACK_COLORS;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-sm border px-2 py-0.5 text-xs font-medium",
        colors,
        className,
      )}
      title={nature}
    >
      {nature.length > 24 ? nature.slice(0, 22) + "..." : nature}
    </span>
  );
}
