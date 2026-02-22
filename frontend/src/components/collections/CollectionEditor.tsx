import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Collection, CollectionColor } from "@/types/bookmarks";

const COLORS: CollectionColor[] = [
  "blue",
  "green",
  "amber",
  "rose",
  "purple",
  "slate",
];

const COLOR_SWATCH: Record<CollectionColor, string> = {
  blue: "bg-blue-500",
  green: "bg-green-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  purple: "bg-purple-500",
  slate: "bg-slate-500",
};

interface CollectionEditorProps {
  open: boolean;
  collection?: Collection;
  onSave: (
    name: string,
    description: string,
    tags: string[],
    color?: CollectionColor,
  ) => void;
  onCancel: () => void;
}

export function CollectionEditor({
  open,
  collection,
  onSave,
  onCancel,
}: CollectionEditorProps) {
  const { t } = useTranslation();
  const nameRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [color, setColor] = useState<CollectionColor | undefined>(undefined);

  useEffect(() => {
    if (open) {
      setName(collection?.name ?? "");
      setDescription(collection?.description ?? "");
      setTags(collection?.tags ?? []);
      setColor(collection?.color);
      setTagInput("");
      setTimeout(() => nameRef.current?.focus(), 50);
    }
  }, [open, collection]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onCancel]);

  if (!open) return null;

  function handleTagKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const trimmed = tagInput.trim();
      if (trimmed && !tags.includes(trimmed)) {
        setTags([...tags, trimmed]);
      }
      setTagInput("");
    }
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed, description.trim(), tags, color);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-base font-semibold text-foreground">
            {collection
              ? t("common.edit", "Edit")
              : t("bookmarks.new_collection", "New Collection")}
          </h2>
          <button
            onClick={onCancel}
            className="rounded-md p-1 text-muted-text hover:bg-surface hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="mb-1 block text-xs font-medium text-secondary-text">
              {t("bookmarks.collection_name", "Collection Name")} *
            </label>
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
              placeholder={t("bookmarks.collection_name", "Collection Name")}
              className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground placeholder:text-muted-text focus:border-accent focus:outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-xs font-medium text-secondary-text">
              {t(
                "bookmarks.collection_description",
                "Description (optional)",
              )}
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t(
                "bookmarks.collection_description",
                "Description (optional)",
              )}
              className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground placeholder:text-muted-text focus:border-accent focus:outline-none"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="mb-1 block text-xs font-medium text-secondary-text">
              {t("bookmarks.collection_tags", "Tags")}
            </label>
            <div className="flex flex-wrap gap-1.5 rounded-md border border-border bg-surface px-3 py-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent"
                >
                  {tag}
                  <button
                    onClick={() => removeTag(tag)}
                    className="ml-0.5 text-accent/60 hover:text-accent"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder={t("bookmarks.add_tag", "Add tag")}
                className="min-w-[80px] flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-text focus:outline-none"
              />
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="mb-2 block text-xs font-medium text-secondary-text">
              {t("bookmarks.collection_color", "Colour")}
            </label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-6 w-6 rounded-full transition-transform",
                    COLOR_SWATCH[c],
                    color === c
                      ? "ring-2 ring-accent ring-offset-2 ring-offset-card scale-110"
                      : "hover:scale-110",
                  )}
                  aria-label={c}
                />
              ))}
              {color && (
                <button
                  onClick={() => setColor(undefined)}
                  className="h-6 w-6 rounded-full border border-border bg-surface text-muted-text hover:scale-110 transition-transform flex items-center justify-center"
                  aria-label="Clear color"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border border-border px-4 py-1.5 text-sm text-foreground hover:bg-surface"
          >
            {t("common.cancel", "Cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {t("common.save", "Save")}
          </button>
        </div>
      </div>
    </div>
  );
}
