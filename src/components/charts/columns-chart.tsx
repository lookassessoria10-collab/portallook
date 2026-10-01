"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatAxisValue, formatCurrency, formatInteger, formatValue, isFiniteNumber, type ValueFormat } from "@/lib/format/number";
import { sumMaybe } from "@/lib/metrics/safe-math";
import { ChartTooltipCard } from "./chart-tooltip";
import { seriesColor, type SeriesDef, type SeriesPoint } from "./types";

/** Largura mínima por coluna para escrever o total acima dela (abaixo disso, volta o eixo Y). */
const TOTAL_FULL_MIN = 64;
const TOTAL_SHORT_MIN = 38;

function formatTotal(value: number | null, format: ValueFormat, currency: string, short: boolean): string {
  if (!isFiniteNumber(value)) return "";
  if (!short) return format === "currency" ? formatCurrency(value, currency, { noCents: true }) : formatValue(value, format, currency);
  if (Math.abs(value) < 1000) return format === "currency" ? formatInteger(value) : formatValue(value, format, currency);
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: Math.abs(value) < 10_000 ? 1 : 0 }).format(value / 1000)} mil`;
}

/**
 * Colunas para séries na MESMA unidade.
 * - agrupadas (padrão): receita x investimento; barras ≤ 22px, topo arredondado.
 * - empilhadas (`stacked`): composição do total (ex.: investimento por plataforma),
 *   com o total do período escrito acima de cada coluna quando há espaço.
 */
export default function ColumnsChart({ points, series, currency, height = 230, stacked = false }: { points: SeriesPoint[]; series: SeriesDef[]; currency: string; height?: number; stacked?: boolean }) {
  const [width, setWidth] = useState(0);
  const format = series[0]?.format ?? "integer";
  const data = points.map((p) => ({
    label: p.label,
    fullLabel: p.fullLabel,
    total: stacked ? sumMaybe(series.map((s) => p.values[s.key])) : null,
    ...Object.fromEntries(series.map((s) => [s.key, p.values[s.key] ?? null])),
  }));
  const perColumn = width && data.length ? width / data.length : 0;
  const showTotals = stacked && perColumn >= TOTAL_SHORT_MIN;
  const shortTotals = perColumn < TOTAL_FULL_MIN;
  const lastKey = series.at(-1)?.key;

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%" onResize={(w) => setWidth(w)}>
        <BarChart data={data} margin={{ top: showTotals ? 4 : 12, right: 8, bottom: 0, left: 0 }} barGap={2} barCategoryGap={stacked ? "22%" : "28%"}>
          {showTotals ? null : <CartesianGrid vertical={false} stroke="var(--chart-grid)" />}
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--chart-grid)" }} tick={{ fill: "var(--chart-axis)", fontSize: 12 }} interval="preserveStartEnd" minTickGap={6} dy={6} />
          {showTotals ? (
            <XAxis
              xAxisId="totals"
              orientation="top"
              dataKey="label"
              axisLine={false}
              tickLine={false}
              interval={0}
              height={24}
              tick={{ fill: "var(--text-2)", fontSize: 11, fontWeight: 600 }}
              tickFormatter={(_: string, i: number) => formatTotal(data[i]?.total ?? null, format, currency, shortTotals)}
            />
          ) : null}
          <YAxis
            hide={showTotals}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--chart-axis)", fontSize: 12 }}
            tickFormatter={(v: number) => formatAxisValue(v, format, currency)}
            width={format === "currency" ? 64 : 44}
          />
          <Tooltip
            cursor={{ fill: "rgb(148 176 214 / 0.06)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0].payload as Record<string, number | null | string>;
              const rows = series.map((s) => ({ label: s.label, value: (row[s.key] as number | null) ?? null, format: s.format, color: seriesColor(s) }));
              if (stacked && series.length > 1) rows.push({ label: "Total", value: (row.total as number | null) ?? null, format, color: "transparent" });
              return <ChartTooltipCard title={String(row.fullLabel)} currency={currency} rows={rows} />;
            }}
          />
          {series.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              fill={seriesColor(s)}
              stackId={stacked ? "total" : undefined}
              maxBarSize={stacked ? 48 : 22}
              radius={!stacked || s.key === lastKey ? [4, 4, 0, 0] : 0}
              stroke={stacked ? "var(--surface)" : undefined}
              strokeWidth={stacked ? 1 : 0}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
