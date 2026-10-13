"use client";

import { Area, Bar, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatAxisValue, isFiniteNumber, type ValueFormat } from "@/lib/format/number";
import { sumMaybe } from "@/lib/metrics/safe-math";
import { ChartTooltipCard, type TooltipRow } from "./chart-tooltip";
import type { SeriesPoint } from "./types";

export interface XYSeries {
  key: string;
  label: string;
  format: ValueFormat;
  color: string;
  digits?: number;
}

export type XYKind = "bar" | "stacked" | "line" | "area";

/** Eixo enxuto: reais em "13,5 mil" (a unidade já está no título do gráfico). */
function axis(value: number, format: ValueFormat, currency: string): string {
  if (format === "currency" && Math.abs(value) >= 1000) return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value / 1000)} mil`;
  if (format === "currency") return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value);
  return formatAxisValue(value, format, currency);
}

/**
 * Evolução período a período no estilo do painel comercial: colunas (agrupadas ou
 * empilhadas), linha ou área. Uma coluna pode ficar em destaque (o mês em foco).
 */
export default function XYChart({ points, series, kind, highlight, currency, height = 255 }: { points: SeriesPoint[]; series: XYSeries[]; kind: XYKind; highlight?: string; currency: string; height?: number }) {
  const format = series[0]?.format ?? "integer";
  const data = points.map((p) => ({
    key: p.key,
    label: p.label,
    fullLabel: p.fullLabel,
    total: kind === "stacked" ? sumMaybe(series.map((s) => p.values[s.key])) : null,
    ...Object.fromEntries(series.map((s) => [s.key, p.values[s.key] ?? null])),
  }));
  const hasNegative = data.some((d) => series.some((s) => isFiniteNumber(d[s.key as keyof typeof d]) && (d[s.key as keyof typeof d] as number) < 0));
  const lastKey = series.at(-1)?.key;

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: 0 }} barGap={3} barCategoryGap={kind === "stacked" ? "26%" : "22%"}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--chart-grid)" }} tick={{ fill: "var(--chart-axis)", fontSize: 11 }} interval="preserveStartEnd" minTickGap={4} dy={6} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--chart-axis)", fontSize: 11 }} tickFormatter={(v: number) => axis(v, format, currency)} width={format === "currency" ? 54 : 46} allowDecimals={format !== "integer"} />
          {hasNegative ? <ReferenceLine y={0} stroke="var(--border-strong)" /> : null}
          <Tooltip
            cursor={kind === "line" || kind === "area" ? { stroke: "var(--border-strong)", strokeWidth: 1 } : { fill: "rgb(148 176 214 / 0.06)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0].payload as Record<string, number | null | string>;
              const rows: TooltipRow[] = series.map((s) => ({ label: s.label, value: (row[s.key] as number | null) ?? null, format: s.format, color: s.color, digits: s.digits }));
              if (kind === "stacked" && series.length > 1) rows.push({ label: "Total", value: (row.total as number | null) ?? null, format, color: "transparent" });
              return <ChartTooltipCard title={String(row.fullLabel)} currency={currency} rows={rows} />;
            }}
          />
          {kind === "bar" || kind === "stacked"
            ? series.map((s) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  fill={s.color}
                  stackId={kind === "stacked" ? "total" : undefined}
                  maxBarSize={kind === "stacked" ? 44 : series.length > 1 ? 22 : 40}
                  radius={kind === "bar" || s.key === lastKey ? [5, 5, 0, 0] : 0}
                  stroke={kind === "stacked" ? "var(--surface)" : undefined}
                  strokeWidth={kind === "stacked" ? 1 : 0}
                  isAnimationActive={false}
                >
                  {highlight && series.length === 1 ? data.map((d) => <Cell key={d.key} fill={s.color} fillOpacity={d.key === highlight ? 1 : 0.5} />) : null}
                </Bar>
              ))
            : kind === "area"
              ? series.map((s) => (
                  <Area
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.label}
                    stroke={s.color}
                    strokeWidth={2.5}
                    fill={s.color}
                    fillOpacity={0.12}
                    connectNulls
                    isAnimationActive={false}
                    dot={{ r: 4, fill: s.color, stroke: "var(--surface)", strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: s.color, stroke: "var(--surface)", strokeWidth: 2 }}
                  />
                ))
              : series.map((s) => (
                  <Line
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.label}
                    stroke={s.color}
                    strokeWidth={2.5}
                    connectNulls
                    isAnimationActive={false}
                    dot={{ r: 4, fill: s.color, stroke: "var(--surface)", strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: s.color, stroke: "var(--surface)", strokeWidth: 2 }}
                  />
                ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
