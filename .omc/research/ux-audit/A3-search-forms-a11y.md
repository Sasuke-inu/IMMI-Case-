# UX Audit — A3: Search & Discovery (WCAG 2.2 AA)
**Worker**: a11y-architect | **Scope**: 5 pages + saved-searches/taxonomy components | **Date**: 2026-05-05

## TL;DR
- The Search & Discovery surface ships zero combobox/listbox semantics — every autocomplete (visa, judge, country) is a static `<input>` plus an unannounced `<button>` list. Screen-reader users get no `aria-expanded`, no `aria-activedescendant`, no result-count live region, and no keyboard arrow navigation. This breaks WCAG 1.3.1, 4.1.2, and the WAI-ARIA 1.2 combobox pattern simultaneously.
- `SaveSearchModal` is a focus-trap-less modal: the dialog has `role="dialog"`/`aria-modal="true"` but no `aria-labelledby`, no `aria-describedby`, no Tab containment, and no return-focus on close. Validation errors are unassociated text (no `aria-describedby`/`aria-invalid`/`role="alert"`). Backdrop is a non-button div with click handler — keyboard users can't dismiss via the overlay.
- `TaxonomyPage` and `SearchTaxonomyPage` are zero-content shims that re-export `GuidedSearchPage`, so any fix to GuidedSearch propagates — but the parallel `taxonomy/GuidedSearchFlow.tsx` is a *separate* duplicate flow with subtly different a11y (e.g. some buttons missing `type="button"`). Three different entry points, three subtly different a11y profiles → inconsistent and unmaintainable.

## Findings

### F1. Combobox/autocomplete pattern entirely missing — [BLOCKING]
- **Where**: `frontend/src/pages/GuidedSearchPage.tsx:492-555` (visa), `:698-769` (judge); `frontend/src/components/taxonomy/VisaQuickLookup.tsx:77-91, 94-145`; `frontend/src/components/taxonomy/JudgeAutocomplete.tsx:81-95, 97-149`; `frontend/src/components/taxonomy/GuidedSearchFlow.tsx:377-435, 723-773`.
- **What's wrong**: Each search input is a bare `<input type="text">` with a sibling `<div>` of `<button>`s rendered when results arrive. Zero ARIA wiring: no `role="combobox"`, no `aria-expanded`, no `aria-controls`, no `aria-autocomplete="list"`, no `aria-activedescendant`, no `role="listbox"`/`role="option"` on the result container/items. Arrow keys do not navigate the popup; Enter does not select; Escape does not collapse. Loading state for visa/judge is announced via `role="status" aria-live="polite"` (good — `:502-514`, `:707-719`) but nothing announces "X results" or "no results" when the listbox populates. Violates **WCAG 1.3.1 Info and Relationships (A)**, **4.1.2 Name, Role, Value (A)**, **2.1.1 Keyboard (A)**, **WAI-ARIA APG combobox pattern**.
- **Why it matters**: Self-rep applicants under stress, often using ESL screen readers (NVDA + Chinese, JAWS + Vietnamese), get a search input that "does nothing" — the popup is invisible to AT, and there's no spoken affordance that results exist below the input. They will abandon. Voice Control and Switch Control users can't navigate option-by-option. This single defect probably blocks 40-60% of the assistive-tech population from using guided search at all.
- **Fix**: Refactor each lookup into a true APG combobox (`role="combobox"` on the wrapper, `aria-expanded` reflecting popup state, `aria-controls` referencing the listbox `id`, `aria-autocomplete="list"`). Result wrapper gets `role="listbox"` + stable `id`; each result button becomes `<div role="option" id="opt-<id>" aria-selected="...">` (or use a `<button>` with `role="option"` *inside* the listbox parent). Wire `aria-activedescendant` to the highlighted option's id. Add `onKeyDown` on the input for ArrowDown/ArrowUp/Home/End/Enter/Escape. Announce "{n} results available" via `aria-live="polite"` once the listbox populates.
- **Cross-cuts**: A1 (page-level navigation), A2 (forms patterns elsewhere — JudgeProfilesPage and CasesPage filter inputs likely have the same defect), design-tokens (need a focused-option style token).

