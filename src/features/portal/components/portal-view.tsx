import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { env } from "@/lib/env";
import { formatTimestampDate } from "@/lib/dates/period";
import { LookLogo } from "@/components/brand/look-logo";
import { ClientAvatar } from "@/components/brand/client-avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { ReportViewer } from "@/components/dashboard/report-viewer";
import { InsightList } from "@/components/dashboard/insight-list";
import { DashboardSection } from "@/components/dashboard/section";
import { CommercialDashboard } from "@/features/commercial/components/commercial-dashboard";
import { buildCommercialViewModel } from "@/features/commercial/view-model";
import { TrafficDashboard } from "@/features/traffic/components/traffic-dashboard";
import { buildTrafficViewModel } from "@/features/traffic/view-model";
import type { PortalModel } from "@/features/portal/model";
import { PeriodSelector } from "./period-selector";
import { PortalTabs, TAB_LABEL } from "./portal-tabs";
import { HistoryList, OriginalDocuments, type PortalLinks } from "./portal-sections";

/**
 * Visão do cliente: produto de relatório, não painel administrativo.
 * Números em primeiro plano; navegação mínima (área + período).
 */
export function PortalView({ model, basePath, links, logoUrl, banner }: { model: PortalModel; basePath: string; links: PortalLinks; logoUrl?: string | null; banner?: ReactNode }) {
  const { client, selection } = model;
  const tz = env().APP_TIMEZONE;
  const greeting = client.greetingName || client.shortName;
  const tabLabel = TAB_LABEL[model.tab];
  const draftIds = new Set(model.archive.filter((e) => e.status === "draft").map((e) => e.id));

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pb-16 sm:px-6 lg:px-8">
      <a href="#conteudo" className="sr-only z-50 rounded-lg bg-primary px-4 py-2 font-semibold text-on-primary focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Pular para o conteúdo
      </a>
      <header className="flex items-center justify-between gap-4 pb-2 pt-5 sm:pt-7">
        <LookLogo wordmark width={76} className="sm:hidden" priority />
        <LookLogo width={112} className="hidden sm:block" priority />
        <div className="flex min-w-0 items-center gap-3">
          <div className="hidden min-w-0 text-right sm:block">
            <p className="truncate text-sm font-bold text-text">{client.name}</p>
            {client.segment ? <p className="truncate text-xs text-text-3">{client.segment}</p> : null}
          </div>
          <ClientAvatar name={client.name} logoUrl={logoUrl} size={40} />
        </div>
      </header>

      {banner}

      <div className="mt-5 flex flex-col gap-1 sm:mt-8">
        <h1 className="text-display font-bold text-text sm:text-[2.125rem]">Olá, {greeting}</h1>
        <p className="text-sm text-text-3">
          {model.lastUpdatedAt ? <>Dados atualizados em {formatTimestampDate(model.lastUpdatedAt, tz)}</> : "Aguardando o primeiro relatório"}
          <span className="sm:hidden"> · {client.shortName}</span>
        </p>
      </div>

      <div className="sticky top-0 z-20 -mx-4 mt-5 border-b border-border bg-[rgb(6_14_28/0.94)] px-4 py-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
          <PortalTabs tabs={model.tabs} active={model.tab} basePath={basePath} className="md:w-[320px]" />
          {model.tabs.length < 2 ? <p className="hidden text-sm font-bold text-text-2 md:block">{tabLabel}</p> : null}
          <PeriodSelector periods={model.periods} value={model.periodKey} className="md:w-[300px]" />
        </div>
      </div>

      <main className="mt-6 sm:mt-8" id="conteudo">
        {!model.tabs.length ? (
          <EmptyState icon={<Inbox />} title="Nenhuma área disponível" description="Assim que a Look ativar os relatórios, eles aparecerão aqui." />
        ) : !model.periods.length ? (
          <EmptyState icon={<Inbox />} title={`Ainda não há relatórios de ${tabLabel.toLowerCase()}`} description="Os relatórios aparecerão aqui assim que forem publicados pela equipe da Look." />
        ) : (
          <div className="space-y-8 sm:space-y-10">
            {selection.dataset ? (
              selection.dataset.data.type === "commercial" ? (
                <CommercialDashboard
                  vm={buildCommercialViewModel(selection.dataset.data.data, { previous: model.previous, history: model.history, dashboard: client.dashboard })}
                  insights={selection.insights}
                  currency={client.currency}
                />
              ) : (
                <TrafficDashboard vm={buildTrafficViewModel(selection.dataset.data.data, { previous: model.previous, history: model.history })} insights={selection.insights} currency={client.currency} />
              )
            ) : selection.documents[0] ? (
              <>
                <DashboardSection id="relatorio" title={selection.documents[0].title ?? "Relatório do período"}>
                  <ReportViewer
                    source={selection.documents[0].sourceType ?? "pdf"}
                    src={links.file(selection.documents[0].id)}
                    downloadHref={selection.documents[0].allowDownload ? links.file(selection.documents[0].id, true) : null}
                    title={selection.documents[0].title ?? "Relatório"}
                  />
                </DashboardSection>
                {selection.insights.length ? (
                  <DashboardSection id="insights" title="Insights da Look">
                    <InsightList insights={selection.insights} />
                  </DashboardSection>
                ) : null}
              </>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-2">
              <OriginalDocuments documents={selection.dataset ? selection.documents : selection.documents.slice(1)} dataset={selection.dataset?.entry ?? null} links={links} />
              <HistoryList entries={model.archive} current={model.periodKey} links={links} draftIds={model.mode === "preview" ? draftIds : undefined} />
            </div>
          </div>
        )}
      </main>

      <footer className="mt-16 flex flex-col items-center gap-3 border-t border-border pt-8 text-center">
        <LookLogo width={92} />
        <p className="text-xs text-text-3">Relatório preparado pela Look Assessoria de Comunicação para {client.name}.</p>
      </footer>
    </div>
  );
}
