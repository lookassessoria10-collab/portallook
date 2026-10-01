import { formatCurrency, formatInteger, isFiniteNumber, type ValueFormat } from "@/lib/format/number";
import { compareValues, type Comparison } from "@/lib/metrics/comparison";
import { METRICS, type MetricKey } from "@/lib/metrics/definitions";
import { formatPeriod, formatPeriodReference, periodUnit, type PeriodUnit } from "@/lib/dates/period";
import { costPerLabel, lowerFirst } from "@/lib/format/text";
import type { SeriesDef, SeriesPoint } from "@/components/charts/types";
import type { ReportIndexEntry } from "@/features/reports/schema";
import type { KpiIcon, KpiView } from "@/features/commercial/view-model";
import { buildTrafficView, type PlatformView, type TrafficTotals } from "./metrics";
import type { TrafficData } from "./schema";

export interface ComparisonRow {
  key: string;
  label: string;
  format: ValueFormat;
  current: number | null;
  previous: number | null;
  comparison: Comparison | null;
}

export interface PlatformSummary extends PlatformView {
  comparison: Comparison | null;
  /** Só o total da plataforma no período (dados sem coluna de campanha): não há campanhas para listar. */
  totalsOnly: boolean;
}

export interface TrafficViewModel {
  /** Unidade do período ("mês", "semana") para os textos da tela. */
  unit: PeriodUnit;
  headline: string;
  reference: string | null;
  kpis: KpiView[];
  secondary: KpiView[];
  totals: TrafficTotals;
  platforms: PlatformSummary[];
  /** Há campanhas de verdade (não só totais por plataforma). */
  campaignDetail: boolean;
  comparisonRows: ComparisonRow[];
  trend: { points: SeriesPoint[]; series: SeriesDef[] } | null;
}

interface Ctx {
  previous: ReportIndexEntry | null;
  history: ReportIndexEntry[];
  /** Resultados só são comparáveis se o período anterior teve os mesmos tipos (conversas com conversas). */
  comparableResults?: boolean;
}

const RESULT_KEYS = new Set(["results", "costPerResult"]);

function resultTypes(summary: Record<string, number | null>): string {
  return Object.keys(summary)
    .filter((k) => /^result\.[a-z_]+$/.test(k) && summary[k] !== null)
    .sort()
    .join(",");
}

function kpi(key: MetricKey, value: number | null, ctx: Ctx, icon: KpiIcon, overrides: Partial<KpiView> = {}): KpiView {
  const def = METRICS[key];
  return {
    key,
    label: overrides.label ?? def.label,
    value,
    format: def.format,
    comparison: ctx.previous && (ctx.comparableResults !== false || !RESULT_KEYS.has(key)) ? compareValues(value, ctx.previous.summary[key] ?? null, { direction: def.direction, kind: def.comparison }) : null,
    trend: ctx.history.map((h) => h.summary[key] ?? null),
    description: overrides.description ?? def.description,
    footnote: overrides.footnote ?? null,
    icon,
  };
}

