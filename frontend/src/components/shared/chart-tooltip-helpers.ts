/**
 * Shared helpers for Recharts tooltip formatters.
 * Kept in a separate file to satisfy react-refresh/only-export-components
 * (ChartTooltip.tsx must only export the component).
 */

import type { ValueType } from "recharts/types/component/DefaultTooltipContent";
import type React from "react";
import type { NameType } from "recharts/types/component/DefaultTooltipContent";

/**
 * Canonical type for ChartTooltip formatter callbacks.
 * Accepts the full Recharts ValueType so callers that narrow to number/string
 * are still assignable.
 */
export type TooltipFormatter = (
  value: ValueType | undefined,
  name: NameType | undefined,
) => [React.ReactNode, React.ReactNode] | React.ReactNode;

/**
 * Normalise a raw Recharts ValueType to a plain number.
 * Arrays are reduced to their first element; non-numeric strings become 0.
 */
export function toChartNumber(value: ValueType | undefined): number {
  if (value === undefined || value === null) return 0;
  if (Array.isArray(value)) return Number((value as (number | string)[])[0] ?? 0);
  return Number(value);
}
