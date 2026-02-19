import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

interface ChartCardProps {
  title: string;
  children: ReactNode;
  isLoading?: boolean;
  isEmpty?: boolean;
  className?: string;
}

export function ChartCard({
  title,
  children,
  isLoading,
  isEmpty,
  className,
}: ChartCardProps) {
  const { t } = useTranslation();

  return (
    <div
      className={`flex h-full flex-col rounded-lg border border-border bg-card p-4 ${className ?? ""}`}
    >
      <h3 className="mb-3 font-heading text-base font-semibold text-foreground">
        {title}
      </h3>
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-text">
          {t("chart.loading")}
        </div>
      ) : isEmpty ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-text">
          {t("chart.no_data")}
        </div>
      ) : (
        <div className="min-h-0 flex-1">{children}</div>
      )}
    </div>
  );
}
