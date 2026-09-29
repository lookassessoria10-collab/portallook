import { Info } from "lucide-react";
import { formatHeadlineValue } from "@/lib/format/number";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DashboardSection } from "@/components/dashboard/section";
import { MetricCard } from "@/components/dashboard/metric-card";
import { KpiIcon } from "@/components/dashboard/kpi-icon";
import { FunnelChart } from "@/components/dashboard/funnel-chart";
import { ComparisonColumns, MetricTrend } from "@/components/dashboard/metric-trend";
import { InsightList } from "@/components/dashboard/insight-list";
import { Delta } from "@/components/dashboard/delta";
import type { Insight } from "@/features/reports/schema";
import type { CommercialViewModel } from "@/features/commercial/view-model";
import { ChannelBreakdown } from "./channel-breakdown";
import { DimensionCard } from "./dimension-card";

/**
 * Ordem pensada para responder, nesta sequência: Como estamos? O que aconteceu?
 * De onde vieram os resultados? Como estamos vs. o período anterior? O que merece atenção?
 */
export function CommercialDashboard({ vm, insights, currency }: { vm: CommercialViewModel; insights: Insight[]; currency: string }) {
  const attention = insights.filter((i) => i.type === "attention");
  return (
    <div className="space-y-8 sm:space-y-10">
      {vm.context ? (
        <aside className="flex gap-3 rounded-[var(--radius-lg)] border border-[rgb(140_156_248/0.25)] bg-info-soft p-4" aria-label="Contexto do período">
          <Info className="mt-0.5 size-5 shrink-0 text-info" aria-hidden />
          <div>
            <p className="font-bold text-text">{vm.context.title}</p>
            {vm.context.description ? <p className="mt-0.5 text-sm leading-relaxed text-text-2">{vm.context.description}</p> : null}
          </div>
        </aside>
      ) : null}

      <DashboardSection id="resumo" title="Resumo do período" description={vm.headline}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {vm.kpis.map((k) => (
            <MetricCard key={k.key} label={k.label} value={k.value} format={k.format} currency={currency} comparison={k.comparison} reference={vm.reference} trend={k.trend} icon={<KpiIcon name={k.icon} />} description={k.description} footnote={k.footnote} />
          ))}
        </div>
        {vm.secondary.length ? (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {vm.secondary.map((k) => (
              <MetricCard key={k.key} size="compact" label={k.label} value={k.value} format={k.format} currency={currency} comparison={k.comparison} reference={vm.reference} description={k.description} />
            ))}
          </div>
        ) : null}
        {attention.length ? (
          <a href="#insights" className="mt-3 flex items-center gap-2 rounded-xl border border-[rgb(246_189_91/0.25)] bg-attention-soft px-3.5 py-2.5 text-sm font-semibold text-attention hover:brightness-110">
            {attention.length === 1 ? "1 ponto de atenção neste período" : `${attention.length} pontos de atenção neste período`} →
          </a>
        ) : null}
      </DashboardSection>

      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <CardHeader title="Funil de conversão" subtitle={`${vm.funnel.stages.length} etapas no período`} />
          <CardBody>
            <FunnelChart stages={vm.funnel.stages} overallRate={vm.funnel.overallRate} />
          </CardBody>
        </Card>
        <Card className="lg:col-span-7">
          <CardHeader title="Evolução" subtitle={vm.trend ? `Últimos ${vm.trend.points.length} períodos` : "O histórico aparece a partir do segundo período publicado."} />
          <CardBody>
            {vm.trend ? <MetricTrend points={vm.trend.points} series={vm.trend.series} currency={currency} /> : <p className="py-10 text-center text-sm text-text-3">Ainda não há períodos anteriores para comparar.</p>}
          </CardBody>
        </Card>
      </div>

      {vm.channels ? (
        <Card id="canais">
          <CardHeader title="Canais de origem" subtitle="De onde vieram os resultados" />
          <CardBody>
            <ChannelBreakdown rows={vm.channels.rows} measures={vm.channels.measures} currency={currency} finalLabel={vm.metrics.finalStageLabel} firstLabel={vm.metrics.firstStageLabel} />
          </CardBody>
        </Card>
      ) : null}

      {vm.financial ? (
        <Card id="financeiro">
          <CardHeader title="Investimento e retorno" subtitle="Receita, mídia e eficiência" />
          <CardBody className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-8">
            <div className="space-y-4">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-5">
                {vm.financial.cards.map((c) => (
                  <div key={c.key} className="min-w-0">
                    <dt className="text-[13px] font-semibold text-text-3">{c.label}</dt>
                    <dd className="mt-0.5 whitespace-nowrap text-xl font-bold text-text">{formatHeadlineValue(c.value, c.format, currency)}</dd>
                    <dd>
                      <Delta comparison={c.comparison} reference={vm.reference} showReference={false} className="mt-0.5" />
                    </dd>
                  </div>
                ))}
              </dl>
              {vm.financial.roasNote ? <p className="text-xs text-text-3">{vm.financial.roasNote}</p> : null}
            </div>
            {vm.financial.series.length && vm.trend ? (
              <ComparisonColumns points={vm.trend.points} series={vm.financial.series} currency={currency} caption="Receita e investimento por período" />
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      {vm.dimensions.length ? (
        <DashboardSection id="dimensoes" title="Detalhamento" description="Resultados por categoria do negócio">
          <div className="grid gap-4 md:grid-cols-2">
            {vm.dimensions.map((d) => (
              <DimensionCard key={d.key} dimension={d} currency={currency} />
            ))}
          </div>
        </DashboardSection>
      ) : null}

      {vm.extraMetrics.length ? (
        <DashboardSection id="indicadores" title="Indicadores adicionais">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {vm.extraMetrics.map((e) => (
              <MetricCard key={e.key} size="compact" label={e.label} value={e.value} format={e.format} currency={currency} comparison={e.comparison} reference={vm.reference} description={e.description ?? undefined} />
            ))}
          </div>
        </DashboardSection>
      ) : null}

      {insights.length ? (
        <DashboardSection id="insights" title="Insights da Look" description="Leitura da equipe sobre o período">
          <InsightList insights={insights} />
        </DashboardSection>
      ) : null}
    </div>
  );
}

