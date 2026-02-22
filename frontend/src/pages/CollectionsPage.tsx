import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BookmarkCheck, Bookmark, Plus } from "lucide-react";
import { Breadcrumb } from "@/components/shared/Breadcrumb";
import { CollectionCard } from "@/components/collections/CollectionCard";
import { CollectionEditor } from "@/components/collections/CollectionEditor";
import {
  useBookmarks,
  createCollection,
  updateCollection,
} from "@/hooks/use-bookmarks";
import { toast } from "sonner";
import type { CollectionColor } from "@/types/bookmarks";

export function CollectionsPage() {
  const { t } = useTranslation();
  const { bookmarks, collections } = useBookmarks();
  const [editorOpen, setEditorOpen] = useState(false);

  function handleCreate(
    name: string,
    description: string,
    tags: string[],
    color?: CollectionColor,
  ) {
    const col = createCollection(name, description, color);
    if (tags.length > 0) {
      updateCollection(col.id, { tags });
    }
    setEditorOpen(false);
    toast.success(t("bookmarks.collection_created", "Collection created"));
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb items={[{ label: t("bookmarks.collections", "Collections") }]} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-xl font-semibold text-foreground">
            {t("bookmarks.collections", "Collections")}
          </h1>
          <p className="mt-0.5 text-sm text-secondary-text">
            {t(
              "bookmarks.collections_subtitle",
              "Organise cases into named collections",
            )}
          </p>
        </div>
        <button
          onClick={() => setEditorOpen(true)}
          className="flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
        >
          <Plus className="h-4 w-4" />
          {t("bookmarks.new_collection", "New Collection")}
        </button>
      </div>

      {/* Stats */}
      <div className="flex gap-4">
        <div className="flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2">
          <Bookmark className="h-4 w-4 text-accent" />
          <span className="text-sm text-foreground">
            <span className="font-semibold">{bookmarks.length}</span>{" "}
            {t("bookmarks.add_note", "").length > 0
              ? t("units.cases", "cases")
              : "bookmarks"}
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2">
          <BookmarkCheck className="h-4 w-4 text-accent" />
          <span className="text-sm text-foreground">
            <span className="font-semibold">{collections.length}</span>{" "}
            {t("bookmarks.collections", "collections")}
          </span>
        </div>
      </div>

      {/* Collections grid */}
      {collections.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <BookmarkCheck className="mb-3 h-10 w-10 text-muted-text" />
          <p className="font-heading text-sm font-semibold text-foreground">
            {t("bookmarks.no_collections", "No collections yet")}
          </p>
          <p className="mt-1 text-xs text-muted-text">
            {t(
              "bookmarks.no_collections_description",
              "Create a collection to organise your bookmarked cases.",
            )}
          </p>
          <button
            onClick={() => setEditorOpen(true)}
            className="mt-4 flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
          >
            <Plus className="h-4 w-4" />
            {t("bookmarks.new_collection", "New Collection")}
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {collections.map((col) => (
            <CollectionCard key={col.id} collection={col} />
          ))}
        </div>
      )}

      {/* Bookmarks section — quick overview */}
      {bookmarks.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-3 font-heading text-base font-semibold text-foreground">
            {t("bookmarks.recent", "Recent Bookmarks")}
          </h2>
          <div className="space-y-2">
            {bookmarks.slice(0, 10).map((b) => (
              <div
                key={b.case_id}
                className="flex items-center gap-2 text-sm"
              >
                <Bookmark className="h-3 w-3 shrink-0 text-accent" />
                <a
                  href={`/app/cases/${b.case_id}`}
                  className="truncate text-foreground hover:text-accent"
                >
                  {b.case_citation || b.case_title}
                </a>
                {b.date && (
                  <span className="shrink-0 text-xs text-muted-text">
                    {b.date}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {bookmarks.length === 0 && collections.length === 0 && (
        <p className="text-center text-sm text-muted-text">
          {t(
            "bookmarks.no_bookmarks_description",
            "Bookmark cases from the case list or detail view.",
          )}
        </p>
      )}

      {/* Editor modal */}
      <CollectionEditor
        open={editorOpen}
        onSave={handleCreate}
        onCancel={() => setEditorOpen(false)}
      />
    </div>
  );
}
