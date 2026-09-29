import "server-only";
import { comparePeriods, formatPeriod, previousPeriod, periodKey as keyOf } from "@/lib/dates/period";
import type { Client } from "@/features/clients/schema";
import { getClientIndex } from "@/features/clients/service";
import { getReportData, getReportManifest, type ReportData } from "@/features/reports/service";
import type { Insight, ReportIndexEntry, ReportManifest, ReportStatus, ReportType } from "@/features/reports/schema";

export type PortalTab = ReportType;

export interface PortalPeriodOption {
  key: string;
  label: string;
  short: string;
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
  periods: PortalPeriodOption[];
  periodKey: string | null;
  selection: PortalSelection;
  /** Período anterior com dados, para comparações (só usa o resumo do índice). */
  previous: ReportIndexEntry | null;
  /** Um relatório de referência por período (mais recente primeiro) — lista "Histórico". */
  archive: ReportIndexEntry[];
  /** Série histórica (ordem cronológica) até o período selecionado. */
  history: ReportIndexEntry[];
  lastUpdatedAt: string | null;
  mode: "client" | "preview";
}

const HISTORY_POINTS: Record<ReportType, number> = { commercial: 12, traffic: 8 };

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

  const periodEntries = [...byPeriod.values()].map((list) => list[0]).sort((a, b) => -comparePeriods(a.period, b.period));
  const periods: PortalPeriodOption[] = periodEntries.map((e) => ({ key: e.periodKey, label: formatPeriod(e.period), short: formatPeriod(e.period, "short") }));

  const selectedKey = focus?.periodKey ?? (options.period && byPeriod.has(options.period) ? options.period : (periods[0]?.key ?? null));
  const inPeriod = selectedKey ? (byPeriod.get(selectedKey) ?? []) : [];

  const pickDataset = (list: ReportIndexEntry[]) => {
    if (focus?.kind === "dataset" && list.some((r) => r.id === focus.id)) return focus;
    return list.filter((r) => r.kind === "dataset").sort((a, b) => statusRank(a.status) - statusRank(b.status) || (a.updatedAt < b.updatedAt ? 1 : -1))[0] ?? null;
  };
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

  // Série histórica e comparação usam apenas o índice (sem abrir outros data.json).
  const datasetSeries = [...byPeriod.values()]
    .map((list) => pickDataset(list))
    .filter((e): e is ReportIndexEntry => e !== null)
    .sort((a, b) => comparePeriods(a.period, b.period));
  const selectedIdx = datasetEntry ? datasetSeries.findIndex((e) => e.periodKey === datasetEntry.periodKey) : -1;
  const history = selectedIdx >= 0 ? datasetSeries.slice(Math.max(0, selectedIdx - HISTORY_POINTS[tab] + 1), selectedIdx + 1) : [];

  let previous: ReportIndexEntry | null = null;
  if (datasetEntry && selectedIdx > 0) {
    const expectedPrev = keyOf(previousPeriod(datasetEntry.period));
    previous = datasetSeries.find((e) => e.periodKey === expectedPrev) ?? datasetSeries[selectedIdx - 1];
  }

  const publishedTimes = index.reports
    .filter((r) => r.type === tab && visible(r))
    .map((r) => r.publishedAt ?? r.updatedAt)
    .sort();

  return {
    client,
    tabs,
    tab,
    periods,
    periodKey: selectedKey,
    selection: { dataset, documents, insights, primary, primaryManifest },
    previous,
    archive: [...byPeriod.values()].map((list) => pickDataset(list) ?? list[0]).sort((a, b) => -comparePeriods(a.period, b.period)),
    history,
    lastUpdatedAt: publishedTimes.at(-1) ?? null,
    mode: options.mode,
  };
}

function statusRank(status: ReportStatus): number {
  return status === "published" ? 0 : status === "draft" ? 1 : 2;
}
