# UX Audit — D2: Judges + Analytics data display
**Worker**: designer | **Scope**: 5 pages + judges/analytics/lineage components | **Date**: 2026-05-05

---

## TL;DR
- Two judge chart components (`VisaBreakdownChart`, `NatureBreakdownChart`) are missing `color` in their `contentStyle`, making tooltip text invisible in dark mode.
- Hardcoded hex colors appear in 6 files instead of using design-token CSS variables, breaking dark-mode color adaptation for chart fills.
- `JudgeLeaderboard` desktop table has no sortable column affordance or `aria-sort`, despite the page offering a `sortBy` control above it — inconsistent with `CourtVolumeTable` which correctly implements sort.

---

## Findings

### F1. Missing `color` in Tooltip `contentStyle` — BLOCKING
- **Where**: `frontend/src/components/judges/VisaBreakdownChart.tsx:58–63`, `frontend/src/components/judges/NatureBreakdownChart.tsx:58–63`
- **What's wrong**: Both Tooltip `contentStyle` objects set `backgroundColor`, `border`, and `borderRadius` but omit `color: "var(--color-text)"`. Recharts renders tooltip text in its own default (dark) color, which is invisible against the dark card background in dark mode.
- **Why it matters**: This is the single most documented gotcha in CLAUDE.md. Both charts are on `JudgeDetailPage`, a primary user destination. A self-rep applicant in dark mode sees a blank tooltip — zero data readout.
- **Fix**: Add `color: "var(--color-text)"` to both `contentStyle` objects.
- **Cross-cuts**: Pattern is correctly applied in `CountryOriginChart.tsx:63`, all `JudgeCompareCard` tooltips (lines 175, 273, 351), and all analytics components — these two in `JudgeDetailPage` were missed.

---

### F2. Hardcoded hex chart fills bypass token system — HIGH
- **Where**:
  - `frontend/src/components/judges/VisaBreakdownChart.tsx:64` — `fill="#1a5276"`
  - `frontend/src/components/judges/NatureBreakdownChart.tsx:65` — `fill="#6c3483"`
  - `frontend/src/components/judges/CountryOriginChart.tsx:69` — `fill="#64748b"`
  - `frontend/src/components/judges/JudgeCompareCard.tsx:277` — `fill="#1a5276"`, `:364` — `stroke="#2d7d46"`, `:365` — `fill="#2d7d4630"`
  - `frontend/src/pages/JudgeDetailPage.tsx:198–199` — `stroke="#1a5276"`, `fill="#1a527640"`
  - `frontend/src/components/analytics/OutcomeFunnelChart.tsx:44,49` — `backgroundColor: "#1f8a4d"`, `"#b64040"`
- **What's wrong**: Hex values hardcoded in `style` props rather than resolved through `getCourtColor()` or CSS variables. In dark mode the card background is `#192230` and these mid-dark fills lose contrast or appear incorrectly themed.
- **Why it matters**: `courtColors`, `semanticColors` exist in `tokens.ts` precisely for this. Hardcoded hex bypasses the token system and makes dark-mode color correctness brittle.
- **Fix**: Replace with `getCourtColor("AATA")`, `getCourtColor("ARTA")` etc., or for semantic fills use `var(--color-semantic-success)` / `var(--color-semantic-danger)`. For `#64748b` (CountryOriginChart bar) use `var(--color-text-secondary)` which is theme-aware. `OutcomeFunnelChart` green/red fills should use `var(--color-semantic-success)` and `var(--color-semantic-danger)`.
- **Cross-cuts**: `constants.ts:1–7` exports `OUTCOME_COLORS` as hardcoded hex — used in `JudgeCompareCard` pie slices and legend dots. These are court-keyed colors (see F4) and should be sourced from `courtColors` or a distinct outcome palette.

---

### F3. `JudgeLeaderboard` desktop table lacks sort affordance — HIGH
- **Where**: `frontend/src/components/judges/JudgeLeaderboard.tsx:99–109`
- **What's wrong**: `<thead>` renders plain `<th>` text with no click handler, no sort indicator icon, and no `aria-sort` attribute. Yet `JudgeProfilesPage` holds and exposes `sortBy` state (`cases` | `approval_rate` | `name`) via a select control above — sorting is happening server-side but the table column headers give no visual feedback about which column is active or in what direction.
- **Why it matters**: `CourtVolumeTable` (canonical reference in same codebase) correctly implements `ArrowUpDown` icon, active accent color on the sorted column button, and direction toggling. `JudgeLeaderboard` directly contradicts this pattern. Users cannot tell that sort is available or what the current sort key is.
- **Fix**: Add per-column sort buttons with `ArrowUpDown` / directional arrow icon and `aria-sort` attribute driven by the `sortBy` prop passed from parent. At minimum, visually highlight the active-sort column header to match the current `sortBy` state.
- **Cross-cuts**: Mobile card view has no sort indicator (acceptable). Desktop table must match `CourtVolumeTable` behavior.

