# UX Audit — D4: Reference + Workflow + Auth
**Worker**: designer | **Scope**: 12 pages + 4 component dirs | **Date**: 2026-05-05

---

## TL;DR

- Workflow pages (Download, Pipeline, JobStatus) lack breadcrumb navigation — they are orphaned from the rest of the shell, breaking the Legal Codex page-shell family contract that every other page follows.
- LlmCouncilSessionsPage uses a fixed-width sidebar (`w-[300px]`) with no responsive breakpoint — the two-pane layout collapses into an unusable overflow on mobile and narrow viewports.
- TurnCard (LLM Council) and CollectionCard/CollectionEditor use raw Tailwind semantic colours (`emerald-`, `rose-`, `amber-`, `blue-500`, `purple-500`) that bypass the token system and will break under theme-preset switching or dark-mode changes.

---

## Findings

### F1. Workflow pages have no breadcrumb — [HIGH]
- **Where**: `frontend/src/pages/DownloadPage.tsx:57`, `PipelinePage.tsx:184`, `JobStatusPage.tsx:148`
- **What's wrong**: None of the three workflow pages render a `<Breadcrumb>` component. Every other page in the app (Legislations, Collections, LegislationDetail, CollectionDetail, DataDictionary) opens with a `<Breadcrumb>` that places the user in the app hierarchy.
- **Why it matters**: Immigration applicants under stress need to know where they are. Workflow pages are reached from Dashboard or Download links — arriving on `/jobs` or `/pipeline` with no breadcrumb means there is no path home visible above the fold.
- **Fix**: Add `<Breadcrumb items={[{ label: t("common.dashboard"), href: "/" }, { label: t("nav.download") }]} />` (or equivalent) as the first child of the page `div` on all three pages, matching the pattern at `LegislationsPage.tsx:146`.
- **Cross-cuts**: Affects nav orientation for any other tool pages added in future.

---

### F2. LlmCouncilSessionsPage — fixed 300px sidebar, no responsive breakpoint — [BLOCKING]
- **Where**: `frontend/src/pages/LlmCouncilSessionsPage.tsx:85`
- **What's wrong**: `className="flex w-[300px] shrink-0 flex-col gap-3"` — the sidebar has a fixed pixel width with no `sm:` or `md:` responsive override. The outer flex container (line 81) has no `flex-col` breakpoint switch, so on viewports narrower than ~700px the sidebar and detail pane squeeze together. The detail pane is `flex-1` but has `p-10` padding, making it shrink to near-zero visible content at mobile widths.
- **Why it matters**: Many immigration applicants use mobile browsers. The LLM Council sessions list is inaccessible below tablet width.
- **Fix**: Change outer container to `flex flex-col gap-6 lg:flex-row` and sidebar to `w-full lg:w-[300px] shrink-0`. Stack vertically on mobile, side-by-side on large screens.
- **Cross-cuts**: If more pages adopt two-pane layout, this breakpoint approach should be the standard.

---

### F3. TurnCard uses raw Tailwind semantic colours, bypassing design tokens — [HIGH]
- **Where**: `frontend/src/components/llm-council/TurnCard.tsx:31-47, 73-74, 83-84`
- **What's wrong**: The `likelihoodTone()` and `likelihoodBadge()` helpers return hardcoded Tailwind class strings: `text-emerald-700`, `bg-emerald-100`, `text-amber-700`, `bg-amber-900/40`, `text-rose-700`, `bg-rose-100`, etc. The project has `--color-semantic-success / warning / danger` CSS vars and token-level classes (`text-success`, `bg-success/10`). The raw Tailwind classes are not mapped to the token system and will deviate from any custom preset.
- **Why it matters**: When a user applies a non-default theme preset (a feature that exists in the app), the court/legal page will have random green/amber/red blobs that do not respect the custom palette. Undermines the precision of the Legal Codex aesthetic.
- **Fix**: Replace `emerald-*` with `success` token equivalents (`text-emerald-600` → `text-success`, `bg-emerald-100` → `bg-success/10`). Same for `amber-*` → `warning` and `rose-*` → `danger`. These semantic tokens exist in `tokens.json:color.semantic`.
- **Cross-cuts**: CollectionCard (F4) and CollectionEditor (F5) have the same issue.

---

