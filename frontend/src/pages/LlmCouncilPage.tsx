/**
 * frontend/src/pages/LlmCouncilPage.tsx
 *
 * Thread-based LLM Council UI — desktop-rebuilt 2026-05-10.
 *
 * Layout philosophy (Sprint 3 polish):
 *  - Mobile (<md): single column, compact form, full-width controls.
 *  - Desktop (md+): 12-column grid — textarea + send button (col-span-8)
 *    on the left, sidebar (col-span-4) with sample prompts gallery,
 *    panel composition explainer, and tips on the right.
 *
 * Loading state ("CouncilDeliberationViz"):
 *  - Live elapsed timer (mm:ss) so user sees progress against the 5min cap
 *  - Three expert pills with staggered thinking-dot animation
 *  - SVG flow-bars converging from experts to moderator with animated
 *    stroke-dash flow particles
 *  - Rotating tip text every 4s (4 hints cycle)
 *  - Subtle gradient shimmer on the panel border
 *
 * Routes:
 *  /llm-council                          -> new session form
 *  /llm-council/sessions/:sessionId      -> thread view
 */

import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Bot,
  Eraser,
  Lightbulb,
  Loader2,
  Scale,
  Send,
  Sparkles,
  Users,
} from "lucide-react";
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
const MAX_MESSAGE_CHARS = 8000;

// ---------------------------------------------------------------------------
// Inline keyframes for loading animation. Defined once at module scope as a
// string and injected via a single <style> tag inside the indicator. Scoped
// names (councilThinkingDot etc.) avoid collision with global tokens.css.
// ---------------------------------------------------------------------------

