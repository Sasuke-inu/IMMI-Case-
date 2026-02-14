import { tokens, courtColors, semanticColors } from "@/tokens/tokens"
import { CourtBadge } from "@/components/shared/CourtBadge"
import { OutcomeBadge } from "@/components/shared/OutcomeBadge"

function ColorSwatch({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-10 w-10 rounded-md border border-border shadow-sm"
        style={{ backgroundColor: value }}
      />
      <div>
        <p className="text-sm font-medium text-foreground">{name}</p>
        <p className="font-mono text-xs text-muted-text">{value}</p>
      </div>
    </div>
  )
}

export function DesignTokensPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Design Tokens
        </h1>
        <p className="text-sm text-muted-text">
          Live reference for all design tokens used across the application.
        </p>
      </div>

      {/* ─── Color Palette ─────────────────────────────── */}
      <section>
        <h2 className="mb-4 font-heading text-xl font-semibold">
          Color Palette
        </h2>

        <h3 className="mb-2 text-sm font-medium text-secondary-text">
          Primary
        </h3>
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <ColorSwatch name="primary" value={tokens.color.primary.DEFAULT} />
          <ColorSwatch name="primary-light" value={tokens.color.primary.light} />
          <ColorSwatch name="primary-lighter" value={tokens.color.primary.lighter} />
        </div>

        <h3 className="mb-2 text-sm font-medium text-secondary-text">
          Accent
        </h3>
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <ColorSwatch name="accent" value={tokens.color.accent.DEFAULT} />
          <ColorSwatch name="accent-light" value={tokens.color.accent.light} />
          <ColorSwatch name="accent-muted" value={tokens.color.accent.muted} />
        </div>

        <h3 className="mb-2 text-sm font-medium text-secondary-text">
          Semantic
        </h3>
        <div className="mb-6 grid gap-4 sm:grid-cols-4">
          {Object.entries(semanticColors).map(([name, value]) => (
            <ColorSwatch key={name} name={name} value={value} />
          ))}
        </div>

        <h3 className="mb-2 text-sm font-medium text-secondary-text">
          Court Colors
        </h3>
        <div className="mb-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {Object.entries(courtColors).map(([name, value]) => (
            <ColorSwatch key={name} name={name} value={value} />
          ))}
        </div>
      </section>

      {/* ─── Typography ────────────────────────────────── */}
      <section>
        <h2 className="mb-4 font-heading text-xl font-semibold">Typography</h2>
        <div className="space-y-4 rounded-lg border border-border bg-card p-6">
          <div>
            <p className="text-xs text-muted-text">Heading — Crimson Text</p>
            <p className="font-heading text-3xl font-semibold">
              The quick brown fox jumps over the lazy dog
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-text">Body — Inter</p>
            <p className="text-base">
              The quick brown fox jumps over the lazy dog
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-text">Mono — SF Mono</p>
            <p className="font-mono text-sm">
              const result = await fetchCases(filters)
            </p>
          </div>
        </div>
      </section>

      {/* ─── Spacing ───────────────────────────────────── */}
      <section>
        <h2 className="mb-4 font-heading text-xl font-semibold">Spacing</h2>
        <div className="flex flex-wrap items-end gap-4">
          {Object.entries(tokens.spacing).map(([key, value]) => (
            <div key={key} className="text-center">
              <div
                className="bg-accent/20 border border-accent/40 rounded"
                style={{ width: value, height: value }}
              />
              <p className="mt-1 text-xs text-muted-text">{key}</p>
              <p className="font-mono text-[10px] text-muted-text">{value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Border Radius ─────────────────────────────── */}
      <section>
        <h2 className="mb-4 font-heading text-xl font-semibold">
          Border Radius
        </h2>
        <div className="flex flex-wrap gap-6">
          {Object.entries(tokens.radius).map(([key, value]) => (
            <div key={key} className="text-center">
              <div
                className="h-16 w-16 border-2 border-accent bg-accent-muted"
                style={{ borderRadius: value }}
              />
              <p className="mt-2 text-xs text-muted-text">{key}</p>
              <p className="font-mono text-[10px] text-muted-text">{value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Shadows ───────────────────────────────────── */}
      <section>
        <h2 className="mb-4 font-heading text-xl font-semibold">Shadows</h2>
        <div className="grid gap-6 sm:grid-cols-4">
          {Object.entries(tokens.shadow).map(([key, value]) => (
            <div
              key={key}
              className="rounded-lg border border-border bg-card p-6 text-center"
              style={{ boxShadow: value }}
            >
              <p className="text-sm font-medium text-foreground">
                shadow-{key === "DEFAULT" ? "default" : key}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Court Badges ──────────────────────────────── */}
      <section>
        <h2 className="mb-4 font-heading text-xl font-semibold">
          Court Badges
        </h2>
        <div className="flex flex-wrap gap-2">
          {Object.keys(courtColors).map((court) => (
            <CourtBadge key={court} court={court} />
          ))}
        </div>
      </section>

      {/* ─── Outcome Badges ────────────────────────────── */}
      <section>
        <h2 className="mb-4 font-heading text-xl font-semibold">
          Outcome Badges
        </h2>
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
      </section>

      {/* ─── Usage Guide ───────────────────────────────── */}
      <section>
        <h2 className="mb-4 font-heading text-xl font-semibold">
          Usage Examples
        </h2>
        <div className="rounded-lg border border-border bg-card p-6">
          <pre className="overflow-auto font-mono text-xs text-foreground">
{`// Tailwind classes (via @theme)
<div className="bg-background text-foreground border-border" />
<span className="text-accent font-heading" />
<div className="shadow-sm rounded-lg" />

// TypeScript imports
import { courtColors, semanticColors } from "@/tokens/tokens"
// Use in Recharts: fill={courtColors.AATA}

// CSS variables
.custom-element {
  color: var(--color-accent);
  font-family: var(--font-heading);
  border-radius: var(--radius-lg);
}`}
          </pre>
        </div>
      </section>
    </div>
  )
}
