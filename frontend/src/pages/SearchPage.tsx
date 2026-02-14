import { useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Search, Play, Loader2 } from "lucide-react"
import { useSearchCases } from "@/hooks/use-cases"
import { useQuery, useMutation } from "@tanstack/react-query"
import { startSearch, fetchJobStatus } from "@/lib/api"
import { CourtBadge } from "@/components/shared/CourtBadge"
import { OutcomeBadge } from "@/components/shared/OutcomeBadge"
import { toast } from "sonner"

export function SearchPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState("")
  const [submitted, setSubmitted] = useState("")
  const { data: searchResults, isLoading: searching } = useSearchCases(submitted)

  // Background search job
  const [jobParams, setJobParams] = useState({
    databases: "AATA,FCA,ARTA",
    start_year: "2020",
    end_year: new Date().getFullYear().toString(),
    max_results: "500",
  })

  const { data: jobStatus } = useQuery({
    queryKey: ["job-status"],
    queryFn: fetchJobStatus,
    refetchInterval: (query) =>
      query.state.data?.running ? 2000 : false,
  })

  const startMutation = useMutation({
    mutationFn: () =>
      startSearch({
        databases: jobParams.databases.split(",").map((s) => s.trim()),
        start_year: Number(jobParams.start_year),
        end_year: Number(jobParams.end_year),
        max_results: Number(jobParams.max_results),
      }),
    onSuccess: () => toast.success("Search job started"),
    onError: (e) => toast.error(e.message),
  })

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      setSubmitted(query)
    },
    [query]
  )

  const cases = searchResults?.cases ?? []

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Search</h1>

      {/* Full-text search */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-3 font-heading text-lg font-semibold">Full-Text Search</h2>
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-text" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search case text, citations, catchwords..."
              className="w-full rounded-md border border-border bg-surface py-2 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-light"
          >
            Search
          </button>
        </form>

        {/* Results */}
        {searching && (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-text">
            <Loader2 className="h-4 w-4 animate-spin" /> Searching...
          </div>
        )}

        {!searching && submitted && (
          <div className="mt-4">
            <p className="mb-3 text-sm text-muted-text">
              {cases.length} result{cases.length !== 1 ? "s" : ""} for &ldquo;{submitted}&rdquo;
            </p>
            <div className="space-y-2">
              {cases.map((c) => (
                <button
                  key={c.case_id}
                  onClick={() => navigate(`/cases/${c.case_id}`)}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-surface"
                >
                  <CourtBadge court={c.court_code} />
                  <span className="flex-1 truncate font-medium text-foreground">
                    {c.title || c.citation}
                  </span>
                  <OutcomeBadge outcome={c.outcome} />
                  <span className="text-xs text-muted-text">{c.date}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Background scrape search */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-3 font-heading text-lg font-semibold">
          Scrape New Cases
        </h2>
        <p className="mb-4 text-sm text-muted-text">
          Start a background job to scrape cases from AustLII.
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-text">
              Databases
            </label>
            <input
              type="text"
              value={jobParams.databases}
              onChange={(e) =>
                setJobParams((p) => ({ ...p, databases: e.target.value }))
              }
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-text">
              Start Year
            </label>
            <input
              type="number"
              value={jobParams.start_year}
              onChange={(e) =>
                setJobParams((p) => ({ ...p, start_year: e.target.value }))
              }
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-text">
              End Year
            </label>
            <input
              type="number"
              value={jobParams.end_year}
              onChange={(e) =>
                setJobParams((p) => ({ ...p, end_year: e.target.value }))
              }
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-text">
              Max Results/DB
            </label>
            <input
              type="number"
              value={jobParams.max_results}
              onChange={(e) =>
                setJobParams((p) => ({ ...p, max_results: e.target.value }))
              }
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={() => startMutation.mutate()}
            disabled={jobStatus?.running || startMutation.isPending}
            className="flex items-center gap-1 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-light disabled:opacity-50"
          >
            <Play className="h-4 w-4" />
            {jobStatus?.running ? "Running..." : "Start Search"}
          </button>
          {jobStatus?.running && (
            <span className="flex items-center gap-2 text-sm text-muted-text">
              <Loader2 className="h-4 w-4 animate-spin" />
              {jobStatus.message}
              {jobStatus.progress !== undefined && jobStatus.total !== undefined && (
                <span>
                  ({jobStatus.progress}/{jobStatus.total})
                </span>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
