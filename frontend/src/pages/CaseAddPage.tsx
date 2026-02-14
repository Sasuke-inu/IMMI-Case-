import { useNavigate } from "react-router-dom"
import { ArrowLeft, Plus } from "lucide-react"
import { useState } from "react"
import { useCreateCase } from "@/hooks/use-cases"
import { toast } from "sonner"

const fields = [
  { key: "title", label: "Title", required: true },
  { key: "citation", label: "Citation" },
  { key: "court", label: "Court" },
  { key: "court_code", label: "Court Code" },
  { key: "date", label: "Date" },
  { key: "judges", label: "Judges" },
  { key: "outcome", label: "Outcome" },
  { key: "visa_type", label: "Visa Type" },
  { key: "case_nature", label: "Case Nature" },
  { key: "url", label: "URL" },
  { key: "source", label: "Source" },
  { key: "tags", label: "Tags" },
]

export function CaseAddPage() {
  const navigate = useNavigate()
  const createMutation = useCreateCase()
  const [form, setForm] = useState<Record<string, string>>({})

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title) {
      toast.error("Title is required")
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
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-muted-text hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <h1 className="text-2xl font-semibold text-foreground">Add Case</h1>
      </div>

      <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-card p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="mb-1 block text-xs font-medium text-muted-text">
                {f.label}
                {f.required && <span className="text-danger"> *</span>}
              </label>
              <input
                type="text"
                value={form[f.key] ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, [f.key]: e.target.value }))
                }
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
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
            disabled={createMutation.isPending}
            className="flex items-center gap-1 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-light disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {createMutation.isPending ? "Creating..." : "Create"}
          </button>
        </div>
      </form>
    </div>
  )
}
