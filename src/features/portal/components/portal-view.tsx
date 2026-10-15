import { LiveCommercialReport } from "@/features/commercial/live/report";

import type { ReactNode } from "react";
import Link from "next/link";
import { FileText, Inbox } from "lucide-react";
import { env } from "@/lib/env";
import { formatPeriod, formatPeriodRange, formatTimestampDate } from "@/lib/dates/period";
import { cn } from "@/lib/cn";
import { LookLogo } from "@/components/brand/look-logo";
import { ClientAvatar } from "@/components/brand/client-avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { ReportViewer } from "@/components/dashboard/report-viewer";
import { InsightList } from "@/components/dashboard/insight-list";
import { DashboardSection } from "@/components/dashboard/section";
import { CommercialDashboard } from "@/features/commercial/components/commercial-dashboard";
import { OriginalCommercialReport } from "@/features/commercial/components/original-commercial-report";
import { IsaborFaithfulReport } from "@/features/commercial/components/isabor-faithful-report";
import { LandimFaithfulReport } from "@/features/commercial/components/landim-faithful-report";
import { LarplanFaithfulReport } from "@/features/commercial/components/larplan-faithful-report";
import { isFullCommercialReport, isLandimOriginalReport, isLarplanOriginalReport } from "@/features/commercial/presentation";
import { buildCommercialDashboard, type CommercialDashboardVM } from "@/features/commercial/dashboard";
import { TrafficDashboard } from "@/features/traffic/components/traffic-dashboard";
import { buildTrafficViewModel } from "@/features/traffic/view-model";
import { TrafficOverview } from "@/features/traffic/components/traffic-overview";
import { buildTrafficOverview } from "@/features/traffic/overview";
import { MediaPlanDashboard } from "@/features/media-plan/components/media-plan-dashboard";
import { buildMediaPlanViewModel } from "@/features/media-plan/view-model";
import { SocialDashboard } from "@/features/social/components/social-dashboard";
import { buildSocialViewModel } from "@/features/social/view-model";
import { SocialOverview } from "@/features/social/components/social-overview";
import { buildSocialOverview } from "@/features/social/overview";
import type { PortalModel, PortalTab } from "@/features/portal/model";
import { PeriodNav, ScaleSwitch, YearSwitch } from "./period-nav";
import { PortalTabs, TAB_LABEL } from "./portal-tabs";
import { OriginalDocuments, type PortalLinks } from "./portal-sections";

/** Linha de apoio da faixa do topo: "Terapias e bem-estar · Dashboard comercial 2026". */
const AREA_TITLE: Record<PortalTab, string> = {
  commercial: "Dashboard comercial",
  traffic: "Tráfego pago",
  social: "Rede social",
  media_plan: "Plano de mídia",
};

/**
 * Visão do cliente: produto de relatório, não painel administrativo.
 * Faixa com a identidade do cliente, áreas e períodos logo abaixo e os números em primeiro plano.
 */
