import { lowerFirst } from "@/lib/format/text";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ComparisonColumns, MetricTrend } from "@/components/dashboard/metric-trend";
import { PeriodTable } from "@/components/dashboard/period-table";
import { OverviewSummary, tapHint, unitByUnit, unitName } from "@/components/dashboard/overview-parts";
import type { SocialOverviewViewModel } from "@/features/social/overview";

/** Todos os meses de rede social juntos: audiência, interações, tabela mês a mês e evolução. */
export function SocialOverview({ vm, periodHref }: { vm: SocialOverviewViewModel; periodHref: (periodKey: string) => string }) {
  const per = `por ${vm.unit.singular}`;
  /** "Alcance e visualizações": só o primeiro rótulo com maiúscula. */
  const names = (series: Array<{ label: string }>) => series.map((s, i) => (i ? lowerFirst(s.label) : s.label)).join(" e ");
  const charts = [
    vm.growthSeries ? { key: "seguidores", title: `Seguidores ${per}`, subtitle: names(vm.growthSeries), series: vm.growthSeries, stacked: false } : null,
    vm.interactionSeries ? { key: "interacoes", title: `Interações ${per}`, subtitle: "Curtidas, comentários, salvamentos e compartilhamentos", series: vm.interactionSeries, stacked: true } : null,
    vm.audienceSeries ? { key: "alcance", title: `${names(vm.audienceSeries)} ${per}`, subtitle: "Quantas contas viram o conteúdo e quantas vezes ele apareceu", series: vm.audienceSeries, stacked: false } : null,
  ].filter((c) => c !== null);

  return (
    <div className="space-y-8 sm:space-y-10">
      <OverviewSummary headline={vm.headline} kpis={vm.kpis} secondary={vm.secondary} currency="BRL" />

      {charts.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {charts.map((c, i) => (
            <Card key={c.key} className={charts.length % 2 === 1 && i === charts.length - 1 ? "lg:col-span-2" : undefined}>
              <CardHeader title={c.title} subtitle={c.subtitle} />
              <CardBody>
                <ComparisonColumns points={vm.points} series={c.series} currency="BRL" caption={c.title} stacked={c.stacked} />
              </CardBody>
            </Card>
          ))}
        </div>
      ) : null}

      <Card id="periodo-a-periodo">
        <CardHeader title={unitByUnit(vm.unit)} subtitle={tapHint(vm.unit)} />
        <CardBody>
          <PeriodTable table={vm.table} currency="BRL" caption={`Resultados de ${vm.networkLabel} ${per}`} periodLabel={unitName(vm.unit)} href={periodHref} />
          <p className="mt-2 text-xs text-text-3">No total, seguidores, alcance e engajamento ficam em branco: são contas únicas de cada mês e não se somam.</p>
        </CardBody>
      </Card>

      {vm.trendSeries.length ? (
        <Card>
          <CardHeader title="Evolução" subtitle={`Como cada métrica variou ${per}`} />
          <CardBody>
            <MetricTrend points={vm.points} series={vm.trendSeries} currency="BRL" />
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
