import type { SuccessRateCombo } from "@/types/case";

interface ConceptComboTableProps {
  combos: SuccessRateCombo[];
}

function liftTone(lift: number) {
  if (lift >= 1.2) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
  if (lift >= 1.0) return "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200";
  return "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200";
}

export function ConceptComboTable({ combos }: ConceptComboTableProps) {
  if (!combos.length) {
    return <p className="text-sm text-muted-text">No concept combinations available for current filters.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-text">
            <th className="py-2 pr-2">Concepts</th>
            <th className="py-2 pr-2">Cases</th>
            <th className="py-2 pr-2">Win Rate</th>
            <th className="py-2">Lift</th>
          </tr>
        </thead>
        <tbody>
          {combos.slice(0, 8).map((combo) => (
            <tr key={combo.concepts.join("|")} className="border-b border-border-light/60">
              <td className="py-2 pr-2 text-foreground">{combo.concepts.join(" + ")}</td>
              <td className="py-2 pr-2 text-secondary-text">{combo.count.toLocaleString()}</td>
              <td className="py-2 pr-2 text-secondary-text">{combo.win_rate.toFixed(1)}%</td>
              <td className="py-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${liftTone(combo.lift)}`}>
                  {combo.lift.toFixed(2)}x
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
