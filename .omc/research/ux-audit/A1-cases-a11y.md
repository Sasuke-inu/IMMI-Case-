# UX Audit — A1: Cases primary flow (WCAG 2.2 AA)
**Worker**: a11y-architect | **Scope**: 6 pages + cases/dashboard components | **Date**: 2026-05-05

## TL;DR
- Form fields in CaseAdd/CaseEdit lack `htmlFor`/`id` association and `aria-describedby` for errors — toast-only validation is invisible to AT.
- ConfirmModal lacks `role="dialog"` / `aria-modal` / focus trap and inert background — keyboard users tab into hidden page content.
- CourtBadge, OutcomeBadge, NatureBadge convey state by colour only and use `title` (not AT-announced) — fails 1.4.1 and 1.3.3.

## Findings

### F1. Form labels are not programmatically associated with inputs — [BLOCKING]
- **Where**: `frontend/src/pages/CaseEditPage.tsx:411-422, 439-446, 477-487`; `frontend/src/pages/CaseAddPage.tsx:286-303, 320-336`
- **What's wrong**: `<label>` has no `htmlFor`; `<input>`/`<select>`/`<textarea>` have no `id`. Implicit nesting is also absent (label is sibling, not parent). Fails **WCAG 1.3.1 Info and Relationships, 4.1.2 Name/Role/Value, 3.3.2 Labels or Instructions**.
- **Why it matters**: Screen readers announce "edit text, blank" with no field name; switch users cannot click the label to focus.
- **Fix**: Generate a stable `id` (`useId()`), set `htmlFor={id}` on label and `id={id}` on the control.
- **Cross-cuts**: Repeats in every form page (`SaveSearchModal`, `TagInputModal`, `CasesFilters` selects use `aria-label` only — acceptable but inconsistent).

### F2. Validation errors are toast-only, not associated with the field — [BLOCKING]
- **Where**: `CaseAddPage.tsx:46-55` (title required, citation regex); `CaseEditPage.tsx:160-178` (title required)
- **What's wrong**: Errors fire `toast.error()` without `aria-invalid`, `aria-describedby`, or inline error text. Toast (Sonner) is a transient region — the offending field is never marked. Fails **WCAG 3.3.1 Error Identification, 3.3.3 Error Suggestion, 1.3.1**.
- **Why it matters**: A blind user submitting an empty form hears the toast read once then silence; they cannot find the broken field.
- **Fix**: Add inline `<p id="title-err" role="alert">` under each field on error, set `aria-invalid={true}` and `aria-describedby="title-err"` on the input, and move focus to first invalid field.
- **Cross-cuts**: same pattern in CasesPage save-search and any future form.

### F3. ConfirmModal is not a real dialog (no role, no focus trap, no inert background) — [BLOCKING]
- **Where**: `frontend/src/components/shared/ConfirmModal.tsx:44-83`
- **What's wrong**: Outer `<div>` lacks `role="dialog"`, `aria-modal="true"`, `aria-labelledby` (pointing at the `<h3>`), and `aria-describedby` (pointing at message). Tab key escapes the modal into the page behind it (no focus trap). The backdrop `<div onClick>` is not announced and the page beneath is not `inert`/`aria-hidden`. Fails **WCAG 2.1.2 No Keyboard Trap (inverse — focus leaks), 4.1.2, 2.4.3 Focus Order, 1.3.1**.
- **Why it matters**: Screen reader users hear background page content while a destructive "Delete cases" prompt is open — they may confirm without realising.
- **Fix**: Wrap with `role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={msgId}`, install a focus-trap (e.g. `focus-trap-react` or hand-roll using Tab cycling), set `aria-hidden`/`inert` on app root, and restore focus to the trigger element on close.
- **Cross-cuts**: `TagInputModal`, `SaveSearchModal`, `AddToCollectionMenu` dropdown (`CaseDetailPage.tsx:425-469`) all share this gap.

### F4. `window.confirm` and `window.prompt` used for destructive flows — [HIGH]
- **Where**: `DashboardPage.tsx:1199-1204` (delete saved search); `CaseDetailPage.tsx:407` (`prompt()` for new collection name)
- **What's wrong**: Native dialogs cannot be styled, may not respect dark mode, and are inconsistent with the in-app ConfirmModal. Browsers can suppress them, removing the safety net. Fails **3.2.4 Consistent Identification** and is a usability/cognitive-load risk for stressed self-rep applicants.
- **Why it matters**: A confused user clicking through native browser chrome under pressure may double-confirm without reading.
- **Fix**: Replace with the (fixed) `ConfirmModal` and a styled in-app input modal.
- **Cross-cuts**: audit other `window.confirm`/`window.prompt` usages.