### F4. CollectionCard colour accents use raw Tailwind, not token variables — [MEDIUM]
- **Where**: `frontend/src/components/collections/CollectionCard.tsx:8-14`
- **What's wrong**: `COLOR_CLASSES` maps CollectionColor values to `border-l-blue-500`, `border-l-green-500`, `border-l-amber-500`, `border-l-rose-500`, `border-l-purple-500`, `border-l-slate-500`. These are arbitrary Tailwind palette colours with no connection to the Legal Codex token system.
- **Why it matters**: Blue-500 and purple-500 clash with the amber-gold accent and navy primary. Under dark mode the contrast is unpredictable (Tailwind 500-level blues have borderline AA Large contrast on dark backgrounds).
- **Fix**: Define collection colours as CSS custom properties tied to the token system, or constrain the palette to colours that pass AA on both light and dark backgrounds and align with the Legal Codex aesthetic. A 4-option palette (amber/teal/slate/rose) would be more on-brand than 6 arbitrary Tailwind presets.
- **Cross-cuts**: CollectionEditor.tsx uses the same `COLOR_SWATCH` record with the same raw classes (F5).

---

### F5. CollectionEditor modal — hardcoded dark overlay colour — [MEDIUM]
- **Where**: `frontend/src/components/collections/CollectionEditor.tsx:117`
- **What's wrong**: `className="fixed inset-0 z-50 flex items-center justify-center bg-[#111820]/70"` — uses the literal dark background hex `#111820` as the scrim colour. Under light mode this dark scrim is intentional but is not token-derived.
- **Why it matters**: If the background token changes (e.g. a light-mode preset with a cream background), the modal scrim will remain navy. Minor now, fragile later.
- **Fix**: Replace with `bg-black/60` (universal) or `bg-foreground/50`. At minimum extract to a CSS var `--color-overlay`.

---

### F6. LoginPage — `font-serif` instead of `font-heading`, no accessible landmark — [MEDIUM]
- **Where**: `frontend/src/pages/LoginPage.tsx:28`
- **What's wrong**: (1) The `h1` uses `font-serif` (Tailwind's generic serif stack) rather than `font-heading` (Crimson Text from `tokens.json`). The brand heading font is silently absent on the only page an unauthenticated user sees. (2) The outer container has no `<main>` landmark. (3) The `TelegramLoginButton` renders as a bare `<div ref={ref} />` with no accessible label or loading state text.
- **Why it matters**: This is the trust-critical page — a stressed immigration applicant needs the brand to feel authoritative. `font-serif` renders as Georgia or Times New Roman depending on OS, neither of which is the intended Crimson Text. Screen-reader users get no `main` landmark.
- **Fix**: (1) Change `font-serif` to `font-heading`. (2) Wrap content in `<main aria-label="Sign in">`. (3) Add a visually-hidden description to the Telegram widget wrapper.
- **Cross-cuts**: Search the rest of the codebase for `font-serif` in page-level headings.

---

### F7. LoginPage — missing brand visual hierarchy and trust signals — [MEDIUM]
- **Where**: `frontend/src/pages/LoginPage.tsx:25-54`
- **What's wrong**: (1) No logo, court scale icon, or visual brand mark — just the text "IMMI Case". (2) The description text ("Sign in with Telegram to save searches and collections") leads with the technical mechanism rather than the user benefit. (3) The Telegram button is set to `data-request-access="write"` but there is no explanation of what write access means. For a privacy-sensitive immigration app this is a trust issue.
- **Why it matters**: Users = self-rep immigration applicants under stress. The login page must convey authority and safety, not just functional UI.
- **Fix**: Add a `<Scale>` icon above the heading. Rephrase description to "Save and organise cases across sessions." Add a one-line privacy note: "We only store your Telegram user ID. No messages are read." The footer note about 149,016 public cases is a good trust signal — keep it.

---

### F8. LegislationTextViewer — no `max-w` line-length cap on body text — [MEDIUM]
- **Where**: `frontend/src/components/legislation/LegislationTextViewer.tsx:888-920`
- **What's wrong**: The section content area is `flex-1 overflow-auto border-l border-border` with no maximum width on the text column. Statute text body lines (`text-sm leading-relaxed`) have no `max-w-prose` or equivalent — lines can reach 120+ characters on wide monitors. WCAG 1.4.8 recommends a maximum of 80 characters per line for extended reading.
- **Why it matters**: Legislation pages are the primary long-form reading surface in the app. Long lines cause tracking fatigue, particularly for non-native English readers.
- **Fix**: Add `max-w-prose` or `max-w-[75ch]` to the section body text wrapper inside `SectionCard` at line 646. This does not affect card container width, only the text block inside it.

---

