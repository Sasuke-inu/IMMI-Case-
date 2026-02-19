import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { compareCases } from "@/lib/api";
import { CourtBadge } from "@/components/shared/CourtBadge";
import { OutcomeBadge } from "@/components/shared/OutcomeBadge";
import { NatureBadge } from "@/components/shared/NatureBadge";
import { Breadcrumb } from "@/components/shared/Breadcrumb";
import { EmptyState } from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils";
import { GitCompare, ExternalLink } from "lucide-react";
import type { ImmigrationCase } from "@/types/case";

const COMPARE_FIELDS: Array<{ key: keyof ImmigrationCase; label: string }> = [
  { key: "court", label: "Court" },
  { key: "court_code", label: "Court Code" },
  { key: "date", label: "Date" },
  { key: "year", label: "Year" },
  { key: "judges", label: "Judges" },
  { key: "outcome", label: "Outcome" },
  { key: "case_nature", label: "Case Nature" },
  { key: "visa_type", label: "Visa Type" },
  { key: "visa_subclass", label: "Visa Subclass" },
  { key: "legislation", label: "Legislation" },
  { key: "legal_concepts", label: "Legal Concepts" },
  { key: "catchwords", label: "Catchwords" },
  { key: "source", label: "Source" },
  { key: "tags", label: "Tags" },
];

export function CaseComparePage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const ids = searchParams.getAll("ids");

  const { data, isLoading } = useQuery({
    queryKey: ["compare", ids],
    queryFn: () => compareCases(ids),
    enabled: ids.length >= 2,
  });

  if (ids.length < 2) {
    return (
      <EmptyState
        icon={<GitCompare className="h-8 w-8" />}
        title={t("pages.case_comparison.select_cases")}
        description={t("pages.case_comparison.description")}
        action={
          <button
            onClick={() => navigate("/cases")}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-light"
          >
            {t("pages.case_comparison.go_to_cases")}
          </button>
        }
      />
    );
  }

  if (isLoading || !data) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-text">
        {t("common.loading_ellipsis")}
      </div>
    );
  }

  const cases = data.cases;

  // Detect fields that differ
  const differingFields = new Set<string>();
  for (const { key } of COMPARE_FIELDS) {
    const values = cases.map((c) => String(c[key] ?? ""));
    if (new Set(values).size > 1) differingFields.add(key);
  }

  return (
    <div className="space-y-4">
      <Breadcrumb
        items={[
          { label: t("nav.cases"), href: "/cases" },
          { label: `${t("cases.comparison")} (${cases.length})` },
        ]}
      />

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="min-w-max text-sm">
          <thead>
            <tr className="border-b border-border bg-surface">
              <th className="sticky left-0 z-10 bg-surface p-3 text-left font-medium text-secondary-text">
                {t("pages.data_dictionary.field_name")}
              </th>
              {cases.map((c) => (
                <th
                  key={c.case_id}
                  className="min-w-[200px] max-w-[250px] p-3 text-left"
                >
                  <div className="flex items-center gap-2">
                    <CourtBadge court={c.court_code} className="shrink-0" />
                    <span
                      className="line-clamp-1 font-medium text-foreground"
                      title={c.citation || c.title}
                    >
                      {c.citation || c.title}
                    </span>
                  </div>
                  <Link
                    to={`/cases/${c.case_id}`}
                    className="mt-1 inline-flex items-center gap-1 text-xs text-accent hover:underline"
                  >
                    {t("buttons.view_details")}{" "}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARE_FIELDS.map(({ key, label }) => {
              const isDiffering = differingFields.has(key);
              return (
                <tr
                  key={key}
                  className={cn(
                    "border-b border-border-light",
                    isDiffering && "bg-warning/5",
                  )}
                >
                  <td className="sticky left-0 z-10 bg-card p-3 font-medium text-secondary-text whitespace-nowrap">
                    {label}
                    {isDiffering && (
                      <span className="ml-1 text-[10px] text-warning">
                        {t("pages.case_comparison.differs")}
                      </span>
                    )}
                  </td>
                  {cases.map((c) => (
                    <td
                      key={c.case_id}
                      className="max-w-[250px] p-3 text-foreground"
                    >
                      {key === "outcome" ? (
                        <OutcomeBadge outcome={c[key]} />
                      ) : key === "court_code" ? (
                        <CourtBadge court={String(c[key] ?? "")} />
                      ) : key === "case_nature" ? (
                        <NatureBadge nature={String(c[key] ?? "")} />
                      ) : (
                        <span
                          className="line-clamp-3"
                          title={String(c[key] ?? "")}
                        >
                          {String(c[key] ?? "") || (
                            <span className="text-muted-text">—</span>
                          )}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
