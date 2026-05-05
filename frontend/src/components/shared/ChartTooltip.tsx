import type { ComponentProps } from "react";
import { Tooltip } from "recharts";

type RechartsTooltipProps = ComponentProps<typeof Tooltip>;

/**
 * Default `contentStyle` for Recharts tooltips. Provides token-driven
 * surface, border, and — critically — `color: var(--color-text)` so
 * tooltip text remains legible in dark mode.
 *
 * Caller-supplied `contentStyle` overrides win via spread.
 */
const defaultContentStyle: React.CSSProperties = {
  backgroundColor: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  color: "var(--color-text)",
  fontSize: 12,
  padding: "8px 12px",
};

/**
 * ChartTooltip — Recharts <Tooltip /> wrapper that injects a
 * dark-mode-safe default `contentStyle`. Drop-in replacement: passes
 * through every other prop (formatter, labelFormatter, cursor,
 * wrapperStyle, content, etc.) verbatim.
 *
 * Fixes audit T1: dark text on dark tooltip background, ~16 charts.
 */
export function ChartTooltip(props: RechartsTooltipProps) {
  const { contentStyle, ...rest } = props;
  return (
    <Tooltip
      {...rest}
      contentStyle={{ ...defaultContentStyle, ...contentStyle }}
    />
  );
}
