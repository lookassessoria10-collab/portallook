import { lowerFirst } from "@/lib/format/text";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ComparisonColumns, MetricTrend } from "@/components/dashboard/metric-trend";
import { PeriodTable } from "@/components/dashboard/period-table";
import { OverviewSummary, tapHint, unitByUnit, unitName } from "@/components/dashboard/overview-parts";
import type { TrafficOverviewViewModel } from "@/features/traffic/overview";

/** Todos os períodos de tráfego juntos: totais, composição por plataforma e tabela período a período. */
export function TrafficOverview({ vm, currency, periodHref }: { vm: TrafficOverviewViewModel; currency: string; periodHref: (periodKey: string) => string }) {
  const per = `por ${vm.unit.singular}`;
  const byPlatform = vm.platforms.length > 1 ? "Divisão por plataforma" : vm.platforms[0]?.label;
  return (
    <div className="space-y-8 sm:space-y-10">
      <OverviewSummary headline={vm.headline} kpis={vm.kpis} secondary={vm.secondary} currency={currency} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={`Investimento ${per}`} subtitle={byPlatform} />
          <CardBody>
            <ComparisonColumns points={vm.points} series={vm.investmentSeries} currency={currency} caption={`Investimento ${per}`} stacked />
          </CardBody>
        </Card>
        {vm.resultsSeries ? (
          <Card>
            <CardHeader title={`${vm.resultsLabel} ${per}`} subtitle={byPlatform} />
            <CardBody>
              <ComparisonColumns points={vm.points} series={vm.resultsSeries} currency={currency} caption={`${vm.resultsLabel} ${per}`} stacked />
            </CardBody>
          </Card>
        ) : null}
      </div>

      <Card id="periodo-a-periodo">
        <CardHeader title={unitByUnit(vm.unit)} subtitle={tapHint(vm.unit)} />
        <CardBody>
          <PeriodTable table={vm.table} currency={currency} caption={`Resultados de tráfego ${per}`} periodLabel={unitName(vm.unit)} href={periodHref} />
          {vm.resultsSeries ? <p className="mt-2 text-xs text-text-3">Custo = investimento das campanhas que geraram {lowerFirst(vm.resultsLabel)} ÷ {lowerFirst(vm.resultsLabel)}.</p> : null}
        </CardBody>
      </Card>

      {vm.efficiencySeries.length ? (
        <Card>
          <CardHeader title="Eficiência ao longo do tempo" subtitle={`Como os custos e as taxas variaram ${per}`} />
          <CardBody>
            <MetricTrend points={vm.points} series={vm.efficiencySeries} currency={currency} />
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
