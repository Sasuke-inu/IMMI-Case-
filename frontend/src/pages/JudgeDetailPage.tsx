import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { JudgeHero } from "@/components/judges/JudgeHero";
import { CourtComparisonCard } from "@/components/judges/CourtComparisonCard";
import { RepresentationCard } from "@/components/judges/RepresentationCard";
import { CountryOriginChart } from "@/components/judges/CountryOriginChart";
import { VisaBreakdownChart } from "@/components/judges/VisaBreakdownChart";
import { NatureBreakdownChart } from "@/components/judges/NatureBreakdownChart";
import { ConceptEffectivenessTable } from "@/components/judges/ConceptEffectivenessTable";
import { ApiErrorState } from "@/components/shared/ApiErrorState";
import { useJudgeProfile, useJudgeBio } from "@/hooks/use-judges";

const OUTCOME_COLORS = ["#1a5276", "#2d7d46", "#6c3483", "#b9770e", "#a83232", "#117864"];

export function JudgeDetailPage() {
  const { t } = useTranslation();
  const { name = "" } = useParams();
  const decodedName = decodeURIComponent(name);
  const { data, isLoading, isError, error, refetch } = useJudgeProfile(decodedName);
  const { data: bioData, isLoading: bioLoading } = useJudgeBio(decodedName);

  if (isLoading) {
    return <p className="text-sm text-muted-text">{t("judges.loading_profile")}</p>;
  }

  if (isError) {
    return (
      <div className="space-y-4">
        <Link to="/judge-profiles" className="text-sm font-medium text-accent hover:underline">
          {t("judges.back_to_profiles")}
        </Link>
        <ApiErrorState
          title={t("judges.profile_load_failed")}
          message={error instanceof Error ? error.message : t("judges.profile_load_failed")}
          onRetry={() => {
            void refetch();
          }}
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <Link to="/judge-profiles" className="text-sm font-medium text-accent hover:underline">
          {t("judges.back_to_profiles")}
        </Link>
        <ApiErrorState
          title={t("judges.profile_not_found")}
          message={`No profile data returned for "${decodedName}".`}
          onRetry={() => {
            void refetch();
          }}
        />
      </div>
    );
  }

  const outcomeRows = Object.entries(data.outcome_distribution).map(([outcome, count]) => ({
    outcome,
    count,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link to="/judge-profiles" className="text-sm font-medium text-accent hover:underline">
          {t("judges.back_to_profiles")}
        </Link>
      </div>

      <JudgeHero
        profile={data}
        bio={bioData ?? { found: false }}
        isLoading={bioLoading}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-base font-semibold text-foreground">
            {t("judges.outcome_distribution")}
          </h2>
          {outcomeRows.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={outcomeRows} dataKey="count" nameKey="outcome" outerRadius={90}>
                  {outcomeRows.map((row, idx) => (
                    <Cell key={row.outcome} fill={OUTCOME_COLORS[idx % OUTCOME_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number | string | undefined) => [
                    Number(value ?? 0).toLocaleString(),
                    t("judges.cases"),
                  ]}
                  contentStyle={{
                    backgroundColor: "var(--color-background-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius)",
                    color: "var(--color-text)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-text">{t("judges.no_outcome_data")}</p>
          )}
        </section>

        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-base font-semibold text-foreground">
            {t("judges.yearly_approval_trend")}
          </h2>
          {data.yearly_trend.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={data.yearly_trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.35} />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }} />
                <Tooltip
                  formatter={(value: number | string | undefined) => [
                    `${Number(value ?? 0).toFixed(1)}%`,
                    t("judges.approval_rate"),
                  ]}
                  contentStyle={{
                    backgroundColor: "var(--color-background-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius)",
                    color: "var(--color-text)",
                  }}
                />
                <Area type="monotone" dataKey="approval_rate" stroke="#1a5276" fill="#1a527640" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-text">{t("judges.no_trend_data")}</p>
          )}
        </section>
      </div>

      {/* Court Comparison */}
      <CourtComparisonCard data={data.court_comparison} />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-base font-semibold text-foreground">
            {t("judges.visa_breakdown")}
          </h2>
          <VisaBreakdownChart data={data.visa_breakdown} />
        </section>

        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-base font-semibold text-foreground">
            {t("judges.nature_breakdown")}
          </h2>
          <NatureBreakdownChart data={data.nature_breakdown} />
        </section>
      </div>

      {/* Representation Analysis */}
      <RepresentationCard data={data.representation_analysis} />

      {/* Country of Origin */}
      <CountryOriginChart data={data.country_breakdown} />

      <section>
        <h2 className="mb-3 text-base font-semibold text-foreground">
          {t("judges.concept_effectiveness")}
        </h2>
        <ConceptEffectivenessTable data={data.concept_effectiveness} />
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-base font-semibold text-foreground">
          {t("judges.recent_cases")}
        </h2>
        {!data.recent_cases?.length ? (
          <p className="text-sm text-muted-text">{t("judges.no_recent_cases")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-text">
                  <th className="py-2 pr-2">{t("judges.citation")}</th>
                  <th className="py-2 pr-2">{t("judges.date")}</th>
                  <th className="py-2 pr-2">{t("judges.outcome")}</th>
                  <th className="py-2">{t("judges.visa")}</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_cases.slice(0, 10).map((item) => (
                  <tr key={item.case_id} className="border-b border-border-light/60">
                    <td className="py-2 pr-2 text-accent">
                      <Link className="hover:underline" to={`/cases/${item.case_id}`}>
                        {item.citation}
                      </Link>
                    </td>
                    <td className="py-2 pr-2 text-secondary-text">{item.date || "-"}</td>
                    <td className="py-2 pr-2 text-secondary-text">{item.outcome || "-"}</td>
                    <td className="py-2 text-secondary-text">{item.visa_subclass || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