### F5. Court / Outcome / Nature badges encode meaning by colour only — [HIGH]
- **Where**: `frontend/src/components/shared/CourtBadge.tsx:32-48`; `OutcomeBadge.tsx:104-115`; `NatureBadge.tsx:38-49`
- **What's wrong**: CourtBadge shows abbreviation text but **the full name is in `title=` only** — `title` is unreliable for screen readers and hidden from keyboard users. OutcomeBadge uses red vs green (positive/negative) but no icon or text marker. Fails **WCAG 1.4.1 Use of Color, 1.3.3 Sensory Characteristics, 1.1.1 Non-text Content** (when icon-only on small breakpoints).
- **Why it matters**: Colour-blind users cannot distinguish "Allowed" (green) from "Refused" (red) at a glance, and keyboard users never see the court's full name.
- **Fix**: Add a leading text suffix or icon: e.g. "✓ Allowed" / "✗ Refused"; expose full court name via `aria-label` (not `title`); render full name as a tooltip-on-focus, not just hover.
- **Cross-cuts**: every list/card/table in the app.

### F6. Whole-row click handler with `tabIndex=0` but no `role="button"` and dangerous Space-key — [HIGH]
- **Where**: `frontend/src/components/cases/CasesTable.tsx:122-144`
- **What's wrong**: `<tr tabIndex={0} onKeyDown=… onClick=…>` makes every row focusable but has no `role` (defaults to `row`, not actionable). Space normally toggles checkbox in a data table — handler hijacks it to navigate. There is also a **nested `<Link>` overlay (line 149-154) PLUS a separate `<input type=checkbox>`** inside the same `<td>` — produces two focusable widgets stacked, with the link given `tabIndex={-1}` so AT cannot reach the link path; relies on row click. Fails **WCAG 2.1.1 Keyboard, 4.1.2, 2.4.3**.
- **Why it matters**: Screen reader users in browse mode hear "row" but not "button"; they cannot predict Enter opens the case. Selecting via checkbox with Space accidentally navigates away.
- **Fix**: Either (a) make the citation cell a real `<a>`/`<Link>` and remove `tabIndex` on the row, or (b) `role="link"` on the row, drop the Space handler, and keep the checkbox in a separate, isolated focus stop.
- **Cross-cuts**: dashboard "Recent cases" buttons (`DashboardPage.tsx:1219-1236`) work, but court-distribution table view rows are anchors styled as rows — fine.

### F7. Loading / fetching states are not announced to AT — [HIGH]
- **Where**: `CasesPage.tsx:520` (`<PageLoader/>`); `DashboardPage.tsx:826-831` ("Refreshing…" badge); `PageLoader.tsx:5-19`
- **What's wrong**: `PageLoader` and the "refreshing" pill are visible-only — no `role="status"` / `aria-live="polite"`. Loader spinner has `animate-spin` but no `aria-label`. Fails **WCAG 4.1.3 Status Messages**.
- **Why it matters**: AT users hear nothing while the page is fetching 100 records; they assume the click did nothing.
- **Fix**: Add `role="status" aria-live="polite"` to `PageLoader` outer container; add an `aria-label` to the `LoaderCircle`. Add `<span className="sr-only" aria-live="polite">{isFetching ? "Refreshing data…" : ""}</span>` near the page header.
- **Cross-cuts**: Dashboard `isFetching` indicator and all `PageLoader` consumers.

### F8. Data-load errors not in a live region — [HIGH]
- **Where**: `ApiErrorState.tsx:11-37`; `DashboardPage.tsx:661-678` has `role="alert"` (good) but `ApiErrorState` does not.
- **What's wrong**: `StatePanel` rendered with tone="error" has no `role="alert"` / `aria-live="assertive"`. Fails **WCAG 4.1.3**.
- **Why it matters**: Users on slow connections do not know fetch failed; retry button is silent.
- **Fix**: Add `role="alert"` (or wrap in a div with `role="alert"`) on the `ApiErrorState` outer.
- **Cross-cuts**: every page using `ApiErrorState` (CasesPage, CaseEditPage, CaseComparePage, DashboardPage error branch).

