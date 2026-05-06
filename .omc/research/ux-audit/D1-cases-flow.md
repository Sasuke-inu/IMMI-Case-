# UX Audit — D1: Cases primary flow
**Worker**: designer | **Scope**: 6 pages + cases/dashboard components | **Date**: 2026-05-05

---

## TL;DR
- `window.confirm` / `prompt()` break the Legal Codex brand voice for stressed self-rep applicants — two native OS dialogs remain unfixed while styled modal components already exist.
- `animate-spin` is applied directly to SVG icon elements in two places (`PageLoader`, `DashboardPage` loading state), violating the documented project gotcha.
- `CaseDetailPage` labels the `case_id` field with `t("cases.title")` — users see "Case Title: abc123def456", which is factually wrong and erodes trust.

---

## Findings

### F1. `animate-spin` on SVG icon, not wrapper div — HIGH
- **Where**: `frontend/src/components/shared/PageLoader.tsx:11`, `frontend/src/pages/DashboardPage.tsx:262`
- **What's wrong**: `PageLoader` passes `animate-spin` directly on the `<LoaderCircle>` SVG. `DashboardPage` builds `iconClass` as `"h-5 w-5 animate-spin text-accent"` and applies it to `<Loader2>` (rendered at line 298). Both are SVG elements — not hardware-accelerated for CSS `transform`.
- **Why it matters**: Documented gotcha violation. SVG `animate-spin` can stutter on low-power devices, degrading perceived reliability for anxious users waiting on slow data loads.
- **Fix**: Wrap each in `<div className="animate-spin">` and remove `animate-spin` from the SVG class string.
- **Cross-cuts**: `LegislationsPage:182` also places `animate-spin` directly on an SVG (outside D1 scope but same pattern). Pages within D1 scope that do it correctly: `LlmCouncilPage`, `PipelinePage`, `DownloadPage`.

---

### F2. `window.confirm` used for saved-search delete — HIGH
- **Where**: `frontend/src/pages/DashboardPage.tsx:1199`
- **What's wrong**: Saved-search deletion in the Dashboard section calls `window.confirm(t("saved_searches.confirm_delete", ...))` — a native browser dialog that cannot be styled and does not respect the app's design system.
- **Why it matters**: Self-represented applicants under stress deserve a consistent, calm modal — not a browser OS dialog that looks like a system error. The codebase already has `ConfirmModal` for exactly this case (used in `CasesPage:587` and `CaseDetailPage:354`).
- **Fix**: Replace `window.confirm(...)` + direct `deleteSearch()` with `ConfirmModal` state, matching the pattern at `CaseDetailPage:354-364`.
- **Cross-cuts**: Isolated to DashboardPage saved-search delete path.

---

### F3. `prompt()` for new-collection name — HIGH
- **Where**: `frontend/src/pages/CaseDetailPage.tsx:407` (`AddToCollectionMenu.handleNewCollection`)
- **What's wrong**: `const name = prompt(t("bookmarks.collection_name"))` — a native OS prompt dialog for naming a new collection. No styling, no validation UX, no keyboard-trap control.
- **Why it matters**: Visually jarring brand break. WCAG 2.1 §3.2.2 — the dialog appears as an unexpected context change. iOS Safari shows a differently styled native dialog.
- **Fix**: Replace with an inline input in the dropdown (a small controlled `<input>` + confirm button inside the popover) or a small `Modal`. The existing `TagInputModal` (`CasesPage:600`) demonstrates the correct pattern.
- **Cross-cuts**: Isolated to `AddToCollectionMenu` in `CaseDetailPage`.

---

### F4. `MetaField` label `t("cases.title")` used to display `case_id` value — HIGH
- **Where**: `frontend/src/pages/CaseDetailPage.tsx:183`
- **What's wrong**: `<MetaField label={t("cases.title")} value={c.case_id} mono />` — the label resolves to "Case Title" but displays the internal SHA-256 hash identifier (`abc123def456`). The actual human-readable title is already shown via `PageHeader` at line 139.
- **Why it matters**: A self-rep applicant reading the metadata grid sees "Case Title: 3f9a1b..." — confusing and trust-eroding. The wrong i18n key was used; the field should be labelled "Case ID".
- **Fix**: Change to `label={t("cases.case_id", { defaultValue: "Case ID" })}`.
- **Cross-cuts**: Isolated to `CaseDetailPage` metadata grid.

