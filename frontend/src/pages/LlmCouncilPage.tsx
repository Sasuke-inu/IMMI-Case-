import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ExternalLink,
  Info,
  Loader2,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useLlmCouncil, useLlmCouncilHealthCheck } from "@/hooks/use-llm-council";
import type { LlmCouncilHealthResponse, LlmCouncilResponse } from "@/lib/api";
import { ApiErrorState } from "@/components/shared/ApiErrorState";

const DEFAULT_MODELS: LlmCouncilResponse["models"] = {
  openai: {
    provider: "OpenAI",
    model: "chatgpt-5.2",
    reasoning: "medium",
    web_search: true,
  },
  gemini_pro: {
    provider: "Google",
    model: "gemini-3.0-pro",
    reasoning_budget: 1024,
    grounding_google_search: true,
  },
  anthropic: {
    provider: "Anthropic",
    model: "claude-sonnet-4-6",
    reasoning_budget: 4096,
    web_search: true,
  },
  gemini_flash: {
    provider: "Google",
    model: "gemini-3.0-flash",
    role: "middle_ranking_and_composer",
  },
};

const OPINION_ORDER = ["openai", "gemini_pro", "anthropic"];

function modelMetaLine(config: {
  reasoning?: string;
  reasoning_budget?: number;
  web_search?: boolean;
  grounding_google_search?: boolean;
  role?: string;
}) {
  const parts: string[] = [];
  if (config.reasoning) parts.push(`reasoning=${config.reasoning}`);
  if (typeof config.reasoning_budget === "number") {
    parts.push(`thinking_budget=${config.reasoning_budget}`);
  }
  if (config.web_search) parts.push("web_search=on");
  if (config.grounding_google_search) parts.push("google_grounding=on");
  if (config.role) parts.push(`role=${config.role}`);
  return parts.join(" • ");
}

function likelihoodTone(label: string) {
  const normalized = (label || "").toLowerCase();
  if (normalized === "high") return "text-emerald-700 dark:text-emerald-300";
  if (normalized === "medium") return "text-amber-700 dark:text-amber-300";
  if (normalized === "low") return "text-rose-700 dark:text-rose-300";
  return "text-muted-text";
}

function lawSectionSearchHref(section: string) {
  const normalized = (section || "").trim();
  if (!normalized) return "/legislations";
  const actMatch = normalized.match(/^(.+?)\s+s\.?\s*\d+/i);
  const query = (actMatch?.[1] || normalized).trim();
  return `/legislations?q=${encodeURIComponent(query)}`;
}