### F9. Save-success / delete-success are toast-only — [HIGH]
- **Where**: `CaseEditPage.tsx:168` (`toast.success`); `CaseAddPage.tsx:58`; `CaseDetailPage.tsx:64`; `CasesPage.tsx:126`
- **What's wrong**: Sonner toasts default to `role="status"` but disappear in 4s; no persistent confirmation in-page. There is no `aria-live` summary message in the form region. Fails best practice for **WCAG 4.1.3** and **3.3.1** when combined with redirect (user is whisked to detail page before the toast finishes reading).
- **Why it matters**: Screen reader users miss the "Saved" announcement when navigation interrupts the toast.
- **Fix**: Either delay navigation, render a persistent `<div role="status">` before navigating, or pass a flash message into the destination page that announces on mount.
- **Cross-cuts**: every mutation flow in the app.

### F10. Heading hierarchy skips and duplicates — [HIGH]
- **Where**: `DashboardPage.tsx:300, 689, 845, 901, 911, 1013, 1022, 1049, 1160, 1215`; `CaseDetailPage.tsx:179, 243, 255, 280, 320` (no `h1` — `PageHeader` `h1` is inside the metadata card on line 138)
- **What's wrong**: DashboardPage has many sibling `<h2>` but Section 02 has nested `<h2>` for both the section header AND each panel ("Cases by court") — two `<h2>` in the same parent compete. CaseDetailPage's `h1` is rendered as `PageHeader` inside the meta card; outer breadcrumb is the first focusable element but there is no clear `h1` outline structure. Fails **WCAG 1.3.1, 2.4.6 Headings and Labels, 2.4.10 Section Headings**.
- **Why it matters**: AT users navigating by heading hop skip context (they hear "Cases by court" at h2 but cannot tell it is *inside* "Section 02 — Distribution").
- **Fix**: Section panels should be `<h3>`; one `<h1>` per page (always at the top); ensure breadcrumb is `<nav aria-label="Breadcrumb">` and not a heading.
- **Cross-cuts**: all detail pages.

### F11. Sort buttons in `CasesFilters` have no `aria-sort` — [HIGH]
- **Where**: `CasesFilters.tsx:148-165` (sort direction toggle); `CasesTable.tsx:80-119` (column headers are `<th>` but not interactive)
- **What's wrong**: Sort is controlled outside the table via a separate `<select>` + toggle button. Users cannot identify the active sort column from the table itself. Column `<th>` has no `scope="col"` (browsers infer for simple tables but explicit is recommended) and no `aria-sort`. Fails **WCAG 1.3.1, 4.1.2** for table semantics.
- **Why it matters**: Sighted users see the up/down arrow on the toggle, but AT users cannot map "sort_by=date desc" onto the Date column.
- **Fix**: Add `scope="col"` to all `<th>`. When a column is sortable, render the `<th>` as a `<button>` inside with `aria-sort="ascending|descending|none"` on the `<th>`.
- **Cross-cuts**: CaseComparePage table headers (line 121-148) also missing `scope`.

### F12. Pagination announcement missing live region for page change — [MEDIUM]
- **Where**: `Pagination.tsx:13-94`
- **What's wrong**: Buttons have good `aria-label` and `aria-current="page"` (good). But page-change is silent — no `aria-live` summary "Showing 101–200 of 149,016". The "Showing X–Y of Z" `<p>` is not in a live region.
- **Why it matters**: After clicking "Next", AT users do not know the new range loaded.
- **Fix**: Wrap the `<p>` in `aria-live="polite"`, or fire a status message on page change.
- **Cross-cuts**: any list page.

### F13. Comparison table cells do not associate with their column header by name — [MEDIUM]
- **Where**: `CaseComparePage.tsx:120-148, 161-191`
- **What's wrong**: First-column row labels are `<td>` with `font-medium` styling (line 161) — should be `<th scope="row">`. Column headers use `<th>` without `scope="col"`. Without `scope`, complex table semantics break for AT in browse mode. The `bg-warning/5` "differs" indicator uses colour + tiny "(differs)" text; "(differs)" is in `text-warning` `[10px]` — colour-only emphasis. Fails **WCAG 1.3.1, 1.4.1**.
- **Why it matters**: Screen reader users cannot answer "what is the *outcome* of case X?" — the row label is not announced when reading a cell.
- **Fix**: Use `<th scope="row">` for label column and `<th scope="col">` for case columns; replace "(differs)" text with a non-colour marker like " — differs from others".

