import { Bookmark } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useBookmarks,
  addBookmark,
  removeBookmark,
} from "@/hooks/use-bookmarks";

interface BookmarkButtonProps {
  caseId: string;
  caseTitle: string;
  caseCitation: string;
  courtCode: string;
  date: string;
  size?: "sm" | "md";
  className?: string;
}

export function BookmarkButton({
  caseId,
  caseTitle,
  caseCitation,
  courtCode,
  date,
  size = "md",
  className,
}: BookmarkButtonProps) {
  const { t } = useTranslation();
  const { isBookmarked } = useBookmarks();
  const bookmarked = isBookmarked(caseId);

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (bookmarked) {
      removeBookmark(caseId);
      toast.success(t("bookmarks.removed", "Bookmark removed"));
    } else {
      addBookmark({
        case_id: caseId,
        case_title: caseTitle,
        case_citation: caseCitation,
        court_code: courtCode,
        date,
      });
      toast.success(t("bookmarks.added", "Case bookmarked"));
    }
  }

  return (
    <button
      onClick={handleClick}
      aria-pressed={bookmarked}
      aria-label={
        bookmarked
          ? t("bookmarks.remove", "Remove bookmark")
          : t("bookmarks.add", "Bookmark case")
      }
      className={cn(
        "rounded-md transition-colors",
        size === "sm"
          ? "p-1 text-muted-text hover:bg-surface hover:text-accent"
          : "p-1.5 text-muted-text hover:bg-surface hover:text-accent",
        bookmarked && "text-accent",
        className,
      )}
    >
      <Bookmark
        className={cn(size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4")}
        fill={bookmarked ? "currentColor" : "none"}
      />
    </button>
  );
}
