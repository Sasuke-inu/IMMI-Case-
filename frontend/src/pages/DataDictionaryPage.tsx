import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { fetchDataDictionary } from "@/lib/api";
import { BookOpen, Hash, Scale, FileText, Brain, User } from "lucide-react";

interface FieldDef {
  name: string;
  type: string;
  description: string;
  example: string;
}

type FieldGroupKey =
  | "identification"
  | "court_information"
  | "case_content"
  | "extracted_fields"
  | "user_data";

const FIELD_GROUP_DEFS: Array<{
  key: FieldGroupKey;
  icon: typeof Hash;
  fields: string[];
}> = [
  {
    key: "identification",
    icon: Hash,
    fields: ["case_id", "citation", "title", "url", "source"],
  },
  {
    key: "court_information",
    icon: Scale,
    fields: ["court", "court_code", "date", "year", "judges"],
  },
  {
    key: "case_content",
    icon: FileText,
    fields: [
      "catchwords",
      "outcome",
      "legislation",
      "text_snippet",
      "full_text_path",
    ],
  },
  {
    key: "extracted_fields",
    icon: Brain,
    fields: [
      "visa_type",
      "visa_subclass",
      "visa_class_code",
      "case_nature",
      "legal_concepts",
    ],
  },
  {
    key: "user_data",
    icon: User,
    fields: ["user_notes", "tags"],
  },
];

const TYPE_COLORS: Record<string, string> = {
  string: "bg-info/10 text-info",
  integer: "bg-accent-muted text-accent",
};

export function DataDictionaryPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ["data-dictionary"],
    queryFn: fetchDataDictionary,
    staleTime: 300_000,
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-text">
        {t("common.loading_ellipsis")}
      </div>
    );
  }

  const fields = data?.fields ?? [];
  const fieldMap = new Map(fields.map((f) => [f.name, f]));

  const GROUP_LABELS: Record<FieldGroupKey, string> = {
    identification: t("pages.data_dictionary.identification"),
    court_information: t("pages.data_dictionary.court_information"),
    case_content: t("pages.data_dictionary.case_content"),
    extracted_fields: t("pages.data_dictionary.extracted_fields"),
    user_data: t("pages.data_dictionary.user_data"),
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <BookOpen className="h-6 w-6 text-accent" />
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {t("pages.data_dictionary.title")}
          </h1>
          <p className="text-sm text-muted-text">
            {fields.length} {t("pages.data_dictionary.fields")}
          </p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid gap-3 sm:grid-cols-5">
        {FIELD_GROUP_DEFS.map((g) => {
          const Icon = g.icon;
          return (
            <div
              key={g.key}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
            >
              <div className="rounded-md bg-accent-muted p-2 text-accent">
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-text">{GROUP_LABELS[g.key]}</p>
                <p className="font-mono text-sm font-medium text-foreground">
                  {g.fields.length}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Grouped tables */}
      {FIELD_GROUP_DEFS.map((group) => {
        const Icon = group.icon;
        const groupFields = group.fields
          .map((name) => fieldMap.get(name))
          .filter((f): f is FieldDef => f !== undefined);

        if (groupFields.length === 0) return null;

        return (
          <div
            key={group.key}
            className="rounded-lg border border-border bg-card"
          >
            <div className="flex items-center gap-2 border-b border-border p-4">
              <Icon className="h-5 w-5 text-accent" />
              <h2 className="font-heading text-base font-semibold">
                {GROUP_LABELS[group.key]}
              </h2>
              <span className="ml-auto rounded-full bg-surface px-2 py-0.5 text-xs text-muted-text">
                {groupFields.length} {t("pages.data_dictionary.fields")}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface">
                    <th className="p-3 text-left font-medium text-secondary-text">
                      {t("pages.data_dictionary.field_name")}
                    </th>
                    <th className="p-3 text-left font-medium text-secondary-text">
                      {t("pages.data_dictionary.field_type")}
                    </th>
                    <th className="p-3 text-left font-medium text-secondary-text">
                      {t("pages.data_dictionary.field_description")}
                    </th>
                    <th className="p-3 text-left font-medium text-secondary-text">
                      {t("pages.data_dictionary.example")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {groupFields.map((f) => (
                    <tr
                      key={f.name}
                      className="border-b border-border-light transition-colors hover:bg-surface/50"
                    >
                      <td className="p-3 font-mono text-xs text-accent whitespace-nowrap">
                        {f.name}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[f.type] ?? "bg-surface text-muted-text"}`}
                        >
                          {f.type}
                        </span>
                      </td>
                      <td className="p-3 text-foreground">{f.description}</td>
                      <td
                        className="max-w-[220px] truncate p-3 text-xs text-muted-text"
                        title={f.example}
                      >
                        <code className="rounded bg-surface px-1.5 py-0.5">
                          {f.example}
                        </code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
