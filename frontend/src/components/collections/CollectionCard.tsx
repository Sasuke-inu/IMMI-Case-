import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BookmarkCheck, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Collection, CollectionColor } from "@/types/bookmarks";

const COLOR_CLASSES: Record<CollectionColor, string> = {
  blue: "border-l-blue-500",
  green: "border-l-green-500",
  amber: "border-l-amber-500",
  rose: "border-l-rose-500",
  purple: "border-l-purple-500",
  slate: "border-l-slate-500",
};

interface CollectionCardProps {
  collection: Collection;
}

export function CollectionCard({ collection }: CollectionCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const colorClass = collection.color
    ? COLOR_CLASSES[collection.color]
    : "border-l-border";

  const caseCount = collection.case_order.length;
  const caseCountLabel =
    caseCount === 1
      ? t("bookmarks.cases_count_one", "1 case")
      : t("bookmarks.cases_count_other", "{{count}} cases", {
          count: caseCount,
        });

  return (
    <button
      onClick={() => navigate(`/collections/${collection.id}`)}
      className={cn(
        "group flex w-full flex-col rounded-lg border border-border bg-card p-4 text-left shadow-xs transition-all duration-150",
        "hover:-translate-y-0.5 hover:shadow-md",
        "border-l-[3px]",
        colorClass,
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <BookmarkCheck className="h-4 w-4 shrink-0 text-accent" />
          <h3 className="font-heading text-sm font-semibold text-foreground transition-colors group-hover:text-accent">
            {collection.name}
          </h3>
        </div>
        <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-xs text-muted-text">
          {caseCountLabel}
        </span>
      </div>

      {collection.description && (
        <p className="mb-2 line-clamp-2 text-xs text-secondary-text">
          {collection.description}
        </p>
      )}

      {collection.tags.length > 0 && (
        <div className="mt-auto flex flex-wrap gap-1 pt-2">
          <Tag className="h-3 w-3 shrink-0 text-muted-text" />
          {collection.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-surface px-1.5 py-0.5 text-[10px] text-muted-text"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}
