import "server-only";
import { comparePeriods, formatPeriod, periodSeriesLabels, previousPeriod, periodKey as keyOf } from "@/lib/dates/period";
import type { Client } from "@/features/clients/schema";
import { getClientIndex } from "@/features/clients/service";
import { getReportData, getReportManifest, type ReportData } from "@/features/reports/service";
import type { Insight, ReportIndexEntry, ReportManifest, ReportStatus, ReportType } from "@/features/reports/schema";

export type PortalTab = ReportType;

/** "overview": todos os períodos juntos; "period": um período específico. */
export type PortalView = "overview" | "period";

export interface PortalPeriodOption {
  key: string;
  /** Por extenso: "Agosto de 2026". */
  label: string;
  /** Aba: "Ago", "Ago/26", "21/09". */
  short: string;
  /** Só aparece na prévia do ADM: o período ainda está em rascunho. */
  draft: boolean;
}

export interface PortalSelection {
  dataset: { entry: ReportIndexEntry; manifest: ReportManifest; data: ReportData } | null;
  documents: ReportIndexEntry[];
  insights: Insight[];
  /** Relatório de referência para datas e textos (dataset ou, na falta, o primeiro documento). */
  primary: ReportIndexEntry | null;
  primaryManifest: ReportManifest | null;
}

export interface PortalModel {
  client: Client;
  tabs: PortalTab[];
  tab: PortalTab;
  view: PortalView;
  /** Períodos com relatório, em ordem cronológica (abas de período). */
  periods: PortalPeriodOption[];
  /** Período aberto (null na visão geral). */
  periodKey: string | null;
  /** Relatórios de dados da visão geral (ordem cronológica); null quando há menos de 2 períodos. */
  overview: ReportIndexEntry[] | null;
  /** Período mais recente que só tem documento (PDF/HTML) e por isso fica fora da visão geral. */
  latestDocumentOnly: PortalPeriodOption | null;
  selection: PortalSelection;
  /** Período anterior com dados, para comparações (só usa o resumo do índice). */
  previous: ReportIndexEntry | null;
  /** Série histórica (ordem cronológica) até o período selecionado. */
  history: ReportIndexEntry[];
  lastUpdatedAt: string | null;
  mode: "client" | "preview";
}

const HISTORY_POINTS: Record<ReportType, number> = { commercial: 12, traffic: 8 };
/** A visão geral reúne até 12 períodos (um ano, para relatórios mensais). */
const OVERVIEW_POINTS = 12;

export interface LoadPortalOptions {
  tab?: string | null;
  period?: string | null;
  mode: "client" | "preview";
  /** Prévia de um relatório específico no ADM (inclui rascunho/retirado). */
  focusReportId?: string | null;
}