### F2. SaveSearchModal — focus trap + dialog labelling broken — [BLOCKING]
- **Where**: `frontend/src/components/saved-searches/SaveSearchModal.tsx:126-207`.
- **What's wrong**:
  1. `role="dialog" aria-modal="true"` (`:128-129`) but no `aria-labelledby` (the heading at `:143-148` has no `id`) and no `aria-describedby`. Screen reader announces "dialog" with no name — violates **WCAG 4.1.2 Name, Role, Value (A)** and **2.4.6 Headings and Labels (AA)**.
  2. No focus trap. Tab from the name input flows to *page* content underneath (form has Cancel/Save then nothing constrains focus). Violates the modal portion of **APG dialog pattern**; users with motor / cognitive needs can lose context entirely.
  3. No return-focus on close — `onCancel` does not restore focus to the trigger. Violates **WCAG 2.4.3 Focus Order (A)**.
  4. Backdrop is `<div onClick={onCancel}>` (`:131`) with no role, no keyboard handler — keyboard users can't dismiss via overlay (but Esc works `:64-70`, that part is fine).
  5. Error message at `:175` is rendered as plain `<p>` — not associated with the input via `aria-describedby`, input gets no `aria-invalid="true"`, and the `<p>` has no `role="alert"`/`aria-live="polite"` so the error is silently shown. Violates **WCAG 3.3.1 Error Identification (A)** and **3.3.3 Error Suggestion (AA)**.
  6. Input lacks `aria-required="true"` though name is effectively required (`:78-85`). Violates **3.3.2 Labels or Instructions (A)** for required-state programmatic exposure.
- **Why it matters**: The Save dialog is the ONLY way to persist a search — a stressed applicant who needs assistive tech to get this far will be silently dropped at the finish line. AT users won't hear the dialog title, won't know focus moved, won't hear validation errors, and won't know they exited the modal.
- **Fix**:
  ```tsx
  <div role="dialog" aria-modal="true" aria-labelledby="save-modal-title" aria-describedby="save-modal-desc">
    <h3 id="save-modal-title">…</h3>
    <p id="save-modal-desc">…</p>
    <input
      aria-required="true"
      aria-invalid={!!error}
      aria-describedby={error ? "save-name-error" : undefined}
    />
    {error && <p id="save-name-error" role="alert" className="…">{error}</p>}
  ```
  Add a focus-trap (e.g. `focus-trap-react` or in-house `useFocusTrap` hook on the dialog ref). On unmount, return focus to the element saved in a ref before opening. Replace the backdrop `<div onClick>` with either `<button aria-label="Close dialog" class="absolute inset-0 …">` or rely on Esc only.
- **Cross-cuts**: Reusable `Dialog` primitive needed (this same defect is likely repeated in `ConfirmModal` per CLAUDE.md component list).

### F3. Result count not announced (live region missing) — [HIGH]
- **Where**: `GuidedSearchPage.tsx:244-308` (results view); `SemanticSearchPage.tsx:195-207`; `GuidedSearchFlow.tsx:572-662` (review/submit step).
- **What's wrong**: Result count is rendered as static text inside `PageHeader` description (`GuidedSearchPage:251-254`) or a plain `<p>` (`SemanticSearchPage:197-202`). After form submission, no `aria-live="polite"` region announces "Found 47 cases matching your criteria" — AT users hear nothing change unless they manually re-traverse. Toast (`toast.success(...)` `GuidedSearchPage:194-198`) uses `sonner`, which by default does *not* render an `aria-live` polite region usable by screen readers without the `<Toaster>` `richColors`/`closeButton` config and the role wired correctly. Violates **WCAG 4.1.3 Status Messages (AA)**.
- **Why it matters**: A blind user submits the search and hears silence; they don't know whether the request succeeded, failed, returned 0, or returned 5,000. Cognitive-load users (which is most self-rep applicants) lose track of state.
- **Fix**: Add a visually-hidden `<div role="status" aria-live="polite" aria-atomic="true">` rendered in the page that text-content updates to "Found {count} cases" / "No cases found, try adjusting filters" / "Search failed" on each state transition. Verify `<Toaster>` is mounted with `<Toaster richColors />` and that the sonner version renders `role="status"` per its Radix-aria config.
- **Cross-cuts**: A4 if the case-list page also lacks live count.

