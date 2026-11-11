import { lowerFirst } from "@/lib/format/text";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ComparisonColumns } from "@/components/dashboard/metric-trend";
import { PeriodTable } from "@/components/dashboard/period-table";
import { tapHint, unitName } from "@/components/dashboard/overview-parts";
import type { SocialOverviewViewModel } from "@/features/social/overview";

/**
 * Todos os meses de rede social juntos, como na planilha de análise de dados: primeiro a tabela
 * mês a mês com as mesmas colunas; abaixo, os gráficos dessas colunas (nada calculado pelo portal).
 */
export function SocialOverview({ vm, periodHref }: { vm: SocialOverviewViewModel; periodHref: (periodKey: string) => string }) {
  const per = `por ${vm.unit.singular}`;
  /** "Curtidas, comentários e salvos": só o primeiro rótulo com maiúscula. */
  const names = (series: Array<{ label: string }>) => {
    const list = series.map((s, i) => (i ? lowerFirst(s.label) : s.label));
    return list.length > 1 ? `${list.slice(0, -1).join(", ")} e ${list.at(-1)}` : (list[0] ?? "");
  };
  const charts = [
    vm.growthSeries ? { key: "seguidores", title: `${names(vm.growthSeries)} ${per}`, series: vm.growthSeries, stacked: false } : null,
    vm.interactionSeries ? { key: "interacoes", title: `${names(vm.interactionSeries)} ${per}`, series: vm.interactionSeries, stacked: true } : null,
    vm.audienceSeries ? { key: "alcance", title: `${names(vm.audienceSeries)} ${per}`, series: vm.audienceSeries, stacked: false } : null,
  ].filter((c) => c !== null);

  return (
    <div className="space-y-8 sm:space-y-10">
      <Card id="periodo-a-periodo">
        <CardHeader title={`Análise de dados · ${vm.networkLabel}`} subtitle={`${vm.rangeLabel} · ${tapHint(vm.unit)}`} />
        <CardBody>
          <PeriodTable table={vm.table} currency="BRL" caption={`Resultados de ${vm.networkLabel} ${per}`} periodLabel={unitName(vm.unit)} href={periodHref} />
        </CardBody>
      </Card>

      {charts.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {charts.map((c, i) => (
            <Card key={c.key} className={charts.length % 2 === 1 && i === charts.length - 1 ? "lg:col-span-2" : undefined}>
              <CardHeader title={c.title} />
              <CardBody>
                <ComparisonColumns points={vm.points} series={c.series} currency="BRL" caption={c.title} stacked={c.stacked} />
              </CardBody>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
