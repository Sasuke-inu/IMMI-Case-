import { useState } from "react"
import { Database, Loader2, Play } from "lucide-react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { startUpdateDb, fetchJobStatus } from "@/lib/api"
import { toast } from "sonner"

export function UpdateDbPage() {
  const [params, setParams] = useState({
    databases: "AATA,FCA,ARTA,FCCA,FedCFamC2G,HCA",
  })

  const { data: jobStatus } = useQuery({
    queryKey: ["job-status"],
    queryFn: fetchJobStatus,
    refetchInterval: (query) =>
      query.state.data?.running ? 2000 : false,
  })

  const startMutation = useMutation({
    mutationFn: () =>
      startUpdateDb({
        databases: params.databases.split(",").map((s) => s.trim()),
      }),
    onSuccess: () => toast.success("Update job started"),
    onError: (e) => toast.error(e.message),
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Update Database</h1>

      <div className="rounded-lg border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <Database className="h-5 w-5 text-accent" />
          <h2 className="font-heading text-lg font-semibold">
            Refresh Case Data
          </h2>
        </div>
        <p className="mb-4 text-sm text-muted-text">
          Re-scrape metadata and update existing case records from AustLII.
        </p>

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

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={() => startMutation.mutate()}
            disabled={jobStatus?.running || startMutation.isPending}
            className="flex items-center gap-1 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-light disabled:opacity-50"
          >
            <Play className="h-4 w-4" />
            {jobStatus?.running ? "Running..." : "Start Update"}
          </button>
          {jobStatus?.running && (
            <span className="flex items-center gap-2 text-sm text-muted-text">
              <Loader2 className="h-4 w-4 animate-spin" />
              {jobStatus.message}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
