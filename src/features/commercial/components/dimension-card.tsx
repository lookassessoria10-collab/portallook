"use client";

import { useState } from "react";
import { formatCurrency, formatInteger, isFiniteNumber } from "@/lib/format/number";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { RankList } from "@/components/dashboard/rank-list";
import { cn } from "@/lib/cn";
import type { DimensionMeasure, DimensionView } from "@/features/commercial/metrics";
import { safeDivide, sumMaybe } from "@/lib/metrics/safe-math";

const LABEL: Record<DimensionMeasure, string> = { revenue: "Receita", quantity: "Quantidade", conversions: "Conversões", leads: "Leads" };

/** Status do item (ex.: "Ativa", "Inativa", "Destaque Ago"), com cor pelo sentido da palavra. */
export function StatusBadge({ text }: { text: string }) {
  const n = text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const tone = /inativ|pausad|saiu|deslig|encerr/.test(n) ? "bg-surface-3 text-text-3" : /destaque|top|melhor|recorde/.test(n) ? "bg-positive-soft text-positive" : /nov|retorn|volt/.test(n) ? "bg-info-soft text-info" : "bg-primary-soft text-primary";
  return <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold", tone)}>{text}</span>;
}

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
            if (r.averageTicket !== null) meta.push(`ticket ${formatCurrency(r.averageTicket, currency)}`);
            return {
              key: r.key,
              label: r.label,
              value: r[measure],
              valueLabel: measure === "revenue" ? formatCurrency(r[measure], currency) : formatInteger(r[measure]),
              share: safeDivide(r[measure], total),
              meta,
              badge: r.note ? <StatusBadge text={r.note} /> : undefined,
            };
          })}
        />
      </CardBody>
    </Card>
  );
}
