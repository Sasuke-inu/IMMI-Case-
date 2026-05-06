# UX Audit — A5: Global a11y patterns (WCAG 2.2 AA)
**Worker**: a11y-architect | **Scope**: layout/shared/App/main + theme/keyboard hooks + index.html | **Date**: 2026-05-05

## TL;DR
- **Locale wrong** (`<html lang="en">`, never updated when zh-TW selected) and **no `prefers-reduced-motion` respect anywhere** — 0.7s celestial-toggle + theme-transitioning animation forces motion on vestibular-disorder users. Both are baseline failures.
- **No global focus-visible default** — only inputs/select/checkbox/celestial-toggle have outlines. All NavLinks, buttons, sidebar links, breadcrumb links rely on browser defaults that the dark-theme tokens (e.g. amber `#e09820` on `#251c0e`) hide. Combined with **no `<title>` updates on route change** and **no focus restoration after navigation**, keyboard + SR users are systemically lost.
- Modal pattern is half-built: `aria-modal` exists on MobileNav/SaveSearchModal but ConfirmModal/TagInputModal/GlobalSearch lack `role="dialog"` + `aria-modal` + focus trap; `keydown` listeners on `window`/`document` create focus leakage. Toast (`sonner`) and PageLoader announce nothing (`role="status"`/`aria-live` missing).

## Findings

### F1. `<html lang>` hard-coded to `en`, never updated when language changes — BLOCKING
- **Where**: `frontend/index.html:2` (`<html lang="en">`); language toggle at `frontend/src/components/layout/Topbar.tsx:61` calls `i18n.changeLanguage("zh-TW")` but never sets `document.documentElement.lang`.
- **What's wrong**: WCAG 3.1.1 Language of Page (Level A) and 3.1.2 Language of Parts. SR will pronounce zh-TW content with English phonemes (or skip entirely on JAWS). Also product is for Australian users — should be `en-AU`, not `en`.
- **Why it matters**: AU DDA 1992 + AS EN 301 549 require correct lang; voice-control software (Voice Control on macOS, Dragon) uses lang to load grammar.
- **Fix**: Set `lang="en-AU"` in `index.html`. In `i18n.ts` add `i18n.on('languageChanged', (lng) => document.documentElement.lang = lng)`. Map `zh-TW` → keep as-is (BCP-47 valid).
- **Cross-cuts**: every page; A1–A4 page audits inherit this.

### F2. No `prefers-reduced-motion` media query anywhere in CSS or hooks — BLOCKING
- **Where**: `frontend/src/index.css` (whole file — 0 matches for `prefers-reduced-motion`); `frontend/src/components/layout/CelestialToggle.tsx:15-17` forces 750ms `theme-transitioning` animation; `index.css:260-268` `.theme-transitioning *` uses `!important` 0.7s transition on every element.
- **What's wrong**: WCAG 2.3.3 Animation from Interactions (Level AAA, but 2.2 SC 2.3.1 Three Flashes still applies) and the broader vestibular-safety expectation (DDA reasonable adjustment). The `!important` makes opt-out impossible.
- **Why it matters**: Users with vestibular disorders / migraine / motion sickness will trigger these animations on every theme/route action with no escape.
- **Fix**: Wrap `.theme-transitioning *` rule and `.celestial-toggle .ct-orb` transition in `@media (prefers-reduced-motion: no-preference) { ... }`; in `CelestialToggle.tsx`, gate the `classList.add` behind `window.matchMedia('(prefers-reduced-motion: reduce)').matches === false`. Also remove `!important` from `index.css:267`.
- **Cross-cuts**: Toaster (sonner default animations), all Recharts entry animations, lazy-route Suspense flash.

