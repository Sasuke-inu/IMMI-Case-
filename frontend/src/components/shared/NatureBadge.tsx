import { cn } from "@/lib/utils"

const natureColorMap: Record<string, string> = {
  "Migration": "bg-info/10 text-info border-info/20",
  "Refugee": "bg-warning/10 text-warning border-warning/20",
  "Judicial Review": "bg-accent/10 text-accent border-accent/20",
  "Citizenship": "bg-success/10 text-success border-success/20",
  "Visa Cancellation": "bg-danger/10 text-danger border-danger/20",
  "Deportation": "bg-danger/10 text-danger border-danger/20",
  "Character": "bg-warning/10 text-warning border-warning/20",
  "Bridging Visa": "bg-primary/10 text-primary border-primary/20",
}

interface NatureBadgeProps {
  nature: string
  className?: string
}

export function NatureBadge({ nature, className }: NatureBadgeProps) {
  if (!nature) return null

  const colors = Object.entries(natureColorMap).find(([key]) =>
    nature.toLowerCase().includes(key.toLowerCase())
  )?.[1] ?? "bg-muted-text/10 text-muted-text border-muted-text/20"

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-sm border px-2 py-0.5 text-xs font-medium",
        colors,
        className
      )}
      title={nature}
    >
      {nature.length > 24 ? nature.slice(0, 22) + "..." : nature}
    </span>
  )
}
