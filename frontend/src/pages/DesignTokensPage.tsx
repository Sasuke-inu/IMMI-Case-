import { useState, useEffect } from "react"
import { toast } from "sonner"
import {
  Check,
  Copy,
  Scale,
  FileText,
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { tokens, courtColors, semanticColors } from "@/tokens/tokens"
import { CourtBadge } from "@/components/shared/CourtBadge"
import { OutcomeBadge } from "@/components/shared/OutcomeBadge"
import { StatCard } from "@/components/dashboard/StatCard"
import { CaseCard } from "@/components/cases/CaseCard"
import {
  useThemePreset,
  PRESETS,
  type PresetName,
} from "@/hooks/use-theme-preset"
import type { ImmigrationCase } from "@/types/case"

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */

function copyToClipboard(text: string, label?: string) {
  navigator.clipboard.writeText(text)
  toast.success(`Copied ${label ?? text}`)
}

function SectionHeading({
  id,
  children,
}: {
  id: string
  children: React.ReactNode
}) {
  return (
    <h2
      id={id}
      className="mb-4 scroll-mt-20 font-heading text-xl font-semibold"
    >
      {children}
    </h2>
  )
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-sm font-medium text-secondary-text">
      {children}
    </h3>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Section 1: Theme Preset Switcher
   ═══════════════════════════════════════════════════════════════ */

function ThemePresetSwitcher() {
  const { preset, setPreset } = useThemePreset()

  return (
    <section>
      <SectionHeading id="theme">Theme Presets</SectionHeading>
      <p className="mb-4 text-sm text-muted-text">
        Click a preset to change the site-wide colour theme. Persists across
        page refreshes.
      </p>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {(Object.entries(PRESETS) as [PresetName, (typeof PRESETS)[PresetName]][]).map(
          ([name, p]) => {
            const active = preset === name
            return (
              <button
                key={name}
                onClick={() => setPreset(name)}
                className={`relative flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-all ${
                  active
                    ? "border-accent bg-card shadow-md"
                    : "border-border bg-card hover:border-accent/40 hover:shadow-sm"
                }`}
              >
                {active && (
                  <div className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white">
                    <Check className="h-3 w-3" />
                  </div>
                )}
                <div className="flex gap-1">
                  {p.colors.map((c, i) => (
                    <div
                      key={i}
                      className="h-6 w-6 rounded-full border border-black/10"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <span className="text-sm font-medium text-foreground">
                  {p.label}
                </span>
              </button>
            )
          }
        )}
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Section 2: Color Palette
   ═══════════════════════════════════════════════════════════════ */

function ColorSwatchCard({
  name,
  value,
  cssVar,
}: {
  name: string
  value: string
  cssVar: string
}) {
  return (
    <button
      onClick={() => copyToClipboard(value, name)}
      className="group flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-all hover:shadow-sm"
    >
      <div
        className="h-12 w-12 shrink-0 rounded-md border border-black/10 shadow-xs"
        style={{ backgroundColor: value }}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{name}</p>
        <p className="truncate font-mono text-[11px] text-muted-text">
          {value}
        </p>
        <p className="truncate font-mono text-[10px] text-muted-text/70">
          {cssVar}
        </p>
      </div>
      <Copy className="h-3.5 w-3.5 shrink-0 text-muted-text opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  )
}

function ColorPalette() {
  const colorGroups: {
    title: string
    swatches: { name: string; value: string; cssVar: string }[]
  }[] = [
    {
      title: "Primary",
      swatches: [
        { name: "primary", value: tokens.color.primary.DEFAULT, cssVar: "--color-primary" },
        { name: "primary-light", value: tokens.color.primary.light, cssVar: "--color-primary-light" },
        { name: "primary-lighter", value: tokens.color.primary.lighter, cssVar: "--color-primary-lighter" },
      ],
    },
    {
      title: "Accent",
      swatches: [
        { name: "accent", value: tokens.color.accent.DEFAULT, cssVar: "--color-accent" },
        { name: "accent-light", value: tokens.color.accent.light, cssVar: "--color-accent-light" },
        { name: "accent-muted", value: tokens.color.accent.muted, cssVar: "--color-accent-muted" },
      ],
    },
    {
      title: "Background",
      swatches: [
        { name: "background", value: tokens.color.background.DEFAULT, cssVar: "--color-background" },
        { name: "card", value: tokens.color.background.card, cssVar: "--color-background-card" },
        { name: "sidebar", value: tokens.color.background.sidebar, cssVar: "--color-background-sidebar" },
        { name: "surface", value: tokens.color.background.surface, cssVar: "--color-background-surface" },
      ],
    },
    {
      title: "Border",
      swatches: [
        { name: "border", value: tokens.color.border.DEFAULT, cssVar: "--color-border" },
        { name: "border-light", value: tokens.color.border.light, cssVar: "--color-border-light" },
      ],
    },
    {
      title: "Text",
      swatches: [
        { name: "text", value: tokens.color.text.DEFAULT, cssVar: "--color-text" },
        { name: "text-secondary", value: tokens.color.text.secondary, cssVar: "--color-text-secondary" },
        { name: "text-muted", value: tokens.color.text.muted, cssVar: "--color-text-muted" },
      ],
    },
    {
      title: "Semantic",
      swatches: Object.entries(semanticColors).map(([k, v]) => ({
        name: k,
        value: v,
        cssVar: `--color-semantic-${k}`,
      })),
    },
    {
      title: "Court",
      swatches: Object.entries(courtColors).map(([k, v]) => ({
        name: k,
        value: v,
        cssVar: `--color-court-${k}`,
      })),
    },
  ]

  return (
    <section>
      <SectionHeading id="colors">Color Palette</SectionHeading>
      <p className="mb-4 text-sm text-muted-text">
        Click any swatch to copy its hex value.
      </p>
      {colorGroups.map((group) => (
        <div key={group.title} className="mb-6">
          <SubHeading>{group.title}</SubHeading>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {group.swatches.map((s) => (
              <ColorSwatchCard key={s.name} {...s} />
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Section 3: Typography
   ═══════════════════════════════════════════════════════════════ */

function TypographySection() {
  const fontFamilies = [
    {
      label: "Heading",
      cls: "font-heading",
      family: "Crimson Text",
      sample: "Administrative Appeals Tribunal Decision",
    },
    {
      label: "Body",
      cls: "",
      family: "Inter",
      sample: "The applicant seeks review of the decision to refuse a visa.",
    },
    {
      label: "Mono",
      cls: "font-mono",
      family: "SF Mono",
      sample: "case_id: a1b2c3d4e5f6",
    },
  ]

  const fontSizes = [
    { label: "xs", cls: "text-xs", px: "12px" },
    { label: "sm", cls: "text-sm", px: "14px" },
    { label: "base", cls: "text-base", px: "16px" },
    { label: "lg", cls: "text-lg", px: "18px" },
    { label: "xl", cls: "text-xl", px: "20px" },
    { label: "2xl", cls: "text-2xl", px: "24px" },
    { label: "3xl", cls: "text-3xl", px: "30px" },
  ]

  const fontWeights = [
    { label: "Light", weight: 300, cls: "font-light" },
    { label: "Regular", weight: 400, cls: "font-normal" },
    { label: "Medium", weight: 500, cls: "font-medium" },
    { label: "Semibold", weight: 600, cls: "font-semibold" },
    { label: "Bold", weight: 700, cls: "font-bold" },
  ]

  return (
    <section>
      <SectionHeading id="typography">Typography</SectionHeading>

      <SubHeading>Font Families</SubHeading>
      <div className="mb-6 space-y-3">
        {fontFamilies.map((f) => (
          <div
            key={f.label}
            className="rounded-lg border border-border bg-card p-4"
          >
            <div className="mb-1 flex items-center gap-2">
              <span className="text-xs font-medium text-muted-text">
                {f.label}
              </span>
              <span className="font-mono text-[10px] text-muted-text/70">
                {f.family}
              </span>
            </div>
            <p className={`text-xl ${f.cls}`}>{f.sample}</p>
          </div>
        ))}
      </div>

      <SubHeading>Size Scale</SubHeading>
      <div className="mb-6 space-y-2">
        {fontSizes.map((s) => (
          <div key={s.label} className="flex items-baseline gap-4">
            <span className="w-12 shrink-0 text-right font-mono text-xs text-muted-text">
              {s.label}
            </span>
            <span className="w-10 shrink-0 font-mono text-[10px] text-muted-text/70">
              {s.px}
            </span>
            <span className={s.cls}>Immigration Law Concepts</span>
          </div>
        ))}
      </div>

      <SubHeading>Weight Scale</SubHeading>
      <div className="space-y-2">
        {fontWeights.map((w) => (
          <div key={w.label} className="flex items-baseline gap-4">
            <span className="w-20 shrink-0 text-right font-mono text-xs text-muted-text">
              {w.weight}
            </span>
            <span className={`text-base ${w.cls}`}>
              {w.label} — Review of Migration Decision
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Section 4: Spacing Scale
   ═══════════════════════════════════════════════════════════════ */

function SpacingSection() {
  return (
    <section>
      <SectionHeading id="spacing">Spacing</SectionHeading>
      <div className="flex flex-wrap items-end gap-4">
        {Object.entries(tokens.spacing).map(([key, value]) => (
          <div key={key} className="text-center">
            <div
              className="rounded border border-accent/40 bg-accent/20"
              style={{ width: value, height: value }}
            />
            <p className="mt-1 text-xs text-muted-text">
              --spacing-{key}
            </p>
            <p className="font-mono text-[10px] text-muted-text">{value}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Section 5: Border Radius
   ═══════════════════════════════════════════════════════════════ */

function RadiusSection() {
  return (
    <section>
      <SectionHeading id="radius">Border Radius</SectionHeading>
      <div className="flex flex-wrap gap-6">
        {Object.entries(tokens.radius).map(([key, value]) => (
          <div key={key} className="text-center">
            <div
              className="h-16 w-16 border-2 border-accent bg-accent-muted"
              style={{ borderRadius: value }}
            />
            <p className="mt-2 text-xs text-muted-text">
              --radius{key === "DEFAULT" ? "" : `-${key}`}
            </p>
            <p className="font-mono text-[10px] text-muted-text">{value}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Section 6: Shadows
   ═══════════════════════════════════════════════════════════════ */

function ShadowSection() {
  return (
    <section>
      <SectionHeading id="shadows">Shadows</SectionHeading>
      <div className="grid gap-6 sm:grid-cols-4">
        {Object.entries(tokens.shadow).map(([key, value]) => (
          <div
            key={key}
            className="rounded-lg border border-border bg-card p-6 text-center"
            style={{ boxShadow: value }}
          >
            <p className="text-sm font-medium text-foreground">
              --shadow{key === "DEFAULT" ? "" : `-${key}`}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Section 7: Component Gallery
   ═══════════════════════════════════════════════════════════════ */

const MOCK_CASE: ImmigrationCase = {
  case_id: "a1b2c3d4e5f6",
  citation: "[2025] ARTA 1234",
  title: "Singh v Minister for Immigration",
  court: "Administrative Review Tribunal",
  court_code: "ARTA",
  date: "2025-03-15",
  year: 2025,
  url: "https://austlii.edu.au/au/cases/cth/ARTA/2025/1234.html",
  judges: "Senior Member Johnson",
  catchwords: "Migration - visa cancellation - character test",
  outcome: "Decision set aside and remitted",
  visa_type: "Subclass 500 (Student)",
  legislation: "Migration Act 1958 (Cth), s 501",
  text_snippet: "The Tribunal finds that the decision should be set aside...",
  full_text_path: "case_texts/[2025] ARTA 1234.txt",
  source: "AustLII",
  user_notes: "",
  tags: "",
  case_nature: "Migration",
  legal_concepts: "Character test, visa cancellation",
  visa_subclass: "500",
  visa_class_code: "TU",
}

function ButtonGallery() {
  const [loading, setLoading] = useState(false)

  return (
    <div>
      <SubHeading>Buttons</SubHeading>
      <div className="flex flex-wrap items-center gap-3">
        <button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-light">
          Primary
        </button>
        <button className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface">
          Secondary
        </button>
        <button className="rounded-md bg-danger px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90">
          Danger
        </button>
        <button
          className="rounded-md bg-accent/50 px-4 py-2 text-sm font-medium text-white cursor-not-allowed"
          disabled
        >
          Disabled
        </button>
        <button className="rounded-md border border-border bg-card p-2 text-foreground transition-colors hover:bg-surface">
          <Search className="h-4 w-4" />
        </button>
        <button
          className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white"
          onClick={() => {
            setLoading(true)
            setTimeout(() => setLoading(false), 1500)
          }}
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Loading..." : "Click to Load"}
        </button>
      </div>
    </div>
  )
}

function FormControlGallery() {
  return (
    <div>
      <SubHeading>Form Controls</SubHeading>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-foreground">
            Text Input
          </span>
          <input
            type="text"
            placeholder="Search cases..."
            className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-foreground">Select</span>
          <select className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent">
            <option>All Courts</option>
            <option>AATA</option>
            <option>ARTA</option>
            <option>FCA</option>
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="text-sm font-medium text-foreground">Textarea</span>
          <textarea
            rows={2}
            placeholder="Add case notes..."
            className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            defaultChecked
            className="h-4 w-4 rounded border-border accent-accent"
          />
          <span className="text-sm text-foreground">
            Include full text in export
          </span>
        </label>
      </div>
    </div>
  )
}

function BadgeGallery() {
  return (
    <div>
      <SubHeading>Court Badges</SubHeading>
      <div className="mb-4 flex flex-wrap gap-2">
        {Object.keys(courtColors).map((court) => (
          <CourtBadge key={court} court={court} />
        ))}
      </div>
      <SubHeading>Outcome Badges</SubHeading>
      <div className="flex flex-wrap gap-2">
        {[
          "Allowed",
          "Dismissed",
          "Remitted",
          "Affirmed",
          "Granted",
          "Refused",
          "Withdrawn",
        ].map((o) => (
          <OutcomeBadge key={o} outcome={o} />
        ))}
      </div>
    </div>
  )
}

function CardGallery() {
  return (
    <div>
      <SubHeading>Cards</SubHeading>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Total Cases"
          value={62539}
          icon={<Scale className="h-5 w-5" />}
          description="All databases combined"
        />
        <StatCard
          title="With Full Text"
          value={62517}
          icon={<FileText className="h-5 w-5" />}
          description="99.96% coverage"
        />
        <CaseCard case_={MOCK_CASE} onClick={() => toast.info("Case card clicked")} />
      </div>
    </div>
  )
}

function TableGallery() {
  const rows = [
    { citation: "[2025] ARTA 1234", court: "ARTA", date: "2025-03-15", outcome: "Remitted" },
    { citation: "[2024] FCA 567", court: "FCA", date: "2024-11-02", outcome: "Dismissed" },
    { citation: "[2024] AATA 890", court: "AATA", date: "2024-09-18", outcome: "Affirmed" },
  ]

  return (
    <div>
      <SubHeading>Table</SubHeading>
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface">
              <th className="px-4 py-2.5 font-medium text-foreground">Citation</th>
              <th className="px-4 py-2.5 font-medium text-foreground">Court</th>
              <th className="px-4 py-2.5 font-medium text-foreground">Date</th>
              <th className="px-4 py-2.5 font-medium text-foreground">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.citation}
                className="border-b border-border-light bg-card transition-colors hover:bg-surface"
              >
                <td className="px-4 py-2.5 font-medium text-accent">{r.citation}</td>
                <td className="px-4 py-2.5">
                  <CourtBadge court={r.court} />
                </td>
                <td className="px-4 py-2.5 text-muted-text">{r.date}</td>
                <td className="px-4 py-2.5">
                  <OutcomeBadge outcome={r.outcome} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MiscGallery() {
  return (
    <div>
      <SubHeading>Miscellaneous</SubHeading>
      <div className="flex flex-wrap items-center gap-6">
        {/* Loading spinner */}
        <div className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
          <span className="text-sm text-muted-text">Loading...</span>
        </div>

        {/* Toast triggers */}
        <div className="flex gap-2">
          <button
            onClick={() => toast.success("Operation completed")}
            className="rounded border border-success/30 bg-success/10 px-3 py-1 text-xs font-medium text-success"
          >
            Success Toast
          </button>
          <button
            onClick={() => toast.error("Something went wrong")}
            className="rounded border border-danger/30 bg-danger/10 px-3 py-1 text-xs font-medium text-danger"
          >
            Error Toast
          </button>
          <button
            onClick={() => toast.warning("Check your input")}
            className="rounded border border-warning/30 bg-warning/10 px-3 py-1 text-xs font-medium text-warning"
          >
            Warning Toast
          </button>
          <button
            onClick={() => toast.info("Tip: use keyboard shortcuts")}
            className="rounded border border-info/30 bg-info/10 px-3 py-1 text-xs font-medium text-info"
          >
            Info Toast
          </button>
        </div>

        {/* Keyboard shortcuts */}
        <div className="flex items-center gap-1 text-sm text-muted-text">
          <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-xs shadow-xs">
            /
          </kbd>
          <span>Search</span>
          <kbd className="ml-2 rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-xs shadow-xs">
            ?
          </kbd>
          <span>Help</span>
        </div>

        {/* Pagination */}
        <div className="flex items-center gap-1">
          <button className="rounded border border-border bg-card p-1.5 text-muted-text hover:bg-surface">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button className="rounded border border-accent bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
            1
          </button>
          <button className="rounded border border-border bg-card px-2.5 py-1 text-xs text-foreground hover:bg-surface">
            2
          </button>
          <button className="rounded border border-border bg-card px-2.5 py-1 text-xs text-foreground hover:bg-surface">
            3
          </button>
          <button className="rounded border border-border bg-card p-1.5 text-muted-text hover:bg-surface">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

function ComponentGallery() {
  return (
    <section>
      <SectionHeading id="components">Component Gallery</SectionHeading>
      <div className="space-y-8">
        <ButtonGallery />
        <FormControlGallery />
        <BadgeGallery />
        <CardGallery />
        <TableGallery />
        <MiscGallery />
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Section 8: Dark Mode Comparison
   ═══════════════════════════════════════════════════════════════ */

function DarkModeComparison() {
  const lightVars: Record<string, string> = {
    bg: tokens.color.background.DEFAULT,
    card: tokens.color.background.card,
    text: tokens.color.text.DEFAULT,
    secondary: tokens.color.text.secondary,
    muted: tokens.color.text.muted,
    border: tokens.color.border.DEFAULT,
    accent: tokens.color.accent.DEFAULT,
  }

  const darkVars: Record<string, string> = {
    bg: tokens.color.dark.background.DEFAULT,
    card: tokens.color.dark.background.card,
    text: tokens.color.dark.text.DEFAULT,
    secondary: tokens.color.dark.text.secondary,
    muted: tokens.color.dark.text.muted,
    border: tokens.color.dark.border.DEFAULT,
    accent: tokens.color.dark.accent.DEFAULT,
  }

  function MiniCard({ vars, label }: { vars: Record<string, string>; label: string }) {
    return (
      <div
        className="flex-1 overflow-hidden rounded-lg border"
        style={{ backgroundColor: vars.bg, borderColor: vars.border }}
      >
        <div
          className="border-b px-4 py-2"
          style={{
            backgroundColor: vars.card,
            borderColor: vars.border,
          }}
        >
          <span
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: vars.muted }}
          >
            {label}
          </span>
        </div>
        <div className="space-y-3 p-4" style={{ backgroundColor: vars.card }}>
          <div>
            <p className="text-sm font-semibold" style={{ color: vars.text }}>
              Case Title Example
            </p>
            <p className="text-xs" style={{ color: vars.secondary }}>
              [2025] ARTA 1234
            </p>
          </div>
          <div className="flex gap-2">
            <span
              className="rounded-sm px-2 py-0.5 text-xs font-medium text-white"
              style={{ backgroundColor: courtColors.ARTA }}
            >
              ARTA
            </span>
            <span
              className="rounded-sm border px-2 py-0.5 text-xs font-medium"
              style={{
                color: semanticColors.success,
                borderColor: `${semanticColors.success}33`,
                backgroundColor: `${semanticColors.success}1a`,
              }}
            >
              Allowed
            </span>
          </div>
          <div
            className="rounded border p-2 text-xs"
            style={{
              backgroundColor: vars.bg,
              borderColor: vars.border,
              color: vars.muted,
            }}
          >
            font-mono: case_id = a1b2c3d4
          </div>
          <button
            className="rounded px-3 py-1.5 text-xs font-medium text-white"
            style={{ backgroundColor: vars.accent }}
          >
            Action Button
          </button>
        </div>
      </div>
    )
  }

  return (
    <section>
      <SectionHeading id="dark-mode">Dark Mode Comparison</SectionHeading>
      <p className="mb-4 text-sm text-muted-text">
        Side-by-side comparison of the same UI elements in light and dark mode.
      </p>
      <div className="flex gap-4">
        <MiniCard vars={lightVars} label="Light" />
        <MiniCard vars={darkVars} label="Dark" />
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Section 9: CSS Variable Reference
   ═══════════════════════════════════════════════════════════════ */

interface VarRow {
  name: string
  category: string
  preview: "color" | "font" | "spacing" | "radius" | "shadow"
}

const ALL_VARS: VarRow[] = [
  // Colors (18)
  { name: "--color-primary", category: "Color", preview: "color" },
  { name: "--color-primary-light", category: "Color", preview: "color" },
  { name: "--color-primary-lighter", category: "Color", preview: "color" },
  { name: "--color-accent", category: "Color", preview: "color" },
  { name: "--color-accent-light", category: "Color", preview: "color" },
  { name: "--color-accent-muted", category: "Color", preview: "color" },
  { name: "--color-background", category: "Color", preview: "color" },
  { name: "--color-background-card", category: "Color", preview: "color" },
  { name: "--color-background-sidebar", category: "Color", preview: "color" },
  { name: "--color-background-surface", category: "Color", preview: "color" },
  { name: "--color-border", category: "Color", preview: "color" },
  { name: "--color-border-light", category: "Color", preview: "color" },
  { name: "--color-text", category: "Color", preview: "color" },
  { name: "--color-text-secondary", category: "Color", preview: "color" },
  { name: "--color-text-muted", category: "Color", preview: "color" },
  { name: "--color-semantic-success", category: "Color", preview: "color" },
  { name: "--color-semantic-warning", category: "Color", preview: "color" },
  { name: "--color-semantic-danger", category: "Color", preview: "color" },
  { name: "--color-semantic-info", category: "Color", preview: "color" },
  // Court colors (6)
  { name: "--color-court-aata", category: "Court", preview: "color" },
  { name: "--color-court-arta", category: "Court", preview: "color" },
  { name: "--color-court-fca", category: "Court", preview: "color" },
  { name: "--color-court-fcca", category: "Court", preview: "color" },
  { name: "--color-court-fedcfamc2g", category: "Court", preview: "color" },
  { name: "--color-court-hca", category: "Court", preview: "color" },
  // Fonts (3)
  { name: "--font-heading", category: "Font", preview: "font" },
  { name: "--font-body", category: "Font", preview: "font" },
  { name: "--font-mono", category: "Font", preview: "font" },
  // Spacing (7)
  { name: "--spacing-1", category: "Spacing", preview: "spacing" },
  { name: "--spacing-2", category: "Spacing", preview: "spacing" },
  { name: "--spacing-3", category: "Spacing", preview: "spacing" },
  { name: "--spacing-4", category: "Spacing", preview: "spacing" },
  { name: "--spacing-5", category: "Spacing", preview: "spacing" },
  { name: "--spacing-6", category: "Spacing", preview: "spacing" },
  { name: "--spacing-8", category: "Spacing", preview: "spacing" },
  // Radius (4)
  { name: "--radius-sm", category: "Radius", preview: "radius" },
  { name: "--radius", category: "Radius", preview: "radius" },
  { name: "--radius-lg", category: "Radius", preview: "radius" },
  { name: "--radius-pill", category: "Radius", preview: "radius" },
  // Shadow (4)
  { name: "--shadow-xs", category: "Shadow", preview: "shadow" },
  { name: "--shadow-sm", category: "Shadow", preview: "shadow" },
  { name: "--shadow", category: "Shadow", preview: "shadow" },
  { name: "--shadow-lg", category: "Shadow", preview: "shadow" },
]

function CssVariableReference() {
  const [computedVals, setComputedVals] = useState<Record<string, string>>({})

  useEffect(() => {
    const style = getComputedStyle(document.documentElement)
    const vals: Record<string, string> = {}
    for (const v of ALL_VARS) {
      vals[v.name] = style.getPropertyValue(v.name).trim()
    }
    setComputedVals(vals)
  }, [])

  function renderPreview(row: VarRow, value: string) {
    if (row.preview === "color") {
      return (
        <div
          className="h-5 w-8 rounded border border-black/10"
          style={{ backgroundColor: value }}
        />
      )
    }
    if (row.preview === "font") {
      return (
        <span className="text-xs" style={{ fontFamily: value }}>
          Abc
        </span>
      )
    }
    if (row.preview === "spacing") {
      return (
        <div
          className="rounded bg-accent/20"
          style={{ width: value, height: "12px" }}
        />
      )
    }
    if (row.preview === "radius") {
      return (
        <div
          className="h-5 w-5 border-2 border-accent bg-accent-muted"
          style={{ borderRadius: value }}
        />
      )
    }
    if (row.preview === "shadow") {
      return (
        <div
          className="h-5 w-8 rounded bg-card"
          style={{ boxShadow: value }}
        />
      )
    }
    return null
  }

  const categoryColors: Record<string, string> = {
    Color: "bg-accent/10 text-accent",
    Court: "bg-info/10 text-info",
    Font: "bg-success/10 text-success",
    Spacing: "bg-warning/10 text-warning",
    Radius: "bg-danger/10 text-danger",
    Shadow: "bg-muted-text/10 text-muted-text",
  }

  return (
    <section>
      <SectionHeading id="css-vars">CSS Variable Reference</SectionHeading>
      <p className="mb-4 text-sm text-muted-text">
        All {ALL_VARS.length} CSS custom properties. Click the variable name to
        copy <code className="text-accent">var(--name)</code>.
      </p>
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="max-h-[500px] overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-surface">
              <tr className="border-b border-border">
                <th className="px-3 py-2 font-medium text-foreground">Variable</th>
                <th className="px-3 py-2 font-medium text-foreground">Category</th>
                <th className="px-3 py-2 font-medium text-foreground">Value</th>
                <th className="px-3 py-2 font-medium text-foreground">Preview</th>
              </tr>
            </thead>
            <tbody>
              {ALL_VARS.map((row) => {
                const value = computedVals[row.name] ?? ""
                return (
                  <tr
                    key={row.name}
                    className="border-b border-border-light bg-card transition-colors hover:bg-surface"
                  >
                    <td className="px-3 py-1.5">
                      <button
                        onClick={() =>
                          copyToClipboard(`var(${row.name})`, row.name)
                        }
                        className="font-mono text-xs text-accent hover:underline"
                      >
                        {row.name}
                      </button>
                    </td>
                    <td className="px-3 py-1.5">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${categoryColors[row.category] ?? ""}`}
                      >
                        {row.category}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 font-mono text-[11px] text-muted-text">
                      {value.length > 40 ? `${value.slice(0, 40)}...` : value}
                    </td>
                    <td className="px-3 py-1.5">
                      {renderPreview(row, value)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Section 10: Usage Guide
   ═══════════════════════════════════════════════════════════════ */

function UsageGuide() {
  return (
    <section>
      <SectionHeading id="usage">Usage Guide</SectionHeading>
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="mb-2 text-sm font-semibold text-foreground">
            Tailwind Classes (via @theme)
          </h3>
          <pre className="overflow-auto rounded bg-surface p-3 font-mono text-xs text-foreground">
{`<div className="bg-background text-foreground border-border" />
<span className="text-accent font-heading" />
<div className="shadow-sm rounded-lg" />
<button className="bg-court-arta text-white rounded-sm" />`}
          </pre>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="mb-2 text-sm font-semibold text-foreground">
            TypeScript Token Imports
          </h3>
          <pre className="overflow-auto rounded bg-surface p-3 font-mono text-xs text-foreground">
{`import { tokens, courtColors, semanticColors } from "@/tokens/tokens"

// Recharts example
<Bar fill={courtColors.AATA} />
<Area stroke={semanticColors.success} />

// Inline styles
<div style={{ color: tokens.color.accent.DEFAULT }} />`}
          </pre>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="mb-2 text-sm font-semibold text-foreground">
            Raw CSS Variables
          </h3>
          <pre className="overflow-auto rounded bg-surface p-3 font-mono text-xs text-foreground">
{`.custom-element {
  color: var(--color-accent);
  font-family: var(--font-heading);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  background: var(--color-background-card);
}`}
          </pre>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="mb-2 text-sm font-semibold text-foreground">
            Theme Preset Hook
          </h3>
          <pre className="overflow-auto rounded bg-surface p-3 font-mono text-xs text-foreground">
{`import { useThemePreset } from "@/hooks/use-theme-preset"

function MyComponent() {
  const { preset, setPreset, resetPreset } = useThemePreset()
  // preset: "parchment" | "ocean" | "forest" | "slate" | "rose"
  // setPreset("ocean") -> applies immediately, persists to localStorage
  // resetPreset() -> returns to default Parchment theme
}`}
          </pre>
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Navigation
   ═══════════════════════════════════════════════════════════════ */

const NAV_ITEMS = [
  { id: "theme", label: "Theme" },
  { id: "colors", label: "Colors" },
  { id: "typography", label: "Typography" },
  { id: "spacing", label: "Spacing" },
  { id: "radius", label: "Radius" },
  { id: "shadows", label: "Shadows" },
  { id: "components", label: "Components" },
  { id: "dark-mode", label: "Dark Mode" },
  { id: "css-vars", label: "CSS Vars" },
  { id: "usage", label: "Usage" },
]

function SectionNav() {
  return (
    <nav className="mb-8 flex flex-wrap gap-1.5">
      {NAV_ITEMS.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-secondary-text transition-colors hover:border-accent hover:text-accent"
        >
          {item.label}
        </a>
      ))}
    </nav>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════════════════════ */

export function DesignTokensPage() {
  return (
    <div className="space-y-12">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Design Tokens
        </h1>
        <p className="text-sm text-muted-text">
          Live reference for all design tokens, components, and theme presets
          used across the application.
        </p>
      </div>

      <SectionNav />
      <ThemePresetSwitcher />
      <ColorPalette />
      <TypographySection />
      <SpacingSection />
      <RadiusSection />
      <ShadowSection />
      <ComponentGallery />
      <DarkModeComparison />
      <CssVariableReference />
      <UsageGuide />
    </div>
  )
}
