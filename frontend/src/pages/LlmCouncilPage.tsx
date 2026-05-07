/**
 * frontend/src/pages/LlmCouncilPage.tsx
 *
 * Thread-based LLM Council UI.
 *
 * Route: /llm-council                          → new session form
 * Route: /llm-council/sessions/:sessionId      → thread view
 *
 * Behaviour:
 *  - No sessionId  → NewSessionForm (first message + Send)
 *  - sessionId     → ThreadView (TurnCard list + follow-up input)
 *  - Send (new)    → useCreateSession → navigate to /llm-council/sessions/:id
 *  - Send (existing) → useAddTurn; on success input clears
 *  - total_turns >= 15 → Send button disabled
 *  - Mutation errors → inline ApiErrorState banner
 */

import { useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bot, Loader2, Scale, Send, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { ApiErrorState } from "@/components/shared/ApiErrorState";
import { PageLoader } from "@/components/shared/PageLoader";
import { TurnCard } from "@/components/llm-council/TurnCard";
import {
  useLlmCouncilSession,
  useCreateSession,
  useAddTurn,
} from "@/hooks/use-llm-council-sessions";

const MAX_TURNS = 15;

// ---------------------------------------------------------------------------
// CouncilRunningIndicator — Sprint 3 P3-4
// Three provider avatars + a moderator avatar with staggered pulse animation,
// conveying the panel composition instead of a single dead spinner.
// ---------------------------------------------------------------------------

const RUNNING_PROVIDERS = [
  { key: "openai", label: "OpenAI" },
  { key: "gemini", label: "Gemini" },
  { key: "anthropic", label: "Claude" },
] as const;

function CouncilRunningIndicator() {
  const { t } = useTranslation();
  return (
    <div
      className="rounded-xl border border-border/80 bg-card p-4 shadow-sm"
      data-testid="council-running-indicator"
      role="status"
      aria-live="polite"
    >
      <div className="mb-3 flex items-center gap-2 text-sm text-muted-text">
        <div className="animate-spin">
          <Loader2 className="h-4 w-4 text-accent" />
        </div>
        <span>
          {t("llm_council.running_hint", {
            defaultValue:
              "Council is running. Waiting for all expert opinions and composition.",
          })}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {RUNNING_PROVIDERS.map((p, idx) => (
          <div
            key={p.key}
            className="flex items-center gap-2 rounded-full border border-border bg-surface/50 px-3 py-1.5"
            data-testid={`running-avatar-${p.key}`}
          >
            <div
              className="rounded-full bg-accent/15 p-1 text-accent"
              style={{
                animation: "pulse 1.4s ease-in-out infinite",
                animationDelay: `${idx * 0.2}s`,
              }}
            >
              <Bot className="h-3.5 w-3.5" />
            </div>
            <span className="text-xs font-medium text-foreground">
              {p.label}
            </span>
          </div>
        ))}
        <span className="text-xs text-muted-text">→</span>
        <div
          className="flex items-center gap-2 rounded-full border border-amber-300/50 bg-amber-50/30 px-3 py-1.5 dark:border-amber-700/50 dark:bg-amber-900/10"
          data-testid="running-avatar-moderator"
        >
          <div
            className="rounded-full bg-amber-400/20 p-1 text-amber-700 dark:text-amber-300"
            style={{
              animation: "pulse 1.4s ease-in-out infinite",
              animationDelay: "0.6s",
            }}
          >
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs font-medium text-foreground">
            {t("llm_council.running_moderator_label", {
              defaultValue: "Moderator",
            })}
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NewSessionForm — shown when no sessionId in URL
// ---------------------------------------------------------------------------

function NewSessionForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [caseId, setCaseId] = useState("");
  const [submitError, setSubmitError] = useState("");
  const createSession = useCreateSession();

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const msg = message.trim();
    if (!msg) return;
    setSubmitError("");
    try {
      const result = await createSession.mutateAsync({
        message: msg,
        case_id: caseId.trim() || undefined,
      });
      navigate(`/llm-council/sessions/${result.session_id}`);
    } catch (err) {
      setSubmitError(
        (err as Error).message ||
          t("llm_council.request_failed", {
            defaultValue: "LLM council request failed",
          }),
      );
    }
  }

  return (
    <section className="rounded-xl border border-border/80 bg-card p-6 shadow-sm">
      <form onSubmit={handleSend} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">
            {t("llm_council.question_label", {
              defaultValue: "Legal Research Question",
            })}
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            maxLength={8000}
            placeholder={t("llm_council.question_placeholder", {
              defaultValue:
                "Example: Compare strongest review grounds for visa cancellation where procedural fairness may be breached.",
            })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">
            {t("llm_council.case_id_label", {
              defaultValue: "Case ID (optional, if existing record)",
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

        <button
          type="submit"
          disabled={createSession.isPending || !message.trim()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
        >
          {createSession.isPending ? (
            <>
              <div className="animate-spin"><Loader2 className="h-4 w-4" /></div>
              {t("llm_council.running_btn", {
                defaultValue: "Running Council...",
              })}
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              {t("llm_council.send_btn", { defaultValue: "Send" })}
            </>
          )}
        </button>

        {submitError ? <ApiErrorState message={submitError} /> : null}
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------------
// ThreadView — shown when sessionId present in URL
// ---------------------------------------------------------------------------

interface ThreadViewProps {
  sessionId: string;
}

function ThreadView({ sessionId }: ThreadViewProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const [submitError, setSubmitError] = useState("");

  const { data, isLoading, isError, error } = useLlmCouncilSession(sessionId);
  const addTurn = useAddTurn(sessionId);

  const session = data?.session;
  const turns = data?.turns ?? [];
  const totalTurns = session?.total_turns ?? turns.length;
  const atLimit = totalTurns >= MAX_TURNS;

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const msg = input.trim();
    if (!msg || atLimit) return;
    setSubmitError("");
    try {
      await addTurn.mutateAsync({ message: msg });
      setInput("");
    } catch (err) {
      setSubmitError(
        (err as Error).message ||
          t("llm_council.request_failed", {
            defaultValue: "LLM council request failed",
          }),
      );
    }
  }

  if (isLoading) {
    return <PageLoader />;
  }

  if (isError) {
    return (
      <ApiErrorState
        message={
          (error as Error)?.message ||
          t("llm_council.session_load_failed", {
            defaultValue: "Failed to load session",
          })
        }
      />
    );
  }

  if (!data) {
    return (
      <ApiErrorState
        message={t("llm_council.session_not_found", {
          defaultValue: "Session not found",
        })}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Turn thread */}
      <div className="space-y-8">
        {turns.map((turn, idx) => (
          <TurnCard key={turn.turn_id} turn={turn} turnNumber={idx + 1} />
        ))}
      </div>

      {/* Pending indicator while addTurn is in flight — Sprint 3 P3-4
          Three provider avatars with pulse animation conveying parallel
          deliberation, not a single dead spinner. */}
      {addTurn.isPending ? <CouncilRunningIndicator /> : null}

      {/* Follow-up input */}
      <section className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
        <form onSubmit={handleSend} className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-text">
              {t("llm_council.follow_up_input_label", {
                defaultValue: "Follow-up question",
              })}
            </p>
            <span
              data-testid="turn-count-badge"
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                atLimit
                  ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
                  : "bg-surface text-muted-text"
              }`}
            >
              {t("llm_council.turn_count_label", { defaultValue: "Turn" })}{" "}
              {totalTurns}/{MAX_TURNS}
            </span>
          </div>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={3}
            maxLength={8000}
            disabled={atLimit || addTurn.isPending}
            placeholder={
              atLimit
                ? t("llm_council.turn_limit_placeholder", {
                    defaultValue: "Turn limit reached (15/15)",
                  })
                : t("llm_council.follow_up_placeholder", {
                    defaultValue: "Ask a follow-up question…",
                  })
            }
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
          />

          <button
            type="submit"
            disabled={atLimit || addTurn.isPending || !input.trim()}
            className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
          >
            {addTurn.isPending ? (
              <>
                <div className="animate-spin"><Loader2 className="h-4 w-4" /></div>
                {t("llm_council.running_btn", {
                  defaultValue: "Running Council...",
                })}
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                {t("llm_council.send_btn", { defaultValue: "Send" })}
              </>
            )}
          </button>

          {submitError ? <ApiErrorState message={submitError} /> : null}

          {atLimit ? (
            <p className="text-xs text-rose-600 dark:text-rose-400">
              {t("llm_council.turn_limit_reached", {
                defaultValue:
                  "You have reached the maximum of 15 turns for this session.",
              })}
            </p>
          ) : null}
        </form>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LlmCouncilPage (exported)
// ---------------------------------------------------------------------------

export function LlmCouncilPage() {
  const { t } = useTranslation();
  const { sessionId } = useParams<{ sessionId?: string }>();

  // Guard: /llm-council/sessions/new is a dead-end — redirect to new-session form
  if (sessionId === "new") {
    return <Navigate to="/llm-council" replace />;
  }

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-border/80 bg-card p-6 shadow-sm">
        <PageHeader
          title={t("llm_council.title", { defaultValue: "LLM IMMI Council" })}
          description={t("llm_council.subtitle", {
            defaultValue:
              "Direct multi-provider council with OpenAI, Gemini Pro, Anthropic Sonnet, then Gemini Flash for ranking, critique, voting, and synthesis.",
          })}
          icon={<Scale className="h-5 w-5" />}
        />
      </section>

      {sessionId ? (
        <ThreadView sessionId={sessionId} />
      ) : (
        <>
          <section className="rounded-xl border border-dashed border-border bg-card p-5 text-sm text-muted-text shadow-sm">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              <p>
                {t("llm_council.idle_hint", {
                  defaultValue:
                    "Submit a question to start a new council session. Each session supports up to 15 turns.",
                })}
              </p>
            </div>
          </section>
          <NewSessionForm />
        </>
      )}
    </div>
  );
}
