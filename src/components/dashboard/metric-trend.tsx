"use client";

import { useId, useState } from "react";
import { formatValue } from "@/lib/format/number";
import { sumMaybe } from "@/lib/metrics/safe-math";
import { cn } from "@/lib/cn";
import { LazyColumnsChart, LazyTrendChart } from "@/components/charts/lazy";
import { seriesColor, type SeriesDef, type SeriesPoint } from "@/components/charts/types";

/**
 * Evolução temporal com seletor de métrica (uma série por vez → um eixo só)
 * e visão em tabela como alternativa acessível ao gráfico.
 */
export function MetricTrend({ points, series, currency, initial }: { points: SeriesPoint[]; series: SeriesDef[]; currency: string; initial?: string }) {
  const [active, setActive] = useState(initial && series.some((s) => s.key === initial) ? initial : series[0]?.key);
  const [showTable, setShowTable] = useState(false);
  const groupId = useId();
  const current = series.find((s) => s.key === active) ?? series[0];
  if (!current) return null;

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="radiogroup" aria-label="Métrica do gráfico" className="scrollbar-none scroll-fade-x -mx-1 flex min-w-0 max-w-full flex-1 gap-1 overflow-x-auto px-1">
          {series.map((s) => (
            <button
              key={s.key}
              type="button"
              role="radio"
              aria-checked={s.key === current.key}
              onClick={() => setActive(s.key)}
              className={cn(
                "h-8 shrink-0 rounded-full px-3 text-[13px] font-semibold transition-colors",
                s.key === current.key ? "bg-primary-soft text-primary" : "text-text-3 hover:bg-surface-2 hover:text-text-2",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setShowTable((v) => !v)} aria-controls={`${groupId}-table`} aria-expanded={showTable} className="h-8 rounded-full px-3 text-[13px] font-semibold text-text-3 hover:bg-surface-2 hover:text-text-2">
          {showTable ? "Ver gráfico" : "Ver tabela"}
        </button>
      </div>

      <div className="mt-3">
        {showTable ? (
          <SeriesTable id={`${groupId}-table`} points={points} series={[current]} currency={currency} />
        ) : (
          <figure aria-label={`${current.label} por período`}>
            <LazyTrendChart points={points} series={current} currency={currency} />
            {current.description ? <figcaption className="mt-2 text-xs text-text-3">{current.description}</figcaption> : null}
          </figure>
        )}
      </div>
    </div>
  );
}

export function ComparisonColumns({ points, series, currency, caption, stacked = false }: { points: SeriesPoint[]; series: SeriesDef[]; currency: string; caption?: string; stacked?: boolean }) {
  const [showTable, setShowTable] = useState(false);
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Legenda">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5 text-[13px] text-text-2">
              <span className="size-2.5 rounded-[3px]" style={{ background: seriesColor(s) }} aria-hidden />
              {s.label}
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => setShowTable((v) => !v)} aria-expanded={showTable} className="h-8 rounded-full px-3 text-[13px] font-semibold text-text-3 hover:bg-surface-2 hover:text-text-2">
          {showTable ? "Ver gráfico" : "Ver tabela"}
        </button>
      </div>
      <div className="mt-3">
        {showTable ? (
          <SeriesTable points={points} series={series} currency={currency} withTotal={stacked && series.length > 1} />
        ) : (
          <figure aria-label={caption ?? series.map((s) => s.label).join(" e ")}>
            <LazyColumnsChart points={points} series={series} currency={currency} stacked={stacked} />
          </figure>
        )}
      </div>
    </div>
  );
}

function SeriesTable({ id, points, series, currency, withTotal = false }: { id?: string; points: SeriesPoint[]; series: SeriesDef[]; currency: string; withTotal?: boolean }) {
  return (
    <div id={id} className="max-h-[260px] overflow-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-surface-2 text-left text-xs text-text-3">
          <tr>
            <th scope="col" className="px-3 py-2 font-semibold">
              Período
            </th>
            {series.map((s) => (
              <th key={s.key} scope="col" className="px-3 py-2 text-right font-semibold">
                {s.label}
              </th>
            ))}
            {withTotal ? (
              <th scope="col" className="px-3 py-2 text-right font-semibold">
                Total
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {[...points].reverse().map((p) => (
            <tr key={p.key} className="border-t border-border">
              <th scope="row" className="px-3 py-2 text-left font-medium text-text-2">
                {p.fullLabel}
              </th>
              {series.map((s) => (
                <td key={s.key} className="tabular px-3 py-2 text-right font-semibold text-text">
                  {formatValue(p.values[s.key] ?? null, s.format, currency)}
                </td>
              ))}
              {withTotal ? <td className="tabular px-3 py-2 text-right font-bold text-text">{formatValue(sumMaybe(series.map((s) => p.values[s.key])), series[0].format, currency)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
