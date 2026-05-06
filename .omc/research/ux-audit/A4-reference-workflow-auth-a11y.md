# UX Audit — A4: Reference + Workflow + Auth (WCAG 2.2 AA)
**Worker**: a11y-architect | **Scope**: 12 pages + 4 component dirs | **Date**: 2026-05-05

## TL;DR
- Auth surface is exposed: `LoginPage` lacks `<main>` landmark, `TelegramLoginButton` is a third-party iframe with no labelled context for AT, and login errors are not announced live.
- Long-running workflows (Pipeline / JobStatus / Legislations update / LLM Council) all visualise progress with bars and percentages but **none use `role="progressbar"` or `aria-live`** — AT users get zero feedback. Largest pattern-level gap.
- Modals (`CollectionEditor`, `ConfirmModal` via `SessionListItem`) lack proper dialog semantics — no `role="dialog"`, `aria-modal`, or focus trap. Combined with missing root `lang="en-AU"` and invalid nested interactives, these break WCAG 2.2 AA across reference, workflow, and auth surfaces.

## Findings

### F1. TelegramLoginButton has no accessible context or fallback — [BLOCKING]
- **Where**: `frontend/src/components/auth/TelegramLoginButton.tsx:38-60`; `frontend/src/pages/LoginPage.tsx:40-46`
- **What's wrong**: Component renders `<div ref={ref} />` and injects a Telegram `<script>` whose iframe contains the only sign-in control. The wrapper has no `role`, `aria-label`, `aria-busy`, or fallback text. While loading there is no perceivable element for AT; after load, the iframe's accessible name comes from a third-party origin the page cannot guarantee. Violates **WCAG 2.2 SC 1.3.1**, **SC 4.1.2 Name, Role, Value**, **SC 2.4.6 Headings and Labels**.
- **Why it matters**: Login is the gate to saved-state features. A blind user landing on `/login` hears the page heading then silence.
- **Fix**: Wrap placeholder with `role="region" aria-label aria-busy={!loaded}`; add visible `<noscript>` fallback text with alternative-auth contact info (DDA 1992 expects equally accessible alternative).
- **Cross-cuts**: Multi-tenant auth, CSP, i18n.

### F2. Login error is not announced to screen readers — [HIGH]
- **Where**: `frontend/src/pages/LoginPage.tsx:35-39`
- **What's wrong**: `loginError` renders an inline `<div>` with no `role="alert"` or `aria-live`. Sighted users see a red banner; AT users don't. Violates **SC 4.1.3 Status Messages**, **SC 3.3.1 Error Identification**.
- **Fix**: Add `role="alert" aria-live="assertive"`; prepend "Login failed:" so AT announces context. Move focus to the error region on appearance.
- **Cross-cuts**: All inline error banners across pages share this antipattern.

### F3. LoginPage missing landmark; root `lang` too generic — [HIGH]
- **Where**: `frontend/src/pages/LoginPage.tsx:25-54`; `frontend/index.html:2`
- **What's wrong**: Page wraps content in generic `<div>` — no `<main>`. Root `<html lang="en">` is generic; AU legal content needs `lang="en-AU"` so SR uses AU pronunciation. Violates **SC 1.3.1**, **SC 3.1.1 Language of Page**, **SC 2.4.1 Bypass Blocks**.
- **Fix**: Wrap LoginPage body in `<main>`. Update `index.html` to `<html lang="en-AU">` (sync via i18next-http-backend if multi-lang).

### F4. Workflow progress bars lack `role="progressbar"` and live announcements — [BLOCKING]
- **Where**:
  - `frontend/src/pages/PipelinePage.tsx:432-438` (overall progress)
  - `frontend/src/pages/JobStatusPage.tsx:228-234` (job progress)
  - `frontend/src/pages/DownloadPage.tsx:91-98` (`ProgressRing`)
  - `frontend/src/pages/LegislationsPage.tsx:219-226` (scrape progress)
