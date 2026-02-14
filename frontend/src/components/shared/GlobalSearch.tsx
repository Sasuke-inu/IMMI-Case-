import { useState, useRef, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Search, X } from "lucide-react"
import { useSearchCases } from "@/hooks/use-cases"
import { cn } from "@/lib/utils"

interface GlobalSearchProps {
  open: boolean
  onClose: () => void
}

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const { data } = useSearchCases(query, 8)

  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
      setQuery("")
    }
  }, [open])

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    if (open) window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, onClose])

  if (!open) return null

  const cases = data?.cases ?? []

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
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
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search cases..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-text focus:outline-none"
            />
            <button onClick={onClose} className="text-muted-text hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Results */}
          {cases.length > 0 && (
            <ul className="max-h-80 overflow-y-auto p-2">
              {cases.map((c) => (
                <li key={c.case_id}>
                  <button
                    onClick={() => {
                      navigate(`/cases/${c.case_id}`)
                      onClose()
                    }}
                    className={cn(
                      "flex w-full flex-col gap-0.5 rounded-md px-3 py-2 text-left text-sm transition-colors",
                      "hover:bg-surface"
                    )}
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
              <p className="text-sm font-medium text-foreground">No results found</p>
              <p className="text-xs text-muted-text">Try different keywords or check spelling</p>
            </div>
          )}

          {/* Shortcuts hint */}
          <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[10px] text-muted-text">
            <span>Navigate with &uarr;&darr;</span>
            <span>
              <kbd className="rounded bg-surface px-1 py-0.5 font-mono">esc</kbd> to close
            </span>
          </div>
        </div>
      </div>
    </>
  )
}
