import { cn } from "@/lib/utils"

const courtColorMap: Record<string, string> = {
  AATA: "bg-court-aata",
  ARTA: "bg-court-arta",
  FCA: "bg-court-fca",
  FCCA: "bg-court-fcca",
  FedCFamC2G: "bg-court-fedc",
  HCA: "bg-court-hca",
  RRTA: "bg-court-rrta",
  MRTA: "bg-court-mrta",
  FMCA: "bg-court-fmca",
}

interface CourtBadgeProps {
  court: string
  className?: string
}

export function CourtBadge({ court, className }: CourtBadgeProps) {
  const bg = courtColorMap[court] ?? "bg-primary-lighter"

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-sm px-2 py-0.5 text-xs font-medium text-white",
        bg,
        className
      )}
    >
      {court}
    </span>
  )
}
