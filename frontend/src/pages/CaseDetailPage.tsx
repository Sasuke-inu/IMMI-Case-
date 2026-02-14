import { useParams, useNavigate, Link } from "react-router-dom"
import {
  ArrowLeft,
  Edit,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { useState } from "react"
import { useCase, useRelatedCases, useDeleteCase } from "@/hooks/use-cases"
import { CourtBadge } from "@/components/shared/CourtBadge"
import { OutcomeBadge } from "@/components/shared/OutcomeBadge"
import { toast } from "sonner"

export function CaseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data, isLoading } = useCase(id!)
  const { data: related } = useRelatedCases(id!)
  const deleteMutation = useDeleteCase()
  const [showFullText, setShowFullText] = useState(false)

  if (isLoading || !data) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-text">
        Loading case...
      </div>
    )
  }

  const c = data.case
  const fullText = data.full_text

  const handleDelete = async () => {
    if (!confirm("Delete this case?")) return
    try {
      await deleteMutation.mutateAsync(c.case_id)
      toast.success("Case deleted")
      navigate("/cases")
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const metaFields = [
    { label: "Citation", value: c.citation },
    { label: "Court", value: c.court },
    { label: "Court Code", value: c.court_code },
    { label: "Date", value: c.date },
    { label: "Year", value: c.year },
    { label: "Judges", value: c.judges },
    { label: "Outcome", value: c.outcome },
    { label: "Visa Type", value: c.visa_type },
    { label: "Case Nature", value: c.case_nature },
    { label: "Legislation", value: c.legislation },
    { label: "Legal Concepts", value: c.legal_concepts },
    { label: "Source", value: c.source },
    { label: "Tags", value: c.tags },
  ].filter((f) => f.value)

  return (
    <div className="space-y-6">
      {/* Breadcrumb + actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-muted-text hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex items-center gap-2">
          <Link
            to={`/cases/${c.case_id}/edit`}
            className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface"
          >
            <Edit className="h-3.5 w-3.5" /> Edit
          </Link>
          <button
            onClick={handleDelete}
            className="flex items-center gap-1 rounded-md border border-danger/30 px-3 py-1.5 text-sm text-danger hover:bg-danger/5"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      </div>

      {/* Hero */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="mb-3 flex items-center gap-2">
          <CourtBadge court={c.court_code} />
          <OutcomeBadge outcome={c.outcome} />
        </div>
        <h1 className="font-heading text-xl font-semibold text-foreground">
          {c.title || c.citation}
        </h1>
        {c.catchwords && (
          <p className="mt-2 text-sm text-secondary-text">{c.catchwords}</p>
        )}
        {c.url && (
          <a
            href={c.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-sm text-info hover:underline"
          >
            View on AustLII <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {/* Metadata grid */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 font-heading text-lg font-semibold">Metadata</h2>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {metaFields.map(({ label, value }) => (
            <div key={label}>
              <dt className="text-xs font-medium text-muted-text">{label}</dt>
              <dd className="mt-0.5 text-sm text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* User notes */}
      {c.user_notes && (
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-2 font-heading text-lg font-semibold">Notes</h2>
          <p className="whitespace-pre-wrap text-sm text-foreground">{c.user_notes}</p>
        </div>
      )}

      {/* Full text */}
      {fullText && (
        <div className="rounded-lg border border-border bg-card p-6">
          <button
            onClick={() => setShowFullText(!showFullText)}
            className="flex w-full items-center justify-between"
          >
            <h2 className="font-heading text-lg font-semibold">Full Text</h2>
            {showFullText ? (
              <ChevronUp className="h-5 w-5 text-muted-text" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-text" />
            )}
          </button>
          {showFullText && (
            <pre className="mt-4 max-h-[600px] overflow-auto whitespace-pre-wrap rounded-md bg-surface p-4 font-mono text-xs text-foreground">
              {fullText}
            </pre>
          )}
        </div>
      )}

      {/* Related cases */}
      {related && related.cases.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 font-heading text-lg font-semibold">
            Related Cases
          </h2>
          <div className="space-y-2">
            {related.cases.map((r) => (
              <Link
                key={r.case_id}
                to={`/cases/${r.case_id}`}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-surface"
              >
                <CourtBadge court={r.court_code} />
                <span className="flex-1 truncate text-foreground">
                  {r.title || r.citation}
                </span>
                <span className="text-xs text-muted-text">{r.date}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
