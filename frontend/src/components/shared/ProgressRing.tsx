import { cn } from "@/lib/utils"

interface ProgressRingProps {
  value: number
  max: number
  size?: number
  strokeWidth?: number
  label?: string
  className?: string
}

export function ProgressRing({
  value,
  max,
  size = 120,
  strokeWidth = 8,
  label,
  className,
}: ProgressRingProps) {
  const percentage = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (percentage / 100) * circumference

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute flex flex-col items-center" style={{ marginTop: size * 0.3 }}>
        <span className="text-2xl font-bold text-foreground">{percentage}%</span>
        {label && <span className="text-xs text-muted-text">{label}</span>}
      </div>
    </div>
  )
}
