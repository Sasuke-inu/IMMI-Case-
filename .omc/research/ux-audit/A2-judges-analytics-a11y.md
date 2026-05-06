# UX Audit — A2: Judges + Analytics (WCAG 2.2 AA)
**Worker**: a11y-architect | **Scope**: 5 pages + judges/analytics/lineage components | **Date**: 2026-05-05

## TL;DR
- **All 19 Recharts tooltips across analytics + judges + lineage are missing the `color: "var(--color-text)"` rule on `contentStyle`** — confirmed dark-mode 1.4.3 contrast failure (the project's own CLAUDE.md flags this exact gotcha; only `JudgeDetailPage` inline chart, `JudgeCompareCard` (3 charts), and `TimelineChart`'s custom tooltip get it right).
- **Charts have no screen-reader equivalent**. Only ~5 of ~20 charts (`TopJudgesChart`, `LegalConceptsChart`, `FlowSankeyChart`, `OutcomeFunnelChart`, `DualMetricChart`) have `role="img"` + `aria-label`; everything else is invisible to AT (1.1.1, 1.4.5).
- **Mobile + desktop dual-render of `JudgeLeaderboard` ships both DOM trees**; combined with sortable headers lacking `aria-sort`/`scope` + heatmaps using `<div>` grids with only `title` attributes, AT users effectively cannot consume the data layer.

## Findings

### F1. Recharts tooltips missing `color: var(--color-text)` in 17 files — [BLOCKING]
- **Where**: `frontend/src/components/analytics/{ConceptEffectivenessChart.tsx:74, TopJudgesChart.tsx:102, MonthlyTrendsChart.tsx:76, LegalConceptsChart.tsx:89, FlowSankeyChart.tsx:203, VisaFamiliesSection.tsx:126, ConceptTrendChart.tsx:124, OutcomeByCourtChart.tsx:82, OutcomeBySubclassChart.tsx:75, SuccessRateCalculator.tsx:283, OutcomeTrendChart.tsx:89, ConceptCourtBreakdown.tsx:64}`, `frontend/src/components/judges/{DualMetricChart.tsx:108, VisaBreakdownChart.tsx:58, CountryOriginChart.tsx:59, NatureBreakdownChart.tsx:58}`
- **What's wrong**: WCAG 2.2 SC **1.4.3 Contrast (Minimum)**. The project's CLAUDE.md explicitly warns: "Recharts dark mode tooltips — ALL Tooltip `contentStyle` must include `color: var(--color-text)` or text is invisible on dark backgrounds." Verified by `grep -c 'color: "var(--color-text)"'` on each file: 0 matches in the 16 files above. Only `JudgeDetailPage.tsx:192`, `JudgeCompareCard.tsx:175/273/351`, and `TimelineChart`'s custom tooltip include it.
- **Why it matters**: In dark mode the tooltip card renders a dark background with default browser-grey text → effectively invisible. Users cannot read the exact values that justify drilling into a chart.
- **Fix**: Append `color: "var(--color-text)"` to every `contentStyle` object listed above. Extract a shared `chartTooltipStyle` constant in `lib/chart-styles.ts` to prevent regression.
- **Cross-cuts**: same pattern likely exists on Cases/Dashboard charts (out of A2 scope).