---

### F5. `DashboardPage` loading state `animate-spin` on icon class string — HIGH
- **Where**: `frontend/src/pages/DashboardPage.tsx:262`, rendered at line 298
- **What's wrong**: The loading-phase icon logic builds `iconClass` including `animate-spin` and applies it directly as `<Loader2 className={iconClass} />`. This is a separate occurrence from F1 — same gotcha, different file.
- **Why it matters**: SVG CSS animation performance concern. This is the first thing users see when the page is loading — smooth animation matters for perceived quality.
- **Fix**: Extract the icon rendering: `<div className="animate-spin"><Loader2 className="h-5 w-5 text-accent" /></div>`. Strip `animate-spin` from `iconClass`.
- **Cross-cuts**: See F1 for the `PageLoader` occurrence.

---

### F6. `CaseDetailPage` top action buttons missing `type="button"` — HIGH
- **Where**: `frontend/src/pages/CaseDetailPage.tsx:123`, `CaseTextViewer.tsx:397,404,410,421,431,437,445`, `CaseDetailPage.tsx:429,437,449,459` (`AddToCollectionMenu`)
- **What's wrong**: The delete `<button>` at line 123 has no `type` attribute. All `CaseTextViewer` toolbar buttons (Search, Download, Print, Expand/Collapse, navigation chevrons) also omit `type`. `AddToCollectionMenu` list buttons omit `type`. The rest of the D1 codebase consistently uses `type="button"` on every non-submit button.
- **Why it matters**: WCAG 4.1.2 — programmatic role determination. Without `type="button"`, buttons inside or near form contexts can default to `type="submit"` in some environments, causing unintended form submissions.
- **Fix**: Add `type="button"` to each omitted button. Mechanical find-and-add — no logic change required.
- **Cross-cuts**: `CaseTextViewer` (6 toolbar buttons), `CaseDetailPage` delete button (1), `AddToCollectionMenu` (4 buttons).

---

### F7. `CaseComparePage` missing `PageHeader` — breaks page-level consistency — MEDIUM
- **Where**: `frontend/src/pages/CaseComparePage.tsx:110-116`
- **What's wrong**: The compare page renders a `<Breadcrumb>` but no `<PageHeader>`. Every other D1 page uses `PageHeader` for the title + description + meta layout. Compare is the outlier.
- **Why it matters**: Breaks compositional consistency. The page also provides no affordance to "return to cases with selection intact", leaving users stranded after comparison.
- **Fix**: Add `<PageHeader title={t("cases.comparison")} description={t("pages.case_comparison.description")} />` below the breadcrumb. Consider adding a "Back to Cases" link in `actions`.
- **Cross-cuts**: Isolated to `CaseComparePage`.

---

### F8. `CaseComparePage` sticky label cell background ignores differing-row highlight — MEDIUM
- **Where**: `frontend/src/pages/CaseComparePage.tsx:161`
- **What's wrong**: The row-label `<td>` has `className="sticky left-0 z-10 bg-card ..."`. When a row is differing (`isDiffering && "bg-warning/5"` on the `<tr>`), the sticky cell keeps its solid `bg-card`, creating a visual split: the label appears unaffected while data cells behind show the warning tint.
- **Why it matters**: The entire purpose of the compare page is to highlight differences. Masking the diff tint on the label — the most prominent cell — undermines the feature's primary signal.
- **Fix**: `className={cn("sticky left-0 z-10", isDiffering ? "bg-warning/5" : "bg-card", "p-3 font-medium text-muted-text whitespace-nowrap")}`.
- **Cross-cuts**: Isolated to `CaseComparePage`.

---

### F9. `CasesBulkActions` clear-selection button uses wrong i18n key — MEDIUM
- **Where**: `frontend/src/components/cases/CasesBulkActions.tsx:75`
- **What's wrong**: The "clear selection" button uses `t("filters.clear_filters")` ("Clear Filters"). This clears the row selection, not active filters. A user with active filters AND selected rows will be confused about what the button does.
- **Why it matters**: Ambiguous affordance on a bulk-action bar. Accidental deselection of a carefully chosen case set is frustrating when preparing a compare or tag action.
- **Fix**: Add `t("cases.clear_selection", { defaultValue: "Clear selection" })` and use it here.
- **Cross-cuts**: Isolated to `CasesBulkActions`.