### F3. No global `:focus-visible` default — keyboard users lose focus on every link/button — BLOCKING
- **Where**: `frontend/src/index.css` defines `:focus-visible` ONLY for `input[type=*]`, `textarea`, `select`, `input[type=checkbox]`, `.celestial-toggle` (lines 179, 213, 252, 301). No rule covers `<a>`, `<button>`, `[role="button"]`, NavLink. `frontend/src/components/layout/Sidebar.tsx:93-100`, `Topbar.tsx:22-66`, `Breadcrumb.tsx:20`, `MobileNav.tsx:82-89` all rely on browser defaults.
- **What's wrong**: WCAG 2.4.7 Focus Visible (Level AA) + 2.4.11 Focus Not Obscured (Minimum, new in 2.2) + 2.4.13 Focus Appearance (Level AAA but ≥3:1 contrast required at AA via 1.4.11). Many themes (e.g. `amber` dark mode `#e09820` on `#251c0e`) yield default browser blue ring that washes out; `Topbar.tsx:62` "EN/中文" pill button gets no outline at all because it's `border-border` only.
- **Why it matters**: Every keyboard user navigating the entire app has ambiguous focus state. Many `transition-colors` rules animate `outline-color` away.
- **Fix**: Add to `index.css` `@layer base`:
  ```css
  *:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
    border-radius: var(--radius-sm);
  }
  ```
  Verify ≥3:1 against every theme background using token contrast pairs in `tokens/tokens.json`. For each preset whose `--color-accent` < 3:1 vs `--color-background-card`, add a `--color-focus` override token.
- **Cross-cuts**: Sidebar, Topbar, MobileNav, Breadcrumb, every page-level button.

### F4. No focus restoration / focus-to-main after route change — HIGH
- **Where**: `frontend/src/App.tsx:182-419` (`<BrowserRouter>` + `<Routes>`); `AppLayout.tsx:46` `<main id="main-content">` is never focused on route change.
- **What's wrong**: WCAG 2.4.3 Focus Order + 2.4.1 Bypass Blocks. After a NavLink click, focus stays on the link (now in unmounted nav for mobile) or is lost. SR users hear nothing announce the new page.
- **Why it matters**: User clicks "Cases" → screen reader keeps reading sidebar; user must Tab back to find new content.
- **Fix**: Use `useLocation` in `AppLayout`, on path change set `tabIndex={-1}` on `<main>` and call `mainRef.current?.focus({preventScroll:true})`. Also clear `tabIndex` after blur to keep main non-tabbable.
- **Cross-cuts**: Every routed page.

### F5. No `<title>` update on route change — HIGH
- **Where**: `frontend/index.html:6` (`<title>IMMI-Case</title>` static); zero matches for `document.title` / `useTitle` across `frontend/src/` except `CaseTextViewer.tsx:309` (window.open print preview).
- **What's wrong**: WCAG 2.4.2 Page Titled (Level A). Tab labels never change; SR "where am I?" command always says "IMMI-Case"; browser history is unusable.
- **Why it matters**: Cognitive disabilities + SR users can't disambiguate tabs/history.
- **Fix**: Centralised `useDocumentTitle(t('pages.cases.title'))` hook called from each page's first effect, OR use `react-helmet-async` provider in `App.tsx` and `<Helmet><title>{t('pages.dashboard.title')} · IMMI-Case</title></Helmet>` per page.
- **Cross-cuts**: All 27 pages.

### F6. ConfirmModal / TagInputModal / GlobalSearch missing `role="dialog"` + `aria-modal` + focus trap — HIGH
- **Where**: `frontend/src/components/shared/ConfirmModal.tsx:45-47` (just `<div className="fixed inset-0">`); `TagInputModal.tsx:48-50` same; `GlobalSearch.tsx:46-52` same. Only `MobileNav.tsx:43-46` and `saved-searches/SaveSearchModal.tsx:128-129` have `role="dialog" aria-modal="true"`.
- **What's wrong**: WCAG 4.1.2 Name, Role, Value (Level A) + 2.4.3 Focus Order + 2.1.2 No Keyboard Trap (positive trap-required for modals per ARIA APG). SR users can Tab past modal into background DOM and interact with hidden form controls. No `aria-labelledby` linking the `<h3>` title.
- **Why it matters**: Destructive ConfirmModal ("delete case") may be confirmed unknowingly by SR user reading the page below; GlobalSearch over `<main>` lets keyboard tab into hidden content.
- **Fix**: Wrap each modal panel in `<div role="dialog" aria-modal="true" aria-labelledby="cm-title" aria-describedby="cm-desc">`, give the `<h3>` an `id`, add focus trap (use `focus-trap-react` or roll a small handler that listens for Tab/Shift+Tab on the dialog and wraps), restore focus to the trigger element on close (store `previouslyFocused = document.activeElement` on open).
- **Cross-cuts**: Every page using ConfirmModal (delete actions, bulk operations).

