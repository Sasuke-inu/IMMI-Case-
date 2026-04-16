import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Trash2, Tag, Download, GitCompare } from "lucide-react";

export interface CasesBulkActionsProps {
  selected: Set<string>;
  onBatchTag: () => void;
  onExportCsv: () => void;
  onDeleteRequest: () => void;
  onClearSelection: () => void;
}

export function CasesBulkActions({
  selected,
  onBatchTag,
  onExportCsv,
  onDeleteRequest,
  onClearSelection,
}: CasesBulkActionsProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (selected.size === 0) return null;

  return (
    <div
      data-testid="cases-batch-bar"
      className="flex items-center gap-3 rounded-md bg-accent-muted px-4 py-2 text-sm"
    >
      <span className="font-medium text-accent">
        {selected.size} {t("cases.selected") || "selected"}
      </span>
      <button
        type="button"
        onClick={onBatchTag}
        className="flex items-center gap-1 text-accent hover:text-accent-light"
      >
        <Tag className="h-3.5 w-3.5" /> {t("case_detail.tags")}
      </button>
      <button
        type="button"
        onClick={onExportCsv}
        className="flex items-center gap-1 text-accent hover:text-accent-light"
      >
        <Download className="h-3.5 w-3.5" /> {t("buttons.export_csv")}
      </button>
      {selected.size >= 2 && selected.size <= 5 && (
        <button
          type="button"
          data-testid="cases-compare-button"
          onClick={() => {
            const ids = Array.from(selected);
            const params = new URLSearchParams();
            ids.forEach((id) => params.append("ids", id));
            navigate(`/cases/compare?${params}`);
          }}
          className="flex items-center gap-1 text-accent hover:text-accent-light"
        >
          <GitCompare className="h-3.5 w-3.5" />{" "}
          {t("buttons.compare_cases")}
        </button>
      )}
      <button
        type="button"
        onClick={onDeleteRequest}
        className="flex items-center gap-1 text-danger hover:text-danger/80"
      >
        <Trash2 className="h-3.5 w-3.5" /> {t("common.delete")}
      </button>
      <button
        type="button"
        onClick={onClearSelection}
        className="ml-auto text-muted-text hover:text-foreground"
      >
        {t("filters.clear_filters")}
      </button>
    </div>
  );
}
