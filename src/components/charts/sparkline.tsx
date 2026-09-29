import { isFiniteNumber } from "@/lib/format/number";

/**
 * Minigráfico de tendência (SVG puro, renderizado no servidor). Linha no tom de
 * baixa ênfase; o período atual (último ponto) recebe a cor de destaque.
 * Decorativo: o valor e a variação já estão em texto no card.
 */
export function Sparkline({ values, width = 92, height = 34, className }: { values: Array<number | null>; width?: number; height?: number; className?: string }) {
  const pts = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => isFiniteNumber(p.v));
  if (pts.length < 2) return null;
  const min = Math.min(...pts.map((p) => p.v));
  const max = Math.max(...pts.map((p) => p.v));
  const pad = 4;
  const span = max - min || 1;
  const x = (i: number) => pad + (i / Math.max(1, values.length - 1)) * (width - pad * 2);
  const y = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2);
  const d = pts.map((p, k) => `${k === 0 ? "M" : "L"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  const area = `${d} L${x(last.i).toFixed(1)},${height} L${x(pts[0].i).toFixed(1)},${height} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden focusable="false">
      <path d={area} fill="var(--chart-1)" opacity={0.08} />
      <path d={d} fill="none" stroke="#5f7596" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(last.i)} cy={y(last.v)} r={4.5} fill="var(--chart-1)" stroke="var(--surface)" strokeWidth={2} />
    </svg>
  );
}