### F14. Filter pill remove buttons announce as unlabeled "X" — [MEDIUM]
- **Where**: `CasesPage.tsx:470-477` (FilterPill usage)
- **What's wrong**: `<FilterPill onRemove…>` pattern likely renders an X icon-button without `aria-label="Remove {label} filter"`.
- **Why it matters**: AT user hears just "Court Federal Court ✕ button" with no clue what ✕ does.
- **Fix**: Verify FilterPill renders `aria-label={t("filters.remove_pill", {label, value})}` on the icon button.

### F15. Loading skeleton does not set `aria-busy` on the parent region — [MEDIUM]
- **Where**: `CasesPage.tsx:520`; `PageLoader.tsx`
- **What's wrong**: When filters change, `PageLoader` is shown with no ARIA loading message. With `keepPreviousData`, the table behind is "stale" but AT does not know.
- **Why it matters**: Cognitive load — stressed users may double-click expecting nothing happened.
- **Fix**: Add `aria-busy="true"` on the table parent while `isFetching`.

### F16. Keyboard shortcuts collide with browser defaults — [MEDIUM]
- **Where**: `CasesPage.tsx:230-255` (`/`, `a`); `CasesPage.tsx:258-290` (`j`, `k`, `Enter`, `x`); `CaseDetailPage.tsx:47-58` (`e`)
- **What's wrong**: Single-letter shortcuts on `document` violate **WCAG 2.1.4 Character Key Shortcuts** unless they (a) can be turned off, (b) can be remapped, or (c) are only active when component is focused. Currently they fire whenever the document has focus and the target is not an `INPUT/SELECT/TEXTAREA` — they will fire when focus is on a `<button>` or a `<tr tabIndex=0>`.
- **Why it matters**: Voice control users dictating "edit my notes" trigger `e` → unwanted navigation; switch users hitting Tab + activate may accidentally fire.
- **Fix**: Add a settings toggle to disable shortcuts, OR require modifier (Alt/Ctrl), OR scope to focused container only. Document shortcuts in a `<dialog>` opened via `?`.

### F17. Modal focus is not restored to trigger on close — [MEDIUM]
- **Where**: `ConfirmModal.tsx:27-29`
- **What's wrong**: On open, focus moves to cancel button (good). On close, no `useEffect` restores focus to the element that opened it. Fails **WCAG 2.4.3 Focus Order, 3.2.1 On Focus**.
- **Why it matters**: After deleting, focus dumps to `<body>` and user must tab from the start.
- **Fix**: Capture `document.activeElement` on open; on unmount call `el.focus()`.
- **Cross-cuts**: TagInputModal, SaveSearchModal, AddToCollectionMenu.

### F18. Touch target size below 24x24 CSS px — [MEDIUM]
- **Where**: `DashboardPage.tsx:919-955` (chart/table view toggle: `p-1` icon-only); `CasesPage.tsx:375-417` (view-mode toggles `p-1.5`); `CaseTextViewer.tsx:396-417` (search nav arrows `p-0.5`); `Pagination.tsx:35-47` (`p-1.5` chevrons)
- **What's wrong**: With `h-3.5 w-3.5` icon and `p-0.5`/`p-1`, total target ≈ 14-22px. Fails **WCAG 2.5.8 Target Size (Minimum) — 24×24 CSS px**.
- **Why it matters**: Users with motor impairments or on touch devices misclick; especially the dashboard view toggles which are tiny squares 4 px apart.
- **Fix**: Bump to `p-2` (≥ 24×24) or wrap in a larger hit area; ensure 4 px spacing between adjacent targets.