### F4. SemanticSearchPage — search input has no programmatic label — [HIGH]
- **Where**: `frontend/src/pages/SemanticSearchPage.tsx:107-115`.
- **What's wrong**: The search `<input>` has only a placeholder ("Describe the case situation… (min 3 chars)") — no `<label>`, no `aria-label`, no `aria-labelledby`. The visible `<Search />` icon is decorative (no label). The form has no `role="search"`. Placeholder-only labelling fails **WCAG 1.3.1 (A)**, **3.3.2 Labels or Instructions (A)**, and **4.1.2 Name, Role, Value (A)**: placeholder text disappears on focus and is not a label.
- **Why it matters**: Voice Control "click search input" has nothing to target. Screen reader announces "edit, blank" with zero context. ESL users lose the placeholder once they start typing — they can't recover the hint.
- **Fix**: Wrap with `<form role="search">` (`:103`). Add a visually-hidden `<label htmlFor="semantic-search-input" className="sr-only">Describe your case situation</label>` and `id="semantic-search-input"` on the input, plus `aria-describedby` pointing to a sibling hint element that says "Minimum 3 characters." for the persistent constraint.
- **Cross-cuts**: Same pattern broken on every taxonomy autocomplete — even the ones with a visible `<label>` fail because there's no `htmlFor`/`id` association (e.g. `GuidedSearchPage.tsx:487-500` — label has no `htmlFor`, input has no `id`).

### F5. `<label>` elements not associated with inputs — [HIGH]
- **Where**: `GuidedSearchPage.tsx:487-491` (visa), `:561-565` (country), `:620-624` (legal concepts), `:693-697` (judge); `GuidedSearchFlow.tsx:364-369, 442-449, 504-511, 710-715`.
- **What's wrong**: Every `<label>` lacks `htmlFor`, every `<input>` lacks a matching `id`. The `<label>` is therefore a presentational text node; clicking the label does not focus the input, screen readers don't announce the label when focus enters the input. Violates **WCAG 1.3.1 Info and Relationships (A)** and **3.3.2 Labels or Instructions (A)**.
- **Why it matters**: This is the single most common a11y defect, and it compounds with F1 — even the "visible label" fallback doesn't program-exposure the name.
- **Fix**: Add deterministic `id`s (e.g. `id="guided-visa-input"`) and `htmlFor` on every label. Use `useId()` from React 18 if labels need to be generated.
- **Cross-cuts**: Will also help Voice Control "click visa subclass".

### F6. SemanticSearchPage provider toggle — radio group masquerading as buttons — [HIGH]
- **Where**: `SemanticSearchPage.tsx:128-147`.
- **What's wrong**: "OpenAI / Gemini" model selector is two `<button type="button">` siblings with `aria-pressed` *missing*. There's a leading `<span>Model:</span>` (`:130-132`) with no `id`, no role, no `aria-labelledby` linking the two buttons as a group. Semantically this is a single-select radio group; rendering it as bare buttons strips the "1 of 2" announcement and the inherent radio-group keyboard pattern (Arrow keys to switch, Tab to leave). Violates **WCAG 1.3.1 (A)** and **4.1.2 (A)**.
- **Why it matters**: A user with a screen reader hears "OpenAI button, Gemini button" with no indication that one is currently selected, no way to know they are mutually exclusive, and no announcement when selection changes.
- **Fix**:
  ```tsx
  <div role="radiogroup" aria-labelledby="model-label">
    <span id="model-label">Model</span>
    {(["openai","gemini"] as const).map(p => (
      <button
        role="radio"
        aria-checked={provider === p}
        type="button"
        tabIndex={provider === p ? 0 : -1}
        onKeyDown={…ArrowLeft/ArrowRight…}
        …
      >
    ))}
  </div>
  ```
  Or use native `<input type="radio">` and style with peer-selectors.
- **Cross-cuts**: Same anti-pattern likely on theme picker / view-mode toggles elsewhere.

