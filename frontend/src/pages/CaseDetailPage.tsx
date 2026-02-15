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
import { cn } from "@/lib/utils"
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
          {c.case_nature && (
            <span className="rounded-full bg-info/10 px-2 py-0.5 text-xs font-medium text-info">
              {c.case_nature}
            </span>
          )}
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

      {/* Case Details */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 font-heading text-lg font-semibold">Case Details</h2>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MetaField label="Case ID" value={c.case_id} mono />
          <MetaField label="Citation" value={c.citation} />
          <MetaField label="Court" value={c.court} />
          <MetaField label="Court Code" value={c.court_code} />
          <MetaField label="Date" value={c.date} />
          <MetaField label="Year" value={String(c.year || "")} />
          <MetaField label="Judges" value={c.judges} />
          <MetaField label="Case Nature" value={c.case_nature} />
          <MetaField label="Source" value={c.source} />
        </dl>
      </div>

      {/* Outcome */}
      {c.outcome && (
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-2 font-heading text-lg font-semibold">Outcome</h2>
          <div className="flex items-start gap-3">
            <OutcomeBadge outcome={c.outcome} />
            <p className="text-sm text-foreground">{c.outcome}</p>
          </div>
        </div>
      )}

      {/* Visa Information */}
      {(c.visa_type || c.visa_subclass || c.visa_class_code) && (
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 font-heading text-lg font-semibold">Visa Information</h2>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MetaField label="Visa Type" value={c.visa_type} />
            <MetaField label="Visa Subclass" value={c.visa_subclass} mono />
            <MetaField label="Class Code" value={c.visa_class_code} mono />
          </dl>
        </div>
      )}

      {/* Legal */}
      {(c.legislation || c.legal_concepts) && (
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 font-heading text-lg font-semibold">Legal</h2>
          {c.legislation && (
            <div className="mb-3">
              <dt className="text-xs font-medium text-muted-text">Legislation</dt>
              <dd className="mt-0.5 text-sm text-foreground">{c.legislation}</dd>
            </div>
          )}
          {c.legal_concepts && (
            <div>
              <dt className="text-xs font-medium text-muted-text">Legal Concepts</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {c.legal_concepts.split(";").map((concept) => {
                  const trimmed = concept.trim()
                  return trimmed ? (
                    <span
                      key={trimmed}
                      className="rounded-full bg-surface px-2.5 py-0.5 text-xs text-foreground"
                    >
                      {trimmed}
                    </span>
                  ) : null
                })}
              </dd>
            </div>
          )}
        </div>
      )}

      {/* Tags */}
      {c.tags && (
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-2 font-heading text-lg font-semibold">Tags</h2>
          <div className="flex flex-wrap gap-1.5">
            {c.tags.split(",").map((tag) => {
              const trimmed = tag.trim()
              return trimmed ? (
                <span
                  key={trimmed}
                  className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent"
                >
                  {trimmed}
                </span>
              ) : null
            })}
          </div>
        </div>
      )}

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

function MetaField({ label, value, mono }: { label: string; value?: string | number; mono?: boolean }) {
  if (!value) return null
  return (
    <div>
      <dt className="text-xs font-medium text-muted-text">{label}</dt>
      <dd className={cn("mt-0.5 text-sm text-foreground", mono && "font-mono")}>{value}</dd>
    </div>
  )
}
