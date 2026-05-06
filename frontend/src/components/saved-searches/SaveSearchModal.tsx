import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bookmark, Edit2 } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import type { CaseFilters, SavedSearch } from "@/types/case";

interface SaveSearchModalProps {
  open: boolean;
  filters: CaseFilters;
  existingNames?: string[];
  editingSearch?: SavedSearch | null;
  onSave: (name: string, filters: CaseFilters) => void;
  onCancel: () => void;
}

export function SaveSearchModal({
  open,
  filters,
  existingNames = [],
  editingSearch = null,
  onSave,
  onCancel,
}: SaveSearchModalProps) {
  if (!open) return null;
  return (
    <SaveSearchModalContent
      key={editingSearch?.id ?? "__new_saved_search__"}
      filters={filters}
      existingNames={existingNames}
      editingSearch={editingSearch}
      onSave={onSave}
      onCancel={onCancel}
    />
  );
}

interface SaveSearchModalContentProps {
  filters: CaseFilters;
  existingNames: string[];
  editingSearch: SavedSearch | null;
  onSave: (name: string, filters: CaseFilters) => void;
  onCancel: () => void;
}

function SaveSearchModalContent({
  filters,
  existingNames,
  editingSearch,
  onSave,
  onCancel,
}: SaveSearchModalContentProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(editingSearch?.name ?? "");
  const [error, setError] = useState<string | null>(null);

  const isEditMode = !!editingSearch;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();

    // Validation
    if (!trimmedName) {
      setError(
        t("saved_searches.error_empty_name", {
          defaultValue: "Search name cannot be empty",
        }),
      );
      return;
    }

    if (trimmedName.length > 50) {
      setError(
        t("saved_searches.error_name_too_long", {
          defaultValue: "Name must be 50 characters or less",
        }),
      );
      return;
    }

    // Check for duplicate names (excluding current search if editing)
    if (
      existingNames.includes(trimmedName) &&
      trimmedName !== editingSearch?.name
    ) {
      setError(
        t("saved_searches.error_duplicate_name", {
          defaultValue: "A search with this name already exists",
        }),
      );
      return;
    }

    // Check that at least one filter is applied
    if (!isEditMode && !hasActiveFilters(filters)) {
      setError(
        t("saved_searches.error_no_filters", {
          defaultValue: "Cannot save a search with no filters applied",
        }),
      );
      return;
    }

    onSave(trimmedName, filters);
  };

  // Generate filter summary
  const filterSummary = generateFilterSummary(filters, t);

  return (
    <Dialog.Root
      open={true}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[var(--color-overlay)]/65" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-6 shadow-lg focus:outline-none"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <form onSubmit={handleSubmit}>
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-accent/10 p-2">
                {isEditMode ? (
                  <Edit2 className="h-5 w-5 text-accent" />
                ) : (
                  <Bookmark className="h-5 w-5 text-accent" />
                )}
              </div>
              <div className="flex-1">
                <Dialog.Title className="text-lg font-semibold text-foreground">
                  {isEditMode
                    ? t("saved_searches.edit_title")
                    : t("saved_searches.save_title")}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-muted-text">
                  {isEditMode
                    ? t("saved_searches.edit_description")
                    : t("saved_searches.save_description")}
                </Dialog.Description>
              </div>
            </div>

            <div className="mt-4">
              <label
                htmlFor="search-name"
                className="block text-sm font-medium text-foreground"
              >
                {t("saved_searches.search_name_label")}
              </label>
              <input
                ref={inputRef}
                id="search-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                placeholder={t("saved_searches.search_name_placeholder")}
                aria-describedby={error ? "save-search-name-error" : undefined}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
              {error && (
                <p
                  id="save-search-name-error"
                  className="mt-1 text-sm text-danger"
                >
                  {error}
                </p>
              )}
            </div>

            {filterSummary && (
              <div className="mt-4 rounded-md bg-surface p-3">
                <p className="text-xs font-medium text-muted-text">
                  {t("saved_searches.current_filters_label")}
                </p>
                <p className="mt-1 text-sm text-foreground">{filterSummary}</p>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-surface"
              >
                {t("common.cancel")}
              </button>
              <button
                type="submit"
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-light"
              >
                {isEditMode
                  ? t("common.update")
                  : t("saved_searches.save_button")}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Check if filters have at least one meaningful value
 */
function hasActiveFilters(filters: CaseFilters): boolean {
  return Boolean(
    filters.court ||
    filters.year ||
    filters.visa_type ||
    filters.nature ||
    filters.source ||
    filters.tag ||
    filters.keyword,
  );
}

/**
 * Generate a human-readable summary of active filters
 * Note: This function is called from inside the component via a closure to access t()
 */
function generateFilterSummary(
  filters: CaseFilters,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const parts: string[] = [];

  if (filters.court) {
    parts.push(filters.court);
  }

  if (filters.year) {
    parts.push(t("saved_searches.filter_year", { year: filters.year }));
  }

  if (filters.visa_type) {
    parts.push(t("saved_searches.filter_visa", { type: filters.visa_type }));
  }

  if (filters.source) {
    parts.push(t("saved_searches.filter_source", { source: filters.source }));
  }

  if (filters.tag) {
    parts.push(t("saved_searches.filter_tag", { tag: filters.tag }));
  }

  if (filters.nature) {
    parts.push(t("saved_searches.filter_nature", { nature: filters.nature }));
  }

  if (filters.keyword) {
    parts.push(`"${filters.keyword}"`);
  }

  if (filters.sort_by && filters.sort_by !== "date") {
    const dir =
      filters.sort_dir === "asc" ? t("cases.ascending") : t("cases.descending");
    parts.push(
      t("saved_searches.filter_sorted_by", {
        field: filters.sort_by,
        direction: dir,
      }),
    );
  }

  return parts.length > 0
    ? parts.join(" • ")
    : t("saved_searches.no_filters_applied");
}
