import { Loader2, CheckCircle, XCircle } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { fetchJobStatus } from "@/lib/api"

export function JobStatusPage() {
  const { data: status } = useQuery({
    queryKey: ["job-status"],
    queryFn: fetchJobStatus,
    refetchInterval: (query) =>
      query.state.data?.running ? 1000 : 5000,
  })

  if (!status) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-text">
        Loading...
      </div>
    )
  }

  const progress =
    status.total && status.progress
      ? Math.round((status.progress / status.total) * 100)
      : 0

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Job Status</h1>

      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          {status.running ? (
            <Loader2 className="h-6 w-6 animate-spin text-accent" />
          ) : status.error ? (
            <XCircle className="h-6 w-6 text-danger" />
          ) : status.completed ? (
            <CheckCircle className="h-6 w-6 text-success" />
          ) : (
            <div className="h-6 w-6 rounded-full bg-surface" />
          )}
          <div>
            <p className="font-medium text-foreground">
              {status.running
                ? `Running: ${status.type ?? "Unknown job"}`
                : status.error
                  ? "Job Failed"
                  : status.completed
                    ? "Job Completed"
                    : "No Active Job"}
            </p>
            {status.message && (
              <p className="text-sm text-muted-text">{status.message}</p>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {status.running && status.total && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm text-muted-text">
              <span>
                {status.progress?.toLocaleString()} / {status.total?.toLocaleString()}
              </span>
              <span>{progress}%</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-surface">
              <div
                className="h-2 rounded-full bg-accent transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {status.error && (
          <div className="mt-4 rounded-md bg-danger/5 p-3 text-sm text-danger">
            {status.error}
          </div>
        )}
      </div>
    </div>
  )
}