---

### F10. `NatureChart` and `SubclassChart` duplicate hardcoded magic-number colour — MEDIUM
- **Where**: `frontend/src/components/dashboard/NatureChart.tsx:22-24`, `frontend/src/components/dashboard/SubclassChart.tsx:44-47`
- **What's wrong**: `blueGradientColor()` is copy-pasted identically into both files. It uses the hardcoded RGB `26, 82, 118` (which is `#1a5276`, the AATA court colour from `tokens.json`) without referencing any token. If the AATA colour changes, these charts silently diverge.
- **Why it matters**: Violates "no magic numbers — values from tokens.json" design constraint. Duplication is a maintenance risk.
- **Fix**: Extract to a shared util (e.g. `frontend/src/lib/chart-utils.ts`) and derive the base RGB from `getCourtColor("AATA")` or a dedicated `tokens.color.chart.primary` entry.
- **Cross-cuts**: Both `NatureChart` and `SubclassChart` — identical duplication.

---

### F11. `CaseDetailPage` action bar overflows on mobile — MEDIUM
- **Where**: `frontend/src/pages/CaseDetailPage.tsx:92-129`
- **What's wrong**: `<div className="flex items-center justify-between">` holds up to 4 buttons (AustLII link, Add to Collection, Edit, Delete) with no `flex-wrap`. On viewports < ~480px the row overflows or compresses to unreadable widths.
- **Why it matters**: Self-rep applicants frequently use mobile devices. Key actions (Edit, Delete) become inaccessible at narrow widths.
- **Fix**: Add `flex-wrap gap-2` to the actions container. Also add `min-w-0` on the `<Breadcrumb>` wrapper to allow text truncation.
- **Cross-cuts**: Isolated to `CaseDetailPage`.

---

### F12. `CasesFilters` sort controls not grouped — breaks responsive flex-wrap rule — MEDIUM
- **Where**: `frontend/src/components/cases/CasesFilters.tsx:133-166`
- **What's wrong**: The sort label `<span>`, sort `<select>`, and direction `<button>` are siblings inside the outer `flex-wrap` container. On narrow screens they can each wrap independently, leaving the direction toggle button orphaned on its own line.
- **Why it matters**: CLAUDE.md documents this pattern explicitly: "separator + dropdown need to be grouped in same div to wrap together". The sort controls do not follow this grouping rule.
- **Fix**: Wrap the label `<span>`, sort `<select>`, and direction `<button>` in a single `<div className="flex items-center gap-1.5">` so they wrap atomically.
- **Cross-cuts**: Isolated to `CasesFilters`.

---

### F13. `CaseCard` navigation button has no accessible name — MEDIUM
- **Where**: `frontend/src/components/cases/CaseCard.tsx:21-86`
- **What's wrong**: The card's `<button type="button" onClick={onClick}>` has no `aria-label`. Screen readers announce it as an unlabelled button. The card title is inside the button but nested deeply inside `<h3>` — VoiceOver/TalkBack may not surface it as the button's accessible name.
- **Why it matters**: WCAG 4.1.2 — interactive elements must have accessible names. With 100 cases per page, keyboard users encounter 100 unlabelled buttons.
- **Fix**: Add `aria-label={c.title || c.citation}` to the card `<button>`.
- **Cross-cuts**: Applies to both the explicit card grid (cards view) and the mobile fallback in `CasesTable:68-77` which also renders `<CaseCard>`.

---

### F14. `SimilarCasesPanel` lacks AI-disclaimer copy — MEDIUM
- **Where**: `frontend/src/components/cases/SimilarCasesPanel.tsx:39-43`
- **What's wrong**: "Similar Cases" is presented with a `<Sparkles>` icon but no explanatory text for what "similar" means. Self-rep users may mistake AI vector-embedding proximity for legal precedent equivalence.
- **Why it matters**: For applicants under stress, misunderstanding AI-suggested similarity as legal authority could affect their case strategy. Brand pillar "Authoritative" requires accuracy disclaimers on AI-generated content.
- **Fix**: Add `<p className="mb-3 text-xs text-muted-text">{t("cases.similar_cases_subtitle", { defaultValue: "Cases with related facts or legal issues, identified by AI. Not legal advice." })}</p>`.
- **Cross-cuts**: Isolated to `SimilarCasesPanel`.

---

