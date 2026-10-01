import { formatCurrency, formatInteger, formatPercent, formatValue, isFiniteNumber, type ValueFormat } from "@/lib/format/number";
import { compareValues, type Comparison, type MetricDirection } from "@/lib/metrics/comparison";
import { METRICS, type MetricKey } from "@/lib/metrics/definitions";
import { formatPeriod, formatPeriodReference } from "@/lib/dates/period";
import { costPerLabel, lowerFirst, singularizePt } from "@/lib/format/text";
import type { SeriesDef, SeriesPoint } from "@/components/charts/types";
import type { DashboardConfig } from "@/features/clients/schema";
import type { ReportIndexEntry } from "@/features/reports/schema";
import { buildDimensionView, computeChannelMetrics, computeCommercialMetrics, type ChannelMetrics, type CommercialMetrics, type DimensionView, type StageMetrics } from "./metrics";
import type { ChannelKind, CommercialData, ExtraMetric } from "./schema";

export interface KpiView {
  key: string;
  label: string;
  value: number | null;
  format: ValueFormat;
  comparison: Comparison | null;
  trend: Array<number | null>;
  description: string;
  footnote?: string | null;
  icon: KpiIcon;
}

export type KpiIcon = "leads" | "conversions" | "revenue" | "investment" | "roas" | "rate" | "ticket" | "cost" | "sales";

export interface ChannelView extends ChannelMetrics {
  meta: string[];
}

export interface CommercialViewModel {
  headline: string;
  reference: string | null;
  kpis: KpiView[];
  secondary: KpiView[];
  funnel: { stages: StageMetrics[]; overallRate: number | null };
  channels: { rows: ChannelView[]; measures: Array<"leads" | "revenue" | "conversions">; hasInvestment: boolean } | null;
  financial: {
    cards: KpiView[];
    roasNote: string | null;
    series: SeriesDef[];
  } | null;
  trend: { points: SeriesPoint[]; series: SeriesDef[] } | null;
  dimensions: DimensionView[];
  extraMetrics: Array<ExtraMetric & { formatted: string; comparison: Comparison | null }>;
  context: CommercialData["context"];
  metrics: CommercialMetrics;
}

const CHANNEL_KIND_LABEL: Record<ChannelKind, string> = {
  paid: "Mídia paga",
  organic: "Orgânico",
  referral: "Indicação",
  recurring: "Recorrente",
  marketplace: "Plataforma",
  offline: "Offline",
  partner: "Parceria",
  other: "Outros",
};

export function channelKindLabel(kind: ChannelKind) {
  return CHANNEL_KIND_LABEL[kind];
}

function kpi(key: MetricKey, value: number | null, ctx: Ctx, overrides: Partial<KpiView> & { icon: KpiIcon }): KpiView {
  const def = METRICS[key];
  return {
    key,
    label: overrides.label ?? def.label,
    value,
    format: def.format,
    comparison: ctx.previous ? compareValues(value, ctx.previous.summary[key] ?? null, { direction: def.direction, kind: def.comparison }) : null,
    trend: ctx.history.map((h) => h.summary[key] ?? null),
    description: overrides.description ?? def.description,
    footnote: overrides.footnote ?? null,
    icon: overrides.icon,
  };
}

interface Ctx {
  previous: ReportIndexEntry | null;
  history: ReportIndexEntry[];
}

const ROAS_NOTE: Record<NonNullable<CommercialMetrics["roasBasis"]>, string | null> = {
  attributed: null,
  total: "Base: receita total do período.",
};

