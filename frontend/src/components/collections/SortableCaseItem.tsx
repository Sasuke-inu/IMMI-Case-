import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CourtBadge } from "@/components/shared/CourtBadge";
import type { BookmarkEntry } from "@/types/bookmarks";

interface SortableCaseItemProps {
  bookmark: BookmarkEntry;
  note: string;
  onNoteChange: (note: string) => void;
  onRemove: () => void;
}

export function SortableCaseItem({
  bookmark,
  note,
  onNoteChange,
  onRemove,
}: SortableCaseItemProps) {
  const { t } = useTranslation();
  const [editingNote, setEditingNote] = useState(false);
  const [draftNote, setDraftNote] = useState(note);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: bookmark.case_id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  function commitNote() {
    setEditingNote(false);
    onNoteChange(draftNote);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-start gap-3 rounded-md border border-border bg-card px-3 py-2.5 transition-shadow",
        isDragging && "opacity-50 shadow-lg",
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="mt-0.5 shrink-0 cursor-grab text-muted-text hover:text-foreground active:cursor-grabbing"
        aria-label={t("bookmarks.drag_to_reorder", "Drag to reorder")}
        title={t("bookmarks.drag_to_reorder", "Drag to reorder")}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Main content */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <CourtBadge court={bookmark.court_code} />
          <Link
            to={`/cases/${bookmark.case_id}`}
            className="truncate text-sm font-medium text-foreground hover:text-accent"
          >
            {bookmark.case_citation || bookmark.case_title}
          </Link>
          {bookmark.date && (
            <span className="text-xs text-muted-text">{bookmark.date}</span>
          )}
        </div>

        {/* Inline note */}
        {editingNote ? (
          <textarea
            className="mt-1.5 w-full rounded-md border border-border bg-surface px-2 py-1 text-xs text-foreground placeholder:text-muted-text focus:border-accent focus:outline-none"
            value={draftNote}
            onChange={(e) => setDraftNote(e.target.value)}
            onBlur={commitNote}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setEditingNote(false);
                setDraftNote(note);
              }
            }}
            placeholder={t("bookmarks.note_placeholder", "Notes about this case...")}
            rows={2}
            autoFocus
          />
        ) : (
          <button
            onClick={() => {
              setDraftNote(note);
              setEditingNote(true);
            }}
            className="mt-1 text-left text-xs text-muted-text hover:text-foreground"
          >
            {note || t("bookmarks.add_note", "Add a note...")}
          </button>
        )}
      </div>

      {/* Remove button */}
      <button
        onClick={onRemove}
        className="mt-0.5 shrink-0 rounded-md p-1 text-muted-text hover:bg-surface hover:text-danger"
        aria-label={t("bookmarks.remove_from_collection", "Remove from Collection")}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
