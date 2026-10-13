import type { CommercialDashboardVM } from "@/features/commercial/dashboard";
import { unplacedNotes } from "@/features/commercial/notes";
import { ChannelsPanel } from "./channels-panel";
import { DimensionPanel } from "./dimension-panel";
import { FunnelComparativo, FunnelDiagnostico, FunnelOverview, FunnelRoi } from "./funnel-layout";
import { InsightsPanel } from "./insights-panel";
import { OverviewPanel } from "./overview-panel";
import { FocusBanner } from "./parts";
import { SectionTabs, type SectionTab } from "./section-tabs";

/**
 * Painel comercial em dois modelos, com os mesmos dados:
 * - "detalhamentos" (dashboard da Serenity): Visão geral, Canais & ROI, uma aba por
 *   detalhamento (Massagens, Terapeutas…) e Insights;
 * - "funil" (dashboard da Dra. Isabor): Visão geral com o funil do mês, Comparativo
 *   mensal, ROI & Canais e Diagnóstico.
 * Cada aba só aparece quando a planilha do cliente traz aquele dado.
 */
export function CommercialDashboard({ vm, currency, section, embedded = false }: { vm: CommercialDashboardVM; currency: string; section?: string | null; embedded?: boolean }) {
  const dimensionTabs = (tabs: SectionTab[]) =>
    vm.dimensions.map((d) => ({ key: tabs.some((t) => t.key === d.key) ? `detalhe-${d.key}` : d.key, label: d.label, content: <DimensionPanel dim={d} vm={vm} currency={currency} /> }));
  const hasLooseNotes = unplacedNotes(vm.notes, vm.layout, vm.dimensions.map((d) => d.label)).length > 0;

  if (vm.layout === "funil" && vm.funnelView) {
    const fv = vm.funnelView;
    const tabs: SectionTab[] = [
      { key: "visao-geral", label: "Visão geral", content: <FunnelOverview vm={vm} fv={fv} currency={currency} /> },
      { key: "comparativo", label: "Comparativo mensal", content: <FunnelComparativo vm={vm} fv={fv} currency={currency} /> },
    ];
    if (fv.roi || vm.channelTables.length) tabs.push({ key: "canais", label: "ROI & Canais", content: <FunnelRoi vm={vm} fv={fv} currency={currency} /> });
    tabs.push(...dimensionTabs(tabs));
    tabs.push({ key: "insights", label: "Diagnóstico", content: <FunnelDiagnostico vm={vm} fv={fv} currency={currency} /> });
    return (
      <div>
        <div className="pb-6 pt-6 sm:pt-8">
          <FocusBanner label={vm.unit.singular === "mês" ? "Mês em foco" : "Em foco"} title={vm.focus.title} kpis={fv.banner} currency={currency} suffix={vm.focus.previousName ? `vs ${vm.focus.previousName.slice(0, 3)}` : null} />
          {vm.focus.note ? (
            <p className="mt-2.5 text-xs leading-relaxed text-text-3">
              <strong className="text-text-2">{vm.focus.note.title}.</strong> {vm.focus.note.description}
            </p>
          ) : null}
        </div>
        <SectionTabs tabs={tabs} initial={section} bleed={!embedded} />
      </div>
    );
  }

  const tabs: SectionTab[] = [{ key: "visao-geral", label: "Visão geral", content: <OverviewPanel vm={vm} currency={currency} /> }];
  if (vm.channels || vm.roi || vm.channelTables.length) {
    tabs.push({ key: "canais", label: vm.channels && vm.roi ? "Canais & ROI" : vm.channels ? "Canais" : "Retorno", content: <ChannelsPanel vm={vm} currency={currency} /> });
  }
  tabs.push(...dimensionTabs(tabs));
  if (vm.insights.length || vm.comparison || vm.actionPlans.length || vm.opportunities.length || vm.tables.length || hasLooseNotes) {
    tabs.push({ key: "insights", label: "Insights", content: <InsightsPanel vm={vm} currency={currency} /> });
  }
  return <SectionTabs tabs={tabs} initial={section} bleed={!embedded} />;
}