export function buildCommercialViewModel(
  data: CommercialData,
  input: { previous: ReportIndexEntry | null; history: ReportIndexEntry[]; dashboard: DashboardConfig },
): CommercialViewModel {
  const m = computeCommercialMetrics(data);
  const ctx: Ctx = { previous: input.previous, history: input.history };
  const reference = input.previous ? formatPeriodReference(input.previous.period) : null;
  const roiKey: MetricKey = input.dashboard.roiMetric === "roiPercent" ? "roiPercent" : "roas";
  const roiValue = roiKey === "roas" ? m.roas : m.roiPercent;
  const roasNote = m.roasBasis ? ROAS_NOTE[m.roasBasis] : null;

  // Destaques: responder "quantos resultados, quanto investiu, qual retorno".
  const candidates: KpiView[] = [];
  if (m.leads !== null) candidates.push(kpi("leads", m.leads, ctx, { label: m.firstStageLabel, icon: "leads", description: `${m.firstStageLabel} no período (primeira etapa do funil).` }));
  if (m.conversions !== null) candidates.push(kpi("conversions", m.conversions, ctx, { label: m.finalStageLabel, icon: "conversions", description: `${m.finalStageLabel}: etapa final do funil.` }));
  if (m.revenue !== null) candidates.push(kpi("revenue", m.revenue, ctx, { icon: "revenue" }));
  if (roiValue !== null) candidates.push(kpi(roiKey, roiValue, ctx, { icon: "roas", footnote: roasNote }));
  else if (m.investment !== null) candidates.push(kpi("investment", m.investment, ctx, { icon: "investment" }));
  if (candidates.length < 4 && m.conversionRate !== null) candidates.push(kpi("conversionRate", m.conversionRate, ctx, { icon: "rate" }));
  if (candidates.length < 4 && m.cpl !== null) candidates.push(kpi("cpl", m.cpl, ctx, { icon: "cost" }));

  const ordered = orderByConfig(candidates, input.dashboard.highlightMetrics);
  const kpis = ordered.slice(0, 4);
  const used = new Set(kpis.map((k) => k.key));

  const secondary: KpiView[] = [];
  const addSecondary = (key: MetricKey, value: number | null, icon: KpiIcon, label?: string) => {
    if (value !== null && !used.has(key)) secondary.push(kpi(key, value, ctx, { icon, label }));
  };
  addSecondary("conversionRate", m.conversionRate, "rate");
  addSecondary("investment", m.investment, "investment");
  addSecondary("averageTicket", m.averageTicket, "ticket");
  addSecondary("cpl", m.cpl, "cost");
  addSecondary("cpa", m.cpa, "cost", costPerLabel(m.finalStageLabel));
  addSecondary("sales", m.sales, "sales");

  // Financeiro: só aparece se houver receita ou investimento.
  let financial: CommercialViewModel["financial"] = null;
  if (m.revenue !== null || m.investment !== null) {
    const cards: KpiView[] = [];
    if (m.revenue !== null) cards.push(kpi("revenue", m.revenue, ctx, { icon: "revenue" }));
    if (m.investment !== null) cards.push(kpi("investment", m.investment, ctx, { icon: "investment" }));
    if (m.roas !== null) cards.push(kpi("roas", m.roas, ctx, { icon: "roas", footnote: roasNote }));
    if (m.roiPercent !== null) cards.push(kpi("roiPercent", m.roiPercent, ctx, { icon: "roas" }));
    if (m.averageTicket !== null) cards.push(kpi("averageTicket", m.averageTicket, ctx, { icon: "ticket" }));
    if (m.cpa !== null) cards.push(kpi("cpa", m.cpa, ctx, { icon: "cost", label: costPerLabel(m.finalStageLabel) }));
    const series: SeriesDef[] = [];
    if (input.history.filter((h) => isFiniteNumber(h.summary.revenue)).length >= 2) series.push({ key: "revenue", label: "Receita", format: "currency", slot: 1 });
    if (input.history.filter((h) => isFiniteNumber(h.summary.investment)).length >= 2) series.push({ key: "investment", label: "Investimento", format: "currency", slot: 2 });
    financial = { cards, roasNote, series };
  }

  const channelRows = computeChannelMetrics(data.channels).map((c) => ({ ...c, meta: channelMeta(c, data.currency, m.finalStageLabel) }));
  const measures = (["leads", "revenue", "conversions"] as const).filter((k) => channelRows.some((c) => isFiniteNumber(c[k])));

  return {
    headline: buildHeadline(data, m, input.previous, reference),
    reference,
    kpis,
    secondary,
    funnel: { stages: m.stages, overallRate: m.conversionRate },
    channels: channelRows.length ? { rows: channelRows, measures: [...measures], hasInvestment: channelRows.some((c) => isFiniteNumber(c.investment)) } : null,
    financial,
    trend: buildTrend(input.history, m),
    dimensions: data.dimensions.map(buildDimensionView),
    extraMetrics: data.extraMetrics.map((e) => ({
      ...e,
      formatted: formatValue(e.value, e.format, data.currency),
      comparison: input.previous ? compareValues(e.value, input.previous.summary[`extra.${e.key}`] ?? null, { direction: e.direction as MetricDirection }) : null,
    })),
    context: data.context,
    metrics: m,
  };
}

