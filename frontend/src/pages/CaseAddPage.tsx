import { useNavigate } from "react-router-dom"
import { Plus } from "lucide-react"
import { useState, useCallback } from "react"
import { useCreateCase } from "@/hooks/use-cases"
import { Breadcrumb } from "@/components/shared/Breadcrumb"
import { toast } from "sonner"

const COURT_OPTIONS = [
  "", "AATA", "ARTA", "FCA", "FCCA", "FedCFamC2G", "HCA",
]

const NATURE_OPTIONS = [
  "", "Migration", "Refugee", "Judicial Review", "Citizenship",
  "Visa Cancellation", "Deportation", "Character", "Bridging Visa",
]

export function CaseAddPage() {
  const navigate = useNavigate()
  const createMutation = useCreateCase()
  const [form, setForm] = useState<Record<string, string>>({})

  const updateField = useCallback((key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title?.trim()) {
      toast.error("Title is required")
      return
    }
    if (form.citation && !/^\[?\d{4}\]?\s+\w+\s+\d+/.test(form.citation)) {
      toast.error("Citation format should be like [2024] FCA 123")
      return
    }
    try {
      const newCase = await createMutation.mutateAsync(form)
      toast.success("Case created")
      navigate(`/cases/${newCase.case_id}`)
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Cases", href: "/cases" },
          { label: "Add Case" },
        ]}
      />

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left: Main fields */}
          <div className="rounded-lg border border-border bg-card p-6 lg:col-span-2">
            <h2 className="mb-4 font-heading text-lg font-semibold">New Case</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title *" value={form.title} onChange={(v) => updateField("title", v)} />
              <Field label="Citation" value={form.citation} onChange={(v) => updateField("citation", v)} placeholder="[2024] FCA 123" />
              <Field label="Court" value={form.court} onChange={(v) => updateField("court", v)} />
              <SelectField label="Court Code" value={form.court_code} options={COURT_OPTIONS} onChange={(v) => updateField("court_code", v)} />
              <Field label="Date" value={form.date} onChange={(v) => updateField("date", v)} placeholder="DD Month YYYY" />
              <Field label="Judges" value={form.judges} onChange={(v) => updateField("judges", v)} />
              <Field label="Outcome" value={form.outcome} onChange={(v) => updateField("outcome", v)} />
              <Field label="Visa Type" value={form.visa_type} onChange={(v) => updateField("visa_type", v)} />
              <Field label="Visa Subclass" value={form.visa_subclass} onChange={(v) => updateField("visa_subclass", v)} />
              <Field label="Visa Class Code" value={form.visa_class_code} onChange={(v) => updateField("visa_class_code", v)} />
              <SelectField label="Case Nature" value={form.case_nature} options={NATURE_OPTIONS} onChange={(v) => updateField("case_nature", v)} />
              <Field label="URL" value={form.url} onChange={(v) => updateField("url", v)} span2 />
              <Field label="Source" value={form.source} onChange={(v) => updateField("source", v)} />
              <Field label="Legislation" value={form.legislation} onChange={(v) => updateField("legislation", v)} />
            </div>
          </div>

          {/* Right: Annotations */}
          <div className="space-y-6">
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="mb-4 font-heading text-lg font-semibold">Annotations</h2>
              <Field label="Tags" value={form.tags} onChange={(v) => updateField("tags", v)} placeholder="Comma-separated" />
              <div className="mt-4">
                <label className="mb-1 block text-xs font-medium text-muted-text">Notes</label>
                <textarea
                  value={form.user_notes ?? ""}
                  onChange={(e) => updateField("user_notes", e.target.value)}
                  rows={6}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
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
                disabled={createMutation.isPending}
                className="flex flex-1 items-center justify-center gap-1 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-light disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {createMutation.isPending ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}

function Field({
  label, value, onChange, placeholder, span2,
}: {
  label: string; value?: string; onChange: (v: string) => void; placeholder?: string; span2?: boolean
}) {
  return (
    <div className={span2 ? "sm:col-span-2" : ""}>
      <label className="mb-1 block text-xs font-medium text-muted-text">
        {label}
      </label>
      <input
        type="text"
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
