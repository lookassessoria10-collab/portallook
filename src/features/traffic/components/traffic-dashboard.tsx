import { formatCurrency, formatInteger, formatPercent, formatValue, isFiniteNumber } from "@/lib/format/number";
import { costPerLabel, lowerFirst } from "@/lib/format/text";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DashboardSection } from "@/components/dashboard/section";
import { MetricCard } from "@/components/dashboard/metric-card";
import { KpiIcon } from "@/components/dashboard/kpi-icon";
import { MetricTrend } from "@/components/dashboard/metric-trend";
import { InsightList } from "@/components/dashboard/insight-list";
import { Delta } from "@/components/dashboard/delta";
import type { Insight } from "@/features/reports/schema";
import type { PeriodUnit } from "@/lib/dates/period";
import type { TrafficViewModel } from "@/features/traffic/view-model";
import { CampaignCard } from "./campaign-card";

/** Textos que dependem da unidade do período (mês, semana…) e do gênero dela. */
function unitText(u: PeriodUnit) {
  const the = u.feminine ? "a" : "o";
  const of = u.feminine ? "da" : "do";
  return {
    summary: `Resumo ${of} ${u.singular}`,
    current: `${u.singular.charAt(0).toUpperCase()}${u.singular.slice(1)} atual`,
    comparison: `Comparação com ${the} ${u.singular} anterior`,
    last: (n: number) => `${u.feminine ? "Últimas" : "Últimos"} ${n} ${u.plural}`,
    historyHint: `O histórico aparece a partir ${of} ${u.feminine ? "segunda" : "segundo"} ${u.singular} ${u.feminine ? "publicada" : "publicado"}.`,
    empty: `Ainda não há ${u.plural} anteriores para comparar.`,
    insights: `Leitura da equipe sobre ${the} ${u.singular}`,
  };
}