- **What's wrong**: All four use plain `<div>` with `style.width`. None expose `role="progressbar"`, `aria-valuenow/min/max/text`, or wrap regions in `aria-live="polite"`. Phase changes ("crawl"→"clean"→"download") and percentage updates are silent. Violates **SC 4.1.2**, **SC 4.1.3**, **SC 1.3.1**.
- **Why it matters**: Longest-running operations in the app (download up to 12 min). Blind users get no feedback.
- **Fix**: Apply `role="progressbar" aria-valuenow={n} aria-valuemin={0} aria-valuemax={100} aria-valuetext={...} aria-label={...}` to each bar. Wrap surrounding monitor in `<section aria-live="polite" aria-atomic="false">`. Push completion toast.
- **Cross-cuts**: Sonner toaster live-region config (see F22).

### F5. CollectionEditor modal has no dialog semantics or focus trap — [BLOCKING]
- **Where**: `frontend/src/components/collections/CollectionEditor.tsx:115-256`
- **What's wrong**: Backdrop `<div className="fixed inset-0">` with `onClick={onCancel}` has no `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and no focus trap — Tab moves into background. Backdrop dismiss is mouse-only. Violates **SC 2.1.2 No Keyboard Trap (inverse — modal needs trap)**, **SC 4.1.2**, **SC 2.4.3 Focus Order**, **SC 1.3.1**.
- **Fix**: Adopt Radix `Dialog` / Headless UI `Dialog` (handles focus trap, restore-focus, inert background). Minimum: `role="dialog" aria-modal="true" aria-labelledby="collection-editor-title"`.
- **Cross-cuts**: `ConfirmModal` (used by `SessionListItem.tsx:121`, `CollectionDetailPage.tsx:292`) likely shares the defect.

### F6. CollectionEditor color swatches and tag remove lack proper labels/state — [HIGH]
- **Where**: `frontend/src/components/collections/CollectionEditor.tsx:211-233, 187-193`
- **What's wrong**: Color swatches use `aria-label={c}` ("blue", "amber") with no "color" qualifier. Selected state via `ring-2` only — no `aria-pressed`/`aria-checked`. Tag remove X has no `aria-label`. Violates **SC 4.1.2**, **SC 1.4.1 Use of Color**.
- **Fix**: Wrap swatches in `role="radiogroup"`; each `role="radio" aria-checked={color===c} aria-label="Blue colour"`. Tag X gets `aria-label={t('bookmarks.remove_tag', { tag })}`.

### F7. CollectionEditor inputs lack programmatic label association — [MEDIUM]
- **Where**: `frontend/src/components/collections/CollectionEditor.tsx:140-203`
- **What's wrong**: `<label>` has no `htmlFor`; inputs have no `id`. Click-on-label doesn't focus input. Violates **SC 1.3.1**, **SC 3.3.2 Labels or Instructions**.
- **Fix**: Pair `id` and `htmlFor`. Same antipattern: `LlmCouncilPage.tsx:69-104`, `DownloadPage.tsx:137-167`, `PipelinePage.tsx:340-381`.

### F8. SortableCaseItem drag has no announce protocol or non-drag alt — [HIGH]
- **Where**: `frontend/src/components/collections/SortableCaseItem.tsx:57-65`; `frontend/src/pages/CollectionDetailPage.tsx:59-64`
- **What's wrong**: dnd-kit `KeyboardSensor` is wired (good) and handle has `aria-label="Drag to reorder"`, but `<DndContext>` is not configured with `accessibility.announcements` / `screenReaderInstructions` — users get only generic dnd-kit defaults. No move-up/move-down buttons exist for users who cannot drag. Violates **SC 4.1.3**, **SC 2.5.7 Dragging Movements**.
- **Fix**: Pass `accessibility={{ announcements: { onDragStart, onDragOver, onDragEnd, onDragCancel }, screenReaderInstructions }}` with i18n strings; add visible "Move up" / "Move down" buttons.

### F9. SessionListItem delete button is opacity-0 by default — [HIGH]
- **Where**: `frontend/src/components/llm-council/SessionListItem.tsx:108-118`
- **What's wrong**: Button is `opacity-0 group-hover:opacity-100 focus-visible:opacity-100`. Touch and SR users cannot easily discover destructive actions. Violates **SC 1.4.13 Content on Hover or Focus** and the spirit of **SC 2.4.7 Focus Visible** under touch zoom.
- **Fix**: Either (a) `opacity-40 hover:opacity-100` so always discoverable, or (b) add a per-row "More actions" menu that's always visible.

