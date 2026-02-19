import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Search, ChevronRight } from "lucide-react";
import {
  useLegislations,
  useLegislationSearch,
} from "@/hooks/use-legislations";
import { Breadcrumb } from "@/components/shared/Breadcrumb";
import { Pagination } from "@/components/shared/Pagination";
import { EmptyState } from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils";
import type { Legislation } from "@/lib/api";

function formatDateCompact(date: string): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function LegislationsPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Extract query params
  const searchQuery = searchParams.get("q") ?? "";
  const page = Number(searchParams.get("page") ?? 1);
  const limit = 20;

  // State for search input with debounce
  const [inputValue, setInputValue] = useState(searchQuery);

  // Debounce timer ref
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Use appropriate hook based on whether we're searching
  const { data: paginatedData, isLoading: paginatedLoading } = useLegislations(
    searchQuery ? 1 : page,
    limit,
  );
  const { data: searchData, isLoading: searchLoading } = useLegislationSearch(
    searchQuery,
    limit,
  );

  // Combine results
  const data = searchQuery ? searchData : paginatedData;
  const isLoading = searchQuery ? searchLoading : paginatedLoading;

  const legislations = useMemo(() => {
    if (!data) return [];
    if (searchQuery) {
      return (data as any).data || [];
    }
    return (data as any).data || [];
  }, [data, searchQuery]);

  const totalItems = useMemo(() => {
    if (searchQuery) {
      return (searchData as any)?.meta?.total_results ?? 0;
    }
    return (paginatedData as any)?.meta?.total ?? 0;
  }, [paginatedData, searchData, searchQuery]);

  const totalPages = useMemo(() => {
    if (searchQuery) return 1;
    return (paginatedData as any)?.meta?.pages ?? 1;
  }, [paginatedData, searchQuery]);

  // Handle search input change with debounce
  const handleSearchChange = useCallback(
    (value: string) => {
      setInputValue(value);

      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Set new timer
      const timer = setTimeout(() => {
        const params = new URLSearchParams();
        if (value) {
          params.set("q", value);
          params.set("page", "1");
        } else {
          params.delete("q");
          params.set("page", "1");
        }
        setSearchParams(params);
      }, 300);

      // Store timer in ref for cleanup
      debounceTimerRef.current = timer;
    },
    [setSearchParams],
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      const params = new URLSearchParams(searchParams);
      params.set("page", String(newPage));
      setSearchParams(params);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [searchParams, setSearchParams],
  );

  const handleLegislationClick = useCallback(
    (id: string) => {
      navigate(`/legislations/${id}`);
    },
    [navigate],
  );

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: t("common.dashboard"), href: "/" },
          { label: t("legislations.title", { defaultValue: "Legislations" }) },
        ]}
      />

      {/* Header */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          {t("legislations.title", { defaultValue: "Legislations" })}
        </h1>
        <p className="mt-1 text-sm text-secondary-text">
          {t("legislations.description", {
            defaultValue:
              "Browse and search legislation relevant to immigration law",
          })}
        </p>
      </div>

      {/* Search Bar */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-text" />
          <input
            type="text"
            placeholder={t("common.search", {
              defaultValue: "Search legislations...",
            })}
            value={inputValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            className={cn(
              "w-full rounded-md border border-border bg-surface px-3 py-2 pl-10 text-sm",
              "text-foreground placeholder:text-muted-text",
              "focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50",
            )}
          />
        </div>
      </div>

      {/* Legislations List */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center text-muted-text">
          {t("common.loading_ellipsis")}
        </div>
      ) : legislations.length === 0 ? (
        <EmptyState
          icon="BookOpen"
          title={
            searchQuery
              ? t("common.no_results", { defaultValue: "No results found" })
              : t("common.no_data", { defaultValue: "No legislations" })
          }
          description={
            searchQuery
              ? t("common.try_different_search", {
                  defaultValue: "Try adjusting your search terms",
                })
              : t("legislations.no_data_description", {
                  defaultValue: "No legislations available yet",
                })
          }
        />
      ) : (
        <div className="space-y-3">
          {legislations.map((leg: Legislation) => (
            <button
              key={leg.id}
              onClick={() => handleLegislationClick(leg.id)}
              className={cn(
                "w-full rounded-lg border border-border bg-card p-4 text-left",
                "transition-colors hover:border-accent hover:bg-surface",
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  {/* Title and Shortcode */}
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading text-base font-semibold text-foreground">
                      {leg.title}
                    </h3>
                    {leg.shortcode && (
                      <span className="inline-flex items-center rounded-md bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                        {leg.shortcode}
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  {leg.description && (
                    <p className="mt-1.5 line-clamp-2 text-sm text-secondary-text">
                      {leg.description}
                    </p>
                  )}

                  {/* Metadata */}
                  <div className="mt-2.5 flex flex-wrap gap-3 text-xs text-muted-text">
                    {leg.jurisdiction && (
                      <div className="flex items-center gap-1">
                        <span className="font-medium">
                          {t("legislations.jurisdiction", {
                            defaultValue: "Jurisdiction",
                          })}
                          :
                        </span>
                        <span>{leg.jurisdiction}</span>
                      </div>
                    )}
                    {leg.type && (
                      <div className="flex items-center gap-1">
                        <span className="font-medium">
                          {t("legislations.type", { defaultValue: "Type" })}:
                        </span>
                        <span>{leg.type}</span>
                      </div>
                    )}
                    {leg.sections && (
                      <div className="flex items-center gap-1">
                        <span className="font-medium">
                          {t("legislations.sections", {
                            defaultValue: "Sections",
                          })}
                          :
                        </span>
                        <span>{leg.sections}</span>
                      </div>
                    )}
                    {leg.updated_date && (
                      <div className="flex items-center gap-1">
                        <span className="font-medium">
                          {t("legislations.updated", {
                            defaultValue: "Updated",
                          })}
                          :
                        </span>
                        <span>{formatDateCompact(leg.updated_date)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Chevron */}
                <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-muted-text transition-transform group-hover:translate-x-0.5" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!searchQuery && legislations.length > 0 && (
        <div className="flex justify-center pt-4">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={limit}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </div>
  );
}