export function buildTrafficViewModel(data: TrafficData, input: Ctx): TrafficViewModel {
  const view = buildTrafficView(data);
  const t = view.totals;
  const current: Record<string, number | null> = Object.fromEntries(t.resultGroups.map((g) => [`result.${g.type}`, g.count]));
  const ctx: Ctx = { ...input, comparableResults: !input.previous || resultTypes(current) === resultTypes(input.previous.summary) };
  const reference = input.previous ? formatPeriodReference(input.previous.period) : null;

  const singleResult = t.resultGroups.length === 1 ? t.resultGroups[0] : null;
  const resultsLabel = singleResult ? singleResult.label : "Resultados";
  const resultsFootnote = t.resultGroups.length > 1 ? t.resultGroups.map((g) => `${formatInteger(g.count)} ${lowerFirst(g.label)}`).join(" · ") : null;

  const kpis: KpiView[] = [kpi("investment", t.investment, ctx, "investment")];
  if (t.results !== null) {
    kpis.push(kpi("results", t.results, ctx, "conversions", { label: resultsLabel, footnote: resultsFootnote }));
    kpis.push(
      kpi("costPerResult", t.costPerResult, ctx, "cost", {
        label: singleResult ? costPerLabel(singleResult.label) : "Custo por resultado",
        footnote: t.resultGroups.length > 1 ? "Média entre tipos de resultado diferentes — veja cada campanha." : null,
      }),
    );
  }
  kpis.push(kpi("impressions", t.impressions, ctx, "leads"));
  if (t.results === null && t.clicks !== null) kpis.push(kpi("clicks", t.clicks, ctx, "conversions"));

  const secondary: KpiView[] = [];
  const add = (key: MetricKey, value: number | null, icon: KpiIcon, overrides?: Partial<KpiView>) => {
    if (value !== null && !kpis.some((k) => k.key === key)) secondary.push(kpi(key, value, ctx, icon, overrides));
  };
  add("reach", t.reach, "leads", { footnote: "Soma do alcance de cada campanha." });
  add("clicks", t.clicks, "conversions");
  add("ctr", t.ctr, "rate");
  add("cpc", t.cpc, "cost");
  add("cpm", t.cpm, "cost");
  if (t.attributedRevenue !== null) add("roas", t.roas, "roas");

  const platforms: PlatformSummary[] = view.platforms.map((p) => ({
    ...p,
    totalsOnly: p.campaigns.length === 1 && p.campaigns[0].name === p.label,
    comparison: input.previous
      ? compareValues(p.totals.investment, input.previous.summary[`platform.${p.platform}.investment`] ?? null, { direction: "neutral" })
      : null,
  }));

  const rowDefs: Array<[MetricKey, number | null, string?]> = [
    ["investment", t.investment],
    ["impressions", t.impressions],
    ["reach", t.reach],
    ["clicks", t.clicks],
    ["ctr", t.ctr],
    ["cpc", t.cpc],
    ["cpm", t.cpm],
    ["results", t.results, resultsLabel],
    ["costPerResult", t.costPerResult, singleResult ? costPerLabel(singleResult.label) : undefined],
  ];
  const comparisonRows: ComparisonRow[] = rowDefs
    .filter(([, v]) => v !== null)
    .map(([key, value, label]) => {
      const def = METRICS[key];
      const prev = input.previous?.summary[key] ?? null;
      return {
        key,
        label: label ?? def.label,
        format: def.format,
        current: value,
        previous: prev,
        comparison: input.previous && (ctx.comparableResults || !RESULT_KEYS.has(key)) ? compareValues(value, prev, { direction: def.direction, kind: def.comparison }) : null,
      };
    });

  return {
    unit: periodUnit(data.period.granularity),
    headline: buildHeadline(data, t, resultsLabel, platforms.some((p) => !p.totalsOnly)),
    reference,
    kpis,
    secondary,
    totals: t,
    platforms,
    campaignDetail: platforms.some((p) => !p.totalsOnly),
    comparisonRows,
    trend: buildTrend(input.history, resultsLabel),
  };
}

function buildTrend(history: ReportIndexEntry[], resultsLabel: string): TrafficViewModel["trend"] {
  if (history.length < 2) return null;
  const points: SeriesPoint[] = history.map((h) => ({ key: h.periodKey, label: formatPeriod(h.period, "compact"), fullLabel: formatPeriod(h.period), values: h.summary }));
  const candidates: SeriesDef[] = [
    { key: "investment", label: "Investimento", format: "currency" },
    { key: "results", label: resultsLabel, format: "integer" },
    { key: "costPerResult", label: "Custo por resultado", format: "currency" },
    { key: "clicks", label: "Cliques", format: "integer" },
    { key: "impressions", label: "Impressões", format: "integer" },
    { key: "ctr", label: "CTR", format: "percent" },
  ];
  const series = candidates.filter((s) => history.filter((h) => isFiniteNumber(h.summary[s.key])).length >= 2).map((s) => ({ ...s, slot: 1 as const }));
  return series.length ? { points, series } : null;
}

function buildHeadline(data: TrafficData, t: TrafficTotals, resultsLabel: string, campaignDetail: boolean): string {
  const period = formatPeriod(data.period);
  if (!campaignDetail) {
    // Só totais por plataforma: não fala em "campanhas ativas".
    const invested = `${formatCurrency(t.investment, data.currency, { noCents: true })} investidos`;
    if (t.results !== null) return `${period}: ${invested} e ${formatInteger(t.results)} ${lowerFirst(resultsLabel)}.`;
    if (t.clicks !== null) return `${period}: ${invested} e ${formatInteger(t.clicks)} cliques.`;
    return `${period}: ${invested} e ${formatInteger(t.impressions)} impressões.`;
  }
  const campaigns = `${t.campaignCount} ${t.campaignCount === 1 ? "campanha ativa" : "campanhas ativas"}`;
  const verb = t.campaignCount === 1 ? "gerou" : "geraram";
  if (t.results !== null) return `${period}: ${campaigns} ${verb} ${formatInteger(t.results)} ${lowerFirst(resultsLabel)}.`;
  if (t.clicks !== null) return `${period}: ${campaigns} ${verb} ${formatInteger(t.clicks)} cliques.`;
  return `${period}: ${campaigns} com ${formatInteger(t.impressions)} impressões.`;
}