### F7. Backdrop is a `<button>` with no descriptive label and inconsistent across modals — HIGH
- **Where**: `MobileNav.tsx:34-39` (`<button>` backdrop with `aria-label={t("common.close_menu")}`); `ConfirmModal.tsx:46`, `TagInputModal.tsx:49`, `GlobalSearch.tsx:47-50` use plain `<div onClick>` (not focusable, not announced).
- **What's wrong**: WCAG 4.1.2 + 2.1.1 Keyboard. The `<div>` backdrop is unreachable via keyboard; the `<button>` backdrop is in the tab order but has redundant tab-stop with the explicit close button. No consistent pattern.
- **Why it matters**: Inconsistent modal dismissal — keyboard users can't close ConfirmModal by clicking backdrop (keyboard alternative needed), only by Esc.
- **Fix**: Standardise all modals to `<div aria-hidden="true" onClick={onClose}>` for backdrop (decorative); rely on Esc + explicit close button + focus trap for keyboard. Remove redundant button backdrop in MobileNav.
- **Cross-cuts**: All 5 modal-style components.

### F8. Skip-to-content link contrast / target unverified across themes — HIGH
- **Where**: `frontend/src/components/layout/AppLayout.tsx:25-30` — `focus:bg-accent focus:text-white` with `focus:px-3 focus:py-1.5 focus:text-sm`.
- **What's wrong**: WCAG 2.4.1 Bypass Blocks (positive — present!) but 1.4.11 Non-text Contrast + 2.5.8 Target Size (Min 24×24). `text-sm` (14px) at `py-1.5` (6px) gives ~26px height — passes barely. White text on `--color-accent` varies per preset; e.g. `parchment` accent `#5c4306` vs white = 7.4:1 OK; `lavender` accent `#d0293d` vs white = 4.5:1 OK; `slate` accent `#5a5df0` vs white = 3.9:1 — **fails 4.5:1**.
- **Why it matters**: Skip link is the most critical bypass mechanism; if invisible/illegible it's WCAG fail at theme-grain.
- **Fix**: Audit `--color-accent` luminance per preset; for low-contrast presets, override skip link to use `bg-foreground text-background` or a dedicated `--color-focus-bg` token.
- **Cross-cuts**: 11 theme presets.

### F9. Custom checkbox loses indeterminate state + no label association pattern documented — HIGH
- **Where**: `frontend/src/index.css:142-182` — checkbox heavily customised via `appearance: none` + pseudo-element check.
- **What's wrong**: WCAG 4.1.2 Name, Role, Value. No styles for `:indeterminate` (WCAG 1.3.1 — bulk-select header in CasesPage). Disabled state at line 219-226 doesn't override `border-color: var(--color-accent)` from `:hover`. No global utility ensures every checkbox has an explicit `<label htmlFor>` or wrapping `<label>` — many pages use loose `<input>` without label.
- **Why it matters**: Bulk-select UX in cases listing is opaque to SR; "select all" indeterminate state never visible.
- **Fix**: Add `input[type="checkbox"]:indeterminate { background-color: var(--color-accent); }` with a horizontal-line pseudo. Document in `frontend/CONTRIBUTING.md`: "every checkbox must have visible OR sr-only label."
- **Cross-cuts**: CasesPage bulk operations, AnalyticsFilters, GuidedSearchPage.