const COUNCIL_KEYFRAMES = `
@keyframes councilThinkingDot {
  0%, 80%, 100% { opacity: 0.25; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1.1); }
}
@keyframes councilFlow {
  0% { stroke-dashoffset: 0; }
  100% { stroke-dashoffset: -24; }
}
@keyframes councilShimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes councilFloatIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

// ---------------------------------------------------------------------------
// Sample prompts gallery — clickable starter questions.
// ---------------------------------------------------------------------------

const SAMPLE_PROMPTS = [
  {
    title: "Visa cancellation — procedural fairness",
    body:
      "What are the strongest jurisdictional error grounds for AAT review " +
      "of a visa cancellation where the decision-maker may have breached " +
      "s 359A by failing to put adverse credibility findings to the applicant? " +
      "Cite specific Migration Act sections and recent AAT/Federal Court precedents.",
  },
  {
    title: "Protection visa — country information",
    body:
      "A Protection visa (subclass 866) was refused based on a 2018 DFAT " +
      "report that contradicts more recent UNHCR guidance. The country " +
      "information was not put to the applicant. Identify s 424A " +
      "jurisdictional error grounds and the strongest counter-arguments " +
      "the Department would raise (SZBYR limitation).",
  },
  {
    title: "Partner visa — relationship credibility",
    body:
      "Apply to the AAT for review of a Partner visa (subclass 820/801) " +
      "refusal where credibility findings about the relationship under " +
      "reg 1.15A are central. What evidence and arguments best counter " +
      "adverse credibility conclusions?",
  },
  {
    title: "Section 5J(3) — past torture credibility",
    body:
      "How does s 5J(3) Migration Act 1958 apply to credibility assessment " +
      "where the applicant alleges past torture but provides inconsistent " +
      "dates? What is the mandatory analytical framework, and what is the " +
      "consequence of failing to apply it?",
  },
] as const;

// ---------------------------------------------------------------------------
// CouncilDeliberationViz — Sprint 3 polish loading state
// ---------------------------------------------------------------------------

const RUNNING_PROVIDERS = [
  { key: "openai", label: "OpenAI", color: "#10a37f" },
  { key: "gemini", label: "Gemini Pro", color: "#4285f4" },
  { key: "anthropic", label: "Claude Sonnet", color: "#cc785c" },
] as const;

const TIPS = [
  "Heavy legal prompts can take 90s-3min. Three experts deliberate in parallel, then the moderator synthesises.",
  "Cite specific section numbers (e.g. s 5J(3), s 424A) for sharper expert analysis.",
  "The moderator extracts statute citations into a cross-reference table — look for shared overlap %.",
  "Each session supports up to 15 follow-up turns. Use them to drill into specific grounds.",
];

function CouncilDeliberationViz() {
  const { t } = useTranslation();
  const [elapsedSec, setElapsedSec] = useState(0);
  const [tipIdx, setTipIdx] = useState(0);

  useEffect(() => {
    const tickId = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    const tipId = setInterval(() => setTipIdx((i) => (i + 1) % TIPS.length), 4000);
    return () => {
      clearInterval(tickId);
      clearInterval(tipId);
    };
  }, []);

  const mm = String(Math.floor(elapsedSec / 60)).padStart(2, "0");
  const ss = String(elapsedSec % 60).padStart(2, "0");

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-border/80 bg-card p-5 shadow-sm"
      data-testid="council-running-indicator"
      role="status"
      aria-live="polite"
      aria-label="Council deliberating"
    >
      <style dangerouslySetInnerHTML={{ __html: COUNCIL_KEYFRAMES }} />

      {/* Top-edge shimmer to suggest live activity */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, var(--color-accent, #d4a017) 50%, transparent 100%)",
          backgroundSize: "200% 100%",
          animation: "councilShimmer 2s linear infinite",
          opacity: 0.6,
        }}
      />

      {/* Header row — status + timer */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="animate-spin">
            <Loader2 className="h-4 w-4 text-accent" />
          </div>
          <span className="text-sm font-semibold text-foreground">
            {t("llm_council.deliberating", {
              defaultValue: "Council deliberating",
            })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-muted-text">
            {t("llm_council.elapsed", { defaultValue: "Elapsed" })}
          </span>
          <span
            className="rounded-md bg-surface px-2.5 py-1 font-mono text-sm tabular-nums text-foreground"
            data-testid="council-elapsed-timer"
          >
            {mm}:{ss}
          </span>
        </div>
      </div>

      {/* Visualization — three experts pipeline -> moderator */}
      <div className="space-y-3">
        {/* Expert row */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {RUNNING_PROVIDERS.map((p, idx) => (
            <ExpertPill
              key={p.key}
              label={p.label}
              color={p.color}
              delayMs={idx * 150}
              testId={`running-avatar-${p.key}`}
            />
          ))}
        </div>

        {/* SVG flow rails — three lines converging to moderator */}
        <svg
          viewBox="0 0 600 60"
          className="h-12 w-full"
          aria-hidden
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="flowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="var(--color-accent, #d4a017)" stopOpacity="0.1" />
              <stop offset="100%" stopColor="var(--color-accent, #d4a017)" stopOpacity="0.7" />
            </linearGradient>
          </defs>
          {/* Three converging paths */}
          {[100, 300, 500].map((sx, i) => (
            <path
              key={i}
              d={`M ${sx} 0 Q ${sx} 30, 300 60`}
              fill="none"
              stroke="url(#flowGrad)"
              strokeWidth="1.5"
              strokeDasharray="4 8"
              style={{
                animation: `councilFlow ${1.4 + i * 0.2}s linear infinite`,
              }}
            />
          ))}
        </svg>

        {/* Moderator row */}
        <div className="flex justify-center">
          <ModeratorPill />
        </div>
      </div>

      {/* Rotating tip */}
      <div
        className="mt-5 flex items-start gap-2 rounded-md border border-dashed border-border bg-surface/40 p-3"
        key={tipIdx}
        style={{ animation: "councilFloatIn 0.4s ease-out" }}
      >
        <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
        <p className="text-xs leading-relaxed text-muted-text">
          <span className="font-semibold uppercase tracking-wide text-foreground">
            {t("llm_council.tip_label", { defaultValue: "Tip" })}:
          </span>{" "}
          {TIPS[tipIdx]}
        </p>
      </div>
    </div>
  );
}

interface ExpertPillProps {
  label: string;
  color: string;
  delayMs: number;
  testId?: string;
}

function ExpertPill({ label, color, delayMs, testId }: ExpertPillProps) {
  return (
    <div
      data-testid={testId}
      className="flex flex-col items-center gap-1.5 rounded-lg border border-border/80 bg-surface/40 px-2 py-3"
    >
      <div
        className="grid h-8 w-8 place-items-center rounded-full"
        style={{ backgroundColor: `${color}1A`, color }}
      >
        <Bot className="h-4 w-4" />
      </div>
      <span className="line-clamp-1 text-[11px] font-medium text-foreground sm:text-xs">
        {label}
      </span>
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1 w-1 rounded-full"
            style={{
              backgroundColor: color,
              animation: "councilThinkingDot 1.2s ease-in-out infinite",
              animationDelay: `${delayMs + i * 150}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ModeratorPill() {
  const { t } = useTranslation();
  return (
    <div
      data-testid="running-avatar-moderator"
      className="flex items-center gap-2 rounded-full border border-amber-300/60 bg-amber-50/40 px-4 py-2 dark:border-amber-700/60 dark:bg-amber-900/15"
    >
      <div
        className="grid h-7 w-7 place-items-center rounded-full bg-amber-400/25 text-amber-700 dark:text-amber-300"
        style={{
          animation: "councilThinkingDot 1.6s ease-in-out infinite",
        }}
      >
        <Sparkles className="h-3.5 w-3.5" />
      </div>
      <div className="flex flex-col">
        <span className="text-xs font-semibold text-foreground">
          {t("llm_council.running_moderator_label", {
            defaultValue: "Moderator",
          })}
        </span>
        <span className="text-[10px] uppercase tracking-wide text-muted-text">
          {t("llm_council.awaiting_label", { defaultValue: "Awaiting panel" })}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PromptSidebar — desktop sidebar with samples + panel composition + tips
// ---------------------------------------------------------------------------

interface PromptSidebarProps {
  onSelectPrompt: (body: string) => void;
}

function PromptSidebar({ onSelectPrompt }: PromptSidebarProps) {
  const { t } = useTranslation();
  return (
    <aside className="space-y-4">
      {/* Sample prompts */}
      <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
            {t("llm_council.sidebar_sample_prompts", {
              defaultValue: "Sample Prompts",
            })}
          </h3>
        </div>
        <ul className="space-y-2">
          {SAMPLE_PROMPTS.map((p) => (
            <li key={p.title}>
              <button
                type="button"
                onClick={() => onSelectPrompt(p.body)}
                className="group block w-full rounded-md border border-transparent px-3 py-2 text-left transition-colors hover:border-accent/40 hover:bg-surface/50"
              >
                <p className="line-clamp-1 text-xs font-semibold text-foreground group-hover:text-accent">
                  {p.title}
                </p>
                <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-text">
                  {p.body}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Panel composition */}
      <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Users className="h-3.5 w-3.5 text-accent" />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
            {t("llm_council.sidebar_panel_title", {
              defaultValue: "Panel Composition",
            })}
          </h3>
        </div>
        <ul className="space-y-2 text-xs text-muted-text">
          {RUNNING_PROVIDERS.map((p) => (
            <li key={p.key} className="flex items-center gap-2">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: p.color }}
              />
              <span className="text-foreground">{p.label}</span>
              <span className="text-muted-text">— expert</span>
            </li>
          ))}
          <li className="flex items-center gap-2 border-t border-border pt-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
            <span className="text-foreground">Gemini Flash</span>
            <span className="text-muted-text">— moderator</span>
          </li>
        </ul>
      </div>

      {/* Quick tips */}
      <div className="rounded-xl border border-dashed border-border bg-surface/40 p-4">
        <div className="mb-2 flex items-center gap-2">
          <Lightbulb className="h-3.5 w-3.5 text-accent" />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
            {t("llm_council.sidebar_tips_title", {
              defaultValue: "Quick Tips",
            })}
          </h3>
        </div>
        <ul className="space-y-1.5 text-[11px] leading-relaxed text-muted-text">
          <li>• Cite section numbers and case names for sharper output.</li>
          <li>• Heavy prompts can take 2-3 minutes — that&apos;s normal.</li>
          <li>• Up to 15 follow-up turns per session.</li>
          <li>• Cmd/Ctrl+Enter submits.</li>
        </ul>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// MessageInput — shared composer for new session + follow-up
// ---------------------------------------------------------------------------

interface MessageInputProps {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  isPending: boolean;
  disabled?: boolean;
  placeholder: string;
  rows?: number;
  maxChars?: number;
  /** When true, autofocus on mount (used by ThreadView follow-up). */
  autoFocus?: boolean;
}

function MessageInput({
  value,
  onChange,
  onSubmit,
  isPending,
  disabled = false,
  placeholder,
  rows = 5,
  maxChars = MAX_MESSAGE_CHARS,
  autoFocus = false,
}: MessageInputProps) {
  const { t } = useTranslation();
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (autoFocus && taRef.current) {
      taRef.current.focus();
    }
  }, [autoFocus]);

  // Cmd/Ctrl+Enter submits
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (!disabled && !isPending && value.trim()) {
        onSubmit();
      }
    }
  }

  const charCount = value.length;
  const overLimit = charCount > maxChars * 0.9;

  return (
    <div className="space-y-2">
      <div className="relative">
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={rows}
          maxLength={maxChars}
          disabled={disabled || isPending}
          placeholder={placeholder}
          className="w-full resize-y rounded-md border border-border bg-background px-3 py-2.5 text-sm leading-relaxed text-foreground outline-none transition-colors focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
        />
        {value.length > 0 && !isPending ? (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear input"
            className="absolute right-2 top-2 rounded-md p-1 text-muted-text opacity-60 transition-opacity hover:opacity-100"
          >
            <Eraser className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] text-muted-text">
          <kbd className="rounded border border-border bg-surface px-1 font-mono text-[10px]">
            Cmd
          </kbd>
          <span className="mx-1">+</span>
          <kbd className="rounded border border-border bg-surface px-1 font-mono text-[10px]">
            Enter
          </kbd>
          <span className="ml-2">
            {t("llm_council.kbd_hint", { defaultValue: "to send" })}
          </span>
        </span>
        <span
          className={`text-[11px] tabular-nums ${
            overLimit ? "text-amber-600 dark:text-amber-400" : "text-muted-text"
          }`}
        >
          {charCount} / {maxChars}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NewSessionForm — desktop two-column / mobile single-column
// ---------------------------------------------------------------------------

function NewSessionForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [caseId, setCaseId] = useState("");
  const [submitError, setSubmitError] = useState("");
  const createSession = useCreateSession();

  async function handleSend() {
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
    <div className="grid gap-6 md:grid-cols-12">
      {/* Form column — col-span-8 on md+, col-span-12 on mobile */}
      <section className="md:col-span-8">
        <div className="rounded-xl border border-border/80 bg-card p-6 shadow-sm">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="space-y-5"
          >
            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground">
                {t("llm_council.question_label", {
                  defaultValue: "Legal Research Question",
                })}
              </label>
              <MessageInput
                value={message}
                onChange={setMessage}
                onSubmit={handleSend}
                isPending={createSession.isPending}
                rows={6}
                placeholder={t("llm_council.question_placeholder", {
                  defaultValue:
                    "Example: Compare strongest review grounds for visa cancellation where procedural fairness may be breached. Cite section numbers and case names for sharper output.",
                })}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-text">
                  {t("llm_council.case_id_label", {
                    defaultValue: "Case ID (optional)",
                  })}
                </label>
                <input
                  type="text"
                  value={caseId}
                  onChange={(e) => setCaseId(e.target.value)}
                  placeholder="12-char hex id"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs text-foreground outline-none transition-colors focus:border-accent"
                />
                <p className="mt-1 text-[11px] text-muted-text">
                  {t("llm_council.case_id_help", {
                    defaultValue:
                      "If provided, the case context is auto-included in the prompt.",
                  })}
                </p>
              </div>

              <div className="flex items-end justify-end">
                <button
                  type="submit"
                  disabled={createSession.isPending || !message.trim()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {createSession.isPending ? (
                    <>
                      <div className="animate-spin">
                        <Loader2 className="h-4 w-4" />
                      </div>
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
              </div>
            </div>

            {submitError ? <ApiErrorState message={submitError} /> : null}

            {/* Inline running indicator while creating */}
            {createSession.isPending ? <CouncilDeliberationViz /> : null}
          </form>
        </div>
      </section>

      {/* Sidebar — col-span-4 on md+ */}
      <div className="md:col-span-4">
        <PromptSidebar onSelectPrompt={(body) => setMessage(body)} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ThreadView — session-thread display + follow-up composer
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

  async function handleSend() {
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

      {/* Pending indicator while addTurn is in flight */}
      {addTurn.isPending ? <CouncilDeliberationViz /> : null}

      {/* Follow-up input */}
      <section className="rounded-xl border border-border/80 bg-card p-5 shadow-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
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

          <MessageInput
            value={input}
            onChange={setInput}
            onSubmit={handleSend}
            isPending={addTurn.isPending}
            disabled={atLimit}
            rows={3}
            placeholder={
              atLimit
                ? t("llm_council.turn_limit_placeholder", {
                    defaultValue: "Turn limit reached (15/15)",
                  })
                : t("llm_council.follow_up_placeholder", {
                    defaultValue:
                      "Ask a follow-up question — drill into a specific ground, request more case citations, or test counter-arguments...",
                  })
            }
          />

          <div className="flex flex-wrap items-center justify-end gap-3">
            {atLimit ? (
              <p className="text-xs text-rose-600 dark:text-rose-400">
                {t("llm_council.turn_limit_reached", {
                  defaultValue:
                    "You have reached the maximum of 15 turns for this session.",
                })}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={atLimit || addTurn.isPending || !input.trim()}
              className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
            >
              {addTurn.isPending ? (
                <>
                  <div className="animate-spin">
                    <Loader2 className="h-4 w-4" />
                  </div>
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
          </div>

          {submitError ? <ApiErrorState message={submitError} /> : null}
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
              "Three legal-research experts deliberate in parallel — OpenAI, Gemini Pro, Anthropic Sonnet — and Gemini Flash composes the synthesis with statute cross-reference, ranked critique, and a mock judgment outline.",
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
