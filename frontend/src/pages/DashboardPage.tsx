import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import {
  FileText,
  BookOpen,
  Download,
  GitBranch,
  Database,
  BarChart3,
  Table,
  Briefcase,
} from "lucide-react"
import { useStats } from "@/hooks/use-stats"
import { StatCard } from "@/components/dashboard/StatCard"
import { CourtChart } from "@/components/dashboard/CourtChart"
import { CourtBadge } from "@/components/shared/CourtBadge"
import { ProgressRing } from "@/components/shared/ProgressRing"
import { EmptyState } from "@/components/shared/EmptyState"
import { downloadExportFile } from "@/lib/api"

export function DashboardPage() {
  const { data: stats, isLoading } = useStats()
  const navigate = useNavigate()
  const [courtView, setCourtView] = useState<"chart" | "table">("chart")
  const [yearView, setYearView] = useState<"chart" | "table">("chart")

  if (isLoading || !stats) {
    return <div className="flex h-64 items-center justify-center text-muted-text">Loading dashboard...</div>
  }

  // Empty state
  if (stats.total_cases === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-text">Australian Immigration Case Database</p>
        </div>
        <EmptyState
          icon={<FileText className="h-10 w-10" />}
          title="Welcome to IMMI-Case"
          description="Get started by downloading cases from AustLII."
          action={
            <div className="flex flex-col items-center gap-3">
              <div className="grid gap-2 text-left text-sm text-muted-text">
                <p><strong className="text-foreground">Step 1:</strong> Run the Pipeline to crawl, clean &amp; download</p>
                <p><strong className="text-foreground">Step 2:</strong> Browse, filter, and analyse cases</p>
              </div>
              <button
                onClick={() => navigate("/pipeline")}
                className="mt-2 rounded-md bg-accent px-6 py-2 text-sm font-medium text-white hover:bg-accent-light"
              >
                Start Pipeline
              </button>
            </div>
          }
        />
      </div>
    )
  }

  const quickActions = [
    { label: "Download", icon: Download, to: "/download" },
    { label: "Pipeline", icon: GitBranch, to: "/pipeline" },
  ]

  const sortedYears = Object.entries(stats.years).sort(([a], [b]) => Number(b) - Number(a))
  const sortedCourts = Object.entries(stats.courts).sort(([, a], [, b]) => b - a)

  // Top visa types from outcomes
  const topOutcomes = Object.entries(stats.outcomes)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-text">Australian Immigration Case Database Overview</p>
      </div>

      {/* Stat cards + Progress ring */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard title="Total Cases" value={stats.total_cases} icon={<FileText className="h-5 w-5" />} />
        <StatCard
          title="With Full Text"
          value={stats.with_full_text}
          icon={<BookOpen className="h-5 w-5" />}
          description={`${((stats.with_full_text / stats.total_cases) * 100).toFixed(1)}% coverage`}
        />
        <StatCard title="Courts" value={Object.keys(stats.courts).length} icon={<Database className="h-5 w-5" />} />
        <StatCard title="Sources" value={Object.keys(stats.sources).length} icon={<GitBranch className="h-5 w-5" />} />
        <div className="relative flex items-center justify-center rounded-lg border border-border bg-card p-4">
          <ProgressRing
            value={stats.with_full_text}
            max={stats.total_cases}
            size={90}
            strokeWidth={6}
            label="downloaded"
          />
          {stats.with_full_text < stats.total_cases && (
            <button
              onClick={() => navigate("/download")}
              className="absolute bottom-3 text-xs text-accent hover:underline"
            >
              Download More
            </button>
          )}
        </div>
      </div>

      {/* Charts with toggle */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Court distribution */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold">Cases by Court</h2>
            <div className="flex gap-1">
              <button
                onClick={() => setCourtView("chart")}
                className={courtView === "chart" ? "rounded p-1 bg-accent-muted text-accent" : "rounded p-1 text-muted-text hover:text-foreground"}
              >
                <BarChart3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setCourtView("table")}
                className={courtView === "table" ? "rounded p-1 bg-accent-muted text-accent" : "rounded p-1 text-muted-text hover:text-foreground"}
              >
                <Table className="h-4 w-4" />
              </button>
            </div>
          </div>
          {courtView === "chart" ? (
            <CourtChart data={stats.courts} type="bar" />
          ) : (
            <div className="space-y-1.5">
              {sortedCourts.map(([court, count]) => (
                <Link
                  key={court}
                  to={`/cases?court=${court}`}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-surface"
                >
                  <CourtBadge court={court} />
                  <span className="font-mono text-sm text-foreground">{count.toLocaleString()}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Year distribution */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold">Cases by Year</h2>
            <div className="flex gap-1">
              <button
                onClick={() => setYearView("chart")}
                className={yearView === "chart" ? "rounded p-1 bg-accent-muted text-accent" : "rounded p-1 text-muted-text hover:text-foreground"}
              >
                <BarChart3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setYearView("table")}
                className={yearView === "table" ? "rounded p-1 bg-accent-muted text-accent" : "rounded p-1 text-muted-text hover:text-foreground"}
              >
                <Table className="h-4 w-4" />
              </button>
            </div>
          </div>
          {yearView === "chart" ? (
            <CourtChart data={stats.years} type="bar" />
          ) : (
            <div className="max-h-64 space-y-1 overflow-auto">
              {sortedYears.map(([year, count]) => (
                <Link
                  key={year}
                  to={`/cases?year=${year}`}
                  className="flex items-center justify-between rounded-md px-2 py-1 text-sm hover:bg-surface"
                >
                  <span className="font-mono text-foreground">{year}</span>
                  <span className="text-muted-text">{count.toLocaleString()}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Outcomes summary */}
      {topOutcomes.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 font-heading text-lg font-semibold">Top Outcomes</h2>
          <div className="flex flex-wrap gap-2">
            {topOutcomes.map(([outcome, count]) => (
              <Link
                key={outcome}
                to={`/cases?keyword=${encodeURIComponent(outcome)}`}
                className="flex items-center gap-2 rounded-md border border-border-light px-3 py-1.5 text-sm hover:bg-surface"
              >
                <Briefcase className="h-3.5 w-3.5 text-muted-text" />
                <span className="text-foreground">{outcome}</span>
                <span className="font-mono text-xs text-muted-text">{count.toLocaleString()}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions + Export */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {quickActions.map(({ label, icon: Icon, to }) => (
          <button
            key={to}
            onClick={() => navigate(to)}
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-left transition-all hover:border-accent hover:shadow-md"
          >
            <div className="rounded-md bg-accent-muted p-2 text-accent">
              <Icon className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium text-foreground">{label}</span>
          </button>
        ))}
        <button
          onClick={() => downloadExportFile("csv")}
          className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-left transition-all hover:border-accent hover:shadow-md"
        >
          <div className="rounded-md bg-accent-muted p-2 text-accent">
            <Download className="h-4 w-4" />
          </div>
          <span className="text-sm font-medium text-foreground">Export CSV</span>
        </button>
        <button
          onClick={() => downloadExportFile("json")}
          className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-left transition-all hover:border-accent hover:shadow-md"
        >
          <div className="rounded-md bg-accent-muted p-2 text-accent">
            <Download className="h-4 w-4" />
          </div>
          <span className="text-sm font-medium text-foreground">Export JSON</span>
        </button>
      </div>

      {/* Recent cases */}
      {stats.recent_cases && stats.recent_cases.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-4 font-heading text-lg font-semibold">Recent Cases</h2>
          <div className="space-y-1">
            {stats.recent_cases.slice(0, 5).map((c) => (
              <button
                key={c.case_id}
                onClick={() => navigate(`/cases/${c.case_id}`)}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-surface"
              >
                <CourtBadge court={c.court_code} />
                <span className="flex-1 truncate text-foreground" title={c.title || c.citation}>
                  {c.title || c.citation}
                </span>
                <span className="shrink-0 text-xs text-muted-text whitespace-nowrap">{c.date}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