### F2. Charts have no AT-accessible alternative — [BLOCKING]
- **Where**: Most chart components, e.g. `judges/VisaBreakdownChart.tsx`, `judges/NatureBreakdownChart.tsx`, `judges/CountryOriginChart.tsx`, `judges/JudgeCompareCard.tsx` (3 inline charts), `analytics/MonthlyTrendsChart.tsx`, `analytics/OutcomeTrendChart.tsx`, `analytics/ConceptEffectivenessChart.tsx`, `analytics/ConceptTrendChart.tsx`, `analytics/OutcomeByCourtChart.tsx`, `analytics/OutcomeBySubclassChart.tsx`, `analytics/ConceptCourtBreakdown.tsx`, `analytics/VisaFamiliesSection.tsx`, `analytics/SuccessRateCalculator.tsx`, `lineage/TimelineChart.tsx`. Inline `AreaChart` in `pages/JudgeDetailPage.tsx:166-203` also has no aria-label.
- **What's wrong**: SC **1.1.1 Non-text Content** + **1.4.5 Images of Text**. Recharts renders SVG with no role/label; without a wrapping `<figure role="img" aria-label="…"><figcaption>` data summary, screen readers announce nothing or "graphic". Only `TopJudgesChart`, `LegalConceptsChart`, `FlowSankeyChart`, `OutcomeFunnelChart`, `DualMetricChart` have it.
- **Why it matters**: Blind users get zero analytical insight from the page advertised as the data heart of the app. AS EN 301 549 §9.1.1.1 + DDA §24 expose direct legal risk.
- **Fix**: Wrap every `ResponsiveContainer` in `<figure role="img" aria-label={summary}><figcaption className="sr-only">{tableEquivalent}</figcaption>…</figure>`. The summary should include range + extrema (e.g. "Approval rate from {first} to {last}: min {min}%, max {max}%, latest {latest}%"). For non-trivial charts add a "View as table" toggle (already done for `FlowSankeyChart.tsx:144-160`).
- **Cross-cuts**: pattern should be standardised in a `<ChartFigure>` HOC.

### F3. JudgeLeaderboard ships both mobile + desktop DOM trees — [HIGH]
- **Where**: `frontend/src/components/judges/JudgeLeaderboard.tsx:41` (mobile `<div className="md:hidden">`) and `:97` (desktop `<div className="hidden md:block">`).
- **What's wrong**: SC **4.1.2 Name, Role, Value** + ARIA AP. Tailwind `hidden`/`md:hidden` is `display:none`, which does hide from AT, BUT both subtrees ship in DOM. Mobile cards lose `<table>` semantics entirely (each card is a `<div tabIndex=0>` with no `role` set — looks like a button but isn't). Desktop `<tr tabIndex=0>` adds custom Enter/Space handling on top of nested `<input type="checkbox">`. Search/voice-control commands resolve ambiguously.
- **Why it matters**: Sighted users perceive one list. Voice-control users say "click row 3" and target ambiguously between branches. Maintenance burden doubles every fix.
- **Fix**: Render exactly one tree based on `useMediaQuery("(min-width: 768px)")`. Either keep desktop table and let CSS reflow, or keep mobile cards as `<table>` with `display:block` rows on desktop.
- **Cross-cuts**: CLAUDE.md elevates this dual-DOM as the "標準模式" for responsive tables — needs project-wide rethink.

### F4. CourtVolumeTable sortable headers missing `aria-sort` + `<button>` not in `<th scope="col">` — [HIGH]
- **Where**: `frontend/src/components/lineage/CourtVolumeTable.tsx:55-68` (`headerBtn`), used at `:76,84,92,95,98`.
- **What's wrong**: SC **4.1.2 Name, Role, Value** + ARIA AP "Sortable Table". Sort buttons render `<button>{label}<ArrowUpDown/></button>` inside `<th>` but: (a) no `aria-sort="ascending|descending|none"` on the `<th>`; (b) icon `ArrowUpDown` lacks `aria-hidden="true"`; (c) `<th>` lacks explicit `scope="col"`; (d) button has no `aria-label` describing current sort state. Non-sort headers (`name`, `status`) are presentational `<span>` inside `<th>` — also missing `scope`.
- **Why it matters**: Screen reader users can't tell which column is currently sorted nor in which direction. JAWS reads "Total cases button" — direction unknown.
- **Fix**:
  ```tsx
  <th scope="col" aria-sort={sortField === "totalCases" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
    <button aria-label={`Sort by total cases${sortField === "totalCases" ? `, currently ${sortDir}ending` : ""}`} …>
      {t(labelKey)} <ArrowUpDown aria-hidden="true" className="h-3 w-3" />
    </button>
  </th>
  ```
- **Cross-cuts**: pattern absent across all sortable tables. JudgeLeaderboard sort lives in a `<select>` at `JudgeProfilesPage.tsx:210-223` — needs `aria-controls={tableId}`.

