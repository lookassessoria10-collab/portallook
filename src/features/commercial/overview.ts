import { formatCurrency, formatInteger, isFiniteNumber } from "@/lib/format/number";
import { averageKey, inverseWeightedRatio, ratioOfSums, sumKey } from "@/lib/metrics/aggregate";
import { safeDivide } from "@/lib/metrics/safe-math";
import { METRICS, type MetricKey } from "@/lib/metrics/definitions";
import { formatPeriodRange, periodSeriesLabels, periodUnit, type PeriodUnit } from "@/lib/dates/period";
import { costPerLabel, lowerFirst } from "@/lib/format/text";
import type { SeriesDef, SeriesPoint } from "@/components/charts/types";
import type { PeriodTableColumn, PeriodTableData } from "@/components/dashboard/period-table";
import type { DashboardConfig } from "@/features/clients/schema";
import type { ReportIndexEntry } from "@/features/reports/schema";
import { computeChannelMetrics, type DimensionMeasure } from "./metrics";
import { ChannelKindSchema, type ChannelRow } from "./schema";
import { channelMeta, orderByConfig, type ChannelView, type KpiIcon, type KpiView } from "./view-model";

/** Item de um detalhamento somado em todos os períodos (ex.: uma terapeuta no ano). */
export interface DimensionOverviewRow {
  key: string;
  label: string;
  quantity: number | null;
  revenue: number | null;
  leads: number | null;
  conversions: number | null;
  averageTicket: number | null;
  /** Participação na medida principal do detalhamento. */
  share: number | null;
  /** Status mais recente informado (ex.: "Ativa", "Destaque Ago"). */
  status: string | null;
  /** Medida principal em cada período (chave do período → valor). */
  byPeriod: Record<string, number | null>;
}

export interface DimensionOverview {
  key: string;
  label: string;
  measure: DimensionMeasure;
  measureLabel: string;
  quantityLabel: string | null;
  rows: DimensionOverviewRow[];
  total: number | null;
  /** Colunas da tabela período a período (só períodos em que o detalhamento apareceu). */
  periods: Array<{ key: string; label: string }>;
  /** O que a tabela período a período mostra (ex.: "Atendimentos"). */
  periodMeasure: DimensionMeasure;
  periodMeasureLabel: string;
}

export interface CommercialOverviewViewModel {
  unit: PeriodUnit;
  count: number;
  rangeLabel: string;
  headline: string;
  firstStageLabel: string;
  finalStageLabel: string;
  kpis: KpiView[];
  secondary: KpiView[];
  points: SeriesPoint[];
  funnelSeries: SeriesDef[] | null;
  channelSeries: SeriesDef[] | null;
  /** Receita de cada canal por período (os maiores; o resto em "Outros"). */
  channelRevenueSeries: SeriesDef[] | null;
  financialSeries: SeriesDef[] | null;
  /** Novos × recorrentes por período. */
  customerSeries: SeriesDef[] | null;
  efficiencySeries: SeriesDef[];
  /** Canais somados em todos os períodos (mesmo formato do relatório do mês). */
  channels: { rows: ChannelView[]; measures: Array<"leads" | "revenue" | "conversions"> } | null;
  /** Retorno de cada canal com investimento, período a período. */
  paidChannels: PeriodTableData | null;
  dimensions: DimensionOverview[];
  table: PeriodTableData;
}

type Values = Record<string, number | null>;

/** Canais com cor própria; do 6º em diante viram "Outros" (mesma regra da paleta). */
const MAX_CHANNEL_SERIES = 5;
const OTHER_CHANNELS = "channel.__others.leads";
const OTHER_CHANNELS_REVENUE = "channel.__others.revenue";

const DIMENSION_MEASURE_LABEL: Record<DimensionMeasure, string> = { revenue: "Receita", quantity: "Quantidade", conversions: "Conversões", leads: "Leads" };

