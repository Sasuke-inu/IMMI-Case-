# UX Audit — D3: Search & Discovery
**Worker**: designer | **Scope**: 5 pages + saved-searches/taxonomy components | **Date**: 2026-05-05

---

## TL;DR

- **TaxonomyPage and SearchTaxonomyPage are aliases of GuidedSearchPage** — three route names map to one component, erasing the distinct UX model each was meant to represent; users navigating "Taxonomy" get a wizard with no taxonomy affordance.
- **GuidedSearchPage (the real wizard) and GuidedSearchFlow (the component version) are parallel, diverged implementations** of the same logic — different step counts, different debounce behaviour, different submit outcomes — creating an unpredictable experience depending on which entry point the user lands on.
- **The Saved Searches page has no creation path**: the page-level CTA explicitly sends users away ("Go to Cases to create new searches") with no inline creation affordance, making the page feel like a dead end for first-time visitors who land there directly.

---

## Findings

### F1. TaxonomyPage and SearchTaxonomyPage are no-op aliases — BLOCKING
- **Where**: `frontend/src/pages/TaxonomyPage.tsx:1-5`, `frontend/src/pages/SearchTaxonomyPage.tsx:1-5`
- **What's wrong**: Both files are single-line re-exports of `GuidedSearchPage`. A user navigating `/taxonomy` or `/search-taxonomy` sees the guided wizard (visa → country → concepts), not a taxonomy browser. No taxonomy tree, grid, or concept-browsing affordance appears. The components `LegalConceptBrowser`, `CountryDropdown`, `JudgeAutocomplete`, and `VisaQuickLookup` exist in `components/taxonomy/` but are never rendered by any page route.
- **Why it matters**: Three different nav entries promise three different mental models (guided wizard, taxonomy browse, search-by-taxonomy) but all deliver the same wizard. Self-rep users under stress who choose "Taxonomy" expecting a concept browser are silently misdirected into a multi-step form.
- **Fix**: Route `/taxonomy` to a real `TaxonomyPage` that composes the four taxonomy components (`VisaQuickLookup`, `LegalConceptBrowser`, `CountryDropdown`, `JudgeAutocomplete`) in a tabbed or sectioned layout. Route `/search-taxonomy` to a page that bridges taxonomy selection into the guided search flow. Retire the alias pattern.
- **Cross-cuts**: Navigation labels in sidebar/nav need to match the actual page content once fixed.

---

### F2. Dual wizard implementations diverge silently — BLOCKING
- **Where**: `frontend/src/pages/GuidedSearchPage.tsx` vs `frontend/src/components/taxonomy/GuidedSearchFlow.tsx`
- **What's wrong**: Two complete, independent implementations of "Find Precedents" and "Assess Judge" wizard flows exist. They differ in material ways:
  - Step count: `GuidedSearchPage` has 3 steps for Find Precedents; `GuidedSearchFlow` has 4 (adds a Review step).
  - Debounce: `GuidedSearchFlow` debounces visa/judge queries at 300 ms with refs; `GuidedSearchPage` fires queries on every keystroke via raw `useVisaLookup(visaQuery)` with no debounce.
  - Submit behaviour: `GuidedSearchPage` renders results inline and shows a paginated `CaseCard` list; `GuidedSearchFlow` redirects to `/cases?visa_type=...` discarding results.
  - Legal concepts: `GuidedSearchPage` stores concept IDs; `GuidedSearchFlow` stores concept names — these may produce different API payloads.
- **Why it matters**: Since `TaxonomyPage` is currently the same as `GuidedSearchPage`, the `GuidedSearchFlow` component is orphaned and untested from the user perspective. When someone wires up a real TaxonomyPage, they may reach `GuidedSearchFlow` and get a different UX than documented. Maintenance burden is doubled.
- **Fix**: Consolidate into one canonical wizard component. Keep `GuidedSearchFlow` (it has the better debounce and review step), update it to render results inline rather than redirecting, and have `GuidedSearchPage` be a thin wrapper.
- **Cross-cuts**: F1 fix will surface this divergence immediately.

---

