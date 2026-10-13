import { formatCurrency, formatInteger, formatMultiplier, formatPercent, isFiniteNumber, type ValueFormat } from "@/lib/format/number";
import { averageKey, ratioOfSums, sumKey } from "@/lib/metrics/aggregate";
import { safeDivide } from "@/lib/metrics/safe-math";
import { MONTHS_PT, MONTHS_SHORT_PT, comparePeriods, formatPeriod, formatPeriodRange, nextPeriod, periodKey, periodSeriesLabels, periodUnit, type Period, type PeriodUnit } from "@/lib/dates/period";
import { lowerFirst, singularizePt } from "@/lib/format/text";
import { normalizeText, slugify } from "@/lib/ids";
import type { CommercialLayout, DashboardConfig } from "@/features/clients/schema";
import type { Insight, InsightType, ReportIndexEntry } from "@/features/reports/schema";
import { commercialSummary } from "./metrics";
import { stageCanonical } from "./stages";
import { ChannelKindSchema, type ChannelKind, type CommercialData } from "./schema";

/**
 * Painel comercial (modelo do dashboard da Serenity): um mês em foco comparado com o
 * anterior + o acumulado do ano até ele, canais e retorno, um ranking por detalhamento
 * (serviços, terapeutas…) e os insights. Tudo sai dos resumos do índice — só o mês em
 * foco abre o data.json (contexto, tabelas, leituras e insights).
 */

export type Accent = "cyan" | "blue" | "teal" | "sky" | "gold" | "green" | "purple" | "orange";
export type BadgeTone = "positive" | "negative" | "attention" | "info" | "neutral" | "primary";
export type CardIcon = "revenue" | "leads" | "conversions" | "rate" | "ticket" | "returning" | "new" | "investment";

export interface Delta {
  /** "+12,3%", "−4,7 p.p.", "0,0%". */
  text: string;
  direction: "up" | "down" | "flat";
}

export interface BannerKpi {
  key: string;
  label: string;
  value: number | null;
  format: ValueFormat;
  delta: Delta | null;
}

export interface AccumulatedKpi {
  key: string;
  label: string;
  value: number | null;
  format: ValueFormat;
  sub: string | null;
  accent: Accent;
  icon: CardIcon;
}

export interface ChartPoint {
  key: string;
  label: string;
  fullLabel: string;
  values: Record<string, number | null>;
}

export interface ChartSeries {
  key: string;
  label: string;
  format: ValueFormat;
  color: string;
  /** Casas decimais no detalhe do gráfico (ROI em % usa uma). */
  digits?: number;
}

export interface ChartSpec {
  key: string;
  title: string;
  unit: string;
  kind: "bar" | "stacked" | "line" | "area";
  series: ChartSeries[];
  /** Coluna destacada (o mês em foco). */
  highlight?: string;
}

export interface Slice {
  key: string;
  label: string;
  value: number;
  color: string;
}

export interface DistributionSpec {
  key: string;
  title: string;
  unit: string;
  format: ValueFormat;
  /** Rosca até 9 fatias; acima disso, barras horizontais. */
  kind: "donut" | "bars";
  slices: Slice[];
  /** Largura dos rótulos nas barras horizontais (px). */
  labelWidth?: number;
}

export interface TableColumn {
  key: string;
  label: string;
  format: ValueFormat;
  /** Moeda com centavos (investimentos); o padrão é sem centavos. */
  cents?: boolean;
  strong?: boolean;
  /** Mostra o valor como selo colorido (ex.: conversão). */
  badge?: boolean;
}

export interface TableRow {
  key: string;
  label: string;
  href?: string;
  badges: Array<{ text: string; tone: BadgeTone; title?: string }>;
  values: Record<string, number | null>;
  tones?: Record<string, BadgeTone>;
  highlight?: boolean;
}

export interface DataTable {
  columns: TableColumn[];
  rows: TableRow[];
  total: Record<string, number | null> | null;
}

export interface VariationRow {
  key: string;
  label: string;
  format: ValueFormat;
  values: Array<number | null>;
  /** Variação para o período anterior da série (o primeiro não tem). */
  deltas: Array<Delta | null>;
}

export interface ChannelRowView {
  key: string;
  label: string;
  kind: ChannelKind;
  kindLabel: string;
  color: string;
  byPeriod: Record<string, number | null>;
  leads: number | null;
  conversions: number | null;
  conversionRate: number | null;
  revenue: number | null;
  revenueShare: number | null;
  investment: number | null;
  /** Linha "Sem atribuição": leads do funil sem canal informado. */
  unattributed?: boolean;
}

export interface RoiFigures {
  investment: number | null;
  revenue: number | null;
  /** (receita − investimento) ÷ investimento. */
  roi: number | null;
  /** Receita ÷ investimento: quanto voltou para cada R$ 1. */
  roas: number | null;
}

export interface RoiChannelCard extends RoiFigures {
  key: string;
  label: string;
  kindLabel: string;
  color: string;
  /** Largura da barra (0–1) em relação ao melhor canal. */
  bar: number;
}

export interface RoiMonthCard extends RoiFigures {
  key: string;
  label: string;
  href: string | null;
  best: boolean;
  focus: boolean;
  channels: Array<{ key: string; label: string; roi: number | null; roas: number | null }>;
  bar: number;
  note: string | null;
}

export interface RoiTableGroup {
  key: string;
  label: string;
  rows: Array<{ key: string; label: string; focus: boolean } & RoiFigures & { net: number | null }>;
}

export interface RoiView {
  metric: "roiPercent" | "roas";
  /** Receita só dos canais com investimento (ou, sem canais, a receita atribuída). */
  basis: "channels" | "attributed" | "total";
  paidNames: string[];
  otherNames: string[];
  total: RoiFigures;
  channels: RoiChannelCard[];
  table: RoiTableGroup[];
  months: RoiMonthCard[];
  chart: ChartSpec | null;
}

export interface ChannelsView {
  leadsLabel: string;
  conversionsLabel: string | null;
  distributions: DistributionSpec[];
  evolution: ChartSpec | null;
  table: { periods: Array<{ key: string; label: string }>; rows: ChannelRowView[]; total: Omit<ChannelRowView, "key" | "label" | "kind" | "kindLabel" | "color"> };
  hasConversions: boolean;
  hasRevenue: boolean;
  hasLeads: boolean;
}

export interface DimensionRowView {
  key: string;
  label: string;
  rank: number;
  byPeriod: Record<string, number | null>;
  quantity: number | null;
  revenue: number | null;
  averageTicket: number | null;
  share: number | null;
  status: string | null;
  statusTone: BadgeTone;
  /** Apareceu pela primeira vez no período em foco. */
  isNew: boolean;
}

export interface DimensionTab {
  key: string;
  label: string;
  quantityLabel: string;
  /** Medida da coluna mês a mês (ex.: atendimentos). */
  periodMeasureLabel: string;
  rankedBy: "revenue" | "quantity" | "conversions" | "leads";
  distributions: DistributionSpec[];
  evolution: ChartSpec | null;
  periods: Array<{ key: string; label: string }>;
  rows: DimensionRowView[];
  total: { byPeriod: Record<string, number | null>; quantity: number | null; revenue: number | null; averageTicket: number | null };
  hasStatus: boolean;
  hasRevenue: boolean;
}

export interface InsightCard {
  id: string;
  type: InsightType;
  tag: string;
  title: string;
  description: string;
}

export interface ComparisonRow {
  key: string;
  label: string;
  previous: number | null;
  current: number | null;
  format: ValueFormat;
  /** Retorno por R$ 1 aparece como "R$ 7,52 por R$ 1". */
  perReal?: boolean;
  delta: Delta | null;
  note: string | null;
}

export interface ActionCard {
  tag: string | null;
  title: string;
  text: string;
}

/** Agenda já marcada para depois do mês (aba Oportunidades) e a receita que ela representa. */
export interface OpportunityView {
  key: string;
  title: string;
  table: CommercialData["tables"][number];
  count: number;
  ticket: number | null;
  potential: number | null;
}

// ── Modelo "funil" (dashboard da Dra. Isabor) ──

export interface FunnelStep {
  label: string;
  rate: number | null;
}

export interface FocusChannelRow {
  key: string;
  label: string;
  color: string;
  unattributed?: boolean;
  leads: number | null;
  conversions: number | null;
  conversionRate: number | null;
  revenue: number | null;
  investment: number | null;
}

export interface ComparativoRow {
  key: string;
  label: string;
  format: ValueFormat;
  cents?: boolean;
  /** Retorno colorido (bom, médio, ruim). */
  rated?: boolean;
  values: Record<string, number | null>;
  total: number | null;
}

export interface ChannelMonthCard extends RoiFigures {
  key: string;
  channel: string;
  month: string;
  focus: boolean;
  leads: number | null;
  conversions: number | null;
}

export interface FunnelLayoutView {
  /** "Mai → Set". */
  rangeArrow: string;
  banner: BannerKpi[];
  accumulated: Array<AccumulatedKpi & { highlight?: boolean }>;
  funnel: { stages: Array<{ key: string; label: string; value: number | null; width: number }>; steps: FunnelStep[]; overall: FunnelStep | null; rates: DistributionSpec | null };
  focusChannels: {
    rows: FocusChannelRow[];
    paid: FocusChannelRow[];
    total: { leads: number | null; conversions: number | null; revenue: number | null; investment: number | null };
    investment: DistributionSpec | null;
    leads: DistributionSpec | null;
    hasLeads: boolean;
    hasConversions: boolean;
  } | null;
  comparativo: { periods: Array<{ key: string; label: string; focus: boolean }>; groups: Array<{ key: string; label: string; rows: ComparativoRow[] }> };
  trendCharts: ChartSpec[];
  roi: {
    metric: "roiPercent" | "roas";
    overall: RoiFigures;
    story: string[];
    bars: DistributionSpec | null;
    chart: ChartSpec | null;
    channels: Array<{ key: string; label: string; color: string }>;
    months: Array<{ key: string; label: string; focus: boolean; overall: RoiFigures; channels: Record<string, RoiFigures> }>;
    total: { overall: RoiFigures; channels: Record<string, RoiFigures> };
    cards: ChannelMonthCard[];
  } | null;
  growth: { peakName: string; peakLeads: number; conversion: number; projected: number; ticket: number; revenue: number; growth: number; extra: number; peakInvestment: number | null } | null;
}

