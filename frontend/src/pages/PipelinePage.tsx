import { useState } from "react"
import { GitBranch, Play, Square, Loader2 } from "lucide-react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { fetchPipelineStatus, pipelineAction } from "@/lib/api"
import { toast } from "sonner"

export function PipelinePage() {
  const qc = useQueryClient()
  const [logExpanded, setLogExpanded] = useState(true)

  const { data: status } = useQuery({
    queryKey: ["pipeline-status"],
    queryFn: fetchPipelineStatus,
    refetchInterval: (query) => {
      const data = query.state.data as Record<string, unknown> | undefined
      return data?.running ? 2000 : 10000
    },
  })

  const actionMutation = useMutation({
    mutationFn: (action: string) => pipelineAction(action),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pipeline-status"] })
      toast.success("Pipeline action executed")
    },
    onError: (e) => toast.error(e.message),
  })

  const running = status?.running as boolean | undefined
  const phase = status?.phase as string | undefined
  const logs = (status?.logs as string[]) ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <GitBranch className="h-6 w-6 text-accent" />
        <h1 className="text-2xl font-semibold text-foreground">
          Smart Pipeline
        </h1>
      </div>

      {/* Status card */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-foreground">
              {running ? `Running — Phase: ${phase ?? "unknown"}` : "Idle"}
            </p>
            {running && (
              <p className="mt-1 flex items-center gap-2 text-sm text-muted-text">
                <Loader2 className="h-4 w-4 animate-spin" /> Pipeline is
                processing...
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => actionMutation.mutate("start")}
              disabled={running || actionMutation.isPending}
              className="flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-light disabled:opacity-50"
            >
              <Play className="h-4 w-4" /> Start
            </button>
            <button
              onClick={() => actionMutation.mutate("stop")}
              disabled={!running || actionMutation.isPending}
              className="flex items-center gap-1 rounded-md border border-danger/30 px-3 py-1.5 text-sm text-danger hover:bg-danger/5 disabled:opacity-50"
            >
              <Square className="h-4 w-4" /> Stop
            </button>
          </div>
        </div>
      </div>

      {/* Log viewer */}
      <div className="rounded-lg border border-border bg-card">
        <button
          onClick={() => setLogExpanded(!logExpanded)}
          className="flex w-full items-center justify-between p-4"
        >
          <h2 className="font-heading text-lg font-semibold">
            Logs ({logs.length})
          </h2>
          <span className="text-sm text-muted-text">
            {logExpanded ? "Collapse" : "Expand"}
          </span>
        </button>
        {logExpanded && (
          <div className="max-h-96 overflow-auto border-t border-border bg-surface p-4">
            {logs.length === 0 ? (
              <p className="text-sm text-muted-text">No logs yet.</p>
            ) : (
              <pre className="whitespace-pre-wrap break-words font-mono text-xs text-foreground">
                {logs.join("\n")}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