export function LlmCouncilPage() {
  const { t } = useTranslation();
  const [question, setQuestion] = useState("");
  const [caseId, setCaseId] = useState("");
  const [context, setContext] = useState("");
  const [result, setResult] = useState<LlmCouncilResponse | null>(null);
  const [healthResult, setHealthResult] = useState<LlmCouncilHealthResponse | null>(null);
  const [healthError, setHealthError] = useState("");
  const [healthLiveProbe, setHealthLiveProbe] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const councilMutation = useLlmCouncil();
  const healthMutation = useLlmCouncilHealthCheck();

  const models = result?.models ?? DEFAULT_MODELS;
  const sortedOpinions = useMemo(() => {
    if (!result) return [];
    const byKey = new Map(result.opinions.map((entry) => [entry.provider_key, entry]));
    return OPINION_ORDER.map((key) => byKey.get(key)).filter(
      (
        entry,
      ): entry is LlmCouncilResponse["opinions"][number] => entry !== undefined,
    );
  }, [result]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = question.trim();
    if (!q) {
      toast.error(
        t("llm_council.validation_question_required", {
          defaultValue: "Please enter your legal research question.",
        }),
      );
      return;
    }
    setSubmitError("");
    try {
      const payload = await councilMutation.mutateAsync({
        question: q,
        case_id: caseId.trim() || undefined,
        context: context.trim() || undefined,
      });
      setResult(payload);
      toast.success(
        t("llm_council.run_success", {
          defaultValue: "LLM council completed.",
        }),
      );
    } catch (error) {
      const msg =
        (error as Error).message ||
        t("llm_council.request_failed", {
          defaultValue: "LLM council request failed",
        });
      setSubmitError(msg);
      toast.error(msg);
    }
  }

  async function onHealthCheck() {
    setHealthError("");
    try {
      const payload = await healthMutation.mutateAsync({ live: healthLiveProbe });
      setHealthResult(payload);
      toast.success(
        payload.ok
          ? t("llm_council.health_ok", { defaultValue: "Health check passed." })
          : t("llm_council.health_warn", {
              defaultValue: "Health check completed with warnings.",
            }),
      );
    } catch (error) {
      const msg =
        (error as Error).message ||
        t("llm_council.health_failed", {
          defaultValue: "Health check failed",
        });
      setHealthError(msg);
      toast.error(msg);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-accent-muted p-2 text-accent">
            <Scale className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-semibold text-foreground">
              {t("llm_council.title", { defaultValue: "LLM IMMI Council" })}
            </h1>
            <p className="mt-1 text-sm text-muted-text">
              {t("llm_council.subtitle", {
                defaultValue:
                  "Direct multi-provider council with OpenAI, Gemini Pro, Anthropic Sonnet, and Gemini Flash as middle-ranker/composer.",
              })}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-text">
          {t("llm_council.models_heading", {
            defaultValue: "Model Council Setup",
          })}
        </h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Object.entries(models).map(([key, config]) => (
            <article
              key={key}
              className="rounded-md border border-border bg-surface/50 p-3"
            >
              <p className="text-xs uppercase tracking-wide text-muted-text">{key}</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {config.provider}
              </p>
              <p className="mt-1 break-all text-xs text-muted-text">{config.model}</p>
              <p className="mt-2 text-[11px] text-muted-text">
                {modelMetaLine(config) ||
                  t("llm_council.default_meta", {
                    defaultValue: "default",
                  })}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-text">
              {t("llm_council.health_heading", {
                defaultValue: "Provider Health Check",
              })}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 text-xs text-muted-text">
              <input
                type="checkbox"
                checked={healthLiveProbe}
                onChange={(e) => setHealthLiveProbe(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              {t("llm_council.health_live_probe_label", {
                defaultValue: "Enable live probe",
              })}
            </label>
            <button
              type="button"
              onClick={onHealthCheck}
              disabled={healthMutation.isPending}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-card disabled:cursor-not-allowed disabled:opacity-60"
            >
              {healthMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t("llm_council.health_running_btn", {
                    defaultValue: "Checking...",
                  })}
                </>
              ) : (
                <>
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {t("llm_council.health_btn", {
                    defaultValue: "Health Check",
                  })}
                </>
              )}
            </button>
          </div>
        </div>

        <p className="mt-2 text-xs text-muted-text">
          {healthLiveProbe
            ? t("llm_council.health_live_note", {
                defaultValue:
                  "Live probe will call provider APIs and verify response availability.",
              })
            : t("llm_council.health_config_note", {
                defaultValue:
                  "Config-only check validates API keys and model/prompt configuration without external calls.",
              })}
        </p>

        {healthError ? <div className="mt-3"><ApiErrorState message={healthError} /></div> : null}

        {healthResult ? (
          <div className="mt-3 space-y-3">
            {!healthResult.ok && healthResult.errors.length > 0 ? (
              <div className="rounded-md border border-amber-300/40 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-900/20 dark:text-amber-200">
                <p className="font-semibold">
                  {t("llm_council.health_issues_title", {
                    defaultValue: "Issues detected",
                  })}
                </p>
                <ul className="mt-1 space-y-1">
                  {healthResult.errors.map((entry) => (
                    <li key={entry}>• {entry}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {Object.entries(healthResult.providers).map(([key, provider]) => {
                const probe = healthResult.probe_results?.[
                  key as keyof NonNullable<LlmCouncilHealthResponse["probe_results"]>
                ];
                return (
                  <article key={key} className="rounded-md border border-border bg-surface/50 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-text">{key}</p>
                    <p className="mt-1 break-all text-xs text-foreground">{provider.model}</p>
                    <p className="mt-2 text-xs text-muted-text">
                      {provider.api_key_present
                        ? t("llm_council.health_api_key_yes", { defaultValue: "API key: present" })
                        : t("llm_council.health_api_key_no", { defaultValue: "API key: missing" })}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-text break-words">
                      {provider.system_prompt_preview ||
                        t("llm_council.default_meta", { defaultValue: "default" })}
                    </p>
                    {probe ? (
                      <p className="mt-2 text-xs text-muted-text">
                        {probe.success
                          ? t("llm_council.health_probe_ok", {
                              defaultValue: "Probe OK ({{latency}} ms)",
                              latency: probe.latency_ms,
                            })
                          : t("llm_council.health_probe_failed", {
                              defaultValue: "Probe failed ({{latency}} ms)",
                              latency: probe.latency_ms,
                            })}
                      </p>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              {t("llm_council.question_label", {
                defaultValue: "Legal Research Question",
              })}
            </label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={5}
              maxLength={8000}
              placeholder={t("llm_council.question_placeholder", {
                defaultValue:
                  "Example: Compare strongest review grounds for visa cancellation where procedural fairness may be breached.",
              })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                {t("llm_council.case_id_label", {
                  defaultValue: "Case ID (optional)",
                })}
              </label>
              <input
                type="text"
                value={caseId}
                onChange={(e) => setCaseId(e.target.value)}
                placeholder={t("llm_council.case_id_placeholder", {
                  defaultValue: "12-char case id",
                })}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                {t("llm_council.context_label", {
                  defaultValue: "Extra Context (optional)",
                })}
              </label>
              <input
                type="text"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder={t("llm_council.context_placeholder", {
                  defaultValue: "Focus area, assumptions, or constraints",
                })}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={councilMutation.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
            >
              {councilMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("llm_council.running_btn", { defaultValue: "Running Council..." })}
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  {t("llm_council.run_btn", { defaultValue: "Run LLM Council" })}
                </>
              )}
            </button>
            <p className="text-xs text-muted-text">
              {t("llm_council.runtime_note", {
                defaultValue:
                  "This runs 3 expert models plus 1 composition model, so response time may be longer.",
              })}
            </p>
          </div>
        </form>
        {submitError ? <ApiErrorState message={submitError} /> : null}
      </section>

      {result ? (
        <>
          {result.retrieved_cases && result.retrieved_cases.length > 0 ? (
            <section className="rounded-lg border border-border bg-card p-5">
              <h2 className="text-lg font-semibold text-foreground">
                {t("llm_council.retrieved_cases_title", {
                  defaultValue: "Retrieved Supporting Cases",
                })}
              </h2>
              <p className="mt-1 text-xs text-muted-text">
                {t("llm_council.retrieved_cases_note", {
                  defaultValue:
                    "These local IMMI-Case precedents were provided to the council as evidence context.",
                })}
              </p>
              <div className="mt-3 space-y-2">
                {result.retrieved_cases.map((entry) => (
                  <article
                    key={entry.case_id}
                    className="rounded-md border border-border bg-surface p-3"
                  >
                    <p className="text-sm font-semibold text-foreground">
                      {entry.citation || entry.case_id}
                    </p>
                    <p className="text-sm text-foreground">{entry.title || "—"}</p>
                    <p className="mt-1 text-xs text-muted-text">
                      {entry.court || "—"} • {entry.date || "—"} • {entry.outcome || "—"}
                    </p>
                    {entry.legal_concepts ? (
                      <p className="mt-1 text-xs text-muted-text">
                        {entry.legal_concepts}
                      </p>
                    ) : null}
                    {entry.url ? (
                      <a
                        href={entry.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs text-accent hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {t("llm_council.open_case_source", {
                          defaultValue: "Open source case",
                        })}
                      </a>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              <h2 className="text-lg font-semibold text-foreground">
                {t("llm_council.moderator_title", {
                  defaultValue: "Gemini Flash Middle-Ranking & Composition",
                })}
              </h2>
            </div>

            {result.moderator.success ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-md border border-border bg-surface p-3">
                  <p className="mb-1 text-xs uppercase tracking-wide text-muted-text">
                    {t("llm_council.composed_answer_label", {
                      defaultValue: "Composed Answer",
                    })}
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-foreground">
                    {result.moderator.composed_answer}
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-md border border-border bg-surface p-3">
                    <div className="mb-1 flex items-center gap-1 text-xs uppercase tracking-wide text-muted-text">
                      {t("llm_council.outcome_likelihood_label", {
                        defaultValue: "Outcome Likelihood",
                      })}
                      <span
                        title={t("llm_council.outcome_likelihood_tooltip", {
                          defaultValue:
                            "This percentage is a model-generated estimate based on available facts and cited precedents, not a judicial prediction or legal advice.",
                        })}
                        className="inline-flex items-center"
                      >
                        <Info className="h-3.5 w-3.5 text-muted-text" />
                      </span>
                    </div>
                    <p
                      className={`text-base font-semibold ${likelihoodTone(
                        result.moderator.outcome_likelihood_label,
                      )}`}
                    >
                      {result.moderator.outcome_likelihood_percent ?? 0}%
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-wide text-muted-text">
                      {(
                        result.moderator.outcome_likelihood_label || "unknown"
                      ).toUpperCase()}
                    </p>
                    <p className="mt-2 text-xs text-muted-text">
                      {result.moderator.outcome_likelihood_reason || "—"}
                    </p>
                  </div>
                  <div className="rounded-md border border-border bg-surface p-3">
                    <p className="mb-1 text-xs uppercase tracking-wide text-muted-text">
                      {t("llm_council.consensus_label", { defaultValue: "Consensus" })}
                    </p>
                    <p className="text-sm text-foreground">
                      {result.moderator.consensus || "—"}
                    </p>
                  </div>
                  <div className="rounded-md border border-border bg-surface p-3">
                    <p className="mb-1 text-xs uppercase tracking-wide text-muted-text">
                      {t("llm_council.disagreements_label", {
                        defaultValue: "Disagreements",
                      })}
                    </p>
                    <p className="text-sm text-foreground">
                      {result.moderator.disagreements || "—"}
                    </p>
                  </div>
                </div>

                <div className="rounded-md border border-border bg-surface p-3">
                  <p className="mb-1 text-xs uppercase tracking-wide text-muted-text">
                    {t("llm_council.law_sections_label", {
                      defaultValue: "Relevant Law Sections",
                    })}
                  </p>
                  {result.moderator.law_sections &&
                  result.moderator.law_sections.length > 0 ? (
                    <div className="space-y-1">
                      {result.moderator.law_sections.map((section) => (
                        <a
                          key={section}
                          href={lawSectionSearchHref(section)}
                          className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
                          title={t("llm_council.law_section_open_search", {
                            defaultValue: "Open legislation search for this section",
                          })}
                        >
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          {section}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-text">—</p>
                  )}
                </div>

                <div className="rounded-md border border-border bg-surface p-3">
                  <p className="mb-2 text-xs uppercase tracking-wide text-muted-text">
                    {t("llm_council.ranking_label", {
                      defaultValue: "Council Ranking",
                    })}
                  </p>
                  <div className="space-y-2">
                    {result.moderator.ranking.map((entry) => (
                      <div
                        key={`${entry.provider_key}-${entry.rank}`}
                        className="rounded border border-border bg-card p-2 text-sm"
                      >
                        <p className="font-medium text-foreground">
                          #{entry.rank} {entry.provider_label} ({entry.score})
                        </p>
                        <p className="text-xs text-muted-text">
                          {entry.reason ||
                            t("llm_council.no_rationale", {
                              defaultValue: "No rationale provided.",
                            })}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <ApiErrorState
                title={t("llm_council.moderator_failed_title", {
                  defaultValue: "Moderator synthesis unavailable",
                })}
                message={
                  result.moderator.error ||
                  t("llm_council.unknown_moderator_error", {
                    defaultValue: "Unknown moderator error",
                  })
                }
              />
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              {t("llm_council.expert_title", {
                defaultValue: "Expert Model Opinions",
              })}
            </h2>

            {sortedOpinions.map((opinion) => (
              <article
                key={opinion.provider_key}
                className="rounded-lg border border-border bg-card p-5"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-accent" />
                    <p className="font-semibold text-foreground">
                      {opinion.provider_label}
                    </p>
                    <span className="text-xs text-muted-text">{opinion.model}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    {opinion.success ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-emerald-700 dark:text-emerald-400">
                          {t("llm_council.status_ok", {
                            defaultValue: "OK ({{latency}} ms)",
                            latency: opinion.latency_ms,
                          })}
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                        <span className="text-amber-700 dark:text-amber-400">
                          {t("llm_council.status_failed", {
                            defaultValue: "Failed ({{latency}} ms)",
                            latency: opinion.latency_ms,
                          })}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {opinion.success ? (
                  <>
                    <p className="whitespace-pre-wrap text-sm text-foreground">
                      {opinion.answer}
                    </p>
                    {opinion.sources.length > 0 ? (
                      <div className="mt-3">
                        <p className="mb-1 text-xs uppercase tracking-wide text-muted-text">
                          {t("llm_council.sources_label", {
                            defaultValue: "Sources",
                          })}
                        </p>
                        <div className="space-y-1">
                          {opinion.sources.map((source) => (
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
                      opinion.error ||
                      t("llm_council.unknown_model_error", {
                        defaultValue: "Unknown model error",
                      })
                    }
                  />
                )}
              </article>
            ))}
          </section>
        </>
      ) : (
        <section className="rounded-lg border border-dashed border-border bg-card p-6 text-sm text-muted-text">
          <div className="flex items-center gap-2">
            {councilMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin text-accent" />
            ) : (
              <Sparkles className="h-4 w-4 text-accent" />
            )}
            <p>
              {councilMutation.isPending
                ? t("llm_council.running_hint", {
                    defaultValue:
                      "Council is running. Waiting for all expert opinions and composition.",
                  })
                : t("llm_council.idle_hint", {
                    defaultValue:
                      "Submit a question to generate a 3-model council analysis and Gemini Flash synthesis.",
                  })}
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
