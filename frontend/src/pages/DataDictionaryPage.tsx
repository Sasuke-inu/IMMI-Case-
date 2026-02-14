import { useQuery } from "@tanstack/react-query"
import { fetchDataDictionary } from "@/lib/api"
import { BookOpen } from "lucide-react"

export function DataDictionaryPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["data-dictionary"],
    queryFn: fetchDataDictionary,
    staleTime: 300_000,
  })

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-text">
        Loading...
      </div>
    )
  }

  const fields = data?.fields ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BookOpen className="h-6 w-6 text-accent" />
        <h1 className="text-2xl font-semibold text-foreground">
          Data Dictionary
        </h1>
      </div>

      <p className="text-sm text-muted-text">
        Field definitions for the ImmigrationCase data model (20 fields).
      </p>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface">
              <th className="p-3 text-left font-medium text-secondary-text">
                Field
              </th>
              <th className="p-3 text-left font-medium text-secondary-text">
                Type
              </th>
              <th className="p-3 text-left font-medium text-secondary-text">
                Description
              </th>
              <th className="p-3 text-left font-medium text-secondary-text">
                Example
              </th>
            </tr>
          </thead>
          <tbody>
            {fields.map((f) => (
              <tr
                key={f.name}
                className="border-b border-border-light transition-colors hover:bg-surface/50"
              >
                <td className="p-3 font-mono text-xs text-accent">
                  {f.name}
                </td>
                <td className="p-3 text-muted-text">{f.type}</td>
                <td className="p-3 text-foreground">{f.description}</td>
                <td
                  className="max-w-[200px] truncate p-3 text-xs text-muted-text"
                  title={f.example}
                >
                  {f.example}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