function labelOf(entries: readonly ReportIndexEntry[], key: string): string | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    const label = entries[i].labels[key];
    if (label) return label;
  }
  return null;
}

/**
 * Visão geral comercial: soma vários períodos a partir do resumo do índice.
 * Taxas (conversão, CPL, ROAS, ticket) são recalculadas sobre as somas.
 * `entries` em ordem cronológica.
 */
export function buildCommercialOverview(entries: readonly ReportIndexEntry[], input: { dashboard: DashboardConfig; currency?: string }): CommercialOverviewViewModel {
  const currency = input.currency ?? "BRL";
  const last = entries[entries.length - 1];
  const unit = periodUnit(last.period.granularity);
  const labels = periodSeriesLabels(entries.map((e) => e.period));
  const rangeLabel = formatPeriodRange(entries[0].period, last.period);
  const firstStageLabel = labelOf(entries, "firstStage") ?? "Leads";
  const finalStageLabel = labelOf(entries, "finalStage") ?? "Conversões";
  const summaries = entries.map((e) => e.summary);

  // Canais: os maiores (em leads ou em receita) ganham cor; o restante é somado em "Outros".
  const channelKeys = [...new Set(entries.flatMap((e) => Object.keys(e.summary).flatMap((k) => /^channel\.(.+)\.(leads|revenue|investment|conversions)$/.exec(k)?.[1] ?? [])))].filter((k) => k !== "__others");
  const ranked = (measure: "leads" | "revenue") => channelKeys.map((key) => ({ key, value: sumKey(summaries, `channel.${key}.${measure}`) })).filter((c) => c.value !== null).sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const split = (list: Array<{ key: string }>) => {
    const shown = list.length > MAX_CHANNEL_SERIES ? list.slice(0, MAX_CHANNEL_SERIES - 1) : list;
    return { shown, grouped: list.slice(shown.length) };
  };
  const leadChannels = split(ranked("leads"));
  const revenueChannels = split(ranked("revenue"));

  const rows: Values[] = entries.map((e) => {
    // Base do ticket médio: vendas ou, sem elas, conversões (mesma regra do período).
    const v: Values = { ...e.summary, ticketBase: e.summary.sales ?? e.summary.conversions ?? null };
    if (leadChannels.grouped.length) v[OTHER_CHANNELS] = sumKey(leadChannels.grouped.map((c) => ({ x: e.summary[`channel.${c.key}.leads`] })), "x");
    if (revenueChannels.grouped.length) v[OTHER_CHANNELS_REVENUE] = sumKey(revenueChannels.grouped.map((c) => ({ x: e.summary[`channel.${c.key}.revenue`] })), "x");
    return v;
  });

  const roas = ratioOfSums(rows, "attributedRevenue", "investment");
  const totals: Values = {
    leads: sumKey(rows, "leads"),
    conversions: sumKey(rows, "conversions"),
    revenue: sumKey(rows, "revenue"),
    attributedRevenue: sumKey(rows, "attributedRevenue"),
    investment: sumKey(rows, "investment"),
    sales: sumKey(rows, "sales"),
    conversionRate: ratioOfSums(rows, "conversions", "leads"),
    cpl: ratioOfSums(rows, "investment", "leads"),
    cpa: ratioOfSums(rows, "investment", "conversions"),
    roas,
    roiPercent: roas === null ? null : roas - 1,
    averageTicket: ratioOfSums(rows, "revenue", "ticketBase") ?? inverseWeightedRatio(rows, "revenue", "averageTicket"),
    newCustomers: sumKey(rows, "newCustomers"),
    returningCustomers: sumKey(rows, "returningCustomers"),
  };

  const per = `por ${unit.singular}`;
  const kpi = (key: MetricKey, icon: KpiIcon, overrides: Partial<KpiView> = {}): KpiView => {
    const def = METRICS[key];
    return {
      key,
      label: overrides.label ?? def.label,
      value: totals[key] ?? null,
      format: def.format,
      comparison: null,
      trend: rows.map((r) => r[key] ?? null),
      description: overrides.description ?? def.description,
      footnote: overrides.footnote ?? null,
      icon,
    };
  };
  const average = (key: string, format: (v: number) => string) => {
    const v = averageKey(rows, key);
    return v === null ? null : `Média de ${format(v)} ${per}`;
  };
  const integerAverage = (key: string) => average(key, (v) => formatInteger(v));

  // Mesma lógica de destaques do período, aplicada às somas.
  const roiKey: MetricKey = input.dashboard.roiMetric === "roiPercent" ? "roiPercent" : "roas";
  const candidates: KpiView[] = [];
  if (totals.leads !== null) candidates.push(kpi("leads", "leads", { label: firstStageLabel, description: `${firstStageLabel} somados em todos os períodos.`, footnote: integerAverage("leads") }));
  if (totals.conversions !== null) candidates.push(kpi("conversions", "conversions", { label: finalStageLabel, description: `${finalStageLabel} somados em todos os períodos.`, footnote: integerAverage("conversions") }));
  if (totals.revenue !== null) candidates.push(kpi("revenue", "revenue", { footnote: average("revenue", (v) => formatCurrency(v, currency, { noCents: true })) }));
  if (totals[roiKey] !== null) candidates.push(kpi(roiKey, "roas"));
  else if (totals.investment !== null) candidates.push(kpi("investment", "investment"));
  if (candidates.length < 4 && totals.conversionRate !== null) candidates.push(kpi("conversionRate", "rate"));
  if (candidates.length < 4 && totals.cpl !== null) candidates.push(kpi("cpl", "cost"));
  const kpis = orderByConfig(candidates, input.dashboard.highlightMetrics).slice(0, 4);

  const secondary: KpiView[] = [];
  const add = (key: MetricKey, icon: KpiIcon, label?: string, footnote?: string | null) => {
    if (totals[key] !== null && !kpis.some((k) => k.key === key)) secondary.push(kpi(key, icon, { label, footnote }));
  };
  add("conversionRate", "rate");
  add("investment", "investment");
  add("averageTicket", "ticket");
  add("cpl", "cost");
  add("cpa", "cost", costPerLabel(finalStageLabel));
  add("sales", "sales");
  const customerTotal = (totals.newCustomers ?? 0) + (totals.returningCustomers ?? 0);
  const customerShare = (v: number | null) => (v !== null && customerTotal > 0 ? `${Math.round((v / customerTotal) * 100)}% dos clientes` : null);
  add("newCustomers", "newFollowers", undefined, customerShare(totals.newCustomers));
  add("returningCustomers", "followers", undefined, customerShare(totals.returningCustomers));

  const has = (key: string) => rows.some((r) => isFiniteNumber(r[key]));
  const points: SeriesPoint[] = entries.map((e, i) => ({ key: e.periodKey, label: labels[i].axis, fullLabel: labels[i].full, values: rows[i] }));

  const funnelSeries: SeriesDef[] = [];
  if (has("leads")) funnelSeries.push({ key: "leads", label: firstStageLabel, format: "integer", slot: 1 });
  if (has("conversions")) funnelSeries.push({ key: "conversions", label: finalStageLabel, format: "integer", slot: 2 });

  const channelLabel = (key: string) => labelOf(entries, `channel.${key}`) ?? key;
  const channelSeriesOf = (list: ReturnType<typeof split>, measure: "leads" | "revenue", otherKey: string): SeriesDef[] => {
    const series: SeriesDef[] = list.shown.map((c, i) => ({ key: `channel.${c.key}.${measure}`, label: channelLabel(c.key), format: measure === "revenue" ? "currency" : "integer", slot: (i + 1) as 1 | 2 | 3 | 4 | 5 }));
    if (list.grouped.length) series.push({ key: otherKey, label: "Outros", format: measure === "revenue" ? "currency" : "integer", color: "var(--chart-other)" });
    return series;
  };
  const channelSeries = channelSeriesOf(leadChannels, "leads", OTHER_CHANNELS);
  const channelRevenueSeries = channelSeriesOf(revenueChannels, "revenue", OTHER_CHANNELS_REVENUE);

  const financialSeries: SeriesDef[] = [];
  if (has("revenue")) financialSeries.push({ key: "revenue", label: "Receita", format: "currency", slot: 1 });
  if (has("investment")) financialSeries.push({ key: "investment", label: "Investimento", format: "currency", slot: 2 });

  const customerSeries: SeriesDef[] = [];
  if (has("newCustomers")) customerSeries.push({ key: "newCustomers", label: "Novos clientes", format: "integer", slot: 1 });
  if (has("returningCustomers")) customerSeries.push({ key: "returningCustomers", label: "Recorrentes", format: "integer", slot: 2 });

  const efficiencySeries: SeriesDef[] = (
    [
      { key: "conversionRate", label: "Conversão", format: "percent" },
      { key: "cpl", label: "CPL", format: "currency" },
      roiKey === "roas" ? { key: "roas", label: "ROAS", format: "multiplier" } : { key: "roiPercent", label: "ROI", format: "percent" },
      { key: "averageTicket", label: "Ticket médio", format: "currency" },
    ] satisfies SeriesDef[]
  ).filter((s) => rows.filter((r) => isFiniteNumber(r[s.key])).length >= 2);

  const columns: PeriodTableColumn[] = (
    [
      { key: "leads", label: firstStageLabel, format: "integer", emphasis: true },
      { key: "conversions", label: finalStageLabel, format: "integer", emphasis: true },
      { key: "conversionRate", label: "Conversão", format: "percent" },
      { key: "revenue", label: "Receita", format: "currency", emphasis: true },
      { key: "investment", label: "Investimento", format: "currency" },
      roiKey === "roas" ? { key: "roas", label: "ROAS", format: "multiplier" } : { key: "roiPercent", label: "ROI", format: "percent" },
      { key: "averageTicket", label: "Ticket médio", format: "currency" },
      { key: "cpl", label: "CPL", format: "currency" },
      { key: "newCustomers", label: "Novos", format: "integer" },
      { key: "returningCustomers", label: "Recorrentes", format: "integer" },
    ] satisfies PeriodTableColumn[]
  ).filter((c) => has(c.key));

  return {
    unit,
    count: entries.length,
    rangeLabel,
    headline: buildHeadline(totals, rangeLabel, firstStageLabel, finalStageLabel, currency),
    firstStageLabel,
    finalStageLabel,
    kpis,
    secondary,
    points,
    funnelSeries: funnelSeries.length ? funnelSeries : null,
    channelSeries: channelSeries.length > 1 ? channelSeries : null,
    channelRevenueSeries: channelRevenueSeries.length > 1 ? channelRevenueSeries : null,
    financialSeries: financialSeries.length ? financialSeries : null,
    customerSeries: customerSeries.length ? customerSeries : null,
    efficiencySeries,
    channels: buildChannels(entries, channelKeys, currency, finalStageLabel),
    paidChannels: buildPaidChannels(entries, channelKeys, labels.map((l) => l.row)),
    dimensions: buildDimensions(entries, labels.map((l) => l.axis)),
    table: {
      groups: [{ key: "total", label: null, columns }],
      rows: entries.map((e, i) => ({ key: e.periodKey, label: labels[i].row, values: rows[i] })),
      total: totals,
    },
  };
}

