import type { ReactNode } from "react";
import Link from "next/link";
import { FileText, Inbox } from "lucide-react";
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
import { CommercialOverview } from "@/features/commercial/components/commercial-overview";
import { buildCommercialOverview } from "@/features/commercial/overview";
import { TrafficOverview } from "@/features/traffic/components/traffic-overview";
import { buildTrafficOverview } from "@/features/traffic/overview";
import { MediaPlanDashboard } from "@/features/media-plan/components/media-plan-dashboard";
import { buildMediaPlanViewModel } from "@/features/media-plan/view-model";
import type { PortalModel } from "@/features/portal/model";
import { PeriodNav, ScaleSwitch } from "./period-nav";
import { PortalTabs, TAB_LABEL } from "./portal-tabs";
import { OriginalDocuments, type PortalLinks } from "./portal-sections";

/**
 * Visão do cliente: produto de relatório, não painel administrativo.
 * Números em primeiro plano; navegação mínima (área + visão geral/período).
 */
export function PortalView({ model, basePath, links, logoUrl, banner }: { model: PortalModel; basePath: string; links: PortalLinks; logoUrl?: string | null; banner?: ReactNode }) {
  const { client, selection } = model;
  const tz = env().APP_TIMEZONE;
  const greeting = client.greetingName || client.shortName;
  const tabLabel = TAB_LABEL[model.tab];
  const periodItems = model.periods.map((p) => ({ key: p.key, label: p.short, title: p.label, href: links.period(p.key), draft: model.mode === "preview" && p.draft }));
  const scaleItems = (model.scales ?? []).map((s) => ({ key: s, label: s === "month" ? "Meses" : "Semanas", href: links.scale(s), active: s === model.scale }));

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
        <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:gap-4">
          <PortalTabs tabs={model.tabs} active={model.tab} basePath={basePath} className={model.tabs.length > 2 ? "md:w-[420px] md:shrink-0" : model.tabs.includes("media_plan") ? "md:w-[340px] md:shrink-0" : "md:w-[280px] md:shrink-0"} />
          {model.tabs.length < 2 ? <p className="hidden shrink-0 text-sm font-bold text-text-2 md:block">{tabLabel}</p> : null}
          <div className="flex min-w-0 gap-2 md:flex-1">
            <ScaleSwitch options={scaleItems} />
            <PeriodNav overviewHref={model.overview ? links.overview : null} items={periodItems} active={model.periodKey} className="min-w-0 flex-1" />
          </div>
        </div>
      </div>

      <main className="mt-6 sm:mt-8" id="conteudo">
        {!model.tabs.length ? (
          <EmptyState icon={<Inbox />} title="Nenhuma área disponível" description="Assim que a Look ativar os relatórios, eles aparecerão aqui." />
        ) : !model.periods.length ? (
          <EmptyState
            icon={<Inbox />}
            title={model.tab === "media_plan" ? "Ainda não há plano de mídia publicado" : `Ainda não há relatórios de ${tabLabel.toLowerCase()}`}
            description={model.tab === "media_plan" ? "O plano do mês aparecerá aqui assim que for publicado pela equipe da Look." : "Os relatórios aparecerão aqui assim que forem publicados pela equipe da Look."}
          />
        ) : model.view === "overview" && model.overview ? (
          <div className="space-y-6">
            {model.latestDocumentOnly ? (
              <Link
                href={links.period(model.latestDocumentOnly.key)}
                className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[rgb(140_156_248/0.25)] bg-info-soft px-4 py-3 text-sm text-text-2 hover:brightness-110"
              >
                <FileText className="size-5 shrink-0 text-info" aria-hidden />
                <span className="min-w-0 flex-1">
                  <strong className="text-text">{model.latestDocumentOnly.label}</strong> já está disponível como relatório em documento e ainda não entra nos números abaixo.
                </span>
                <span className="shrink-0 font-semibold text-info">Abrir →</span>
              </Link>
            ) : null}
            {model.tab === "traffic" ? (
              <TrafficOverview vm={buildTrafficOverview(model.overview, client.currency)} currency={client.currency} periodHref={links.period} />
            ) : (
              <CommercialOverview vm={buildCommercialOverview(model.overview, { dashboard: client.dashboard, currency: client.currency })} currency={client.currency} periodHref={links.period} />
            )}
          </div>
        ) : (
          <div className="space-y-8 sm:space-y-10">
            {selection.dataset ? (
              selection.dataset.data.type === "commercial" ? (
                <CommercialDashboard
                  vm={buildCommercialViewModel(selection.dataset.data.data, { previous: model.previous, history: model.history, dashboard: client.dashboard })}
                  insights={selection.insights}
                  currency={client.currency}
                />
              ) : selection.dataset.data.type === "media_plan" ? (
                <MediaPlanDashboard
                  vm={buildMediaPlanViewModel(selection.dataset.data.data, { previous: model.previous, history: model.history, actual: model.relatedTraffic, today: model.today })}
                  insights={selection.insights}
                  currency={client.currency}
                  trafficEnabled={client.modules.traffic.enabled}
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
