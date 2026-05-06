# UX Audit — D5: Cross-cutting visual system
**Worker**: designer | **Scope**: layout + shared + tokens + theme + lib/router/api | **Date**: 2026-05-05

---

## TL;DR

- The token pipeline is well-structured (JSON → CSS → TS) with dark/light symmetry validated at build time, but **shadow tokens hard-code light-mode RGB values that do not adapt in dark mode**, and the **modal overlay colour is repeated as a magic hex in 6+ files** with no token.
- The legacy `use-theme.ts` hook survives alongside the canonical `use-theme-preset.ts` and is never called, but its continued presence is a live maintenance trap with conflicting localStorage keys.
- `PageLoader` puts `animate-spin` directly on a Lucide SVG component, violating the documented pattern and degrading GPU animation performance.

---

## Findings

### F1. `animate-spin` on Lucide SVG, not wrapper `<div>` — HIGH
- **Where**: `frontend/src/components/shared/PageLoader.tsx:11`
- **What's wrong**: `<LoaderCircle className="h-5 w-5 animate-spin" />` applies `animate-spin` directly to the SVG element. Per CLAUDE.md gotcha and CSS animation spec, SVG elements are not hardware-accelerated for CSS transforms; the rotation falls back to software compositing.
- **Why it matters**: The page loader is the most frequently seen animation in the app — every lazy route transition. Software-composited spin causes jank on lower-end devices and forces a repaint on every frame rather than a compositor-only step.
- **Fix**: `<div className="animate-spin h-5 w-5"><LoaderCircle className="h-full w-full" /></div>`. The wrapper div gets promoted to its own GPU layer.
- **Cross-cuts**: Grep `animate-spin` on Lucide component lines app-wide to catch any other occurrences.

---

### F2. Modal overlay colour `#111820` repeated as magic hex in 6+ files — HIGH
- **Where**: `frontend/src/components/shared/ConfirmModal.tsx:46`, `TagInputModal.tsx:49`, `GlobalSearch.tsx:48`, `frontend/src/components/layout/MobileNav.tsx:36`, `components/saved-searches/SaveSearchModal.tsx:131`, `components/collections/CollectionEditor.tsx:117`, `components/analytics/SuccessRateDeepModal.tsx:57`
- **What's wrong**: `bg-[#111820]/65` (one instance at `/70`) appears hard-coded across 7 components. `#111820` is the dark-mode background value from tokens, used as a fixed overlay tint regardless of light/dark mode. The opacity varies (0.65 vs 0.70) inconsistently across modals.
- **Why it matters**: (1) Violates single-source-of-truth — the overlay tint is not traceable to any token. (2) If the dark background token changes, 7 files diverge silently. (3) The 0.65 vs 0.70 inconsistency creates subtly different scrim densities.
- **Fix**: Add `"overlay": "rgba(17,24,32,0.65)"` to `tokens.json` color group, emit `--color-overlay` in `tokens.css`, expose in `@theme`, then replace all instances with `bg-[var(--color-overlay)]`. Normalise the `/70` outlier.
- **Cross-cuts**: All modal components and MobileNav.

---

### F3. Shadow tokens do not adapt in dark mode — MEDIUM
- **Where**: `frontend/src/tokens/tokens.css:79–82` (`:root` block only; `.dark` block has zero shadow overrides)
- **What's wrong**: All four shadow tokens (`--shadow-xs`, `--shadow-sm`, `--shadow`, `--shadow-lg`) use `rgba(27,40,56,…)` — the light-mode navy primary. The `.dark` block overrides colours and backgrounds but defines no shadow overrides. On dark backgrounds, navy-tinted shadows at low opacity are nearly invisible.
- **Why it matters**: Cards, modals, and `StatePanel` rely on shadow tokens for depth cues. In dark mode those cues collapse, flattening visual hierarchy across the entire app.
- **Fix**: Add dark shadow overrides to `tokens.json` (e.g. `rgba(0,0,0,0.4)` for all four tiers). Update `build-tokens.ts` to emit `.dark { --shadow-*: … }` — the script's existing dark-emitter block already handles it, the values just need to exist in the JSON.
- **Cross-cuts**: `StatePanel`, `ConfirmModal`, `MobileNav`, every card component.

---

