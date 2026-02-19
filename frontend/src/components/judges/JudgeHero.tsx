import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  GraduationCap,
  Briefcase,
  Calendar,
  ExternalLink,
  Globe,
  Linkedin,
  Twitter,
  User,
} from "lucide-react";
import type { JudgeProfile, JudgeBio } from "@/types/case";

interface JudgeHeroProps {
  profile: JudgeProfile;
  bio: JudgeBio;
  isLoading: boolean;
}

const PLATFORM_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  twitter: "Twitter / X",
  google_scholar: "Google Scholar",
  researchgate: "ResearchGate",
  university_page: "University",
  bar_association: "Bar Association",
};

function PlatformIcon({ platform }: { platform: string }) {
  switch (platform) {
    case "linkedin":
      return <Linkedin className="h-3.5 w-3.5" />;
    case "twitter":
      return <Twitter className="h-3.5 w-3.5" />;
    default:
      return <Globe className="h-3.5 w-3.5" />;
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border-light/60 p-3">
      <p className="text-xs uppercase tracking-wide text-muted-text">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

export function JudgeHero({ profile, bio, isLoading }: JudgeHeroProps) {
  const { t } = useTranslation();
  const [imgError, setImgError] = useState(false);

  const first = profile.judge.active_years.first ?? "-";
  const last = profile.judge.active_years.last ?? "-";
  const displayName = bio.found && bio.full_name ? bio.full_name : profile.judge.name;

  const currentYear = new Date().getFullYear();
  const age = bio.birth_year ? currentYear - bio.birth_year : null;
  const hasPhoto = bio.found && bio.photo_url && !imgError;

  const careerItems =
    bio.found && bio.previously
      ? bio.previously.split(/;\s*/).filter(Boolean)
      : [];

  const socialEntries =
    bio.found && bio.social_media
      ? Object.entries(bio.social_media).filter(
          ([, url]) => url && typeof url === "string" && url.startsWith("http"),
        )
      : [];

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      {/* Top section: avatar + name + role */}
      <div className="flex gap-4">
        <div className="shrink-0">
          {isLoading ? (
            <div className="h-20 w-20 animate-pulse rounded-full bg-border" />
          ) : hasPhoto ? (
            <img
              src={bio.photo_url}
              alt={displayName}
              className="h-20 w-20 rounded-full border border-border object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <img
              src={`https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(displayName)}&backgroundColor=1a5276,2d7d46,6c3483,b9770e,a83232,117864&textColor=ffffff&fontSize=36`}
              alt={displayName}
              className="h-20 w-20 rounded-full border border-border"
            />
          )}
        </div>

        <div className="flex-1 space-y-1">
          {isLoading ? (
            <div className="space-y-2">
              <div className="h-5 w-3/4 animate-pulse rounded bg-border" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-border" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-border" />
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-semibold text-foreground">
                {displayName}
              </h1>
              {bio.found && bio.role && (
                <p className="text-sm text-secondary-text">{bio.role}</p>
              )}
              {bio.found && bio.court && (
                <p className="text-sm text-muted-text">{bio.court}</p>
              )}
              <div className="flex flex-wrap gap-3 pt-1 text-xs text-muted-text">
                {bio.found && bio.appointed_year && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {t("judges.appointed")} {bio.appointed_year}
                  </span>
                )}
                {age && age > 0 && age < 120 && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {t("judges.age", { age })}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <Stat
          label={t("judges.total_cases")}
          value={profile.judge.total_cases.toLocaleString()}
        />
        <Stat
          label={t("judges.approval_rate")}
          value={`${profile.approval_rate.toFixed(1)}%`}
        />
        <Stat label={t("judges.court_type")} value={profile.court_type} />
        <Stat label={t("judges.active_years")} value={`${first} - ${last}`} />
      </div>

      {/* Education */}
      {bio.found && bio.education && bio.education.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-text">
            <GraduationCap className="h-3.5 w-3.5" />
            {t("judges.education")}
          </div>
          <ul className="mt-1.5 space-y-0.5 text-sm text-foreground">
            {bio.education.map((edu) => (
              <li key={edu} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/40" />
                {edu}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Career History */}
      {careerItems.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-text">
            <Briefcase className="h-3.5 w-3.5" />
            {t("judges.career_history")}
          </div>
          {careerItems.length === 1 ? (
            <p className="mt-1.5 text-sm text-foreground">{careerItems[0]}</p>
          ) : (
            <ul className="mt-1.5 space-y-0.5 text-sm text-foreground">
              {careerItems.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-secondary-text/30" />
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Social Media / Online Profiles */}
      {socialEntries.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-text">
            <Globe className="h-3.5 w-3.5" />
            {t("judges.social_profiles")}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {socialEntries.map(([platform, url]) => (
              <a
                key={platform}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-accent transition-colors hover:bg-accent/10"
              >
                <PlatformIcon platform={platform} />
                {PLATFORM_LABELS[platform] ?? platform}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Source link */}
      {bio.found && bio.source_url && (
        <div className="mt-4 border-t border-border-light/60 pt-3">
          <a
            href={bio.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            {(() => {
              try {
                return new URL(bio.source_url).hostname;
              } catch {
                return bio.source_url.length > 50
                  ? bio.source_url.slice(0, 50) + "..."
                  : bio.source_url;
              }
            })()}
          </a>
        </div>
      )}
    </div>
  );
}
