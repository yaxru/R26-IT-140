"use client";

// ── Types ───────────────────────────────────────────────────────────────

export interface SankeyNode {
  id: string;
  label: string;
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
}

interface SankeyFlowProps {
  columns: SankeyNode[][];
  links: SankeyLink[];
  height?: number;
  nodeColor?: (node: SankeyNode, columnIndex: number) => string;
  linkColor?: (link: SankeyLink) => string;
}

// ── Layout constants ────────────────────────────────────────────────────

const W = 640;
const PAD = { top: 10, right: 12, bottom: 10, left: 12 };
const NODE_W = 8;
const GAP = 8;

const DEFAULT_NODE_COLORS = ["#a1a1aa", "#10b981", "#52525b"];

// ── Layout engine ───────────────────────────────────────────────────────

interface NodeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function buildLayout(
  columns: SankeyNode[][],
  links: SankeyLink[],
  height: number,
) {
  const availableH = height - PAD.top - PAD.bottom;
  const numCols = columns.length;
  const colX = columns.map((_, i) =>
    numCols > 1
      ? PAD.left + (i / (numCols - 1)) * (W - PAD.left - PAD.right - NODE_W)
      : PAD.left,
  );

  // Node "value" = sum of touching links (outgoing for all but the last
  // column, incoming for the last column).
  const nodeValue: Record<string, number> = {};
  columns.forEach((col, ci) => {
    col.forEach((n) => {
      const value =
        ci === numCols - 1
          ? links
              .filter((l) => l.target === n.id)
              .reduce((s, l) => s + l.value, 0)
          : links
              .filter((l) => l.source === n.id)
              .reduce((s, l) => s + l.value, 0);
      nodeValue[n.id] = value;
    });
  });

  // One global scale (px per unit of flow) so ribbon thickness matches at
  // both ends — derived from the tightest column so nothing overflows.
  let scale = Infinity;
  columns.forEach((col) => {
    const total = col.reduce((s, n) => s + (nodeValue[n.id] || 0), 0) || 1;
    const totalGaps = GAP * Math.max(0, col.length - 1);
    const usable = Math.max(availableH - totalGaps, 20);
    const colScale = usable / total;
    if (colScale < scale) scale = colScale;
  });
  if (!Number.isFinite(scale) || scale <= 0) scale = 1;

  const nodeRect: Record<string, NodeRect> = {};
  columns.forEach((col, ci) => {
    const total = col.reduce((s, n) => s + (nodeValue[n.id] || 0), 0) || 1;
    const totalGaps = GAP * Math.max(0, col.length - 1);
    const contentH = total * scale;
    let y = PAD.top + Math.max(0, (availableH - (contentH + totalGaps)) / 2);
    col.forEach((n) => {
      const h = Math.max((nodeValue[n.id] || 0) * scale, 2);
      nodeRect[n.id] = { x: colX[ci], y, w: NODE_W, h };
      y += h + GAP;
    });
  });

  // Stack ribbons on each node's edge in link order.
  const sourceCursor: Record<string, number> = {};
  const targetCursor: Record<string, number> = {};
  const ribbons = links
    .map((l) => {
      const s = nodeRect[l.source];
      const t = nodeRect[l.target];
      if (!s || !t) return null;
      const thickness = Math.max(l.value * scale, 1);
      const sy = sourceCursor[l.source] || 0;
      const ty = targetCursor[l.target] || 0;
      sourceCursor[l.source] = sy + thickness;
      targetCursor[l.target] = ty + thickness;

      const x0 = s.x + s.w;
      const y0Top = s.y + sy;
      const x1 = t.x;
      const y1Top = t.y + ty;
      const mx = (x0 + x1) / 2;

      const path = `M${x0},${y0Top} C${mx},${y0Top} ${mx},${y1Top} ${x1},${y1Top} L${x1},${y1Top + thickness} C${mx},${y1Top + thickness} ${mx},${y0Top + thickness} ${x0},${y0Top + thickness} Z`;

      return { path, link: l };
    })
    .filter((r): r is { path: string; link: SankeyLink } => r !== null);

  return { nodeRect, ribbons };
}

// ── Component ───────────────────────────────────────────────────────────

export function SankeyFlow({
  columns,
  links,
  height = 280,
  nodeColor,
  linkColor,
}: SankeyFlowProps) {
  const { nodeRect, ribbons } = buildLayout(columns, links, height);
  const maxLinkValue = Math.max(1, ...links.map((l) => l.value));

  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="w-full" style={{ height }}>
      {/* Ribbons */}
      {ribbons.map(({ path, link }, i) => {
        const opacity = 0.12 + 0.55 * (link.value / maxLinkValue);
        const fill = linkColor ? linkColor(link) : "#10b981";
        return (
          <path
            key={`${link.source}-${link.target}-${i}`}
            d={path}
            fill={fill}
            opacity={opacity}
          />
        );
      })}

      {/* Nodes + labels — sharp (unrounded) rectangles */}
      {columns.map((col, ci) =>
        col.map((n) => {
          const r = nodeRect[n.id];
          if (!r) return null;
          const fill = nodeColor
            ? nodeColor(n, ci)
            : DEFAULT_NODE_COLORS[ci % DEFAULT_NODE_COLORS.length];
          const isFirst = ci === 0;
          return (
            <g key={n.id}>
              <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={fill} />
              <text
                x={isFirst ? r.x - 6 : r.x + r.w + 6}
                y={r.y + r.h / 2 + 3}
                textAnchor={isFirst ? "end" : "start"}
                fontSize={9}
                className="fill-zinc-500 dark:fill-zinc-400 font-mono"
              >
                {n.label}
              </text>
            </g>
          );
        }),
      )}
    </svg>
  );
}