---

### F4. `OUTCOME_COLORS` palette collides with court color encoding — HIGH
- **Where**: `frontend/src/components/judges/constants.ts:1–7`, consumed in `JudgeCompareCard.tsx:147,203`
- **What's wrong**: `OUTCOME_COLORS[0]` = `#1a5276` (AATA court blue), `OUTCOME_COLORS[2]` = `#6c3483` (ARTA court purple). The Pie chart in `JudgeCompareCard` uses these colors for outcome categories. On a judge who sits on AATA, the "Affirmed" outcome slice is the same AATA-blue used throughout the app for AATA as a court.
- **Why it matters**: The 9 court colors are a primary semantic encoding (used in `TimelineChart`, `CourtVolumeTable`, all legends). Reusing them for outcome categories on the same screen destroys the color grammar. A self-rep applicant cannot reliably learn "blue = AATA" if blue also means "Affirmed."
- **Fix**: Define a separate outcome palette from non-court token colors: `color.chart.2` (#8b5cf6 / dark: #a78bfa), `color.chart.3` (#10b981), `color.chart.4` (#3b82f6), `color.chart.5` (#f59e0b), plus semantic danger/warning for negative outcomes. None of these appear in `courtColors`.
- **Cross-cuts**: Trend Area in `JudgeCompareCard:364` uses `#2d7d46` (near-RRTA green) for approval rate — same issue at smaller scale.

---

### F5. `NatureOutcomeHeatmap` uses hardcoded AATA court blue as tint — MEDIUM
- **Where**: `frontend/src/components/analytics/NatureOutcomeHeatmap.tsx:104` — `rgba(26, 82, 118, …)`
- **What's wrong**: `#1a5276` is the AATA court color, here repurposed as the heatmap fill for all outcome-nature intersections regardless of whether data relates to AATA. In dark mode `rgba(26, 82, 118, 0.1)` on `#192230` (dark card) is near-invisible for low-intensity cells.
- **Why it matters**: Unintentional court-color reuse (same issue as F4) and low-intensity dark-mode cells appear blank, hiding valid low-count data.
- **Fix**: Use a non-court token color. `var(--color-accent-light)` (#d4a017 / amber) or `var(--color-chart-4)` (#3b82f6) would work. Floor opacity at `0.15` instead of `0.1` for dark-mode minimum visibility.
- **Cross-cuts**: Zero-value cells use `var(--color-surface)` fill — correct. Text fallback at `intensity <= 0.3` uses `var(--color-text-secondary)` — correct.

---

### F6. `DualMetricChart` Tooltip formatter multiplies by 100 unconditionally — HIGH
- **Where**: `frontend/src/components/judges/DualMetricChart.tsx:102–107`
- **What's wrong**: `(value * 100).toFixed(1) + "%"` is applied to any numeric value with no guard. If a caller passes pre-scaled 0–100 percentage data the tooltip displays values like `6500%`. No prop exists to control this assumption.
- **Why it matters**: Data integrity error — silent footgun for any future caller passing already-scaled data. The component's stated purpose ("judge performance comparison") makes 0–100 range inputs likely.
- **Fix**: Add an `asPercent?: boolean` prop (default `true` for backward compat). When `false`, display raw value without multiplication. Document the 0–1 input contract explicitly in the interface.
- **Cross-cuts**: `Bar` fills use `var(--color-primary)` and `var(--color-accent)` — correct token references.

---

### F7. Semantic colors use Tailwind literals instead of token variables — MEDIUM
- **Where**:
  - `frontend/src/components/judges/CountryOriginChart.tsx:93–97` — `text-green-600 dark:text-green-400`, `text-red-600 dark:text-red-400`
  - `frontend/src/components/judges/CourtComparisonCard.tsx:71–76` — `DeltaBadge` uses `bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400` and equivalents for red and gray
  - `frontend/src/components/analytics/OutcomeFunnelChart.tsx:29–33` — `text-green-600 dark:text-green-400`, `text-red-600 dark:text-red-400`
- **What's wrong**: Tailwind literal color classes are used instead of the project's semantic tokens (`var(--color-semantic-success)` / `var(--color-semantic-danger)`). Tailwind's `green-400` (#4ade80) differs from the token dark-mode success (#3da55d) — lighter and higher saturation.
- **Why it matters**: The semantic token dark-mode colors don't match Tailwind literals. `approvalBadgeClass` in `constants.ts` correctly uses `text-success` / `text-danger` — these three components deviate from that established pattern.
- **Fix**: Replace with `style={{ color: "var(--color-semantic-success)" }}` or if Tailwind classes are configured for token values, use `text-success` / `text-danger` consistently.
- **Cross-cuts**: All three files need the same fix. `CourtComparisonCard:DeltaBadge` also uses `bg-gray-100` for neutral delta — replace with `bg-surface text-muted-text`.

---

### F8. Section nav active state missing — MEDIUM
- **Where**: `frontend/src/pages/JudgeDetailPage.tsx:110–121`
- **What's wrong**: The sticky section nav renders 9 anchor links with `hover:text-accent` but no active/current state. When scrolled to a section, the corresponding link stays `text-muted-text` — no positional feedback for the user.
- **Why it matters**: With 9 sections on a long data-dense page, self-rep applicants lose orientation. The nav is intended as wayfinding but provides no current-position signal.
- **Fix**: Use `IntersectionObserver` to track the in-viewport `section-*` element and apply `text-accent font-medium` (and `aria-current="true"`) to the corresponding nav link.
- **Cross-cuts**: `scroll-mt-12` (3rem) is applied to all sections; the sticky nav is approximately `py-2` + text height (~40px). The 8px buffer should be adequate for the current nav height but needs re-verification if the nav gains a second row of links.

---

### F9. `JudgeComparePage` 3-judge grid produces orphaned card — MEDIUM
- **Where**: `frontend/src/pages/JudgeComparePage.tsx:29–32`
- **What's wrong**: `gridCols` logic gives only two cases: `"lg:grid-cols-2 xl:grid-cols-4"` for 4 judges, and `"lg:grid-cols-2"` for everything else. A 3-judge comparison renders as a 2-col grid with one orphaned card leaving a blank right half at `lg+` viewports.
- **Why it matters**: 3 judges is the most common non-trivial comparison selection. The layout looks broken rather than intentional.
- **Fix**: Compute `gridCols` from `data.judges.length` directly: 2 → `lg:grid-cols-2`, 3 → `lg:grid-cols-3`, 4 → `lg:grid-cols-2 xl:grid-cols-4`.
- **Cross-cuts**: `JudgeCompareCard` is self-contained; fix is purely page-level.

---

### F10. `ChartCard` loading skeleton height mismatches chart content — MEDIUM
- **Where**: `frontend/src/components/analytics/ChartCard.tsx:41–46`
- **What's wrong**: Skeleton renders 3 text bars + one `h-32` (128px) block regardless of which chart will load. Most analytics charts render at 300–400px. The `contentVisibility: auto` with `containIntrinsicSize: auto 400px` hint on line 34 is overridden by the skeleton's ~180px actual DOM height, causing a visible layout shift on load.
- **Why it matters**: Layout shift degrades perceived performance and trust — particularly impactful for the 15–20s cold analytics queries.
- **Fix**: Accept a `skeletonHeight?: number` prop (default 300) in `ChartCard` and apply it to the skeleton's primary block, matching the downstream chart's configured height.
- **Cross-cuts**: All 10+ `ChartCard` usages in `OutcomeAnalysisSection`, `FlowTrendsSection`, `ConceptIntelligenceSection`, `VisaFamiliesSection` benefit.

---

### F11. `CourtVolumeTable` sort buttons lack `aria-sort` and directional icon — MEDIUM
- **Where**: `frontend/src/components/lineage/CourtVolumeTable.tsx:55–68`
- **What's wrong**: `headerBtn` renders a `<button>` inside `<th>` but neither carries `aria-sort`. The `ArrowUpDown` icon does not differentiate direction — it is always bidirectional regardless of current sort state.
- **Why it matters**: Screen readers cannot announce sort direction. Sighted users must mentally track sort state rather than reading it from the UI. `JudgeLeaderboard` has the same omission (F3).
- **Fix**: Add `aria-sort={sortField === field ? (sortDir === "asc" ? "ascending" : "descending") : "none"}` to each `<th>`. Replace `ArrowUpDown` with `ArrowUp` / `ArrowDown` for the active sort column.
- **Cross-cuts**: Same fix applies to `JudgeLeaderboard` once sort affordance is added there (F3).

---

### F12. Section content silently absent for data-sparse judges — LOW
- **Where**: `frontend/src/pages/JudgeDetailPage.tsx:123–145` (recent_3yr_trend), `:249–253` (section-concepts)
- **What's wrong**: `recent_3yr_trend` section renders only when `data.recent_3yr_trend.length > 0` with no empty-state placeholder — for ARTA judges (2024+, max 2 years of data) the section simply vanishes, causing a layout collapse that looks broken. Similarly, `section-concepts` renders the heading but shows no body if `data.concept_effectiveness` is empty.
- **Why it matters**: Users navigating via the section nav to "Concepts" or expecting the 3yr summary will find nothing with no explanation.
- **Fix**: Render `recent_3yr_trend` section always; show an explicit data-sparsity note ("Insufficient history — fewer than 3 years of data") when `length < 3`. Add an `EmptyState` inside `section-concepts` for empty arrays.
- **Cross-cuts**: Section nav links always appear — the nav should either hide links for absent sections or show them as dimmed/disabled.

---

### F13. `JudgeHero` 5-stat grid collapses to orphaned row at mid-breakpoint — LOW
- **Where**: `frontend/src/components/judges/JudgeHero.tsx:180`
- **What's wrong**: `grid gap-3 sm:grid-cols-3 lg:grid-cols-5` — at 768–1024px viewport renders 3 columns with 2 orphaned stat cards on a second row, visually separating the "Recent 3yr trend" stat from the others.
- **Why it matters**: The stat row is the first data users read after the name. An incomplete second row implies unfinished content.
- **Fix**: Change to `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5` or group stats 2+3 with a divider to avoid the orphaned pair.
- **Cross-cuts**: Stat grid pattern recurs in other judge components.

---

### F14. `TimelineChart` bar click navigation lacks discoverability — LOW
- **Where**: `frontend/src/components/lineage/TimelineChart.tsx:274–279`
- **What's wrong**: Clicking a stacked bar navigates to `/cases?court=X&year=Y`. There is no tooltip hint, label, or visible affordance indicating bars are interactive. `cursor="pointer"` is set on `<Bar>` but may be inconsistently applied in stacked bar mode.
- **Why it matters**: Hidden navigation on a data visualization is a discoverability failure. The feature is useful for power users but invisible to everyone else.
- **Fix**: Add a note in the chart title or a helper text beneath the chart: "Click a bar segment to browse cases for that court and year." Verify `cursor: pointer` renders on hover in-browser.
- **Cross-cuts**: Chart is otherwise well-implemented — custom tooltip, token-sourced colors, correct `toSorted()` usage.

---

### F15. Analytics page initial load lacks cohesive loading presentation — LOW
- **Where**: `frontend/src/pages/AnalyticsPage.tsx:259–283`
- **What's wrong**: The 4 heavy analytics sections use independent query loading states via `ChartCard`. Sections pop in independently as each resolves — the page can show 3 complete sections and 1 skeleton simultaneously. The `isPending` opacity transition on line 173 only fires on filter-change transitions, not initial page load.
- **Why it matters**: Analytics queries have 15–20s server-side timeouts. Multiple independent loading pulses across the page reduce perceived coherence and make the page feel unstable.
- **Fix**: Apply the existing `opacity-70 transition-opacity` wrapper to the full analytics content area on initial load (not just on filter transitions), or use `React.Suspense` boundaries with a single skeleton per section to stagger reveals from top to bottom.
- **Cross-cuts**: `AnalyticsInsightsPanel` is correctly gated on `isFilterOptionsLoading` — pattern is sound, just not extended to the heavy sections below.

---

## Patterns observed

**consistent:**
- All Recharts `Tooltip` instances in `analytics/` components correctly include `color: "var(--color-text)"` in `contentStyle`
- `TimelineChart` uses a fully custom `ChartTooltip` render function with correct CSS variable styling — the right pattern for multi-series tooltips
- Axis tick `fill` uses `var(--color-text-secondary)` consistently across all charts
- `CartesianGrid` uses `var(--color-border)` with opacity consistently across all charts
- `ChartCard` provides consistent loading/error/empty states for all analytics sub-sections
- `JudgeLeaderboard` correctly implements the canonical `md:hidden` card / `hidden md:block` table mobile/desktop split
- `localStorage` access is try-catch wrapped wherever used (`JudgeProfilesPage:33–38`, `:139–144`)
- `.toSorted()` used correctly in `TimelineChart.tsx:63` and `CourtVolumeTable.tsx:23`
- `useCallback` dependency arrays correctly include `navigate` and other hook values

**inconsistent:**
- Tooltip `color` present in all analytics components and `CountryOriginChart`, `JudgeCompareCard` — absent in `VisaBreakdownChart` and `NatureBreakdownChart` standalone (F1)
- Sort affordance: `CourtVolumeTable` has full sort UI with `ArrowUpDown` and active state; `JudgeLeaderboard` table headers have no sort interaction (F3)
- Semantic colors: most components use `var(--color-semantic-*)` but `CountryOriginChart`, `CourtComparisonCard:DeltaBadge`, `OutcomeFunnelChart` use Tailwind literal `green-`/`red-` classes (F7)
- Empty states: most chart sections have no-data messages; `section-concepts` heading and `recent_3yr_trend` silently vanish (F12)
- Chart fill colors: all analytics components use CSS variables; judge components mix hardcoded hex with token variables (F2)

**missing:**
- `aria-sort` on any sortable `<th>` across the entire audited scope
- Active/current state on `JudgeDetailPage` section nav anchor links (F8)
- `IntersectionObserver` scroll-spy for section nav position tracking
- Directional sort icons (ArrowUp/ArrowDown) — all sort buttons use the ambiguous `ArrowUpDown` regardless of current direction
- Hover-state focus ring on `JudgeLeaderboard` mobile cards (cards have `hover:bg-surface/50` but no `focus-visible:ring` for keyboard navigation)

---

## Open questions for lead

1. **F4 / OUTCOME_COLORS**: Is the reuse of court-keyed hex values for outcome categories in `constants.ts` intentional (a deliberate palette choice) or an oversight? If intentional, document it there to prevent future divergence.
2. **F6 / DualMetricChart**: Which page or component actually calls `DualMetricChart`? No call site was found in the 5 audited pages — is it dead code or used in a page outside this audit scope?
3. **F8 / scroll-mt-12**: Sticky nav height is approximately 40px; `scroll-mt-12` = 48px. Adequate currently. Will need re-verification if the nav gains a second line of links (overflow-x scrolls, so it is single-line today).
4. **F15 / Analytics load strategy**: Are the 4 heavy sections intentionally independent (partial data shows immediately) or should they be grouped under a single loading gate? Architectural decision needed.
5. **keepPreviousData on judge hooks**: Confirm `useJudgeLeaderboard`, `useJudgeProfile`, `useJudgeCompare` use `keepPreviousData` / `placeholderData: keepPreviousData` per CLAUDE.md — these hooks were not read during this audit. Rapid filter changes on the judge page (name search, court, year) will flash empty state on each keystroke if not set.

---

## Files inspected

| File | Coverage |
|---|---|
| `frontend/src/pages/JudgeProfilesPage.tsx` | full (324 lines) |
| `frontend/src/pages/JudgeDetailPage.tsx` | full (310 lines) |
| `frontend/src/pages/JudgeComparePage.tsx` | full (108 lines) |
| `frontend/src/pages/AnalyticsPage.tsx` | full (285 lines) |
| `frontend/src/pages/CourtLineagePage.tsx` | full (448 lines) |
| `frontend/src/components/judges/JudgeLeaderboard.tsx` | full (209 lines) |
| `frontend/src/components/judges/JudgeCompareCard.tsx` | full (389 lines) |
| `frontend/src/components/judges/JudgeHero.tsx` | full (336 lines) |
| `frontend/src/components/judges/VisaBreakdownChart.tsx` | full (68 lines) |
| `frontend/src/components/judges/NatureBreakdownChart.tsx` | full (69 lines) |
| `frontend/src/components/judges/CountryOriginChart.tsx` | full (108 lines) |
| `frontend/src/components/judges/DualMetricChart.tsx` | full (159 lines) |
| `frontend/src/components/judges/CourtComparisonCard.tsx` | full (82 lines) |
| `frontend/src/components/judges/constants.ts` | full (14 lines) |
| `frontend/src/components/analytics/ChartCard.tsx` | full (68 lines) |
| `frontend/src/components/analytics/OutcomeAnalysisSection.tsx` | full (160 lines) |
| `frontend/src/components/analytics/NatureOutcomeHeatmap.tsx` | full (125 lines) |
| `frontend/src/components/analytics/OutcomeFunnelChart.tsx` | full (65 lines) |
| `frontend/src/components/lineage/TimelineChart.tsx` | full (294 lines) |
| `frontend/src/components/lineage/CourtVolumeTable.tsx` | full (170 lines) |
| `frontend/src/tokens/tokens.ts` | full (285 lines) |
| All analytics components | pattern grep (Tooltip, contentStyle, color vars) |
| All judges components | pattern grep (Tooltip, contentStyle, hardcoded hex) |
| All lineage components | pattern grep (Tooltip, hardcoded hex) |
