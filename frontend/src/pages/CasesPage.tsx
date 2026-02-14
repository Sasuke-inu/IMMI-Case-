import { useState, useCallback } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { ChevronLeft, ChevronRight, List, LayoutGrid, Trash2, Tag } from "lucide-react"
import { useCases, useFilterOptions, useBatchCases } from "@/hooks/use-cases"
import { CourtBadge } from "@/components/shared/CourtBadge"
import { OutcomeBadge } from "@/components/shared/OutcomeBadge"
import { CaseCard } from "@/components/cases/CaseCard"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { CaseFilters } from "@/types/case"

export function CasesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [viewMode, setViewMode] = useState<"table" | "cards">("table")
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const filters: CaseFilters = {
    court: searchParams.get("court") ?? "",
    year: searchParams.get("year") ? Number(searchParams.get("year")) : undefined,
    visa_type: searchParams.get("visa_type") ?? "",
    nature: searchParams.get("nature") ?? "",
    keyword: searchParams.get("keyword") ?? "",
    sort_by: searchParams.get("sort_by") ?? "year",
    sort_dir: (searchParams.get("sort_dir") as "asc" | "desc") ?? "desc",
    page: Number(searchParams.get("page") ?? 1),
    page_size: 50,
  }

  const { data, isLoading } = useCases(filters)
  const { data: filterOpts } = useFilterOptions()
  const batchMutation = useBatchCases()

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams)
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      if (key !== "page") params.set("page", "1")
      setSearchParams(params)
    },
    [searchParams, setSearchParams]
  )

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    if (!data) return
    if (selected.size === data.cases.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(data.cases.map((c) => c.case_id)))
    }
  }, [data, selected.size])

  const handleBatch = useCallback(
    async (action: string) => {
      if (selected.size === 0) return
      const tag = action === "tag" ? prompt("Enter tag:") : undefined
      if (action === "tag" && !tag) return
      try {
        const result = await batchMutation.mutateAsync({
          action,
          ids: Array.from(selected),
          tag: tag ?? undefined,
        })
        toast.success(`${result.affected} cases updated`)
        setSelected(new Set())
      } catch (e) {
        toast.error((e as Error).message)
      }
    },
    [selected, batchMutation]
  )

  const cases = data?.cases ?? []
  const total = data?.total ?? 0
  const totalPages = data?.total_pages ?? 1
  const currentPage = filters.page ?? 1

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Cases</h1>
          <p className="text-sm text-muted-text">{total.toLocaleString()} total cases</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode("table")}
            className={cn(
              "rounded-md p-1.5",
              viewMode === "table"
                ? "bg-accent-muted text-accent"
                : "text-muted-text hover:text-foreground"
            )}
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("cards")}
            className={cn(
              "rounded-md p-1.5",
              viewMode === "cards"
                ? "bg-accent-muted text-accent"
                : "text-muted-text hover:text-foreground"
            )}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => navigate("/cases/add")}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-light"
          >
            Add Case
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={filters.court ?? ""}
          onChange={(e) => updateFilter("court", e.target.value)}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground"
        >
          <option value="">All Courts</option>
          {filterOpts?.courts.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={filters.year?.toString() ?? ""}
          onChange={(e) => updateFilter("year", e.target.value)}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground"
        >
          <option value="">All Years</option>
          {filterOpts?.years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select
          value={filters.nature ?? ""}
          onChange={(e) => updateFilter("nature", e.target.value)}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground"
        >
          <option value="">All Natures</option>
          {filterOpts?.natures.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Keyword filter..."
          defaultValue={filters.keyword}
          onBlur={(e) => updateFilter("keyword", e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") updateFilter("keyword", e.currentTarget.value)
          }}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground placeholder:text-muted-text"
        />
      </div>

      {/* Batch bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-md bg-accent-muted px-4 py-2 text-sm">
          <span className="font-medium text-accent">
            {selected.size} selected
          </span>
          <button
            onClick={() => handleBatch("tag")}
            className="flex items-center gap-1 text-accent hover:text-accent-light"
          >
            <Tag className="h-3.5 w-3.5" /> Tag
          </button>
          <button
            onClick={() => handleBatch("delete")}
            className="flex items-center gap-1 text-danger hover:text-danger/80"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-muted-text hover:text-foreground"
          >
            Clear
          </button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex h-32 items-center justify-center text-muted-text">
          Loading cases...
        </div>
      )}

      {/* Table view */}
      {!isLoading && viewMode === "table" && (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="p-3 text-left">
                  <input
                    type="checkbox"
                    checked={selected.size === cases.length && cases.length > 0}
                    onChange={toggleAll}
                    className="rounded"
                  />
                </th>
                <th className="p-3 text-left font-medium text-secondary-text">Title</th>
                <th className="whitespace-nowrap p-3 text-left font-medium text-secondary-text">Citation</th>
                <th className="p-3 text-left font-medium text-secondary-text">Court</th>
                <th className="whitespace-nowrap p-3 text-left font-medium text-secondary-text">Date</th>
                <th className="p-3 text-left font-medium text-secondary-text">Judges</th>
                <th className="whitespace-nowrap p-3 text-left font-medium text-secondary-text">Visa Type</th>
                <th className="p-3 text-left font-medium text-secondary-text">Outcome</th>
                <th className="p-3 text-left font-medium text-secondary-text">Nature</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr
                  key={c.case_id}
                  className="border-b border-border-light transition-colors hover:bg-surface/50 cursor-pointer"
                  onClick={() => navigate(`/cases/${c.case_id}`)}
                >
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(c.case_id)}
                      onChange={() => toggleSelect(c.case_id)}
                      className="rounded"
                    />
                  </td>
                  <td className="max-w-xs p-3">
                    <span
                      className="line-clamp-1 font-medium text-foreground"
                      title={c.title || c.citation}
                    >
                      {c.title || c.citation}
                    </span>
                  </td>
                  <td
                    className="max-w-[160px] truncate whitespace-nowrap p-3 text-xs text-muted-text"
                    title={c.citation}
                  >
                    {c.citation}
                  </td>
                  <td className="p-3">
                    <CourtBadge court={c.court_code} />
                  </td>
                  <td className="whitespace-nowrap p-3 text-sm text-muted-text">{c.date}</td>
                  <td
                    className="max-w-[140px] truncate p-3 text-xs text-muted-text"
                    title={c.judges}
                  >
                    {c.judges}
                  </td>
                  <td
                    className="max-w-[130px] truncate whitespace-nowrap p-3 text-xs text-muted-text"
                    title={c.visa_type}
                  >
                    {c.visa_type}
                  </td>
                  <td className="max-w-[130px] p-3">
                    <OutcomeBadge outcome={c.outcome} />
                  </td>
                  <td
                    className="max-w-[120px] truncate p-3 text-xs text-muted-text"
                    title={c.case_nature}
                  >
                    {c.case_nature}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Cards view */}
      {!isLoading && viewMode === "cards" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cases.map((c) => (
            <CaseCard
              key={c.case_id}
              case_={c}
              onClick={() => navigate(`/cases/${c.case_id}`)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-text">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <button
              disabled={currentPage <= 1}
              onClick={() => updateFilter("page", String(currentPage - 1))}
              className="rounded-md border border-border p-1.5 text-muted-text hover:bg-surface disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => updateFilter("page", String(currentPage + 1))}
              className="rounded-md border border-border p-1.5 text-muted-text hover:bg-surface disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