### F9. JobStatusPage — completed job shows no final progress bar — [LOW]
- **Where**: `frontend/src/pages/JobStatusPage.tsx:219-235`
- **What's wrong**: The progress bar only renders when `running && total > 0`. Once a job completes, `running` is false and the bar disappears. The completed state shows only the icon and "Job completed" heading — no visual record that anything ran.
- **Why it matters**: Workflow pages need a "what just happened" cue. A full 100% bar on a completed job is motivating and confirmatory. The empty state feels like the job was forgotten.
- **Fix**: Render the progress bar whenever `(running || isDone) && total > 0`. For `isDone` with `running === false`, `progressPct` will be 100%.

---

### F10. PipelinePage — live phase badge shows raw API string, not translated label — [LOW]
- **Where**: `frontend/src/pages/PipelinePage.tsx:421`
- **What's wrong**: `{phase ?? "Initializing"}` — shows raw API string (`"crawl"`, `"clean"`, `"download"`). The `PHASES` array at line 162 already has translated `label` values for each phase id. `"Initializing"` is also a hardcoded English string, not a translation key.
- **Why it matters**: Minor i18n inconsistency — phase label appears in English regardless of locale.
- **Fix**: `{PHASES.find(p => p.id === phase)?.label ?? t("states.in_progress")}`.

---

### F11. DesignTokensPage — COLOR_GROUPS labels lack CSS var names — [LOW]
- **Where**: `frontend/src/pages/DesignTokensPage.tsx:280-289`
- **What's wrong**: `COLOR_GROUPS` array uses Chinese labels (`"主色"`, `"強調色"`, `"背景"`) without showing the corresponding CSS variable name. `COURT_GROUPS` and `SEMANTIC_GROUPS` (lines 292-316) do include `cssVar` — only `COLOR_GROUPS` is missing this. The DesignTokensPage is a developer reference tool; hiding the CSS var name makes it incomplete.
- **Why it matters**: A developer looking up what class to use needs to see `--color-primary`, not just a Chinese description. Page is inconsistent with its own pattern.
- **Fix**: Add the `cssVar` value as a visible `<code>` element in each COLOR_GROUP rendered card, matching the treatment already applied to COURT_GROUPS and SEMANTIC_GROUPS.

---

### F12. CollectionsPage — duplicate stats (PageHeader meta + stat pill row) — [LOW]
- **Where**: `frontend/src/pages/CollectionsPage.tsx:52-89`
- **What's wrong**: The PageHeader `meta` prop (lines 52-60) already shows "N cases / N collections". Lines 73-89 render a second identical stat row. Both render on the same screen without the second row adding any new information.
- **Why it matters**: Redundancy dilutes the editorial quality of the Legal Codex aesthetic. The extra pill row adds ~60px of vertical space for no additional signal.
- **Fix**: Remove the redundant stat pill section (lines 73-89). The PageHeader `meta` already carries this information.

---

### F13. LlmCouncilPage — textarea has no character count indicator — [LOW]
- **Where**: `frontend/src/pages/LlmCouncilPage.tsx:76-85` (NewSessionForm), `240` (ThreadView follow-up)
- **What's wrong**: Both textareas have `maxLength={8000}` but no visible character counter. Users composing long legal research questions have no feedback about proximity to the limit.
- **Why it matters**: Legal questions can be verbose. A user at 7,800 characters will hit truncation silently. Especially surprising for non-native English writers.
- **Fix**: Add `<span>` below each textarea showing `{message.length} / 8000`, appearing only once `message.length > 6000`. Mirror the existing `turn-count-badge` pattern used in ThreadView.

---

### F14. SessionListItem — ConfirmModal strings not translated — [LOW]
- **Where**: `frontend/src/components/llm-council/SessionListItem.tsx:121-129`
- **What's wrong**: `title="Delete session"`, `message="Delete \"...\". This cannot be undone."`, `confirmLabel="Delete"` — all three ConfirmModal props are hardcoded English strings. The component does not import `useTranslation` at all, unlike the rest of the app.
- **Why it matters**: Inconsistent with the i18n pattern used throughout the app. Deletion confirmation is destructive — it must be in the user's locale.
- **Fix**: Add `const { t } = useTranslation()` and replace the three strings with translation keys using `defaultValue` fallbacks, matching the pattern in `CollectionDetailPage.tsx:293-299`.

---