### F10. SessionListItem has invalid nested interactives — [BLOCKING]
- **Where**: `frontend/src/components/llm-council/SessionListItem.tsx:81-119`
- **What's wrong**: A `<Link>` (anchor) wraps the card AND contains a child `<button>`. HTML disallows interactive content inside `<a>`. AT handles this inconsistently (VoiceOver collapses, NVDA may hide the button). Violates **SC 1.3.1**, **SC 4.1.2**, **SC 2.4.4 Link Purpose**.
- **Fix**: Restructure to siblings inside a `<li className="relative">`: `<Link>` for navigation + sibling absolute-positioned `<button>` for delete. Wrap the parent list in `<ul>` (see F13).

### F11. LlmCouncilSessionsPage `<main>` placement is inverted — [MEDIUM]
- **Where**: `frontend/src/pages/LlmCouncilSessionsPage.tsx:148-158`
- **What's wrong**: Placeholder right-pane uses `<main>`. The page-level `<main>` should wrap the entire route content. Two `<main>` per page break landmark navigation. Violates **SC 1.3.1**, **SC 2.4.1**.
- **Fix**: Replace inner `<main>` with `<section aria-label={t('llm_council.session_detail_pane', ...)}>`. Audit global layout for single page-level `<main>`.

### F12. LLM Council streaming results have no live region — [BLOCKING]
- **Where**: `frontend/src/pages/LlmCouncilPage.tsx:198-292`; `frontend/src/components/llm-council/TurnCard.tsx:257-301`
- **What's wrong**: When `addTurn.isPending`, UI shows spinner + "Council is running" inside a regular `<div>` (line 209-216). New turns appear silently. Multi-LLM calls run 10–60s — no AT feedback for start, progress, or completion. Violates **SC 4.1.3**.
- **Why it matters**: Flagship "real-time results" surface; unusable for blind users without live regions.
- **Fix**: Wrap pending block with `role="status" aria-live="polite"`. On new turn append, focus the new turn heading or push aria-live toast: "Turn 3 ready: 3 expert opinions and 1 moderator synthesis." Failed `OpinionCard` should additionally be `role="alert"`.

### F13. Lists are not marked up as lists — [MEDIUM]
- **Where**: `LegislationsPage.tsx:292-374`, `CollectionsPage.tsx:112-117`, `LlmCouncilSessionsPage.tsx:129-145`, `CollectionDetailPage.tsx:262-277`
- **What's wrong**: Search results, collection grid, sessions list, sortable list — all flat `<div>`s. SR cannot announce "list with N items" or use list shortcuts. Violates **SC 1.3.1**.
- **Fix**: Wrap with `<ul role="list" aria-label="...">` and `<li>` per item; for `<SortableContext>`, pass `<ul>` as the sortable container.

### F14. DataDictionary table missing `<caption>` and `scope="col"` — [MEDIUM]
- **Where**: `frontend/src/pages/DataDictionaryPage.tsx:202-249`
- **What's wrong**: `<table>` has no caption / accessible name; `<th>` lacks `scope="col"`. Multiple grouped tables on the page — AT users can't tell which they are in. Violates **SC 1.3.1**, **SC 2.4.6**.
- **Fix**: Add `aria-labelledby={`group-${group.key}-heading`}`, `<caption className="sr-only">`, and `scope="col"` on each `<th>`. Note: prompt mentioned `<dl>` pattern — the 4-column structure here genuinely needs a table; keep table, fix semantics.