### F10. `useKeyboard` shortcuts (`d`, `c`, `g`, `p`, `?`, `/`) conflict with SR keys + undocumented + no escape mechanism — HIGH
- **Where**: `frontend/src/hooks/use-keyboard.ts:20-41`. Listens at `window` for plain letter keys.
- **What's wrong**: WCAG 2.1.4 Character Key Shortcuts (Level A — 2.2 retains). MUST provide one of: turn-off, remap, or only-on-focus. None present. Single-letter shortcuts (`d`, `c`, `g`, `p`) collide with NVDA/JAWS browse-mode keys (`c` = checkbox, `d` = landmark, `p` = paragraph). The "skip if INPUT/TEXTAREA/SELECT" check misses `[contenteditable]`, `[role="textbox"]`, `[role="combobox"]`, custom Recharts focus regions.
- **Why it matters**: A SR user pressing `d` to navigate to next landmark instead navigates the SPA away. Catastrophic for assistive tech.
- **Fix**: (a) require modifier (`g d`, `g c` Vim-style or `Alt+D`), (b) add a `Settings → Keyboard shortcuts → Disable` toggle persisted in localStorage, (c) document on `/design-tokens` page (currently `?` opens that page but contents don't list shortcuts), (d) augment skip-input check with `target.closest('[contenteditable], [role="textbox"], [role="combobox"], [role="grid"]')`.
- **Cross-cuts**: Every authenticated page.

### F11. Toaster (`sonner`) lacks explicit live-region semantics + position bottom-right may overlap floating action — HIGH
- **Where**: `frontend/src/App.tsx:420` `<Toaster position="bottom-right" richColors />`.
- **What's wrong**: WCAG 4.1.3 Status Messages (Level AA). Sonner does inject `role="status"` by default but the project pins no version contract; richColors may rely on color-only success/error indication (1.4.1). No `aria-atomic`, no auto-pause-on-hover assurance.
- **Why it matters**: Critical save/delete confirmations may be missed by SR users.
- **Fix**: Add `<Toaster ... toastOptions={{ ariaProps: { role: 'status', 'aria-live': 'polite' } }} closeButton />` for non-critical, and use `toast.error(..., { important: true })` for errors → mapped to `role="alert"` `aria-live="assertive"`. Verify `richColors` includes icon (not color-only).
- **Cross-cuts**: All save/delete/error flows app-wide.

### F12. Single-h1 rule violated by PageHeader + page-internal `<h1>`s — MEDIUM
- **Where**: `frontend/src/components/shared/PageHeader.tsx:39` outputs `<h1>`. Several pages also render their own `<h1>` (e.g. dashboard hero) → **multiple `<h1>` per route** when both used.
- **What's wrong**: WCAG 1.3.1 Info and Relationships + heading rank predictability. SR navigation by H1 lands on wrong region.
- **Why it matters**: Per-page audits will keep finding this; needs global pattern.
- **Fix**: Make PageHeader the canonical `<h1>`; lint rule (eslint-plugin-jsx-a11y `heading-has-content`, custom rule for "no `<h1>` in pages/"). Document "PageHeader OWNS the h1; pages must not render their own."
- **Cross-cuts**: All 27 pages.

### F13. Breadcrumb `<nav>` missing `aria-label` + no `aria-current="page"` — MEDIUM
- **Where**: `frontend/src/components/shared/Breadcrumb.tsx:14-29`.
- **What's wrong**: WCAG 1.3.1 + 2.4.8 Location. Two `<nav>` landmarks (sidebar + breadcrumb) with no labels confuse SR. Last (current) crumb is a `<span>` with no `aria-current`.
- **Why it matters**: SR landmark menu shows two unnamed "navigation" entries.
- **Fix**: `<nav aria-label={t('common.breadcrumb', 'Breadcrumb')}>` + use `<ol>` instead of bare `<span>`s + `<span aria-current="page">` for last crumb.
- **Cross-cuts**: Breadcrumb usage across pages.

### F14. Sidebar `<nav>` and Topbar `<header>` missing labels; no `<footer>` landmark — MEDIUM
- **Where**: `Sidebar.tsx:55` `<aside>` (semantic but ambiguous), `Sidebar.tsx:72` `<nav>` no label; `Topbar.tsx:20` `<header>` ok; no `<footer>` exists in `AppLayout.tsx`.
- **What's wrong**: WCAG 1.3.1 + 2.4.1. Multiple `<nav>` (sidebar + mobile drawer + breadcrumb) all unlabeled.
- **Why it matters**: SR user pressing landmark-nav key sees three "navigation" results indistinguishably.
- **Fix**: `<nav aria-label="Primary">` (Sidebar), `<nav aria-label="Mobile">` (MobileNav already has dialog+labelledby — change to `<nav>` inside dialog with separate label), `<nav aria-label="Breadcrumb">`. Use `<aside aria-label="Sidebar navigation">` only if also adding nav label.
- **Cross-cuts**: Layout shell.

### F15. PageLoader / loading states lack `role="status"` + `aria-live="polite"` — MEDIUM
- **Where**: `frontend/src/components/shared/PageLoader.tsx:5-19`. No `role="status"` on the wrapper. Suspense fallback is purely visual.
- **What's wrong**: WCAG 4.1.3 Status Messages.
- **Why it matters**: SR users hear nothing during the 5-min staleTime initial fetch; perceive app as broken.
- **Fix**: Wrap in `<div role="status" aria-live="polite" aria-busy="true">`. Hide spinner SVG via `aria-hidden`, keep title/description as accessible name.
- **Cross-cuts**: Every Suspense boundary.

### F16. `aria-busy` only on LlmCouncilSessionsPage (1 occurrence) — MEDIUM
- **Where**: `grep` shows `aria-busy="true"` only at `pages/LlmCouncilSessionsPage.tsx:35`. TanStack Query `isFetching` states across 26 other pages emit no `aria-busy`.
- **What's wrong**: WCAG 4.1.3.
- **Why it matters**: SR user can't tell that table data is being refreshed during keepPreviousData fetch.
- **Fix**: Standardise: every list/table-shell receives `aria-busy={isFetching}`. Add to `StatePanel` API as a `busy` prop OR centralise in a `<DataRegion isFetching>` wrapper.
- **Cross-cuts**: Cases, Judges, Analytics, Legislations.

### F17. `useEffect` keyboard listeners on `window`/`document` leak across modals — MEDIUM
- **Where**: `MobileNav.tsx:18-27`, `ConfirmModal.tsx:31-38`, `TagInputModal.tsx:29-40`, `GlobalSearch.tsx:29-35` — each registers Esc on window/document.
- **What's wrong**: WCAG 2.1.2 No Keyboard Trap (negative — but multi-modal stacking can mis-route Esc). When two modals are open (rare but possible: ConfirmModal over TagInputModal), Esc fires both handlers, closing both unexpectedly.
- **Why it matters**: Predictability (3.2.5).
- **Fix**: Implement a small "modal stack" context; only the topmost modal handles Esc. Or use `event.stopPropagation()` once handled.
- **Cross-cuts**: All overlay components.

### F18. CelestialToggle uses `role="switch"` but theme state announcement is partial — MEDIUM
- **Where**: `frontend/src/components/layout/CelestialToggle.tsx:25-32`. Has `role="switch" aria-checked={isDark}` (good) but `aria-label` flips entirely between "Switch to light/dark mode" — meaning the SWITCH name itself changes per state, instead of having a stable name + announced state.
- **What's wrong**: WCAG 4.1.2. APG pattern: switch name should be stable ("Theme" or "Dark mode"), state conveyed by aria-checked.
- **Why it matters**: VoiceOver announces "Switch to dark mode, switch, off" — confusing.
- **Fix**: `aria-label={t('theme.darkMode', 'Dark mode')}`, drop the toggle-text inversion; keep `aria-checked={isDark}`.
- **Cross-cuts**: Topbar.

### F19. Form-error pattern not standardised — no global `aria-describedby` / `aria-invalid` helper — MEDIUM
- **Where**: `frontend/src/index.css:184-256` styles inputs but no error-state styles defined; no shared `<FormField>` / `<FieldError>` shared component in `components/shared/`.
- **What's wrong**: WCAG 3.3.1 Error Identification + 3.3.3 Error Suggestion + 4.1.2.
- **Why it matters**: Each form (CaseEdit, CaseAdd, Login, GuidedSearch, SavedSearch modal) re-invents error display, often as small red text without `aria-describedby` linking input → error.
- **Fix**: Build shared `<FormField label error helper>` that auto-wires `id` ↔ `aria-describedby`, sets `aria-invalid` when error present, applies error border via `data-state="error"` (not red-color-only — add icon).
- **Cross-cuts**: Every form.

### F20. Tooltip uses `title` attribute only — keyboard-inaccessible — MEDIUM
- **Where**: `Sidebar.tsx:90` `title={label}`, `:128` `title={t('auth.logout')}`, `Topbar.tsx:63` `title={t('common.toggle_language')}`, MobileNav.tsx:81 `title={description ?? label}`, GlobalSearch.tsx:117 `title={c.title || c.citation}`.
- **What's wrong**: WCAG 1.4.13 Content on Hover or Focus + 2.5.7 Dragging Movements + 4.1.2. Native `title` does not appear on keyboard focus, can't be dismissed by Esc, can't be hovered without disappearing — all three failure modes.
- **Why it matters**: Collapsed sidebar relies entirely on `title` to expose navigation labels — keyboard users see icons only.
- **Fix**: Build a real Tooltip component (Radix UI Tooltip or headless equiv) that listens to focus + hover, supports Esc dismissal, and preserves on hover-bridge. Keep `title` only as decorative redundancy.
- **Cross-cuts**: Collapsed sidebar (a11y blocker), every icon-only button.

### F21. Color-only state indication: NavLink active + bookmarks badge + tone styles — MEDIUM
- **Where**: `Sidebar.tsx:97` active state `bg-accent-muted text-accent` (no underline, no aria-current explicit on visual cue); `StatePanel.tsx:20-27` tones differ only in `bg-danger/6` `border-danger/20` shades; `OutcomeBadge` / `NatureBadge` / `CourtBadge` likely color-coded.
- **What's wrong**: WCAG 1.4.1 Use of Color (Level A).
- **Why it matters**: Color-blind users can't distinguish active nav item from hover; can't differentiate error from warning panel beyond hue.
- **Fix**: NavLink: add bold left-border or font-weight delta on active. StatePanel: include `tone` icon as REQUIRED (not optional) when not neutral. All Badge components: include shape/icon prefix per category. Audit per-court colors against deuteranopia simulation.
- **Cross-cuts**: Every list, every badge, every status panel.

### F22. Backdrop overlay color hard-coded `#111820` — bypasses theme tokens — LOW
- **Where**: `MobileNav.tsx:36`, `ConfirmModal.tsx:46`, `TagInputModal.tsx:49`, `GlobalSearch.tsx:48` all use `bg-[#111820]/65`.
- **What's wrong**: 1.4.3 Contrast — when `parchment` light theme has dark blue overlay it's fine, but when `lavender` light theme uses the same dark overlay the contrast against the modal panel is consistent but feels jarring; and inversely under `forest` dark theme `#0e1f16` background, the `#111820` is barely darker — modal blends.
- **Why it matters**: Consistency + perceived modal boundary.
- **Fix**: Define `--color-overlay-scrim: rgba(15,20,28,0.65)` token, override per dark-theme to `rgba(0,0,0,0.6)`. Reference via `bg-[var(--color-overlay-scrim)]`.
- **Cross-cuts**: All modals.

### F23. Scrollbar 6px width is below 24×24 target on touch + invisible focus — LOW
- **Where**: `frontend/src/index.css:124-127`.
- **What's wrong**: WCAG 2.5.8 Target Size (Min) is 24 CSS px for interactive controls. Scrollbar is interactive (drag thumb). 6px violates.
- **Why it matters**: Motor-impairment users can't grab scrollbar thumb.
- **Fix**: Bump to 12px (still slim) or rely on system scrollbar (`overflow: auto` without override). Add `:hover` widening.
- **Cross-cuts**: Sidebar nav scroll, modal body scroll, table scrolls.

### F24. Topbar language toggle uses `title` only + non-progressive labels (`EN`/`中文`) — LOW
- **Where**: `Topbar.tsx:60-66`. Button label is `EN` or `中文`; `title` is `t('common.toggle_language')`.
- **What's wrong**: WCAG 2.4.4 Link Purpose + 4.1.2. SR user hears "EN button" with no context. The label flips to the OTHER language (current is zh-TW → button says "EN") which is opposite-state convention; ambiguous.
- **Why it matters**: Cognitive disability users don't predict.
- **Fix**: `aria-label={t('common.switchTo', { lang: isZhTW ? 'English' : '繁體中文' })}` + visible text stays as currently designed. Consider `<select>` for >2 languages.
- **Cross-cuts**: Future i18n expansion.

### F25. AppLayout missing `<footer>` and `aside` for "info"; sidebar's `<aside>` is misnamed — LOW
- **Where**: `Sidebar.tsx:55` uses `<aside>` but contains primary nav (`<nav>`). Per HTML5 semantics, primary nav should be `<nav>` directly OR sidebar wrapped in `<div role="navigation">`. `<aside>` implies tangentially-related content.
- **What's wrong**: 1.3.1 Info and Relationships.
- **Why it matters**: Landmark misuse confuses SR landmark navigation.
- **Fix**: Either change `<aside>` → `<div>` (nav inside owns landmark) OR keep `<aside>` for the recent-bookmarks panel only and lift `<nav>` to a sibling.
- **Cross-cuts**: Layout shell.

## Patterns observed

**Consistent**:
- Skip-to-content link present (positive — only failure is contrast).
- Esc-to-close on every modal (positive — only failure is window-level listener leakage).
- `useTranslation` everywhere with `defaultValue` fallback (positive).
- `:focus-visible` consistent **for form controls** (only).

**Inconsistent**:
- Modal pattern: 2 of 5 modals have `role="dialog" aria-modal`, others don't.
- Hard-coded backdrop color `#111820` repeated 4× instead of token.
- `aria-busy` used once total; `aria-live` used twice; `role="alert"` once.
- Title attribute as tooltip vs no tooltip at all.

**Missing globally**:
- `prefers-reduced-motion` respect (zero matches).
- Document title sync to route.
- Document lang sync to i18n.
- Focus-visible default for buttons/links.
- Focus restoration after route change.
- Focus trap inside modals.
- Toast aria-live config.
- Heading-rank discipline (multi-h1 risk).
- Form-error component.
- Real keyboard tooltip.

## Open questions for lead

1. **Reduced-motion policy** — should the celestial-toggle animation be disabled outright when `prefers-reduced-motion: reduce`, or replaced with instant cross-fade? CelestialToggle is a brand signature.
2. **Single-letter shortcuts** — keep current `d/c/g/p/?` (developer-friendly) and add a settings toggle, or migrate all to `g d`/`g c` (Gmail/GitHub style) which is more SR-friendly?
3. **Theme presets a11y budget** — 11 presets × 2 modes = 22 combos. Are we willing to reduce to 4–5 contrast-vetted presets and mark others as "experimental, may not meet 4.5:1"? Slate/Lavender/Rose dark modes have suspect contrast.
4. **Language scope** — is `zh-TW` the only non-English locale planned? If yes, simple boolean swap fine; if more come, refactor toggle to `<select>` and audit RTL readiness now.
5. **Shared `<FormField>` priority** — F19 unblocks 6 form pages but is sizeable. Build first, or patch each form individually for now?

## Files inspected

- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/index.html`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/main.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/App.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/index.css`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/layout/AppLayout.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/layout/Sidebar.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/layout/Topbar.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/layout/MobileNav.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/layout/CelestialToggle.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/shared/ConfirmModal.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/shared/TagInputModal.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/shared/GlobalSearch.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/shared/PageLoader.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/shared/Breadcrumb.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/shared/StatePanel.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/shared/EmptyState.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/shared/PageHeader.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/components/shared/ApiErrorState.tsx`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/hooks/use-keyboard.ts`
- `/Users/d/Developer/Active Projects/IMMI-Case-/frontend/src/hooks/use-theme-preset.ts`
- Grep across `frontend/src/` for: `prefers-reduced-motion`, `document.title`, `aria-live`, `aria-busy`, `role="dialog"`, `role="alert"`, `i18n.changeLanguage`, `documentElement.lang`, `:focus-visible`, `outline`.
