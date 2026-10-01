import { formatCurrency, formatInteger, isFiniteNumber } from "@/lib/format/number";
import { averageKey, ratioOfSums, sumKey, weightedRatio } from "@/lib/metrics/aggregate";
import { safeDivide } from "@/lib/metrics/safe-math";
import { METRICS, type MetricKey } from "@/lib/metrics/definitions";
import { formatPeriodRange, periodSeriesLabels, periodUnit, type PeriodUnit } from "@/lib/dates/period";
import { costPerLabel, lowerFirst } from "@/lib/format/text";
import type { SeriesDef, SeriesPoint } from "@/components/charts/types";
import type { PeriodTableColumn, PeriodTableData } from "@/components/dashboard/period-table";
import type { ReportIndexEntry } from "@/features/reports/schema";
import type { KpiIcon, KpiView } from "@/features/commercial/view-model";
import { PLATFORM_ORDER, RESULT_TYPE_LABEL, ResultTypeSchema, platformLabel } from "./schema";

/** Cor fixa por plataforma — Meta sempre azul, Google sempre laranja, em qualquer cliente. */
const PLATFORM_COLOR: Record<string, string> = {
  meta_ads: "var(--chart-1)",
  google_ads: "var(--chart-2)",
  tiktok_ads: "var(--chart-3)",
  linkedin_ads: "var(--chart-4)",
  youtube_ads: "var(--chart-5)",
};

export function platformColor(platform: string): string {
  return PLATFORM_COLOR[platform] ?? "var(--chart-other)";
}

export interface OverviewPlatform {
  key: string;
  label: string;
  color: string;
}

export interface TrafficOverviewViewModel {
  unit: PeriodUnit;
  count: number;
  rangeLabel: string;
  headline: string;
  resultsLabel: string;
  kpis: KpiView[];
  secondary: KpiView[];
  platforms: OverviewPlatform[];
  points: SeriesPoint[];
  investmentSeries: SeriesDef[];
  resultsSeries: SeriesDef[] | null;
  efficiencySeries: SeriesDef[];
  table: PeriodTableData;
}

type Values = Record<string, number | null>;

/** Rótulo gravado no índice para a chave (o mais recente vence). */
function labelOf(entries: readonly ReportIndexEntry[], key: string): string | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    const label = entries[i].labels[key];
    if (label) return label;
  }
  return null;
}

/**
 * Visão geral de tráfego: soma vários períodos usando só o resumo do índice
 * (`summary`), sem abrir o data.json de cada mês. `entries` em ordem cronológica.
 */
