import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ComparisonColumns, MetricTrend } from "@/components/dashboard/metric-trend";
import { PeriodTable } from "@/components/dashboard/period-table";
import { OverviewSummary, tapHint, unitByUnit, unitName } from "@/components/dashboard/overview-parts";
import type { CommercialOverviewViewModel } from "@/features/commercial/overview";

/** Todos os períodos comerciais juntos: totais, funil e canais por período e tabela período a período. */
export function CommercialOverview({ vm, currency, periodHref }: { vm: CommercialOverviewViewModel; currency: string; periodHref: (periodKey: string) => string }) {
  const per = `por ${vm.unit.singular}`;
  const charts = [
    vm.funnelSeries ? { key: "funil", title: `Funil ${per}`, subtitle: vm.funnelSeries.map((s) => s.label).join(" e "), series: vm.funnelSeries, stacked: false } : null,
    vm.channelSeries ? { key: "canais", title: `${vm.firstStageLabel} por canal`, subtitle: `Origem dos resultados ${per}`, series: vm.channelSeries, stacked: true } : null,
    vm.financialSeries ? { key: "financeiro", title: `Receita e investimento ${per}`, subtitle: undefined, series: vm.financialSeries, stacked: false } : null,
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