### F7. Filter "chip" / multi-select buttons missing `aria-pressed` and selection-count announcement — [HIGH]
- **Where**: `GuidedSearchPage.tsx:518-553` (visa cards), `:578-612` (country cards), `:649-685` (concept cards). `GuidedSearchFlow.tsx:521-541` has `aria-pressed`-style style but no `aria-pressed` attribute. `LegalConceptBrowser.tsx:60-84` — concept chips have no `aria-pressed`/role at all.
- **What's wrong**: GuidedSearchPage actually does set `aria-pressed` (good — `:521, :581, :652`) but `GuidedSearchFlow.tsx` does not. The "Maximum 5 legal concepts" cap (`GuidedSearchPage.tsx:222-231`) toasts only after attempt — there's no `aria-describedby` on the unselected concepts saying "5 of 5 selected, deselect one to add another". Disabled concepts are styled with `disabled` (`:655-657`) but no explanatory `aria-describedby`. Violates **WCAG 4.1.2 (A)** (state) and **3.3.1 Error Identification (A)** (limit error).
- **Why it matters**: A user gets to concept #6, gets a transient toast, and has no persistent indication of why the others are dimmed.
- **Fix**: Standardise on `aria-pressed` for all "selected" toggle buttons across both `GuidedSearchPage` and `GuidedSearchFlow`. Add a live-region status "{n} of 5 concepts selected" near the chip group, updated via `aria-live="polite"`. On disabled chips set `aria-disabled="true"` instead of (or in addition to) the `disabled` attribute, and add `aria-describedby` pointing to the cap message.
- **Cross-cuts**: F1 (combobox), F3 (live region).

### F8. Three search-flow implementations diverge in a11y — [HIGH]
- **Where**: `GuidedSearchPage.tsx` (all 838 lines) vs `components/taxonomy/GuidedSearchFlow.tsx` (all 847 lines) vs `pages/TaxonomyPage.tsx` + `pages/SearchTaxonomyPage.tsx` (which alias GuidedSearchPage).
- **What's wrong**: GuidedSearchPage has `aria-pressed` and `aria-current="step"` (`:448`) for the stepper; GuidedSearchFlow does not (`:349-358` is purely visual progress dots). GuidedSearchFlow buttons at `:282, :397, :463, :522, :555, :562, :642, :649, :685, :744, :822, :828` are missing `type="button"` — meaning if any is rendered inside a future `<form>` parent it will submit the form. GuidedSearchPage uses `aria-pressed`; GuidedSearchFlow uses class-only state. Violates **WCAG 3.2.4 Consistent Identification (AA)** — same UI element, two different programmatic implementations.
- **Why it matters**: Whichever route the user takes, they get a slightly different a11y experience — and the maintenance cost to fix both doubles every defect.
- **Fix**: Delete `GuidedSearchFlow.tsx` and have `TaxonomyPage` / `SearchTaxonomyPage` continue to alias `GuidedSearchPage`, or factor a shared `GuidedSearchEngine` primitive both pages render. Then a single fix propagates.
- **Cross-cuts**: F1 / F5 / F7 all have to be fixed in *one* place if consolidated.

### F9. Stepper progress not announced; visual-only "Step 2 of 4" — [MEDIUM]
- **Where**: `GuidedSearchPage.tsx:416-422, 425-472`; `GuidedSearchFlow.tsx:347-358, 694-704`.
- **What's wrong**: GuidedSearchPage *does* set `aria-current="step"` on the active label (`:448`) — but the label itself has `hidden md:block`, so on mobile the step name is invisible AND not exposed to AT. The badge "Step 2 of 4" (`:416-422`) is a plain `<div>`, not an `aria-live` region — it doesn't update announce on step change. Violates **WCAG 4.1.3 Status Messages (AA)**.
- **Why it matters**: User completes step 1, presses Next; AT user hears no transition announcement.
- **Fix**: Wrap the "Step {current} of {total}" badge with `role="status" aria-live="polite"` so each transition is announced. Remove `hidden md:block` from the step label or add a visually-hidden duplicate so the label is exposed at every breakpoint.
- **Cross-cuts**: F3.

### F10. SavedSearchCard — icon-only buttons missing accessible name — [MEDIUM]
- **Where**: `frontend/src/components/saved-searches/SavedSearchCard.tsx:159-180`.
- **What's wrong**: The Share / Edit / Delete buttons are icon-only `<button>`s with `<Share2 />` / `<Edit2 />` / `<Trash2 />` SVGs and `title={...}`. `title` provides a name for sighted-mouse users but is poorly supported by screen readers and not exposed to touch users (no hover). No `aria-label`, no `<span class="sr-only">` text. Violates **WCAG 4.1.2 Name, Role, Value (A)**.
- **Why it matters**: A blind user hears "button, button, button". The Delete button is also missing a confirmation pattern → destructive, accidentally-triggerable, and unannounced.
- **Fix**: Add `aria-label={t("saved_searches.share_button")}` etc. on each button. Wrap delete in a `ConfirmDialog` with `aria-describedby` explaining the action is irreversible. Promote `<Trash2>` to `aria-hidden="true"` since the button now has its own name.
- **Cross-cuts**: F2 (modal pattern needed for delete confirm).

