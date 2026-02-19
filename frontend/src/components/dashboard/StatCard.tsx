import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  description?: string;
  className?: string;
}

export function StatCard({
  title,
  value,
  icon,
  description,
  className,
}: StatCardProps) {
  // i18n support ready; currently all text comes from props
  useTranslation();
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md",
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-secondary-text">{title}</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          {description && (
            <p className="mt-1 text-xs text-muted-text">{description}</p>
          )}
        </div>
        <div className="rounded-md bg-accent-muted p-2 text-accent">{icon}</div>
      </div>
    </div>
  );
}
