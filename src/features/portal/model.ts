import "server-only";
import { env } from "@/lib/env";
import { comparePeriods, formatPeriod, monthPeriod, periodSeriesLabels, previousPeriod, periodKey as keyOf, todayISO, type Period } from "@/lib/dates/period";
import type { Client } from "@/features/clients/schema";
import { getClientIndex } from "@/features/clients/service";
import { getReportData, getReportManifest, type ReportData } from "@/features/reports/service";
import { REPORT_TYPES, reportTypeFromParam, type Insight, type ReportIndexEntry, type ReportManifest, type ReportStatus, type ReportType } from "@/features/reports/schema";

export type PortalTab = ReportType;

/** "overview": todos os períodos juntos; "period": um período específico. */
export type PortalView = "overview" | "period";

/**
 * Escala da navegação: meses ou semanas. Só há escolha quando a área tem as duas
 * (ex.: tráfego semanal + meses anteriores enviados como retroativo) — o portal
 * nunca mistura meses e semanas na mesma visão geral ou comparação.
 */
export type PortalScale = "month" | "week";

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
  /** Escalas disponíveis na área (null = uma só, sem seletor). */
  scales: PortalScale[] | null;
  scale: PortalScale;
  /** Períodos com relatório na escala atual, em ordem cronológica (abas de período). */
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
  /** Plano de mídia: relatório de tráfego do mesmo mês (planejado × realizado). */
  relatedTraffic: ReportIndexEntry | null;
  today: string;
  lastUpdatedAt: string | null;
  mode: "client" | "preview";
}

const HISTORY_POINTS: Record<ReportType, number> = { commercial: 12, traffic: 8, media_plan: 12 };
/** A visão geral reúne até 12 períodos (um ano, para relatórios mensais). */
const OVERVIEW_POINTS = 12;

export interface LoadPortalOptions {
  tab?: string | null;
  period?: string | null;
  /** "meses" | "semanas" (ou month/week). */
  scale?: string | null;
  mode: "client" | "preview";
  /** Prévia de um relatório específico no ADM (inclui rascunho/retirado). */
  focusReportId?: string | null;
}

const scaleOf = (p: Period): PortalScale => (p.granularity === "week" ? "week" : "month");

export function scaleFromParam(value: string | null | undefined): PortalScale | null {
  if (value === "semanas" || value === "week") return "week";
  if (value === "meses" || value === "month") return "month";
  return null;
}

export const SCALE_PARAM: Record<PortalScale, string> = { month: "meses", week: "semanas" };

