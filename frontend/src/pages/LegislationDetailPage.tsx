import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { useLegislationDetail } from "@/hooks/use-legislations";
import { Breadcrumb } from "@/components/shared/Breadcrumb";
import { CaseTextViewer } from "@/components/cases/CaseTextViewer";
import { cn } from "@/lib/utils";

function formatDateCompact(date: string): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

interface MetaFieldProps {
  label: string;
  value?: string | number | null;
  mono?: boolean;
}

function MetaField({ label, value, mono }: MetaFieldProps) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-medium text-secondary-text">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 text-sm text-foreground",
          mono && "font-mono text-xs",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

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
            {
              label: t("legislations.title", { defaultValue: "Legislations" }),
              href: "/legislations",
            },
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
            className="mt-4 flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
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

  return (
    <div className="space-y-4">
      {/* Breadcrumb + Back Button */}
      <div className="flex items-center justify-between">
        <Breadcrumb
          items={[
            { label: t("common.dashboard"), href: "/" },
            {
              label: t("legislations.title", { defaultValue: "Legislations" }),
              href: "/legislations",
            },
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

      {/* Hero Section */}
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

      {/* Legislation Information */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-3 font-heading text-base font-semibold text-foreground">
          {t("legislations.information", {
            defaultValue: "Legislation Information",
          })}
        </h2>
        <dl className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
          <MetaField
            label={t("legislations.id", { defaultValue: "ID" })}
            value={legislation.id}
            mono
          />
          <MetaField
            label={t("legislations.shortcode", { defaultValue: "Shortcode" })}
            value={legislation.shortcode}
            mono
          />
          <MetaField
            label={t("legislations.jurisdiction", {
              defaultValue: "Jurisdiction",
            })}
            value={legislation.jurisdiction}
          />
          <MetaField
            label={t("legislations.type", { defaultValue: "Type" })}
            value={legislation.type}
          />
          <MetaField
            label={t("legislations.version", { defaultValue: "Version" })}
            value={legislation.version}
            mono
          />
          <MetaField
            label={t("legislations.sections", { defaultValue: "Sections" })}
            value={legislation.sections}
          />
          <MetaField
            label={t("legislations.updated", { defaultValue: "Updated" })}
            value={
              legislation.updated_date
                ? formatDateCompact(legislation.updated_date)
                : ""
            }
          />
          <MetaField
            label={t("legislations.last_amended", {
              defaultValue: "Last Amended",
            })}
            value={
              legislation.last_amended
                ? formatDateCompact(legislation.last_amended)
                : ""
            }
          />
        </dl>
      </div>

      {/* Full Text */}
      {legislation.full_text && (
        <CaseTextViewer
          text={legislation.full_text}
          citation={legislation.title}
        />
      )}
    </div>
  );
}
