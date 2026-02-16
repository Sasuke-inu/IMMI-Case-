import { useParams, useNavigate } from "react-router-dom"
import { Save } from "lucide-react"
import { useState, useEffect, useCallback } from "react"
import { useCase, useUpdateCase } from "@/hooks/use-cases"
import { Breadcrumb } from "@/components/shared/Breadcrumb"
import { toast } from "sonner"
import type { ImmigrationCase } from "@/types/case"

const NATURE_OPTIONS = [
  "", "Migration", "Refugee", "Judicial Review", "Citizenship",
  "Visa Cancellation", "Deportation", "Character", "Bridging Visa",
]

const COURT_OPTIONS = [
  "", "AATA", "ARTA", "FCA", "FCCA", "FedCFamC2G", "HCA",
]

export function CaseEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data, isLoading } = useCase(id!)
  const updateMutation = useUpdateCase()
  const [form, setForm] = useState<Record<string, string>>({})
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (data?.case) {
      const fields = [
        "title", "citation", "court", "court_code", "date", "judges",
        "outcome", "visa_type", "visa_subclass", "visa_class_code",
        "case_nature", "legislation", "legal_concepts", "catchwords",
        "url", "source", "tags", "user_notes",
      ] as const
      const initial: Record<string, string> = {}
      for (const f of fields) {
        initial[f] = String(data.case[f as keyof ImmigrationCase] ?? "")
      }
      setForm(initial)
    }
  }, [data])

  // Unsaved changes warning
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [dirty])

  const updateField = useCallback((key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
  }, [])

  if (isLoading || !data) {
    return <div className="flex h-64 items-center justify-center text-muted-text">Loading...</div>
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title?.trim()) {
      toast.error("Title is required")
      return
    }
    try {
      await updateMutation.mutateAsync({ id: id!, data: form })
      toast.success("Case updated")
      setDirty(false)
      navigate(`/cases/${id}`)
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Breadcrumb
          items={[
            { label: "Cases", href: "/cases" },
            { label: data.case.citation || "Case", href: `/cases/${id}` },
            { label: "Edit" },
          ]}
        />
        {dirty && (
          <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
            Unsaved changes
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left: Main fields (2 cols) */}
          <div className="rounded-lg border border-border bg-card p-6 lg:col-span-2">
            <h2 className="mb-4 font-heading text-lg font-semibold">Case Metadata</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title *" value={form.title} onChange={(v) => updateField("title", v)} />
              <Field label="Citation" value={form.citation} onChange={(v) => updateField("citation", v)} />
              <Field label="Court" value={form.court} onChange={(v) => updateField("court", v)} />
              <SelectField label="Court Code" value={form.court_code} options={COURT_OPTIONS} onChange={(v) => updateField("court_code", v)} />
              <Field label="Date" value={form.date} onChange={(v) => updateField("date", v)} placeholder="DD Month YYYY" />
              <Field label="Year" value={form.year} onChange={(v) => updateField("year", v)} type="number" />
              <Field label="Judges" value={form.judges} onChange={(v) => updateField("judges", v)} />
              <Field label="Outcome" value={form.outcome} onChange={(v) => updateField("outcome", v)} />
              <Field label="Visa Type" value={form.visa_type} onChange={(v) => updateField("visa_type", v)} />
              <Field label="Visa Subclass" value={form.visa_subclass} onChange={(v) => updateField("visa_subclass", v)} />
              <Field label="Visa Class Code" value={form.visa_class_code} onChange={(v) => updateField("visa_class_code", v)} />
              <SelectField label="Case Nature" value={form.case_nature} options={NATURE_OPTIONS} onChange={(v) => updateField("case_nature", v)} />
              <Field label="Legislation" value={form.legislation} onChange={(v) => updateField("legislation", v)} span2 />
              <Field label="Legal Concepts" value={form.legal_concepts} onChange={(v) => updateField("legal_concepts", v)} span2 placeholder="Semicolon-separated" />
              <Field label="URL" value={form.url} onChange={(v) => updateField("url", v)} span2 />
              <Field label="Source" value={form.source} onChange={(v) => updateField("source", v)} />
              <TextareaField label="Catchwords" value={form.catchwords} onChange={(v) => updateField("catchwords", v)} rows={3} />
            </div>
          </div>

          {/* Right: Annotations */}
          <div className="space-y-6">
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="mb-4 font-heading text-lg font-semibold">Annotations</h2>
              <Field label="Tags" value={form.tags} onChange={(v) => updateField("tags", v)} placeholder="Comma-separated" />
              <div className="mt-4">
                <TextareaField label="Notes" value={form.user_notes} onChange={(v) => updateField("user_notes", v)} rows={8} />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="flex-1 rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-surface"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="flex flex-1 items-center justify-center gap-1 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-light disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {updateMutation.isPending ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}

function Field({
  label, value, onChange, type = "text", placeholder, span2,
}: {
  label: string; value?: string; onChange: (v: string) => void
  type?: string; placeholder?: string; span2?: boolean
}) {
  return (
    <div className={span2 ? "sm:col-span-2" : ""}>
      <label className="mb-1 block text-xs font-medium text-muted-text">{label}</label>
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />
    </div>
  )
}

function SelectField({
  label, value, options, onChange,
}: {
  label: string; value?: string; options: string[]; onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-text">{label}</label>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o || `Select ${label}...`}</option>
        ))}
      </select>
    </div>
  )
}

function TextareaField({
  label, value, onChange, rows = 3,
}: {
  label: string; value?: string; onChange: (v: string) => void; rows?: number
}) {
  return (
    <div className="sm:col-span-2">
      <label className="mb-1 block text-xs font-medium text-muted-text">{label}</label>
      <textarea
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />
    </div>
  )
}
