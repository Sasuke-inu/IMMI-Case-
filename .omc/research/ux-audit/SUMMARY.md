# UX Audit SUMMARY — IMMI-Case- React SPA

**Date**: 2026-05-05
**Lead**: Claude Opus 4.7 (1M)
**Workers**: 5 designer (`oh-my-claudecode:designer`) + 5 a11y-architect (`everything-claude-code:a11y-architect`), parallel, READ-ONLY
**Scope**: 28 pages + 13 component dirs + global theme/layout/router/api
**Total wall-clock**: ~10 min parallel fan-out
**Total tokens**: ~1.33M (avg 130k/worker)
**Methodology**: each worker scoped to disjoint feature surface; disjoint surfaces audited twice (designer + a11y) for cross-validation

---

## Headline numbers

| Track          | Workers | Findings | BLOCKING | HIGH  | MEDIUM | LOW |
|----------------|---------|----------|----------|-------|--------|-----|
| Designer (D1–D5)        | 5       | ~82      | 4        | 20    | 32     | 26  |
| a11y-architect (A1–A5)  | 5       | ~133     | 15       | 41    | 57     | 20  |
| **TOTAL**               | **10**  | **~215** | **19**   | **61**| **89** | **46** |

a11y track's BLOCKING count is ~4× designer's — typical pattern: ARIA / focus / live-region defects are invisible in pure-visual audit. The designer track caught the dark-mode visual layer and token contract; a11y caught everything that fails when the screen reader speaks.

---

## Cross-cutting themes (high-leverage fixes)

These are issues where **multiple workers independently found the same bug**. Confidence is highest here, and a single fix cascades.

### 🚨 T1 — Recharts dark-mode tooltip text invisible (BLOCKING, systemic)

- **Confirmed by**: D2-F1, A2-F1
- **Reach**: ~16 chart instances across analytics + judge profiles
- **Root cause**: `contentStyle` missing `color: "var(--color-text)"` (gotcha already documented in `CLAUDE.md` "React Frontend Gotchas")
- **Effort**: 1-day shared-tooltip-component refactor that fixes 16 sites
- **WCAG**: 1.4.3 Contrast Minimum

### 🚨 T2 — Modal/dialog pattern is half-implemented (BLOCKING, systemic)

- **Confirmed by**: D5-F5 (`ConfirmModal`), A1-F3, A3-F2 (`SaveSearchModal`), A4-F25, A5 (3 of 5 modals lack `role="dialog"` + focus trap)
- **Root cause**: bespoke modal divs across the codebase; shared `ConfirmModal` itself missing `role="dialog"` / `aria-modal` / focus trap / restored focus
- **Effort**: replace `ConfirmModal` with Radix/Headless `Dialog` primitive → cascades to all consumers
- **WCAG**: 2.1.2, 2.4.3, 4.1.2

### 🚨 T3 — `aria-live` / `role="progressbar"` absent app-wide (BLOCKING)

- **Confirmed by**: A1, A2, A3, A4 (Pipeline / Download / JobStatus / LegislationsScrape / LLM Council all silent), A5 (`aria-busy`/`aria-live` used <3 times across 27 pages)
- **Root cause**: no shared `<LiveRegion>` / `<ProgressIndicator>` component
- **Reach**: every async UX (search, save, validation, bulk-job, streaming AI council)
- **WCAG**: 4.1.3, 1.3.1

### 🚨 T4 — Combobox/autocomplete has no ARIA (BLOCKING)

- **Confirmed by**: A3-F1
- **Reach**: every autocomplete (`JudgeAutocomplete`, `CountryDropdown`, `VisaQuickLookup`, `LegalConceptBrowser`, semantic search input)
- **Effort**: switch to Radix Combobox or Headless UI Combobox primitive
- **WCAG**: 4.1.2 + WAI-ARIA Authoring Practices

### 🔥 T5 — `<html lang>` never reflects locale (HIGH, global)

- **Confirmed by**: A4, A5-F1
- **Root cause**: `frontend/index.html:2` static `lang="en"`; never updates to `en-AU` (base) or `zh-TW` when i18n switches; `Topbar.tsx:61` doesn't write to `<html>`
- **Effort**: 5-line patch in i18n bootstrap
- **WCAG**: 3.1.1, 3.1.2