export interface CommercialDashboardVM {
  unit: PeriodUnit;
  year: number;
  /** "Janeiro a agosto de 2026". */
  rangeLabel: string;
  /** "Jan – Ago 2026". */
  rangeShort: string;
  months: number;
  focus: {
    key: string;
    /** "Agosto 2026". */
    title: string;
    /** "Agosto". */
    name: string;
    previousName: string | null;
    note: { title: string; description: string } | null;
  };
  firstStageLabel: string;
  finalStageLabel: string;
  banner: BannerKpi[];
  extraMetrics: BannerKpi[];
  accumulated: AccumulatedKpi[];
  points: ChartPoint[];
  charts: ChartSpec[];
  monthTable: DataTable;
  variation: { periods: Array<{ key: string; label: string }>; rows: VariationRow[] } | null;
  channels: ChannelsView | null;
  roi: RoiView | null;
  dimensions: DimensionTab[];
  insights: InsightCard[];
  comparison: { previousName: string; currentName: string; rows: ComparisonRow[]; hasNotes: boolean } | null;
  actionPlans: Array<{ key: string; title: string; items: ActionCard[]; table: CommercialData["tables"][number] }>;
  opportunities: OpportunityView[];
  tables: CommercialData["tables"];
  /** Tabelas livres sobre canais (ex.: "Comparecimentos por canal"), exibidas em Canais & ROI. */
  channelTables: CommercialData["tables"];
  /** Destaques da Look por seção (aba Notas). */
  notes: CommercialData["sectionNotes"];
  /** "Outubro": o mês seguinte ao foco (null em semanas). */
  nextName: string | null;
  layout: CommercialLayout;
  /** Peças do modelo "funil" (só quando o cliente usa esse modelo). */
  funnelView: FunnelLayoutView | null;
}

export interface BuildCommercialDashboardInput {
  /** Períodos com dados até o mês em foco (ordem cronológica; o último é o foco). */
  history: readonly ReportIndexEntry[];
  /** Período anterior ao foco (pode ser do ano anterior). */
  previous: ReportIndexEntry | null;
  data: CommercialData;
  insights: readonly Insight[];
  dashboard: DashboardConfig;
  periodHref?: (key: string) => string;
}

type Values = Record<string, number | null>;

/** Paleta categórica do painel (canais, serviços, profissionais); a 9ª em diante vira "Outros". */
export const PALETTE = ["var(--dash-1)", "var(--dash-2)", "var(--dash-3)", "var(--dash-4)", "var(--dash-5)", "var(--dash-6)", "var(--dash-7)", "var(--dash-8)"];
const OTHER_COLOR = "var(--dash-other)";
const MAX_SLICES = 9;
const MAX_STACK = 7;

const KIND_LABEL: Record<ChannelKind, string> = {
  paid: "Mídia paga",
  organic: "Orgânico",
  referral: "Indicação",
  recurring: "Recorrente",
  marketplace: "Plataforma",
  offline: "Offline",
  partner: "Parceria",
  other: "Outro",
};

export const INSIGHT_LABEL: Record<InsightType, string> = {
  positive: "Destaque",
  attention: "Atenção",
  neutral: "Contexto",
  recommendation: "Recomendação",
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const monthIndex = (p: Period) => +p.start.slice(5, 7) - 1;

/** "Agosto" (mês) ou "21/09 a 27/09" (semana). */
function periodName(p: Period): string {
  return p.granularity === "month" ? cap(MONTHS_PT[monthIndex(p)]) : formatPeriod(p, "short");
}

function rangeShort(first: Period, last: Period): string {
  const year = last.start.slice(0, 4);
  if (first.granularity !== "month" || last.granularity !== "month") return formatPeriodRange(first, last);
  const a = cap(MONTHS_SHORT_PT[monthIndex(first)]);
  const b = cap(MONTHS_SHORT_PT[monthIndex(last)]);
  return a === b ? `${cap(MONTHS_PT[monthIndex(last)])} ${year}` : `${a} – ${b} ${year}`;
}

function labelOf(entries: readonly ReportIndexEntry[], key: string): string | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    const label = entries[i].labels[key];
    if (label) return label;
  }
  return null;
}

/** Variação relativa (contagens e valores) ou em pontos percentuais (taxas). */
export function deltaOf(current: number | null | undefined, previous: number | null | undefined, format: ValueFormat): Delta | null {
  if (!isFiniteNumber(current) || !isFiniteNumber(previous)) return null;
  const nf = (v: number) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Math.abs(v));
  if (format === "percent") {
    const pp = (current - previous) * 100;
    if (Math.abs(pp) < 0.05) return { text: "0,0 p.p.", direction: "flat" };
    return { text: `${pp > 0 ? "+" : "−"}${nf(pp)} p.p.`, direction: pp > 0 ? "up" : "down" };
  }
  if (previous === 0) return current === 0 ? { text: "0,0%", direction: "flat" } : null;
  const rel = ((current - previous) / Math.abs(previous)) * 100;
  if (Math.abs(rel) < 0.05) return { text: "0,0%", direction: "flat" };
  return { text: `${rel > 0 ? "+" : "−"}${nf(rel)}%`, direction: rel > 0 ? "up" : "down" };
}

/** Tom do status de um item (Ativa, Inativa, Destaque, Nova, Lançamento a revisar…). */
export function statusTone(status: string | null): BadgeTone {
  const n = normalizeText(status ?? "");
  if (!n) return "neutral";
  if (/revis|erro|lancament|atenc|confer|⚠/.test(n) || (status ?? "").includes("⚠")) return "attention";
  if (/inativ|pausad|saiu|deslig|parou|ausente|ferias/.test(n)) return "negative";
  if (/nov[oa]|estre/.test(n)) return "info";
  if (/destaque|top|melhor|lider|ativ|retorn|volt/.test(n)) return "positive";
  if (/pontual|eventual/.test(n)) return "neutral";
  return "primary";
}

const ticketBase = (s: ReportIndexEntry["summary"]) => s.sales ?? s.conversions ?? null;

/** Etapas de um período, na ordem do funil dele. */
function stagesOf(e: ReportIndexEntry): Array<{ canon: string; label: string; value: number | null }> {
  return Object.keys(e.labels)
    .filter((k) => k.startsWith("stage."))
    .map((k) => ({ canon: stageCanonical(e.labels[k]), label: e.labels[k], value: e.summary[k] ?? null }));
}

/** Valores do resumo com as etapas pela chave comum ("stage.agendamentos"). */
function withStages(e: ReportIndexEntry): Values {
  const v: Values = { ...e.summary, ticketBase: ticketBase(e.summary) };
  for (const s of stagesOf(e)) v[`stage.${s.canon}`] = s.value;
  return v;
}

/** O rótulo mais usado no período (no empate, o mais recente). */
function mostUsed(labels: Array<string | null | undefined>): string | null {
  const count = new Map<string, number>();
  labels.forEach((l) => l && count.set(l, (count.get(l) ?? 0) + 1));
  let best: string | null = null;
  for (const l of labels.filter((x): x is string => Boolean(x))) if (best === null || (count.get(l) ?? 0) >= (count.get(best) ?? 0)) best = l;
  return best;
}

/** Nota de uma seção gravada no índice do período (aba Notas), por um dos nomes aceitos. */
function entryNote(e: ReportIndexEntry, aliases: readonly string[]): string | null {
  for (const a of aliases) {
    const note = e.labels[`nota.${slugify(a)}`];
    if (note) return note;
  }
  return null;
}

/** Notas do cartão de ROI de cada mês (aba Notas, seção "ROI do mês"). */
export const ROI_MONTH_NOTE = ["roi do mes", "roi mensal", "roi por mes", "roi mes a mes"];

/** Tabelas livres sobre canais aparecem em Canais & ROI (ex.: "Comparecimentos por canal"). */
function isChannelTable(title: string): boolean {
  return /\bcana(l|is)\b/.test(normalizeText(title));
}

/** Entrada de índice do próprio relatório, quando ele ainda não está no histórico (ex.: prévia). */
function entryOf(data: CommercialData): ReportIndexEntry {
  const { summary, labels } = commercialSummary(data);
  const now = new Date(0).toISOString();
  return { id: "foco", type: "commercial", kind: "dataset", period: data.period, periodKey: periodKey(data.period), title: null, status: "draft", summary, labels, allowDownload: false, retroactive: false, updatedAt: now, publishedAt: null, createdAt: now, sourceType: null, sourceFileName: null, insightCount: 0 };
}

