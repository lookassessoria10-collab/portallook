import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { formatHeadlineValue, formatValue, type ValueFormat } from "@/lib/format/number";
import type { Comparison } from "@/lib/metrics/comparison";
import { cn } from "@/lib/cn";
import { Sparkline } from "@/components/charts/sparkline";
import { Delta } from "./delta";

export interface MetricCardProps {
  label: string;
  value: number | null;
  format: ValueFormat;
  currency?: string;
  comparison?: Comparison | null;
  reference?: string | null;
  trend?: Array<number | null>;
  icon?: ReactNode;
  description?: string;
  footnote?: string | null;
  size?: "default" | "compact";
  className?: string;
}

/**
 * Card de indicador: rótulo → valor → variação (+ minigráfico quando há espaço).
 * Tamanhos por container query: o mesmo card funciona em 2 colunas no celular
 * e em 4 no desktop sem cortar valores.
 */
export function MetricCard({ label, value, format, currency = "BRL", comparison, reference, trend, icon, description, footnote, size = "default", className }: MetricCardProps) {
  const compact = size === "compact";
  const full = formatValue(value, format, currency);
  const display = formatHeadlineValue(value, format, currency);
  return (
    <article className={cn("card @container flex min-w-0 flex-col", compact ? "gap-1.5 p-3.5" : "gap-2.5 p-4 sm:p-5", className)}>
      <header className="flex items-center gap-2">
        {icon ? (
          <span className={cn("hidden shrink-0 place-items-center rounded-lg bg-surface-2 text-text-2 @[12rem]:grid [&>svg]:size-4", compact ? "size-7" : "size-8")} aria-hidden>
            {icon}
          </span>
        ) : null}
        <h3 className={cn("line-clamp-2 min-w-0 flex-1 hyphens-auto font-semibold leading-snug text-text-2", compact ? "text-[13px]" : "text-[13px] @[12rem]:text-sm")}>{label}</h3>
        {description ? (
          <>
            <span className="hidden shrink-0 self-start text-text-3 @[12rem]:inline" title={description} aria-hidden>
              <Info className="size-3.5" />
            </span>
            <span className="sr-only">{description}</span>
          </>
        ) : null}
      </header>
      <p
        className={cn("whitespace-nowrap font-bold tracking-tight text-text", compact ? "text-[clamp(1.05rem,10.5cqi,1.3rem)]" : "text-[clamp(1.2rem,11.5cqi,1.875rem)] leading-none")}
        title={display !== full ? full : undefined}
      >
        {display}
        {display !== full ? <span className="sr-only"> ({full})</span> : null}
      </p>
      {comparison || (!compact && trend) ? (
        <div className="flex items-end justify-between gap-2">
          <Delta comparison={comparison ?? null} reference={reference} className="min-w-0" />
          {!compact && trend ? <Sparkline values={trend} width={76} height={28} className="hidden shrink-0 @[14.5rem]:block" /> : null}
        </div>
      ) : null}
      {footnote ? <p className="text-xs leading-snug text-text-3">{footnote}</p> : null}
    </article>
  );
}
