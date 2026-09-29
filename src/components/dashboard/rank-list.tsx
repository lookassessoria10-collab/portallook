import type { ReactNode } from "react";
import { formatPercent, isFiniteNumber } from "@/lib/format/number";
import { cn } from "@/lib/cn";

export interface RankItem {
  key: string;
  label: string;
  icon?: ReactNode;
  value: number | null;
  valueLabel: string;
  share: number | null;
  meta?: string[];
  badge?: ReactNode;
}

/**
 * Ranking com barras horizontais — funciona igual no celular e no desktop
 * (alternativa legível a tabelas largas). Uma medida, uma cor.
 */
export function RankList({ items, measureLabel, maxItems = 8, className }: { items: RankItem[]; measureLabel: string; maxItems?: number; className?: string }) {
  const visible = items.slice(0, maxItems);
  const rest = items.slice(maxItems);
  const max = Math.max(0, ...visible.map((i) => (isFiniteNumber(i.value) ? i.value : 0)));
  return (
    <div className={className}>
      <ul className="space-y-3.5">
        {visible.map((item) => {
          const width = isFiniteNumber(item.value) && max > 0 ? (item.value / max) * 100 : 0;
          return (
            <li key={item.key} className="min-w-0">
              <div className="flex items-baseline justify-between gap-3">
                <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-text">
                  {item.icon ? <span className="text-text-3 [&>svg]:size-4" aria-hidden>{item.icon}</span> : null}
                  <span className="truncate">{item.label}</span>
                  {item.badge}
                </p>
                <p className="shrink-0 text-sm">
                  <span className="tabular font-bold text-text">{item.valueLabel}</span>
                  {item.share !== null ? <span className="tabular ml-1.5 text-xs text-text-3">{formatPercent(item.share, 0)}</span> : null}
                </p>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-chart-track" aria-hidden>
                {width > 0 ? <div className="h-full rounded-full bg-chart-1" style={{ width: `${Math.max(width, 1.5)}%` }} /> : null}
              </div>
              {item.meta?.length ? <p className="mt-1.5 text-xs leading-relaxed text-text-3">{item.meta.join(" · ")}</p> : null}
            </li>
          );
        })}
      </ul>
      {rest.length ? (
        <p className={cn("mt-3 text-xs text-text-3")}>
          + {rest.length} {rest.length === 1 ? "item" : "itens"} com menor {measureLabel.toLowerCase()}: {rest.map((r) => r.label).join(", ")}
        </p>
      ) : null}
    </div>
  );
}