### F4. Legacy `use-theme.ts` not removed — MEDIUM
- **Where**: `frontend/src/hooks/use-theme.ts` (entire file, 34 lines)
- **What's wrong**: Fully functional hook reading from `localStorage.getItem("theme")` and toggling `.dark`. The canonical hook is `use-theme-preset.ts` which reads `"theme-dark"`. These are **different storage keys** — if `use-theme.ts` is ever imported again it will write `"theme"` while `use-theme-preset.ts` ignores that key entirely, producing a split theme state. No component currently imports it.
- **Why it matters**: Silent maintenance trap. A future developer seeing a simple `useTheme()` export will prefer it over the more complex preset hook, leading to broken theme behaviour.
- **Fix**: Delete `frontend/src/hooks/use-theme.ts`. Add a comment header to `use-theme-preset.ts`: `// Canonical theme hook — do not import use-theme.ts (deleted)`. Consider an ESLint `no-restricted-imports` rule.
- **Cross-cuts**: Future developer onboarding; no current runtime impact.

---

### F5. `ConfirmModal` missing `role="dialog"`, `aria-modal`, `aria-labelledby` — MEDIUM
- **Where**: `frontend/src/components/shared/ConfirmModal.tsx:44–82`
- **What's wrong**: The modal panel `<div>` has no `role="dialog"`, `aria-modal="true"`, or `aria-labelledby`. The focus management only calls `cancelRef.current?.focus()` on open but does not constrain Tab/Shift-Tab — focus can escape to background content behind the scrim.
- **Why it matters**: Screen readers do not announce this as a dialog. WCAG 2.1 SC 1.3.1 and 4.1.2 require role and labelling. Primary users (self-represented immigration applicants under stress) are disproportionately likely to use assistive technology.
- **Fix**: Add `role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title"` to the inner panel div; add `id="confirm-modal-title"` to the `<h3>`. Implement Tab cycle focus trap in the `keydown` handler alongside the existing Escape handler.
- **Cross-cuts**: `TagInputModal.tsx` shares the same structural pattern and likely has the same gap.

---

### F6. `@theme` self-referential CSS variable declarations (Tailwind v4 fragility) — MEDIUM
- **Where**: `frontend/src/index.css:6–95` (entire `@theme` block)
- **What's wrong**: Every entry follows the pattern `--color-primary: var(--color-primary)` — the Tailwind theme variable references a CSS custom property of the identical name. Tailwind v4 resolves `@theme` variables statically at build time. This circular self-reference works only because `@import "./tokens/tokens.css"` precedes `@import "tailwindcss"`, seeding the values before Tailwind reads them. Any tooling that reorders imports (alphabetical sorters, CSS bundlers) would cause all token-driven utilities to silently emit empty values.
- **Why it matters**: `bg-primary`, `text-foreground`, `border-border` and every other token-aliased utility class would transparently break. The failure is silent — no build error, just invisible colours.
- **Fix**: Either (a) inline resolved values in `@theme` via the build pipeline (safest — Tailwind gets static values), or (b) rename `@theme` variables to a distinct prefix (`--tw-color-primary`) pointing at `var(--color-primary)` to eliminate the circular reference while preserving runtime overridability for preset switching.
- **Cross-cuts**: Every Tailwind colour, radius, shadow, and font utility in the entire app.

---

### F7. Court badge colours identical in dark mode — LOW
- **Where**: `frontend/src/tokens/tokens.css:138–146` (`.dark` block) and `tokens.json`
- **What's wrong**: The 9 court colours are identical in light and dark mode. `HCA` (`#1b2631`) on the dark card background (`#192230`) is near-invisible — dark navy on dark navy with a contrast ratio of approximately 1.1:1.
- **Why it matters**: Court badges are the primary visual identifier for case provenance across lists, cards, and charts. An invisible `HCA` badge destroys the information hierarchy for that court in dark mode.
- **Fix**: Add dark-mode court colour overrides to `tokens.json` under `color.dark.court`. Specifically lighten `HCA` (darkest), `AATA`, `FCA`, and `RRTA`. The `build-tokens.ts` script already handles `.dark { }` emission for any keys present in `color.dark.court`.
- **Cross-cuts**: `CourtBadge.tsx` and all chart series that use court colours.

---