### F19. Focus indicator may fail 3:1 contrast and is missing on many buttons — [MEDIUM]
- **Where**: form inputs in `CaseEditPage.tsx:420`, `CaseAddPage.tsx:302`, etc. — `focus:ring-1 focus:ring-accent`; CourtBadge / CaseCard / dashboard quick action buttons rely on default browser outline only.
- **What's wrong**: A 1px `ring-accent` (Crimson amber) on dark surface borderline; on the warm-cream Legal Codex mode the amber-on-amber-tint fails. Buttons missing `focus-visible` styling. Fails **WCAG 2.4.7 Focus Visible** and risks **2.4.11 Focus Not Obscured (Minimum)** / **2.4.13 Focus Appearance**.
- **Why it matters**: Keyboard users lose track of focus position on the cards grid.
- **Fix**: Add a global `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent` on every interactive class; verify 3:1 contrast in both themes.

### F20. Form inputs missing `autocomplete` attributes — [MEDIUM]
- **Where**: `CaseAddPage.tsx:296`, `CaseEditPage.tsx:415` and all `Field`/`TextareaField` instances
- **What's wrong**: No `autocomplete="off"` (case data is not personal) or autocomplete tokens. Fails **WCAG 1.3.5 Identify Input Purpose** when an applicant_name / country_of_origin field is editable.
- **Why it matters**: Self-rep users entering many cases lose autofill helpers; cognitive-disability users lose memory aids.
- **Fix**: Add `autoComplete="off"` to admin fields, `autoComplete="country-name"` to country fields, `autoComplete="name"` to applicant_name where appropriate.

### F21. Reduced-motion not respected — [MEDIUM]
- **Where**: `CaseCard.tsx:24` (`hover:-translate-y-0.5`); `CaseDetailPage.tsx:135-140`; `DashboardPage.tsx:1080` (transitions); spinning loaders use `animate-spin` everywhere
- **What's wrong**: No `motion-reduce:` Tailwind variant guards on translate/scale animations. Fails **WCAG 2.3.3 Animation from Interactions** (AAA) and best practice for **2.3.1**.
- **Why it matters**: Vestibular-disorder users get nausea from card lift on hover.
- **Fix**: Add `motion-reduce:transform-none motion-reduce:transition-none` to hover transforms.

### F22. Recent cases buttons truncate critical content with no aria-label — [MEDIUM]
- **Where**: `DashboardPage.tsx:1219-1236`
- **What's wrong**: `<button>` containing `<span class="truncate">` cuts off citation/title with no `aria-label` of full text. Title is in `title=` attribute (not announced).
- **Why it matters**: AT user hears half a citation.
- **Fix**: Add `aria-label={c.title || c.citation}` on the `<button>`.

### F23. Source-status badges (raw/fallback/empty) are colour + jargon, no AT explanation — [LOW]
- **Where**: `DashboardPage.tsx:914-916, 985-987, 1027-1029, 1054-1056`; `getSourceBadgeClass` line 101-109
- **What's wrong**: Colour-coded pills "raw / fallback / empty" with no `aria-label` explaining meaning to applicants who do not know the term.
- **Why it matters**: Cognitive overload: a non-technical applicant cannot decode "raw vs fallback".
- **Fix**: Use plainer language ("Live data" / "Estimated" / "No data") and add a tooltip-on-focus.

### F24. Dropdown menu (`AddToCollectionMenu`) is not a real menu — [LOW]
- **Where**: `CaseDetailPage.tsx:425-469`
- **What's wrong**: `<div>` with toggling `<div>` panel; no `role="menu"`, no `aria-haspopup`, no arrow-key navigation, click-outside but no Escape handler.
- **Why it matters**: Keyboard users cannot navigate items with arrows; screen reader users hear "button" then unstructured text.
- **Fix**: Use a headless menu primitive (Radix `DropdownMenu`) or implement ARIA Authoring Practices menu pattern.

### F25. Tag pills (`legal_concepts`) lack contextual aria-label — [LOW]
- **Where**: `CaseDetailPage.tsx:259-271`
- **What's wrong**: Anchor's accessible name is just the concept word; AT user has no context "filter by legal concept …".
- **Fix**: Add `aria-label="Filter cases by legal concept: {trimmed}"`.

### F26. CaseTextViewer search input lacks visible label — [LOW]
- **Where**: `CaseTextViewer.tsx:377-390`
- **What's wrong**: `<input placeholder=…>` only — no associated `<label>`. Placeholder is not a label (WCAG 3.3.2). The `<Search>` icon has no `aria-hidden`.
- **Fix**: Add an `aria-label={t("…search_in_text")}` and `aria-hidden="true"` on icon.

