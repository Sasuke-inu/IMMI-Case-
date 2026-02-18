import type { JudgeProfile } from "@/types/case";

interface JudgeProfileHeaderProps {
  profile: JudgeProfile;
}

export function JudgeProfileHeader({ profile }: JudgeProfileHeaderProps) {
  const first = profile.judge.active_years.first ?? "-";
  const last = profile.judge.active_years.last ?? "-";

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h1 className="text-2xl font-semibold text-foreground">{profile.judge.name}</h1>
      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <Stat label="Total Cases" value={profile.judge.total_cases.toLocaleString()} />
        <Stat label="Approval Rate" value={`${profile.approval_rate.toFixed(1)}%`} />
        <Stat label="Court Type" value={profile.court_type} />
        <Stat label="Active Years" value={`${first} - ${last}`} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border-light/60 p-3">
      <p className="text-xs uppercase tracking-wide text-muted-text">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
