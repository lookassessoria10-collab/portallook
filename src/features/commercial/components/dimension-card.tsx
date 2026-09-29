"use client";

import { useState } from "react";
import { formatCurrency, formatInteger, isFiniteNumber } from "@/lib/format/number";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { RankList } from "@/components/dashboard/rank-list";
import { cn } from "@/lib/cn";
import type { DimensionMeasure, DimensionView } from "@/features/commercial/metrics";
import { safeDivide, sumMaybe } from "@/lib/metrics/safe-math";

const LABEL: Record<DimensionMeasure, string> = { revenue: "Receita", quantity: "Quantidade", conversions: "Conversões", leads: "Leads" };

/** Dimensão adicional genérica (serviços, profissionais, unidades…), sem código por cliente. */
export function DimensionCard({ dimension, currency }: { dimension: DimensionView; currency: string }) {
  const quantityLabel = dimension.quantityLabel;
  const [measure, setMeasure] = useState<DimensionMeasure>(dimension.measure);
  const label = (m: DimensionMeasure) => (m === "quantity" && quantityLabel ? quantityLabel : LABEL[m]);
  const total = sumMaybe(dimension.rows.map((r) => r[measure]));
  const rows = [...dimension.rows].sort((a, b) => (b[measure] ?? -1) - (a[measure] ?? -1));

  return (
    <Card>
      <CardHeader
        title={dimension.label}
        subtitle={total !== null ? `${label(measure)}: ${measure === "revenue" ? formatCurrency(total, currency) : formatInteger(total)} no período` : undefined}
        as="h3"
      />
      <CardBody>
        {dimension.measures.length > 1 ? (
          <div role="radiogroup" aria-label={`Medida de ${dimension.label}`} className="mb-4 flex flex-wrap gap-1">
            {dimension.measures.map((m) => (
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
          measureLabel={label(measure)}
          items={rows.map((r) => {
            const meta: string[] = [];
            for (const m of dimension.measures) {
              if (m === measure || !isFiniteNumber(r[m])) continue;
              meta.push(`${label(m).toLowerCase()} ${m === "revenue" ? formatCurrency(r[m], currency) : formatInteger(r[m])}`);
            }
            if (r.averageTicket !== null && measure !== "revenue") meta.push(`ticket ${formatCurrency(r.averageTicket, currency)}`);
            if (r.note) meta.push(r.note);
            return {
              key: r.key,
              label: r.label,
              value: r[measure],
              valueLabel: measure === "revenue" ? formatCurrency(r[measure], currency) : formatInteger(r[measure]),
              share: safeDivide(r[measure], total),
              meta,
            };
          })}
        />
      </CardBody>
    </Card>
  );
}