### F27. Disclaimer text uses 10px on muted-text/60 — likely contrast fail — [LOW]
- **Where**: `DashboardPage.tsx:1252-1259`
- **What's wrong**: `text-[10px]` and `text-muted-text/60` (muted at 60% alpha) — almost certainly fails **WCAG 1.4.3 Contrast Minimum (4.5:1)** for body text.
- **Why it matters**: Disclaimer is *legally* important ("not legal advice") for applicants.
- **Fix**: Bump to ≥ 12px / `text-xs`, drop the alpha to `/100`, verify 4.5:1.

### F28. CaseEditPage required asterisk is decorative-only — [LOW]
- **Where**: `CaseEditPage.tsx:209` (label is `${t("cases.case_title")} *`)
- **What's wrong**: `*` is a glyph, not announced as "required". `<input>` lacks `required` and `aria-required="true"`.
- **Fix**: Add `required aria-required="true"` and inline help text "Required" with `aria-describedby`.

### F29. Skip-to-content link present (good) but section landmarks lack `aria-labelledby` — [LOW]
- **Where**: `AppLayout.tsx:26-29` has skip-to `#main-content` (good); pages do not use `<main>`/`<section aria-labelledby>` consistently.
- **What's wrong**: Sections in DashboardPage are `<section>` (good, line 682, 839, 895, 1007) but no `aria-labelledby` linking to the heading id; CaseDetailPage uses `<div>` not `<section>` for major regions. Fails **WCAG 1.3.1, 2.4.1 Bypass Blocks** (best practice).
- **Fix**: Give each `<section>` an `aria-labelledby={headingId}`; promote major card regions in CaseDetailPage to `<section>` with the same.

### F30. Court-only data `lang` semantics — [LOW]
- **Where**: `CasesTable.tsx:219-221` (country_of_origin); various countries may need `lang` if non-English names render.
- **Fix**: For non-English content render with `lang="…"`. Likely minor for the current dataset.

## Patterns observed
- **Consistent**: every page uses `useTranslation` with `defaultValue` fallbacks (good for i18n contract). `aria-label` used consistently on icon-only filter selects.
- **Inconsistent**: form inputs sometimes use `aria-label` (filters), sometimes `<label>` sibling (forms). Modals split between in-app and `window.confirm`/`prompt`. Heading levels jump from h2 to h2 inside section panels.
- **Missing across the board**: focus-visible styling, focus restoration on modal close, live regions for status/error/loading, `aria-sort`, `aria-busy`, `<th scope>`, `htmlFor`/`id`, inline error messages, motion-reduce guards.

## Open questions for lead
1. Is the toast library (Sonner) configured with a polite live region? If yes, F2/F9 partly mitigated for sighted SR users — but redirects still cut announcements off.
2. Are the design tokens for `accent`, `danger`, `success`, and `bg-court-*` audited for 3:1 against `bg-card` in BOTH light and dark? CourtBadge white text on court-tinted backgrounds needs a separate contrast pass.
3. Is there a baseline a11y test in `tests/e2e/react/` (axe-core) we should extend, or do we author one fresh?
4. Cases table row currently has `tabIndex=0` + `<Link>` overlay + checkbox — design intent? Should we drop the row tabIndex and make citation cell the focus target instead?
5. Compliance target: are we shipping AS EN 301 549 (Australian gov procurement) Level AA or just WCAG 2.2 AA? AS EN 301 549 references AAA Focus Appearance.
6. Want me to flag which AAAs to also adopt for the at-risk audience (1.4.6 Contrast Enhanced, 2.3.3 Animation, 3.3.5 Help)?

## Files inspected
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/pages/DashboardPage.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/pages/CasesPage.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/pages/CaseDetailPage.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/pages/CaseEditPage.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/pages/CaseAddPage.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/pages/CaseComparePage.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/cases/CasesTable.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/cases/CasesFilters.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/cases/CasesBulkActions.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/cases/CaseCard.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/cases/CaseTextViewer.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/dashboard/StatCard.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/shared/ConfirmModal.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/shared/CourtBadge.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/shared/OutcomeBadge.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/shared/NatureBadge.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/shared/Pagination.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/shared/EmptyState.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/shared/ApiErrorState.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/shared/StatePanel.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/shared/PageLoader.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/shared/PageHeader.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/shared/Breadcrumb.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/layout/AppLayout.tsx`