export function TrafficDashboard({ vm, insights, currency }: { vm: TrafficViewModel; insights: Insight[]; currency: string }) {
  const t = vm.totals;
  const multiPlatform = vm.platforms.length > 1;
  const text = unitText(vm.unit);
  return (
    <div className="space-y-8 sm:space-y-10">
      <DashboardSection id="resumo" title={text.summary} description={vm.headline}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {vm.kpis.map((k) => (
            <MetricCard key={k.key} label={k.label} value={k.value} format={k.format} currency={currency} comparison={k.comparison} reference={vm.reference} trend={k.trend} icon={<KpiIcon name={k.icon} />} description={k.description} footnote={k.footnote} />
          ))}
        </div>
        {vm.secondary.length ? (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {vm.secondary.map((k) => (
              <MetricCard key={k.key} size="compact" label={k.label} value={k.value} format={k.format} currency={currency} comparison={k.comparison} reference={vm.reference} description={k.description} footnote={k.footnote} />
            ))}
          </div>
        ) : null}
        {t.resultGroups.length > 1 ? (
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Resultados por tipo">
            {t.resultGroups.map((g) => (
              <li key={g.type} className="rounded-full border border-border-strong bg-surface px-3 py-1.5 text-[13px] text-text-2">
                <strong className="text-text">{formatInteger(g.count)}</strong> {lowerFirst(g.label)}
                {g.costPerResult !== null ? <span className="text-text-3"> · {formatCurrency(g.costPerResult, currency)} cada</span> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </DashboardSection>

      <DashboardSection
        id="plataformas"
        title={vm.campaignDetail ? (multiPlatform ? "Plataformas e campanhas" : "Campanhas") : multiPlatform ? "Plataformas" : "Plataforma"}
        description={vm.campaignDetail ? `${t.campaignCount} ${t.campaignCount === 1 ? "campanha" : "campanhas"} no período` : "Totais de cada plataforma no período"}
      >
        <div className="space-y-4">
          {vm.platforms.map((p) => (
            <Card key={p.platform}>
              <CardHeader
                as="h3"
                title={p.label}
                subtitle={
                  <>
                    {formatCurrency(p.totals.investment, currency)} investidos
                    {multiPlatform && p.investmentShare !== null ? ` · ${formatPercent(p.investmentShare, 0)} do total` : ""}
                  </>
                }
                actions={<Delta comparison={p.comparison} reference={vm.reference} showReference={false} className="justify-end" />}
              />
              <CardBody>
                <dl className={`${p.totalsOnly ? "" : "mb-4 "}grid grid-cols-2 gap-3 rounded-xl border border-border px-3.5 py-3 sm:grid-cols-4`}>
                  <PlatformStat label="Impressões" value={formatInteger(p.totals.impressions)} />
                  {p.totals.reach !== null ? <PlatformStat label="Alcance" value={formatInteger(p.totals.reach)} /> : null}
                  {p.totals.clicks !== null ? <PlatformStat label="Cliques" value={formatInteger(p.totals.clicks)} /> : null}
                  {p.totals.results !== null ? (
                    <PlatformStat
                      label={p.totals.resultGroups.length === 1 ? p.totals.resultGroups[0].label : "Resultados"}
                      value={formatInteger(p.totals.results)}
                    />
                  ) : null}
                  {p.totals.costPerResult !== null && p.totals.resultGroups.length === 1 ? (
                    <PlatformStat label={costPerLabel(p.totals.resultGroups[0].label)} value={formatCurrency(p.totals.costPerResult, currency)} />
                  ) : null}
                  {p.totals.ctr !== null ? <PlatformStat label="CTR" value={formatPercent(p.totals.ctr, 2)} /> : null}
                </dl>
                {p.totalsOnly ? null : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {p.campaigns.map((c) => (
                      <CampaignCard key={c.id} campaign={c} currency={currency} />
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      </DashboardSection>

      <div className="grid gap-4 lg:grid-cols-12">
        {vm.reference ? (
          <Card className="lg:col-span-5">
            <CardHeader title="Comparativo" subtitle={`${text.current} vs. ${vm.reference}`} />
            <CardBody>
              <table className="w-full text-sm">
                <caption className="sr-only">{text.comparison}</caption>
                <thead>
                  <tr className="border-b border-border text-xs text-text-3">
                    <th scope="col" className="py-2 text-left font-semibold">
                      Métrica
                    </th>
                    <th scope="col" className="py-2 text-right font-semibold">
                      Atual
                    </th>
                    <th scope="col" className="py-2 pl-3 text-right font-semibold">
                      Variação
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {vm.comparisonRows.map((r) => (
                    <tr key={r.key} className="border-b border-border last:border-0">
                      <th scope="row" className="py-2.5 pr-2 text-left font-medium text-text-2">
                        {r.label}
                      </th>
                      <td className="py-2.5 text-right">
                        <span className="tabular block font-bold text-text">{formatValue(r.current, r.format, currency)}</span>
                        {isFiniteNumber(r.previous) ? <span className="tabular block text-xs text-text-3">antes {formatValue(r.previous, r.format, currency)}</span> : null}
                      </td>
                      <td className="py-2.5 pl-3 text-right">
                        <Delta comparison={r.comparison} showReference={false} className="justify-end" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          </Card>
        ) : null}
        <Card className={vm.reference ? "lg:col-span-7" : "lg:col-span-12"}>
          <CardHeader title="Evolução" subtitle={vm.trend ? text.last(vm.trend.points.length) : text.historyHint} />
          <CardBody>
            {vm.trend ? <MetricTrend points={vm.trend.points} series={vm.trend.series} currency={currency} /> : <p className="py-10 text-center text-sm text-text-3">{text.empty}</p>}
          </CardBody>
        </Card>
      </div>

      {insights.length ? (
        <DashboardSection id="insights" title="Insights da Look" description={text.insights}>
          <InsightList insights={insights} />
        </DashboardSection>
      ) : null}
    </div>
  );
}

function PlatformStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-xs text-text-3">{label}</dt>
      <dd className="tabular text-[15px] font-bold text-text">{value}</dd>
    </div>
  );
}