export async function loadPortalModel(client: Client, options: LoadPortalOptions): Promise<PortalModel> {
  const index = await getClientIndex(client.id);
  const visibleStatuses: ReadonlySet<ReportStatus> = options.mode === "preview" ? new Set(["published", "draft"]) : new Set(["published"]);
  const focus = options.focusReportId ? index.reports.find((r) => r.id === options.focusReportId) ?? null : null;
  const visible = (r: ReportIndexEntry) => visibleStatuses.has(r.status) || r.id === focus?.id;

  const tabs = (["commercial", "traffic"] as const).filter((t) => client.modules[t].enabled);
  const requestedTab = focus?.type ?? (options.tab === "trafego" || options.tab === "traffic" ? "traffic" : options.tab === "comercial" || options.tab === "commercial" ? "commercial" : null);
  const tab: PortalTab = requestedTab && tabs.includes(requestedTab) ? requestedTab : (tabs[0] ?? "commercial");

  const entries = index.reports.filter((r) => r.type === tab && visible(r));
  const byPeriod = new Map<string, ReportIndexEntry[]>();
  for (const e of entries) byPeriod.set(e.periodKey, [...(byPeriod.get(e.periodKey) ?? []), e]);

  const pickDataset = (list: ReportIndexEntry[]) => {
    if (focus?.kind === "dataset" && list.some((r) => r.id === focus.id)) return focus;
    const datasets = list.filter((r) => r.kind === "dataset");
    // Prévia do ADM: a versão mais nova do período (o rascunho que vai ser publicado), mesmo que já exista uma publicada.
    if (options.mode === "preview") return datasets.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0] ?? null;
    return datasets.sort((a, b) => statusRank(a.status) - statusRank(b.status) || (a.updatedAt < b.updatedAt ? 1 : -1))[0] ?? null;
  };

  const periodEntries = [...byPeriod.values()].map((list) => pickDataset(list) ?? list[0]).sort((a, b) => comparePeriods(a.period, b.period));
  const shortLabels = periodSeriesLabels(periodEntries.map((e) => e.period));
  const periods: PortalPeriodOption[] = periodEntries.map((e, i) => ({
    key: e.periodKey,
    label: formatPeriod(e.period),
    short: shortLabels[i].axis,
    draft: (byPeriod.get(e.periodKey) ?? []).every((r) => r.status === "draft"),
  }));

  // Série histórica, comparação e visão geral usam apenas o índice (sem abrir outros data.json).
  const datasetSeries = [...byPeriod.values()]
    .map((list) => pickDataset(list))
    .filter((e): e is ReportIndexEntry => e !== null)
    .sort((a, b) => comparePeriods(a.period, b.period));
  // Visão geral e comparações nunca misturam meses com semanas: vale a periodicidade do cliente
  // (ou, se não houver relatórios nela, a do relatório mais recente).
  const cadenceGranularity = client.modules[tab].cadence === "weekly" ? "week" : "month";
  const overviewGranularity = datasetSeries.some((e) => e.period.granularity === cadenceGranularity) ? cadenceGranularity : datasetSeries.at(-1)?.period.granularity;
  const overviewSeries = datasetSeries.filter((e) => e.period.granularity === overviewGranularity);
  const overview = !focus && overviewSeries.length >= 2 ? overviewSeries.slice(-OVERVIEW_POINTS) : null;
  const lastPeriod = periodEntries.at(-1) ?? null;
  const latestDocumentOnly =
    overview && lastPeriod && !(byPeriod.get(lastPeriod.periodKey) ?? []).some((r) => r.kind === "dataset") && lastPeriod.period.start > overview[overview.length - 1].period.start ? (periods.at(-1) ?? null) : null;

  // Sem período pedido, abre a visão geral — ou o período mais recente, quando não há visão geral.
  const requestedKey = options.period && byPeriod.has(options.period) ? options.period : null;
  const view: PortalView = focus || requestedKey || !overview ? "period" : "overview";
  const selectedKey = view === "overview" ? null : (focus?.periodKey ?? requestedKey ?? periods.at(-1)?.key ?? null);
  const inPeriod = selectedKey ? (byPeriod.get(selectedKey) ?? []) : [];

  const datasetEntry = pickDataset(inPeriod);
  const documents = inPeriod.filter((r) => r.kind === "document").sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  let dataset: PortalSelection["dataset"] = null;
  let primaryManifest: ReportManifest | null = null;
  if (datasetEntry) {
    const manifest = await getReportManifest(client.id, datasetEntry.id);
    const data = manifest ? await getReportData(manifest) : null;
    if (manifest && data) dataset = { entry: datasetEntry, manifest, data };
    primaryManifest = manifest;
  }
  const primary = dataset?.entry ?? documents[0] ?? null;
  if (!primaryManifest && primary) primaryManifest = await getReportManifest(client.id, primary.id);

  // Insights: do relatório de dados; se não houver, dos documentos do período.
  let insights: Insight[] = dataset?.manifest.insights ?? [];
  if (!insights.length && documents.length) {
    const docManifests = await Promise.all(documents.map((d) => getReportManifest(client.id, d.id)));
    insights = docManifests.flatMap((m) => m?.insights ?? []);
  }

  // Histórico e comparação só com períodos do mesmo tipo do aberto (mês com mês, semana com semana).
  const sameKind = datasetEntry ? datasetSeries.filter((e) => e.period.granularity === datasetEntry.period.granularity) : [];
  const selectedIdx = datasetEntry ? sameKind.findIndex((e) => e.periodKey === datasetEntry.periodKey) : -1;
  const history = selectedIdx >= 0 ? sameKind.slice(Math.max(0, selectedIdx - HISTORY_POINTS[tab] + 1), selectedIdx + 1) : [];

  let previous: ReportIndexEntry | null = null;
  if (datasetEntry && selectedIdx > 0) {
    const expectedPrev = keyOf(previousPeriod(datasetEntry.period));
    previous = sameKind.find((e) => e.periodKey === expectedPrev) ?? sameKind[selectedIdx - 1];
  }

  const publishedTimes = index.reports
    .filter((r) => r.type === tab && visible(r))
    .map((r) => r.publishedAt ?? r.updatedAt)
    .sort();

  return {
    client,
    tabs,
    tab,
    view,
    periods,
    periodKey: selectedKey,
    overview,
    latestDocumentOnly,
    selection: { dataset, documents, insights, primary, primaryManifest },
    previous,
    history,
    lastUpdatedAt: publishedTimes.at(-1) ?? null,
    mode: options.mode,
  };
}

function statusRank(status: ReportStatus): number {
  return status === "published" ? 0 : status === "draft" ? 1 : 2;
}
