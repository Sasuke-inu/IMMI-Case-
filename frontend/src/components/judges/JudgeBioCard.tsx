import type { JudgeBio } from "@/types/case";

interface JudgeBioCardProps {
  bio: JudgeBio;
  isLoading: boolean;
}

export function JudgeBioCard({ bio, isLoading }: JudgeBioCardProps) {
  if (isLoading) {
    return (
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-base font-semibold text-foreground">
          Biography
        </h2>
        <p className="text-sm text-muted-text">Loading biographical data...</p>
      </section>
    );
  }

  if (!bio.found) {
    return (
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-base font-semibold text-foreground">
          Biography
        </h2>
        <p className="text-sm text-muted-text">
          No public biographical record found for this judge/member.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 text-base font-semibold text-foreground">
        Biography
      </h2>
      <div className="space-y-2 text-sm">
        {bio.full_name && (
          <Row label="Full Name" value={bio.full_name} />
        )}
        {bio.role && <Row label="Role" value={bio.role} />}
        {bio.court && <Row label="Court/Tribunal" value={bio.court} />}
        {bio.appointed_year && (
          <Row label="Appointed" value={String(bio.appointed_year)} />
        )}
        {bio.education && bio.education.length > 0 && (
          <div>
            <span className="text-xs uppercase tracking-wide text-muted-text">
              Education
            </span>
            <ul className="mt-1 list-inside list-disc text-foreground">
              {bio.education.map((edu) => (
                <li key={edu}>{edu}</li>
              ))}
            </ul>
          </div>
        )}
        {bio.previously && (
          <Row label="Previously" value={bio.previously} />
        )}
        {bio.source_url && (
          <div>
            <span className="text-xs uppercase tracking-wide text-muted-text">
              Source
            </span>
            <p className="mt-0.5">
              <a
                href={bio.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                {bio.source_url.length > 60
                  ? bio.source_url.slice(0, 60) + "..."
                  : bio.source_url}
              </a>
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs uppercase tracking-wide text-muted-text">
        {label}
      </span>
      <p className="mt-0.5 text-foreground">{value}</p>
    </div>
  );
}
