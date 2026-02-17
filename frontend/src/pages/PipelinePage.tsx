import { useState, useCallback } from "react"
import {
  GitBranch, Play, Square, Loader2, Zap, Database, Download,
  ChevronDown, ChevronUp, AlertCircle, CheckCircle, Clock,
} from "lucide-react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { fetchPipelineStatus, pipelineAction } from "@/lib/api"
import { useStats } from "@/hooks/use-stats"
import { StatCard } from "@/components/dashboard/StatCard"
import { DatabaseCard } from "@/components/shared/DatabaseCard"
import { toast } from "sonner"

const DATABASES = [
  { code: "ARTA", name: "Administrative Review Tribunal", badge: "New" as const, badgeColor: "success" as const },
  { code: "FCA", name: "Federal Court of Australia" },
  { code: "FedCFamC2G", name: "Federal Circuit & Family Court (Div 2)" },
  { code: "HCA", name: "High Court of Australia" },
  { code: "FCCA", name: "Federal Circuit Court of Australia" },
  { code: "AATA", name: "Administrative Appeals Tribunal", badge: "Ended Oct 2024" as const, badgeColor: "warning" as const },
]

const currentYear = new Date().getFullYear()

interface PipelineStatus {
  running?: boolean
  phase?: string
  phase_progress?: string
  overall_progress?: number
  config?: Record<string, unknown>
  phases_completed?: string[]
  stats?: {
    crawl: { total_found: number; new_added: number; strategies_used: Record<string, number> }
    clean: { year_fixed: number; dupes_removed: number; validated: number }
    download: { downloaded: number; failed: number; skipped: number; retried: number }
  }
  errors?: string[]
  log?: Array<{ timestamp: string; phase: string; level: string; category: string; message: string }>
  current_strategy?: string
  stop_requested?: boolean
}

