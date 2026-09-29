"use client";

import { useState } from "react";
import { formatCurrency, formatInteger, formatMultiplier, formatPercent, isFiniteNumber } from "@/lib/format/number";
import { RankList } from "@/components/dashboard/rank-list";
import { cn } from "@/lib/cn";
import type { ChannelView } from "@/features/commercial/view-model";
import { ChannelIcon } from "./channel-icon";

type Measure = "leads" | "revenue" | "conversions";

const MEASURE_LABEL: Record<Measure, string> = { leads: "Leads", revenue: "Receita", conversions: "Conversões" };

export function ChannelBreakdown({ rows, measures, currency, finalLabel, firstLabel }: { rows: ChannelView[]; measures: Measure[]; currency: string; finalLabel: string; firstLabel: string }) {
  const [measure, setMeasure] = useState<Measure>(measures[0] ?? "leads");
  const label = (m: Measure) => (m === "conversions" ? finalLabel : m === "leads" ? firstLabel : MEASURE_LABEL[m]);
  const sorted = [...rows].sort((a, b) => (b[measure] ?? -1) - (a[measure] ?? -1));
  const share = (r: ChannelView) => (measure === "leads" ? r.leadShare : measure === "revenue" ? r.revenueShare : null);

  const cols = {
    leads: rows.some((r) => isFiniteNumber(r.leads)),
    conversions: rows.some((r) => isFiniteNumber(r.conversions)),
    rate: rows.some((r) => r.conversionRate !== null),
    revenue: rows.some((r) => isFiniteNumber(r.revenue)),
    investment: rows.some((r) => isFiniteNumber(r.investment)),
    cpl: rows.some((r) => r.cpl !== null),
    roas: rows.some((r) => r.roas !== null),
  };

  return (
    <div>
      {measures.length > 1 ? (
        <div role="radiogroup" aria-label="Ordenar canais por" className="mb-4 flex gap-1">
          {measures.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={m === measure}
              onClick={() => setMeasure(m)}
              className={cn("h-8 rounded-full px-3 text-[13px] font-semibold", m === measure ? "bg-primary-soft text-primary" : "text-text-3 hover:bg-surface-2 hover:text-text-2")}
            >
              {label(m)}
            </button>
          ))}
        </div>
      ) : null}

      <RankList
        className="lg:hidden"
        measureLabel={label(measure)}
        items={sorted.map((r) => ({
          key: r.key,
          label: r.label,
          icon: <ChannelIcon kind={r.kind} name={r.label} />,
          value: r[measure],
          valueLabel: measure === "revenue" ? formatCurrency(r.revenue, currency) : formatInteger(r[measure]),
          share: share(r),
          meta: r.meta.filter((m) => !m.startsWith(measure === "revenue" ? "receita" : "\u0000")),
        }))}
      />

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[640px] text-sm">
          <caption className="sr-only">Resultados por canal</caption>
          <thead>
            <tr className="border-b border-border text-left text-xs text-text-3">
              <th scope="col" className="py-2 pr-3 font-semibold">
                Canal
              </th>
              {cols.leads ? <Th>{firstLabel}</Th> : null}
              {cols.conversions ? <Th>{finalLabel}</Th> : null}
              {cols.rate ? <Th>Conversão</Th> : null}
              {cols.revenue ? <Th>Receita</Th> : null}
              {cols.investment ? <Th>Investimento</Th> : null}
              {cols.cpl ? <Th>CPL</Th> : null}
              {cols.roas ? <Th>ROAS</Th> : null}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.key} className="border-b border-border last:border-0">
                <th scope="row" className="py-2.5 pr-3 text-left font-semibold text-text">
                  <span className="flex items-center gap-2">
                    <span className="text-text-3 [&>svg]:size-4" aria-hidden>
                      <ChannelIcon kind={r.kind} name={r.label} />
                    </span>
                    {r.label}
                  </span>
                </th>
                {cols.leads ? <Td>{formatInteger(r.leads)}</Td> : null}
                {cols.conversions ? <Td>{formatInteger(r.conversions)}</Td> : null}
                {cols.rate ? <Td>{formatPercent(r.conversionRate)}</Td> : null}
                {cols.revenue ? <Td>{formatCurrency(r.revenue, currency)}</Td> : null}
                {cols.investment ? <Td>{formatCurrency(r.investment, currency)}</Td> : null}
                {cols.cpl ? <Td>{formatCurrency(r.cpl, currency)}</Td> : null}
                {cols.roas ? <Td>{formatMultiplier(r.roas)}</Td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th scope="col" className="whitespace-nowrap px-3 py-2 text-right font-semibold">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="tabular whitespace-nowrap px-3 py-2.5 text-right font-medium text-text-2">{children}</td>;
}