### F8. `ApiErrorState` uses `bg-background-card` — non-canonical Tailwind alias — LOW
- **Where**: `frontend/src/components/shared/ApiErrorState.tsx:28`
- **What's wrong**: Uses `bg-background-card` instead of `bg-card`. In `index.css @theme`, the canonical alias is `--color-card: var(--color-background-card)` → Tailwind utility `bg-card`. `bg-background-card` works by Tailwind v4 convention (auto-generating utilities from CSS vars) but is not the declared alias.
- **Why it matters**: If the `@theme` alias name changes, this one usage breaks silently. Inconsistency in a shared component that is rendered on every error state.
- **Fix**: Replace `bg-background-card` with `bg-card`.
- **Cross-cuts**: Isolated incident; all other components use `bg-card` correctly.

---

### F9. `Breadcrumb` nav missing `aria-label` — LOW
- **Where**: `frontend/src/components/shared/Breadcrumb.tsx:15`
- **What's wrong**: `<nav className="flex items-center …">` has no `aria-label`. Pages with both a sidebar nav and a breadcrumb nav expose two unlabelled `navigation` landmarks to screen readers.
- **Why it matters**: WCAG 2.1 SC 2.4.1 recommends labelling multiple navigation landmarks distinctly. Assistive technology users cannot distinguish the sidebar from the breadcrumb by landmark.
- **Fix**: Add `aria-label="Breadcrumb"` to the `<nav>` element.
- **Cross-cuts**: All pages rendering `Breadcrumb`.

---

### F10. `h1`/`h2` base font sizes use magic values not in `tokens.json` — LOW
- **Where**: `frontend/src/index.css:112–120` (`@layer base` block)
- **What's wrong**: `h1 { font-size: 3rem; }` and `h2 { font-size: 2rem; }` are hardcoded. `PageHeader.tsx` already overrides `h1` with `text-[clamp(1.5rem,4vw,2.75rem)]` — the base `3rem` is effectively dead for the primary heading pattern, and at 2.75rem desktop clamp cap the base is actually larger than the utility override (only works due to `@layer base` specificity).
- **Why it matters**: Magic numbers in base styles are invisible to token consumers. Any page using a bare `<h1>` outside `PageHeader` gets 3rem, not the responsive clamp — silently inconsistent with the design direction.
- **Fix**: Either remove font-size rules from `@layer base` and rely entirely on Tailwind utilities + `PageHeader`, or add a `typography.scale` section to `tokens.json` and reference `--font-size-h1` etc. here.
- **Cross-cuts**: Any page using bare heading tags outside `PageHeader`.

---

### F11. `StatePanel` shadow values are hardcoded `rgba()` strings — LOW
- **Where**: `frontend/src/components/shared/StatePanel.tsx:23–25`
- **What's wrong**: `shadow-[0_1px_3px_rgba(168,50,50,0.08)]` (error tone) and `shadow-[0_1px_3px_rgba(125,91,7,0.08)]` (warning tone) are inline arbitrary shadow values that bypass the shadow token system. `rgba(168,50,50,…)` is the light-mode `--color-semantic-danger` value, hardcoded directly.
- **Why it matters**: If semantic colours change (e.g. a re-theme), these shadows will silently stay pointing at the old danger colour. These are also light-mode specific values with no dark adaptation.
- **Fix**: Either use `shadow-sm` (the closest token size) with a coloured ring utility, or add `shadow-error` / `shadow-warning` tokens to `tokens.json` referencing `var(--color-semantic-danger)`.
- **Cross-cuts**: `StatePanel` is the base for `EmptyState`, `PageLoader`, `ApiErrorState` — widely used.

---

### F12. `resolveRouterBasename` single-call snapshot with no unrecognised-path warning — LOW
- **Where**: `frontend/src/lib/router.ts:1–12`, `frontend/src/App.tsx:176`
- **What's wrong**: `resolveRouterBasename(window.location.pathname)` is called once at module evaluation time. The function returns only `/` or `/app` with no logging for unrecognised path prefixes. Any future third deployment path (e.g. `/v2/`) silently falls back to `/` root mode.
- **Why it matters**: Low risk in current deployment, but the silent fallback could mask misconfiguration. Developer experience gap — no indication when an unexpected path is received.
- **Fix**: Add `if (process.env.NODE_ENV === 'development') console.warn(...)` for unrecognised prefixes. Document the two-value contract in a JSDoc comment.
- **Cross-cuts**: `App.tsx` only.

---

## Patterns observed

