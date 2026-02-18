import type { ReactNode } from "react"

interface ChartCardProps {
  title: string
  children: ReactNode
  isLoading?: boolean
  isEmpty?: boolean
  className?: string
}

export function ChartCard({ title, children, isLoading, isEmpty, className }: ChartCardProps) {
  return (
    <div className={`rounded-lg border border-border bg-card p-4 ${className ?? ""}`}>
      <h3 className="mb-3 font-heading text-base font-semibold text-foreground">{title}</h3>
      {isLoading ? (
        <div className="flex h-48 items-center justify-center text-sm text-muted-text">Loading...</div>
      ) : isEmpty ? (
        <div className="flex h-48 items-center justify-center text-sm text-muted-text">No data available</div>
      ) : (
        children
      )}
    </div>
  )
}
