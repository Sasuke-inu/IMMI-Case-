import { useMemo } from "react";

interface RiskGaugeProps {
  /** 0-100 risk/success score */
  score: number;
  /** Text label displayed below the score */
  label: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function scoreColorClass(score: number): string {
  if (score < 40) return "text-red-500";
  if (score < 65) return "text-yellow-500";
  return "text-green-500";
}

function arcStrokeColor(score: number): string {
  if (score < 40) return "#ef4444";
  if (score < 65) return "#eab308";
  return "#22c55e";
}

export function RiskGauge({ score, label }: RiskGaugeProps) {
  const clamped = clamp(Math.round(score), 0, 100);
  const colorClass = useMemo(() => scoreColorClass(clamped), [clamped]);
  const strokeColor = useMemo(() => arcStrokeColor(clamped), [clamped]);

  // Semi-circle arc from 180° to 0° (left to right)
  const radius = 70;
  const cx = 90;
  const cy = 85;
  const circumference = Math.PI * radius; // half-circle
  const progress = (clamped / 100) * circumference;

  return (
    <div data-testid="risk-gauge" className="flex flex-col items-center">
      <svg width={180} height={100} viewBox="0 0 180 100">
        {/* Background track */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="var(--color-border, #e5e7eb)"
          strokeWidth={12}
          strokeLinecap="round"
        />
        {/* Filled arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke={strokeColor}
          strokeWidth={12}
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`}
        />
        {/* Score text in center */}
        <text
          x={cx}
          y={cy - 10}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={28}
          fontWeight="bold"
          fill="currentColor"
        >
          {clamped}
        </text>
      </svg>
      <span
        data-testid="risk-gauge-label"
        className={`-mt-2 text-sm font-medium ${colorClass}`}
      >
        {label}
      </span>
    </div>
  );
}
