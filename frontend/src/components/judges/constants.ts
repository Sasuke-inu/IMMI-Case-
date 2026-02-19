export const OUTCOME_COLORS = [
  "#1a5276",
  "#2d7d46",
  "#6c3483",
  "#b9770e",
  "#a83232",
  "#117864",
];

export function approvalBadgeClass(rate: number): string {
  if (rate >= 35) return "bg-semantic-success/15 text-semantic-success";
  if (rate >= 20) return "bg-semantic-warning/15 text-semantic-warning";
  return "bg-semantic-danger/15 text-semantic-danger";
}