### F15. LegislationDetail lacks `lang="en-AU"` and programmatic section labelling — [HIGH]
- **Where**: `frontend/src/components/legislation/LegislationTextViewer.tsx:612-657`; `frontend/src/pages/LegislationDetailPage.tsx:140-256`
- **What's wrong**:
  1. Section text has no `lang="en-AU"` — SR pronounces statutory terms with US voice.
  2. Section IDs are bare hashes; the rendered `<span>s 501</span>` + title aren't headings, so AT heading-navigation skips them.
  3. Section card uses `<div>` not `<article>` — breaks heading-rank progression for legal long-form (the page's primary content).
  Violates **SC 1.3.1**, **SC 2.4.6**, **SC 2.4.10 Section Headings**, **SC 3.1.2 Language of Parts**.
- **Fix**: `<article id={section.id} aria-labelledby={`${section.id}-heading`} lang="en-AU"><header><h3 id="...-heading"><span className="sr-only">Section </span>s {number}{title && ` — ${title}`}</h3></header>...`. Heading rank: page `<h1>` → "Sections" `<h2>` → per-section `<h3>`.

### F16. LegislationTextViewer ⌘F intercept blocks browser native find — [HIGH]
- **Where**: `frontend/src/components/legislation/LegislationTextViewer.tsx:756-771`
- **What's wrong**: `e.preventDefault()` removes user's universal find shortcut at document level. The custom search only matches inside the viewer. Cognitively-impaired users who rely on browser find lose access. Violates **SC 2.1.4 Character Key Shortcuts**, conflicts with **SC 3.2.4 Consistent Identification**.
- **Fix**: Either don't preventDefault — let native find work — or only intercept when focus is within the viewer container. Add a setting to disable the override.

### F17. Auto-scroll without `prefers-reduced-motion` respect — [MEDIUM]
- **Where**: `LegislationTextViewer.tsx:728-732, 781-785`; `LegislationsPage.tsx:131`
- **What's wrong**: `scrollIntoView({ behavior: 'smooth' })` is unconditional. Vestibular-disorder users expect instant jumps when reduced-motion is set. Violates **SC 2.3.3 Animation from Interactions**.
- **Fix**: `behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'`. Apply across all `scrollIntoView` and `window.scrollTo` calls.

### F18. Toolbar icon-only buttons lack accessible names — [HIGH]
- **Where**: `frontend/src/components/legislation/LegislationTextViewer.tsx:831-852, 855-885`
- **What's wrong**: ChevronUp/Down/X buttons in search nav have no `aria-label` — SR announces only "button". Expand/search trigger buttons rely on `title` only (unreliable on touch and not always exposed by AT). Violates **SC 4.1.2**, **SC 2.4.4**.
- **Fix**: Add `aria-label` for each (Previous match, Next match, Close search, Search sections, Expand/Collapse). Keep `title` for sighted tooltip.

### F19. Pipeline / JobStatus log viewer not announced — [HIGH]
- **Where**: `PipelinePage.tsx:519-565`; `JobStatusPage.tsx:262-280`; `PipelinePage.tsx:447-482`
- **What's wrong**: New log entries scroll into a `max-h-80 overflow-auto` container with no `aria-live`. Phase-completion and error-count changes silent. Violates **SC 4.1.3**.
- **Fix**: `<div role="log" aria-live="polite" aria-atomic="false">` for log container. Phase grid as `<ol aria-label="Pipeline phases">`. Separate sr-only live region for transitions: `<div role="status" aria-live="polite" className="sr-only">{phase} phase started</div>`.

### F20. Color-only state indicators on phase/status cards — [HIGH]
- **Where**: `PipelinePage.tsx:447-482`; `JobStatusPage.tsx:160-180`
- **What's wrong**: Phase status (active vs done vs upcoming) communicated by border + bg colour. Icon swap helps but lucide icons are typically `aria-hidden`. Violates **SC 1.4.1 Use of Color**, **SC 1.3.1**.
- **Fix**: Add `<span className="sr-only">{isDone ? 'Completed' : isActive ? 'In progress' : 'Pending'}: </span>` before each phase label.

### F21. Form controls lack required markers and error association — [MEDIUM]
- **Where**: `DownloadPage.tsx:140-167`; `PipelinePage.tsx:339-381`; `LlmCouncilPage.tsx:69-104`
- **What's wrong**: No `aria-required`, `aria-invalid`, `aria-describedby` for helper/error text. Submit-disabled-on-empty pattern (`LlmCouncilPage:108`) gives AT no reason for the disabled state. Violates **SC 3.3.1**, **SC 3.3.2**, **SC 4.1.2**.
- **Fix**: `required aria-required="true"` on textarea; `aria-describedby` linking helper text. Render sr-only `<p id="msg-help" role="status">{t('llm_council.message_required')}</p>` and reference from textarea + button.

### F22. Sonner toast live-region config needs verification — [MEDIUM]
- **Where**: `CollectionsPage.tsx:34`, `CollectionDetailPage.tsx:99`, `DownloadPage.tsx:43-48`, `PipelinePage.tsx:108-111`
- **What's wrong**: Toasts are primary success/failure feedback. Sonner default is `aria-live="polite"`, but project should verify `<Toaster>` mount is configured: `richColors`, `closeButton`, error toasts use `aria-live="assertive"` with extended duration. Default 4s is too short for SR users (**SC 2.2.1 Timing Adjustable**).
- **Fix**: Audit `<Toaster>` config; document convention; set `toast.error(..., { duration: 8000 })`.

### F23. Save button "disabled" feedback is silent — [MEDIUM]
- **Where**: `CollectionEditor.tsx:245-251`; `LlmCouncilPage.tsx:108`
- **What's wrong**: Save is `disabled={!name.trim()}` with no explanation linked. Violates **SC 3.3.2**.
- **Fix**: sr-only `<p id="name-help">Collection name is required</p>` + `aria-describedby="name-help"` on input + button.

### F24. "Update Laws" disabled-state has no announcement — [LOW]
- **Where**: `frontend/src/pages/LegislationsPage.tsx:172-191`
- **What's wrong**: Button label flips "Update Laws" → "Updating..." but SR announces only on next focus. Violates **SC 4.1.3** (minor).
- **Fix**: `aria-busy={job?.running}` on the button; surrounding region announces completion.

### F25. ConfirmModal — focus management on destructive action — [HIGH]
- **Where**: `SessionListItem.tsx:121-129`; `CollectionDetailPage.tsx:292-304`
- **What's wrong**: After confirm/cancel, focus is not restored to trigger. After delete, the deleted item disappears — focus lands on `<body>`, breaking keyboard flow. Violates **SC 2.4.3**, **SC 2.4.11 Focus Not Obscured (Minimum)** (new in 2.2).
- **Fix**: Capture trigger on open, restore on close. If trigger is gone, focus the parent list heading or sibling item.

### F26. Telegram script — CSP / `lang` consistency — [LOW]
- **Where**: `frontend/src/components/auth/TelegramLoginButton.tsx:45-53`
- **What's wrong**: External script loaded without integrity hash; injected iframe is `lang="en"` regardless of app locale. Violates **SC 3.1.2 Language of Parts** for the wrapper.
- **Fix**: Add `lang={i18n.language}` on wrapper. Document iframe-fixed-EN limitation. Plan alternative auth for non-EN locales.

### F27. DesignTokensPage colour-blindness simulator lacks AT description — [LOW]
- **Where**: `frontend/src/pages/DesignTokensPage.tsx:178-200` (and downstream rendering)
- **What's wrong**: Simulated swatches change visually but `aria-label` is unchanged — AT can't perceive what's demonstrated. Contrast ratios from `getWcagLevel` not exposed. Meta page, low impact.
- **Fix**: `aria-label={`${type} simulation: ${color}, contrast ratio ${ratio}, WCAG ${level}`}`.

### F28. LegislationsPage scrape progress / result count not announced — [MEDIUM]
- **Where**: `frontend/src/pages/LegislationsPage.tsx:161-247`
- **What's wrong**: `meta` shows `{totalItems} results` but no `aria-live`. As the user types, count changes silently. Violates **SC 4.1.3**.
- **Fix**: Wrap meta region in `aria-live="polite" aria-atomic="true"` (small region — atomic OK).

### F29. JobStatusPage timer needs on-demand announcement, not live — [LOW]
- **Where**: `frontend/src/pages/JobStatusPage.tsx:53-65, 209-215`
- **What's wrong**: Elapsed timer updates every 1s. No live region (correct — would be torture). But no on-demand way for AT users to query status.
- **Fix**: Provide a "Read status" button that fires a one-shot `aria-live="polite"` announcement: "Job running — 3m 24s elapsed, 240 of 1000 cases complete."

### F30. SPA route change — no focus management or skip link — [HIGH]
- **Where**: All 12 pages (route-level concern; layout files out of scope)
- **What's wrong**: On SPA route change, focus stays on the previous trigger. No "Skip to main content" link visible on focus. AT users get no announcement that the page changed. Violates **SC 2.4.1 Bypass Blocks**, **SC 2.4.3**, **SC 4.1.3**.
- **Fix**: Global `<a href="#main" className="sr-only focus:not-sr-only">`. On `pathname` change, focus the page-level `<h1>` (`tabIndex={-1}` + ref) and/or push polite announcement: "{pageTitle} loaded".

## Patterns observed
- **Inconsistent — modal semantics**: Custom backdrop divs (CollectionEditor, presumed ConfirmModal) vs. needing Radix/Headless primitives.
- **Missing — progress / live regions**: Universal across Pipeline, Download, JobStatus, LegislationsScrape, LLM Council. Highest-impact fix area.
- **Inconsistent — labels**: Some inputs use `aria-label` on input (LegislationsPage search), others use unassociated visible labels (CollectionEditor, DownloadPage form, PipelinePage form). Needs project-wide form pattern.
- **Inconsistent — heading hierarchy**: `LegislationsPage` uses sr-only `<h2>` (correct); `LegislationTextViewer` skips heading semantics for sections altogether.
- **Consistent — focus-visible rings**: `SessionListItem`, `LegislationsPage` cards use `focus-visible:ring-2 focus-visible:ring-accent`. Keep.
- **Consistent — i18n with defaultValue**: Good; supports translation without breaking AT.
- **Missing — `lang="en-AU"`**: Root html, statute text bodies, and component-level lang attributes absent. Single-line index.html fix + per-component overrides.
- **Missing — semantic list markup**: All "lists" of cards/sessions/results are flat divs. Trivial wrap-in-`<ul>` PR available.
- **Missing — keyboard alternatives for drag**: Sortable lists rely on dnd-kit KeyboardSensor (good) but no visible move buttons.

## Open questions for lead
1. Is there an existing `ConfirmModal` (`frontend/src/components/shared/ConfirmModal.tsx`, out of this scope) that already handles dialog semantics? If yes, `CollectionEditor` should adopt it instead of forking.
2. Willing to swap `CollectionEditor` modal for Radix/Headless dialog primitive, or build a focus-trap hook in-house?
3. For LLM Council streaming UX, is there an SSE/event-source channel we can hook into, or is `useAddTurn` just `await mutateAsync`? If intermediate streaming events exist (per-provider arrival), announce each provider as it lands.
4. Telegram widget is third-party iframe — confirm whether `<noscript>` fallback or alternative auth (email magic-link, OIDC) is on the roadmap. Without it, DDA 1992 risk is real.
5. Is `<html lang="en-AU">` acceptable globally given i18n supports zh-Hant et al? Should probably be `lang={i18n.language}` synced via a `useEffect` on `<html>` — confirm i18next HTML-lang plugin is configured.

## Files inspected
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/pages/LegislationsPage.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/pages/LegislationDetailPage.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/pages/CollectionsPage.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/pages/CollectionDetailPage.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/pages/LlmCouncilPage.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/pages/LlmCouncilSessionsPage.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/pages/DataDictionaryPage.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/pages/DownloadPage.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/pages/PipelinePage.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/pages/JobStatusPage.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/pages/DesignTokensPage.tsx` (first 200 lines — meta page, sampled)
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/pages/LoginPage.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/legislation/LegislationTextViewer.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/collections/CollectionCard.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/collections/CollectionEditor.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/collections/SortableCaseItem.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/llm-council/SessionListItem.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/llm-council/TurnCard.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/auth/TelegramLoginButton.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/index.html`
