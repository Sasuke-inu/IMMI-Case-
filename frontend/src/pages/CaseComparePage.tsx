import { useSearchParams, useNavigate } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { compareCases } from "@/lib/api"
import { CourtBadge } from "@/components/shared/CourtBadge"
import { OutcomeBadge } from "@/components/shared/OutcomeBadge"

export function CaseComparePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const ids = searchParams.getAll("ids")

  const { data, isLoading } = useQuery({
    queryKey: ["compare", ids],
    queryFn: () => compareCases(ids),
    enabled: ids.length >= 2,
  })

  if (ids.length < 2) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-text">
        <p>Select at least 2 cases to compare.</p>
        <button
          onClick={() => navigate("/cases")}
          className="text-accent hover:underline"
        >
          Go to Cases
        </button>
      </div>
    )
  }

  if (isLoading || !data) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-text">
        Loading comparison...
      </div>
    )
  }

  const cases = data.cases
  const compareFields = [
    "court", "court_code", "date", "year", "judges", "outcome",
    "visa_type", "case_nature", "legislation", "legal_concepts",
    "catchwords", "source", "tags",
  ] as const

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-muted-text hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <h1 className="text-2xl font-semibold text-foreground">Compare Cases</h1>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="min-w-max text-sm">
          <thead>
            <tr className="border-b border-border bg-surface">
              <th className="sticky left-0 bg-surface p-3 text-left font-medium text-muted-text">Field</th>
              {cases.map((c) => (
                <th key={c.case_id} className="max-w-[220px] p-3 text-left">
                  <div className="flex items-center gap-2">
                    <CourtBadge court={c.court_code} className="shrink-0" />
                    <span
                      className="line-clamp-1 font-medium text-foreground"
                      title={c.citation || c.title}
                    >
                      {c.citation || c.title}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {compareFields.map((field) => (
              <tr key={field} className="border-b border-border-light">
                <td className="sticky left-0 bg-card p-3 font-medium text-muted-text capitalize whitespace-nowrap">
                  {field.replace(/_/g, " ")}
                </td>
                {cases.map((c) => (
                  <td
                    key={c.case_id}
                    className="max-w-[250px] p-3 text-foreground"
                    title={String(c[field] ?? "")}
                  >
                    {field === "outcome" ? (
                      <OutcomeBadge outcome={c[field]} />
                    ) : (
                      <span className="line-clamp-3">{String(c[field] ?? "")}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