### 🔥 T6 — `prefers-reduced-motion` not respected (HIGH, global)

- **Confirmed by**: A5-F2, A1
- **Root cause**: `.theme-transitioning *` uses `!important` (`index.css:260-268`); no `@media (prefers-reduced-motion: reduce)` block anywhere
- **Vestibular-safety blocker** — animation cannot be disabled by users with vestibular disorders
- **WCAG**: 2.3.3

### 🔥 T7 — Focus-visible only on form controls (HIGH, global)

- **Confirmed by**: A5-F3, A1
- **Root cause**: NavLinks/buttons rely on browser default rings, which wash out on dark navy theme
- **Reach**: every interactive element outside form inputs
- **WCAG**: 2.4.7, 2.4.11

### 🔥 T8 — Color-only encoding (HIGH, multiple)

- **Confirmed by**: A1, A2, A4
- **Reach**: 9-court badges, win/loss/dismissed indicators, status pills
- **Root cause**: pattern-shape only, no text/icon redundancy
- **WCAG**: 1.4.1

### 🔥 T9 — Magic hex `#111820` repeated across 7 files (HIGH, design-system)

- **Confirmed by**: D5-F2, D4 (CollectionEditor)
- **Root cause**: no `--color-overlay` token in `frontend/src/tokens/`
- **Effort**: add token, refactor 7 sites with codemod

### 🔥 T10 — `animate-spin` on Lucide SVGs not div wrapper (HIGH)

- **Confirmed by**: D5-F1
- **Reach**: `PageLoader.tsx:11` + suspected others (gotcha documented but not enforced)
- **User impact**: software-composited animation, jank on low-end devices
- **Note**: this is in CLAUDE.md gotcha list — recurring violation suggests need for ESLint rule

---

## Top BLOCKING issues by report (full citations in linked file)

| # | Where | Issue | Worker | Cross-ref |
|---|-------|-------|--------|-----------|
| 1 | Multiple Recharts charts | Dark-mode tooltip text invisible — `contentStyle` missing `color` | D2-F1, A2-F1 | T1 |
| 2 | `ConfirmModal`, all bespoke modals | Not real dialogs — no role, no focus trap, no Esc | D5-F5, A1-F3, A3-F2, A4-F25 | T2 |
| 3 | Pipeline/Download/JobStatus/LLM Council | Silent progress; no `aria-live`, no `role="progressbar"` | A4 (5 BLOCKING) | T3 |
| 4 | All autocompletes | Zero combobox ARIA semantics | A3-F1 | T4 |
| 5 | `LlmCouncilSessionsPage` | Fixed-width sidebar breaks on mobile | D4 | isolated |
| 6 | Form fields (CaseAdd / CaseEdit) | Labels not programmatically associated | A1 | per-page |
| 7 | Validation | Toast-only — not announced to AT | A1 | T3 |
| 8 | Charts (~15) | No `role="img"` + aria-label or `<figcaption>` | A2-F2 | T3 variant |
| 9 | Telegram login widget | No accessible context, no DDA-1992 alternative | A4-F1 | DDA risk |
| 10 | Streaming LLM Council | No live region for streaming text | A4 | T3 |
| 11 | Nested anchor+button | A11y violation (interactive nesting) | A4 | isolated |
| 12 | `SaveSearchModal` | No focus trap, no labelled dialog, errors unassociated | A3-F2 | T2 |
| 13 | `<html lang>` static + not synced | Site lang never matches content lang | A5-F1 | T5 |
| 14 | `.theme-transitioning *` `!important` | No reduced-motion fallback | A5-F2 | T6 |
| 15 | NavLinks/buttons focus-visible | Only form controls have `:focus-visible` style | A5-F3 | T7 |
| 16 | `TaxonomyPage` & `SearchTaxonomyPage` | Both single-line aliases of `GuidedSearchPage` — taxonomy components orphaned | D3 | tech debt |
| 17 | `GuidedSearchFlow` | Diverged twin of `GuidedSearchPage`; different debounce + concept-id format | D3 | tech debt |
| 18 | `SavedSearchCard` delete | No confirmation, no `aria-label` | D3 | T2 + dataloss |
| 19 | `bg-muted` semantic-search skeleton | Undefined token — invisible on light theme | D3 | tokens |