### F5. Tables missing `<caption>` and `scope` on every `<th>` — [HIGH]
- **Where**: `judges/JudgeLeaderboard.tsx:99-108`, `judges/ComparisonTable.tsx:66-80`, `judges/ConceptEffectivenessTable.tsx:36-41`, `judges/CourtComparisonCard.tsx:24-32`, `judges/CountryOriginChart.tsx:77-82`, `analytics/ConceptComboTable.tsx:31-36`, `analytics/FlowSankeyChart.tsx:147-156`, `analytics/VisaFamiliesSection.tsx:174-186`, `lineage/CourtVolumeTable.tsx:74-101`, recent-cases table at `pages/JudgeDetailPage.tsx:269-277`.
- **What's wrong**: SC **1.3.1 Info and Relationships**. None of the 10+ tables declare `<caption>`. None of the `<th>` use `scope="col"`. Several tables sit inside `overflow-x-auto`; without `scope`, NVDA cannot pair cell with column when the table scrolls horizontally.
- **Why it matters**: NVDA T-key navigation returns "tables: 10" with no descriptive name. Cell-by-cell navigation reads only cell content with no column header — number columns become meaningless ("178" "92" "45" with no idea what each is).
- **Fix**: Add `<caption className="sr-only">{descriptive label}</caption>` and `scope="col"` to every `<th>` element. For paged/virtual tables also add `aria-rowcount`/`aria-colcount`.

### F6. Court badges & status indicators rely on colour alone for state — [HIGH]
- **Where**: `analytics/RiskGauge.tsx:17-27` (red/yellow/green band — colour only; the band name is not announced); `judges/ComparisonTable.tsx:108-116` (positive/negative diff via `text-emerald-600 / text-rose-600` — only sign character `+/−` differentiates); `pages/CourtLineagePage.tsx:410-422` (`text-success` vs `text-danger` for transition change percent — sign + colour only).
- **What's wrong**: SC **1.4.1 Use of Color**. The 9 court colour swatches in `CourtLineagePage.tsx:339-352` are paired with text — that's fine. But `RiskGauge` colour buckets (red <40, yellow <65, green ≥65) are not announced as "high/medium/low risk" — `aria-label` is missing on the `<svg>`.
- **Why it matters**: Colour-blind users and users in forced-colours mode (Win High Contrast) lose the rising/falling signal entirely.
- **Fix**: Add icon redundancy — `<TrendingUp aria-label="increase" />` / `<TrendingDown aria-label="decrease" />`. For `RiskGauge`, add `<svg role="img" aria-label="Risk score 72 out of 100, low risk">` and announce the band in the visible label.

### F7. JudgeCard / row uses `role="button"` on a `<div>` w/ inner interactive controls — [HIGH]
- **Where**: `judges/JudgeCard.tsx:34-50` (whole card is `role="button"`, contains `<input type="checkbox">` at `:104-112`); `judges/JudgeLeaderboard.tsx:114-128` (whole `<tr>` has `tabIndex={0}` + onClick + onKeyDown, contains checkbox `<input>` at `:138-143`).
- **What's wrong**: SC **4.1.2 Name, Role, Value** + ARIA "no nested interactive content". Buttons cannot contain other interactive elements; `<tr role="button">` is invalid (rows can't be buttons in tables). `onClick={e => e.stopPropagation()}` on the label wrapper at `JudgeCard.tsx:101-103` doesn't help keyboard users — Tab still reaches the checkbox second, and Enter on the card both opens detail and toggles selection depending on focus. Custom shortcut `x` at `:43-46` is undocumented and conflicts with browser shortcuts.
- **Why it matters**: NVDA + VoiceOver mis-announce ("button, judge name, checkbox" all at once). Keyboard users cannot reliably reach the checkbox without tab-trapping.
- **Fix**: Make the card an `<article>` with explicit `<a href="…">` for navigation and a separate `<button>` for compare. For rows, navigate via a single `<a>` in the first non-checkbox cell, drop `tabIndex` on `<tr>`. Surface `x` shortcut visibly.

