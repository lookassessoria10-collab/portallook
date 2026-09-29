import { safeDivide, sumMaybe } from "@/lib/metrics/safe-math";
import { isFiniteNumber } from "@/lib/format/number";
import type { ReportSummary } from "@/features/reports/schema";
import type { ChannelRow, CommercialData, Dimension, DimensionRow, FunnelStage } from "./schema";

export interface StageMetrics extends FunnelStage {
  /** Conversão a partir da etapa anterior (quando ela foi registrada). */
  rateFromPrevious: number | null;
  /** Conversão a partir da primeira etapa. */
  rateFromFirst: number | null;
  previousLabel: string | null;
}

/** Base usada no ROAS — exibida ao cliente para evitar leituras erradas. */
export type RoasBasis = "attributed" | "total";

export interface CommercialMetrics {
  stages: StageMetrics[];
  firstStageLabel: string;
  finalStageLabel: string;
  leads: number | null;
  conversions: number | null;
  conversionRate: number | null;
  revenue: number | null;
  attributedRevenue: number | null;
  investment: number | null;
  sales: number | null;
  averageTicket: number | null;
  cpl: number | null;
  cpa: number | null;
  roas: number | null;
  roiPercent: number | null;
  roasBasis: RoasBasis | null;
  otherCosts: number | null;
}

export function sortStages(stages: readonly FunnelStage[]): FunnelStage[] {
  return [...stages].sort((a, b) => a.order - b.order);
}

export function computeStageMetrics(stages: readonly FunnelStage[]): StageMetrics[] {
  const sorted = sortStages(stages);
  const first = sorted[0]?.value ?? null;
  return sorted.map((stage, i) => {
    const prev = i > 0 ? sorted[i - 1] : null;
    return {
      ...stage,
      rateFromPrevious: prev ? safeDivide(stage.value, prev.value) : null,
      rateFromFirst: i > 0 ? safeDivide(stage.value, first) : null,
      previousLabel: prev?.label ?? null,
    };
  });
}

export function computeCommercialMetrics(data: CommercialData): CommercialMetrics {
  const stages = computeStageMetrics(data.funnel);
  const first = stages[0];
  const final = stages[stages.length - 1];
  const f = data.financial;

  const leads = first?.value ?? null;
  const conversions = stages.length > 1 ? (final?.value ?? null) : null;

  const investment = f?.mediaInvestment ?? sumMaybe(data.channels.map((c) => c.investment));
  const revenue = f?.revenue ?? sumMaybe(data.channels.map((c) => c.revenue));
  const sales = f?.sales ?? null;

  // Sem receita atribuída informada, segue a convenção dos relatórios da Look:
  // receita total ÷ investimento — sempre sinalizado na interface (roasBasis).
  const attributedRevenue: number | null = f?.attributedRevenue ?? revenue;
  const roasBasis: RoasBasis | null = f?.attributedRevenue != null ? "attributed" : revenue !== null ? "total" : null;

  const roas = safeDivide(attributedRevenue, investment);
  const roiPercent = attributedRevenue !== null && isFiniteNumber(investment) && investment > 0 ? (attributedRevenue - investment) / investment : null;

  const averageTicket = safeDivide(revenue, sales ?? conversions) ?? f?.averageTicket ?? null;

  return {
    stages,
    firstStageLabel: first?.label ?? "Leads",
    finalStageLabel: final?.label ?? "Conversões",
    leads,
    conversions,
    conversionRate: safeDivide(conversions, leads),
    revenue,
    attributedRevenue,
    investment,
    sales,
    averageTicket,
    cpl: safeDivide(investment, leads),
    cpa: safeDivide(investment, conversions),
    roas: roas === null ? null : roas,
    roiPercent,
    roasBasis: roas === null ? null : roasBasis,
    otherCosts: f?.otherCosts ?? null,
  };
}

export interface ChannelMetrics extends ChannelRow {
  conversionRate: number | null;
  cpl: number | null;
  cpa: number | null;
  roas: number | null;
  leadShare: number | null;
  revenueShare: number | null;
}