export function buildTrafficOverview(entries: readonly ReportIndexEntry[], currency = "BRL"): TrafficOverviewViewModel {
  const last = entries[entries.length - 1];
  const unit = periodUnit(last.period.granularity);
  const labels = periodSeriesLabels(entries.map((e) => e.period));
  const rangeLabel = formatPeriodRange(entries[0].period, last.period);

  const platformKeys = [...new Set(entries.flatMap((e) => Object.keys(e.summary).flatMap((k) => /^platform\.(.+)\.investment$/.exec(k)?.[1] ?? [])))];
  const rank = (p: string) => (PLATFORM_ORDER.indexOf(p) === -1 ? 99 : PLATFORM_ORDER.indexOf(p));
  const platforms: OverviewPlatform[] = platformKeys
    .sort((a, b) => rank(a) - rank(b) || (sumKey(entries.map((e) => e.summary), `platform.${b}.investment`) ?? 0) - (sumKey(entries.map((e) => e.summary), `platform.${a}.investment`) ?? 0))
    .map((key) => ({ key, label: labelOf(entries, `platform.${key}`) ?? platformLabel(key), color: platformColor(key) }));

  // Valores por período: o resumo do índice + custo por resultado de cada plataforma.
  const rows: Values[] = entries.map((e) => {
    const v: Values = { ...e.summary };
    // Mesma regra do relatório do período: custo = investimento das campanhas COM resultado ÷ resultados.
    // Resumos antigos (sem a chave) caem no investimento da plataforma inteira.
    for (const p of platforms) {
      v[`platform.${p.key}.costPerResult`] = e.summary[`platform.${p.key}.costPerResult`] ?? safeDivide(e.summary[`platform.${p.key}.investment`], e.summary[`platform.${p.key}.results`]);
    }
    // Base do CTR: impressões das campanhas com cliques (resumos antigos: recupera pelo próprio CTR).
    v.clickImpressions = e.summary.clickImpressions ?? (isFiniteNumber(e.summary.ctr) && e.summary.ctr > 0 && isFiniteNumber(e.summary.clicks) ? e.summary.clicks / e.summary.ctr : e.summary.clicks === 0 ? (e.summary.impressions ?? null) : null);
    return v;
  });

  const resultTypes = [...new Set(entries.flatMap((e) => Object.keys(e.summary).flatMap((k) => /^result\.([a-z_]+)$/.exec(k)?.[1] ?? [])))];
  const singleType = resultTypes.length === 1 ? ResultTypeSchema.safeParse(resultTypes[0]).data ?? null : null;
  const resultsLabel = singleType ? (singleType === "other" ? (labelOf(entries, "result.other") ?? "Resultados") : RESULT_TYPE_LABEL[singleType].plural) : "Resultados";

  const totals: Values = {
    investment: sumKey(rows, "investment"),
    impressions: sumKey(rows, "impressions"),
    clicks: sumKey(rows, "clicks"),
    results: sumKey(rows, "results"),
    costPerResult: weightedRatio(rows, "costPerResult", "results"),
    ctr: ratioOfSums(rows, "clicks", "clickImpressions"),
    cpc: weightedRatio(rows, "cpc", "clicks"),
    cpm: (() => {
      const v = ratioOfSums(rows, "investment", "impressions");
      return v === null ? null : v * 1000;
    })(),
    attributedRevenue: sumKey(rows, "attributedRevenue"),
    roas: ratioOfSums(rows, "attributedRevenue", "investment"),
  };
  for (const p of platforms) {
    totals[`platform.${p.key}.investment`] = sumKey(rows, `platform.${p.key}.investment`);
    totals[`platform.${p.key}.results`] = sumKey(rows, `platform.${p.key}.results`);
    totals[`platform.${p.key}.costPerResult`] = weightedRatio(rows, `platform.${p.key}.costPerResult`, `platform.${p.key}.results`);
  }

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

  const kpis: KpiView[] = [kpi("investment", "investment", { label: "Investimento total", footnote: average("investment", (v) => formatCurrency(v, currency, { noCents: true })) })];
  if (totals.results !== null) {
    const byType =
      resultTypes.length > 1
        ? resultTypes
            .map((t) => ({ t, count: sumKey(rows, `result.${t}`) }))
            .filter((g): g is { t: string; count: number } => isFiniteNumber(g.count))
            .sort((a, b) => b.count - a.count)
            .map((g) => `${formatInteger(g.count)} ${lowerFirst(labelOf(entries, `result.${g.t}`) ?? "resultados")}`)
            .join(" · ")
        : null;
    kpis.push(kpi("results", "conversions", { label: resultsLabel, footnote: byType || average("results", (v) => formatInteger(v)) }));
    kpis.push(kpi("costPerResult", "cost", { label: singleType ? costPerLabel(resultsLabel) : "Custo por resultado" }));
  }
  kpis.push(kpi("impressions", "leads"));
  if (totals.results === null && totals.clicks !== null) kpis.push(kpi("clicks", "conversions"));

  const secondary: KpiView[] = [];
  const add = (key: MetricKey, icon: KpiIcon) => {
    if (totals[key] !== null && !kpis.some((k) => k.key === key)) secondary.push(kpi(key, icon));
  };
  add("clicks", "conversions");
  add("ctr", "rate");
  add("cpc", "cost");
  add("cpm", "cost");
  if (totals.attributedRevenue !== null) add("roas", "roas");

  const points: SeriesPoint[] = entries.map((e, i) => ({ key: e.periodKey, label: labels[i].axis, fullLabel: labels[i].full, values: rows[i] }));
  const hasPlatformSplit = platforms.length > 0 && rows.some((r) => platforms.some((p) => isFiniteNumber(r[`platform.${p.key}.investment`])));
  const split = (metric: "investment" | "results", format: "currency" | "integer"): SeriesDef[] =>
    hasPlatformSplit
      ? platforms.map((p) => ({ key: `platform.${p.key}.${metric}`, label: p.label, format, color: p.color }))
      : [{ key: metric, label: metric === "investment" ? "Investimento" : resultsLabel, format, slot: 1 }];

  const efficiencySeries: SeriesDef[] = (
    [
      { key: "costPerResult", label: singleType ? costPerLabel(resultsLabel) : "Custo por resultado", format: "currency" },
      { key: "ctr", label: "CTR", format: "percent" },
      { key: "cpc", label: "CPC", format: "currency" },
      { key: "cpm", label: "CPM", format: "currency" },
      { key: "clicks", label: "Cliques", format: "integer" },
      { key: "impressions", label: "Impressões", format: "integer" },
    ] satisfies SeriesDef[]
  ).filter((s) => rows.filter((r) => isFiniteNumber(r[s.key])).length >= 2);

  return {
    unit,
    count: entries.length,
    rangeLabel,
    headline: buildHeadline(totals, resultsLabel, rangeLabel, currency),
    resultsLabel,
    kpis,
    secondary,
    platforms,
    points,
    investmentSeries: split("investment", "currency"),
    resultsSeries: totals.results !== null ? split("results", "integer") : null,
    efficiencySeries,
    table: buildTable(entries, rows, totals, labels.map((l) => l.row), platforms, resultsLabel),
  };
}