export function orderByConfig(items: KpiView[], order: string[]): KpiView[] {
  if (!order.length) return items;
  return [...items].sort((a, b) => {
    const ia = order.indexOf(a.key);
    const ib = order.indexOf(b.key);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

function channelMeta(c: ChannelMetrics, currency: string, finalLabel: string): string[] {
  const meta: string[] = [];
  if (isFiniteNumber(c.conversions)) meta.push(`${formatInteger(c.conversions)} ${c.conversions === 1 ? lowerFirst(singularizePt(finalLabel)) : lowerFirst(finalLabel)}`);
  if (c.conversionRate !== null) meta.push(`conversão ${formatPercent(c.conversionRate)}`);
  if (isFiniteNumber(c.revenue)) meta.push(`receita ${formatCurrency(c.revenue, currency)}`);
  if (isFiniteNumber(c.investment)) meta.push(`investimento ${formatCurrency(c.investment, currency)}`);
  if (c.cpl !== null) meta.push(`CPL ${formatCurrency(c.cpl, currency)}`);
  if (c.roas !== null) meta.push(`ROAS ${formatValue(c.roas, "multiplier")}`);
  return meta;
}

function buildTrend(history: ReportIndexEntry[], m: CommercialMetrics): CommercialViewModel["trend"] {
  if (history.length < 2) return null;
  const points: SeriesPoint[] = history.map((h) => ({
    key: h.periodKey,
    label: formatPeriod(h.period, "compact"),
    fullLabel: formatPeriod(h.period),
    values: h.summary,
  }));
  const candidates: SeriesDef[] = [
    { key: "leads", label: m.firstStageLabel, format: "integer" },
    { key: "conversions", label: m.finalStageLabel, format: "integer" },
    { key: "revenue", label: "Receita", format: "currency" },
    { key: "investment", label: "Investimento", format: "currency" },
    { key: "conversionRate", label: "Conversão", format: "percent" },
    { key: "roas", label: "ROAS", format: "multiplier" },
    { key: "cpl", label: "CPL", format: "currency" },
  ];
  const series = candidates.filter((s) => history.filter((h) => isFiniteNumber(h.summary[s.key])).length >= 2).map((s) => ({ ...s, slot: 1 as const }));
  return series.length ? { points, series } : null;
}

function buildHeadline(data: CommercialData, m: CommercialMetrics, previous: ReportIndexEntry | null, reference: string | null): string {
  const period = formatPeriod(data.period);
  const parts: string[] = [];
  if (m.leads !== null) parts.push(`${formatInteger(m.leads)} ${lowerFirst(m.firstStageLabel)}`);
  if (m.conversions !== null) parts.push(`${formatInteger(m.conversions)} ${lowerFirst(m.finalStageLabel)}`);
  let sentence = parts.length ? `${period}: ${parts.join(" e ")}` : period;
  if (m.revenue !== null) sentence += `, com receita de ${formatCurrency(m.revenue, data.currency)}`;
  sentence += ".";
  if (previous && reference && m.leads !== null) {
    const c = compareValues(m.leads, previous.summary.leads ?? null, { direction: "higherIsBetter" });
    if (c.status === "ok" && c.delta !== null) {
      sentence += ` ${m.firstStageLabel} ${c.trend === "up" ? "cresceram" : "caíram"} ${formatPercent(Math.abs(c.delta))} em relação a ${reference}.`;
    }
  }
  return sentence;
}
