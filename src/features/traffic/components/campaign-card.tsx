import { formatCurrency, formatDecimal, formatInteger, formatPercent, isFiniteNumber } from "@/lib/format/number";
import { lowerFirst, singularizePt } from "@/lib/format/text";
import { Badge } from "@/components/ui/badge";
import type { CampaignMetrics } from "@/features/traffic/metrics";
import { platformLabel } from "@/features/traffic/schema";

export function CampaignCard({ campaign: c, currency, showPlatform }: { campaign: CampaignMetrics; currency: string; showPlatform?: boolean }) {
  const hasResults = isFiniteNumber(c.results);
  const clicksLabel = c.clicksSource === "linkClicks" ? "Cliques no link" : "Cliques";
  const metrics: Array<{ label: string; value: string }> = [
    { label: "Investimento", value: formatCurrency(c.investment, currency) },
    { label: "Impressões", value: formatInteger(c.impressions) },
  ];
  if (isFiniteNumber(c.reach)) metrics.push({ label: "Alcance", value: formatInteger(c.reach) });
  if (c.effectiveClicks !== null) metrics.push({ label: clicksLabel, value: formatInteger(c.effectiveClicks) });
  if (c.ctr !== null) metrics.push({ label: "CTR", value: formatPercent(c.ctr, 2) });
  if (c.cpc !== null) metrics.push({ label: "CPC", value: formatCurrency(c.cpc, currency) });
  if (c.cpm !== null) metrics.push({ label: "CPM", value: formatCurrency(c.cpm, currency) });
  if (c.frequency !== null) metrics.push({ label: "Frequência", value: formatDecimal(c.frequency, 2) });
  if (c.roas !== null) metrics.push({ label: "ROAS", value: `${formatDecimal(c.roas, 2)}x` });

  const singular = c.resultLabel ? lowerFirst(singularizePt(c.resultLabel)) : "resultado";

  return (
    <article className="card-inset flex min-w-0 flex-col gap-3 p-4">
      <header className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          {showPlatform ? <Badge tone="primary">{platformLabel(c.platform)}</Badge> : null}
          {c.resultLabel ? <Badge tone="neutral">{c.resultLabel}</Badge> : null}
        </div>
        <h4 className="mt-2 line-clamp-2 break-words text-[15px] font-bold leading-snug text-text" title={c.name}>
          {c.name}
        </h4>
      </header>

      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 rounded-xl bg-surface px-3.5 py-3">
        {hasResults ? (
          <>
            <p>
              <span className="block text-[26px] font-bold leading-none text-text">{formatInteger(c.results)}</span>
              <span className="mt-1 block text-[13px] text-text-3">{c.resultLabel ? lowerFirst(c.resultLabel) : "resultados"}</span>
            </p>
            {c.costPerResult !== null ? (
              <p className="text-right">
                <span className="tabular block text-lg font-bold text-text">{formatCurrency(c.costPerResult, currency)}</span>
                <span className="block text-[13px] text-text-3">por {singular}</span>
              </p>
            ) : null}
          </>
        ) : (
          <>
            <p>
              <span className="block text-[26px] font-bold leading-none text-text">{formatInteger(c.effectiveClicks)}</span>
              <span className="mt-1 block text-[13px] text-text-3">{lowerFirst(clicksLabel)}</span>
            </p>
            {c.ctr !== null ? (
              <p className="text-right">
                <span className="tabular block text-lg font-bold text-text">{formatPercent(c.ctr, 2)}</span>
                <span className="block text-[13px] text-text-3">CTR</span>
              </p>
            ) : null}
          </>
        )}
      </div>

      <dl className="grid grid-cols-3 gap-x-3 gap-y-3">
        {metrics.map((m) => (
          <div key={m.label} className="min-w-0">
            <dt className="truncate text-xs text-text-3">{m.label}</dt>
            <dd className="tabular truncate text-sm font-semibold text-text">{m.value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
