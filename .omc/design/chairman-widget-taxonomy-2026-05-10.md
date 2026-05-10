# Chairman Widget Taxonomy
**Date**: 2026-05-10
**Status**: Design contract · awaiting operator approval before Phase 2 frontend ship
**Driving brief** (user, verbatim):
> "Design a Beautiful cards and try to visualize the Jason from the chairman.
> The Jason is basically the indication for you to apply the card. The Jason
> is not supposed to be displayed directly to the user. It is supposed to
> indicate different cards, like a widget, for example. You have to create a
> set of widgets for different scenarios. ... Make it eye-catching and ...
> animate it."

---

## Design Principle

**JSON drives presentation; user never sees JSON.**
As the moderator stream parses progressively, each landed field MOUNTS its
widget with a stagger animation. The final layout is a "verdict dashboard",
not a JSON dump.

Widgets follow the **Legal Codex** aesthetic locked in `CLAUDE.md`:
warm cream `#f5f4f1`, deep navy `#1b2838`, amber-gold `#d4a017`, Crimson Text
serif headings, Recharts dashboard language for any data viz.

Animation library: **framer-motion** (already in deps via Recharts ecosystem).
Each widget on first mount: `initial={{opacity: 0, y: 12}} animate={{opacity: 1, y: 0}} transition={{duration: 0.45, ease: "easeOut"}}`.
Stagger between widgets: 80ms.

---

## Widget Inventory

### W1 — Verdict Hero Card
- **Driving fields**: `composed_answer` (primary text) + `mock_judgment` (sidebar quote, italicized)
- **Visual**: Large card spanning full row, gavel icon top-left, courtroom-style serif heading "The Council's Judgment". Body in `<Markdown>` w/ generous line-height. Mock judgment in pull-quote style on the right (md+) or below (mobile).
- **Mount trigger**: when `composed_answer` first lands (first ~30% of stream).
- **Animation**: scale-in from 0.96, draw-line under heading.

### W2 — Probability Gauge (Outcome Likelihood)
- **Driving fields**: `outcome_likelihood_percent` (number) + `outcome_likelihood_label` ("HIGH"/"MEDIUM"/"LOW") + `outcome_likelihood_reason`
- **Visual**: Animated radial-arc gauge (semicircle, 0-100%, colored by label — green ≥70, amber 40-69, red <40). Label + percent number animate via `framer-motion` count-up. Reason below in muted text.
- **Mount trigger**: when `outcome_likelihood_percent` lands.
- **Animation**: arc fills from 0 to value over 1.2s ease-in-out; number counts up in sync.

### W3 — Consensus / Disagreement Split
- **Driving fields**: `consensus` (string) + `disagreements` (string) + `agreement_points` (string[]) + `conflict_points` (string[])
- **Visual**: Two-column card. Left: green-tinted "Where the Council agrees" with bullet list of `agreement_points`. Right: amber-tinted "Where they disagree" with `conflict_points`. Top of each column: short summary text (`consensus` / `disagreements`).
- **Mount trigger**: when `consensus` OR `disagreements` lands. Fields fill in progressively.
- **Animation**: each bullet point fades in left-to-right as the array grows.

### W4 — Statute Reference Grid
- **Driving fields**: `law_sections` (string[]) + `provider_law_sections` (record) + `shared_law_sections` (string[]) + `shared_law_sections_confidence_percent` + `shared_law_sections_confidence_reason`
- **Visual**: Pill grid of all unique statutes. Shared (cited by 2+ providers) get gold border + crown icon + small confidence percentage badge. Provider-specific get colored dot matching the provider's brand color (OpenAI green, Gemini blue, Anthropic orange).
- **Mount trigger**: when `law_sections` array starts populating.
- **Animation**: each pill stagger-mounts (40ms apart). Shared pills shimmer once on entrance.

### W5 — Vote Summary Donut
- **Driving fields**: `vote_summary` (record/object — provider → vote counts or weights)
- **Visual**: Recharts donut chart, segments colored by provider, center showing total or majority vote. Legend on the right.
- **Mount trigger**: when `vote_summary` lands.
- **Animation**: segments draw from 0° to their angle clockwise (Recharts `animationBegin`).

### W6 — Provider Ranking Podium
- **Driving fields**: `ranking` (array — provider rank order with rationale)
- **Visual**: Three-tier podium (gold/silver/bronze) with provider logos. Rationale tooltip on hover.
- **Mount trigger**: when `ranking` array lands.
- **Animation**: podiums rise from below w/ staggered y-translate.

