import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Bookmark, Search, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSavedSearches } from "@/hooks/use-saved-searches";
import { SavedSearchCard } from "./SavedSearchCard";
import type { CaseFilters } from "@/types/case";

interface SavedSearchPanelProps {
  onExecute: (filters: CaseFilters) => void;
  onEdit?: (id: string) => void;
}

export function SavedSearchPanel({ onExecute, onEdit }: SavedSearchPanelProps) {
  const { t } = useTranslation();
  const { savedSearches, deleteSearch, executeSearch, count, limitReached } =
    useSavedSearches();
  const [searchQuery, setSearchQuery] = useState("");

  // Filter saved searches by search query
  const filteredSearches = useMemo(() => {
    if (!searchQuery.trim()) return savedSearches;
    const query = searchQuery.toLowerCase();
    return savedSearches.filter((search) =>
      search.name.toLowerCase().includes(query)
    );
  }, [savedSearches, searchQuery]);

  const handleExecute = (id: string) => {
    executeSearch(id, onExecute);
  };

  const handleEdit = (id: string) => {
    if (onEdit) {
      onEdit(id);
    }
  };

  const handleDelete = (id: string) => {
    deleteSearch(id);
  };

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-3">
      {/* Header with count */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bookmark className="h-4 w-4 text-muted-text" />
          <h3 className="text-sm font-semibold text-foreground">
            {t("saved_searches.title", { defaultValue: "Saved Searches" })}
          </h3>
        </div>
        <span
          data-testid="saved-search-count"
          className={cn(
            "text-xs font-medium",
            limitReached ? "text-amber-600 dark:text-amber-400" : "text-muted-text"
          )}
        >
          {count}/50
        </span>
      </div>

      {/* Limit warning */}
      {limitReached && (
        <div className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/20 dark:text-amber-400">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            {t("saved_searches.limit_reached", {
              defaultValue:
                "You've reached the maximum of 50 saved searches. Delete some to create new ones.",
            })}
          </p>
        </div>
      )}

      {/* Search input */}
      {count > 0 && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-text" />
          <input
            type="text"
            placeholder={t("saved_searches.search_placeholder", {
              defaultValue: "Search saved searches...",
            })}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      )}

      {/* Empty state */}
      {count === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Bookmark className="mb-2 h-8 w-8 text-muted-text/50" />
          <p className="mb-1 text-sm font-medium text-foreground">
            {t("saved_searches.empty_title", {
              defaultValue: "No saved searches yet",
            })}
          </p>
          <p className="text-xs text-muted-text">
            {t("saved_searches.empty_description", {
              defaultValue:
                "Apply filters and click Save Search to create your first saved search.",
            })}
          </p>
        </div>
      )}

      {/* No results from search */}
      {count > 0 && filteredSearches.length === 0 && (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <Search className="mb-2 h-6 w-6 text-muted-text/50" />
          <p className="text-xs text-muted-text">
            {t("saved_searches.no_results", {
              defaultValue: "No searches match your query",
            })}
          </p>
        </div>
      )}

      {/* Saved search list */}
      {filteredSearches.length > 0 && (
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {filteredSearches.map((search) => (
            <SavedSearchCard
              key={search.id}
              search={search}
              onExecute={() => handleExecute(search.id)}
              onEdit={() => handleEdit(search.id)}
              onDelete={() => handleDelete(search.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