export function PipelinePage() {
  const qc = useQueryClient()
  const { data: stats } = useStats()

  const [selectedDbs, setSelectedDbs] = useState<Set<string>>(
    new Set(["ARTA", "FCA", "FedCFamC2G", "HCA", "FCCA"])
  )
  const [startYear, setStartYear] = useState(currentYear - 1)
  const [endYear, setEndYear] = useState(currentYear)
  const [delay, setDelay] = useState("0.5")
  const [showCustom, setShowCustom] = useState(false)
  const [logExpanded, setLogExpanded] = useState(true)

  const { data: status } = useQuery<PipelineStatus>({
    queryKey: ["pipeline-status"],
    queryFn: fetchPipelineStatus,
    refetchInterval: (query) => {
      const data = query.state.data as PipelineStatus | undefined
      return data?.running ? 2000 : 10000
    },
  })

  const actionMutation = useMutation({
    mutationFn: (payload: { action: string; params?: Record<string, unknown> }) =>
      pipelineAction(payload.action, payload.params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pipeline-status"] })
      toast.success("Pipeline action executed")
    },
    onError: (e) => toast.error(e.message),
  })

  const toggleDb = useCallback((code: string) => {
    setSelectedDbs((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }, [])

  const startPreset = (preset: "quick" | "full" | "download") => {
    const params: Record<string, unknown> = {}
    if (preset === "quick") {
      params.databases = ["ARTA", "FCA", "FedCFamC2G", "HCA", "FCCA"]
      params.start_year = currentYear - 1
      params.end_year = currentYear
      params.delay = 0.5
    } else if (preset === "full") {
      params.databases = ["ARTA", "FCA", "FedCFamC2G", "HCA", "FCCA", "AATA"]
      params.start_year = 2010
      params.end_year = currentYear
      params.delay = 1.0
    } else {
      params.databases = ["ARTA", "FCA", "FedCFamC2G", "HCA", "FCCA"]
      params.download_only = true
    }
    actionMutation.mutate({ action: "start", params })
  }

  const startCustom = () => {
    actionMutation.mutate({
      action: "start",
      params: {
        databases: Array.from(selectedDbs),
        start_year: startYear,
        end_year: endYear,
        delay: Number(delay),
      },
    })
  }

  const running = status?.running ?? false
  const phase = status?.phase
  const pipelineStats = status?.stats
  const logs = status?.log ?? []
  const errors = status?.errors ?? []
  const phasesCompleted = status?.phases_completed ?? []
  const overallProgress = status?.overall_progress ?? 0

  const PHASES = [
    { id: "crawl", label: "Crawl", icon: Database, desc: "Browse AustLII year listings, extract case metadata" },
    { id: "clean", label: "Clean", icon: GitBranch, desc: "Deduplicate, fix years, validate records" },
    { id: "download", label: "Download", icon: Download, desc: "Fetch full text, extract structured fields" },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <GitBranch className="h-6 w-6 text-accent" />
        <h1 className="text-2xl font-semibold text-foreground">Smart Pipeline</h1>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard title="Total Cases" value={stats?.total_cases ?? 0} icon={<Database className="h-5 w-5" />} />
        <StatCard title="With Full Text" value={stats?.with_full_text ?? 0} icon={<Download className="h-5 w-5" />} />
        <StatCard title="Courts" value={Object.keys(stats?.courts ?? {}).length} icon={<GitBranch className="h-5 w-5" />} />
        <StatCard
          title="Pipeline"
          value={running ? "Running" : "Idle"}
          icon={running ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
        />
      </div>

      {/* Quick Presets */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-3 font-heading text-base font-semibold">Quick Presets</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <button
            onClick={() => startPreset("quick")}
            disabled={running || actionMutation.isPending}
            className="flex flex-col items-center gap-2 rounded-lg border border-border p-5 transition-all hover:border-accent hover:shadow-md disabled:opacity-50"
          >
            <div className="rounded-full bg-accent-muted p-3 text-accent">
              <Zap className="h-6 w-6" />
            </div>
            <span className="font-medium text-foreground">Quick Update</span>
            <span className="text-xs text-muted-text text-center">
              Active courts, {currentYear - 1}-{currentYear}
            </span>
          </button>
          <button
            onClick={() => startPreset("full")}
            disabled={running || actionMutation.isPending}
            className="flex flex-col items-center gap-2 rounded-lg border border-border p-5 transition-all hover:border-accent hover:shadow-md disabled:opacity-50"
          >
            <div className="rounded-full bg-info/10 p-3 text-info">
              <Database className="h-6 w-6" />
            </div>
            <span className="font-medium text-foreground">Full Crawl</span>
            <span className="text-xs text-muted-text text-center">
              All courts, 2010-{currentYear}
            </span>
          </button>
          <button
            onClick={() => startPreset("download")}
            disabled={running || actionMutation.isPending}
            className="flex flex-col items-center gap-2 rounded-lg border border-border p-5 transition-all hover:border-accent hover:shadow-md disabled:opacity-50"
          >
            <div className="rounded-full bg-success/10 p-3 text-success">
              <Download className="h-6 w-6" />
            </div>
            <span className="font-medium text-foreground">Download Only</span>
            <span className="text-xs text-muted-text text-center">
              Fetch missing full text
            </span>
          </button>
        </div>
      </div>

      {/* Custom Pipeline */}
      <div className="rounded-lg border border-border bg-card">
        <button
          onClick={() => setShowCustom(!showCustom)}
          className="flex w-full items-center justify-between p-5"
        >
          <h2 className="font-heading text-base font-semibold">Custom Pipeline</h2>
          {showCustom ? (
            <ChevronUp className="h-5 w-5 text-muted-text" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-text" />
          )}
        </button>
        {showCustom && (
          <div className="border-t border-border p-5 pt-4">
            {/* Database selection */}
            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-secondary-text">
                  Databases ({selectedDbs.size} selected)
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedDbs(new Set(DATABASES.map((d) => d.code)))}
                    className="text-xs text-accent hover:underline"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setSelectedDbs(new Set())}
                    className="text-xs text-muted-text hover:text-foreground"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {DATABASES.map((db) => (
                  <DatabaseCard
                    key={db.code}
                    code={db.code}
                    name={db.name}
                    badge={db.badge}
                    badgeColor={db.badgeColor}
                    selected={selectedDbs.has(db.code)}
                    onToggle={toggleDb}
                  />
                ))}
              </div>
            </div>

            {/* Parameters */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-secondary-text">Start Year</label>
                <input
                  type="number"
                  min={2000}
                  max={2030}
                  value={startYear}
                  onChange={(e) => setStartYear(Number(e.target.value))}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-secondary-text">End Year</label>
                <input
                  type="number"
                  min={2000}
                  max={2030}
                  value={endYear}
                  onChange={(e) => setEndYear(Number(e.target.value))}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-secondary-text">Request Delay (s)</label>
                <select
                  value={delay}
                  onChange={(e) => setDelay(e.target.value)}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground"
                >
                  <option value="0.5">0.5s (fast)</option>
                  <option value="1.0">1.0s (default)</option>
                  <option value="2.0">2.0s (safe)</option>
                  <option value="5.0">5.0s (very safe)</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={startCustom}
                disabled={running || actionMutation.isPending || selectedDbs.size === 0}
                className="flex items-center gap-1 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-light disabled:opacity-50"
              >
                <Play className="h-4 w-4" />
                {running ? "Running..." : "Start Custom Pipeline"}
              </button>
              {running && (
                <button
                  onClick={() => actionMutation.mutate({ action: "stop" })}
                  disabled={actionMutation.isPending}
                  className="flex items-center gap-1 rounded-md border border-danger/30 px-3 py-1.5 text-sm text-danger hover:bg-danger/5"
                >
                  <Square className="h-4 w-4" /> Stop
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Live Monitor */}
      {running && (
        <div className="rounded-lg border border-accent/30 bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-accent" />
              <h2 className="font-heading text-base font-semibold">Live Monitor</h2>
            </div>
            <span className="rounded-full bg-accent-muted px-3 py-0.5 text-xs font-medium text-accent">
              {phase ?? "Initializing"}
            </span>
          </div>

          {/* Overall Progress */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm text-muted-text">
              <span>Overall Progress</span>
              <span>{overallProgress}%</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-surface">
              <div
                className="h-2 rounded-full bg-accent transition-all duration-500"
                style={{ width: `${Math.min(overallProgress, 100)}%` }}
              />
            </div>
          </div>

          {/* Phase progress */}
          {status?.phase_progress && (
            <p className="mb-4 text-sm text-muted-text">{status.phase_progress}</p>
          )}

          {/* Phase indicators */}
          <div className="grid gap-2 sm:grid-cols-3">
            {PHASES.map((p) => {
              const isActive = phase === p.id
              const isDone = phasesCompleted.includes(p.id)
              const Icon = p.icon
              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-3 rounded-md border p-3 ${
                    isActive
                      ? "border-accent bg-accent-muted"
                      : isDone
                        ? "border-success/30 bg-success/5"
                        : "border-border"
                  }`}
                >
                  {isDone ? (
                    <CheckCircle className="h-5 w-5 shrink-0 text-success" />
                  ) : isActive ? (
                    <Loader2 className="h-5 w-5 shrink-0 animate-spin text-accent" />
                  ) : (
                    <Icon className="h-5 w-5 shrink-0 text-muted-text" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-foreground">{p.label}</p>
                    <p className="text-xs text-muted-text">{p.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Stats */}
          {pipelineStats && (
            <div className="mt-4 grid gap-2 text-xs text-muted-text sm:grid-cols-3">
              <div className="rounded-md bg-surface p-2">
                <span className="font-medium text-foreground">Crawl:</span>{" "}
                {pipelineStats.crawl.total_found} found, {pipelineStats.crawl.new_added} new
              </div>
              <div className="rounded-md bg-surface p-2">
                <span className="font-medium text-foreground">Clean:</span>{" "}
                {pipelineStats.clean.dupes_removed} dupes, {pipelineStats.clean.validated} valid
              </div>
              <div className="rounded-md bg-surface p-2">
                <span className="font-medium text-foreground">Download:</span>{" "}
                {pipelineStats.download.downloaded} ok, {pipelineStats.download.failed} fail
              </div>
            </div>
          )}
        </div>
      )}

      {/* Log Viewer */}
      <div className="rounded-lg border border-border bg-card">
        <button
          onClick={() => setLogExpanded(!logExpanded)}
          className="flex w-full items-center justify-between p-4"
        >
          <h2 className="font-heading text-lg font-semibold">
            Pipeline Logs ({logs.length})
          </h2>
          <span className="text-sm text-muted-text">
            {logExpanded ? "Collapse" : "Expand"}
          </span>
        </button>
        {logExpanded && (
          <div className="max-h-80 overflow-auto border-t border-border bg-surface p-4">
            {logs.length === 0 ? (
              <p className="text-sm text-muted-text">No logs yet. Start a pipeline to see activity.</p>
            ) : (
              <div className="space-y-1">
                {[...logs].reverse().slice(0, 50).map((entry, i) => (
                  <div key={i} className="flex gap-2 text-xs">
                    <span className="shrink-0 font-mono text-muted-text">{entry.timestamp?.slice(11) ?? ""}</span>
                    <span
                      className={`shrink-0 font-medium ${
                        entry.level === "error"
                          ? "text-danger"
                          : entry.level === "warning"
                            ? "text-warning"
                            : "text-foreground"
                      }`}
                    >
                      [{entry.phase}]
                    </span>
                    <span className="text-foreground">{entry.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="rounded-lg border border-danger/30 bg-card p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-danger">
            <AlertCircle className="h-4 w-4" /> Errors ({errors.length})
          </h3>
          <div className="max-h-40 space-y-1 overflow-auto">
            {errors.map((err, i) => (
              <p key={i} className="text-xs text-danger">{err}</p>
            ))}
          </div>
        </div>
      )}

      {/* Pipeline Phases Info */}
      {!running && (
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-3 font-heading text-base font-semibold">How the Pipeline Works</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {PHASES.map((p, i) => {
              const Icon = p.icon
              return (
                <div key={p.id} className="rounded-md border border-border-light p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
                      {i + 1}
                    </div>
                    <Icon className="h-4 w-4 text-accent" />
                  </div>
                  <h3 className="font-medium text-foreground">{p.label}</h3>
                  <p className="mt-1 text-xs text-muted-text">{p.desc}</p>
                </div>
              )
            })}
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-md bg-info/5 p-3 text-xs text-info">
            <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div>
              <p>The pipeline runs all three phases automatically with smart fallback strategies.</p>
              <p className="mt-1">If a crawl strategy fails, it rotates to the next one (direct → viewdb → keyword search).</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