export function buildCommercialDashboard(input: BuildCommercialDashboardInput): CommercialDashboardVM {
  const { data, dashboard, periodHref } = input;
  const key = periodKey(data.period);
  const last = input.history[input.history.length - 1];
  const history = last?.periodKey === key ? input.history : [...input.history.filter((e) => comparePeriods(e.period, data.period) < 0), entryOf(data)];
  const focusEntry = history[history.length - 1];
  const year = +data.period.start.slice(0, 4);
  // Acumulado do ano: só os períodos do mesmo tipo e do mesmo ano do mês em foco.
  const entries = history.filter((e) => e.period.granularity === data.period.granularity && +e.period.start.slice(0, 4) === year);
  const previous = input.previous;
  const unit = periodUnit(data.period.granularity);
  const labels = periodSeriesLabels(entries.map((e) => e.period));
  const first = entries[0].period;
  const firstStageLabel = mostUsed(entries.map((e) => e.labels.firstStage)) ?? "Leads";
  const finalStageLabel = mostUsed(entries.map((e) => e.labels.finalStage)) ?? "Conversões";
  const summaries = entries.map((e) => e.summary);
  const rows: Values[] = entries.map(withStages);
  const focus = rows[rows.length - 1];
  const prev: Values | null = previous ? withStages(previous) : null;
  const href = (key: string) => periodHref?.(key) ?? null;

  // Etapas do funil: as do mês em foco, na ordem dele; etapas que só aparecem em outros meses entram
  // depois da etapa que as precede lá. Rótulos levemente diferentes ("Leads registrados") contam como
  // a mesma etapa, para nenhum mês ficar com a coluna vazia.
  const stageLists = entries.map(stagesOf);
  const stageKeys = stageLists[stageLists.length - 1].map((s) => s.canon);
  for (let i = stageLists.length - 2; i >= 0; i--) {
    stageLists[i].forEach((s, j) => {
      if (stageKeys.includes(s.canon)) return;
      const before = j > 0 ? stageKeys.indexOf(stageLists[i][j - 1].canon) : -1;
      stageKeys.splice(before + 1, 0, s.canon);
    });
  }
  const stageLabelOf = new Map(stageKeys.map((k) => [k, mostUsed(stageLists.flatMap((list) => list.filter((s) => s.canon === k).map((s) => s.label))) ?? k]));
  const stageLabel = (key: string) => stageLabelOf.get(key) ?? key;

  const has = (key: string) => rows.some((r) => isFiniteNumber(r[key]));
  const totals: Values = {
    leads: sumKey(rows, "leads"),
    conversions: sumKey(rows, "conversions"),
    revenue: sumKey(rows, "revenue"),
    investment: sumKey(rows, "investment"),
    conversionRate: ratioOfSums(rows, "conversions", "leads"),
    averageTicket: ratioOfSums(rows, "revenue", "ticketBase"),
    newCustomers: sumKey(rows, "newCustomers"),
    returningCustomers: sumKey(rows, "returningCustomers"),
    days: sumKey(rows, "days"),
  };
  for (const s of stageKeys) totals[`stage.${s}`] = sumKey(rows, `stage.${s}`);

  // ── Mês em foco ──
  const bannerDef: Array<{ key: string; label: string; format: ValueFormat }> = [
    { key: "revenue", label: "Receita", format: "currency" },
    ...stageKeys.map((s) => ({ key: `stage.${s}`, label: stageLabel(s), format: "integer" as const })),
    { key: "averageTicket", label: "Ticket médio", format: "currency" },
    { key: "conversionRate", label: "Conversão", format: "percent" },
    { key: "newCustomers", label: "Novos clientes", format: "integer" },
    { key: "returningCustomers", label: "Recorrentes", format: "integer" },
  ];
  const banner: BannerKpi[] = bannerDef
    .filter((b) => isFiniteNumber(focus[b.key]))
    .map((b) => ({ ...b, value: focus[b.key] ?? null, delta: prev ? deltaOf(focus[b.key], prev[b.key], b.format) : null }));

  const extraMetrics: BannerKpi[] = data.extraMetrics.map((e) => ({
    key: e.key,
    label: e.label,
    value: e.value,
    format: e.format,
    delta: prev ? deltaOf(e.value, prev[`extra.${e.key}`], e.format) : null,
  }));

  // ── Acumulado ──
  const n = entries.length;
  const per = unit.singular;
  const avg = (key: string) => {
    const v = averageKey(rows, key);
    return v === null ? null : `Média de ${formatInteger(v)} por ${per}`;
  };
  const customerTotal = (totals.newCustomers ?? 0) + (totals.returningCustomers ?? 0);
  const shareOfCustomers = (v: number | null) => (isFiniteNumber(v) && customerTotal > 0 ? `${Math.round((v / customerTotal) * 100)}% dos clientes` : null);
  const paidKeys = channelKeysOf(entries).filter((k) => (sumKey(summaries, `channel.${k}.investment`) ?? 0) > 0);
  const paidNames = paidKeys.map((k) => labelOf(entries, `channel.${k}`) ?? k);
  const periodsCount = `${n} ${n === 1 ? unit.singular : unit.plural}`;
  const accumulated: AccumulatedKpi[] = (
    [
      { key: "revenue", label: "Receita total", format: "currency", sub: rangeShort(first, data.period), accent: "cyan", icon: "revenue" },
      { key: "leads", label: `Total de ${lowerFirst(firstStageLabel)}`, format: "integer", sub: avg("leads"), accent: "blue", icon: "leads" },
      { key: "conversions", label: finalStageLabel, format: "integer", sub: avg("conversions"), accent: "teal", icon: "conversions" },
      { key: "conversionRate", label: "Taxa de conversão", format: "percent", sub: `${finalStageLabel} ÷ ${lowerFirst(firstStageLabel)}`, accent: "sky", icon: "rate" },
      { key: "averageTicket", label: "Ticket médio", format: "currency", sub: `Receita por ${lowerFirst(singularizePt(finalStageLabel))}`, accent: "gold", icon: "ticket" },
      { key: "returningCustomers", label: "Clientes recorrentes", format: "integer", sub: shareOfCustomers(totals.returningCustomers), accent: "green", icon: "returning" },
      { key: "newCustomers", label: "Novos clientes", format: "integer", sub: shareOfCustomers(totals.newCustomers), accent: "blue", icon: "new" },
      { key: "investment", label: "Investimento em mídia", format: "currency", sub: paidNames.length ? `${paidNames.join(" + ")} · ${periodsCount}` : periodsCount, accent: "purple", icon: "investment" },
    ] satisfies Array<Omit<AccumulatedKpi, "value">>
  )
    .map((k) => ({ ...k, value: totals[k.key] ?? null }))
    .filter((k) => isFiniteNumber(k.value));

  // ── Evolução ──
  const charts: ChartSpec[] = [];
  if (has("revenue")) charts.push({ key: "receita", title: `Receita por ${per}`, unit: "R$", kind: "bar", series: [{ key: "revenue", label: "Receita", format: "currency", color: "var(--primary)" }], highlight: focusEntry.periodKey });
  if (has("leads") && has("conversions")) {
    charts.push({
      key: "funil",
      title: `${firstStageLabel} vs ${lowerFirst(finalStageLabel)}`,
      unit: "quantidade",
      kind: "bar",
      series: [
        { key: "leads", label: firstStageLabel, format: "integer", color: "var(--dash-7)" },
        { key: "conversions", label: finalStageLabel, format: "integer", color: "var(--dash-2)" },
      ],
    });
  }
  if (rows.filter((r) => isFiniteNumber(r.conversionRate)).length) charts.push({ key: "conversao", title: "Taxa de conversão", unit: "%", kind: "area", series: [{ key: "conversionRate", label: "Conversão", format: "percent", color: "var(--dash-1)" }] });
  if (has("newCustomers") || has("returningCustomers")) {
    charts.push({
      key: "clientes",
      title: "Novos vs recorrentes",
      unit: lowerFirst(finalStageLabel),
      kind: "stacked",
      series: [
        { key: "newCustomers", label: "Novos clientes", format: "integer", color: "var(--dash-2)" },
        { key: "returningCustomers", label: "Recorrentes", format: "integer", color: "var(--dash-3)" },
      ],
    });
  } else if (has("investment")) {
    charts.push({ key: "investimento", title: `Investimento em mídia por ${per}`, unit: "R$", kind: "bar", series: [{ key: "investment", label: "Investimento", format: "currency", color: "var(--dash-4)" }] });
  }

  // ── Tabela mês a mês ──
  const overallRate = totals.conversionRate;
  const rateTone = (rate: number | null): BadgeTone => {
    if (!isFiniteNumber(rate) || !isFiniteNumber(overallRate) || overallRate <= 0) return "neutral";
    if (rate > overallRate * 2.5) return "attention";
    if (rate >= overallRate * 0.9) return "positive";
    if (rate >= overallRate * 0.7) return "primary";
    return "negative";
  };
  const monthColumns: TableColumn[] = (
    [
      { key: "days", label: "Dias", format: "integer" },
      ...stageKeys.map((s) => ({ key: `stage.${s}`, label: stageLabel(s), format: "integer" as const })),
      { key: "conversionRate", label: "Conversão", format: "percent", badge: true },
      { key: "revenue", label: "Receita", format: "currency", strong: true },
      { key: "averageTicket", label: "Ticket médio", format: "currency" },
      { key: "newCustomers", label: "Novos", format: "integer" },
      { key: "returningCustomers", label: "Recorrentes", format: "integer" },
    ] satisfies TableColumn[]
  ).filter((c) => has(c.key));
  const monthTable: DataTable = {
    columns: monthColumns,
    rows: entries.map((e, i) => {
      const badges: TableRow["badges"] = [];
      const note = e.labels.context;
      if (note) badges.push(/parcial|incomplet/i.test(note) ? { text: "Parcial", tone: "attention", title: note } : { text: note.length <= 28 ? note : "Obs.", tone: "attention", title: note });
      if (i === entries.length - 1) badges.push({ text: "Em foco", tone: "primary" });
      return { key: e.periodKey, label: labels[i].row, href: href(e.periodKey) ?? undefined, badges, values: rows[i], tones: { conversionRate: rateTone(rows[i].conversionRate ?? null) }, highlight: i === entries.length - 1 };
    }),
    total: n > 1 ? totals : null,
  };

  // ── Variação período a período ──
  const variationDef: Array<{ key: string; label: string; format: ValueFormat }> = [
    { key: "revenue", label: "Receita", format: "currency" },
    { key: "leads", label: firstStageLabel, format: "integer" },
    { key: "conversions", label: finalStageLabel, format: "integer" },
    { key: "averageTicket", label: "Ticket médio", format: "currency" },
    { key: "conversionRate", label: "Taxa de conversão", format: "percent" },
    { key: "newCustomers", label: "Novos clientes", format: "integer" },
    { key: "returningCustomers", label: "Clientes recorrentes", format: "integer" },
  ];
  const variation =
    n > 1
      ? {
          periods: entries.map((e, i) => ({ key: e.periodKey, label: labels[i].axis })),
          rows: variationDef
            .filter((d) => has(d.key))
            .map((d) => ({
              ...d,
              values: rows.map((r) => r[d.key] ?? null),
              deltas: rows.map((r, i) => (i === 0 ? null : deltaOf(r[d.key], rows[i - 1][d.key], d.format))),
            })),
        }
      : null;

  // Séries que só existem nos gráficos ("Outros", ROI por canal) vão para valores próprios de cada ponto.
  const chartValues: Values[] = entries.map(() => ({}));
  const channels = buildChannels(entries, labels.map((l) => l.axis), firstStageLabel, finalStageLabel, chartValues);
  const roi = buildRoi(entries, labels.map((l) => l.row), focusEntry.periodKey, dashboard, href, chartValues);
  const dimensions = buildDimensions(entries, labels.map((l) => l.axis), focusEntry.periodKey, chartValues);
  const layout = dashboard.commercialLayout ?? "detalhamentos";
  const funnelView =
    layout === "funil"
      ? buildFunnelView({ entries, labels, rows, totals, focusEntry, stageKeys, stageLabel, firstStageLabel, finalStageLabel, unit, dashboard, chartValues, paidNames })
      : null;
  const points: ChartPoint[] = entries.map((e, i) => ({ key: e.periodKey, label: labels[i].axis, fullLabel: labels[i].full, values: { ...rows[i], ...chartValues[i] } }));

  // ── Insights ──
  const insights: InsightCard[] = input.insights.map((i) => ({ id: i.id, type: i.type, tag: i.tag?.trim() || INSIGHT_LABEL[i.type], title: i.title, description: i.description }));
  const comparison = previous && prev ? buildComparison(focusEntry, previous, focus, prev, stageKeys, stageLabel, firstStageLabel, finalStageLabel, data.comparisonNotes) : null;
  const nextName = data.period.granularity === "month" ? cap(MONTHS_PT[monthIndex(nextPeriod(data.period))]) : null;
  const actionPlans = data.tables
    .filter((t) => isActionPlan(t.title))
    .map((t) => ({ key: t.key, title: /^plano de a/.test(normalizeText(t.title)) && nextName ? `${t.title} para ${nextName}` : t.title, items: actionCards(t), table: t }));
  // Agenda já marcada para depois do mês: quantidade × ticket do mês = receita encaminhada.
  const ticket = focus.averageTicket ?? null;
  const opportunities: OpportunityView[] = data.tables
    .filter((t) => isOpportunity(t.title))
    .map((t) => ({ key: t.key, title: nextName ? `Agendamentos já marcados para ${nextName}` : t.title, table: t, count: t.rows.length, ticket, potential: isFiniteNumber(ticket) ? t.rows.length * ticket : null }));
  const free = data.tables.filter((t) => !isActionPlan(t.title) && !isOpportunity(t.title));
  const tables = free.filter((t) => !isChannelTable(t.title));
  const channelTables = free.filter((t) => isChannelTable(t.title));

  return {
    unit,
    year,
    rangeLabel: formatPeriodRange(first, data.period),
    rangeShort: rangeShort(first, data.period),
    months: n,
    focus: {
      key: focusEntry.periodKey,
      title: data.period.granularity === "month" ? `${periodName(data.period)} ${year}` : cap(formatPeriod(data.period)),
      name: periodName(data.period),
      previousName: previous ? periodName(previous.period) : null,
      note: data.context ? { title: data.context.title, description: data.context.description } : null,
    },
    firstStageLabel,
    finalStageLabel,
    banner,
    extraMetrics,
    accumulated,
    points,
    charts,
    monthTable,
    variation,
    channels,
    roi,
    dimensions,
    insights,
    comparison,
    actionPlans,
    opportunities,
    tables,
    channelTables,
    notes: data.sectionNotes,
    nextName,
    layout,
    funnelView,
  };
}

