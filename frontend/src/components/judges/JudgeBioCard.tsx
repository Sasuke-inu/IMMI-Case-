import { useState } from "react";
import { GraduationCap, Briefcase, Calendar, ExternalLink, User } from "lucide-react";
import type { JudgeBio } from "@/types/case";

interface JudgeBioCardProps {
  bio: JudgeBio;
  isLoading: boolean;
}

export function JudgeBioCard({ bio, isLoading }: JudgeBioCardProps) {
  const [imgError, setImgError] = useState(false);

  if (isLoading) {
    return (
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-base font-semibold text-foreground">Biography</h2>
        <div className="flex gap-4">
          <div className="h-20 w-20 shrink-0 animate-pulse rounded-full bg-border" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 animate-pulse rounded bg-border" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-border" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-border" />
          </div>
        </div>
      </section>
    );
  }

  if (!bio.found) {
    return (
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-base font-semibold text-foreground">Biography</h2>
        <p className="text-sm text-muted-text">
          No public biographical record found for this judge/member.
        </p>
      </section>
    );
  }

  const currentYear = new Date().getFullYear();
  const age = bio.birth_year ? currentYear - bio.birth_year : null;
  const hasPhoto = bio.photo_url && !imgError;

  // Split career history into items if it contains semicolons
  const careerItems = bio.previously
    ? bio.previously.split(/;\s*/).filter(Boolean)
    : [];

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 text-base font-semibold text-foreground">Biography</h2>

      <div className="flex gap-4">
        {/* Profile photo or avatar */}
        <div className="shrink-0">
          {hasPhoto ? (
            <img
              src={bio.photo_url}
              alt={bio.full_name ?? "Judge photo"}
              className="h-20 w-20 rounded-full border border-border object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-border bg-accent/10">
              <User className="h-8 w-8 text-accent/60" />
            </div>
          )}
        </div>

        {/* Name, role, court */}
        <div className="flex-1 space-y-1">
          {bio.full_name && (
            <p className="text-lg font-semibold text-foreground">{bio.full_name}</p>
          )}
          {bio.role && (
            <p className="text-sm text-secondary-text">{bio.role}</p>
          )}
          {bio.court && (
            <p className="text-sm text-muted-text">{bio.court}</p>
          )}
          <div className="flex flex-wrap gap-3 pt-1 text-xs text-muted-text">
            {bio.appointed_year && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Appointed {bio.appointed_year}
              </span>
            )}
            {age && age > 0 && age < 120 && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                Age ~{age}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Education */}
      {bio.education && bio.education.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-text">
            <GraduationCap className="h-3.5 w-3.5" />
            Education
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
            Career History
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

      {/* Source link */}
      {bio.source_url && (
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
    </section>
  );
}
