"use client";

import { useState } from "react";
import { formatCurrency, formatInteger, formatValue, isFiniteNumber } from "@/lib/format/number";
import { sumMaybe } from "@/lib/metrics/safe-math";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { RankList } from "@/components/dashboard/rank-list";
import type { DimensionOverview } from "@/features/commercial/overview";
import { StatusBadge } from "./dimension-card";

/**
 * Detalhamento somado em todos os períodos (ex.: ranking de terapeutas no ano):
 * ranking pela medida principal com ticket e status; a tabela mostra período a período.
 */
export function DimensionOverviewCard({ dimension, currency, rangeLabel }: { dimension: DimensionOverview; currency: string; rangeLabel: string }) {
  const [showTable, setShowTable] = useState(false);
  const money = dimension.measure === "revenue";
  const value = (v: number | null) => (money ? formatCurrency(v, currency) : formatInteger(v));
  const quantityName = (dimension.quantityLabel ?? "quantidade").toLowerCase();

  return (
    <Card>
      <CardHeader
        as="h3"
        title={dimension.label}
        subtitle={`${rangeLabel} · ${dimension.measureLabel.toLowerCase()}: ${value(dimension.total)}`}
        actions={
          dimension.periods.length > 1 ? (
            <button type="button" onClick={() => setShowTable((v) => !v)} aria-expanded={showTable} className="h-8 rounded-full px-3 text-[13px] font-semibold text-text-3 hover:bg-surface-2 hover:text-text-2">
              {showTable ? "Ver ranking" : "Ver mês a mês"}
            </button>
          ) : undefined
        }
      />
      <CardBody>
        {showTable ? (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <caption className="sr-only">
                {dimension.label}: {dimension.periodMeasureLabel.toLowerCase()} por período
              </caption>
              <thead className="bg-surface-2 text-xs text-text-3">
                <tr>
                  <th scope="col" className="sticky left-0 z-[1] bg-surface-2 px-3 py-2 text-left font-semibold">
                    {dimension.label}
                  </th>
                  {dimension.periods.map((p) => (
                    <th key={p.key} scope="col" className="whitespace-nowrap px-3 py-2 text-right font-semibold">
                      {p.label}
                    </th>
                  ))}
                  <th scope="col" className="whitespace-nowrap border-l border-border px-3 py-2 text-right font-semibold">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {dimension.rows.map((r) => (
                  <tr key={r.key} className="border-t border-border">
                    <th scope="row" className="sticky left-0 z-[1] whitespace-nowrap bg-surface px-3 py-2 text-left font-semibold text-text">
                      {r.label}
                    </th>
                    {dimension.periods.map((p) => (
                      <td key={p.key} className="tabular whitespace-nowrap px-3 py-2 text-right text-text-2">
                        {formatValue(r.byPeriod[p.key] ?? null, dimension.periodMeasure === "revenue" ? "currency" : "integer", currency)}
                      </td>
                    ))}
                    <td className="tabular whitespace-nowrap border-l border-border px-3 py-2 text-right font-bold text-text">
                      {formatValue(sumMaybe(Object.values(r.byPeriod)), dimension.periodMeasure === "revenue" ? "currency" : "integer", currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-3 py-2 text-xs text-text-3">{dimension.periodMeasureLabel} por mês. “—” = sem registro no mês.</p>
          </div>
        ) : (
          <RankList
            measureLabel={dimension.measureLabel}
            maxItems={10}
            items={dimension.rows.map((r) => {
              const meta: string[] = [];
              if (dimension.measure !== "quantity" && isFiniteNumber(r.quantity)) meta.push(`${formatInteger(r.quantity)} ${quantityName}`);
              if (dimension.measure !== "revenue" && isFiniteNumber(r.revenue)) meta.push(`receita ${formatCurrency(r.revenue, currency)}`);
              if (r.averageTicket !== null) meta.push(`ticket ${formatCurrency(r.averageTicket, currency)}`);
              if (dimension.measure !== "conversions" && isFiniteNumber(r.conversions)) meta.push(`${formatInteger(r.conversions)} conversões`);
              return {
                key: r.key,
                label: r.label,
                value: r[dimension.measure],
                valueLabel: value(r[dimension.measure]),
                share: r.share,
                meta,
                badge: r.status ? <StatusBadge text={r.status} /> : undefined,
              };
            })}
          />
        )}
      </CardBody>
    </Card>
  );
}