function channelKeysOf(entries: readonly ReportIndexEntry[]): string[] {
  return [...new Set(entries.flatMap((e) => Object.keys(e.summary).flatMap((k) => /^channel\.(.+)\.(leads|revenue|investment|conversions)$/.exec(k)?.[1] ?? [])))];
}

/** Cor fixa de cada canal (pela receita no ano, depois pelos leads), a mesma em todos os gráficos e tabelas. */
function channelColors(entries: readonly ReportIndexEntry[]): Map<string, string> {
  const summaries = entries.map((e) => e.summary);
  const total = (k: string, m: string) => sumKey(summaries, `channel.${k}.${m}`) ?? -1;
  const ordered = channelKeysOf(entries).sort((a, b) => total(b, "revenue") - total(a, "revenue") || total(b, "leads") - total(a, "leads"));
  return new Map(ordered.map((k, i) => [k, PALETTE[i] ?? OTHER_COLOR]));
}

/** Agrupa o que passa de `max` fatias em "Outros". */
function slicesOf(items: Array<{ key: string; label: string; value: number | null; color: string }>, max: number): Slice[] {
  const valid = items.filter((i): i is typeof i & { value: number } => isFiniteNumber(i.value) && i.value > 0).sort((a, b) => b.value - a.value);
  if (valid.length <= max) return valid;
  const shown = valid.slice(0, max - 1);
  const rest = valid.slice(max - 1).reduce((s, i) => s + i.value, 0);
  return [...shown, { key: "__outros", label: "Outros", value: rest, color: OTHER_COLOR }];
}

function distribution(key: string, title: string, unit: string, format: ValueFormat, items: Array<{ key: string; label: string; value: number | null; color: string }>): DistributionSpec | null {
  const valid = items.filter((i) => isFiniteNumber(i.value) && i.value > 0);
  if (!valid.length) return null;
  const kind = valid.length <= MAX_SLICES ? "donut" : "bars";
  return { key, title, unit, format, kind, slices: slicesOf(items, kind === "donut" ? MAX_SLICES : 15) };
}

function buildChannels(entries: readonly ReportIndexEntry[], axis: string[], firstLabel: string, finalLabel: string, chartValues: Values[]): ChannelsView | null {
  const keys = channelKeysOf(entries);
  if (!keys.length) return null;
  const summaries = entries.map((e) => e.summary);
  const sum = (k: string, m: string) => sumKey(summaries, `channel.${k}.${m}`);
  const base = keys.map((key) => {
    const leads = sum(key, "leads");
    const conversions = sum(key, "conversions");
    return {
      key,
      label: labelOf(entries, `channel.${key}`) ?? key,
      kind: ChannelKindSchema.safeParse(labelOf(entries, `channel.${key}.kind`)).data ?? "other",
      leads,
      conversions,
      conversionRate: safeDivide(conversions, leads),
      revenue: sum(key, "revenue"),
      investment: sum(key, "investment"),
      byPeriod: Object.fromEntries(entries.map((e) => [e.periodKey, e.summary[`channel.${key}.leads`] ?? null])),
    };
  });
  // Cor fixa por canal (pela receita, ou pelos leads), a mesma em todos os gráficos.
  const ordered = [...base].sort((a, b) => (b.revenue ?? -1) - (a.revenue ?? -1) || (b.leads ?? -1) - (a.leads ?? -1));
  const color = channelColors(entries);
  const totalRevenue = sumKey(base.map((c) => ({ x: c.revenue })), "x");
  const rows: ChannelRowView[] = base
    .map((c) => ({ ...c, kindLabel: KIND_LABEL[c.kind], color: color.get(c.key)!, revenueShare: safeDivide(c.revenue, totalRevenue) }))
    .sort((a, b) => (b.leads ?? -1) - (a.leads ?? -1) || (b.revenue ?? -1) - (a.revenue ?? -1));
  // Leads do funil sem canal informado: a diferença entre o total do funil e a soma dos canais, nos
  // meses em que os canais trazem leads. Fica visível como "Sem atribuição" em vez de sumir da conta.
  const unattributed = unattributedLeads(entries, keys);
  const unattributedTotal = sumKey(Object.values(unattributed).map((x) => ({ x })), "x");
  if (unattributedTotal) {
    rows.push({ key: UNATTRIBUTED, label: "Sem atribuição", kind: "other", kindLabel: "Sem canal informado", color: OTHER_COLOR, byPeriod: unattributed, leads: unattributedTotal, conversions: null, conversionRate: null, revenue: null, revenueShare: null, investment: null, unattributed: true });
  }

  const hasLeads = rows.some((r) => isFiniteNumber(r.leads));
  const hasRevenue = rows.some((r) => isFiniteNumber(r.revenue));
  const hasConversions = rows.some((r) => isFiniteNumber(r.conversions));
  const distributions = [
    hasLeads ? distribution("leads", `${firstLabel} por canal`, "acumulado", "integer", rows.map((r) => ({ key: r.key, label: r.label, value: r.leads, color: r.color }))) : null,
    hasRevenue ? distribution("receita", "Receita por canal", "R$ acumulado", "currency", rows.map((r) => ({ key: r.key, label: r.label, value: r.revenue, color: r.color }))) : null,
  ].filter((d) => d !== null);

  let evolution: ChartSpec | null = null;
  if (hasRevenue && entries.length > 1) {
    const top = ordered.filter((c) => isFiniteNumber(c.revenue) && c.revenue > 0);
    const shown = top.length > MAX_STACK ? top.slice(0, MAX_STACK - 1) : top;
    const grouped = top.slice(shown.length);
    const series: ChartSeries[] = shown.map((c) => ({ key: `channel.${c.key}.revenue`, label: c.label, format: "currency", color: color.get(c.key)! }));
    if (grouped.length) series.push({ key: "channel.__outros.revenue", label: "Outros", format: "currency", color: OTHER_COLOR });
    evolution = { key: "receita-canais", title: "Receita por canal — evolução", unit: "R$", kind: "stacked", series };
    if (grouped.length) entries.forEach((e, i) => (chartValues[i]["channel.__outros.revenue"] = sumKey(grouped.map((c) => ({ x: e.summary[`channel.${c.key}.revenue`] })), "x")));
  }

  const periodTotal = Object.fromEntries(entries.map((e) => [e.periodKey, sumKey([...keys.map((k) => ({ x: e.summary[`channel.${k}.leads`] })), { x: unattributed[e.periodKey] }], "x")]));
  const leads = sumKey(rows.map((r) => ({ x: r.leads })), "x");
  const conversions = sumKey(rows.map((r) => ({ x: r.conversions })), "x");
  // Conversão total: só sobre os leads dos canais que informam conversões.
  const leadsWithConversions = sumKey(rows.filter((r) => isFiniteNumber(r.conversions)).map((r) => ({ x: r.leads })), "x");
  return {
    leadsLabel: firstLabel,
    conversionsLabel: hasConversions ? finalLabel : null,
    distributions,
    evolution,
    table: {
      periods: entries.map((e, i) => ({ key: e.periodKey, label: axis[i] })),
      rows,
      total: { byPeriod: periodTotal, leads, conversions, conversionRate: safeDivide(conversions, leadsWithConversions), revenue: totalRevenue, revenueShare: totalRevenue ? 1 : null, investment: sumKey(rows.map((r) => ({ x: r.investment })), "x") },
    },
    hasConversions,
    hasRevenue,
    hasLeads,
  };
}

const UNATTRIBUTED = "__sem-atribuicao";

/** Por período: leads do funil que nenhum canal explica (só quando os canais trazem leads naquele período). */
function unattributedLeads(entries: readonly ReportIndexEntry[], keys: string[]): Record<string, number | null> {
  return Object.fromEntries(
    entries.map((e) => {
      const channels = sumKey(keys.map((k) => ({ x: e.summary[`channel.${k}.leads`] })), "x");
      const funnel = e.summary.leads ?? null;
      return [e.periodKey, isFiniteNumber(channels) && isFiniteNumber(funnel) && funnel > channels ? funnel - channels : null];
    }),
  );
}

