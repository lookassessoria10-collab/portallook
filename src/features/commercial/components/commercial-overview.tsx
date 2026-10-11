import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DashboardSection } from "@/components/dashboard/section";
import { ComparisonColumns, MetricTrend } from "@/components/dashboard/metric-trend";
import { PeriodTable } from "@/components/dashboard/period-table";
import { OverviewSummary, tapHint, unitByUnit, unitName } from "@/components/dashboard/overview-parts";
import type { CommercialOverviewViewModel } from "@/features/commercial/overview";
import { ChannelBreakdown } from "./channel-breakdown";
import { DimensionOverviewCard } from "./dimension-overview-card";

/**
 * Todos os períodos comerciais juntos: totais, funil, canais (com o retorno dos canais pagos),
 * novos × recorrentes, detalhamentos acumulados (ex.: ranking de terapeutas) e tabela período a período.
 * Cada bloco só aparece quando a planilha do cliente traz aquele dado.
 */
export function CommercialOverview({ vm, currency, periodHref }: { vm: CommercialOverviewViewModel; currency: string; periodHref: (periodKey: string) => string }) {
  const per = `por ${vm.unit.singular}`;
  const charts = [
    vm.funnelSeries ? { key: "funil", title: `Funil ${per}`, subtitle: vm.funnelSeries.map((s) => s.label).join(" e "), series: vm.funnelSeries, stacked: false } : null,
    vm.financialSeries ? { key: "financeiro", title: `Receita e investimento ${per}`, subtitle: undefined, series: vm.financialSeries, stacked: false } : null,
    vm.channelSeries ? { key: "canais", title: `${vm.firstStageLabel} por canal`, subtitle: `Origem dos resultados ${per}`, series: vm.channelSeries, stacked: true } : null,
    vm.channelRevenueSeries ? { key: "receita-canais", title: "Receita por canal", subtitle: `De onde veio a receita ${per}`, series: vm.channelRevenueSeries, stacked: true } : null,
    vm.customerSeries ? { key: "clientes", title: `Novos e recorrentes ${per}`, subtitle: "Clientes atendidos, por tipo", series: vm.customerSeries, stacked: true } : null,
  ].filter((c) => c !== null);

  return (
    <div className="space-y-8 sm:space-y-10">
      <OverviewSummary headline={vm.headline} kpis={vm.kpis} secondary={vm.secondary} currency={currency} />

      {charts.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {charts.map((c, i) => (
            <Card key={c.key} className={charts.length % 2 === 1 && i === charts.length - 1 ? "lg:col-span-2" : undefined}>
              <CardHeader title={c.title} subtitle={c.subtitle} />
              <CardBody>
                <ComparisonColumns points={vm.points} series={c.series} currency={currency} caption={c.title} stacked={c.stacked} />
              </CardBody>
            </Card>
          ))}
        </div>
      ) : null}

      {vm.channels ? (
        <Card id="canais-no-periodo">
          <CardHeader title="Canais no período" subtitle={`${vm.rangeLabel} · somados`} />
          <CardBody>
            <ChannelBreakdown rows={vm.channels.rows} measures={vm.channels.measures} currency={currency} finalLabel={vm.finalStageLabel} firstLabel={vm.firstStageLabel} />
          </CardBody>
        </Card>
      ) : null}

      {vm.paidChannels ? (
        <Card id="retorno-por-canal">
          <CardHeader title="Retorno por canal pago" subtitle={`Investimento, receita e retorno de cada canal com mídia, ${per}`} />
          <CardBody>
            <PeriodTable table={vm.paidChannels} currency={currency} caption={`Retorno por canal pago ${per}`} periodLabel={unitName(vm.unit)} href={periodHref} />
            <p className="mt-2 text-xs text-text-3">Retorno = receita do canal ÷ investimento no canal. 3,0x = R$ 3 para cada R$ 1 investido.</p>
          </CardBody>
        </Card>
      ) : null}

      {vm.dimensions.length ? (
        <DashboardSection id="detalhamento-acumulado" title="Detalhamento" description={`Acumulado de ${vm.rangeLabel.charAt(0).toLowerCase()}${vm.rangeLabel.slice(1)}`}>
          <div className="grid gap-4 xl:grid-cols-2">
            {vm.dimensions.map((d) => (
              <DimensionOverviewCard key={d.key} dimension={d} currency={currency} rangeLabel="Acumulado" />
            ))}
          </div>
        </DashboardSection>
      ) : null}

      <Card id="periodo-a-periodo">
        <CardHeader title={unitByUnit(vm.unit)} subtitle={tapHint(vm.unit)} />
        <CardBody>
          <PeriodTable table={vm.table} currency={currency} caption={`Resultados comerciais ${per}`} periodLabel={unitName(vm.unit)} href={periodHref} />
        </CardBody>
      </Card>

      {vm.efficiencySeries.length ? (
        <Card>
          <CardHeader title="Eficiência ao longo do tempo" subtitle={`Conversão, custos e retorno ${per}`} />
          <CardBody>
            <MetricTrend points={vm.points} series={vm.efficiencySeries} currency={currency} />
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
