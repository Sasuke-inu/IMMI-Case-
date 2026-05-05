import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Search, X } from "lucide-react";
import { useSearchCases } from "@/hooks/use-cases";
import { cn } from "@/lib/utils";

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

interface GlobalSearchDialogProps {
  onClose: () => void;
}

function GlobalSearchDialog({ onClose }: GlobalSearchDialogProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { data } = useSearchCases(query, 8);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const cases = data?.cases ?? [];
  const hasResults = cases.length > 0;

  const clampedActiveIdx = useMemo(() => {
    if (!hasResults) return 0;
    return Math.min(activeIdx, cases.length - 1);
  }, [activeIdx, hasResults, cases.length]);

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-[var(--color-overlay)]/65 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-x-0 top-[15vh] z-50 mx-auto w-full max-w-lg px-4">
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-lg">
          {/* Search input */}
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Search className="h-4 w-4 text-muted-text" />
            <input
              ref={inputRef}
              data-global-search
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIdx(0);
              }}
              onKeyDown={(e) => {
                if (!hasResults) return;
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActiveIdx((prev) => Math.min(prev + 1, cases.length - 1));
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActiveIdx((prev) => Math.max(prev - 1, 0));
                  return;
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  const selectedCase = cases[clampedActiveIdx];
                  if (!selectedCase) return;
                  navigate(`/cases/${selectedCase.case_id}`);
                  onClose();
                }
              }}
              placeholder={t("common.search_cases_placeholder")}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-text focus:outline-none"
            />
            <button
              onClick={onClose}
              className="text-muted-text hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Results */}
          {cases.length > 0 && (
            <ul className="max-h-80 overflow-y-auto p-2">
              {cases.map((c, idx) => (
                <li key={c.case_id}>
                  <button
                    onClick={() => {
                      navigate(`/cases/${c.case_id}`);
                      onClose();
                    }}
                    className={cn(
                      "flex w-full flex-col gap-0.5 rounded-md px-3 py-2 text-left text-sm transition-colors",
                      idx === clampedActiveIdx
                        ? "bg-accent/10 ring-1 ring-accent/30"
                        : "hover:bg-surface",
                    )}
                    aria-current={idx === clampedActiveIdx ? "true" : "false"}
                  >
                    <span
                      className="font-medium text-foreground line-clamp-1"
                      title={c.title || c.citation}
                    >
                      {c.title || c.citation}
                    </span>
                    <span className="text-xs text-muted-text">
                      {c.court_code} &middot; {c.date}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {query.length > 0 && cases.length === 0 && (
            <div className="flex flex-col items-center gap-1 p-6 text-center">
              <p className="text-sm font-medium text-foreground">
                {t("common.no_results")}
              </p>
              <p className="text-xs text-muted-text">
                {t("tooltips.navigate_up_down")}
              </p>
            </div>
          )}

          {/* Shortcuts hint */}
          <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[10px] text-muted-text">
            <span>
              {hasResults
                ? t("tooltips.navigate_up_down")
                : t("tooltips.type_to_search", { defaultValue: "Type to search" })}
            </span>
            <span>
              <kbd className="rounded bg-surface px-1 py-0.5 font-mono">
                esc
              </kbd>{" "}
              {t("tooltips.escape_to_close")}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  if (!open) return null;
  return <GlobalSearchDialog onClose={onClose} />;
}
