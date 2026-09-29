"use client";

import { formatValue, type ValueFormat } from "@/lib/format/number";

export interface TooltipRow {
  label: string;
  value: number | null;
  format: ValueFormat;
  color: string;
}

export function ChartTooltipCard({ title, rows, currency }: { title: string; rows: TooltipRow[]; currency: string }) {
  return (
    <div className="min-w-40 rounded-xl border border-border-strong bg-surface-2 px-3 py-2.5 shadow-pop">
      <p className="text-xs font-semibold text-text-3">{title}</p>
      <ul className="mt-1.5 space-y-1">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-4 text-[13px]">
            <span className="flex items-center gap-1.5 text-text-2">
              <span className="size-2 rounded-full" style={{ background: r.color }} aria-hidden />
              {r.label}
            </span>
            <span className="tabular font-bold text-text">{formatValue(r.value, r.format, currency)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
