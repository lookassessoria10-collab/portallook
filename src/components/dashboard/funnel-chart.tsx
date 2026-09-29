import { ArrowDown } from "lucide-react";
import { formatInteger, formatPercent, isFiniteNumber } from "@/lib/format/number";
import type { StageMetrics } from "@/features/commercial/metrics";
import { cn } from "@/lib/cn";

/**
 * Funil dinâmico: monta-se a partir das etapas do cliente (2, 3, 4…).
 * Barras proporcionais à primeira etapa; entre etapas, a taxa de passagem.
 * Etapa sem registro aparece como "Não registrado" — nunca como zero.
 */
export function FunnelChart({ stages, overallRate }: { stages: StageMetrics[]; overallRate: number | null }) {
  const first = stages[0]?.value ?? null;
  return (
    <div>
      <ol className="space-y-1">
        {stages.map((stage, i) => {
          const share = isFiniteNumber(stage.value) && isFiniteNumber(first) && first > 0 ? stage.value / first : null;
          const isLast = i === stages.length - 1;
          return (
            <li key={stage.key}>
              {i > 0 ? <StepRate stage={stage} /> : null}
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 sm:grid-cols-[minmax(8rem,11rem)_minmax(0,1fr)_4.5rem]">
                <p className={cn("min-w-0 truncate text-sm font-semibold", isLast ? "text-text" : "text-text-2")}>{stage.label}</p>
                <p className="text-right text-lg font-bold text-text sm:order-last">{isFiniteNumber(stage.value) ? formatInteger(stage.value) : <span className="text-sm font-semibold text-text-3">Não registrado</span>}</p>
                <div className="col-span-2 h-2.5 overflow-hidden rounded-full bg-chart-track sm:col-span-1 sm:h-3" aria-hidden>
                  {share !== null ? (
                    <div className="h-full rounded-full" style={{ width: `${Math.max(share * 100, 1.5)}%`, background: "var(--chart-1)", opacity: isLast ? 1 : 0.7 }} />
                  ) : (
                    <div className="h-full w-full bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgb(148_176_214/0.12)_6px_8px)]" />
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      {stages.length > 1 && overallRate !== null ? (
        <p className="mt-4 flex items-center justify-between rounded-xl bg-surface-2 px-3.5 py-2.5 text-sm">
          <span className="text-text-2">
            Conversão total <span className="text-text-3">({stages[0].label} → {stages[stages.length - 1].label})</span>
          </span>
          <span className="tabular font-bold text-text">{formatPercent(overallRate)}</span>
        </p>
      ) : null}
    </div>
  );
}

function StepRate({ stage }: { stage: StageMetrics }) {
  const rate = stage.rateFromPrevious;
  return (
    <p className="flex items-center gap-1.5 py-1.5 pl-1 text-xs text-text-3">
      <ArrowDown className="size-3.5" aria-hidden />
      {rate !== null ? (
        <span>
          <span className="tabular font-bold text-text-2">{formatPercent(rate)}</span> de {stage.previousLabel?.toLowerCase()} para {stage.label.toLowerCase()}
        </span>
      ) : stage.rateFromFirst !== null ? (
        <span>
          <span className="tabular font-bold text-text-2">{formatPercent(stage.rateFromFirst)}</span> em relação à primeira etapa
        </span>
      ) : (
        <span>taxa indisponível</span>
      )}
    </p>
  );
}
