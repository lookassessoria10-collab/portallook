import "server-only";
import { isFullCommercialReport } from "@/features/commercial/presentation";
import { env } from "@/lib/env";
import { comparePeriods, formatPeriod, monthPeriod, parsePeriodKey, periodSeriesLabels, previousPeriod, periodKey as keyOf, todayISO, type Period } from "@/lib/dates/period";
import type { Client } from "@/features/clients/schema";
import { sortPeriodNotes, type PeriodNote, type PeriodNoteStatus } from "@/features/period-notes/schema";
import { getClientIndex } from "@/features/clients/service";
import { getReportData, getReportManifest, type ReportData } from "@/features/reports/service";
import { REPORT_TYPES, reportTypeFromParam, type Insight, type ReportIndexEntry, type ReportManifest, type ReportStatus, type ReportType } from "@/features/reports/schema";

export type PortalTab = ReportType;

/** Áreas do seletor do portal: as de relatório, "Conteúdo" (calendário do ClickUp) e "Ações" — as duas últimas sem períodos. */
export type PortalArea = PortalTab | "content" | "actions";

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
  /** Justificativa do mês (sem dados / dados incompletos), quando houver. */
  note: PeriodNoteStatus | null;
}

/** Justificativa de um mês, como o cliente vê. */
export interface PortalNotice {
  key: string;
  /** "Outubro de 2026". */
  label: string;
  status: PeriodNoteStatus;
  text: string;
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
  /** Anos com relatório (rede social com mais de um ano; null = sem seletor de ano). */
  years: number[] | null;
  /** Ano aberto: os períodos e a visão geral são só dele (null = todos). */
  year: number | null;
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
  /** Justificativas exibidas como aviso no topo (meses da visão aberta e meses mais novos sem relatório). */
  notices: PortalNotice[];
  /** Mês aberto sem relatório, só com justificativa. */
  missing: PortalNotice | null;
  /** Comercial: um relatório só (o último HTML enviado), sem abas de mês nem de ano. */
  singleReport: boolean;
  today: string;
  lastUpdatedAt: string | null;
  mode: "client" | "preview";
}

const HISTORY_POINTS: Record<ReportType, number> = { commercial: 12, traffic: 8, social: 12, media_plan: 12 };
/** Áreas navegadas por ano quando há mais de um (a planilha de rede social e o painel comercial são anuais). */
const YEARLY_TABS: ReadonlySet<ReportType> = new Set(["social", "commercial"]);
/**
 * Áreas sem visão geral separada: o plano de mídia abre sempre um mês; o painel comercial
 * já é o acumulado do ano até o mês em foco (o mais recente, por padrão).
 */
const NO_OVERVIEW_TABS: ReadonlySet<ReportType> = new Set(["media_plan", "commercial"]);
/** A visão geral reúne até 12 períodos (um ano, para relatórios mensais). */
const OVERVIEW_POINTS = 12;

export interface LoadPortalOptions {
  tab?: string | null;
  period?: string | null;
  /** "meses" | "semanas" (ou month/week). */
  scale?: string | null;
  /** Ano (AAAA) — só nas áreas navegadas por ano. */
  year?: string | null;
  mode: "client" | "preview";
  /** Prévia de um relatório específico no ADM (inclui rascunho/retirado). */
  focusReportId?: string | null;
  /** Não abre os relatórios do período (a página mostra outra área, ex.: Ações). */
  skipSelection?: boolean;
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
  // Larplan's reviewed HTML is a native source, independent of spreadsheet imports.
  const larplanSource = client.slug === "larplan" && tab === "commercial" && !focus;

