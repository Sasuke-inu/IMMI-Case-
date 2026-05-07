/**
 * frontend/src/components/llm-council/TurnCard.tsx
 *
 * Renders a single council session turn (Sprint 3 UI rebuild):
 *   - User message header
 *   - Moderator synthesis (top — primary answer, like a legal memo's holding)
 *     + Likelihood badge
 *     + Composed answer
 *     + Law sections cross-reference table (provider × statute matrix)
 *     + Consensus / Disagreements
 *     + Follow-up questions
 *   - Expert opinions (collapsible accordion, default closed)
 *     + Tab navigation between providers
 *     + Per-tab answer + sources + status
 *
 * Mobile + desktop: experts collapsed by default (moderator is the holding).
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Scale,
  Sparkles,
  User,
} from "lucide-react";
import { ApiErrorState } from "@/components/shared/ApiErrorState";
import type {
  LlmCouncilTurn,
  LlmCouncilOpinion,
  LlmCouncilModerator,
} from "@/lib/api-llm-council";

// ---------------------------------------------------------------------------
// Likelihood styling helpers
// ---------------------------------------------------------------------------

function likelihoodTone(label: string) {
  const normalized = (label || "").toLowerCase();
  if (normalized === "high") return "text-emerald-700 dark:text-emerald-300";
  if (normalized === "medium") return "text-amber-700 dark:text-amber-300";
  if (normalized === "low") return "text-rose-700 dark:text-rose-300";
  return "text-muted-text";
}

function likelihoodBadge(label: string) {
  const normalized = (label || "").toLowerCase();
  if (normalized === "high")
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
  if (normalized === "medium")
    return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
  if (normalized === "low")
    return "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300";
  return "bg-surface text-muted-text";
}

function sectionKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

// ---------------------------------------------------------------------------
// LawSectionsTable — provider × statute cross-reference (Sprint 3 P3-2)
// ---------------------------------------------------------------------------

interface LawSectionsTableProps {
  providerLawSections: Record<string, string[]>;
  sharedLawSections: string[];
  providerLabels: Record<string, string>;
  confidence: number;
  confidenceReason: string;
}

function LawSectionsTable({
  providerLawSections,
  sharedLawSections,
  providerLabels,
  confidence,
  confidenceReason,
}: LawSectionsTableProps) {
  const { t } = useTranslation();

  const providers = Object.keys(providerLawSections).sort();
  if (providers.length === 0) return null;

  const sectionMap = new Map<string, string>();
  for (const provider of providers) {
    for (const section of providerLawSections[provider] || []) {
      const key = sectionKey(section);
      if (key && !sectionMap.has(key)) {
        sectionMap.set(key, section);
      }
    }
  }
  const allSections = Array.from(sectionMap.values());
  if (allSections.length === 0) return null;

  const sharedKeys = new Set(sharedLawSections.map(sectionKey));
  const cited = (provider: string, key: string): boolean => {
    const list = providerLawSections[provider] || [];
    return list.some((s) => sectionKey(s) === key);
  };

  return (
    <div
      className="mt-4 rounded-md border border-border bg-surface/40"
      data-testid="law-sections-table"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <Scale className="h-3.5 w-3.5 text-accent" />
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-text">
            {t("llm_council.law_sections_table_title", {
              defaultValue: "Statute Citations Cross-Reference",
            })}
          </p>
        </div>
        {confidence > 0 ? (
          <span
            title={confidenceReason}
            className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent"
          >
            {t("llm_council.citation_confidence", {
              defaultValue: "Citation overlap",
            })}
            : {confidence}%
          </span>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-background/50 text-muted-text">
              <th className="px-3 py-1.5 text-left font-semibold">
                {t("llm_council.law_section_col", {
                  defaultValue: "Statute / Regulation",
                })}
              </th>
              {providers.map((p) => (
                <th
                  key={p}
                  className="px-2 py-1.5 text-center font-semibold whitespace-nowrap"
                >
                  {providerLabels[p] || p}
                </th>
              ))}
              <th className="px-2 py-1.5 text-center font-semibold whitespace-nowrap">
                {t("llm_council.shared_col", { defaultValue: "All Agree" })}
              </th>
            </tr>
          </thead>
          <tbody>
            {allSections.map((section) => {
              const key = sectionKey(section);
              const isShared = sharedKeys.has(key);
              return (
                <tr
                  key={key}
                  className={`border-b border-border/50 last:border-b-0 ${
                    isShared ? "bg-emerald-50 dark:bg-emerald-900/10" : ""
                  }`}
                >
                  <td className="px-3 py-1.5 font-medium text-foreground">
                    {section}
                  </td>
                  {providers.map((p) => (
                    <td key={p} className="px-2 py-1.5 text-center">
                      {cited(p, key) ? (
                        <CheckCircle2
                          className="mx-auto h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"
                          aria-label={`${providerLabels[p] || p} cited`}
                        />
                      ) : (
                        <span aria-label="Not cited" className="text-muted-text">
                          —
                        </span>
                      )}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-center">
                    {isShared ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                        ✓
                      </span>
                    ) : (
                      <span className="text-muted-text">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ModeratorSection — moved to top, primary answer block
// ---------------------------------------------------------------------------

interface ModeratorSectionProps {
  moderator: LlmCouncilModerator;
  providerLabels: Record<string, string>;
}

function ModeratorSection({ moderator, providerLabels }: ModeratorSectionProps) {
  const { t } = useTranslation();

  if (!moderator.success) {
    return (
      <div
        className="rounded-xl border border-border/80 bg-card p-4 shadow-sm"
        data-testid="moderator-section"
      >
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-semibold text-foreground">
            {t("llm_council.moderator_section_title", {
              defaultValue: "Moderator Synthesis",
            })}
          </h3>
        </div>
        <ApiErrorState
          title={t("llm_council.moderator_failed_title", {
            defaultValue: "Moderator synthesis unavailable",
          })}
          message={
            moderator.error ||
            t("llm_council.unknown_moderator_error", {
              defaultValue: "Unknown moderator error",
            })
          }
        />
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border border-border/80 bg-card p-4 shadow-sm"
      data-testid="moderator-section"
    >
      <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
        <Sparkles className="h-4 w-4 text-accent" />
        <h3 className="text-sm font-semibold text-foreground">
          {t("llm_council.moderator_section_title", {
            defaultValue: "Moderator Synthesis",
          })}
        </h3>
        {moderator.outcome_likelihood_label ? (
          <span
            className={`ml-auto rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${likelihoodBadge(
              moderator.outcome_likelihood_label,
            )}`}
          >
            {(moderator.outcome_likelihood_label || "unknown").toUpperCase()}
          </span>
        ) : null}
        {typeof moderator.outcome_likelihood_percent === "number" ? (
          <span
            className={`text-sm font-bold tabular-nums ${likelihoodTone(
              moderator.outcome_likelihood_label,
            )}`}
          >
            {moderator.outcome_likelihood_percent}%
          </span>
        ) : null}
      </div>

      {moderator.mock_judgment || moderator.composed_answer ? (
        <div className="rounded-md border border-border bg-surface p-3">
          <p className="mb-1 text-xs uppercase tracking-wide text-muted-text">
            {t("llm_council.composed_answer_label", {
              defaultValue: "Integrated Council Analysis",
            })}
          </p>
          <p className="whitespace-pre-wrap text-sm text-foreground">
            {moderator.mock_judgment || moderator.composed_answer}
          </p>
        </div>
      ) : null}

      {moderator.consensus ? (
        <p className="mt-3 text-xs text-muted-text">
          <span className="font-semibold">
            {t("llm_council.consensus_label", { defaultValue: "Consensus" })}:{" "}
          </span>
          {moderator.consensus}
        </p>
      ) : null}

      {moderator.disagreements ? (
        <p className="mt-1 text-xs text-muted-text">
          <span className="font-semibold">
            {t("llm_council.disagreements_label", {
              defaultValue: "Disagreements",
            })}
            :{" "}
          </span>
          {moderator.disagreements}
        </p>
      ) : null}

      {moderator.provider_law_sections &&
      Object.keys(moderator.provider_law_sections).length > 0 ? (
        <LawSectionsTable
          providerLawSections={moderator.provider_law_sections}
          sharedLawSections={moderator.shared_law_sections || []}
          providerLabels={providerLabels}
          confidence={moderator.shared_law_sections_confidence_percent || 0}
          confidenceReason={moderator.shared_law_sections_confidence_reason || ""}
        />
      ) : null}

      {moderator.follow_up_questions && moderator.follow_up_questions.length > 0 ? (
        <div className="mt-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-text">
            {t("llm_council.follow_up_label", {
              defaultValue: "Follow-up Questions",
            })}
          </p>
          <ul className="space-y-1 text-xs text-muted-text">
            {moderator.follow_up_questions.map((q, i) => (
              <li key={i}>• {q}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ExpertTabs — tabbed expert opinions inside collapsible accordion
// ---------------------------------------------------------------------------

interface ExpertTabsProps {
  opinions: LlmCouncilOpinion[];
}

function ExpertTabs({ opinions }: ExpertTabsProps) {
  const { t } = useTranslation();
  const [activeKey, setActiveKey] = useState<string>(
    opinions[0]?.provider_key || "",
  );

  if (opinions.length === 0) return null;

  const active = opinions.find((o) => o.provider_key === activeKey) || opinions[0];

  return (
    <div className="space-y-3" data-testid="expert-tabs">
      <div
        role="tablist"
        className="-mb-px flex flex-wrap gap-1 border-b border-border"
      >
        {opinions.map((op) => {
          const isActive = op.provider_key === active.provider_key;
          return (
            <button
              key={op.provider_key}
              role="tab"
              aria-selected={isActive}
              data-testid={`expert-tab-${op.provider_key}`}
              onClick={() => setActiveKey(op.provider_key)}
              className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition-colors ${
                isActive
                  ? "border-accent text-accent"
                  : "border-transparent text-muted-text hover:text-foreground"
              }`}
            >
              {op.success ? (
                <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
              )}
              <span>{op.provider_label}</span>
            </button>
          );
        })}
      </div>

      <article
        role="tabpanel"
        className="rounded-md border border-border/80 bg-card p-3"
        aria-label={active.provider_label}
      >
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-muted-text">
            <Bot className="h-3.5 w-3.5" />
            <span className="font-mono">{active.model}</span>
          </div>
          <div>
            {active.success ? (
              <span className="text-emerald-700 dark:text-emerald-400">
                {t("llm_council.status_ok", {
                  defaultValue: "OK ({{latency}} ms)",
                  latency: active.latency_ms,
                })}
              </span>
            ) : (
              <span className="text-amber-700 dark:text-amber-400">
                {t("llm_council.status_failed", {
                  defaultValue: "Failed ({{latency}} ms)",
                  latency: active.latency_ms,
                })}
              </span>
            )}
          </div>
        </div>

        {active.success ? (
          <>
            <p className="whitespace-pre-wrap text-sm text-foreground">
              {active.answer}
            </p>
            {active.sources.length > 0 ? (
              <div className="mt-3">
                <p className="mb-1 text-xs uppercase tracking-wide text-muted-text">
                  {t("llm_council.sources_label", { defaultValue: "Sources" })}
                </p>
                <div className="space-y-1">
                  {active.sources.map((source) => (
                    <a
                      key={source}
                      href={source}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 break-all text-xs text-accent hover:underline"
                    >
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      {source}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <ApiErrorState
            title={t("llm_council.expert_failed_title", {
              defaultValue: "Model request failed",
            })}
            message={
              active.error ||
              t("llm_council.unknown_model_error", {
                defaultValue: "Unknown model error",
              })
            }
          />
        )}
      </article>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TurnCard (exported)
// ---------------------------------------------------------------------------

export interface TurnCardProps {
  turn: LlmCouncilTurn;
  turnNumber: number;
}

export function TurnCard({ turn, turnNumber }: TurnCardProps) {
  const { t } = useTranslation();
  const [expertsExpanded, setExpertsExpanded] = useState(false);

  const providerLabels: Record<string, string> = {};
  for (const op of turn.opinions || []) {
    providerLabels[op.provider_key] = op.provider_label;
  }

  const successCount = (turn.opinions || []).filter((o) => o.success).length;

  return (
    <div
      className="space-y-3"
      data-testid="turn-card"
      aria-label={`Turn ${turnNumber}`}
    >
      {/* User message */}
      <div className="flex items-start gap-3 rounded-xl border border-border/80 bg-surface/60 p-4">
        <div className="mt-0.5 rounded-full bg-accent/15 p-1.5 text-accent">
          <User className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-text">
            {t("llm_council.turn_label", { defaultValue: "Turn" })}{" "}
            {turnNumber} —{" "}
            {t("llm_council.turn_your_question", {
              defaultValue: "Your question",
            })}
          </p>
          <p className="text-sm text-foreground">{turn.user_message}</p>
        </div>
      </div>

      {/* Moderator synthesis — TOP placement (primary holding) */}
      <ModeratorSection
        moderator={turn.moderator}
        providerLabels={providerLabels}
      />

      {/* Expert opinions — collapsible accordion with tabs */}
      {turn.opinions && turn.opinions.length > 0 ? (
        <div className="rounded-xl border border-border/80 bg-card shadow-sm">
          <button
            type="button"
            onClick={() => setExpertsExpanded((v) => !v)}
            aria-expanded={expertsExpanded}
            data-testid="experts-toggle"
            className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-surface/50"
          >
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-accent" />
              <span className="text-sm font-semibold text-foreground">
                {t("llm_council.expert_title", {
                  defaultValue: "Expert Model Opinions",
                })}
              </span>
              <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-text">
                {successCount}/{turn.opinions.length}{" "}
                {t("llm_council.experts_ok_label", { defaultValue: "OK" })}
              </span>
            </div>
            {expertsExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-text" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-text" />
            )}
          </button>
          {expertsExpanded ? (
            <div className="border-t border-border px-4 pb-4 pt-3">
              <ExpertTabs opinions={turn.opinions} />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
