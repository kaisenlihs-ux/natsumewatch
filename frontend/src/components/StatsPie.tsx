"use client";

import type { StatsBucket } from "@/lib/types";

type Props = {
  data: StatsBucket[];
  size?: number;
  title?: string;
};

const COLORS = [
  "#f43f5e",
  "#8b5cf6",
  "#22c55e",
  "#f59e0b",
  "#06b6d4",
  "#a78bfa",
  "#ec4899",
  "#10b981",
  "#fb7185",
  "#7c3aed",
  "#facc15",
  "#0ea5e9",
];

/** Lightweight SVG-based pie chart — avoids pulling recharts as a dependency. */
export function StatsPie({ data, size = 220, title }: Props) {
  const total = data.reduce((acc, b) => acc + b.count, 0);
  if (total === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-white/40"
        style={{ width: size, height: size }}
      >
        Нет данных
      </div>
    );
  }
  const radius = size / 2;
  const cx = radius;
  const cy = radius;

  let cum = 0;
  const arcs = data.map((b, i) => {
    const start = (cum / total) * Math.PI * 2;
    cum += b.count;
    const end = (cum / total) * Math.PI * 2;
    const large = end - start > Math.PI ? 1 : 0;
    const x1 = cx + radius * Math.sin(start);
    const y1 = cy - radius * Math.cos(start);
    const x2 = cx + radius * Math.sin(end);
    const y2 = cy - radius * Math.cos(end);
    const d =
      data.length === 1
        ? `M ${cx - radius},${cy} A ${radius},${radius} 0 1 1 ${cx + radius},${cy} A ${radius},${radius} 0 1 1 ${cx - radius},${cy} Z`
        : `M ${cx},${cy} L ${x1},${y1} A ${radius},${radius} 0 ${large} 1 ${x2},${y2} Z`;
    return { d, color: COLORS[i % COLORS.length], bucket: b };
  });

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        {title && <title>{title}</title>}
        <circle cx={cx} cy={cy} r={radius - 2} fill="#0a0613" />
        {arcs.map((a, i) => (
          <path key={i} d={a.d} fill={a.color} stroke="#0a0613" strokeWidth={2} />
        ))}
        <circle cx={cx} cy={cy} r={radius * 0.45} fill="#0a0613" />
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          fontSize={20}
          fill="#fff"
          fontWeight={700}
        >
          {total}
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize={11} fill="rgba(255,255,255,0.5)">
          всего
        </text>
      </svg>
      <ul className="flex max-w-xs flex-col gap-1.5 text-sm">
        {arcs.map((a, i) => (
          <li key={i} className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ background: a.color }}
            />
            <span className="flex-1 truncate text-white/80">{a.bucket.label}</span>
            <span className="tabular-nums text-white/50">
              {a.bucket.count}
              {" "}
              <span className="text-white/30">
                · {Math.round((a.bucket.count / total) * 100)}%
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