  const pickDataset = (list: ReportIndexEntry[]) => {
    if (focus?.kind === "dataset" && list.some((r) => r.id === focus.id)) return focus;
    const datasets = list.filter((r) => r.kind === "dataset");
    // Prévia do ADM: a versão mais nova do período (o rascunho que vai ser publicado), mesmo que já exista uma publicada.
    if (options.mode === "preview") return datasets.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0] ?? null;
    return datasets.sort((a, b) => statusRank(a.status) - statusRank(b.status) || (a.updatedAt < b.updatedAt ? 1 : -1))[0] ?? null;
  };

  const allEntries = index.reports.filter((r) => r.type === tab && visible(r));

  // Justificativas da área (meses sem dados ou com dados incompletos).
  const tabNotes = client.periodNotes.filter((n) => n.type === tab);

  // Comercial: um relatório só, sem abas de mês — o HTML enviado já traz o mês a mês. Vale o último HTML
  // enviado para o mês mais recente; se o mês mais recente não tem HTML (ex.: cliente que segue com
  // planilhas e tem um HTML antigo), abre o relatório mais recente, como antes. Nada do que já subiu muda.
  const singleReport = tab === "commercial" && !focus;
  const latestStart = allEntries.reduce((max, e) => (e.period.start > max ? e.period.start : max), "");
  const pinned = singleReport
    ? (allEntries
        .filter((e) => isHtmlReport(e) && e.period.start === latestStart)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0] ?? null)
    : null;
  const periodParam = singleReport ? null : (options.period ?? null);

  // Escala: a do período pedido (ou do relatório em foco); senão a periodicidade do cliente, se houver relatórios nela.
  // Sem nenhum relatório, as justificativas (mensais) abrem a escala de meses.
  const available = [...new Set(allEntries.map((e) => scaleOf(e.period)))];
  if (!available.length && tabNotes.length) available.push("month");
  const cadenceScale: PortalScale = client.modules[tab].cadence === "weekly" ? "week" : "month";
  const requestedEntry = focus ?? pinned ?? (periodParam ? allEntries.find((e) => e.periodKey === periodParam) : undefined);
  const requestedNote = !requestedEntry && periodParam ? tabNotes.find((n) => n.periodKey === periodParam) : undefined;
  const requestedScale = requestedEntry ? scaleOf(requestedEntry.period) : requestedNote && available.includes("month") ? "month" : scaleFromParam(options.scale);
  const scale: PortalScale = requestedScale && available.includes(requestedScale) ? requestedScale : available.includes(cadenceScale) ? cadenceScale : (available[0] ?? cadenceScale);
  const scales = !singleReport && available.length > 1 ? (["month", "week"] as const).filter((s) => available.includes(s)) : null;

  const entries = allEntries.filter((e) => scaleOf(e.period) === scale);
  const group = (list: ReportIndexEntry[]) => {
    const map = new Map<string, ReportIndexEntry[]>();
    for (const e of list) map.set(e.periodKey, [...(map.get(e.periodKey) ?? []), e]);
    return map;
  };
  // Todos os períodos: histórico e comparação atravessam os anos (janeiro compara com dezembro).
  const byPeriodAll = group(entries);

  // Na escala de meses, cada justificativa é um mês navegável (mesmo sem relatório).
  const noteYearOf = (n: PeriodNote) => +n.periodKey.slice(0, 4);
  const monthNotes = scale === "month" ? tabNotes : [];

  // Ano: o do período pedido (ou do relatório em foco), o do parâmetro ou o mais recente.
  const yearOf = (e: ReportIndexEntry) => +e.period.start.slice(0, 4);
  const allYears = [...new Set([...entries.map(yearOf), ...monthNotes.map(noteYearOf), ...(larplanSource ? [2026] : [])])].sort((a, b) => a - b);
  const yearly = !singleReport && YEARLY_TABS.has(tab) && scale === "month" && allYears.length > 1;
  const yearEntry = focus ?? (periodParam ? entries.find((e) => e.periodKey === periodParam) : undefined);
  const yearNote = !yearEntry && periodParam ? monthNotes.find((n) => n.periodKey === periodParam) : undefined;
  const paramYear = options.year && /^\d{4}$/.test(options.year) ? +options.year : null;
  const year = yearly
    ? yearEntry
      ? yearOf(yearEntry)
      : yearNote
        ? noteYearOf(yearNote)
        : paramYear !== null && allYears.includes(paramYear)
          ? paramYear
          : allYears[allYears.length - 1]
    : null;
  // Abas de período, visão geral e período aberto: só o ano escolhido.
  const byPeriod = year === null ? byPeriodAll : group(entries.filter((e) => yearOf(e) === year));
  const yearNotes = tabNotes.filter((n) => year === null || noteYearOf(n) === year);
  const noteByKey = new Map(monthNotes.filter((n) => year === null || noteYearOf(n) === year).map((n) => [n.periodKey, n]));

  const periodEntries = [...byPeriod.values()].map((list) => pickDataset(list) ?? list[0]).sort((a, b) => comparePeriods(a.period, b.period));
  const slots = [
    ...periodEntries.map((e) => ({ key: e.periodKey, period: e.period, draft: (byPeriod.get(e.periodKey) ?? []).every((r) => r.status === "draft") })),
    ...[...noteByKey.keys()].filter((k) => !byPeriod.has(k)).map((k) => ({ key: k, period: parsePeriodKey(k) as Period, draft: false })),
  ].sort((a, b) => comparePeriods(a.period, b.period));
  const shortLabels = periodSeriesLabels(slots.map((s) => s.period));
  const periods: PortalPeriodOption[] = slots.map((s, i) => ({
    key: s.key,
    label: formatPeriod(s.period),
    short: shortLabels[i].axis,
    draft: s.draft,
    note: noteByKey.get(s.key)?.status ?? null,
  }));
  if (larplanSource && (year === null || year === 2026) && !periods.some((p) => p.key === "2026-08")) {
    periods.push({ key: "2026-08", label: "Junho a agosto de 2026", short: "Jun–Ago/26", draft: false, note: null });
    periods.sort((a, b) => a.key.localeCompare(b.key));
  }

  // Série histórica, comparação e visão geral usam apenas o índice (sem abrir outros data.json).
  const datasetSeries = [...byPeriodAll.values()]
    .map((list) => pickDataset(list))
    .filter((e): e is ReportIndexEntry => e !== null)
    .sort((a, b) => comparePeriods(a.period, b.period));
  // Visão geral nunca mistura meses com semanas (nem com intervalos personalizados).
  const overviewGranularity = datasetSeries.some((e) => e.period.granularity === scale) ? scale : datasetSeries.at(-1)?.period.granularity;
  const overviewSeries = datasetSeries.filter((e) => e.period.granularity === overviewGranularity && (year === null || yearOf(e) === year));
  // Plano de mídia e comercial não têm visão geral separada: abrem sempre um período.
  const overview = !focus && !NO_OVERVIEW_TABS.has(tab) && overviewSeries.length >= 2 ? overviewSeries.slice(-OVERVIEW_POINTS) : null;
  const lastPeriod = periodEntries.at(-1) ?? null;
  const latestDocumentOnly =
    overview && lastPeriod && !(byPeriod.get(lastPeriod.periodKey) ?? []).some((r) => r.kind === "dataset") && lastPeriod.period.start > overview[overview.length - 1].period.start
      ? (periods.find((p) => p.key === lastPeriod.periodKey) ?? null)
      : null;

  // Sem período pedido, abre a visão geral — ou o período mais recente com relatório, quando não há visão geral
  // (os meses só com justificativa mais novos aparecem como aviso). Plano de mídia: o mês corrente, quando existe.
  const fullCommercial = isFullCommercialReport(client.slug, tab, options.mode);
  const requestedKey =
    !fullCommercial && periodParam && (byPeriod.has(periodParam) || noteByKey.has(periodParam) || (larplanSource && periodParam === "2026-08")) ? periodParam : null;
  const currentPlanKey = tab === "media_plan" ? keyOf(monthPeriod(+today.slice(0, 4), +today.slice(5, 7))) : null;
  const noteOnlyKeys = new Set([...noteByKey.keys()].filter((k) => !byPeriod.has(k)));
  const latestWithReport = [...periods].reverse().find((p) => !noteOnlyKeys.has(p.key))?.key ?? null;
  const defaultKey = currentPlanKey && (byPeriod.has(currentPlanKey) || noteByKey.has(currentPlanKey)) ? currentPlanKey : (latestWithReport ?? periods.at(-1)?.key ?? null);
  const view: PortalView = focus || requestedKey || !overview ? "period" : "overview";
  const selectedKey = view === "overview" ? null : (focus?.periodKey ?? pinned?.periodKey ?? requestedKey ?? defaultKey);
  // HTML fixado: só ele (mesmo que o mês também tenha planilha).
  const inPeriod = pinned ? [pinned] : selectedKey ? (byPeriod.get(selectedKey) ?? []) : [];

  // Justificativas: o mês aberto sem relatório vira a própria página; as demais, avisos no topo.
  const notePeriod = (n: PeriodNote) => parsePeriodKey(n.periodKey) as Period;
  const toNotice = (n: PeriodNote): PortalNotice => ({ key: n.periodKey, label: formatPeriod(notePeriod(n)), status: n.status, text: n.text });
  const selectedNote = selectedKey && !inPeriod.length ? (noteByKey.get(selectedKey) ?? null) : null;
  const selectedPeriod = selectedKey ? (inPeriod[0]?.period ?? parsePeriodKey(selectedKey)) : null;
  let noticeNotes: PeriodNote[] = [];
  if (view === "overview" && overview) {
    noticeNotes = yearNotes.filter((n) => notePeriod(n).end >= overview[0].period.start);
  } else if (selectedPeriod) {
    const isDefault = !focus && !requestedKey;
    noticeNotes = yearNotes.filter((n) => {
      if (n === selectedNote) return false;
      const p = notePeriod(n);
      // Mês(es) do período aberto (uma semana pode cruzar dois meses) e, na abertura padrão, os meses mais novos.
      // Comercial (relatório único com o mês a mês): todos os meses do ano do relatório.
      return (
        (p.start <= selectedPeriod.end && p.end >= selectedPeriod.start) ||
        (isDefault && p.start > selectedPeriod.end) ||
        (singleReport && p.start.slice(0, 4) === selectedPeriod.start.slice(0, 4))
      );
    });
  }

  const datasetEntry = pickDataset(inPeriod);
  const documents = inPeriod.filter((r) => r.kind === "document").sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  let dataset: PortalSelection["dataset"] = null;
  let primaryManifest: ReportManifest | null = null;
  if (datasetEntry && !options.skipSelection) {
    const manifest = await getReportManifest(client.id, datasetEntry.id);
    const data = manifest ? await getReportData(manifest) : null;
    if (manifest && data) dataset = { entry: datasetEntry, manifest, data };
    primaryManifest = manifest;
  }
  const primary = dataset?.entry ?? documents[0] ?? null;
  if (!primaryManifest && primary && !options.skipSelection) primaryManifest = await getReportManifest(client.id, primary.id);

  // Insights: do relatório de dados; se não houver, dos documentos do período.
  let insights: Insight[] = dataset?.manifest.insights ?? [];
  if (!insights.length && documents.length && !options.skipSelection) {
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
    years: yearly ? allYears : null,
    year,
    periods,
    periodKey: selectedKey,
    overview,
    latestDocumentOnly,
    selection: { dataset, documents, insights, primary, primaryManifest },
    previous,
    history,
    relatedTraffic,
    notices: sortPeriodNotes(noticeNotes).map(toNotice),
    missing: selectedNote ? toNotice(selectedNote) : null,
    singleReport,
    today,
    lastUpdatedAt: publishedTimes.at(-1) ?? null,
    mode: options.mode,
  };
}

/** Relatório enviado como HTML (documento ou HTML estruturado). */
function isHtmlReport(entry: ReportIndexEntry): boolean {
  return entry.sourceType === "html_legacy" || entry.sourceType === "html_structured";
}

function statusRank(status: ReportStatus): number {
  return status === "published" ? 0 : status === "draft" ? 1 : 2;
}
