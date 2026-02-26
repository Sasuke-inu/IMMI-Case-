import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Search, Zap, AlertCircle, ExternalLink } from "lucide-react";
import { useSemanticSearch } from "@/hooks/use-semantic-search";
import { OutcomeBadge } from "@/components/shared/OutcomeBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import type { SemanticSearchResult } from "@/lib/api";

// ─── Similarity badge ────────────────────────────────────────────
function SimilarityBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 85
      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
      : pct >= 70
        ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}
    >
      {pct}% match
    </span>
  );
}

// ─── Result card ─────────────────────────────────────────────────
function ResultCard({ result }: { result: SemanticSearchResult }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-xs hover:border-primary/40 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            to={`/cases/${result.case_id}`}
            className="text-sm font-medium text-primary hover:underline line-clamp-2"
          >
            {result.title || result.citation}
          </Link>
          {result.title && (
            <p className="mt-0.5 text-xs text-muted-foreground truncate">
              {result.citation}
            </p>
          )}
        </div>
        <SimilarityBadge score={result.similarity_score} />
      </div>
      <div className="mt-2 flex items-center gap-2">
        {result.outcome && <OutcomeBadge outcome={result.outcome} />}
        <Link
          to={`/cases/${result.case_id}`}
          className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
        >
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────
export function SemanticSearchPage() {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [provider, setProvider] = useState<"openai" | "gemini">("openai");

  const { data, isFetching, isError, error } = useSemanticSearch(
    submittedQuery,
    10,
    provider,
    !!submittedQuery,
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const q = inputValue.trim();
      if (q.length >= 3) {
        setSubmittedQuery(q);
      }
    },
    [inputValue],
  );

  const unavailable = data && !data.available;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Zap className="h-6 w-6 text-primary" />
          {t("semantic_search.title", { defaultValue: "Semantic Search" })}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("semantic_search.description", {
            defaultValue:
              "Search by meaning, not just keywords. Uses AI embeddings to find semantically similar cases.",
          })}
        </p>
      </div>

      {/* Search form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={t("semantic_search.placeholder", {
                defaultValue: "Describe the case situation… (min 3 chars)",
              })}
              className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm shadow-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            type="submit"
            disabled={inputValue.trim().length < 3 || isFetching}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 transition-opacity"
          >
            {isFetching
              ? t("semantic_search.searching", { defaultValue: "Searching…" })
              : t("semantic_search.search_btn", { defaultValue: "Search" })}
          </button>
        </div>

        {/* Provider toggle */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            {t("semantic_search.model_label", { defaultValue: "Model:" })}
          </span>
          {(["openai", "gemini"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setProvider(p)}
              className={`rounded px-2 py-0.5 font-medium transition-colors ${
                provider === p
                  ? "bg-primary/10 text-primary"
                  : "hover:text-foreground"
              }`}
            >
              {p === "openai" ? "OpenAI" : "Gemini"}
            </button>
          ))}
        </div>
      </form>

      {/* Results area */}
      {unavailable && (
        <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {t("semantic_search.unavailable", {
              defaultValue:
                "Semantic search is not available. Ensure the Supabase backend is configured and an API key is set.",
            })}
          </span>
        </div>
      )}

      {isError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {String(error)}
        </div>
      )}

      {isFetching && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      )}

      {!isFetching &&
        data?.available &&
        data.results.length === 0 &&
        submittedQuery && (
          <EmptyState
            title={t("semantic_search.no_results_title", {
              defaultValue: "No results found",
            })}
            description={t("semantic_search.no_results_desc", {
              defaultValue: "Try rephrasing or using different terminology.",
            })}
          />
        )}

      {!isFetching && data?.available && data.results.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {t("semantic_search.results_count", {
              count: data.results.length,
              defaultValue: `${data.results.length} results`,
            })}
          </p>
          {data.results.map((result) => (
            <ResultCard key={result.case_id} result={result} />
          ))}
        </div>
      )}
    </div>
  );
}