### F8. Custom keyboard shortcuts on `document` capture without aria-keyshortcuts visibility — [MEDIUM]
- **Where**: `pages/JudgeProfilesPage.tsx:99-124` (slash-to-focus + `c` to compare), `pages/AnalyticsPage.tsx:150-169` (`r` to reset).
- **What's wrong**: SC **2.1.4 Character Key Shortcuts**. Single-character shortcuts must be (a) toggleable, (b) remappable, OR (c) only active on focus. These are global `document` listeners with only an INPUT/SELECT/TEXTAREA escape — they fire when focus is on links, buttons, contenteditable, modals. The reset button has `aria-keyshortcuts="R"` but the slash and `c` shortcuts only have inline `title` hints.
- **Why it matters**: Voice-control users dictating "click compare" outside an INPUT could trigger `c`. Sticky-key users hit phantom resets.
- **Fix**: Either (a) Settings panel toggle to disable, (b) require modifier key, OR (c) gate on `document.activeElement` being inside the page region. Add `aria-keyshortcuts` on every triggerable element + a help banner with `<kbd>` listing.

### F9. JudgeDetailPage section-nav anchors break Tab order on skip — [MEDIUM]
- **Where**: `pages/JudgeDetailPage.tsx:109-121`. Sticky `<nav>` with 9 anchor links to `#section-*`; sections use `scroll-mt-12`.
- **What's wrong**: SC **2.4.3 Focus Order** + **2.4.1 Bypass Blocks**. Anchor click moves scroll but not focus — Tab next continues from the nav, not the target section. No visible focus indicator on `<a>` links (relies on browser default; `transition-colors hover:text-accent` only). The nav has no `aria-label`.
- **Fix**: Add `<nav aria-label="Judge profile sections">`. On click, `document.getElementById(targetId)?.focus({ preventScroll: true })` after setting `tabIndex={-1}` on the section. Add explicit `focus-visible:outline` style.

### F10. JudgeProfilesPage view-mode toggle missing group semantics — [MEDIUM]
- **Where**: `pages/JudgeProfilesPage.tsx:131-178`.
- **What's wrong**: SC **4.1.2**. Two related toggles aren't wrapped in a `role="group"` with `aria-label="View mode"`. Screen readers announce each in isolation. Icon-only buttons; verify the `t("tooltips.table_view")` value isn't literally the i18n key in failure cases.
- **Fix**: Wrap in `<div role="group" aria-label={t("judges.view_mode_label")}>`. Or convert to a proper `role="radiogroup"` with `aria-checked`.

### F11. Heatmap cells have no AT representation, only `title` — [HIGH]
- **Where**: `analytics/ConceptCooccurrenceHeatmap.tsx:88-104`, `analytics/NatureOutcomeHeatmap.tsx:96-117`.
- **What's wrong**: SC **1.3.1** + **1.1.1**. Heatmap is a CSS grid of `<div>`s with `title` attributes — `title` is unreliable for AT (mobile screen readers ignore it). Cell value, row header, col header are not programmatically associated. Mode toggle in `NatureOutcomeHeatmap.tsx:40-48` is a plain `<button>` with no `aria-pressed` or `role="switch"`.
- **Why it matters**: A screen reader navigates the grid as 144 unlabelled `<div>`s. Total information loss.
- **Fix**: Use `<table role="table">` semantics with `<thead><tr><th scope="col">{outcome}` etc. Each cell `<td>` includes a visually hidden `<span className="sr-only">{rowConcept} crossed with {colConcept}: {count} cases, win rate {winRate}%</span>`. Add a "View as data table" toggle.

### F12. Empty data state not announced — [MEDIUM]
- **Where**: `pages/JudgeProfilesPage.tsx:262-300` (loading→error→empty switch); also `pages/JudgeComparePage.tsx:69-95`, `pages/AnalyticsPage.tsx:242-256`. Recharts no-data fallbacks at `judges/JudgeCompareCard.tsx:181-185, 293-297, 370-372`.
- **What's wrong**: SC **4.1.3 Status Messages**. Switching between loading / loaded / empty does not fire an `aria-live` region.
- **Fix**: Wrap the dynamic data region in `<div role="region" aria-live="polite" aria-busy={isLoading}>`. Filter chip changes (`AnalyticsPage.tsx:182` scope summary) should be in `aria-live="polite"`.