### F15. Copy tone: "Failed to load Dashboard" on degraded-stats state — MEDIUM
- **Where**: `frontend/src/pages/DashboardPage.tsx:670`
- **What's wrong**: When `isDegradedStats` is true, the alert uses `t("errors.failed_to_load", { name: "Dashboard" })` — "Failed to load Dashboard". This is passive-blame language for what is actually a graceful partial-data fallback.
- **Why it matters**: Brand tone is "Authoritative, Precise, Academic". "Failed" triggers disproportionate anxiety for stressed self-rep applicants. The existing `dashboard.degraded_message` text already explains the situation correctly — the title just needs to match.
- **Fix**: Use a dedicated key: `t("dashboard.degraded_title", { defaultValue: "Some data fields are loading partially" })`.
- **Cross-cuts**: Risk that other `ApiErrorState` callsites reuse generic `errors.failed_to_load` for non-critical degraded states.

---

### F16. `CasesTable` mobile-override banner lacks `role="status"` — LOW
- **Where**: `frontend/src/components/cases/CasesTable.tsx:62-67`
- **What's wrong**: When `viewMode === "table"` is chosen on mobile, the `md:hidden` banner ("Table view is optimised for larger screens…") is a static `<div>` with no `role="status"` or `aria-live`. Screen reader users who explicitly selected table view receive no feedback that the mode was overridden.
- **Why it matters**: WCAG 4.1.3 — status messages. Mode-override feedback must be perceivable without focus.
- **Fix**: Add `role="status"` to the banner `<div>`.
- **Cross-cuts**: Isolated.

---

### F17. `CaseTextViewer` search input has no accessible name — LOW
- **Where**: `frontend/src/components/cases/CaseTextViewer.tsx:377-390`
- **What's wrong**: The in-viewer search `<input>` has a `placeholder` but no `aria-label` or `<label>` association. Placeholder text is not a valid accessible name substitute (WCAG 1.3.1).
- **Why it matters**: Screen reader users cannot identify the field. Full-text search is a key power-user feature for self-rep applicants reviewing case documents.
- **Fix**: Add `aria-label={t("components.case_text_viewer.search_in_text")}` (the key already exists as the placeholder source).
- **Cross-cuts**: Isolated to `CaseTextViewer`.

---

