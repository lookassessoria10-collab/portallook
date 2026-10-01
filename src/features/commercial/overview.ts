import { formatCurrency, formatInteger, isFiniteNumber } from "@/lib/format/number";
import { averageKey, inverseWeightedRatio, ratioOfSums, sumKey } from "@/lib/metrics/aggregate";
import { METRICS, type MetricKey } from "@/lib/metrics/definitions";
import { formatPeriodRange, periodSeriesLabels, periodUnit, type PeriodUnit } from "@/lib/dates/period";
import { costPerLabel, lowerFirst } from "@/lib/format/text";
import type { SeriesDef, SeriesPoint } from "@/components/charts/types";
import type { PeriodTableColumn, PeriodTableData } from "@/components/dashboard/period-table";
import type { DashboardConfig } from "@/features/clients/schema";
import type { ReportIndexEntry } from "@/features/reports/schema";
import { orderByConfig, type KpiIcon, type KpiView } from "./view-model";

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
  financialSeries: SeriesDef[] | null;
  efficiencySeries: SeriesDef[];
  table: PeriodTableData;
}

type Values = Record<string, number | null>;

/** Canais com cor própria; do 6º em diante viram "Outros" (mesma regra da paleta). */
const MAX_CHANNEL_SERIES = 5;
const OTHER_CHANNELS = "channel.__others.leads";

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

  // Canais: os maiores em leads ganham cor; o restante é somado em "Outros".
  const channelKeys = [...new Set(entries.flatMap((e) => Object.keys(e.summary).flatMap((k) => /^channel\.(.+)\.leads$/.exec(k)?.[1] ?? [])))];
  const summaries = entries.map((e) => e.summary);
  const rankedChannels = channelKeys.map((key) => ({ key, leads: sumKey(summaries, `channel.${key}.leads`) ?? 0 })).sort((a, b) => b.leads - a.leads);
  const shown = rankedChannels.length > MAX_CHANNEL_SERIES ? rankedChannels.slice(0, MAX_CHANNEL_SERIES - 1) : rankedChannels;
  const grouped = rankedChannels.slice(shown.length);

  const rows: Values[] = entries.map((e) => {
    // Base do ticket médio: vendas ou, sem elas, conversões (mesma regra do período).
    const v: Values = { ...e.summary, ticketBase: e.summary.sales ?? e.summary.conversions ?? null };
    if (grouped.length) v[OTHER_CHANNELS] = sumKey(grouped.map((c) => ({ leads: e.summary[`channel.${c.key}.leads`] })), "leads");
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
  const add = (key: MetricKey, icon: KpiIcon, label?: string) => {
    if (totals[key] !== null && !kpis.some((k) => k.key === key)) secondary.push(kpi(key, icon, { label }));
  };
  add("conversionRate", "rate");
  add("investment", "investment");
  add("averageTicket", "ticket");
  add("cpl", "cost");
  add("cpa", "cost", costPerLabel(finalStageLabel));
  add("sales", "sales");

  const has = (key: string) => rows.some((r) => isFiniteNumber(r[key]));
  const points: SeriesPoint[] = entries.map((e, i) => ({ key: e.periodKey, label: labels[i].axis, fullLabel: labels[i].full, values: rows[i] }));

  const funnelSeries: SeriesDef[] = [];
  if (has("leads")) funnelSeries.push({ key: "leads", label: firstStageLabel, format: "integer", slot: 1 });
  if (has("conversions")) funnelSeries.push({ key: "conversions", label: finalStageLabel, format: "integer", slot: 2 });

  const channelSeries: SeriesDef[] = shown.map((c, i) => ({
    key: `channel.${c.key}.leads`,
    label: labelOf(entries, `channel.${c.key}`) ?? c.key,
    format: "integer",
    slot: (i + 1) as 1 | 2 | 3 | 4 | 5,
  }));
  if (grouped.length) channelSeries.push({ key: OTHER_CHANNELS, label: "Outros", format: "integer", color: "var(--chart-other)" });

  const financialSeries: SeriesDef[] = [];
  if (has("revenue")) financialSeries.push({ key: "revenue", label: "Receita", format: "currency", slot: 1 });
  if (has("investment")) financialSeries.push({ key: "investment", label: "Investimento", format: "currency", slot: 2 });

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
    financialSeries: financialSeries.length ? financialSeries : null,
    efficiencySeries,
    table: {
      groups: [{ key: "total", label: null, columns }],
      rows: entries.map((e, i) => ({ key: e.periodKey, label: labels[i].row, values: rows[i] })),
      total: totals,
    },
  };
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
