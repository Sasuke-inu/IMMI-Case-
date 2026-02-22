import { useTranslation } from "react-i18next";
import { ArrowRight, GitBranch, Scale, Building2 } from "lucide-react";
import type { LineageData, CourtLineage } from "@/lib/lineage-data";

interface LineageExplainerProps {
  data: LineageData;
}

/**
 * Educational panel showing court/tribunal lineage transitions
 * Displays 2 lineage paths:
 * - Lower court: FMCA → FCCA → FedCFamC2G
 * - Tribunal: MRTA+RRTA → AATA → ARTA
 */
export function LineageExplainer({ data }: LineageExplainerProps) {
  const { t } = useTranslation();

  if (!data || !data.lineages || data.lineages.length === 0) {
    return null;
  }

  const getLineageIcon = (lineageId: string) => {
    return lineageId === "lower-court" ? Scale : Building2;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <GitBranch className="h-6 w-6 text-accent" />
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            {t("lineage.explainer_title", "Court Lineage Timeline")}
          </h2>
          <p className="text-sm text-muted-text">
            {t(
              "lineage.explainer_subtitle",
              "Understanding Australian immigration court and tribunal succession",
            )}
          </p>
        </div>
      </div>

      {/* Lineage paths */}
      {data.lineages.map((lineage) => (
        <LineagePath key={lineage.id} lineage={lineage} icon={getLineageIcon(lineage.id)} />
      ))}
    </div>
  );
}

interface LineagePathProps {
  lineage: CourtLineage;
  icon: typeof Scale;
}

function LineagePath({ lineage, icon: Icon }: LineagePathProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Lineage header */}
      <div className="flex items-center gap-2 border-b border-border p-4">
        <Icon className="h-5 w-5 text-accent" />
        <h3 className="font-heading text-base font-semibold">
          {lineage.name}
        </h3>
        <span className="ml-auto rounded-full bg-surface px-2 py-0.5 text-xs text-muted-text">
          {lineage.courts.length} courts
        </span>
      </div>

      {/* Timeline visualization */}
      <div className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          {lineage.courts.map((court, index) => (
            <div key={court.code} className="flex items-center gap-2">
              {/* Court badge */}
              <div className="flex flex-col items-center">
                <div className="rounded-md border border-border bg-surface px-3 py-2">
                  <p className="font-mono text-xs font-medium text-accent">
                    {court.code}
                  </p>
                  <p className="text-[10px] text-muted-text">
                    {court.years[0]}–{court.years[1] === 9999 ? "now" : court.years[1]}
                  </p>
                </div>
              </div>

              {/* Arrow and transition (if not last) */}
              {index < lineage.courts.length - 1 && (
                <ArrowRight className="h-5 w-5 flex-shrink-0 text-accent" />
              )}
            </div>
          ))}
        </div>

        {/* Transitions with descriptions */}
        {lineage.transitions && lineage.transitions.length > 0 && (
          <div className="mt-4 space-y-3 border-t border-border-light pt-4">
            <h4 className="text-xs font-medium uppercase tracking-wide text-muted-text">
              {t("lineage.transitions", "Transitions")}
            </h4>
            {lineage.transitions.map((transition, index) => (
              <div
                key={`${transition.from}-${transition.to}`}
                className="flex gap-3 rounded-md bg-surface p-3"
              >
                <div className="flex-shrink-0">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-muted text-xs font-medium text-accent">
                    {transition.year}
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-foreground">
                    <span className="font-mono">{transition.from}</span>
                    {" → "}
                    <span className="font-mono">{transition.to}</span>
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-text">
                    {transition.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