### F18. `TextareaField` in `CaseEditPage` hardcodes `sm:col-span-2` — LOW
- **Where**: `frontend/src/pages/CaseEditPage.tsx:478`
- **What's wrong**: `TextareaField`'s root `<div>` always applies `sm:col-span-2` regardless of context. This is harmless in the 2-column grid but creates silent divergence with `CaseAddPage`, which avoids the issue by inlining its textarea (line 220-226) instead of using the shared component.
- **Why it matters**: Maintenance trap — the two form pages have diverged. Adding a new textarea in `CaseAddPage` via the shared component would unexpectedly span 2 columns.
- **Fix**: Add `span2?: boolean` prop to `TextareaField` (matching `Field`'s existing pattern) and remove the hardcoded `sm:col-span-2`. Callers opt in explicitly.
- **Cross-cuts**: `CaseAddPage` inline textarea is de-facto exempt. Fix brings them into alignment.

---

### F19. `DashboardPage` "Recent Cases" button missing `type="button"` — LOW
- **Where**: `frontend/src/pages/DashboardPage.tsx:1220`
- **What's wrong**: `<button key={c.case_id} onClick={() => navigate(...)}>` has no `type` attribute. Lower risk than F6 since it is not adjacent to a `<form>`, but inconsistent with project convention.
- **Why it matters**: Consistency with the rest of the D1 codebase; minor accessibility concern.
- **Fix**: Add `type="button"`.
- **Cross-cuts**: Isolated.

---

### F20. `CaseAddPage` inline `duration-200` magic number for chevron animation — LOW
- **Where**: `frontend/src/pages/CaseAddPage.tsx:176`
- **What's wrong**: `transition-transform duration-200` uses an inline Tailwind duration value not referenced in `tokens.json`. The project's token system defines colours, spacing, and radius but no transition-duration token.
- **Why it matters**: Minor — if standard animation speed changes in a future design pass, this ad-hoc value will be missed.
- **Fix**: Document the value as intentional, or add `--duration-fast: 200ms` to `tokens.css` and replace with `transition-transform [duration:var(--duration-fast)]`.
- **Cross-cuts**: Isolated.

---

## Patterns observed

- **consistent**: All 5 Recharts Tooltip `contentStyle` objects include `color: "var(--color-text)"` — dark-mode text gotcha correctly avoided throughout. `keepPreviousData` used in `useCases` and `useStats` hooks — filter navigation flash prevented. `.toSorted()` used throughout; no `.sort()` mutations found. `localStorage` access in state initializers and toggle handlers is inside `try/catch` — compliant across all D1 pages. `<CourtBadge>` used uniformly across all pages and table/card components. `<PageHeader>` used in 5 of 6 pages. `ApiErrorState` used consistently for error states. `ConfirmModal` used for destructive actions in `CasesPage` and `CaseDetailPage`.
- **inconsistent**: `type="button"` — present on most buttons, absent on `CaseDetailPage` delete, all `CaseTextViewer` toolbar buttons, `AddToCollectionMenu` buttons, `DashboardPage` recent-case buttons. `animate-spin` — correctly on `<div>` wrapper in `LlmCouncilPage` / `PipelinePage` / `DownloadPage`; incorrectly on SVG in `PageLoader` and `DashboardPage` loading state. `PageHeader` — present in 5/6 pages, absent in `CaseComparePage`. Native dialogs — `ConfirmModal` / `TagInputModal` used in cases/detail, but `window.confirm` and `prompt()` still used in dashboard and detail respectively. `blueGradientColor()` — identical function duplicated in `NatureChart` and `SubclassChart`.
- **missing**: Accessible names on `CaseCard` navigation buttons and `CaseTextViewer` search input. `role="status"` on mobile-table-override banner. AI-disclaimer subtitle on `SimilarCasesPanel`. `PageHeader` on `CaseComparePage`. Styled modal replacement for `prompt()` in `AddToCollectionMenu`. Diff-aware background on `CaseComparePage` sticky label cell. Dedicated `cases.case_id` i18n key (currently reusing `cases.title`).

---

## Open questions for lead

1. **`SimilarCasesPanel` disclaimer depth**: Should "similar" carry a tooltip/info icon or a subtitle? What tone do legal reviewers want — "not legal advice" or something softer?
2. **`CaseDetailPage` mobile action bar**: Should secondary actions (Add to Collection, Edit) collapse into a `...` overflow menu on mobile, or is `flex-wrap` sufficient?
3. **`NatureChart` / `SubclassChart` colour intent**: Is the hardcoded `rgba(26, 82, 118, ...)` gradient tying chart colours to the AATA court hue intentional brand choice or incidental? If intentional, should it be formalised as `tokens.color.chart.primary`?
4. **`CaseComparePage` empty state breadcrumb**: When < 2 IDs are supplied, the page renders `EmptyState` without a `Breadcrumb` — acceptable UX or should breadcrumb always be present?
5. **Degraded-stats copy ownership**: Does changing the title for the degraded banner require a new `dashboard.degraded_title` key, or can the existing generic `errors.failed_to_load` be safely repurposed here without affecting other callsites?

---

## Files inspected (relative paths)

- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/pages/CasesPage.tsx`
- `frontend/src/pages/CaseDetailPage.tsx`
- `frontend/src/pages/CaseEditPage.tsx`
- `frontend/src/pages/CaseAddPage.tsx`
- `frontend/src/pages/CaseComparePage.tsx`
- `frontend/src/components/cases/CaseCard.tsx`
- `frontend/src/components/cases/CasesTable.tsx`
- `frontend/src/components/cases/CasesFilters.tsx`
- `frontend/src/components/cases/CasesBulkActions.tsx`
- `frontend/src/components/cases/CaseTextViewer.tsx`
- `frontend/src/components/cases/SimilarCasesPanel.tsx`
- `frontend/src/components/dashboard/StatCard.tsx`
- `frontend/src/components/dashboard/CourtChart.tsx`
- `frontend/src/components/dashboard/NatureChart.tsx`
- `frontend/src/components/dashboard/SubclassChart.tsx`
- `frontend/src/components/dashboard/TrendChart.tsx`
- `frontend/src/components/dashboard/CourtSparklineGrid.tsx`
- `frontend/src/tokens/tokens.ts` (partial)
- `frontend/src/hooks/use-cases.ts` (grep)
- `frontend/src/hooks/use-stats.ts` (grep)