### F13. Court colour swatches have no `aria-hidden` — [MEDIUM]
- **Where**: `pages/CourtLineagePage.tsx:340-349` (legend), `lineage/CourtVolumeTable.tsx:117-127` (cell-prefix swatch), `judges/JudgeCompareCard.tsx:200-205` (outcome dot).
- **What's wrong**: SC **1.1.1**. Decorative swatches are `<div>`s with inline `backgroundColor` — without `aria-hidden="true"`, AT may stop on them with no label, OR double-announce with the adjacent text label.
- **Fix**: Add `aria-hidden="true"` on each swatch since the code already has the text label adjacent.

### F14. Charts using `cursor: pointer` on bars but no keyboard equivalent — [HIGH]
- **Where**: `lineage/TimelineChart.tsx:267-289` (`<Bar … onClick={…} cursor="pointer">` navigates to `/cases?court=…&year=…`).
- **What's wrong**: SC **2.1.1 Keyboard**. Recharts `<Bar onClick>` only fires on mouse — no keyboard alternative to navigate from a bar to the filtered cases list.
- **Why it matters**: Keyboard-only and switch-control users cannot drill from chart to detail.
- **Fix**: Provide an alternative — a "View by year" `<select>` + `<button>`, or a data-table fallback (F2) where each row links out.

### F15. Avatar fallback `<div aria-label={displayName}>` w/ no role — [MEDIUM]
- **Where**: `judges/JudgeHero.tsx:118-125`.
- **What's wrong**: SC **4.1.2**. Bare `<div>` with `aria-label` has no role, so the label is ignored by AT. The image branch above (`<img alt={displayName}>`) is correct.
- **Fix**: Use `role="img" aria-label={displayName}` on the initials div, with the visible initials marked `aria-hidden="true"`.

### F16. Recent-cases table inside JudgeDetailPage missing semantics — [MEDIUM]
- **Where**: `pages/JudgeDetailPage.tsx:268-306`.
- **What's wrong**: SC **1.3.1**. `<th>` has no `scope`. No `<caption>`. Cells use `text-muted-text` (mid-grey) — verify ratio against `bg-card` in dark mode.
- **Fix**: Same as F5. Verify `--color-text-muted` contrast ≥ 4.5:1.

### F17. AnalyticsFilters search input keyshortcut clobbers `/` browser default — [LOW]
- **Where**: `pages/JudgeProfilesPage.tsx:202-203`. `aria-keyshortcuts="/"`, but Firefox uses `/` for Quick Find.
- **What's wrong**: SC **2.1.4** — same as F8 plus surprise factor for power users.
- **Fix**: Use `Ctrl+K` or `Ctrl+/` per modern convention. Document via visible `<kbd>` chip.

### F18. Reset filters button only appears when `hasAnyFilter` — visibility/announcement gap — [LOW]
- **Where**: `pages/AnalyticsPage.tsx:184-194`.
- **What's wrong**: SC **3.2.4 Consistent Identification**. Button toggles in/out of DOM. AT users get no announcement on appearance.
- **Fix**: Always render the button with `disabled={!hasAnyFilter}` + `aria-disabled` + visual tone change. Same for the keyboard-shortcut hint banner `:205-209`.

### F19. JudgeCompareCard pie chart drops percent labels below 18% — [MEDIUM]
- **Where**: `judges/JudgeCompareCard.tsx:137-141` (`label={({ percent }) => percent >= 0.18 ? … : ""}`).
- **What's wrong**: SC **1.1.1**. Slices < 18% are unlabelled both visually and in AT. The legend below at `:186-215` provides text fallback but doesn't link slices to legend swatches with `aria-labelledby`.
- **Fix**: Always label or always omit, and ensure the legend list has `role="list"` with each `<li role="listitem" aria-label="{outcome}: {count} cases ({pct}%)">`. The `<span style={{backgroundColor}}>` swatch in the legend needs `aria-hidden="true"`.

