import type { CommercialDashboardVM } from "@/features/commercial/dashboard";
import { ChannelsPanel } from "./channels-panel";
import { DimensionPanel } from "./dimension-panel";
import { InsightsPanel } from "./insights-panel";
import { OverviewPanel } from "./overview-panel";
import { SectionTabs, type SectionTab } from "./section-tabs";

/**
 * Painel comercial no modelo do dashboard da Serenity: Visão geral, Canais & ROI, uma
 * aba por detalhamento da planilha (Massagens, Terapeutas, Serviços…) e Insights.
 * Cada aba só aparece quando a planilha do cliente traz aquele dado.
 */
export function CommercialDashboard({ vm, currency, section, embedded = false }: { vm: CommercialDashboardVM; currency: string; section?: string | null; embedded?: boolean }) {
  const tabs: SectionTab[] = [{ key: "visao-geral", label: "Visão geral", content: <OverviewPanel vm={vm} currency={currency} /> }];
  if (vm.channels || vm.roi) {
    tabs.push({ key: "canais", label: vm.channels && vm.roi ? "Canais & ROI" : vm.channels ? "Canais" : "Retorno", content: <ChannelsPanel vm={vm} currency={currency} /> });
  }
  for (const d of vm.dimensions) {
    tabs.push({ key: tabs.some((t) => t.key === d.key) ? `detalhe-${d.key}` : d.key, label: d.label, content: <DimensionPanel dim={d} vm={vm} currency={currency} /> });
  }
  if (vm.insights.length || vm.comparison || vm.actionPlans.length || vm.tables.length) {
    tabs.push({ key: "insights", label: "Insights", content: <InsightsPanel vm={vm} currency={currency} /> });
  }
  return <SectionTabs tabs={tabs} initial={section} bleed={!embedded} />;
}
