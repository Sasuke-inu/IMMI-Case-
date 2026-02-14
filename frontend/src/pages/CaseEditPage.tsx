import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Save } from "lucide-react"
import { useState, useEffect } from "react"
import { useCase, useUpdateCase } from "@/hooks/use-cases"
import { toast } from "sonner"
import type { ImmigrationCase } from "@/types/case"

const editableFields: Array<{ key: keyof ImmigrationCase; label: string; multiline?: boolean }> = [
  { key: "title", label: "Title" },
  { key: "citation", label: "Citation" },
  { key: "court", label: "Court" },
  { key: "court_code", label: "Court Code" },
  { key: "date", label: "Date" },
  { key: "judges", label: "Judges" },
  { key: "outcome", label: "Outcome" },
  { key: "visa_type", label: "Visa Type" },
  { key: "case_nature", label: "Case Nature" },
  { key: "legislation", label: "Legislation" },
  { key: "legal_concepts", label: "Legal Concepts" },
  { key: "catchwords", label: "Catchwords", multiline: true },
  { key: "url", label: "URL" },
  { key: "source", label: "Source" },
  { key: "tags", label: "Tags" },
  { key: "user_notes", label: "User Notes", multiline: true },
]

export function CaseEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data, isLoading } = useCase(id!)
  const updateMutation = useUpdateCase()
  const [form, setForm] = useState<Record<string, string>>({})

  useEffect(() => {
    if (data?.case) {
      const initial: Record<string, string> = {}
      for (const f of editableFields) {
        initial[f.key] = String(data.case[f.key] ?? "")
      }
      setForm(initial)
    }
  }, [data])

  if (isLoading || !data) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-text">
        Loading...
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await updateMutation.mutateAsync({ id: id!, data: form })
      toast.success("Case updated")
      navigate(`/cases/${id}`)
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-muted-text hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <h1 className="text-2xl font-semibold text-foreground">Edit Case</h1>
      </div>

      <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-card p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {editableFields.map((f) => (
            <div key={f.key} className={f.multiline ? "sm:col-span-2" : ""}>
              <label className="mb-1 block text-xs font-medium text-muted-text">
                {f.label}
              </label>
              {f.multiline ? (
                <textarea
                  value={form[f.key] ?? ""}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, [f.key]: e.target.value }))
                  }
                  rows={3}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              ) : (
                <input
                  type="text"
                  value={form[f.key] ?? ""}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, [f.key]: e.target.value }))
                  }
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              )}
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-surface"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="flex items-center gap-1 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-light disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {updateMutation.isPending ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  )
}