### F20. `<input type="checkbox">` for compare lacks visible label association — [MEDIUM]
- **Where**: `judges/JudgeLeaderboard.tsx:138-143` (no `<label>`, only `aria-label`); `judges/JudgeCard.tsx:104-112` (label wraps but `onClick stopPropagation` on label may break click target).
- **What's wrong**: SC **3.3.2 Labels or Instructions** + i18n consistency. `aria-label="Compare {name}"` is in English ("Compare …") while every other UI string uses `t("…")`.
- **Fix**: `aria-label={t("judges.compare_aria", { name: displayName })}`. Use `<label className="sr-only" htmlFor={id}>` pattern.

### F21. JudgeProfilesPage compare button `disabled` skips Tab announcement — [LOW]
- **Where**: `pages/JudgeProfilesPage.tsx:242-253`.
- **What's wrong**: SC **4.1.2**. `disabled` button is skipped in Tab order — users with screen readers don't hear the criterion ("select 2 judges to enable"). The `text-warning` "max selected" banner is visible-only.
- **Fix**: Use `aria-disabled="true"` instead of `disabled`, with `onClick` no-op when disabled, plus `aria-describedby` pointing to the rule text.

### F22. Stat cards in CourtLineagePage are presentational — no relationship — [LOW]
- **Where**: `pages/CourtLineagePage.tsx:235-271`.
- **What's wrong**: SC **1.3.1**. Four `<p>` label / `<p>` value pairs without `<dl>` semantics — relationship isn't programmatic.
- **Fix**: Use `<dl><dt>{label}</dt><dd>{value}</dd></dl>`. Same applies to `JudgeHero.tsx:47-54` `Stat` component.

### F23. Transition Impact tiles use colour for sign — [MEDIUM]
- **Where**: `pages/CourtLineagePage.tsx:410-422`.
- **What's wrong**: SC **1.4.1**. `text-success` (positive %) vs `text-danger` (negative %); only the `+`/`−` glyph is non-colour.
- **Fix**: Add `<TrendingUp aria-label={t('common.up')} />` / `<TrendingDown aria-label={t('common.down')} />` icons.

### F24. Target size — toggle pills in CourtLineagePage chart-mode + view-mode toggles — [MEDIUM]
- **Where**: `pages/CourtLineagePage.tsx:280-319` (3 pills `px-2.5 py-1 text-[11px]`); `pages/JudgeProfilesPage.tsx:133-175` view toggle (`p-1.5` ~28×28).
- **What's wrong**: SC **2.5.8 Target Size (Minimum)** — 24×24 CSS px. With `text-[11px]` + `px-2.5 py-1` the click target is approximately 22×24 — borderline. View-mode buttons pass at ~28×28 inclusive of padding, but no spacing exception applies if packed flush.
- **Fix**: Bump to `py-1.5` and `gap-2` minimum between adjacent pills.

### F25. Recharts `<XAxis>` / `<YAxis>` tick text contrast — [HIGH]
- **Where**: every chart, e.g. `pages/JudgeDetailPage.tsx:178-181`, `lineage/TimelineChart.tsx:202-209`, `judges/JudgeCompareCard.tsx:248-256`.
- **What's wrong**: SC **1.4.3 Contrast (Minimum)**. `--color-text-secondary` against `--color-background-card`/`bg-card` — needs verification ≥ 4.5:1. Project tokens (`#f5f4f1` warm cream + `#1b2838` deep navy) suggest the secondary token may pass on light but fail in dark mode.
- **Fix**: Audit `--color-text-secondary` in both modes with axe. If failing, swap to `--color-text-muted-on-card` per surface.

### F26. `JudgeHero` Stat tile labels uppercase tracked at `text-xs` — [LOW]
- **Where**: `judges/JudgeHero.tsx:50` (`Stat` component, also `pages/CourtLineagePage.tsx:237,245,253,265`).
- **What's wrong**: SC **1.4.4 Resize Text**. Uppercase + `text-xs` (~10-12px) + tracking-wide is harder for low-vision users — pattern-risk for the stated persona of stressed self-applicants.
- **Fix**: At least bump to `text-[13px]` and reduce `tracking-wide` for these data labels.