function figures(investment: number | null, revenue: number | null): RoiFigures {
  const ok = isFiniteNumber(investment) && investment > 0;
  return { investment, revenue, roi: ok && isFiniteNumber(revenue) ? (revenue - investment) / investment : null, roas: ok ? safeDivide(revenue, investment) : null };
}

/**
 * Retorno dos canais com investimento: receita do canal ÷ investimento no canal. Sem
 * investimento por canal, usa o Financeiro (receita atribuída, ou total) ÷ investimento.
 */
function buildRoi(entries: readonly ReportIndexEntry[], rowLabels: string[], focusKey: string, dashboard: DashboardConfig, href: (key: string) => string | null, chartValues: Values[]): RoiView | null {
  const summaries = entries.map((e) => e.summary);
  const keys = channelKeysOf(entries);
  const paid = keys.filter((k) => (sumKey(summaries, `channel.${k}.investment`) ?? 0) > 0);
  const label = (k: string) => labelOf(entries, `channel.${k}`) ?? k;
  const metric = dashboard.roiMetric === "roiPercent" ? "roiPercent" : "roas";
  const kindOf = (k: string): ChannelKind => ChannelKindSchema.safeParse(labelOf(entries, `channel.${k}.kind`)).data ?? "other";
  const colorOf = channelColors(entries);

  if (!paid.length) {
    if (!(sumKey(summaries, "investment") ?? 0)) return null;
    // Sem canais pagos: retorno do Financeiro (receita atribuída, ou a total quando não há).
    const attributed = entries.some((e) => isFiniteNumber(e.summary.attributedRevenue) && e.summary.attributedRevenue !== e.summary.revenue);
    const withInv = entries.filter((e) => (e.summary.investment ?? 0) > 0);
    const total = figures(sumKey(withInv.map((e) => e.summary), "investment"), sumKey(withInv.map((e) => e.summary), "attributedRevenue"));
    const months = withInv.map((e) => {
      const i = entries.indexOf(e);
      const f = figures(e.summary.investment ?? null, e.summary.attributedRevenue ?? null);
      return { key: e.periodKey, label: rowLabels[i], href: href(e.periodKey), best: false, focus: e.periodKey === focusKey, channels: [], bar: 0, note: entryNote(e, ROI_MONTH_NOTE), ...f };
    });
    markBest(months);
    return {
      metric,
      basis: attributed ? "attributed" : "total",
      paidNames: [],
      otherNames: [],
      total,
      channels: [],
      table: [],
      months,
      chart: months.length > 1 ? { key: "roi", title: metric === "roas" ? "Retorno por R$ 1 investido" : "ROI por mês", unit: metric === "roas" ? "x" : "%", kind: "line", series: [{ key: metric === "roas" ? "roas" : "roiPercent", label: metric === "roas" ? "Retorno" : "ROI", format: metric === "roas" ? "multiplier" : "percent", digits: 1, color: "var(--primary)" }] } : null,
    };
  }

  const v = (e: ReportIndexEntry, k: string, m: "investment" | "revenue") => e.summary[`channel.${k}.${m}`] ?? null;
  // Total: só a receita dos meses em que o canal teve investimento — assim o retorno bate.
  const channelTotal = (k: string) => {
    const withInv = entries.filter((e) => (v(e, k, "investment") ?? 0) > 0);
    return figures(sumKey(withInv.map((e) => ({ x: v(e, k, "investment") })), "x"), sumKey(withInv.map((e) => ({ x: v(e, k, "revenue") })), "x"));
  };
  const monthFigures = (e: ReportIndexEntry) => {
    const active = paid.filter((k) => (v(e, k, "investment") ?? 0) > 0);
    return figures(sumKey(active.map((k) => ({ x: v(e, k, "investment") })), "x"), sumKey(active.map((k) => ({ x: v(e, k, "revenue") })), "x"));
  };
  const perChannel = paid.map((k) => ({ k, ...channelTotal(k) }));
  const total = figures(sumKey(perChannel.map((c) => ({ x: c.investment })), "x"), sumKey(perChannel.map((c) => ({ x: c.revenue })), "x"));
  const best = Math.max(0, ...perChannel.map((c) => c.roi ?? 0));
  const channels: RoiChannelCard[] = perChannel.map((c) => ({ key: c.k, label: label(c.k), kindLabel: KIND_LABEL[kindOf(c.k)], color: colorOf.get(c.k) ?? OTHER_COLOR, bar: best > 0 ? Math.max(0.04, Math.min(1, (c.roi ?? 0) / best)) : 0, investment: c.investment, revenue: c.revenue, roi: c.roi, roas: c.roas }));

  const table: RoiTableGroup[] = paid.map((k) => ({
    key: k,
    label: label(k),
    rows: entries
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => isFiniteNumber(v(e, k, "investment")) || isFiniteNumber(v(e, k, "revenue")))
      .map(({ e, i }) => {
        const f = figures(v(e, k, "investment"), v(e, k, "revenue"));
        return { key: e.periodKey, label: rowLabels[i], focus: e.periodKey === focusKey, net: isFiniteNumber(f.investment) && isFiniteNumber(f.revenue) ? f.revenue - f.investment : null, ...f };
      }),
  }));

  const months: RoiMonthCard[] = entries
    .map((e, i) => ({ e, i, f: monthFigures(e) }))
    .filter(({ f }) => isFiniteNumber(f.investment) && f.investment > 0)
    .map(({ e, i, f }) => {
      const perCh = paid.map((k) => ({ key: k, label: label(k), ...figures(v(e, k, "investment"), v(e, k, "revenue")) })).filter((c) => c.roi !== null);
      const top = perCh.length > 1 ? [...perCh].sort((a, b) => (b.roas ?? 0) - (a.roas ?? 0))[0] : null;
      return {
        key: e.periodKey,
        label: rowLabels[i],
        href: href(e.periodKey),
        best: false,
        focus: e.periodKey === focusKey,
        channels: perCh.map((c) => ({ key: c.key, label: c.label, roi: c.roi, roas: c.roas })),
        bar: 0,
        // A leitura da Look para o mês (aba Notas, "ROI do mês"); sem ela, o canal de melhor retorno.
        note: entryNote(e, ROI_MONTH_NOTE) ?? (top ? `Melhor canal: ${top.label} (${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(top.roas ?? 0)}x)` : null),
        ...f,
      };
    });
  markBest(months);

  const chartKey = (k: string) => `roi.${k}`;
  entries.forEach((e, i) => {
    for (const k of paid) {
      const f = figures(v(e, k, "investment"), v(e, k, "revenue"));
      chartValues[i][chartKey(k)] = metric === "roas" ? f.roas : f.roi;
    }
  });
  const chart: ChartSpec | null =
    months.length > 1
      ? {
          key: "roi",
          title: metric === "roas" ? "Retorno por canal pago" : "ROI por canal pago",
          unit: metric === "roas" ? "x" : "%",
          kind: "line",
          series: paid.map((k) => ({ key: chartKey(k), label: label(k), format: metric === "roas" ? "multiplier" : "percent", digits: 1, color: colorOf.get(k) ?? OTHER_COLOR })),
        }
      : null;

  return {
    metric,
    basis: "channels",
    paidNames: paid.map(label),
    otherNames: keys.filter((k) => !paid.includes(k)).map(label),
    total,
    channels,
    table,
    months,
    chart,
  };
}

/** Marca o melhor mês e a barra de cada um em relação a ele. */
function markBest(months: RoiMonthCard[]) {
  const top = Math.max(0, ...months.map((m) => m.roas ?? 0));
  for (const m of months) {
    m.bar = top > 0 ? Math.max(0.04, (m.roas ?? 0) / top) : 0;
    m.best = months.length > 2 && top > 0 && m.roas === top;
  }
}

/**
 * Detalhamentos (serviços, terapeutas…) acumulados no ano: ranking pela receita (ou pela
 * medida que houver), quantidade mês a mês, ticket, participação e o status mais recente.
 */