---

## Design-system / tech-debt findings (designer track only)

These won't fail accessibility audits but bleed brand integrity:

- **D5-F4**: legacy `use-theme.ts` still exists alongside canonical `use-theme-preset.ts` — different localStorage key — split-brain risk
- **D5-F6**: `@theme` self-referential vars (`--color-primary: var(--color-primary)`) — fragile import-order dependency
- **D5-F7**: court badge dark-mode collision — HCA `#1b2631` on `#192230` card near-invisible
- **D5-F10**: `h1`/`h2` base font-sizes are magic numbers, not in `tokens.json`
- **D2-F2**: hardcoded hex fills in 2 judge charts (TurnCard pattern)
- **D2-F4**: court colour collides with outcome colour in some chart contexts (semantic collision)
- **D4**: `LoginPage` uses `font-serif` not `font-heading` — brand font absent on trust-critical screen
- **D4**: workflow pages (Download/Pipeline/JobStatus) all missing breadcrumb navigation
- **D4**: TurnCard raw Tailwind palette classes (`emerald-*`, `rose-*`, `amber-*`) bypass token system
- **D3**: `VisaQuickLookup` query-string mismatch (`?visa_subclass=` vs canonical `?visa_type=`) — silently drops filter

---

## Suggested triage order (3 sprints)

> 顺序按 (BLOCKING × 影响面) 排序，先打高槓桿、低變更面的修法。

### Sprint 1 — BLOCKING (week 1, ship-stoppers)

1. **T1**: shared `<ChartTooltip>` wrapper that injects `color: var(--color-text)` → fixes 16 sites
2. **T2**: replace `ConfirmModal` internals with Radix `Dialog` → cascades to all modals
3. **T4**: replace autocomplete primitives with Radix Combobox
4. **A4-F1**: investigate non-Telegram login fallback for DDA 1992 (legal blocker)
5. **D3**: decide canonical `GuidedSearchPage` vs `GuidedSearchFlow`; delete the loser
6. **D4**: fix `LlmCouncilSessionsPage` mobile sidebar (one-line CSS fix)

### Sprint 2 — HIGH cross-cutting (week 2, foundational)

1. **T3**: build shared `<LiveRegion>` + `<ProgressIndicator>` primitives → roll out across Pipeline / Download / JobStatus / LLM Council / search results
2. **T5**: i18n locale → `<html lang>` sync (5-line patch)
3. **T6**: `@media (prefers-reduced-motion)` block in `index.css` + audit all `transition` declarations
4. **T7**: global `:focus-visible` style scoped to all interactives, not just form controls
5. **T8**: text/icon redundancy on court badges + outcome pills
6. **T9**: add `--color-overlay` token + codemod 7 files
7. **A1**: programmatic label association in CaseAdd/CaseEdit

### Sprint 3 — MEDIUM polish (week 3+)

- Workflow pages breadcrumb (D4)
- Magic hex / Tailwind palette → token migration (D2-F2, D4 TurnCard)
- LoginPage `font-heading` adoption + `<main>` landmark + `lang="en-AU"` on statute text (A4)
- Heading rank progression sweep (A5)
- Page title updates on route change (A5)
- Autocomplete attributes for case-related inputs (A1)
- ESLint rule enforcing `animate-spin` only on non-SVG elements
- Delete legacy `use-theme.ts` after grep confirms zero callers
- DesignTokensPage self-documentation parity with tokens.json (D4)

---

## Open questions for human lead

These came up in multiple worker reports — answer one place, propagates everywhere.