/** Cada canal somado em todos os períodos — as taxas (conversão, ROAS, CPL) saem das somas. */
function buildChannels(entries: readonly ReportIndexEntry[], keys: string[], currency: string, finalLabel: string): CommercialOverviewViewModel["channels"] {
  if (!keys.length) return null;
  const summaries = entries.map((e) => e.summary);
  const rows: ChannelRow[] = keys.map((key) => ({
    key,
    label: labelOf(entries, `channel.${key}`) ?? key,
    kind: ChannelKindSchema.safeParse(labelOf(entries, `channel.${key}.kind`)).data ?? "other",
    leads: sumKey(summaries, `channel.${key}.leads`),
    conversions: sumKey(summaries, `channel.${key}.conversions`),
    revenue: sumKey(summaries, `channel.${key}.revenue`),
    investment: sumKey(summaries, `channel.${key}.investment`),
  }));
  const metrics = computeChannelMetrics(rows).map((c) => ({ ...c, meta: channelMeta(c, currency, finalLabel) }));
  const measures = (["leads", "revenue", "conversions"] as const).filter((m) => metrics.some((c) => isFiniteNumber(c[m])));
  return measures.length ? { rows: metrics, measures: [...measures] } : null;
}

/** Investimento, receita e retorno de cada canal pago, período a período (com o total pago). */
function buildPaidChannels(entries: readonly ReportIndexEntry[], keys: string[], rowLabels: string[]): PeriodTableData | null {
  const summaries = entries.map((e) => e.summary);
  const paid = keys.filter((k) => (sumKey(summaries, `channel.${k}.investment`) ?? 0) > 0);
  if (!paid.length) return null;
  const values: Values[] = entries.map((e) => {
    const v: Values = {};
    for (const k of paid) {
      const inv = e.summary[`channel.${k}.investment`] ?? null;
      const rev = e.summary[`channel.${k}.revenue`] ?? null;
      v[`${k}.investment`] = inv;
      v[`${k}.revenue`] = rev;
      v[`${k}.roas`] = safeDivide(rev, inv);
    }
    v["paid.investment"] = sumKey(paid.map((k) => ({ x: v[`${k}.investment`] })), "x");
    v["paid.revenue"] = sumKey(paid.map((k) => ({ x: v[`${k}.revenue`] })), "x");
    v["paid.roas"] = safeDivide(v["paid.revenue"], v["paid.investment"]);
    return v;
  });
  // Total: a receita só dos meses com investimento — assim o total bate com o retorno.
  const total: Values = {};
  for (const prefix of [...paid, "paid"]) {
    const withInvestment = values.filter((v) => isFiniteNumber(v[`${prefix}.investment`]));
    total[`${prefix}.investment`] = sumKey(withInvestment, `${prefix}.investment`);
    total[`${prefix}.revenue`] = sumKey(withInvestment, `${prefix}.revenue`);
    total[`${prefix}.roas`] = safeDivide(total[`${prefix}.revenue`], total[`${prefix}.investment`]);
  }
  const group = (prefix: string, label: string | null, emphasis: boolean, slot?: number): PeriodTableData["groups"][number] => ({
    key: prefix,
    label,
    color: slot ? `var(--chart-${slot})` : undefined,
    columns: [
      { key: `${prefix}.investment`, label: "Investimento", format: "currency" },
      { key: `${prefix}.revenue`, label: "Receita", format: "currency", emphasis },
      { key: `${prefix}.roas`, label: "Retorno", format: "multiplier", emphasis },
    ],
  });
  const groups = paid.map((k, i) => group(k, labelOf(entries, `channel.${k}`) ?? k, false, Math.min(i + 1, 5)));
  return {
    groups: paid.length > 1 ? [...groups, group("paid", "Total pago", true)] : [{ ...groups[0], label: null }],
    rows: entries.map((e, i) => ({ key: e.periodKey, label: rowLabels[i], values: values[i] })),
    total,
  };
}

