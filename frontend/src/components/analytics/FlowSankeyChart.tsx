import { useMemo } from "react";
import { Sankey, Tooltip, Rectangle, Layer } from "recharts";
import type { FlowMatrixData } from "@/types/case";

const LAYER_LABELS: Record<string, string> = {
  court: "Court",
  nature: "Case Nature",
  outcome: "Outcome",
};

const LAYER_COLORS: Record<string, string> = {
  court: "var(--color-primary)",
  nature: "var(--color-accent)",
  outcome: "var(--color-success, #22c55e)",
};

interface FlowSankeyChartProps {
  data: FlowMatrixData;
}

function SankeyNode({
  x,
  y,
  width,
  height,
  index,
  payload,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  index: number;
  payload: { name: string; layer?: string };
}) {
  const layer = payload.layer ?? "court";
  return (
    <Layer key={`node-${index}`}>
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        fill={LAYER_COLORS[layer] ?? "var(--color-muted)"}
        fillOpacity={0.85}
      />
      {height > 14 && (
        <text
          x={x + width + 6}
          y={y + height / 2}
          textAnchor="start"
          dominantBaseline="middle"
          fontSize={11}
          fill="var(--color-text, currentColor)"
        >
          {payload.name}
        </text>
      )}
    </Layer>
  );
}

export function FlowSankeyChart({ data }: FlowSankeyChartProps) {
  const isEmpty = !data.nodes.length || !data.links.length;

  const layers = useMemo(() => {
    const seen = new Set<string>();
    for (const node of data.nodes) {
      if (node.layer) seen.add(node.layer);
    }
    return Array.from(seen);
  }, [data.nodes]);

  if (isEmpty) {
    return (
      <div data-testid="flow-sankey-chart" className="py-12 text-center text-muted-text">
        No flow data available
      </div>
    );
  }

  return (
    <div data-testid="flow-sankey-chart" className="space-y-2">
      <div className="flex justify-between px-4 text-xs font-medium text-muted-text">
        {layers.map((layer) => (
          <span key={layer}>{LAYER_LABELS[layer] ?? layer}</span>
        ))}
      </div>
      <div className="overflow-x-auto">
        <Sankey
          width={700}
          height={400}
          data={{ nodes: data.nodes, links: data.links }}
          node={<SankeyNode x={0} y={0} width={0} height={0} index={0} payload={{ name: "" }} />}
          link={{ stroke: "var(--color-border, #d1d5db)" }}
          margin={{ top: 10, right: 120, bottom: 10, left: 10 }}
        >
          <Tooltip />
        </Sankey>
      </div>
    </div>
  );
}