export function computeChannelMetrics(channels: readonly ChannelRow[]): ChannelMetrics[] {
  const totalLeads = sumMaybe(channels.map((c) => c.leads));
  const totalRevenue = sumMaybe(channels.map((c) => c.revenue));
  return channels
    .map((c) => ({
      ...c,
      conversionRate: safeDivide(c.conversions, c.leads),
      cpl: safeDivide(c.investment, c.leads),
      cpa: safeDivide(c.investment, c.conversions),
      roas: safeDivide(c.revenue, c.investment),
      leadShare: safeDivide(c.leads, totalLeads),
      revenueShare: safeDivide(c.revenue, totalRevenue),
    }))
    .sort((a, b) => (b.leads ?? -1) - (a.leads ?? -1) || (b.revenue ?? -1) - (a.revenue ?? -1));
}

export type DimensionMeasure = "revenue" | "quantity" | "conversions" | "leads";

export interface DimensionView {
  key: string;
  label: string;
  measure: DimensionMeasure;
  measureLabel: string;
  quantityLabel: string | null;
  measures: DimensionMeasure[];
  rows: Array<DimensionRow & { share: number | null; averageTicket: number | null }>;
}

const MEASURE_LABEL: Record<DimensionMeasure, string> = {
  revenue: "Receita",
  quantity: "Quantidade",
  conversions: "Conversões",
  leads: "Leads",
};

export function buildDimensionView(dimension: Dimension): DimensionView {
  const measures = (["revenue", "quantity", "conversions", "leads"] as const).filter((m) => dimension.rows.some((r) => isFiniteNumber(r[m])));
  const measure: DimensionMeasure = measures[0] ?? "quantity";
  const total = sumMaybe(dimension.rows.map((r) => r[measure]));
  const rows = [...dimension.rows]
    .map((r) => ({
      ...r,
      share: safeDivide(r[measure], total),
      averageTicket: safeDivide(r.revenue, r.quantity ?? r.conversions),
    }))
    .sort((a, b) => (b[measure] ?? -1) - (a[measure] ?? -1));
  const label = (m: DimensionMeasure) => (m === "quantity" && dimension.quantityLabel ? dimension.quantityLabel : MEASURE_LABEL[m]);
  return { key: dimension.key, label: dimension.label, measure, measureLabel: label(measure), quantityLabel: dimension.quantityLabel, measures, rows };
}

export function dimensionMeasureLabel(dimension: Dimension, measure: DimensionMeasure): string {
  return measure === "quantity" && dimension.quantityLabel ? dimension.quantityLabel : MEASURE_LABEL[measure];
}

/** Indicadores gravados no índice — permitem histórico/comparação sem abrir data.json. */
export function commercialSummary(data: CommercialData): { summary: ReportSummary; labels: Record<string, string> } {
  const m = computeCommercialMetrics(data);
  const summary: ReportSummary = {
    leads: m.leads,
    conversions: m.conversions,
    conversionRate: m.conversionRate,
    revenue: m.revenue,
    attributedRevenue: m.attributedRevenue,
    investment: m.investment,
    sales: m.sales,
    averageTicket: m.averageTicket,
    cpl: m.cpl,
    cpa: m.cpa,
    roas: m.roas,
    roiPercent: m.roiPercent,
  };
  const labels: Record<string, string> = { firstStage: m.firstStageLabel, finalStage: m.finalStageLabel };
  for (const s of m.stages) {
    summary[`stage.${s.key}`] = s.value;
    labels[`stage.${s.key}`] = s.label;
  }
  for (const e of data.extraMetrics) summary[`extra.${e.key}`] = e.value;
  for (const c of data.channels) {
    if (isFiniteNumber(c.leads)) summary[`channel.${c.key}.leads`] = c.leads;
    if (isFiniteNumber(c.revenue)) summary[`channel.${c.key}.revenue`] = c.revenue;
    labels[`channel.${c.key}`] = c.label;
  }
  return { summary, labels };
}
