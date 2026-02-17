import { useParams, useNavigate, Link } from "react-router-dom"
import {
  Edit,
  Trash2,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react"
import { useState, useCallback, useEffect } from "react"
import { useCase, useRelatedCases, useDeleteCase } from "@/hooks/use-cases"
import { CourtBadge } from "@/components/shared/CourtBadge"
import { OutcomeBadge } from "@/components/shared/OutcomeBadge"
import { NatureBadge } from "@/components/shared/NatureBadge"
import { Breadcrumb } from "@/components/shared/Breadcrumb"
import { ConfirmModal } from "@/components/shared/ConfirmModal"
import { CaseTextViewer } from "@/components/cases/CaseTextViewer"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export function CaseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data, isLoading } = useCase(id!)
  const { data: related } = useRelatedCases(id!)
  const deleteMutation = useDeleteCase()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  // Keyboard shortcut: e → edit
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return
      if (e.key === "e" && !e.metaKey && !e.ctrlKey) {
        navigate(`/cases/${id}/edit`)
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [id, navigate])

  const handleDelete = useCallback(async () => {
    try {
      await deleteMutation.mutateAsync(id!)
      toast.success("Case deleted")
      navigate("/cases")
    } catch (e) {
      toast.error((e as Error).message)
    }
  }, [id, deleteMutation, navigate])

  const copyCitation = useCallback(() => {
    if (!data?.case.citation) return
    navigator.clipboard.writeText(data.case.citation)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [data])

  if (isLoading || !data) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-text">
        Loading case...
      </div>
    )
  }

  const c = data.case
  const fullText = data.full_text

  return (
    <div className="space-y-4">
      {/* Breadcrumb + actions */}
      <div className="flex items-center justify-between">
        <Breadcrumb
          items={[
            { label: "Cases", href: "/cases" },
            { label: c.citation || c.title || "Case" },
          ]}
        />
        <div className="flex items-center gap-2">
          {c.url && (
            <a
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Source
            </a>
          )}
          <Link
            to={`/cases/${c.case_id}/edit`}
            className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface"
          >
            <Edit className="h-3.5 w-3.5" /> Edit
          </Link>
          <button
            onClick={() => setDeleteOpen(true)}
            className="flex items-center gap-1 rounded-md border border-danger/30 px-3 py-1.5 text-sm text-danger hover:bg-danger/5"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      </div>

      {/* Hero */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <CourtBadge court={c.court_code} />
          <OutcomeBadge outcome={c.outcome} />
          <NatureBadge nature={c.case_nature} />
        </div>
        <div className="flex items-start gap-2">
          <h1 className="font-heading text-xl font-semibold text-foreground">
            {c.citation || c.title}
          </h1>
          <button
            onClick={copyCitation}
            className="mt-1 shrink-0 rounded-md p-1 text-muted-text hover:bg-surface hover:text-foreground"
            title="Copy citation"
          >
            {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
        {c.title && c.citation && c.title !== c.citation && (
          <p className="mt-1 text-sm text-secondary-text">{c.title}</p>
        )}
      </div>

      {/* Case Information — consolidated single card */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-3 font-heading text-base font-semibold text-foreground">Case Information</h2>
        <dl className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
          <MetaField label="Case ID" value={c.case_id} mono />
          <MetaField label="Citation" value={c.citation} />
          <MetaField label="Date" value={c.date} />
          <MetaField label="Court" value={c.court} />
          <MetaField label="Court Code" value={c.court_code} />
          <MetaField label="Year" value={c.year ? String(c.year) : ""} />
          <MetaField label="Judges" value={c.judges} />
          <MetaField label="Source" value={c.source} />
          <MetaField label="Outcome" value={c.outcome} />
          <MetaField label="Case Nature" value={c.case_nature} />
          <MetaField label="Applicant" value={c.applicant_name} />
          <MetaField label="Respondent" value={c.respondent} />
          <MetaField label="Country of Origin" value={c.country_of_origin} />
          <MetaField label="Visa Type" value={c.visa_type} />
          <MetaField label="Visa Subclass" value={c.visa_subclass} mono />
          <MetaField label="Subclass No." value={c.visa_subclass_number} mono />
          <MetaField label="Class Code" value={c.visa_class_code} mono />
          <MetaField label="Hearing Date" value={c.hearing_date} />
          <MetaField label="Represented" value={c.is_represented} />
          <MetaField label="Representative" value={c.representative} />
          <MetaField label="Legislation" value={c.legislation} />
        </dl>
      </div>

      {/* Catchwords */}
      {c.catchwords && (
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-2 font-heading text-base font-semibold">Catchwords</h2>
          <p className="text-sm leading-relaxed text-secondary-text">{c.catchwords}</p>
        </div>
      )}

      {/* Legal Concepts */}
      {c.legal_concepts && (
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-2 font-heading text-base font-semibold">Legal Concepts</h2>
          <div className="flex flex-wrap gap-1.5">
            {c.legal_concepts.split(";").map((concept) => {
              const trimmed = concept.trim()
              if (!trimmed) return null
              return (
                <Link
                  key={trimmed}
                  to={`/cases?keyword=${encodeURIComponent(trimmed)}`}
                  className="rounded-full bg-surface px-2.5 py-0.5 text-xs text-foreground transition-colors hover:bg-accent-muted hover:text-accent"
                >
                  {trimmed}
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Notes & Tags */}
      {(c.tags || c.user_notes) && (
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-2 font-heading text-base font-semibold">Notes & Tags</h2>
          {c.tags && (
            <div className="mb-3">
              <dt className="mb-1 text-xs font-medium text-secondary-text">Tags</dt>
              <div className="flex flex-wrap gap-1.5">
                {c.tags.split(",").map((tag) => {
                  const trimmed = tag.trim()
                  if (!trimmed) return null
                  return (
                    <Link
                      key={trimmed}
                      to={`/cases?tag=${encodeURIComponent(trimmed)}`}
                      className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent hover:bg-accent/20"
                    >
                      {trimmed}
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
          {c.user_notes && (
            <div>
              <dt className="mb-1 text-xs font-medium text-secondary-text">Notes</dt>
              <p className="whitespace-pre-wrap text-sm text-foreground">{c.user_notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Related cases */}
      {related && related.cases.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-3 font-heading text-base font-semibold">Related Cases</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {related.cases.map((r) => (
              <Link
                key={r.case_id}
                to={`/cases/${r.case_id}`}
                className="flex items-center gap-3 rounded-md border border-border-light px-3 py-2 text-sm transition-colors hover:border-accent hover:bg-surface"
              >
                <CourtBadge court={r.court_code} />
                <div className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-foreground">
                    {r.citation || r.title}
                  </span>
                  <span className="text-xs text-muted-text">{r.date}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Full text */}
      {fullText && (
        <CaseTextViewer text={fullText} citation={c.citation} />
      )}

      {/* Delete modal */}
      <ConfirmModal
        open={deleteOpen}
        title="Delete Case"
        message={`Are you sure you want to delete "${c.citation || c.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  )
}

function MetaField({ label, value, mono }: { label: string; value?: string | number; mono?: boolean }) {
  if (!value) return null
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-secondary-text">{label}</dt>
      <dd className={cn("mt-0.5 break-words text-sm text-foreground", mono && "font-mono text-xs")}>{value}</dd>
    </div>
  )
}