### F11. Target size — icon-only buttons on SavedSearchCard at ~28x28 px — [MEDIUM]
- **Where**: `SavedSearchCard.tsx:160-179` (px-2.5 py-1.5 + h-3.5 w-3.5 icon ≈ 28x28).
- **What's wrong**: Share/Edit/Delete buttons measure roughly 28×28 CSS pixels (`px-2.5 py-1.5` ≈ 10px+10px padding around 14px icon = ~28×28). Adjacent without 4px+ margin between them — placed in a `gap-2` (8px) flex row, that's borderline. WCAG 2.2 SC **2.5.8 Target Size (Minimum) (AA)** requires 24×24 *with* sufficient spacing or be otherwise excluded. Also fails the recommended **2.5.5 Target Size (Enhanced) (AAA)** of 44×44.
- **Why it matters**: Motor-impaired and elderly users (a real demographic among self-rep applicants — many older parents/family members assist) mis-tap and trigger Delete instead of Edit.
- **Fix**: Bump padding to `p-2` (32×32) minimum, ensure ≥4px gap between adjacent icon buttons. Better: use a single overflow `<button aria-label="More actions">` with a menu for secondary actions and only Execute as primary CTA at full size.
- **Cross-cuts**: A2 (similar small icon-only buttons throughout `cases/` and `judges/` components).

### F12. Country dropdown — `<select>` triggers navigation onChange (no submit affordance) — [MEDIUM]
- **Where**: `frontend/src/components/taxonomy/CountryDropdown.tsx:46-75`.
- **What's wrong**: `<select onChange={...}>` immediately navigates to `/cases?keyword=…` when a value is chosen. Keyboard users opening the select with Space/Enter and arrowing through options trigger navigation on each arrow press in some browsers (Safari historically, Firefox depending on settings). Violates **WCAG 3.2.2 On Input (A)** — change of context on input without warning. Also no `<label htmlFor>` (the `<h2>` at `:31-35` is not programmatically associated). The dropdown caret is a CSS background-image SVG with no role and no accessible name (fine, decorative) but the entire `<select>` has no `aria-label` either.
- **Why it matters**: Keyboard users may navigate away accidentally. Screen reader users hear "combobox" with no name.
- **Fix**: Either (a) make the `<select>` a controlled value + add a separate "View cases" submit button, or (b) keep auto-navigate but add `<label htmlFor="country-select" className="sr-only">Filter cases by country of origin</label>` and `id="country-select"` on the select, plus an `aria-describedby` warning the user that selection navigates. Bind the `<h2>`-style heading with `id` and use `aria-labelledby` if you want the visible heading to act as the label.
- **Cross-cuts**: F4 / F5.

### F13. SavedSearchPanel — collapse toggle missing `aria-controls` — [MEDIUM]
- **Where**: `frontend/src/components/saved-searches/SavedSearchPanel.tsx:53-82`.
- **What's wrong**: The expand/collapse `<button>` has `aria-expanded={isExpanded}` (good — `:57`) but no `aria-controls` pointing to the collapsible body's `id`. The body `<div>` (`:86`) has no `id`, no `role="region"`, no `aria-label`. Violates **WCAG 1.3.1 (A)** for the disclosure pattern.
- **Why it matters**: AT can announce expanded/collapsed state but cannot navigate the user *to* the revealed region.
- **Fix**: Add `id="saved-search-body"` to the collapsible div; add `aria-controls="saved-search-body"` to the button.

### F14. Filter chip-search inside SavedSearchPanel duplicates the saved-search count without live-region — [MEDIUM]
- **Where**: `SavedSearchPanel.tsx:101-118, 152-160`.
- **What's wrong**: Typing in the search filter narrows the list (`filteredSearches.filter(...)`) but the count badge "X/50" (`:66-74`) reflects the *total*, not filtered count, and the "no results" empty state at `:152-160` is rendered without `role="status"` / `aria-live` — AT users typing don't hear "no matches". Violates **WCAG 4.1.3 Status Messages (AA)**.
- **Fix**: Add `role="status" aria-live="polite"` to the no-results panel; emit "{filteredCount} of {total} searches shown" as a polite live update on input change.

