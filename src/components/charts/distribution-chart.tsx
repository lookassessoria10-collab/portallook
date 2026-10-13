"use client";

import { Bar, BarChart, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatAxisValue, formatCurrency, formatPercent, formatValue, type ValueFormat } from "@/lib/format/number";
import { ChartTooltipCard } from "./chart-tooltip";

export interface DistributionSlice {
  key: string;
  label: string;
  value: number;
  color: string;
}

const short = (value: number, format: ValueFormat, currency: string) => (format === "currency" ? formatCurrency(value, currency, { noCents: true }) : formatValue(value, format, currency));

/**
 * Participação de cada item no acumulado: rosca com legenda ao lado (até 6 fatias) ou
 * barras horizontais (muitos itens, ex.: terapeutas), com valor e participação.
 */
export default function DistributionChart({ slices, kind, format, currency, height = 255 }: { slices: DistributionSlice[]; kind: "donut" | "bars"; format: ValueFormat; currency: string; height?: number }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const tooltip = ({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload?: unknown }> }) => {
    if (!active || !payload?.length) return null;
    const s = payload[0].payload as DistributionSlice;
    return <ChartTooltipCard title={`${s.label} · ${formatPercent(total ? s.value / total : null)}`} currency={currency} rows={[{ label: s.label, value: s.value, format, color: s.color }]} />;
  };

  if (kind === "bars") {
    const rowHeight = 26;
    return (
      <div style={{ height: Math.max(height, slices.length * rowHeight + 16) }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={slices} layout="vertical" margin={{ top: 4, right: format === "currency" ? 84 : 48, bottom: 4, left: 0 }} barCategoryGap="22%">
            <XAxis type="number" hide tickFormatter={(v: number) => formatAxisValue(v, format, currency)} />
            <YAxis type="category" dataKey="label" width={104} tickLine={false} axisLine={false} interval={0} tick={{ fill: "var(--text-2)", fontSize: 12 }} />
            <Tooltip cursor={{ fill: "rgb(148 176 214 / 0.06)" }} content={tooltip} />
            <Bar dataKey="value" radius={[0, 5, 5, 0]} maxBarSize={18} isAnimationActive={false}>
              {slices.map((s) => (
                <Cell key={s.key} fill={s.color} />
              ))}
              <LabelList dataKey="value" position="right" offset={8} fill="var(--text-2)" fontSize={11} fontWeight={600} formatter={(v: unknown) => (typeof v === "number" ? short(v, format, currency) : "")} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6" style={{ minHeight: height }}>
      <div className="relative size-[190px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={tooltip} />
            <Pie data={slices} dataKey="value" nameKey="label" innerRadius="64%" outerRadius="98%" paddingAngle={1.5} stroke="var(--surface)" strokeWidth={2} isAnimationActive={false}>
              {slices.map((s) => (
                <Cell key={s.key} fill={s.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="tabular text-[15px] font-bold text-text">{format === "currency" ? formatAxisValue(total, format, currency) : formatValue(total, format, currency)}</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-3">Total</p>
          </div>
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-1.5">
        {slices.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-[13px]">
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: s.color }} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-text-2">{s.label}</span>
            <span className="tabular shrink-0 font-semibold text-text">{short(s.value, format, currency)}</span>
            <span className="tabular w-11 shrink-0 text-right text-xs text-text-3">{formatPercent(total ? s.value / total : null)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