export async function loadPortalModel(client: Client, options: LoadPortalOptions): Promise<PortalModel> {
  const index = await getClientIndex(client.id);
  const today = todayISO(env().APP_TIMEZONE);
  const visibleStatuses: ReadonlySet<ReportStatus> = options.mode === "preview" ? new Set(["published", "draft"]) : new Set(["published"]);
  const focus = options.focusReportId ? index.reports.find((r) => r.id === options.focusReportId) ?? null : null;
  const visible = (r: ReportIndexEntry) => visibleStatuses.has(r.status) || r.id === focus?.id;

  const tabs = REPORT_TYPES.filter((t) => client.modules[t].enabled);
  const requestedTab = focus?.type ?? reportTypeFromParam(options.tab);
  const tab: PortalTab = requestedTab && tabs.includes(requestedTab) ? requestedTab : (tabs[0] ?? "commercial");

  const pickDataset = (list: ReportIndexEntry[]) => {
    if (focus?.kind === "dataset" && list.some((r) => r.id === focus.id)) return focus;
    const datasets = list.filter((r) => r.kind === "dataset");
    // Prévia do ADM: a versão mais nova do período (o rascunho que vai ser publicado), mesmo que já exista uma publicada.
    if (options.mode === "preview") return datasets.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0] ?? null;
    return datasets.sort((a, b) => statusRank(a.status) - statusRank(b.status) || (a.updatedAt < b.updatedAt ? 1 : -1))[0] ?? null;
  };

  const allEntries = index.reports.filter((r) => r.type === tab && visible(r));

  // Escala: a do período pedido (ou do relatório em foco); senão a periodicidade do cliente, se houver relatórios nela.
  const available = [...new Set(allEntries.map((e) => scaleOf(e.period)))];
  const cadenceScale: PortalScale = client.modules[tab].cadence === "weekly" ? "week" : "month";
  const requestedEntry = focus ?? (options.period ? allEntries.find((e) => e.periodKey === options.period) : undefined);
  const requestedScale = requestedEntry ? scaleOf(requestedEntry.period) : scaleFromParam(options.scale);
  const scale: PortalScale = requestedScale && available.includes(requestedScale) ? requestedScale : available.includes(cadenceScale) ? cadenceScale : (available[0] ?? cadenceScale);
  const scales = available.length > 1 ? (["month", "week"] as const).filter((s) => available.includes(s)) : null;

  const entries = allEntries.filter((e) => scaleOf(e.period) === scale);
  const byPeriod = new Map<string, ReportIndexEntry[]>();
  for (const e of entries) byPeriod.set(e.periodKey, [...(byPeriod.get(e.periodKey) ?? []), e]);

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
  // Visão geral nunca mistura meses com semanas (nem com intervalos personalizados).
  const overviewGranularity = datasetSeries.some((e) => e.period.granularity === scale) ? scale : datasetSeries.at(-1)?.period.granularity;
  const overviewSeries = datasetSeries.filter((e) => e.period.granularity === overviewGranularity);
  // O plano de mídia não tem visão geral: abre sempre um mês.
  const overview = !focus && tab !== "media_plan" && overviewSeries.length >= 2 ? overviewSeries.slice(-OVERVIEW_POINTS) : null;
  const lastPeriod = periodEntries.at(-1) ?? null;
  const latestDocumentOnly =
    overview && lastPeriod && !(byPeriod.get(lastPeriod.periodKey) ?? []).some((r) => r.kind === "dataset") && lastPeriod.period.start > overview[overview.length - 1].period.start ? (periods.at(-1) ?? null) : null;

  // Sem período pedido, abre a visão geral — ou o período mais recente, quando não há visão geral.
  // Plano de mídia: o plano do mês corrente, quando existe.
  const requestedKey = options.period && byPeriod.has(options.period) ? options.period : null;
  const currentPlanKey = tab === "media_plan" ? keyOf(monthPeriod(+today.slice(0, 4), +today.slice(5, 7))) : null;
  const defaultKey = currentPlanKey && byPeriod.has(currentPlanKey) ? currentPlanKey : (periods.at(-1)?.key ?? null);
  const view: PortalView = focus || requestedKey || !overview ? "period" : "overview";
  const selectedKey = view === "overview" ? null : (focus?.periodKey ?? requestedKey ?? defaultKey);
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

  // Planejado × realizado: o tráfego publicado (ou, na prévia, o mais novo) do mesmo mês do plano.
  const relatedTraffic =
    tab === "media_plan" && datasetEntry && client.modules.traffic.enabled
      ? pickDataset(index.reports.filter((r) => r.type === "traffic" && r.periodKey === datasetEntry.periodKey && (visibleStatuses.has(r.status))))
      : null;

  const publishedTimes = allEntries.map((r) => r.publishedAt ?? r.updatedAt).sort();

  return {
    client,
    tabs,
    tab,
    view,
    scales: scales ? [...scales] : null,
    scale,
    periods,
    periodKey: selectedKey,
    overview,
    latestDocumentOnly,
    selection: { dataset, documents, insights, primary, primaryManifest },
    previous,
    history,
    relatedTraffic,
    today,
    lastUpdatedAt: publishedTimes.at(-1) ?? null,
    mode: options.mode,
  };
}

function statusRank(status: ReportStatus): number {
  return status === "published" ? 0 : status === "draft" ? 1 : 2;
}
