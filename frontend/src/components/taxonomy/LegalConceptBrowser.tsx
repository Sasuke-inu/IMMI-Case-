import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Tag } from "lucide-react";
import { useLegalConcepts } from "@/hooks/use-taxonomy";
import { cn } from "@/lib/utils";
import type { LegalConceptEntry } from "@/lib/api";

export function LegalConceptBrowser() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Fetch legal concepts data
  const { data, isLoading } = useLegalConcepts();

  const concepts = data?.concepts ?? [];

  const handleConceptClick = useCallback(
    (concept: LegalConceptEntry) => {
      // Navigate to cases page with legal concept filter
      navigate(`/cases?legal_concepts=${encodeURIComponent(concept.name)}`);
    },
    [navigate],
  );

  return (
    <div className="space-y-3">
      {/* Header */}
      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">
          {t("taxonomy.legal_concepts", {
            defaultValue: "Legal Concepts Browser",
          })}
        </h2>
        <p className="mt-0.5 text-sm text-muted-text">
          {t("taxonomy.legal_concepts_desc", {
            defaultValue: "Browse cases by 34 canonical legal concept categories",
          })}
        </p>
      </div>

      {/* Concepts Grid */}
      {isLoading ? (
        <div className="rounded-md border border-border bg-card p-6 text-center text-sm text-muted-text">
          {t("common.loading", { defaultValue: "Loading..." })}
        </div>
      ) : concepts.length === 0 ? (
        <div className="rounded-md border border-border bg-card p-6 text-center">
          <Tag className="mx-auto h-8 w-8 text-muted-text" />
          <p className="mt-2 text-sm text-muted-text">
            {t("taxonomy.no_concepts", {
              defaultValue: "No legal concepts available",
            })}
          </p>
        </div>
      ) : (
        <div className="rounded-md border border-border bg-card p-4">
          <div className="flex flex-wrap gap-2">
            {concepts.map((concept) => (
              <button
                key={concept.id}
                onClick={() => handleConceptClick(concept)}
                className={cn(
                  "group inline-flex items-center gap-1.5 rounded-full px-3 py-1.5",
                  "border border-border bg-surface text-sm font-medium transition-all",
                  "hover:border-accent hover:bg-accent-muted hover:text-accent",
                  "focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1",
                )}
                title={concept.description}
              >
                <Tag className="h-3.5 w-3.5 text-muted-text group-hover:text-accent transition-colors" />
                <span className="text-foreground group-hover:text-accent transition-colors">
                  {concept.name}
                </span>
                <span
                  className={cn(
                    "ml-0.5 rounded-full bg-accent-muted px-1.5 py-0.5 text-xs font-semibold text-accent",
                    "group-hover:bg-accent group-hover:text-white transition-colors",
                  )}
                >
                  {concept.case_count.toLocaleString()}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      {!isLoading && concepts.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-text">
          <Tag className="h-3.5 w-3.5" />
          <span>
            {t("taxonomy.concepts_summary", {
              defaultValue: "{{count}} canonical legal concepts",
              count: concepts.length,
            })}
          </span>
        </div>
      )}
    </div>
  );
}
