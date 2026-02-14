import { useState } from "react"
import { Download, Loader2, Play } from "lucide-react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { startDownload, fetchJobStatus, downloadExportFile } from "@/lib/api"
import { toast } from "sonner"

export function DownloadPage() {
  const [params, setParams] = useState({
    databases: "AATA,FCA,ARTA",
    limit: "100",
  })

  const { data: jobStatus } = useQuery({
    queryKey: ["job-status"],
    queryFn: fetchJobStatus,
    refetchInterval: (query) =>
      query.state.data?.running ? 2000 : false,
  })

  const startMutation = useMutation({
    mutationFn: () =>
      startDownload({
        databases: params.databases.split(",").map((s) => s.trim()),
        limit: Number(params.limit),
      }),
    onSuccess: () => toast.success("Download job started"),
    onError: (e) => toast.error(e.message),
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Download</h1>

      {/* Download full text */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-3 font-heading text-lg font-semibold">
          Download Full Text
        </h2>
        <p className="mb-4 text-sm text-muted-text">
          Download full case text for cases that don&apos;t have it yet.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-text">
              Databases
            </label>
            <input
              type="text"
              value={params.databases}
              onChange={(e) =>
                setParams((p) => ({ ...p, databases: e.target.value }))
              }
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-text">
              Limit
            </label>
            <input
              type="number"
              value={params.limit}
              onChange={(e) =>
                setParams((p) => ({ ...p, limit: e.target.value }))
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
            {jobStatus?.running ? "Running..." : "Start Download"}
          </button>
          {jobStatus?.running && (
            <span className="flex items-center gap-2 text-sm text-muted-text">
              <Loader2 className="h-4 w-4 animate-spin" />
              {jobStatus.message}
            </span>
          )}
        </div>
      </div>

      {/* Export data */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-3 font-heading text-lg font-semibold">Export Data</h2>
        <p className="mb-4 text-sm text-muted-text">
          Download all case data as CSV or JSON.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => downloadExportFile("csv")}
            className="flex items-center gap-1 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button
            onClick={() => downloadExportFile("json")}
            className="flex items-center gap-1 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface"
          >
            <Download className="h-4 w-4" /> Export JSON
          </button>
        </div>
      </div>
    </div>
  )
}