/**
 * Detalhamentos (serviços, terapeutas…) somados em todos os períodos: ranking pela
 * medida principal, ticket, participação, status mais recente e a medida período a período.
 */
function buildDimensions(entries: readonly ReportIndexEntry[], axisLabels: string[]): DimensionOverview[] {
  const dimKeys = [...new Set(entries.flatMap((e) => Object.keys(e.labels).flatMap((k) => /^dim\.([^.]+)$/.exec(k)?.[1] ?? [])))];
  return dimKeys.flatMap((d) => {
    const itemKeys = [...new Set(entries.flatMap((e) => Object.keys(e.labels).flatMap((k) => (k.startsWith(`dim.${d}.`) && k.split(".").length === 3 && k !== `dim.${d}.q` ? [k.split(".")[2]] : []))))];
    if (!itemKeys.length) return [];
    const sum = (item: string, m: DimensionMeasure) => sumKey(entries.map((e) => e.summary), `dim.${d}.${item}.${m}`);
    const measures = (["revenue", "quantity", "conversions", "leads"] as const).filter((m) => itemKeys.some((item) => sum(item, m) !== null));
    if (!measures.length) return [];
    const measure = measures[0];
    const quantityLabel = labelOf(entries, `dim.${d}.q`);
    const total = sumKey(itemKeys.map((item) => ({ x: sum(item, measure) })), "x");
    // Coluna por período: a quantidade (atendimentos) quando existe, senão a medida principal.
    const periodMeasure: DimensionMeasure = measures.includes("quantity") ? "quantity" : measure;
    const present = entries.map((e, i) => ({ e, i })).filter(({ e }) => itemKeys.some((item) => isFiniteNumber(e.summary[`dim.${d}.${item}.${periodMeasure}`])));
    const rows: DimensionOverviewRow[] = itemKeys
      .map((item) => {
        const quantity = sum(item, "quantity");
        const revenue = sum(item, "revenue");
        const conversions = sum(item, "conversions");
        // Status: o do último período em que o item apareceu com status.
        let status: string | null = null;
        for (let i = entries.length - 1; i >= 0 && status === null; i--) status = entries[i].labels[`dim.${d}.${item}.note`] ?? null;
        return {
          key: item,
          label: labelOf(entries, `dim.${d}.${item}`) ?? item,
          quantity,
          revenue,
          leads: sum(item, "leads"),
          conversions,
          averageTicket: safeDivide(revenue, quantity ?? conversions),
          share: safeDivide(sum(item, measure), total),
          status,
          byPeriod: Object.fromEntries(present.map(({ e }) => [e.periodKey, e.summary[`dim.${d}.${item}.${periodMeasure}`] ?? null])),
        };
      })
      .sort((a, b) => (b[measure] ?? -1) - (a[measure] ?? -1));
    const measureLabel = measure === "quantity" && quantityLabel ? quantityLabel : DIMENSION_MEASURE_LABEL[measure];
    const periodMeasureLabel = periodMeasure === "quantity" && quantityLabel ? quantityLabel : DIMENSION_MEASURE_LABEL[periodMeasure];
    return [{ key: d, label: labelOf(entries, `dim.${d}`) ?? d, measure, measureLabel, quantityLabel, rows, total, periods: present.map(({ e, i }) => ({ key: e.periodKey, label: axisLabels[i] })), periodMeasure, periodMeasureLabel }];
  });
}

function buildHeadline(totals: Values, range: string, firstLabel: string, finalLabel: string, currency: string): string {
  const parts: string[] = [];
  if (isFiniteNumber(totals.leads)) parts.push(`${formatInteger(totals.leads)} ${lowerFirst(firstLabel)}`);
  if (isFiniteNumber(totals.conversions)) parts.push(`${formatInteger(totals.conversions)} ${lowerFirst(finalLabel)}`);
  let sentence = range;
  if (parts.length) sentence += `: ${parts.join(" e ")}`;
  if (isFiniteNumber(totals.revenue)) sentence += `${parts.length ? "," : ":"} com receita de ${formatCurrency(totals.revenue, currency, { noCents: true })}`;
  return `${sentence}.`;
}
