import type { SavedSearch, CaseFilters } from "@/types/case";

const STORAGE_KEY = "saved-searches";

/**
 * Load all saved searches from localStorage
 */
export function loadSavedSearches(): SavedSearch[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Save all searches to localStorage
 */
export function saveSavedSearches(searches: SavedSearch[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(searches));
}

/**
 * Add a new saved search
 */
export function addSavedSearch(
  name: string,
  filters: CaseFilters
): SavedSearch {
  const searches = loadSavedSearches();
  const newSearch: SavedSearch = {
    id: generateSearchId(),
    name: name.trim(),
    filters,
    createdAt: new Date().toISOString(),
  };
  const updated = [...searches, newSearch];
  saveSavedSearches(updated);
  return newSearch;
}

/**
 * Update an existing saved search
 */
export function updateSavedSearch(
  id: string,
  updates: Partial<Omit<SavedSearch, "id" | "createdAt">>
): SavedSearch | null {
  const searches = loadSavedSearches();
  const index = searches.findIndex((s) => s.id === id);
  if (index === -1) return null;

  const updated = { ...searches[index], ...updates };
  searches[index] = updated;
  saveSavedSearches(searches);
  return updated;
}

/**
 * Delete a saved search by ID
 */
export function deleteSavedSearch(id: string): boolean {
  const searches = loadSavedSearches();
  const filtered = searches.filter((s) => s.id !== id);
  if (filtered.length === searches.length) return false;

  saveSavedSearches(filtered);
  return true;
}

/**
 * Get a single saved search by ID
 */
export function getSavedSearchById(id: string): SavedSearch | null {
  const searches = loadSavedSearches();
  return searches.find((s) => s.id === id) || null;
}

/**
 * Update the last executed timestamp and result count
 */
export function markSearchExecuted(
  id: string,
  resultCount: number
): SavedSearch | null {
  return updateSavedSearch(id, {
    lastExecutedAt: new Date().toISOString(),
    resultCount,
  });
}

/**
 * Generate a unique ID for a saved search
 */
function generateSearchId(): string {
  return `search_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Encode filters to URL search params
 */
export function encodeFiltersToUrl(filters: CaseFilters): string {
  const params = new URLSearchParams();

  if (filters.court) params.set("court", filters.court);
  if (filters.year) params.set("year", String(filters.year));
  if (filters.visa_type) params.set("visa_type", filters.visa_type);
  if (filters.nature) params.set("nature", filters.nature);
  if (filters.source) params.set("source", filters.source);
  if (filters.tag) params.set("tag", filters.tag);
  if (filters.keyword) params.set("keyword", filters.keyword);
  if (filters.sort_by) params.set("sort_by", filters.sort_by);
  if (filters.sort_dir) params.set("sort_dir", filters.sort_dir);

  // Always start at page 1 for shared searches
  params.set("page", "1");

  return params.toString();
}

/**
 * Decode URL search params to filters
 */
export function decodeUrlToFilters(searchParams: URLSearchParams): CaseFilters {
  const filters: CaseFilters = {
    court: searchParams.get("court") ?? "",
    year: searchParams.get("year") ? Number(searchParams.get("year")) : undefined,
    visa_type: searchParams.get("visa_type") ?? "",
    nature: searchParams.get("nature") ?? "",
    source: searchParams.get("source") ?? "",
    tag: searchParams.get("tag") ?? "",
    keyword: searchParams.get("keyword") ?? "",
    sort_by: searchParams.get("sort_by") ?? "date",
    sort_dir: (searchParams.get("sort_dir") as "asc" | "desc") ?? "desc",
    page: Number(searchParams.get("page") ?? 1),
    page_size: 100,
  };

  return filters;
}

/**
 * Generate a shareable URL for a saved search
 */
export function generateShareableUrl(filters: CaseFilters): string {
  const params = encodeFiltersToUrl(filters);
  const baseUrl = `${window.location.origin}/cases`;
  return params ? `${baseUrl}?${params}` : baseUrl;
}