### F15. LegislationDetailPage — NotScrapedState button uses wrong i18n key — [LOW]
- **Where**: `frontend/src/pages/LegislationDetailPage.tsx:83`
- **What's wrong**: The "Update Laws" button uses `t("legislations.back_button")`. The key is semantically "back" but the action navigates to the legislations list. The button's intent is to prompt the user to trigger an update, not merely go back.
- **Why it matters**: Minor but confusing — a developer reading the code sees `back_button` and expects navigating back in history, not navigating to the list page.
- **Fix**: Use `t("legislations.update_laws", { defaultValue: "Update Laws" })` — the same key used in `LegislationsPage.tsx:185`.

---

## Patterns observed

**Consistent:**
- `PageHeader` + `Breadcrumb` shell used on all reference/detail pages (Legislations, LegislationDetail, Collections, CollectionDetail, DataDictionary).
- `animate-spin` applied correctly on a wrapper `<div>` throughout all workflow pages — not on the SVG directly.
- `useCallback` deps include `t` correctly throughout all inspected pages.
- `i18n defaultValue` pattern used correctly and consistently throughout all pages.
- `keepPreviousData` not needed on these pages (no filter-dependent lists except LegislationsPage which uses separate hooks per query mode).

**Inconsistent:**
- Breadcrumb: present on reference pages, absent on all three workflow pages.
- Token adherence: reference pages + workflow pages use semantic token classes (`text-success`, `bg-danger/5`); TurnCard and Collection components use raw Tailwind colours.
- Font: `font-heading` used correctly in page headings; `font-serif` appears once (LoginPage H1) as a deviation.
- Translation: all pages use `t()` with `defaultValue`; SessionListItem is the only component with no `useTranslation` import while requiring it.
- DesignTokensPage: COURT_GROUPS and SEMANTIC_GROUPS show `cssVar` names; COLOR_GROUPS do not.

**Missing:**
- Responsive handling on LlmCouncilSessionsPage two-pane layout.
- `max-w-prose` cap on statute body text in LegislationTextViewer.
- `<main>` landmark on LoginPage.
- Completed-state progress bar on JobStatusPage.
- Character counter on LlmCouncil textarea fields.

---

## Open questions for lead

1. **LoginPage trust signals**: Is there an official brand mark or court-scale lockup intended for the login screen, or should the `<Scale>` lucide icon serve as the visual anchor?
2. **Collection colour palette**: The 6-colour swatch (blue/green/amber/rose/purple/slate) is arbitrary against the Legal Codex palette. Is there appetite to replace it with a 4-colour token-derived palette? This requires a data migration on existing collections in localStorage.
3. **LlmCouncilSessionsPage detail pane**: The right pane shows "Select a session to view it." as a static placeholder. Is the intended future state master-detail (load session inline), or does it always navigate to `/llm-council/sessions/:id`? Currently the detail pane is a dead element at all times.
4. **DesignTokensPage audience**: Developer reference only, or design-savvy end users too? This determines whether Chinese group labels should be supplemented with CSS var names or replaced entirely with English.
5. **Workflow page access control**: Download, Pipeline, and JobStatus mutate server state. Should they be gated behind auth? Currently they appear in the nav for all users including unauthenticated visitors.

---

## Files inspected

**Pages (12):**
- `frontend/src/pages/LegislationsPage.tsx`
- `frontend/src/pages/LegislationDetailPage.tsx`
- `frontend/src/pages/CollectionsPage.tsx`
- `frontend/src/pages/CollectionDetailPage.tsx`
- `frontend/src/pages/LlmCouncilPage.tsx`
- `frontend/src/pages/LlmCouncilSessionsPage.tsx`
- `frontend/src/pages/DataDictionaryPage.tsx`
- `frontend/src/pages/DownloadPage.tsx`
- `frontend/src/pages/PipelinePage.tsx`
- `frontend/src/pages/JobStatusPage.tsx`
- `frontend/src/pages/DesignTokensPage.tsx` (lines 1-320, colour utility + constants section)
- `frontend/src/pages/LoginPage.tsx`

**Components (7):**
- `frontend/src/components/legislation/LegislationTextViewer.tsx`
- `frontend/src/components/collections/CollectionCard.tsx`
- `frontend/src/components/collections/CollectionEditor.tsx`
- `frontend/src/components/collections/SortableCaseItem.tsx`
- `frontend/src/components/llm-council/TurnCard.tsx`
- `frontend/src/components/llm-council/SessionListItem.tsx`
- `frontend/src/components/auth/TelegramLoginButton.tsx`

**Supporting:**
- `frontend/src/tokens/tokens.json`