### F15. SemanticSearchPage error/unavailable banners not in `role="alert"` — [MEDIUM]
- **Where**: `SemanticSearchPage.tsx:151-161` (unavailable), `:163-171` (error), `:173-179` (skeleton loading).
- **What's wrong**: Both info/error banners are static `<div>`s — the `<AlertCircle />` icon has no role, the surrounding banner has no `role="status"` (info) or `role="alert"` (error). Skeleton loader at `:173-179` has no `role="status"` and no accessible "Loading…" name. Violates **WCAG 4.1.3 Status Messages (AA)** and partially **3.3.1 Error Identification (A)** for the network-error case.
- **Fix**: `role="alert"` on the API-error banner, `role="status"` on unavailable banner, and wrap the skeleton container in `<div role="status" aria-live="polite" aria-busy="true"><span class="sr-only">Loading results…</span>…</div>`.

### F16. Searching-state spinner uses `Loader2` but spinner div has no a11y name — [MEDIUM]
- **Where**: `GuidedSearchPage.tsx:797-805` (submit button while pending).
- **What's wrong**: The "Searching…" affordance inside the submit button replaces the icon+text but the button's accessible name becomes literally "Searching…" — fine. However the submit button is `disabled={guidedMutation.isPending}` (`:790`); disabled buttons receive zero focus, so a screen reader user who Tab-pressed Enter won't hear "Searching…" because focus moves past. Combined with no live region (F3), the user gets silence. Violates **WCAG 4.1.3 Status Messages (AA)**.
- **Fix**: Either keep the button focusable using `aria-disabled="true"` instead of `disabled`, OR add a sibling live region "Searching, please wait…" announced when `isPending` flips true. Same fix needed on `SemanticSearchPage.tsx:117-126`.

### F17. Required-field indicator uses color + asterisk only — [MEDIUM]
- **Where**: `GuidedSearchFlow.tsx:368` (`<span className="ml-1 text-red-500">*</span>`), `:714` (judge name asterisk).
- **What's wrong**: Red asterisk has no `aria-hidden`, no programmatic required state on input, no textual "required" indicator. Color (red) is the sole visual encoding of "required" → violates **WCAG 1.4.1 Use of Color (A)**, and missing `aria-required` violates **3.3.2 (A)**.
- **Why it matters**: Color-blind users see a black asterisk but no text label; screen readers don't announce "required".
- **Fix**: `<input aria-required="true" />` plus `<span aria-hidden="true" className="text-red-500">*</span><span className="sr-only">required</span>`. The asterisk symbol needs to be visually consistent — also add it to `GuidedSearchPage.tsx` labels (currently *no* required indicator at all on the same fields).

### F18. Modal backdrop hex color hardcoded outside design tokens — [LOW] (a11y-relevant: contrast)
- **Where**: `SaveSearchModal.tsx:131` — `bg-[#111820]/65`.
- **What's wrong**: Hardcoded backdrop color bypasses the `tokens.json` system. While a 65% black overlay is fine for the dialog, it's a violation of project rule "no magic numbers, all from tokens". Also affects future high-contrast theme work — the backdrop must darken/lighten depending on theme.
- **Fix**: Use `bg-overlay/65` with `--color-overlay` defined in tokens. Cross-reference theme system and dark-mode requirements in `CLAUDE.md` ("法律典籍" / Legal Codex aesthetic).
- **Cross-cuts**: A6 (design-tokens audit).

### F19. Reduced-motion not respected on flow transitions / spinners — [LOW]
- **Where**: `GuidedSearchPage.tsx:507, 713, 799` (`<div className="animate-spin">`); `SavedSearchPanel.tsx:75-80` (`transition-transform duration-150` on chevron); `GuidedSearchFlow.tsx:351-356` (`transition-colors`).
- **What's wrong**: No `prefers-reduced-motion: reduce` media query disables the spinner / progress-bar transitions. WCAG 2.2 SC **2.3.3 Animation from Interactions (AAA)** is AAA, not strictly required, but the ralated **2.2.2 Pause, Stop, Hide (A)** applies for the indefinite spinner if it's "auto-updating" content; usually a spinner is OK because it's tied to a network request, but the `animate-spin` is a fully-decorative loop.
- **Fix**: Add a global `@media (prefers-reduced-motion: reduce) { .animate-spin { animation: none; } }` in `index.css`; ensure all `transition-*` Tailwind utilities are duration-0 under that media query. Note CLAUDE.md says "深色模式主題切換動畫速度**不得改變**" — that's a different transition; this finding is about decorative spinners and progress dots.

