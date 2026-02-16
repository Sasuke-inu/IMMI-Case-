import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import {
  Search,
  ChevronUp,
  ChevronDown,
  Download,
  Printer,
  X,
  Maximize2,
  Minimize2,
} from "lucide-react"

interface CaseTextViewerProps {
  text: string
  citation?: string
}

const SECTION_HEADINGS = /^(CATCHWORDS|DECISION|REASONS FOR DECISION|ORDER|ORDERS|THE DECISION|LEGISLATION|REASONS|BACKGROUND|FINDINGS AND REASONS|CONSIDERATION|CONCLUSION|APPEARANCES|REPRESENTATION|THE FACTS|ISSUES|SUBMISSIONS|ANALYSIS|EVIDENCE)/m

export function CaseTextViewer({ text, citation }: CaseTextViewerProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [activeMatchIdx, setActiveMatchIdx] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Find all matches
  const matches = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return []
    const results: number[] = []
    const lower = text.toLowerCase()
    const term = searchTerm.toLowerCase()
    let idx = lower.indexOf(term)
    while (idx !== -1) {
      results.push(idx)
      idx = lower.indexOf(term, idx + 1)
    }
    return results
  }, [text, searchTerm])

  // Reset active match when matches change
  useEffect(() => {
    setActiveMatchIdx(0)
  }, [matches.length])

  // Scroll active match into view
  useEffect(() => {
    if (matches.length === 0) return
    const el = containerRef.current?.querySelector(".active-match")
    el?.scrollIntoView({ block: "center", behavior: "smooth" })
  }, [activeMatchIdx, matches.length])

  // Ctrl+F intercept
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault()
        setShowSearch(true)
        setTimeout(() => searchInputRef.current?.focus(), 50)
      }
      if (e.key === "Escape" && showSearch) {
        setShowSearch(false)
        setSearchTerm("")
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [showSearch])

  const goToMatch = useCallback(
    (dir: 1 | -1) => {
      if (matches.length === 0) return
      setActiveMatchIdx((prev) => (prev + dir + matches.length) % matches.length)
    },
    [matches.length]
  )

  const handleDownload = useCallback(() => {
    const blob = new Blob([text], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${citation ?? "case"}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }, [text, citation])

  const handlePrint = useCallback(() => {
    const w = window.open("", "_blank")
    if (!w) return
    w.document.write(`<html><head><title>${citation ?? "Case"}</title>
      <style>body{font-family:monospace;font-size:12px;white-space:pre-wrap;padding:2em;line-height:1.6}</style>
      </head><body>${text.replace(/</g, "&lt;")}</body></html>`)
    w.document.close()
    w.print()
  }, [text, citation])

  // Render text with search highlights and section formatting
  const rendered = useMemo(() => {
    if (!text) return null

    if (searchTerm && searchTerm.length >= 2 && matches.length > 0) {
      const parts: Array<{ text: string; isMatch: boolean; matchIdx: number }> = []
      let lastEnd = 0
      matches.forEach((start, i) => {
        if (start > lastEnd) {
          parts.push({ text: text.slice(lastEnd, start), isMatch: false, matchIdx: -1 })
        }
        parts.push({ text: text.slice(start, start + searchTerm.length), isMatch: true, matchIdx: i })
        lastEnd = start + searchTerm.length
      })
      if (lastEnd < text.length) {
        parts.push({ text: text.slice(lastEnd), isMatch: false, matchIdx: -1 })
      }

      return parts.map((part, i) =>
        part.isMatch ? (
          <mark
            key={i}
            className={
              part.matchIdx === activeMatchIdx
                ? "active-match bg-warning text-foreground rounded-sm px-0.5"
                : "bg-warning/30 rounded-sm px-0.5"
            }
          >
            {part.text}
          </mark>
        ) : (
          <span key={i}>{formatSections(part.text)}</span>
        )
      )
    }

    return formatSections(text)
  }, [text, searchTerm, matches, activeMatchIdx])

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <h2 className="font-heading text-lg font-semibold text-foreground">Full Text</h2>
        <div className="ml-auto flex items-center gap-1.5">
          {showSearch ? (
            <div className="flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1">
              <Search className="h-3.5 w-3.5 text-muted-text" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") goToMatch(e.shiftKey ? -1 : 1)
                }}
                placeholder="Search in text..."
                className="w-40 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-text"
              />
              {matches.length > 0 && (
                <span className="text-xs text-muted-text whitespace-nowrap">
                  {activeMatchIdx + 1}/{matches.length}
                </span>
              )}
              <button onClick={() => goToMatch(-1)} className="p-0.5 text-muted-text hover:text-foreground">
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => goToMatch(1)} className="p-0.5 text-muted-text hover:text-foreground">
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => { setShowSearch(false); setSearchTerm("") }}
                className="p-0.5 text-muted-text hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setShowSearch(true); setTimeout(() => searchInputRef.current?.focus(), 50) }}
              className="rounded-md p-1.5 text-muted-text hover:bg-surface hover:text-foreground"
              title="Search (Ctrl+F)"
            >
              <Search className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={handleDownload}
            className="rounded-md p-1.5 text-muted-text hover:bg-surface hover:text-foreground"
            title="Download .txt"
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            onClick={handlePrint}
            className="rounded-md p-1.5 text-muted-text hover:bg-surface hover:text-foreground"
            title="Print"
          >
            <Printer className="h-4 w-4" />
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="rounded-md p-1.5 text-muted-text hover:bg-surface hover:text-foreground"
            title={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Text content */}
      <div
        ref={containerRef}
        className={`overflow-auto whitespace-pre-wrap p-4 font-mono text-xs leading-relaxed text-foreground ${
          expanded ? "max-h-none" : "max-h-[600px]"
        }`}
      >
        {rendered}
      </div>
    </div>
  )
}

function formatSections(text: string): React.ReactNode {
  const lines = text.split("\n")
  return lines.map((line, i) => {
    const isHeading = SECTION_HEADINGS.test(line.trim())
    if (isHeading) {
      return (
        <span key={i}>
          {i > 0 && "\n"}
          <strong className="text-sm text-accent">{line}</strong>
        </span>
      )
    }
    return <span key={i}>{i > 0 ? "\n" : ""}{line}</span>
  })
}