export function PortalView({ model, basePath, links, logoUrl, banner, section }: { model: PortalModel; basePath: string; links: PortalLinks; logoUrl?: string | null; banner?: ReactNode; section?: string | null }) {
  const { client, selection } = model;
  const landimOriginal = isLandimOriginalReport(client.slug, model.tab, model.periodKey);
  const larplanOriginal = isLarplanOriginalReport(client.slug, model.tab, model.periodKey);
  const fullCommercial = isFullCommercialReport(client.slug, model.tab, model.mode);
  const originalCommercial = fullCommercial && model.periodKey === "2026-09" ? (client.slug === "serenity-terapias" ? "serenity" : "isabor") : null;
  const tz = env().APP_TIMEZONE;
  const tabLabel = TAB_LABEL[model.tab];
  const periodItems = model.periods.map((p) => ({ key: p.key, label: p.short, title: p.label, href: links.period(p.key), draft: model.mode === "preview" && p.draft }));
  const scaleItems = (model.scales ?? []).map((s) => ({ key: s, label: s === "month" ? "Meses" : "Semanas", href: links.scale(s), active: s === model.scale }));
  const yearItems = (model.years ?? []).map((y) => ({ key: String(y), label: String(y), href: links.year(y), active: y === model.year }));

  // Painel comercial: o mês aberto em foco, com o acumulado do ano até ele.
  const commercial: CommercialDashboardVM | null =
    model.view === "period" && selection.dataset?.data.type === "commercial"
      ? buildCommercialDashboard({ history: model.history, previous: model.previous, data: selection.dataset.data.data, insights: selection.insights, dashboard: client.dashboard, periodHref: links.period })
      : null;

  const shown = model.view === "overview" && model.overview ? model.overview : selection.primary ? [selection.primary] : [];
  const live = model.liveCommercial;
  const chip = live ? `${live.months[0].label} – ${live.focus.label} / ${live.year}` : larplanOriginal ? "Junho – Agosto / 2026" : landimOriginal ? "Julho – Agosto / 2026" : commercial ? commercial.rangeShort : shown.length ? (shown.length > 1 ? formatPeriodRange(shown[0].period, shown[shown.length - 1].period) : formatPeriod(shown[0].period)) : null;
  const year = live?.year ?? (larplanOriginal ? 2026 : commercial?.year ?? (shown.length ? +shown[shown.length - 1].period.start.slice(0, 4) : null));
  const subtitle = [client.segment, `${AREA_TITLE[model.tab]}${year ? ` ${year}` : ""}`].filter(Boolean).join(" · ");
  // No comercial, quem fica fixo no topo ao rolar são as abas do painel.
  const stickyBar = !commercial && !larplanOriginal && !live;

  return (
    <div className="w-full pb-16">
      <a href="#conteudo" className="sr-only z-50 rounded-lg bg-primary px-4 py-2 font-semibold text-on-primary focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Pular para o conteúdo
      </a>
      <header className="relative overflow-hidden" style={{ background: "var(--hero-gradient)" }}>
        <div className="pointer-events-none absolute -right-24 -top-32 size-80 rounded-full bg-[radial-gradient(circle,rgb(0_174_239/0.22),transparent_65%)]" aria-hidden />
        <div className="relative mx-auto flex w-full max-w-[1400px] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
          <div className="flex min-w-0 items-center gap-3.5">
            {logoUrl ? <ClientAvatar name={client.name} logoUrl={logoUrl} size={42} className="ring-2 ring-white/15" /> : null}
            <div className="min-w-0">
              <h1 className="truncate text-[17px] font-bold uppercase leading-none tracking-[0.28em] text-white sm:text-lg">{client.shortName}</h1>
              <p className="mt-1.5 truncate text-[9.5px] font-medium uppercase tracking-[0.22em] text-white/60 sm:text-[10px]">{subtitle}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {chip ? <span className="whitespace-nowrap rounded-full border border-white/20 bg-white/10 px-3.5 py-1 text-[11px] font-medium text-white/85 sm:px-4">{chip}</span> : null}
            <LookLogo wordmark width={64} className="opacity-95 sm:hidden" priority />
            <LookLogo width={88} className="hidden opacity-95 sm:block" priority />
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8">
        {banner}

        <p className="pt-4 text-[13px] text-text-2">
          Olá, <strong className="font-bold text-text">{client.greetingName || client.shortName}</strong>
          <span className="text-text-3"> · {larplanOriginal && !live ? "dados de junho a agosto de 2026" : model.lastUpdatedAt ? <>dados atualizados em {formatTimestampDate(model.lastUpdatedAt, tz)}</> : "aguardando o primeiro relatório"}</span>
        </p>

        <div className={cn("-mx-4 border-b border-border px-4 py-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8", stickyBar && "sticky top-0 z-20 bg-[rgb(6_14_28/0.94)]")}>
          <div className={model.tabs.length > 3 ? "flex flex-col gap-2.5 lg:flex-row lg:items-center lg:gap-4" : "flex flex-col gap-2.5 md:flex-row md:items-center md:gap-4"}>
            <PortalTabs tabs={model.tabs} active={model.tab} basePath={basePath} className={tabsWidth(model.tabs)} />
            {commercial && model.tabs.length < 2 && !fullCommercial ? <p className="hidden shrink-0 text-[11px] font-bold uppercase tracking-[0.16em] text-text-3 md:block">{commercial.unit.singular === "mês" ? "Mês em foco" : "Período em foco"}</p> : null}
            <div className="flex min-w-0 gap-2 md:flex-1">
              <ScaleSwitch options={scaleItems} />
              <YearSwitch options={yearItems} />
              {!fullCommercial ? <PeriodNav overviewHref={model.overview ? links.overview : null} items={periodItems} active={model.periodKey} className="min-w-0 flex-1" /> : (
                <div className="flex min-h-9 items-center text-xs font-semibold text-text-2">
                  Relatório consolidado · histórico mensal nas tabelas e gráficos
                </div>
              )}
            </div>
          </div>
        </div>

        <main className={commercial || larplanOriginal ? "mt-0" : "mt-6 sm:mt-8"} id="conteudo">
          {!model.tabs.length ? (
            <EmptyState icon={<Inbox />} title="Nenhuma área disponível" description="Assim que a Look ativar os relatórios, eles aparecerão aqui." />
          ) : !model.periods.length ? (
            <EmptyState
              icon={<Inbox />}
              title={model.tab === "media_plan" ? "Ainda não há plano de mídia publicado" : model.tab === "social" ? "Ainda não há relatórios de rede social" : `Ainda não há relatórios de ${tabLabel.toLowerCase()}`}
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
              {model.tab === "social" ? (
                <SocialOverview vm={buildSocialOverview(model.overview, { current: !model.years || model.year === model.years[model.years.length - 1] })} periodHref={links.period} />
              ) : (
                <TrafficOverview vm={buildTrafficOverview(model.overview, client.currency)} currency={client.currency} periodHref={links.period} />
              )}
            </div>
          ) : (
            <div className="space-y-8 sm:space-y-10">
              {live ? (
                <LiveCommercialReport report={live} />
              ) : larplanOriginal ? (
                <LarplanFaithfulReport logoUrl={logoUrl} />
              ) : landimOriginal ? (
                <LandimFaithfulReport />
              ) : originalCommercial === "isabor" ? (
                <IsaborFaithfulReport />
              ) : originalCommercial ? (
                <OriginalCommercialReport client={originalCommercial} />
              ) : commercial ? (
                <CommercialDashboard vm={commercial} currency={client.currency} section={section} />
              ) : selection.dataset ? (
                selection.dataset.data.type === "social" ? (
                  <SocialDashboard vm={buildSocialViewModel(selection.dataset.data.data, { previous: model.previous, history: model.history })} insights={selection.insights} />
                ) : selection.dataset.data.type === "media_plan" ? (
                  <MediaPlanDashboard
                    vm={buildMediaPlanViewModel(selection.dataset.data.data, { previous: model.previous, history: model.history, actual: model.relatedTraffic, today: model.today })}
                    insights={selection.insights}
                    currency={client.currency}
                    trafficEnabled={client.modules.traffic.enabled}
                  />
                ) : selection.dataset.data.type === "traffic" ? (
                  <TrafficDashboard vm={buildTrafficViewModel(selection.dataset.data.data, { previous: model.previous, history: model.history })} insights={selection.insights} currency={client.currency} />
                ) : null
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
          <p className="text-[11px] uppercase tracking-[0.14em] text-text-3">
            {client.name} · {AREA_TITLE[model.tab]}
            {chip ? ` · ${chip}` : ""}
          </p>
          <p className="text-xs text-text-3">Relatório preparado pela Look Assessoria de Comunicação para {client.name}.</p>
        </footer>
      </div>
    </div>
  );
}

/** Largura do seletor de áreas no desktop, conforme a quantidade e o tamanho dos rótulos. */
function tabsWidth(tabs: PortalModel["tabs"]): string {
  if (tabs.length > 3) return "lg:w-[560px] lg:shrink-0";
  if (tabs.length > 2) return "md:w-[420px] md:shrink-0";
  return tabs.includes("media_plan") || tabs.includes("social") ? "md:w-[340px] md:shrink-0" : "md:w-[280px] md:shrink-0";
}
