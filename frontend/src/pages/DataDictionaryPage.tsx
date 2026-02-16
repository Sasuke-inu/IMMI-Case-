import { useQuery } from "@tanstack/react-query"
import { fetchDataDictionary } from "@/lib/api"
import { BookOpen, Hash, Scale, FileText, Brain, User } from "lucide-react"

interface FieldDef {
  name: string
  type: string
  description: string
  example: string
}

const FIELD_GROUPS: Array<{
  label: string
  icon: typeof Hash
  fields: string[]
}> = [
  {
    label: "Identification",
    icon: Hash,
    fields: ["case_id", "citation", "title", "url", "source"],
  },
  {
    label: "Court Information",
    icon: Scale,
    fields: ["court", "court_code", "date", "year", "judges"],
  },
  {
    label: "Case Content",
    icon: FileText,
    fields: ["catchwords", "outcome", "legislation", "text_snippet", "full_text_path"],
  },
  {
    label: "Extracted Fields",
    icon: Brain,
    fields: ["visa_type", "visa_subclass", "visa_class_code", "case_nature", "legal_concepts"],
  },
  {
    label: "User Data",
    icon: User,
    fields: ["user_notes", "tags"],
  },
]

const TYPE_COLORS: Record<string, string> = {
  string: "bg-info/10 text-info",
  integer: "bg-accent-muted text-accent",
}

export function DataDictionaryPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["data-dictionary"],
    queryFn: fetchDataDictionary,
    staleTime: 300_000,
  })

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-text">
        Loading data dictionary...
      </div>
    )
  }

  const fields = data?.fields ?? []
  const fieldMap = new Map(fields.map((f) => [f.name, f]))

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BookOpen className="h-6 w-6 text-accent" />
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Data Dictionary</h1>
          <p className="text-sm text-muted-text">
            ImmigrationCase data model — {fields.length} fields across 5 groups
          </p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid gap-3 sm:grid-cols-5">
        {FIELD_GROUPS.map((g) => {
          const Icon = g.icon
          return (
            <div key={g.label} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
              <div className="rounded-md bg-accent-muted p-2 text-accent">
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-text">{g.label}</p>
                <p className="font-mono text-sm font-medium text-foreground">{g.fields.length}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Grouped tables */}
      {FIELD_GROUPS.map((group) => {
        const Icon = group.icon
        const groupFields = group.fields
          .map((name) => fieldMap.get(name))
          .filter((f): f is FieldDef => f !== undefined)

        if (groupFields.length === 0) return null

        return (
          <div key={group.label} className="rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border p-4">
              <Icon className="h-5 w-5 text-accent" />
              <h2 className="font-heading text-lg font-semibold">{group.label}</h2>
              <span className="ml-auto rounded-full bg-surface px-2 py-0.5 text-xs text-muted-text">
                {groupFields.length} fields
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface">
                    <th className="p-3 text-left font-medium text-muted-text">Field</th>
                    <th className="p-3 text-left font-medium text-muted-text">Type</th>
                    <th className="p-3 text-left font-medium text-muted-text">Description</th>
                    <th className="p-3 text-left font-medium text-muted-text">Example</th>
                  </tr>
                </thead>
                <tbody>
                  {groupFields.map((f) => (
                    <tr
                      key={f.name}
                      className="border-b border-border-light transition-colors hover:bg-surface/50"
                    >
                      <td className="p-3 font-mono text-xs text-accent whitespace-nowrap">{f.name}</td>
                      <td className="p-3 whitespace-nowrap">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[f.type] ?? "bg-surface text-muted-text"}`}>
                          {f.type}
                        </span>
                      </td>
                      <td className="p-3 text-foreground">{f.description}</td>
                      <td className="max-w-[220px] truncate p-3 text-xs text-muted-text" title={f.example}>
                        <code className="rounded bg-surface px-1.5 py-0.5">{f.example}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}
