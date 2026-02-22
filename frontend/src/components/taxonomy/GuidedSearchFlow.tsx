import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  ArrowLeft,
  Search,
  User,
  Globe,
  Tag,
  FileText,
  CheckCircle,
} from "lucide-react";
import {
  useVisaLookup,
  useCountries,
  useLegalConcepts,
  useJudgeAutocomplete,
  useGuidedSearch,
} from "@/hooks/use-taxonomy";
import { cn } from "@/lib/utils";
import type {
  VisaEntry,
  CountryEntry,
  LegalConceptEntry,
  JudgeAutocompleteEntry,
} from "@/lib/api";
import { toast } from "sonner";

type FlowType = "find-precedents" | "assess-judge";

interface FlowState {
  visa_subclass?: string;
  country?: string;
  legal_concepts: string[];
  judge_name?: string;
}

export function GuidedSearchFlow() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Flow selection and state
  const [selectedFlow, setSelectedFlow] = useState<FlowType | null>(null);
  const [step, setStep] = useState(0);
  const [flowState, setFlowState] = useState<FlowState>({
    legal_concepts: [],
  });

  // Input values for autocomplete
  const [visaQuery, setVisaQuery] = useState("");
  const [judgeQuery, setJudgeQuery] = useState("");
  const [debouncedVisaQuery, setDebouncedVisaQuery] = useState("");
  const [debouncedJudgeQuery, setDebouncedJudgeQuery] = useState("");

  // Debounce timers
  const visaDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const judgeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      if (visaDebounceRef.current) clearTimeout(visaDebounceRef.current);
      if (judgeDebounceRef.current) clearTimeout(judgeDebounceRef.current);
    };
  }, []);

  // Fetch taxonomy data
  const { data: visaData } = useVisaLookup(debouncedVisaQuery, 10);
  const { data: countriesData } = useCountries(30);
  const { data: conceptsData } = useLegalConcepts();
  const { data: judgeData } = useJudgeAutocomplete(debouncedJudgeQuery, 10);

  const visaResults = visaData?.data ?? [];
  const countries = countriesData?.countries ?? [];
  const concepts = conceptsData?.concepts ?? [];
  const judgeResults = judgeData?.judges ?? [];

  const guidedSearchMutation = useGuidedSearch();

  // Handle visa query with debounce
  const handleVisaQueryChange = useCallback((value: string) => {
    setVisaQuery(value);
    if (visaDebounceRef.current) clearTimeout(visaDebounceRef.current);
    visaDebounceRef.current = setTimeout(() => {
      setDebouncedVisaQuery(value);
    }, 300);
  }, []);

  // Handle judge query with debounce
  const handleJudgeQueryChange = useCallback((value: string) => {
    setJudgeQuery(value);
    if (judgeDebounceRef.current) clearTimeout(judgeDebounceRef.current);
    judgeDebounceRef.current = setTimeout(() => {
      setDebouncedJudgeQuery(value);
    }, 300);
  }, []);

  const resetFlow = useCallback(() => {
    setSelectedFlow(null);
    setStep(0);
    setFlowState({ legal_concepts: [] });
    setVisaQuery("");
    setJudgeQuery("");
    setDebouncedVisaQuery("");
    setDebouncedJudgeQuery("");
  }, []);

  const handleSelectFlow = useCallback((flow: FlowType) => {
    setSelectedFlow(flow);
    setStep(1);
  }, []);

  const handleBack = useCallback(() => {
    if (step === 1) {
      resetFlow();
    } else {
      setStep((prev) => prev - 1);
    }
  }, [step, resetFlow]);

  const handleNext = useCallback(() => {
    setStep((prev) => prev + 1);
  }, []);

  const handleSelectVisa = useCallback(
    (visa: VisaEntry) => {
      setFlowState((prev) => ({ ...prev, visa_subclass: visa.subclass }));
      setVisaQuery(`${visa.subclass} - ${visa.name}`);
      handleNext();
    },
    [handleNext],
  );

  const handleSelectCountry = useCallback(
    (country: string) => {
      setFlowState((prev) => ({ ...prev, country }));
      handleNext();
    },
    [handleNext],
  );

  const toggleConcept = useCallback((conceptName: string) => {
    setFlowState((prev) => {
      const current = prev.legal_concepts;
      const next = current.includes(conceptName)
        ? current.filter((c) => c !== conceptName)
        : [...current, conceptName];
      return { ...prev, legal_concepts: next };
    });
  }, []);

  const handleSelectJudge = useCallback(
    (judge: JudgeAutocompleteEntry) => {
      setFlowState((prev) => ({ ...prev, judge_name: judge.name }));
      setJudgeQuery(judge.name);
      handleNext();
    },
    [handleNext],
  );

  const handleSubmitPrecedents = useCallback(async () => {
    if (!flowState.visa_subclass) {
      toast.error(t("taxonomy.visa_required"));
      return;
    }

    try {
      const result = await guidedSearchMutation.mutateAsync({
        flow: "find-precedents",
        visa_subclass: flowState.visa_subclass,
        country: flowState.country,
        legal_concepts: flowState.legal_concepts,
      });

      if (result.success) {
        toast.success(
          t("taxonomy.search_complete", {
            defaultValue: "Search complete! Found {{count}} cases",
            count: result.total ?? 0,
          }),
        );
        const params = new URLSearchParams();
        params.set("visa_type", flowState.visa_subclass);
        if (flowState.country) params.set("keyword", flowState.country);
        navigate(`/cases?${params.toString()}`);
      }
    } catch (error) {
      toast.error((error as Error).message);
    }
  }, [flowState, guidedSearchMutation, navigate, t]);

  const handleSubmitJudge = useCallback(async () => {
    if (!flowState.judge_name) {
      toast.error(t("taxonomy.judge_required"));
      return;
    }

    try {
      const result = await guidedSearchMutation.mutateAsync({
        flow: "assess-judge",
        judge_name: flowState.judge_name,
      });

      if (result.success && result.judge_profile) {
        toast.success(
          t("taxonomy.judge_found", {
            defaultValue: "Judge profile found!",
          }),
        );
        navigate(`/judges/${encodeURIComponent(flowState.judge_name)}`);
      }
    } catch (error) {
      toast.error((error as Error).message);
    }
  }, [flowState, guidedSearchMutation, navigate, t]);

  // Flow selection screen
  if (!selectedFlow) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="font-heading text-lg font-semibold text-foreground">
            {t("taxonomy.guided_search", {
              defaultValue: "Guided Search",
            })}
          </h2>
          <p className="mt-0.5 text-sm text-secondary-text">
            {t("taxonomy.guided_search_desc", {
              defaultValue: "Choose a workflow to find cases or assess judges",
            })}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Find Precedents Flow */}
          <button
            onClick={() => handleSelectFlow("find-precedents")}
            className={cn(
              "group rounded-lg border border-border bg-card p-6 text-left transition-all",
              "hover:border-accent hover:bg-surface focus:outline-none focus:ring-2 focus:ring-accent",
            )}
          >
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-accent-muted p-2 text-accent transition-colors group-hover:bg-accent group-hover:text-white">
                <FileText className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-heading text-base font-semibold text-foreground">
                  {t("taxonomy.find_precedents", {
                    defaultValue: "Find Precedents",
                  })}
                </h3>
                <p className="mt-1 text-sm text-secondary-text">
                  {t("taxonomy.find_precedents_desc", {
                    defaultValue:
                      "Search for similar cases by visa type, country, and legal concepts",
                  })}
                </p>
                <div className="mt-3 flex items-center gap-1 text-xs font-medium text-accent">
                  <span>
                    {t("taxonomy.start_flow", { defaultValue: "Start flow" })}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </div>
            </div>
          </button>

          {/* Assess Judge Flow */}
          <button
            onClick={() => handleSelectFlow("assess-judge")}
            className={cn(
              "group rounded-lg border border-border bg-card p-6 text-left transition-all",
              "hover:border-accent hover:bg-surface focus:outline-none focus:ring-2 focus:ring-accent",
            )}
          >
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-accent-muted p-2 text-accent transition-colors group-hover:bg-accent group-hover:text-white">
                <User className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-heading text-base font-semibold text-foreground">
                  {t("taxonomy.assess_judge", {
                    defaultValue: "Assess Judge",
                  })}
                </h3>
                <p className="mt-1 text-sm text-secondary-text">
                  {t("taxonomy.assess_judge_desc", {
                    defaultValue:
                      "View judge profile, approval rates, and case history",
                  })}
                </p>
                <div className="mt-3 flex items-center gap-1 text-xs font-medium text-accent">
                  <span>
                    {t("taxonomy.start_flow", { defaultValue: "Start flow" })}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>
    );
  }

  // Find Precedents Flow
  if (selectedFlow === "find-precedents") {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading text-lg font-semibold text-foreground">
              {t("taxonomy.find_precedents", {
                defaultValue: "Find Precedents",
              })}
            </h2>
            <p className="mt-0.5 text-sm text-secondary-text">
              {t("taxonomy.step_n_of_m", {
                defaultValue: "Step {{current}} of {{total}}",
                current: step,
                total: 4,
              })}
            </p>
          </div>
          <button
            onClick={resetFlow}
            className="text-sm text-secondary-text hover:text-foreground"
          >
            {t("common.cancel", { defaultValue: "Cancel" })}
          </button>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                s <= step ? "bg-accent" : "bg-border",
              )}
            />
          ))}
        </div>

        {/* Step 1: Select Visa */}
        {step === 1 && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-foreground">
                {t("taxonomy.select_visa_subclass", {
                  defaultValue: "Select visa subclass",
                })}
                <span className="ml-1 text-red-500">*</span>
              </label>
              <p className="mt-0.5 text-xs text-secondary-text">
                {t("taxonomy.visa_search_hint", {
                  defaultValue: "Search by code or name",
                })}
              </p>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-text" />
              <input
                type="text"
                value={visaQuery}
                onChange={(e) => handleVisaQueryChange(e.target.value)}
                placeholder={t("taxonomy.visa_search_placeholder", {
                  defaultValue: "e.g. 866 or Protection",
                })}
                className={cn(
                  "w-full rounded-md border border-border bg-card py-2 pl-9 pr-3 text-sm",
                  "text-foreground placeholder:text-muted-text",
                  "focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent",
                )}
              />
            </div>

            {debouncedVisaQuery && visaResults.length > 0 && (
              <div className="rounded-md border border-border bg-card divide-y divide-border max-h-64 overflow-y-auto">
                {visaResults.map((visa) => (
                  <button
                    key={visa.subclass}
                    onClick={() => handleSelectVisa(visa)}
                    className={cn(
                      "w-full px-4 py-3 text-left transition-colors",
                      "hover:bg-surface focus:bg-surface focus:outline-none",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="font-mono text-sm font-semibold text-accent">
                            {visa.subclass}
                          </span>
                          <span className="text-sm font-medium text-foreground">
                            {visa.name}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-secondary-text">
                          {visa.family}
                        </div>
                      </div>
                      <span className="rounded-full bg-accent-muted px-2 py-0.5 text-xs font-medium text-accent">
                        {visa.case_count.toLocaleString()}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {debouncedVisaQuery && visaResults.length === 0 && (
              <div className="rounded-md border border-border bg-card p-4 text-center text-sm text-muted-text">
                {t("taxonomy.no_results", {
                  defaultValue: "No matching visa subclasses found",
                })}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Select Country (optional) */}
        {step === 2 && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-foreground">
                {t("taxonomy.select_country", {
                  defaultValue: "Select country of origin",
                })}
                <span className="ml-1 text-xs text-muted-text">
                  {t("common.optional", { defaultValue: "(optional)" })}
                </span>
              </label>
              <p className="mt-0.5 text-xs text-secondary-text">
                {t("taxonomy.country_hint", {
                  defaultValue: "Filter by applicant's country",
                })}
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {countries.slice(0, 12).map((country: CountryEntry) => (
                <button
                  key={country.country}
                  onClick={() => handleSelectCountry(country.country)}
                  className={cn(
                    "flex items-center justify-between rounded-md border px-3 py-2.5 text-left transition-all",
                    flowState.country === country.country
                      ? "border-accent bg-accent-muted"
                      : "border-border bg-card hover:border-accent hover:bg-surface",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Globe className="h-3.5 w-3.5 text-muted-text" />
                    <span className="text-sm font-medium text-foreground">
                      {country.country}
                    </span>
                  </div>
                  <span className="text-xs text-secondary-text">
                    {country.case_count.toLocaleString()}
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={handleNext}
              className="w-full rounded-md border border-dashed border-border bg-surface px-3 py-2 text-sm text-secondary-text hover:bg-card hover:text-foreground"
            >
              {t("taxonomy.skip_country", {
                defaultValue: "Skip (search all countries)",
              })}
            </button>
          </div>
        )}

        {/* Step 3: Select Legal Concepts (optional) */}
        {step === 3 && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-foreground">
                {t("taxonomy.select_legal_concepts", {
                  defaultValue: "Select legal concepts",
                })}
                <span className="ml-1 text-xs text-muted-text">
                  {t("common.optional", { defaultValue: "(optional)" })}
                </span>
              </label>
              <p className="mt-0.5 text-xs text-secondary-text">
                {t("taxonomy.concepts_hint", {
                  defaultValue: "Choose relevant concepts (multi-select)",
                })}
              </p>
            </div>

            <div className="rounded-md border border-border bg-card p-3 max-h-64 overflow-y-auto">
              <div className="flex flex-wrap gap-2">
                {concepts.map((concept: LegalConceptEntry) => (
                  <button
                    key={concept.id}
                    onClick={() => toggleConcept(concept.name)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all",
                      flowState.legal_concepts.includes(concept.name)
                        ? "border border-accent bg-accent text-white"
                        : "border border-border bg-surface hover:border-accent hover:bg-accent-muted",
                    )}
                  >
                    {flowState.legal_concepts.includes(concept.name) && (
                      <CheckCircle className="h-3.5 w-3.5" />
                    )}
                    <Tag className="h-3.5 w-3.5" />
                    <span>{concept.name}</span>
                    <span className="text-xs opacity-75">
                      {concept.case_count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {flowState.legal_concepts.length > 0 && (
              <div className="rounded-md bg-accent-muted px-3 py-2 text-sm text-accent">
                {t("taxonomy.concepts_selected", {
                  defaultValue: "{{count}} concepts selected",
                  count: flowState.legal_concepts.length,
                })}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleBack}
                className="flex items-center gap-1 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-surface"
              >
                <ArrowLeft className="h-4 w-4" />
                {t("common.back", { defaultValue: "Back" })}
              </button>
              <button
                onClick={handleNext}
                className="flex-1 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
              >
                {t("common.next", { defaultValue: "Next" })}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Review and Submit */}
        {step === 4 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {t("taxonomy.review_search", {
                  defaultValue: "Review your search",
                })}
              </h3>
              <p className="mt-0.5 text-xs text-secondary-text">
                {t("taxonomy.review_hint", {
                  defaultValue: "Confirm criteria before searching",
                })}
              </p>
            </div>

            <div className="space-y-2 rounded-md border border-border bg-card p-4">
              <div className="flex items-start gap-2">
                <FileText className="mt-0.5 h-4 w-4 text-accent" />
                <div className="flex-1">
                  <div className="text-xs font-medium text-secondary-text">
                    {t("taxonomy.visa_subclass", {
                      defaultValue: "Visa Subclass",
                    })}
                  </div>
                  <div className="text-sm font-semibold text-foreground">
                    {flowState.visa_subclass}
                  </div>
                </div>
              </div>

              {flowState.country && (
                <div className="flex items-start gap-2">
                  <Globe className="mt-0.5 h-4 w-4 text-accent" />
                  <div className="flex-1">
                    <div className="text-xs font-medium text-secondary-text">
                      {t("taxonomy.country", { defaultValue: "Country" })}
                    </div>
                    <div className="text-sm font-semibold text-foreground">
                      {flowState.country}
                    </div>
                  </div>
                </div>
              )}

              {flowState.legal_concepts.length > 0 && (
                <div className="flex items-start gap-2">
                  <Tag className="mt-0.5 h-4 w-4 text-accent" />
                  <div className="flex-1">
                    <div className="text-xs font-medium text-secondary-text">
                      {t("taxonomy.legal_concepts", {
                        defaultValue: "Legal Concepts",
                      })}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {flowState.legal_concepts.map((c) => (
                        <span
                          key={c}
                          className="rounded-full bg-accent-muted px-2 py-0.5 text-xs font-medium text-accent"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleBack}
                className="flex items-center gap-1 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-surface"
              >
                <ArrowLeft className="h-4 w-4" />
                {t("common.back", { defaultValue: "Back" })}
              </button>
              <button
                onClick={handleSubmitPrecedents}
                disabled={guidedSearchMutation.isPending}
                className="flex-1 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {guidedSearchMutation.isPending
                  ? t("common.searching", { defaultValue: "Searching..." })
                  : t("taxonomy.search_cases", {
                      defaultValue: "Search Cases",
                    })}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Assess Judge Flow
  if (selectedFlow === "assess-judge") {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading text-lg font-semibold text-foreground">
              {t("taxonomy.assess_judge", { defaultValue: "Assess Judge" })}
            </h2>
            <p className="mt-0.5 text-sm text-secondary-text">
              {t("taxonomy.step_n_of_m", {
                defaultValue: "Step {{current}} of {{total}}",
                current: step,
                total: 2,
              })}
            </p>
          </div>
          <button
            onClick={resetFlow}
            className="text-sm text-secondary-text hover:text-foreground"
          >
            {t("common.cancel", { defaultValue: "Cancel" })}
          </button>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1">
          {[1, 2].map((s) => (
            <div
              key={s}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                s <= step ? "bg-accent" : "bg-border",
              )}
            />
          ))}
        </div>

        {/* Step 1: Search Judge */}
        {step === 1 && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-foreground">
                {t("taxonomy.search_judge", {
                  defaultValue: "Search for a judge",
                })}
                <span className="ml-1 text-red-500">*</span>
              </label>
              <p className="mt-0.5 text-xs text-secondary-text">
                {t("taxonomy.judge_search_hint", {
                  defaultValue: "Type at least 2 characters",
                })}
              </p>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-text" />
              <input
                type="text"
                value={judgeQuery}
                onChange={(e) => handleJudgeQueryChange(e.target.value)}
                placeholder={t("taxonomy.judge_search_placeholder", {
                  defaultValue: "e.g. Smith, Brown",
                })}
                className={cn(
                  "w-full rounded-md border border-border bg-card py-2 pl-9 pr-3 text-sm",
                  "text-foreground placeholder:text-muted-text",
                  "focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent",
                )}
              />
            </div>

            {debouncedJudgeQuery.length >= 2 && judgeResults.length > 0 && (
              <div className="rounded-md border border-border bg-card divide-y divide-border max-h-64 overflow-y-auto">
                {judgeResults.map((judge) => (
                  <button
                    key={judge.name}
                    onClick={() => handleSelectJudge(judge)}
                    className={cn(
                      "w-full px-4 py-3 text-left transition-colors",
                      "hover:bg-surface focus:bg-surface focus:outline-none",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-text" />
                        <span className="text-sm font-medium text-foreground">
                          {judge.name}
                        </span>
                      </div>
                      <span className="rounded-full bg-accent-muted px-2 py-0.5 text-xs font-medium text-accent">
                        {judge.case_count.toLocaleString()}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {debouncedJudgeQuery.length >= 2 && judgeResults.length === 0 && (
              <div className="rounded-md border border-border bg-card p-4 text-center text-sm text-muted-text">
                {t("taxonomy.no_judge_results", {
                  defaultValue: "No matching judges found",
                })}
              </div>
            )}

            {debouncedJudgeQuery.length > 0 &&
              debouncedJudgeQuery.length < 2 && (
                <div className="rounded-md border border-border bg-card p-4 text-center text-sm text-muted-text">
                  {t("taxonomy.judge_min_chars", {
                    defaultValue: "Type at least 2 characters to search",
                  })}
                </div>
              )}
          </div>
        )}

        {/* Step 2: Confirm and View Profile */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {t("taxonomy.view_judge_profile", {
                  defaultValue: "View judge profile",
                })}
              </h3>
              <p className="mt-0.5 text-xs text-secondary-text">
                {t("taxonomy.judge_profile_hint", {
                  defaultValue: "View detailed analysis and case history",
                })}
              </p>
            </div>

            <div className="rounded-md border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-accent-muted p-3 text-accent">
                  <User className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-secondary-text">
                    {t("taxonomy.selected_judge", {
                      defaultValue: "Selected Judge",
                    })}
                  </div>
                  <div className="text-base font-semibold text-foreground">
                    {flowState.judge_name}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleBack}
                className="flex items-center gap-1 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-surface"
              >
                <ArrowLeft className="h-4 w-4" />
                {t("common.back", { defaultValue: "Back" })}
              </button>
              <button
                onClick={handleSubmitJudge}
                disabled={guidedSearchMutation.isPending}
                className="flex-1 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {guidedSearchMutation.isPending
                  ? t("common.loading", { defaultValue: "Loading..." })
                  : t("taxonomy.view_profile", {
                      defaultValue: "View Profile",
                    })}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