function buildDimensions(entries: readonly ReportIndexEntry[], axis: string[], focusKey: string, chartValues: Values[]): DimensionTab[] {
  const dimKeys = [...new Set(entries.flatMap((e) => Object.keys(e.labels).flatMap((k) => /^dim\.([^.]+)$/.exec(k)?.[1] ?? [])))];
  return dimKeys.flatMap((d) => {
    const itemKeys = [...new Set(entries.flatMap((e) => Object.keys(e.labels).flatMap((k) => (k.startsWith(`dim.${d}.`) && k.split(".").length === 3 && k !== `dim.${d}.q` ? [k.split(".")[2]] : []))))];
    if (!itemKeys.length) return [];
    const val = (e: ReportIndexEntry, item: string, m: string) => e.summary[`dim.${d}.${item}.${m}`] ?? null;
    const sum = (item: string, m: string) => sumKey(entries.map((e) => ({ x: val(e, item, m) })), "x");
    const measures = (["revenue", "quantity", "conversions", "leads"] as const).filter((m) => itemKeys.some((item) => sum(item, m) !== null));
    if (!measures.length) return [];
    const rankedBy = measures[0];
    const periodMeasure = measures.includes("quantity") ? "quantity" : rankedBy;
    const quantityLabel = labelOf(entries, `dim.${d}.q`) ?? "Quantidade";
    const periodMeasureLabel = periodMeasure === "quantity" ? quantityLabel : periodMeasure === "revenue" ? "Receita" : periodMeasure === "conversions" ? "Conversões" : "Leads";
    const present = entries.map((e, i) => ({ e, i })).filter(({ e }) => itemKeys.some((item) => isFiniteNumber(val(e, item, periodMeasure))));
    const totalRevenue = sumKey(itemKeys.map((item) => ({ x: sum(item, "revenue") })), "x");

    // Ranking pela medida principal; item só com status (sem números no ano) fica de fora.
    const main = new Map(itemKeys.map((item) => [item, sum(item, rankedBy)]));
    const rows: DimensionRowView[] = itemKeys
      .filter((item) => isFiniteNumber(main.get(item)))
      .sort((a, b) => (main.get(b) ?? -1) - (main.get(a) ?? -1))
      .map((item, i) => {
        const quantity = sum(item, "quantity");
        const revenue = sum(item, "revenue");
        let status: string | null = null;
        for (let j = entries.length - 1; j >= 0 && status === null; j--) status = entries[j].labels[`dim.${d}.${item}.note`] ?? null;
        const firstSeen = entries.find((e) => isFiniteNumber(val(e, item, periodMeasure)));
        return {
          key: item,
          label: labelOf(entries, `dim.${d}.${item}`) ?? item,
          rank: i + 1,
          byPeriod: Object.fromEntries(present.map(({ e }) => [e.periodKey, val(e, item, periodMeasure)])),
          quantity,
          revenue,
          averageTicket: safeDivide(revenue, quantity ?? sum(item, "conversions")),
          share: safeDivide(revenue, totalRevenue),
          status,
          statusTone: statusTone(status),
          isNew: entries.length > 1 && firstSeen?.periodKey === focusKey,
        };
      });

    const color = new Map(rows.map((r, i) => [r.key, PALETTE[i] ?? OTHER_COLOR]));
    const label = labelOf(entries, `dim.${d}`) ?? d;
    const item = lowerFirst(singularizePt(label));
    const distributions = [
      measures.includes("quantity") ? distribution("quantidade", `${quantityLabel} por ${item}`, "acumulado", "integer", rows.map((r) => ({ key: r.key, label: r.label, value: r.quantity, color: color.get(r.key)! }))) : null,
      measures.includes("revenue") ? distribution("receita", `Receita por ${item}`, "R$ acumulado", "currency", rows.map((r) => ({ key: r.key, label: r.label, value: r.revenue, color: color.get(r.key)! }))) : null,
    ].filter((x) => x !== null);

    let evolution: ChartSpec | null = null;
    if (present.length > 1) {
      const shown = rows.length > MAX_STACK ? rows.slice(0, MAX_STACK - 1) : rows;
      const grouped = rows.slice(shown.length);
      const series: ChartSeries[] = shown.map((r) => ({ key: `dim.${d}.${r.key}.${periodMeasure}`, label: r.label, format: periodMeasure === "revenue" ? "currency" : "integer", color: color.get(r.key)! }));
      if (grouped.length) {
        series.push({ key: `dim.${d}.__outros.${periodMeasure}`, label: "Outros", format: periodMeasure === "revenue" ? "currency" : "integer", color: OTHER_COLOR });
        entries.forEach((e, i) => (chartValues[i][`dim.${d}.__outros.${periodMeasure}`] = sumKey(grouped.map((r) => ({ x: val(e, r.key, periodMeasure) })), "x")));
      }
      evolution = { key: `evolucao-${d}`, title: `Evolução de ${lowerFirst(periodMeasureLabel)}`, unit: `por ${entries[0].period.granularity === "week" ? "semana" : "mês"}`, kind: "stacked", series };
    }

    const totalQuantity = sumKey(rows.map((r) => ({ x: r.quantity })), "x");
    return [
      {
        key: d,
        label,
        quantityLabel,
        periodMeasureLabel,
        rankedBy,
        distributions,
        evolution,
        periods: present.map(({ e, i }) => ({ key: e.periodKey, label: axis[i] })),
        rows,
        total: {
          byPeriod: Object.fromEntries(present.map(({ e }) => [e.periodKey, sumKey(itemKeys.map((it) => ({ x: val(e, it, periodMeasure) })), "x")])),
          quantity: totalQuantity,
          revenue: totalRevenue,
          averageTicket: safeDivide(totalRevenue, totalQuantity),
        },
        hasStatus: rows.some((r) => r.status),
        hasRevenue: measures.includes("revenue"),
      },
    ];
  });
}

/** Retorno dos canais pagos de um período (para o comparativo). */
function paidReturn(entry: ReportIndexEntry): number | null {
  const keys = channelKeysOf([entry]).filter((k) => (entry.summary[`channel.${k}.investment`] ?? 0) > 0);
  if (!keys.length) return isFiniteNumber(entry.summary.investment) && entry.summary.investment > 0 ? safeDivide(entry.summary.attributedRevenue ?? null, entry.summary.investment) : null;
  const inv = sumKey(keys.map((k) => ({ x: entry.summary[`channel.${k}.investment`] })), "x");
  const rev = sumKey(keys.map((k) => ({ x: entry.summary[`channel.${k}.revenue`] })), "x");
  return safeDivide(rev, inv);
}

function buildComparison(
  focus: ReportIndexEntry,
  previous: ReportIndexEntry,
  cur: Values,
  prev: Values,
  stageKeys: string[],
  stageLabel: (key: string) => string,
  firstLabel: string,
  finalLabel: string,
  notes: CommercialData["comparisonNotes"],
): NonNullable<CommercialDashboardVM["comparison"]> {
  const row = (key: string, label: string, c: number | null | undefined, p: number | null | undefined, format: ValueFormat, extra: Partial<ComparisonRow> = {}): ComparisonRow => ({
    key,
    label,
    current: c ?? null,
    previous: p ?? null,
    format,
    delta: deltaOf(c, p, format),
    note: null,
    ...extra,
  });
  const rows: ComparisonRow[] = [
    ...stageKeys.map((s) => row(`stage.${s}`, stageLabel(s), cur[`stage.${s}`], prev[`stage.${s}`], "integer")),
    row("revenue", "Receita", cur.revenue, prev.revenue, "currency"),
    row("averageTicket", "Ticket médio", cur.averageTicket, prev.averageTicket, "currency"),
    row("conversionRate", "Taxa de conversão", cur.conversionRate, prev.conversionRate, "percent"),
  ];
  // Com 3 etapas ou mais: a passagem da penúltima para a última (ex.: taxa de comparecimento).
  if (stageKeys.length >= 3) {
    const [a, b] = stageKeys.slice(-2);
    rows.push(row("finalRate", `Taxa de ${lowerFirst(singularizePt(stageLabel(b)))}`, safeDivide(cur[`stage.${b}`], cur[`stage.${a}`]), safeDivide(prev[`stage.${b}`], prev[`stage.${a}`]), "percent"));
  }
  rows.push(row("newCustomers", "Novos clientes", cur.newCustomers, prev.newCustomers, "integer"));
  rows.push(row("returningCustomers", "Clientes recorrentes", cur.returningCustomers, prev.returningCustomers, "integer"));
  rows.push(row("paidReturn", "Retorno dos canais pagos", paidReturn(focus), paidReturn(previous), "multiplier", { perReal: true }));
  const visible = rows.filter((r) => isFiniteNumber(r.current) || isFiniteNumber(r.previous));

  // Leitura da Look: casa pelo nome do indicador (com alguns sinônimos); o que não casar vira linha própria.
  const aliases: Record<string, string[]> = {
    revenue: ["receita", "faturamento"],
    averageTicket: ["ticket", "ticket medio"],
    conversionRate: ["conversao", "taxa de conversao"],
    newCustomers: ["novos", "novos clientes"],
    returningCustomers: ["recorrentes", "clientes recorrentes", "recorrencia"],
    paidReturn: ["roi", "roas", "retorno", "roi canais pagos", "retorno dos canais pagos", "roi dos canais pagos"],
    [`stage.${stageKeys[0]}`]: [normalizeText(firstLabel), "leads"],
    [`stage.${stageKeys[stageKeys.length - 1]}`]: [normalizeText(finalLabel)],
  };
  const extra: ComparisonRow[] = [];
  for (const note of notes) {
    const n = normalizeText(note.label);
    const target = visible.find((r) => normalizeText(r.label) === n || (aliases[r.key] ?? []).includes(n));
    if (target && !target.note) target.note = note.text;
    else extra.push({ key: `nota-${extra.length}`, label: note.label, current: null, previous: null, format: "integer", delta: null, note: note.text });
  }
  const all = [...visible, ...extra];
  return { previousName: periodName(previous.period), currentName: periodName(focus.period), rows: all, hasNotes: all.some((r) => r.note) };
}

function isActionPlan(title: string): boolean {
  return /^(plano de acao|plano de acoes|acoes|proximos passos)\b/.test(normalizeText(title));
}

function isOpportunity(title: string): boolean {
  return /^(oportunidades?|agendamentos futuros|agenda futura)\b/.test(normalizeText(title));
}

/** Retorno por R$ 1 em três faixas: abaixo de 1x (não se pagou), até 3x e acima. */
export function returnTone(roas: number | null | undefined): BadgeTone {
  if (!isFiniteNumber(roas)) return "neutral";
  return roas < 1 ? "negative" : roas < 3 ? "attention" : "positive";
}

interface FunnelContext {
  entries: readonly ReportIndexEntry[];
  labels: ReturnType<typeof periodSeriesLabels>;
  rows: Values[];
  totals: Values;
  focusEntry: ReportIndexEntry;
  stageKeys: string[];
  stageLabel: (key: string) => string;
  firstStageLabel: string;
  finalStageLabel: string;
  unit: PeriodUnit;
  dashboard: DashboardConfig;
  chartValues: Values[];
  paidNames: string[];
}

/**
 * Modelo "funil" (dashboard da Dra. Isabor): o funil do mês com as taxas entre etapas,
 * mídia e receita por canal no mês, o comparativo de todos os indicadores mês a mês, o
 * retorno geral e por canal pago e a oportunidade de crescimento.
 */