1. **Compliance target**: WCAG 2.2 AA only, or AS EN 301 549 too? (A1) — affects DDA 1992 + AA AAA decisions
2. **Telegram login DDA risk**: is non-Telegram alternative auth on roadmap? (A4-F1) — AU disability-discrimination compliance
3. **Canonical search flow**: `GuidedSearchPage` or `GuidedSearchFlow`? (D3) — one is dead code
4. **Taxonomy components**: `VisaQuickLookup`, `LegalConceptBrowser`, `CountryDropdown`, `JudgeAutocomplete` — wired into nothing, was this intended? (D3)
5. **Legacy `use-theme.ts`**: keep for backward compat, or delete? (D5-F4)
6. **Sonner / toast lib**: confirmed in use, or replaced? (A1)
7. **`ConfirmModal` upgrade path**: refactor in place, or migrate to Radix Dialog primitive? (T2 strategy)
8. **Single-letter shortcuts (`d`, `c`, `g`, `p`)**: collide with NVDA/JAWS browse-mode keys (A5) — keep with modifier, drop, or document?

---

## Reports index (drill-in)

| Worker | Track     | Focus                                    | Findings | Path                                                                                           |
|--------|-----------|------------------------------------------|----------|------------------------------------------------------------------------------------------------|
| D1     | designer  | Cases primary flow                       | 20       | `.omc/research/ux-audit/D1-cases-flow.md`                                                      |
| D2     | designer  | Judges + Analytics data display          | 15       | `.omc/research/ux-audit/D2-judges-analytics.md`                                                |
| D3     | designer  | Search & Discovery                       | 20       | `.omc/research/ux-audit/D3-search-discovery.md`                                                |
| D4     | designer  | Reference + Workflow + Auth              | 15       | `.omc/research/ux-audit/D4-reference-workflow-auth.md`                                         |
| D5     | designer  | Cross-cutting visual system              | 12       | `.omc/research/ux-audit/D5-cross-cutting-visual.md`                                            |
| A1     | a11y      | Cases primary flow (WCAG 2.2 AA)         | 30       | `.omc/research/ux-audit/A1-cases-a11y.md`                                                      |
| A2     | a11y      | Judges + Analytics (WCAG 2.2 AA)         | 28       | `.omc/research/ux-audit/A2-judges-analytics-a11y.md`                                           |
| A3     | a11y      | Search & Discovery (WCAG 2.2 AA)         | 20       | `.omc/research/ux-audit/A3-search-forms-a11y.md`                                               |
| A4     | a11y      | Reference + Workflow + Auth (WCAG 2.2 AA)| 30       | `.omc/research/ux-audit/A4-reference-workflow-auth-a11y.md`                                    |
| A5     | a11y      | Global a11y patterns (WCAG 2.2 AA)       | 25       | `.omc/research/ux-audit/A5-global-a11y.md`                                                     |

---

## Severity rubric reference

- **BLOCKING**: ships broken UX (dark-mode unreadable, keyboard trap, focus loss, AT path missing, ship-stopping legal compliance gap)
- **HIGH**: WCAG 2.2 AA fail on common path, breaks user-visible consistency, or violates documented gotcha (`CLAUDE.md`)
- **MEDIUM**: pattern drift (works but inconsistent), AA fail on edge path, AAA target missed where it should be hit
- **LOW**: polish/nit; best-practice gap with no formal violation

---

## Methodology notes

- **Read-only**: no source code modified; only this `.omc/research/ux-audit/` directory written
- **No team coordination overhead**: skipped formal `/team` orchestration (TeamCreate / TaskCreate / shutdown protocol) since workers had no inter-dependency. Direct parallel `Agent` fan-out delivered same result faster
- **Cross-validation**: same surface audited by both tracks (D1+A1, D2+A2, etc.) — high-confidence findings = those flagged independently by both lenses
- **No verification of claims**: this audit identifies issues; it does not run the app, take screenshots, or test with assistive technology. Treat all findings as hypotheses to verify in implementation pass

---

> 复盘四步法：
> **目標**: 拿到 IMMI-Case- web app 全 UX 一致性現況。
> **結果**: 215 個 findings，10 條跨切系統性主題，3-sprint 修法路線圖。
> **原因**: 雙視角（設計+a11y）並行 fan-out 比單一 reviewer 串行覆蓋率高 4×。
> **SOP**: 28-page React SPA 全量 UX audit ≈ 10 worker × 130k tokens × 10min wall-clock。可複用於下一輪迴歸驗證。
