import { useNavigate } from "react-router-dom"
import {
  FileText,
  BookOpen,
  Download,
  Search,
  GitBranch,
  Database,
} from "lucide-react"
import { useStats } from "@/hooks/use-stats"
import { StatCard } from "@/components/dashboard/StatCard"
import { CourtChart } from "@/components/dashboard/CourtChart"
import { CourtBadge } from "@/components/shared/CourtBadge"

export function DashboardPage() {
  const { data: stats, isLoading } = useStats()
  const navigate = useNavigate()

  if (isLoading || !stats) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-text">
        Loading dashboard...
      </div>
    )
  }

  const quickActions = [
    { label: "Search Cases", icon: Search, to: "/search" },
    { label: "Download", icon: Download, to: "/download" },
    { label: "Pipeline", icon: GitBranch, to: "/pipeline" },
    { label: "Update DB", icon: Database, to: "/update-db" },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-text">
          Australian Immigration Case Database Overview
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Cases"
          value={stats.total_cases}
          icon={<FileText className="h-5 w-5" />}
        />
        <StatCard
          title="With Full Text"
          value={stats.with_full_text}
          icon={<BookOpen className="h-5 w-5" />}
          description={`${((stats.with_full_text / stats.total_cases) * 100).toFixed(1)}% coverage`}
        />
        <StatCard
          title="Courts"
          value={Object.keys(stats.courts).length}
          icon={<Database className="h-5 w-5" />}
        />
        <StatCard
          title="Sources"
          value={Object.keys(stats.sources).length}
          icon={<GitBranch className="h-5 w-5" />}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-4 font-heading text-lg font-semibold">
            Cases by Court
          </h2>
          <CourtChart data={stats.courts} type="bar" />
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-4 font-heading text-lg font-semibold">
            Distribution
          </h2>
          <CourtChart data={stats.courts} type="pie" />
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {quickActions.map(({ label, icon: Icon, to }) => (
          <button
            key={to}
            onClick={() => navigate(to)}
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-left transition-all hover:border-accent hover:shadow-md"
          >
            <div className="rounded-md bg-accent-muted p-2 text-accent">
              <Icon className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium text-foreground">
              {label}
            </span>
          </button>
        ))}
      </div>

      {/* Recent cases */}
      {stats.recent_cases && stats.recent_cases.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-4 font-heading text-lg font-semibold">
            Recent Cases
          </h2>
          <div className="space-y-2">
            {stats.recent_cases.slice(0, 5).map((c) => (
              <button
                key={c.case_id}
                onClick={() => navigate(`/cases/${c.case_id}`)}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-surface"
              >
                <CourtBadge court={c.court_code} />
                <span className="flex-1 truncate text-foreground">
                  {c.title || c.citation}
                </span>
                <span className="text-xs text-muted-text">{c.date}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