### F3. Country step: no search input, 30-item scrollable list on mobile is unusable — HIGH
- **Where**: `frontend/src/pages/GuidedSearchPage.tsx:571-615`, `frontend/src/components/taxonomy/GuidedSearchFlow.tsx:457-498`
- **What's wrong**: The country step in both implementations renders a scrollable list of all countries (up to 30 or all countries in the DB). `GuidedSearchPage` shows a `max-h-96 overflow-y-auto` list with every country as a clickable row. There is no search/filter input for the country list. A self-rep user whose country is "Sri Lanka" or "Bangladesh" must scroll through an unsorted-visually-overwhelming list.
- **Why it matters**: Country of origin is a high-stakes, emotionally loaded field for immigration applicants. Friction here creates anxiety. A combobox/filter input is the standard pattern for 30+ item lists.
- **Fix**: Add an `<input>` filter above the country list in both wizard implementations (or the consolidated one post-F2). Filter client-side since the list is already loaded. Also consider sorting alphabetically rather than by case_count descending (current order privileges Australia/China/India at top, which may not match a given user's need). The `GuidedSearchFlow` version renders a 12-item grid (`countries.slice(0, 12)`) which at least limits cognitive load, but 12 hard-coded items with no search is equally problematic if the user's country is not in the top 12.
- **Cross-cuts**: `CountryDropdown` component uses a native `<select>` — consistent pattern for standalone use but inconsistent with the wizard's button-grid approach.

---

### F4. No keyboard submit on search inputs (Enter key not wired) — HIGH
- **Where**: `frontend/src/pages/GuidedSearchPage.tsx:492-499` (visa input), `frontend/src/pages/GuidedSearchPage.tsx:698-706` (judge input), `frontend/src/components/taxonomy/GuidedSearchFlow.tsx:379-392`, `frontend/src/components/taxonomy/VisaQuickLookup.tsx:78-91`, `frontend/src/components/taxonomy/JudgeAutocomplete.tsx:81-95`
- **What's wrong**: All search inputs in the wizard and taxonomy components are bare `<input type="text">` elements not wrapped in a `<form>`. Pressing Enter does nothing — does not submit the search, does not advance the step. The only action available is mouse/tap click on a result row or the Next/Search button. `SemanticSearchPage` correctly wraps its input in `<form onSubmit={handleSubmit}>` (line 103), making it the sole compliant search input in this domain.
- **Why it matters**: Enter-to-submit is a universal search affordance. Keyboard-primary users (power users, screen reader users, mobile users with a Bluetooth keyboard) cannot complete the guided flow without a pointer device.
- **Fix**: Wrap each search step's input+results in a `<form onSubmit={...}>` that either selects the first result or advances the step. For the visa input, `onSubmit` should auto-select if exactly one result matches. Add `type="search"` to get native clear-button on mobile and correct ARIA semantics.
- **Cross-cuts**: Accessibility — WCAG SC 2.1.1 Keyboard.

---

### F5. Visa selection auto-advances step without confirmation affordance — MEDIUM
- **Where**: `frontend/src/components/taxonomy/GuidedSearchFlow.tsx:127-134`
- **What's wrong**: `handleSelectVisa` calls `handleNext()` immediately after setting the visa subclass. Selecting a visa item auto-advances to step 2 with no visual confirmation of the selection and no opportunity to review. If the user mis-taps, they cannot undo without pressing Back. `GuidedSearchPage` does not auto-advance — the user must explicitly click Next — creating an inconsistency between the two implementations.
- **Why it matters**: Immigration applicants are careful; they may want to verify the visa number before advancing. Auto-advance without a review step creates anxiety in a high-stakes interaction.
- **Fix**: After selection, show the selected visa highlighted in the list (the `aria-pressed` pattern already used in `GuidedSearchPage`) and keep the Next button as the explicit advance mechanism.

---

### F6. Semantic search: no stable anchor during skeleton-to-results transition — MEDIUM
- **Where**: `frontend/src/pages/SemanticSearchPage.tsx:195-207`
- **What's wrong**: The result count (`"X results"`) renders as a `<p>` tag in the same visual flow as the cards. When results arrive, the 4-skeleton loading divs collapse and cards expand — total page height changes significantly and the layout shifts. The `SimilarityBadge` (the primary differentiator for semantic vs keyword search) appears top-right in the card where it competes with the title. Users reading left-to-right see the title first; the score reads as secondary metadata rather than the primary ranking signal.
- **Why it matters**: Layout shift during result load is disorienting. The similarity score is the reason a user chose semantic over keyword search — it should be visually dominant, not tucked in a corner.
- **Fix**: Pin a result header div (count + sort label) at the top of the results zone before the skeleton renders, so it occupies stable space during load. Consider moving `SimilarityBadge` to before the title or using a two-column layout (score left, content right) to foreground the match quality.

---

### F7. Semantic search skeleton uses `bg-muted` — undefined token — MEDIUM
- **Where**: `frontend/src/pages/SemanticSearchPage.tsx:175`
- **What's wrong**: `<div className="h-20 animate-pulse rounded-lg bg-muted" />` — the tokens file defines no `muted` background colour. Token-defined backgrounds are: `surface`, `background`, `card`, `sidebar`, `surface-hover`. Using `bg-muted` will resolve to an undefined Tailwind utility, rendering as transparent (invisible skeleton) on light theme or an uncontrolled colour on dark theme.
- **Why it matters**: An invisible skeleton provides no loading feedback. Users see a blank area and may assume the search failed rather than is loading.
- **Fix**: Change `bg-muted` to `bg-surface` (token-defined) for the skeleton divs.

---

### F8. Saved Searches page: creation affordance sends users away — HIGH
- **Where**: `frontend/src/pages/SavedSearchesPage.tsx:80-92`
- **What's wrong**: The only page-level action is a ghost button labelled "Go to Cases to create new searches" that navigates away to `/cases`. A first-time visitor landing on `/saved-searches` with zero saved searches sees: page title, description, an empty-state panel, and a button that takes them away. There is no inline way to start building a search. The `SavedSearchPanel` empty state (line 137-148 of `SavedSearchPanel.tsx`) also describes how to create a search but provides no link or CTA.
- **Why it matters**: Self-rep users who bookmark the saved searches page as their starting point are stranded. The empty-state text "Apply filters and click Save Search to create your first saved search" is accurate but not actionable from where the user is standing.
- **Fix**: Change the page action to a primary CTA styled with `bg-accent` (not a ghost border button). In `SavedSearchPanel`'s empty state, add a `<Link to="/cases">Start browsing cases</Link>` button. Consider making the compact empty state variant always show an actionable link.

---

### F9. SavedSearchCard delete button has no confirmation — HIGH
- **Where**: `frontend/src/components/saved-searches/SavedSearchCard.tsx:173-179`
- **What's wrong**: The `onDelete` handler fires immediately on click with no confirm dialog, toast with undo, or accessible label (only a `title` attribute, which is not surfaced to screen readers or touch users). Clicking the trash icon destroys the saved search permanently. For keyboard users, Tab order places Delete immediately after Share and Edit — an easy misfire.
- **Why it matters**: Saved searches represent accumulated research work. Accidental deletion is a significant frustration for a user who may have spent time crafting a complex filter set.
- **Fix**: Add a confirm step — either a `ConfirmModal` (already exists in the shared component library per CLAUDE.md) or a destructive-action toast pattern (`toast("Deleted", { action: { label: "Undo", onClick: restore } })`). Add `aria-label={t("saved_searches.delete_aria", { name: search.name })}` to the button.

---

### F10. SavedSearchCard action buttons lack accessible labels — MEDIUM
- **Where**: `frontend/src/components/saved-searches/SavedSearchCard.tsx:159-179`
- **What's wrong**: Share, Edit, and Delete are icon-only buttons with `title` attributes only. `title` tooltips are inaccessible to touch users and are not surfaced by screen readers as accessible names (browsers differ). The Play/Run button has an inline text label; the other three do not.
- **Why it matters**: Users unfamiliar with the Share2/Edit2/Trash2 icons (common among non-technical immigration applicants) cannot identify the action without hovering. On touch devices, hover-revealed titles never appear.
- **Fix**: Add `aria-label` to all three icon-only buttons. On mobile consider showing short text labels (Share, Edit, Delete) for the highest-consequence actions — at minimum for Delete.

---

### F11. GuidedSearchFlow country step hard-clips to 12 countries with no overflow path — MEDIUM
- **Where**: `frontend/src/components/taxonomy/GuidedSearchFlow.tsx:458`
- **What's wrong**: `countries.slice(0, 12)` shows only the 12 highest-case-count countries with no indication that more countries exist or how to access them. If a user's country is 13th or below, the UI offers no path to selection. There is no "Show more" button, no search input, and no affordance that the list is truncated.
- **Why it matters**: Users from countries outside the top 12 will silently receive worse search results (no country filter applied) without understanding why their country was absent.
- **Fix**: Add a search input above the grid that filters the full country list, OR add a "Show all countries" toggle after the 12-item grid. The skip button "Skip (search all countries)" is good fallback copy but should not be the only path for users outside the top 12.

---

### F12. Semantic search: provider toggle is developer-facing, not user-facing — MEDIUM
- **Where**: `frontend/src/pages/SemanticSearchPage.tsx:129-147`
- **What's wrong**: A "Model: OpenAI / Gemini" toggle is exposed at the search form level. Neither label carries semantic meaning for a non-technical self-rep immigration applicant. The active state is indicated only by `bg-accent-muted text-accent` vs plain `hover:text-foreground` — a low-contrast distinction with no border or shape change.
- **Why it matters**: Exposing provider choice to users who cannot evaluate the options adds cognitive noise at the point of highest intent. It implies one option may be "better" without any guidance.
- **Fix**: Either remove the toggle from the public UI (put it in settings or behind an advanced disclosure) or rename the options to user-meaningful terms ("Standard" / "Advanced") with a tooltip. If it stays visible, increase the active-state contrast: add a border or filled background to the selected button.

---

### F13. GuidedSearchPage progress indicator: step labels hidden on mobile — LOW
- **Where**: `frontend/src/pages/GuidedSearchPage.tsx:449-458`
- **What's wrong**: Step labels use `hidden md:block` — they disappear below the `md` (768px) breakpoint. On mobile, the user sees numbered circles and connector lines only with no label text describing the current step.
- **Why it matters**: Immigration applicants are heavy mobile users. A step labelled only "2" with no text descriptor is less reassuring than "Step 2: Choose Country."
- **Fix**: Show abbreviated step labels on mobile (truncated with `truncate max-w-[4rem]`) or show only the current step's label inline below the circles row.

---

### F14. Legal concepts step: selected chips have no remove affordance — MEDIUM
- **Where**: `frontend/src/pages/GuidedSearchPage.tsx:631-645`
- **What's wrong**: Selected legal concepts are shown as amber chips but there is no X/close icon on each chip. To deselect a concept, the user must scroll back to the concept in the list below and click it again. The chip is purely decorative — it confirms selection but does not act as a removal control. The 5-concept cap means the user must actively remove concepts to add different ones.
- **Why it matters**: Without a remove button on the chip, making room for a different concept requires hunting through a long list. The max-concepts toast error fires when the user tries to add a 6th concept, but the user may not immediately know how to make room.
- **Fix**: Add `<button onClick={() => toggleConcept(id)}><X className="h-3 w-3" /></button>` inside each selected concept chip.

---

### F15. SaveSearchModal: backdrop uses raw hex colour, not a design token — LOW
- **Where**: `frontend/src/components/saved-searches/SaveSearchModal.tsx:131`
- **What's wrong**: `bg-[#111820]/65` is a Tailwind arbitrary value using a hardcoded hex. The tokens file defines `dark.background.DEFAULT: "#111820"`. This bypasses the token system and will break if the dark background colour is updated in `tokens.json`.
- **Why it matters**: Minor token-system integrity concern. Not a user-facing visual bug in current state.
- **Fix**: Replace with a CSS variable reference `bg-[var(--color-dark-background)]/65` or introduce a dedicated `--color-overlay` token in `tokens.json`.

---

### F16. Guided search results: no refine-search path with state preserved — MEDIUM
- **Where**: `frontend/src/pages/GuidedSearchPage.tsx:244-307`
- **What's wrong**: The "New Search" button (line 259-269) resets `selectedFlow` to null and clears all state. If a user wants to refine their search (e.g. change the country), they must re-enter all fields from step 1. There is no "Refine Search" path that returns to the wizard with existing values pre-populated.
- **Why it matters**: Iterative search refinement is the primary research workflow for a self-rep applicant. Finding 0 or 300 results and wanting to adjust one parameter is common. Forcing a full restart adds 3–4 interaction steps per refinement.
- **Fix**: Add a "Refine Search" button alongside "New Search" that returns to the last wizard step with `flowState` and `currentStep` preserved. The state already lives in component scope — it just needs to not be cleared on the results-to-wizard transition.

---

### F17. No clear-filter affordance in SavedSearchPanel filtered empty state — LOW
- **Where**: `frontend/src/components/saved-searches/SavedSearchPanel.tsx:151-160`
- **What's wrong**: When `count > 0` but `filteredSearches.length === 0` (the within-panel search yields no matches), the empty state shows "No searches match your query" with no suggestion to clear the filter. The user must manually empty the search input.
- **Why it matters**: Minor; the input is visible above the empty state. A "Clear filter" link reduces friction.
- **Fix**: Add `<button onClick={() => setSearchQuery("")}>Clear filter</button>` inside the no-results empty state.

---

### F18. Legal concepts stored as names in GuidedSearchFlow, as IDs in GuidedSearchPage — MEDIUM
- **Where**: `frontend/src/components/taxonomy/GuidedSearchFlow.tsx:144-151` (stores `concept.name`), `frontend/src/pages/GuidedSearchPage.tsx:216-233` (stores `concept.id`)
- **What's wrong**: The two wizard implementations use different identifiers for selected legal concepts. `GuidedSearchFlow.toggleConcept` stores `conceptName` as a string; `GuidedSearchPage.toggleConcept` stores `concept.id`. If the API expects one format, one implementation silently produces wrong results.
- **Why it matters**: A user running a concepts-filtered search via one entry point may get different results from the same search via the other entry point. This is a data integrity issue invisible to the user but producing incorrect search results.
- **Fix**: Standardise on IDs (stable; names may change). Update `GuidedSearchFlow` to store `concept.id`. Verify the API accepts IDs.

---

### F19. VisaQuickLookup navigates with `visa_subclass` param; other components use `visa_type` — MEDIUM
- **Where**: `frontend/src/components/taxonomy/VisaQuickLookup.tsx:55`
- **What's wrong**: `navigate('/cases?visa_subclass=...')`. The `buildSearchParams` function in `SavedSearchesPage.tsx` (line 16) and `GuidedSearchFlow` result navigation (line 188-190) both use `visa_type` as the param key. If `/cases` reads `visa_type` but `VisaQuickLookup` writes `visa_subclass`, the filter is silently dropped.
- **Why it matters**: A user who selects a visa via the quick lookup and lands on the unfiltered cases list will be confused. No error is shown; the filter is simply absent.
- **Fix**: Verify which param key `/cases` reads and standardise all navigation calls to that key.

---

### F20. SavedSearchCard result count badge has no accessible unit label — LOW
- **Where**: `frontend/src/components/saved-searches/SavedSearchCard.tsx:111-115`
- **What's wrong**: The result count badge renders a bare localised number with only a `title` attribute. Screen reader users hear a bare number without context ("1,247" rather than "1,247 cases").
- **Why it matters**: Minor accessibility and internationalisation concern.
- **Fix**: Add `aria-label={t("saved_searches.result_count_aria", { count: currentCount })}` to the badge span.

---

## Patterns observed

**Consistent:**
- Design token colour variables used throughout (`text-accent`, `bg-surface`, `border-border`) — token discipline is strong.
- `aria-pressed` pattern for toggle buttons applied correctly in both wizard implementations.
- `animate-spin` placed on a wrapper `<div>`, not directly on `Loader2` — the documented gotcha is correctly followed in `GuidedSearchPage:507` and `GuidedSearchPage:799`.
- Sonner `toast` for success/error feedback is consistent across all pages.
- `useTranslation` with `defaultValue` fallback pattern applied consistently throughout.
- `useCallback` and `useMemo` usage is thorough with no obvious stale closures.

**Inconsistent:**
- Debounce strategy: `GuidedSearchFlow` uses ref-based 300 ms debounce; `GuidedSearchPage` fires unbounced queries on every keystroke; `VisaQuickLookup` and `JudgeAutocomplete` use ref-based debounce. Three different patterns for the same interaction.
- Step navigation: `GuidedSearchPage` uses 1-indexed `currentStep`; `GuidedSearchFlow` resets to `step(0)` then starts at `step(1)` — off-by-one risk during consolidation.
- Country selection UI: `GuidedSearchPage` uses a vertical scrollable list; `GuidedSearchFlow` uses a 12-item 2-column grid; `CountryDropdown` uses a native `<select>`. Three different UI patterns for the same data.
- Loading states: `GuidedSearchPage` shows a `Loader2` spinner + "Searching..." text; taxonomy components show plain "Loading..." text with no spinner.
- Form wrapping: `SemanticSearchPage` correctly uses `<form onSubmit>`; all wizard step inputs are bare `<input>` elements.

**Missing:**
- No keyboard navigation within dropdown results (arrow keys to move between result items, Enter to select).
- No `role="combobox"` / `aria-autocomplete` / `aria-controls` / `aria-activedescendant` on any autocomplete input — all fail ARIA 1.2 combobox pattern.
- No transition animation between wizard steps — content replaces instantly with no motion cue (step progress bar animates via CSS transition but the content area does not).
- No pagination or virtual scroll in `LegalConceptBrowser` — all concepts rendered at once.

---

## Open questions for lead

1. **Route intent**: Are `TaxonomyPage` and `SearchTaxonomyPage` intentionally aliases pending future work, or were they accidentally left as pass-throughs? Is there a design spec for what each route should show?
2. **Canonical wizard**: Which implementation should be treated as canonical — `GuidedSearchPage` (inline results) or `GuidedSearchFlow` (redirect to cases)? Inline results better serves the research workflow but adds complexity to the component.
3. **Provider toggle**: Is the OpenAI/Gemini toggle in `SemanticSearchPage` intentionally user-facing, or is it a developer-test feature that slipped through to production?
4. **Legal concept identifier**: Does the guided search API accept concept IDs, concept names, or both? This determines which implementation is correct (F18).
5. **Visa filter param name**: Is the `/cases` route filter key `visa_type` or `visa_subclass`? At least two components disagree (F19).

---

## Files inspected

| File | Lines read |
|---|---|
| `frontend/src/pages/GuidedSearchPage.tsx` | 1–839 |
| `frontend/src/pages/SemanticSearchPage.tsx` | 1–210 |
| `frontend/src/pages/SavedSearchesPage.tsx` | 1–113 |
| `frontend/src/pages/TaxonomyPage.tsx` | 1–5 |
| `frontend/src/pages/SearchTaxonomyPage.tsx` | 1–5 |
| `frontend/src/components/saved-searches/SavedSearchPanel.tsx` | 1–180 |
| `frontend/src/components/saved-searches/SavedSearchCard.tsx` | 1–186 |
| `frontend/src/components/saved-searches/SaveSearchModal.tsx` | 1–277 |
| `frontend/src/components/taxonomy/GuidedSearchFlow.tsx` | 1–847 |
| `frontend/src/components/taxonomy/VisaQuickLookup.tsx` | 1–148 |
| `frontend/src/components/taxonomy/LegalConceptBrowser.tsx` | 1–103 |
| `frontend/src/components/taxonomy/JudgeAutocomplete.tsx` | 1–152 |
| `frontend/src/components/taxonomy/CountryDropdown.tsx` | 1–100 |
| `frontend/src/tokens/tokens.json` | 1–80 |
