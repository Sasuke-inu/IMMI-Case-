import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, BookOpen, ExternalLink } from "lucide-react";
import { useLegislationDetail } from "@/hooks/use-legislations";
import { Breadcrumb } from "@/components/shared/Breadcrumb";
import { cn } from "@/lib/utils";
import type { LegislationSection } from "@/lib/api";

const AUSTLII_BASE = "https://www.austlii.edu.au/au/legis/cth";

// ── Sub-components ────────────────────────────────────────────────────────────

interface MetaFieldProps {
  label: string;
  value?: string | number | null;
  mono?: boolean;
}

function MetaField({ label, value, mono }: MetaFieldProps) {
  if (!value && value !== 0) return null;
  return (
    <div>
      <dt className="text-xs font-medium text-secondary-text">{label}</dt>
      <dd className={cn("mt-0.5 text-sm text-foreground", mono && "font-mono text-xs")}>
        {value}
      </dd>
    </div>
  );
}

/** Left sidebar: TOC grouped by Part */
function LegislationToc({ sections }: { sections: LegislationSection[] }) {
  const parts = useMemo(() => {
    const map = new Map<string, LegislationSection[]>();
    for (const s of sections) {
      const key = s.part || "General Provisions";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  }, [sections]);

  return (
    <nav className="max-h-[calc(100vh-12rem)] overflow-y-auto rounded-lg border border-border bg-card p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-text">
        Contents
      </p>
      <ul className="space-y-3">
        {Array.from(parts.entries()).map(([part, secs]) => (
          <li key={part}>
            <p className="mb-1 text-xs font-semibold leading-tight text-secondary-text">
              {part}
            </p>
            <ul className="space-y-0.5 border-l border-border pl-2">
              {secs.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className={cn(
                      "block truncate rounded px-1.5 py-0.5 text-xs text-muted-text",
                      "transition-colors hover:bg-surface hover:text-foreground",
                    )}
                  >
                    <span className="font-mono text-accent">{s.number}</span>
                    {s.title && (
                      <span className="ml-1 text-secondary-text">{s.title}</span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** A single section card */
function SectionCard({ section }: { section: LegislationSection }) {
  return (
    <div id={section.id} className="scroll-mt-4 rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-sm font-semibold text-accent">
            {section.number}
          </span>
          {section.title && (
            <span className="font-heading text-sm font-medium text-foreground">
              {section.title}
            </span>
          )}
        </div>
        {section.division && (
          <span className="shrink-0 rounded bg-surface px-1.5 py-0.5 text-xs text-muted-text">
            {section.division}
          </span>
        )}
      </div>
      <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-secondary-text">
        {section.text}
      </pre>
    </div>
  );
}

/** Empty state when sections haven't been scraped yet */
function NotScrapedState({ onUpdate }: { onUpdate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card p-12 text-center">
      <BookOpen className="mb-3 h-10 w-10 text-muted-text" />
      <h3 className="font-heading text-base font-semibold text-foreground">
        Full text not yet downloaded
      </h3>
      <p className="mt-1 text-sm text-secondary-text">
        Click "Update Laws" on the legislations list to download section text from AustLII.
      </p>
      <button
        onClick={onUpdate}
        className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90"
      >
        Go to Legislations
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function LegislationDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useLegislationDetail(id ?? null);

  if (error) {
    return (
      <div className="space-y-4">
        <Breadcrumb
          items={[
            { label: t("common.dashboard"), href: "/" },
            { label: t("legislations.title", { defaultValue: "Legislations" }), href: "/legislations" },
            { label: t("common.not_found") },
          ]}
        />
        <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-danger/30 bg-danger/5 p-8 text-center">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            {t("common.not_found")}
          </h2>
          <p className="mt-2 text-sm text-secondary-text">
            {t("legislations.not_found_description", {
              defaultValue: "This legislation could not be found",
            })}
          </p>
          <button
            onClick={() => navigate("/legislations")}
            className="mt-4 flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("common.back")}
          </button>
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-text">
        {t("common.loading_ellipsis")}
      </div>
    );
  }

  const legislation = data.data;
  const sections = legislation.sections ?? [];
  const austliiUrl = `${AUSTLII_BASE}/${legislation.austlii_id}/`;

  return (
    <div className="space-y-4">
      {/* Breadcrumb + Back */}
      <div className="flex items-center justify-between">
        <Breadcrumb
          items={[
            { label: t("common.dashboard"), href: "/" },
            { label: t("legislations.title", { defaultValue: "Legislations" }), href: "/legislations" },
            { label: legislation.title },
          ]}
        />
        <button
          onClick={() => navigate("/legislations")}
          className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("common.back")}
        </button>
      </div>

      {/* Hero */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-2xl font-semibold text-foreground">
              {legislation.title}
            </h1>
            {legislation.description && (
              <p className="mt-2 text-sm leading-relaxed text-secondary-text">
                {legislation.description}
              </p>
            )}
          </div>
          {legislation.shortcode && (
            <div className="shrink-0 rounded-md bg-accent/10 px-3 py-1.5 text-sm font-medium text-accent">
              {legislation.shortcode}
            </div>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-base font-semibold text-foreground">
            {t("legislations.information", { defaultValue: "Legislation Information" })}
          </h2>
          <a
            href={austliiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-accent hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            AustLII
          </a>
        </div>
        <dl className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
          <MetaField label="ID" value={legislation.id} mono />
          <MetaField label="Shortcode" value={legislation.shortcode} mono />
          <MetaField label="AustLII ID" value={legislation.austlii_id} mono />
          <MetaField label="Jurisdiction" value={legislation.jurisdiction} />
          <MetaField label="Type" value={legislation.type} />
          <MetaField
            label={t("legislations.sections", { defaultValue: "Sections" })}
            value={legislation.sections_count || undefined}
          />
          <MetaField
            label={t("legislations.last_amended", { defaultValue: "Last Amended" })}
            value={legislation.last_amended || undefined}
          />
          <MetaField
            label={t("legislations.last_scraped", { defaultValue: "Last Scraped" })}
            value={legislation.last_scraped ? new Date(legislation.last_scraped).toLocaleDateString("en-AU") : undefined}
          />
        </dl>
      </div>

      {/* Sections: TOC + Content */}
      {sections.length === 0 ? (
        <NotScrapedState onUpdate={() => navigate("/legislations")} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
          {/* Sticky TOC sidebar */}
          <div className="lg:sticky lg:top-4 lg:self-start">
            <LegislationToc sections={sections} />
          </div>

          {/* Section cards */}
          <div className="space-y-3">
            {sections.map((section) => (
              <SectionCard key={section.id} section={section} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