function buildTable(entries: readonly ReportIndexEntry[], rows: Values[], totals: Values, rowLabels: string[], platforms: OverviewPlatform[], resultsLabel: string): PeriodTableData {
  const has = (key: string) => rows.some((r) => isFiniteNumber(r[key]));
  const pick = (columns: PeriodTableColumn[]) => columns.filter((c) => has(c.key));
  const core = (prefix: string, emphasis: boolean): PeriodTableColumn[] =>
    pick([
      { key: `${prefix}investment`, label: "Investimento", format: "currency", emphasis },
      { key: `${prefix}results`, label: resultsLabel, format: "integer", emphasis },
      { key: `${prefix}costPerResult`, label: "Custo", format: "currency" },
    ]);

  const groups: PeriodTableData["groups"] =
    platforms.length > 1
      ? [
          ...platforms.map((p) => ({ key: p.key, label: p.label, color: p.color, columns: core(`platform.${p.key}.`, false) })),
          { key: "total", label: "Total", columns: core("", true) },
        ]
      : [
          {
            key: "total",
            label: null,
            columns: [
              ...core("", true),
              ...pick([
                { key: "impressions", label: "Impressões", format: "integer" },
                { key: "clicks", label: "Cliques", format: "integer" },
                { key: "ctr", label: "CTR", format: "percent" },
              ]),
            ],
          },
        ];

  return {
    groups: groups.filter((g) => g.columns.length),
    rows: entries.map((e, i) => ({ key: e.periodKey, label: rowLabels[i], values: rows[i] })),
    total: totals,
  };
}

function buildHeadline(totals: Values, resultsLabel: string, span: string, currency: string): string {
  const invested = `${formatCurrency(totals.investment, currency, { noCents: true })} investidos`;
  if (isFiniteNumber(totals.results)) return `${span}: ${invested} e ${formatInteger(totals.results)} ${lowerFirst(resultsLabel)}.`;
  if (isFiniteNumber(totals.clicks)) return `${span}: ${invested} e ${formatInteger(totals.clicks)} cliques.`;
  return `${span}: ${invested}.`;
}
