import { safeDivide, sumMaybe } from "@/lib/metrics/safe-math";
import { isFiniteNumber } from "@/lib/format/number";
import { slugify } from "@/lib/ids";
import type { ReportSummary } from "@/features/reports/schema";
import type { ChannelRow, CommercialData, FunnelStage } from "./schema";

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
  /** Novos × recorrentes (aba Clientes). */
  newCustomers: number | null;
  returningCustomers: number | null;
  /** Fração de novos entre os clientes atendidos. */
  newCustomerShare: number | null;
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
    newCustomers: data.customers?.new ?? null,
    returningCustomers: data.customers?.returning ?? null,
    newCustomerShare: safeDivide(data.customers?.new ?? null, sumMaybe([data.customers?.new, data.customers?.returning])),
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
    newCustomers: m.newCustomers,
    returningCustomers: m.returningCustomers,
  };
  const labels: Record<string, string> = { firstStage: m.firstStageLabel, finalStage: m.finalStageLabel };
  // Aviso do período (ex.: "Janeiro parcial") marca o mês na tabela mês a mês.
  if (data.context) labels.context = data.context.title;
  if (data.days != null) summary.days = data.days;
  // Notas por seção (ex.: a do cartão de ROI do mês), para aparecerem também quando outro mês está em foco.
  for (const n of data.sectionNotes) {
    const key = `nota.${slugify(n.section)}`;
    labels[key] = labels[key] ? `${labels[key]} ${n.text}` : n.text;
  }
  for (const s of m.stages) {
    summary[`stage.${s.key}`] = s.value;
    labels[`stage.${s.key}`] = s.label;
  }
  for (const e of data.extraMetrics) summary[`extra.${e.key}`] = e.value;
  for (const c of data.channels) {
    if (isFiniteNumber(c.leads)) summary[`channel.${c.key}.leads`] = c.leads;
    if (isFiniteNumber(c.revenue)) summary[`channel.${c.key}.revenue`] = c.revenue;
    if (isFiniteNumber(c.conversions)) summary[`channel.${c.key}.conversions`] = c.conversions;
    if (isFiniteNumber(c.investment)) summary[`channel.${c.key}.investment`] = c.investment;
    labels[`channel.${c.key}`] = c.label;
    labels[`channel.${c.key}.kind`] = c.kind;
  }
  // Detalhamentos item a item: a visão geral monta o ranking acumulado (ex.: terapeutas) sem abrir cada mês.
  for (const d of data.dimensions) {
    labels[`dim.${d.key}`] = d.label;
    if (d.quantityLabel) labels[`dim.${d.key}.q`] = d.quantityLabel;
    for (const r of d.rows) {
      const base = `dim.${d.key}.${r.key}`;
      labels[base] = r.label;
      if (r.note) labels[`${base}.note`] = r.note;
      for (const m of ["quantity", "revenue", "leads", "conversions"] as const) if (isFiniteNumber(r[m])) summary[`${base}.${m}`] = r[m];
    }
  }
  return { summary, labels };
}