function buildFunnelView(ctx: FunnelContext): FunnelLayoutView {
  const { entries, labels, rows, totals, focusEntry, stageKeys, stageLabel, firstStageLabel, finalStageLabel, unit, dashboard, chartValues } = ctx;
  const n = entries.length;
  const focus = rows[n - 1];
  const prevRow = n > 1 ? rows[n - 2] : null;
  const firstPeriod = entries[0].period;
  const focusPeriod = focusEntry.period;
  const short = (p: Period) => (p.granularity === "month" ? cap(MONTHS_SHORT_PT[monthIndex(p)]) : formatPeriod(p, "compact"));
  const rangeArrow = n > 1 ? `${short(firstPeriod)} → ${short(focusPeriod)}` : periodName(focusPeriod);
  const singular = (label: string) => singularizePt(label);
  const stepLabel = (from: string, to: string) => `${singular(stageLabel(from))} → ${lowerFirst(singular(stageLabel(to)))}`;
  const metric = dashboard.roiMetric === "roiPercent" ? "roiPercent" : "roas";
  const keyOf = (s: string) => `stage.${s}`;

  // Destaque do mês e acumulado (6 cartões, com a receita em evidência).
  const banner: BannerKpi[] = (
    [
      { key: "leads", label: firstStageLabel, format: "integer" },
      { key: "conversions", label: finalStageLabel, format: "integer" },
      { key: "revenue", label: "Receita", format: "currency" },
      { key: "averageTicket", label: "Ticket médio", format: "currency" },
      { key: "conversionRate", label: `Conversão ${firstStageLabel.charAt(0)}→${finalStageLabel.charAt(0)}`, format: "percent" },
      { key: "newCustomers", label: "Novos clientes", format: "integer" },
      { key: "returningCustomers", label: "Recorrentes", format: "integer" },
    ] satisfies Array<{ key: string; label: string; format: ValueFormat }>
  )
    .filter((b) => isFiniteNumber(focus[b.key]))
    .map((b) => ({ ...b, value: focus[b.key] ?? null, delta: prevRow ? deltaOf(focus[b.key], prevRow[b.key], b.format) : null }));

  const first = totals[keyOf(stageKeys[0])] ?? totals.leads;
  const accents: Accent[] = ["blue", "sky", "teal", "green"];
  const accumulated: FunnelLayoutView["accumulated"] = (
    [
      ...stageKeys.map((s, i) => ({
        key: keyOf(s),
        label: stageLabel(s),
        value: totals[keyOf(s)] ?? null,
        format: "integer" as const,
        sub: i === 0 ? rangeArrow : isFiniteNumber(first) && first > 0 && isFiniteNumber(totals[keyOf(s)]) ? `${formatPercent((totals[keyOf(s)] as number) / first)} dos ${lowerFirst(firstStageLabel)}` : null,
        accent: accents[Math.min(i, accents.length - 1)],
        icon: (i === 0 ? "leads" : "conversions") as CardIcon,
      })),
      { key: "revenue", label: "Receita total", value: totals.revenue, format: "currency", sub: rangeArrow, accent: "cyan", icon: "revenue", highlight: true },
      { key: "averageTicket", label: "Ticket médio", value: totals.averageTicket, format: "currency", sub: `média de ${n} ${n === 1 ? unit.singular : unit.plural}`, accent: "gold", icon: "ticket" },
      { key: "investment", label: "Investimento", value: totals.investment, format: "currency", sub: ctx.paidNames.length ? ctx.paidNames.join(" + ") : null, accent: "purple", icon: "investment" },
      { key: "newCustomers", label: "Novos clientes", value: totals.newCustomers, format: "integer", sub: null, accent: "blue", icon: "new" },
      { key: "returningCustomers", label: "Clientes recorrentes", value: totals.returningCustomers, format: "integer", sub: null, accent: "green", icon: "returning" },
    ] satisfies FunnelLayoutView["accumulated"]
  ).filter((k) => isFiniteNumber(k.value));

  // Funil do mês em foco: barras com as taxas entre etapas e a conversão de ponta a ponta.
  const firstValue = focus[keyOf(stageKeys[0])] ?? null;
  const stages = stageKeys.map((s) => {
    const value = focus[keyOf(s)] ?? null;
    const share = isFiniteNumber(value) && isFiniteNumber(firstValue) && firstValue > 0 ? value / firstValue : 0;
    return { key: s, label: stageLabel(s), value, width: Math.max(0.26, Math.min(1, Math.sqrt(share))) };
  });
  const steps: FunnelStep[] = stageKeys.slice(1).map((s, i) => ({ label: stepLabel(stageKeys[i], s), rate: safeDivide(focus[keyOf(s)], focus[keyOf(stageKeys[i])]) }));
  const overall: FunnelStep | null = stageKeys.length > 2 ? { label: stepLabel(stageKeys[0], stageKeys[stageKeys.length - 1]), rate: focus.conversionRate ?? null } : null;
  const rateSlices = [...steps, ...(overall ? [overall] : [])]
    .map((s, i) => ({ key: `taxa-${i}`, label: s.label, value: s.rate, color: i === steps.length ? "var(--primary)" : PALETTE[i % PALETTE.length] }))
    .filter((s): s is typeof s & { value: number } => isFiniteNumber(s.value));
  const rates: DistributionSpec | null = rateSlices.length ? { key: "taxas", title: `Taxas de conversão — ${periodName(focusPeriod)}`, unit: "eficiência por etapa", format: "percent", kind: "bars", slices: rateSlices, labelWidth: 190 } : null;

  // Canais no mês em foco: investimento dos pagos, receita e leads de cada canal.
  const colors = channelColors(entries);
  const focusKeys = channelKeysOf([focusEntry]);
  const v = (e: ReportIndexEntry, k: string, m: string) => e.summary[`channel.${k}.${m}`] ?? null;
  const channelRows: FocusChannelRow[] = focusKeys.map((k) => ({
    key: k,
    label: labelOf(entries, `channel.${k}`) ?? k,
    color: colors.get(k) ?? OTHER_COLOR,
    leads: v(focusEntry, k, "leads"),
    conversions: v(focusEntry, k, "conversions"),
    conversionRate: safeDivide(v(focusEntry, k, "conversions"), v(focusEntry, k, "leads")),
    revenue: v(focusEntry, k, "revenue"),
    investment: v(focusEntry, k, "investment"),
  }));
  const focusUnattributed = unattributedLeads([focusEntry], focusKeys)[focusEntry.periodKey];
  if (focusUnattributed) {
    channelRows.push({ key: UNATTRIBUTED, label: "Sem atribuição", color: OTHER_COLOR, unattributed: true, leads: focusUnattributed, conversions: null, conversionRate: null, revenue: null, investment: null });
  }
  const paid = channelRows.filter((c) => (c.investment ?? 0) > 0);
  const sumOf = (list: FocusChannelRow[], m: "leads" | "conversions" | "revenue" | "investment") => sumKey(list.map((c) => ({ x: c[m] })), "x");
  const focusChannels: FunnelLayoutView["focusChannels"] = channelRows.length
    ? {
        rows: [...channelRows].sort((a, b) => (b.revenue ?? -1) - (a.revenue ?? -1) || (b.leads ?? -1) - (a.leads ?? -1)),
        paid,
        total: { leads: sumOf(channelRows, "leads"), conversions: sumOf(channelRows, "conversions"), revenue: sumOf(channelRows, "revenue"), investment: sumOf(paid, "investment") },
        investment: paid.length ? distribution("investimento", "Investimento em mídia", "canais pagos", "currency", paid.map((c) => ({ key: c.key, label: c.label, value: c.investment, color: c.color }))) : null,
        leads: distribution("leads", `${firstStageLabel} por canal`, periodName(focusPeriod), "integer", channelRows.map((c) => ({ key: c.key, label: c.label, value: c.leads, color: c.color }))),
        hasLeads: channelRows.some((c) => isFiniteNumber(c.leads)),
        hasConversions: channelRows.some((c) => isFiniteNumber(c.conversions)),
      }
    : null;

  // Retorno: geral (Financeiro) e de cada canal pago, mês a mês.
  const allKeys = channelKeysOf(entries);
  const paidKeys = allKeys.filter((k) => entries.some((e) => (v(e, k, "investment") ?? 0) > 0));
  const overallOf = (s: ReportIndexEntry["summary"]) => figures(s.investment ?? null, s.attributedRevenue ?? s.revenue ?? null);
  const withInvestment = entries.filter((e) => (e.summary.investment ?? 0) > 0);
  const roiMonths = withInvestment.map((e) => {
    const i = entries.indexOf(e);
    return { key: e.periodKey, label: labels[i].row, focus: e.periodKey === focusEntry.periodKey, overall: overallOf(e.summary), channels: Object.fromEntries(paidKeys.map((k) => [k, figures(v(e, k, "investment"), v(e, k, "revenue"))])) };
  });
  const channelTotal = (k: string) => {
    const months = entries.filter((e) => (v(e, k, "investment") ?? 0) > 0);
    return figures(sumKey(months.map((e) => ({ x: v(e, k, "investment") })), "x"), sumKey(months.map((e) => ({ x: v(e, k, "revenue") })), "x"));
  };
  const overallTotal = figures(sumKey(withInvestment.map((e) => e.summary), "investment"), sumKey(withInvestment.map((e) => ({ x: e.summary.attributedRevenue ?? e.summary.revenue })), "x"));
  const shown = (f: RoiFigures) => (metric === "roas" ? f.roas : f.roi);
  entries.forEach((e, i) => {
    chartValues[i]["roi.geral"] = shown(overallOf(e.summary));
    for (const k of paidKeys) chartValues[i][`roi.${k}`] = shown(figures(v(e, k, "investment"), v(e, k, "revenue")));
  });
  const fmtReturn = (f: RoiFigures) => (metric === "roas" ? formatMultiplier(f.roas) : formatPercent(f.roi));
  const story: string[] = [];
  if (isFiniteNumber(overallTotal.roas)) {
    story.push(
      metric === "roas"
        ? `Cada R$ 1,00 investido em mídia retornou ${formatCurrency(overallTotal.roas)} em receita.`
        : `O retorno sobre o investimento em mídia foi de ${formatPercent(overallTotal.roi, 1)} (${formatCurrency(overallTotal.roas)} para cada R$ 1,00 investido).`,
    );
  }
  if (roiMonths.length > 2) {
    const best = [...roiMonths].sort((a, b) => (b.overall.roas ?? -Infinity) - (a.overall.roas ?? -Infinity))[0];
    const topRevenue = [...roiMonths].sort((a, b) => (b.overall.revenue ?? -Infinity) - (a.overall.revenue ?? -Infinity))[0];
    const lowestInvestment = [...roiMonths].sort((a, b) => (a.overall.investment ?? Infinity) - (b.overall.investment ?? Infinity))[0];
    let sentence = `${best.label} foi o melhor ${unit.singular} em retorno (${fmtReturn(best.overall)})`;
    if (topRevenue.key === best.key) sentence += ` e em receita (${formatCurrency(best.overall.revenue, "BRL", { noCents: true })})`;
    if (lowestInvestment.key === best.key) sentence += `, com o menor investimento da série (${formatCurrency(best.overall.investment, "BRL", { noCents: true })})`;
    story.push(`${sentence}.`);
  }
  const focusPaid = figures(sumKey(paidKeys.map((k) => ({ x: v(focusEntry, k, "investment") })), "x"), sumKey(paidKeys.map((k) => ({ x: (v(focusEntry, k, "investment") ?? 0) > 0 ? v(focusEntry, k, "revenue") : null })), "x"));
  if (paidKeys.length && isFiniteNumber(focusPaid.roas) && focusPaid.roas !== overallOf(focusEntry.summary).roas) {
    story.push(
      focusPaid.roas >= 1
        ? `Em ${periodName(focusPeriod)}, só a receita vinda dos canais pagos já cobriu o investimento ${formatMultiplier(focusPaid.roas).replace("x", "")} vezes.`
        : `Em ${periodName(focusPeriod)}, a receita vinda dos canais pagos cobriu ${formatPercent(focusPaid.roas)} do investimento.`,
    );
  }
  const cards: ChannelMonthCard[] = entries.flatMap((e, i) =>
    paidKeys
      .filter((k) => (v(e, k, "investment") ?? 0) > 0)
      .map((k) => ({ key: `${e.periodKey}-${k}`, channel: labelOf(entries, `channel.${k}`) ?? k, month: labels[i].row, focus: e.periodKey === focusEntry.periodKey, leads: v(e, k, "leads"), conversions: v(e, k, "conversions"), ...figures(v(e, k, "investment"), v(e, k, "revenue")) })),
  );
  const roiFormat: ValueFormat = metric === "roas" ? "multiplier" : "percent";
  const roi: FunnelLayoutView["roi"] = withInvestment.length
    ? {
        metric,
        overall: overallTotal,
        story,
        bars:
          isFiniteNumber(overallTotal.investment) && isFiniteNumber(overallTotal.revenue)
            ? { key: "investido-receita", title: "Investido × receita", unit: "acumulado", format: "currency", kind: "bars", labelWidth: 120, slices: [{ key: "investido", label: "Investido", value: overallTotal.investment, color: "var(--dash-4)" }, { key: "receita", label: "Receita gerada", value: overallTotal.revenue, color: "var(--primary)" }] }
            : null,
        chart:
          roiMonths.length > 1
            ? {
                key: "roi-mensal",
                title: `${metric === "roas" ? "Retorno" : "ROI"} geral${paidKeys.length ? " e por canal" : ""}`,
                unit: metric === "roas" ? "x" : "%",
                kind: "line",
                series: [
                  { key: "roi.geral", label: "Geral", format: roiFormat, digits: 1, color: "var(--primary)" },
                  ...paidKeys.map((k) => ({ key: `roi.${k}`, label: labelOf(entries, `channel.${k}`) ?? k, format: roiFormat, digits: 1, color: colors.get(k) ?? OTHER_COLOR })),
                ],
              }
            : null,
        channels: paidKeys.map((k) => ({ key: k, label: labelOf(entries, `channel.${k}`) ?? k, color: colors.get(k) ?? OTHER_COLOR })),
        months: roiMonths,
        total: { overall: overallTotal, channels: Object.fromEntries(paidKeys.map((k) => [k, channelTotal(k)])) },
        cards,
      }
    : null;

  // Comparativo: todos os indicadores, mês a mês (o ano inteiro, nos relatórios mensais).
  const byKey = new Map(entries.map((e, i) => [e.periodKey, i]));
  const monthly = focusPeriod.granularity === "month";
  const year = +focusPeriod.start.slice(0, 4);
  const periods = monthly
    ? MONTHS_SHORT_PT.map((m, i) => ({ key: `${year}-${String(i + 1).padStart(2, "0")}`, label: cap(m), focus: `${year}-${String(i + 1).padStart(2, "0")}` === focusEntry.periodKey }))
    : entries.map((e, i) => ({ key: e.periodKey, label: labels[i].axis, focus: e.periodKey === focusEntry.periodKey }));
  const valuesOf = (fn: (i: number) => number | null | undefined) => Object.fromEntries(periods.map((p) => [p.key, byKey.has(p.key) ? (fn(byKey.get(p.key)!) ?? null) : null]));
  const row = (key: string, label: string, format: ValueFormat, fn: (i: number) => number | null | undefined, total: number | null, extra: Partial<ComparativoRow> = {}): ComparativoRow => ({ key, label, format, values: valuesOf(fn), total, ...extra });
  const hasAny = (r: ComparativoRow) => Object.values(r.values).some(isFiniteNumber);
  const revenueKeys = allKeys.filter((k) => entries.some((e) => isFiniteNumber(v(e, k, "revenue"))));
  const groups = [
    { key: "funil", label: "Funil", rows: stageKeys.map((s) => row(keyOf(s), stageLabel(s), "integer", (i) => rows[i][keyOf(s)], totals[keyOf(s)])) },
    {
      key: "conversoes",
      label: "Conversões",
      rows: [
        ...stageKeys.slice(1).map((s, j) => row(`taxa.${s}`, stepLabel(stageKeys[j], s), "percent", (i) => safeDivide(rows[i][keyOf(s)], rows[i][keyOf(stageKeys[j])]), safeDivide(totals[keyOf(s)], totals[keyOf(stageKeys[j])]))),
        ...(stageKeys.length > 2 ? [row("taxa.geral", stepLabel(stageKeys[0], stageKeys[stageKeys.length - 1]), "percent", (i) => rows[i].conversionRate, totals.conversionRate)] : []),
      ],
    },
    {
      key: "financeiro",
      label: "Financeiro",
      rows: [
        row("revenue", "Receita", "currency", (i) => rows[i].revenue, totals.revenue),
        row("averageTicket", "Ticket médio", "currency", (i) => rows[i].averageTicket, totals.averageTicket, { cents: true }),
        row("investment", "Investimento total", "currency", (i) => rows[i].investment, totals.investment, { cents: true }),
      ],
    },
    { key: "clientes", label: "Clientes", rows: [row("newCustomers", "Novos clientes", "integer", (i) => rows[i].newCustomers, totals.newCustomers), row("returningCustomers", "Clientes recorrentes", "integer", (i) => rows[i].returningCustomers, totals.returningCustomers)] },
    { key: "midia", label: "Mídia paga", rows: paidKeys.map((k) => row(`inv.${k}`, labelOf(entries, `channel.${k}`) ?? k, "currency", (i) => v(entries[i], k, "investment"), channelTotal(k).investment, { cents: true })) },
    {
      key: "retorno",
      label: metric === "roas" ? "Retorno (ROI)" : "ROI",
      rows: [
        row("roi.geral", `${metric === "roas" ? "Retorno" : "ROI"} geral`, roiFormat, (i) => shown(overallOf(entries[i].summary)), shown(overallTotal), { rated: true }),
        ...paidKeys.map((k) => row(`roi.${k}`, `${metric === "roas" ? "Retorno" : "ROI"} ${labelOf(entries, `channel.${k}`) ?? k}`, roiFormat, (i) => shown(figures(v(entries[i], k, "investment"), v(entries[i], k, "revenue"))), shown(channelTotal(k)), { rated: true })),
      ],
    },
    { key: "receita-canal", label: "Receita por canal", rows: revenueKeys.map((k) => row(`rev.${k}`, labelOf(entries, `channel.${k}`) ?? k, "currency", (i) => v(entries[i], k, "revenue"), sumKey(entries.map((e) => ({ x: v(e, k, "revenue") })), "x"))) },
  ]
    .map((g) => ({ ...g, rows: g.rows.filter(hasAny) }))
    .filter((g) => g.rows.length);

  const trendCharts: ChartSpec[] = [];
  if (rows.some((r) => isFiniteNumber(r.revenue)) || rows.some((r) => isFiniteNumber(r.investment))) {
    trendCharts.push({
      key: "receita-investimento",
      title: "Receita e investimento",
      unit: `por ${unit.singular} (R$)`,
      kind: "bar",
      series: [
        { key: "revenue", label: "Receita", format: "currency", color: "var(--primary)" },
        { key: "investment", label: "Investimento", format: "currency", color: "var(--dash-4)" },
      ].filter((s) => rows.some((r) => isFiniteNumber(r[s.key]))) as ChartSeries[],
    });
  }
  trendCharts.push({ key: "funil-volumes", title: "Funil — volumes", unit: stageKeys.map((s) => stageLabel(s)).join(", "), kind: "bar", series: stageKeys.map((s, i) => ({ key: keyOf(s), label: stageLabel(s), format: "integer", color: ["var(--dash-7)", "var(--dash-1)", "var(--dash-2)", "var(--dash-3)"][i % 4] })) });

  // Oportunidade: o volume do melhor mês de leads com a conversão e o ticket do mês em foco.
  let growth: FunnelLayoutView["growth"] = null;
  const peakIdx = rows.reduce((best, r, i) => ((r.leads ?? -1) > (rows[best].leads ?? -1) ? i : best), 0);
  const peakLeads = rows[peakIdx].leads ?? null;
  const conversion = focus.conversionRate ?? null;
  const ticket = focus.averageTicket ?? null;
  if (peakIdx !== n - 1 && isFiniteNumber(peakLeads) && isFiniteNumber(conversion) && isFiniteNumber(ticket) && isFiniteNumber(focus.revenue) && focus.revenue > 0 && peakLeads > (focus.leads ?? 0)) {
    const projected = Math.floor(peakLeads * conversion);
    const revenue = Math.round((projected * ticket) / 10) * 10;
    const gain = revenue / focus.revenue - 1;
    if (gain > 0) growth = { peakName: periodName(entries[peakIdx].period), peakLeads, conversion, projected, ticket, revenue, growth: gain, extra: projected - (focus.conversions ?? 0), peakInvestment: rows[peakIdx].investment ?? null };
  }

  return { rangeArrow, banner, accumulated, funnel: { stages, steps, overall, rates }, focusChannels, comparativo: { periods, groups }, trendCharts, roi, growth };
}

