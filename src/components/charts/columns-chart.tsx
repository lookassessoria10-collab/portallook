"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatAxisValue } from "@/lib/format/number";
import { ChartTooltipCard } from "./chart-tooltip";
import { SLOT_COLOR, type SeriesDef, type SeriesPoint } from "./types";

/**
 * Colunas agrupadas para séries na MESMA unidade (ex.: receita x investimento).
 * Barras ≤ 22px, topo arredondado de 4px, 2px de respiro entre barras vizinhas.
 */
export default function ColumnsChart({ points, series, currency, height = 230 }: { points: SeriesPoint[]; series: SeriesDef[]; currency: string; height?: number }) {
  const format = series[0]?.format ?? "integer";
  const data = points.map((p) => ({ label: p.label, fullLabel: p.fullLabel, ...Object.fromEntries(series.map((s) => [s.key, p.values[s.key] ?? null])) }));

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: 0 }} barGap={2} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--chart-grid)" }} tick={{ fill: "var(--chart-axis)", fontSize: 12 }} interval="preserveStartEnd" minTickGap={6} dy={6} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--chart-axis)", fontSize: 12 }} tickFormatter={(v: number) => formatAxisValue(v, format, currency)} width={format === "currency" ? 64 : 44} />
          <Tooltip
            cursor={{ fill: "rgb(148 176 214 / 0.06)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0].payload as Record<string, number | null | string>;
              return (
                <ChartTooltipCard
                  title={String(row.fullLabel)}
                  currency={currency}
                  rows={series.map((s) => ({ label: s.label, value: (row[s.key] as number | null) ?? null, format: s.format, color: SLOT_COLOR[s.slot ?? 1] }))}
                />
              );
            }}
          />
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={SLOT_COLOR[s.slot ?? 1]} maxBarSize={22} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