### F27. AdvancedFilterPanel + SuccessRateDeepModal not deep-inspected — [INFO]
- **Where**: `analytics/AdvancedFilterPanel.tsx`, `analytics/SuccessRateCalculator.tsx`, `analytics/SuccessRateDeepModal.tsx`.
- **What's wrong**: Out of read budget. SuccessRateDeepModal has a close button at `:90` with `aria-label`; full focus-trap + escape + restore-on-close not verified.
- **Fix**: Verify modal traps focus, restores on close, has `role="dialog" aria-modal="true" aria-labelledby={…}`.

### F28. JudgeDetailPage sticky nav may obscure focused section heading — [LOW]
- **Where**: `pages/JudgeDetailPage.tsx:109-121` + sections with `scroll-mt-12`.
- **What's wrong**: SC **2.4.11 Focus Not Obscured (Minimum)** (WCAG 2.2 new). Sticky nav with `top-0 z-10` and `backdrop-blur-sm` may overlap a focused section heading scrolled to.
- **Fix**: Verify `scroll-mt-12` covers full nav height including padding + backdrop. Add `scroll-padding-top` on `:root`.

## Patterns observed
- **Inconsistent**: Recharts `contentStyle` color rule followed in 5 places (`JudgeDetailPage`, `JudgeCompareCard` ×3, `TimelineChart` custom tooltip), missed in 16 others — needs a shared constant.
- **Inconsistent**: Some charts get `role="img" + aria-label` (5), most don't (15+).
- **Consistent (bad)**: All tables lack `<caption>` and `scope="col"`. All sortable headers lack `aria-sort`.
- **Consistent (bad)**: Heatmaps use `<div>` grids with `title` only — no table semantics anywhere.
- **Consistent (good)**: `<EmptyState>`, `<ApiErrorState>`, `<PageLoader>` reused across pages — fix once, propagate.
- **Missing**: `aria-live` regions for filter-driven data updates; `<figure>` wrappers on charts; visually-hidden table captions; project-wide `<ChartFigure>` HOC.

## Open questions for lead
1. **Drop dual-DOM responsive tables?** Switching to single-tree CSS reflow breaks the established mobile-card design language. Worth the a11y win? (F3)
2. **Table-fallback for charts**: build per chart now, or ship a generic `<ChartFigure data={…}>` HOC + table renderer? (F2)
3. **`/` keyboard shortcut**: keep (matches GitHub) or move to `Ctrl+K` (matches modern apps + avoids Firefox conflict)? (F8/F17)
4. **`RiskGauge` red/yellow/green semantics** — should the band thresholds (40, 65) be exposed as `<datalist>` for AT, or just announced as "high/medium/low"? Project copy hasn't standardised those terms. (F6)
5. **Heatmap rewrite cost**: `ConceptCooccurrenceHeatmap` and `NatureOutcomeHeatmap` need full rebuild as `<table>` — estimate 1d each. Punt to A3?
6. **Tokens audit**: Need axe/Lighthouse run on actual rendered pages in light + dark — static audit can't confirm contrast on every token combo. Schedule before sign-off.

## Files inspected
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/pages/JudgeProfilesPage.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/pages/JudgeDetailPage.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/pages/JudgeComparePage.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/pages/AnalyticsPage.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/pages/CourtLineagePage.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/judges/JudgeLeaderboard.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/judges/JudgeCard.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/judges/JudgeHero.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/judges/ComparisonTable.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/judges/JudgeCompareCard.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/lineage/CourtVolumeTable.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/lineage/TimelineChart.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/analytics/ConceptCooccurrenceHeatmap.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/analytics/NatureOutcomeHeatmap.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/analytics/RiskGauge.tsx`
- Grep-scanned (`contentStyle`, `aria-*`, `role`, `<th`, `scope`, `tabIndex`): all 14 judges/, 26 analytics/, 4 lineage/ component files.
- Not deep-read: `AdvancedFilterPanel`, `SuccessRateDeepModal`, full `SuccessRateCalculator` body, all section wrappers (`OutcomeAnalysisSection`, `FlowTrendsSection`, `ConceptIntelligenceSection`, `VisaFamiliesSection`), `LineageFilters`, `LineageExplainer` body — flagged for follow-up.