### W7 — Model Critiques Stack
- **Driving fields**: `model_critiques` (array — per-model weakness commentary)
- **Visual**: Vertical accordion, one row per provider, collapsed by default. Provider color stripe on left edge. Click to expand the critique text.
- **Mount trigger**: when `model_critiques` array lands.
- **Animation**: rows fade in with 60ms stagger.

### W8 — Follow-up Questions Carousel
- **Driving fields**: `follow_up_questions` (string[])
- **Visual**: Horizontal scroll-snap carousel of question cards, each with a sparkle icon and "Click to ask →" affordance. Click → pre-fills MessageInput with the question.
- **Mount trigger**: when array lands.
- **Animation**: cards slide in from right (each 100ms apart).

---

## Layout (12-col grid, md+)

```
┌──────────────────────────────────────────────────────────────┐
│ W1 Verdict Hero (col-span-12)                                │
├──────────────────────────────────────────────┬───────────────┤
│ W3 Consensus / Disagreement (col-span-8)     │ W2 Gauge (4)  │
├──────────────────────────────────────────────┴───────────────┤
│ W4 Statute Reference Grid (col-span-12)                      │
├──────────────────────────────────┬───────────────────────────┤
│ W5 Vote Donut (col-span-6)       │ W6 Podium (col-span-6)    │
├──────────────────────────────────┴───────────────────────────┤
│ W7 Model Critiques Stack (col-span-12)                       │
├──────────────────────────────────────────────────────────────┤
│ W8 Follow-up Questions Carousel (col-span-12)                │
└──────────────────────────────────────────────────────────────┘
```

Mobile (<md): all stack to col-span-12, in the same vertical order.

---

## Stream-driven mount sequence (typical timing)

| Field landed | Widget | Approx delay from `moderator.start` |
|---|---|---|
| `composed_answer` (early prose) | W1 Verdict | ~3-6s |
| `outcome_likelihood_*` | W2 Gauge | ~6-9s |
| `consensus` / `agreement_points[*]` | W3 Split (left) | ~9-12s |
| `disagreements` / `conflict_points[*]` | W3 Split (right) | ~10-13s |
| `law_sections[*]` / `provider_law_sections` | W4 Statutes | ~12-15s |
| `vote_summary` | W5 Donut | ~14-17s |
| `ranking` | W6 Podium | ~16-19s |
| `model_critiques` | W7 Stack | ~17-20s |
| `follow_up_questions` | W8 Carousel | ~19-22s |

(Times approximate — depend on Gemini Flash output rate ~80-120 tokens/sec.)

---

## Phase 1 (next commit) — Backend infrastructure ONLY

- `streamModerator()` in `runner.js` — emits `moderator.delta` (raw `{text}` chunks) + final `moderator.complete`
- Frontend buffers deltas; existing `moderator.complete` handler still works (back-compat)
- **No widget components built yet** — the existing `TurnCard.tsx` renderer continues to work post-stream

## Phase 2 (next commit after Phase 1) — Widget components

- Install `partial-json` npm pkg
- New directory `frontend/src/components/llm-council/ChairmanCards/` with one component per widget (W1-W8)
- New orchestrator `ChairmanWidgetGrid.tsx` — buffers deltas, runs partial-parse on each new chunk, mounts widgets as fields appear
- Replace the moderator status row in `StreamingCouncilView` with `<ChairmanWidgetGrid />` when stream is active; fall back to existing `TurnCard` for completed sessions in `LlmCouncilSessionsPage`

---

## Open questions for operator

- **Q-W1** — Should W2 (Probability Gauge) animate the count-up only on first mount, or also re-animate on Restart-this-session re-renders? **Recommend first-mount only** (less janky on re-mounts).
- **Q-W4** — When `provider_law_sections` indicates a section was cited by all 3 providers, should it get a special "unanimous" treatment beyond the gold border (e.g. crown badge, slight pulse)? **Recommend yes — crown + 1-time pulse on entrance**.
- **Q-W8** — Should clicking a follow-up question (a) auto-submit it as a new turn or (b) just pre-fill the input box? **Recommend (b) — pre-fill** so user can edit before sending.

These are non-blocking — sensible defaults assumed if operator does not weigh in before Phase 2.
