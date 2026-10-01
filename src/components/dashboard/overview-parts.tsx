import type { PeriodUnit } from "@/lib/dates/period";
import { DashboardSection } from "@/components/dashboard/section";
import { MetricCard } from "@/components/dashboard/metric-card";
import { KpiIcon } from "@/components/dashboard/kpi-icon";
import type { KpiView } from "@/features/commercial/view-model";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Mês", "Semana", "Período". */
export function unitName(unit: PeriodUnit): string {
  return cap(unit.singular);
}

/** "Mês a mês", "Semana a semana". */
export function unitByUnit(unit: PeriodUnit): string {
  return `${cap(unit.singular)} a ${unit.singular}`;
}

/** "Toque em um mês…", "Toque em uma semana…". */
export function tapHint(unit: PeriodUnit): string {
  return `Toque em ${unit.feminine ? "uma" : "um"} ${unit.singular} para ver o relatório completo.`;
}

/** Cabeçalho da visão geral: intervalo, frase-resumo e indicadores somados. */
export function OverviewSummary({ headline, kpis, secondary, currency }: { headline: string; kpis: KpiView[]; secondary: KpiView[]; currency: string }) {
  return (
    <DashboardSection id="visao-geral" title="Visão geral" description={headline}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <MetricCard key={k.key} label={k.label} value={k.value} format={k.format} currency={currency} trend={k.trend} icon={<KpiIcon name={k.icon} />} description={k.description} footnote={k.footnote} />
        ))}
      </div>
      {secondary.length ? (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {secondary.map((k) => (
            <MetricCard key={k.key} size="compact" label={k.label} value={k.value} format={k.format} currency={currency} description={k.description} footnote={k.footnote} />
          ))}
        </div>
      ) : null}
    </DashboardSection>
  );
}