- **Consistent**: Token pipeline (JSON → CSS → TS) is well-executed with build-time validation and dark/light symmetry checks. `@layer base` is correctly used for heading styles — the known gotcha is avoided. All `localStorage` calls are wrapped in try-catch. `use-theme-preset.ts` uses `useSyncExternalStore` for correct cross-component sync. Theme application clears all inline CSS vars before re-applying — clean preset switching. `useCallback` in `use-theme-preset.ts` has no external deps (correctly empty arrays). All keyboard handlers in `ConfirmModal` are cleaned up on unmount. `BrowserRouter` + lazy route pattern is consistent across all 27 pages.
- **Inconsistent**: Modal overlay colour repeated as magic hex in 7 files without token. `bg-background-card` vs `bg-card` naming in one shared component. Shadow arbitrary values in `StatePanel` bypass the token system. Z-index mixes token-mapped classes (`z-50`, `z-30`) with one arbitrary (`z-[60]` for skip-link — intentionally above modal, acceptable).
- **Missing**: `--color-overlay` token for modal scrims. Dark-mode shadow adaptations. `role="dialog"` / `aria-modal` / `aria-labelledby` on `ConfirmModal`. Dark-mode court colour lightening for low-contrast courts (`HCA`, `FCA`). Deletion of `use-theme.ts`. `font-size` tokens for heading scale.

---

## Open questions for lead

1. **`@theme` self-reference**: Is the `--color-primary: var(--color-primary)` pattern intentional to keep Tailwind utilities reactive to preset switching at runtime? If yes, the import-order dependency must be documented and lint-enforced. If no, switch to build-time inlining in the pipeline.
2. **Court badge dark mode**: Is HCA badge invisibility on dark cards an accepted tradeoff (176 HCA records, rare use), or should dark-mode court colour overrides be added as a quick token patch?
3. **`use-theme.ts` deletion**: Safe to delete now, or is it kept as a convenience for E2E tests that may toggle dark mode via `localStorage.setItem("theme", "dark")`? (Check Playwright test fixtures before deleting.)
4. **`ConfirmModal` a11y scope**: Migrate to Radix UI `Dialog` for full a11y (focus trap, `inert` backdrop, `aria-modal`), or implement a minimal focus trap manually? Radix adds ~8KB gzip to the bundle.
5. **Shadow dark values**: Proposed starting point `rgba(0,0,0,0.35)` for all four shadow tiers in dark mode — confirm with visual review before committing to tokens.

---

## Files inspected

| File | Status |
|---|---|
| `frontend/src/tokens/tokens.json` | Fully audited |
| `frontend/src/tokens/tokens.css` | Fully audited |
| `frontend/src/tokens/tokens.ts` | Fully audited |
| `frontend/scripts/build-tokens.ts` | Fully audited |
| `frontend/src/index.css` | Fully audited |
| `frontend/src/hooks/use-theme-preset.ts` | Fully audited |
| `frontend/src/hooks/use-theme.ts` | Fully audited (legacy) |
| `frontend/src/components/layout/AppLayout.tsx` | Fully audited |
| `frontend/src/components/layout/Sidebar.tsx` | Fully audited |
| `frontend/src/components/layout/Topbar.tsx` | Fully audited |
| `frontend/src/components/layout/MobileNav.tsx` | Grep-audited (overlay pattern) |
| `frontend/src/components/layout/nav-config.ts` | Skipped (data config, no visual logic) |
| `frontend/src/components/shared/Breadcrumb.tsx` | Fully audited |
| `frontend/src/components/shared/ConfirmModal.tsx` | Fully audited |
| `frontend/src/components/shared/CourtBadge.tsx` | Fully audited |
| `frontend/src/components/shared/EmptyState.tsx` | Fully audited |
| `frontend/src/components/shared/PageLoader.tsx` | Fully audited |
| `frontend/src/components/shared/PageHeader.tsx` | Fully audited |
| `frontend/src/components/shared/StatePanel.tsx` | Fully audited |
| `frontend/src/components/shared/ApiErrorState.tsx` | Fully audited |
| `frontend/src/components/shared/Pagination.tsx` | Fully audited |
| `frontend/src/App.tsx` | Fully audited |
| `frontend/src/main.tsx` | Fully audited |
| `frontend/src/lib/router.ts` | Fully audited |
| `frontend/src/lib/api.ts` | Fully audited |
| `frontend/vite.config.ts` | Fully audited |
| `frontend/tailwind.config.*` | Not present (v4 uses `@theme` in CSS — correct) |