### F20. Submit button disabled state semantics — [LOW]
- **Where**: `GuidedSearchPage.tsx:786-797`, `:819-833`; `SemanticSearchPage.tsx:117-126`.
- **What's wrong**: `disabled` removes the button from the tab order — users can't focus it to discover *why* it's disabled (no `aria-describedby` to "Select a visa subclass first"). Violates the spirit of **WCAG 3.3.1 (A)** / **3.3.3 (AA)** — "instructions and suggestions for fix" not exposed.
- **Fix**: Replace `disabled` with `aria-disabled="true"` + suppress the click handler when invalid; on click of an aria-disabled button, focus the offending field and announce the error via live region.

## Patterns observed
- **Inconsistent**: Two separate guided-search implementations (`pages/GuidedSearchPage.tsx` and `components/taxonomy/GuidedSearchFlow.tsx`) with subtly different a11y profiles. Three URL routes (`/guided-search`, `/taxonomy`, `/search-taxonomy`) all rendering the page-level one, leaving `GuidedSearchFlow` orphaned but still maintained.
- **Missing**: ARIA combobox/listbox semantics for *every* autocomplete on these pages — visa, judge, country, semantic-search input are all bare text inputs + button lists.
- **Missing**: Live regions for result counts, step transitions, search progress, and form errors. The only `aria-live` use is on per-input "Searching…" loading states.
- **Inconsistent**: `aria-pressed` set on toggle-buttons in `GuidedSearchPage` but not in `GuidedSearchFlow` or `LegalConceptBrowser`; `aria-current="step"` set in `GuidedSearchPage` stepper but not `GuidedSearchFlow` progress bar.
- **Consistent (positive)**: All search inputs share the same Tailwind focus-ring pattern (`focus:ring-1 focus:ring-accent` or `focus:ring-2 focus:ring-accent`) — good for SC 2.4.7 / 2.4.11. Verify accent token meets 3:1 contrast against the form background in dark mode.

## Open questions for lead
1. Are `pages/TaxonomyPage.tsx` / `pages/SearchTaxonomyPage.tsx` legacy aliases scheduled for removal? If yes, can we delete them and the orphan `components/taxonomy/GuidedSearchFlow.tsx` to halve the surface area?
2. Is there an existing project-wide `Dialog` / `Combobox` primitive being planned (Radix UI? Headless UI?), or should fixes be inline? CLAUDE.md mentions `ConfirmModal` exists — does it already implement focus trap + return-focus we can reuse?
3. SemanticSearch model toggle (`provider="openai"|"gemini"`) — is "OpenAI" vs "Gemini" branding important enough to keep visible button text, or can we hide it behind a single "AI provider" `<select>` with both options?
4. Does the design system define `--color-overlay` / `--color-modal-backdrop`? F18 needs this for token compliance.
5. The 50-saved-search cap — is the cap announcement inside `SavedSearchPanel` translated to all 7 locales (i18n-validator scope)? The English text is fine but auto-truncation in CJK locales may hide the alert.
6. Is there an i18n key for "Required" the team prefers (matching F17), or should `aria-required` carry the semantic and the visible asterisk be decorative-only?

## Files inspected
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/pages/GuidedSearchPage.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/pages/SemanticSearchPage.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/pages/SavedSearchesPage.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/pages/TaxonomyPage.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/pages/SearchTaxonomyPage.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/saved-searches/SaveSearchModal.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/saved-searches/SavedSearchCard.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/saved-searches/SavedSearchPanel.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/taxonomy/CountryDropdown.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/taxonomy/GuidedSearchFlow.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/taxonomy/JudgeAutocomplete.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/taxonomy/LegalConceptBrowser.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/taxonomy/VisaQuickLookup.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/CLAUDE.md` (context)
