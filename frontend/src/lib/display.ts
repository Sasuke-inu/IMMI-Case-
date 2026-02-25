type Translator = (
  key: string,
  options?: Record<string, unknown>,
) => string;

const COURT_TYPE_LABEL_KEYS: Record<string, string> = {
  court: "judges.court_type_value_court",
  tribunal: "judges.court_type_value_tribunal",
  mixed: "judges.court_type_value_mixed",
  unknown: "judges.court_type_value_unknown",
};

export function humanizeIdentifier(raw: string | null | undefined): string {
  const normalized = (raw ?? "").replace(/[_-]+/g, " ").trim();
  if (!normalized) return "";

  return normalized
    .split(/\s+/)
    .map((token) => {
      if (!token) return token;
      if (token.length <= 3 && token.toUpperCase() === token) return token;
      return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
    })
    .join(" ");
}

export function formatCourtTypeLabel(
  courtType: string | null | undefined,
  t: Translator,
): string {
  const normalized = (courtType ?? "").trim().toLowerCase();
  if (!normalized) {
    return t("judges.court_type_value_unknown", {
      defaultValue: "Unknown",
    });
  }

  const translationKey = COURT_TYPE_LABEL_KEYS[normalized];
  if (translationKey) {
    return t(translationKey, { defaultValue: humanizeIdentifier(normalized) });
  }

  return humanizeIdentifier(normalized);
}