/** Plano de ação em cartões: Prioridade/Tema → selo, Ação → título, Detalhes → texto. */
function actionCards(table: CommercialData["tables"][number]): ActionCard[] {
  const cols = table.columns.map((c) => normalizeText(c));
  const find = (re: RegExp) => cols.findIndex((c) => re.test(c));
  let tagIdx = find(/^(prioridade|#|ordem|tema|area|frente|tipo)/);
  let titleIdx = find(/^(acao|acoes|titulo|o que|passo|iniciativa|tarefa)/);
  if (titleIdx < 0) titleIdx = cols.findIndex((_, i) => i !== tagIdx);
  if (tagIdx === titleIdx) tagIdx = -1;
  const rest = cols.map((_, i) => i).filter((i) => i !== tagIdx && i !== titleIdx);
  return table.rows.map((r) => {
    const rawTag = tagIdx >= 0 ? r[tagIdx]?.trim() : "";
    const tag = rawTag ? (/^\d/.test(rawTag) && /^prioridade/.test(cols[tagIdx]) ? `Prioridade ${rawTag}` : rawTag) : null;
    const text = rest.map((i) => r[i]?.trim()).filter(Boolean);
    return { tag, title: r[titleIdx]?.trim() || text.shift() || "", text: text.join(" · ") };
  });
}
