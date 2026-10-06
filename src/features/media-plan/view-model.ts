import { formatCurrency, formatInteger, formatValue, isFiniteNumber } from "@/lib/format/number";
import { costPerLabel, lowerFirst } from "@/lib/format/text";
import { compareValues, type Comparison } from "@/lib/metrics/comparison";
import { safeDivide } from "@/lib/metrics/safe-math";
import { diffDays, formatDate, formatPeriod, formatPeriodReference, periodDays, type Period } from "@/lib/dates/period";
import type { KpiView } from "@/features/commercial/view-model";
import type { ReportIndexEntry, ReportSummary } from "@/features/reports/schema";
import { platformColor } from "@/features/traffic/overview";
import { PLATFORM_LABEL, platformLabel, resultTypeLabel } from "@/features/traffic/schema";
import { computeMediaPlanMetrics, itemCostPerResult, type MediaPlanMetrics, type PlanResultGroup } from "./metrics";
import type { MediaPlanData, MediaPlanFigure, MediaPlanItem, MediaPlanSection } from "./schema";

/** Plataformas de mídia digital: as únicas que têm "realizado" no relatório de tráfego. */
const DIGITAL = new Set(Object.keys(PLATFORM_LABEL).filter((k) => k !== "other"));

const EXTRA_COLORS = ["var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-other)"];
/** Cores das campanhas na distribuição da verba (independentes da plataforma). */
const CAMPAIGN_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-other)"];

export interface FigureView extends MediaPlanFigure {
  /** Texto exibido: o que veio do arquivo ("60–125", "R$ 1.500") ou o número formatado. */
  text: string;
  comparison: Comparison | null;
}

export interface PlanPlatformView {
  platform: string;
  label: string;
  color: string;
  budget: number;
  share: number | null;
  itemCount: number;
  resultGroups: PlanResultGroup[];
  description: string | null;
  items: PlanItemView[];
}

export interface PlanItemView extends MediaPlanItem {
  platformLabel: string;
  color: string;
  share: number | null;
  costPerResult: number | null;
  resultText: string | null;
  dateLabel: string | null;
}

export interface PlanTimelineRow {
  id: string;
  name: string;
  platformLabel: string;
  color: string;
  offset: number;
  width: number;
  dateLabel: string;
}

export interface PlanExecutionRow {
  key: string;
  label: string;
  color: string | null;
  planned: number | null;
  actual: number | null;
  rate: number | null;
  format: "currency" | "integer";
}

export interface PlanExecution {
  status: "partial" | "closed";
  /** Verba de veículos sem relatório de tráfego (rádio, outdoor…): fica fora do comparativo. */
  offlineBudget: number;
  investment: PlanExecutionRow[];
  total: PlanExecutionRow;
  results: PlanExecutionRow[];
}

export interface MediaPlanViewModel {
  periodLabel: string;
  header: { title: string | null; tagline: string | null; summary: string | null; tags: string[] } | null;
  headline: string;
  reference: string | null;
  /** Resumo escrito pela Look (vazio = `kpis` calculados pelo sistema). */
  highlights: FigureView[];
  kpis: KpiView[];
  goals: FigureView[];
  platforms: PlanPlatformView[];
  /** Campanhas por verba, para a distribuição-base. */
  campaigns: PlanItemView[];
  timeline: { ticks: Array<{ label: string; offset: number }>; rows: PlanTimelineRow[] } | null;
  execution: PlanExecution | null;
  /** Mês já começou, mas o tráfego do mês ainda não foi publicado. */
  executionPending: boolean;
  topSections: MediaPlanSection[];
  bottomSections: MediaPlanSection[];
  /** Blocos de uma seção de conteúdo chamada "Metas…": aparecem junto das metas, sem repetir o título. */
  goalNotes: MediaPlanSection["blocks"];
  metrics: MediaPlanMetrics;
}

function shortDate(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

function dateLabel(item: MediaPlanItem): string | null {
  if (item.start && item.end) return item.start === item.end ? shortDate(item.start) : `${shortDate(item.start)} a ${shortDate(item.end)}`;
  if (item.start) return `a partir de ${shortDate(item.start)}`;
  if (item.end) return `até ${shortDate(item.end)}`;
  return null;
}

/** "120 leads", ou só o tipo ("Leads") quando a linha não tem meta numérica. */
function resultText(item: MediaPlanItem): string | null {
  if (!item.resultType && !item.resultLabel) return isFiniteNumber(item.resultTarget) ? `${formatInteger(item.resultTarget)} resultados` : null;
  const label = resultTypeLabel(item.resultType, 2, item.resultLabel);
  return isFiniteNumber(item.resultTarget) ? `${formatInteger(item.resultTarget)} ${lowerFirst(label)}` : label;
}

function figures(list: MediaPlanFigure[], prefix: string, previous: ReportSummary | null, currency: string): FigureView[] {
  return list.map((f) => ({
    ...f,
    text: f.display ?? formatValue(f.value, f.format, currency),
    comparison: previous && f.value !== null ? compareValues(f.value, previous[`${prefix}.${f.key}`] ?? null, { direction: "neutral", kind: f.format === "percent" ? "points" : "relative" }) : null,
  }));
}

export function buildMediaPlanViewModel(
  data: MediaPlanData,
  input: { previous: ReportIndexEntry | null; history: ReportIndexEntry[]; actual: ReportIndexEntry | null; today: string },
): MediaPlanViewModel {
  const m = computeMediaPlanMetrics(data);
  const reference = input.previous ? formatPeriodReference(input.previous.period) : null;
  const prev = input.previous?.summary ?? null;
  const trend = (key: string) => input.history.map((h) => h.summary[key] ?? null);
  const single = m.resultGroups.length === 1 ? m.resultGroups[0] : null;
  const sameResult = (g: PlanResultGroup) => Boolean(prev && prev[`result.${g.key}.target`] != null);

  const kpis: KpiView[] = [
    {
      key: "budget",
      label: "Investimento planejado",
      value: m.budget,
      format: "currency",
      comparison: prev ? compareValues(m.budget, prev.budget ?? null, { direction: "neutral" }) : null,
      trend: trend("budget"),
      description: "Soma da verba prevista para todas as campanhas e ações do mês.",
      icon: "investment",
    },
    {
      key: "items",
      label: "Campanhas e ações",
      value: m.itemCount,
      format: "integer",
      comparison: null,
      trend: [],
      description: "Cada campanha ou ação planejada.",
      footnote: m.platforms.length === 1 ? `em ${m.platforms[0].label}` : `em ${m.platforms.length} plataformas e veículos`,
      icon: "sales",
    },
  ];
  if (m.resultGroups.length) {
    const main = m.resultGroups[0];
    const others = m.resultGroups.slice(1);
    kpis.push({
      key: "resultTarget",
      label: `Meta de ${lowerFirst(main.label)}`,
      value: main.target,
      format: "integer",
      comparison: single && sameResult(single) ? compareValues(main.target, prev?.resultTarget ?? null, { direction: "higherIsBetter" }) : null,
      trend: single ? trend("resultTarget") : [],
      description: "Resultados esperados com a verba planejada.",
      footnote: others.length ? `Também: ${others.map((g) => `${formatInteger(g.target)} ${lowerFirst(g.label)}`).join(" · ")}` : null,
      icon: "conversions",
    });
    if (main.costPerResult !== null) {
      kpis.push({
        key: "costPerResultTarget",
        label: `${costPerLabel(main.label)} esperado`,
        value: main.costPerResult,
        format: "currency",
        comparison: single && sameResult(single) ? compareValues(main.costPerResult, prev?.costPerResultTarget ?? null, { direction: "lowerIsBetter" }) : null,
        trend: single ? trend("costPerResultTarget") : [],
        description: "Verba das campanhas com meta ÷ resultados esperados.",
        icon: "cost",
      });
    }
  }
  const daily = data.items.reduce((s, i) => (isFiniteNumber(i.dailyBudget) ? s + i.dailyBudget : s), 0);
  if (kpis.length < 4 && daily > 0) kpis.push({ key: "daily", label: "Verba diária", value: daily, format: "currency", comparison: null, trend: [], description: "Soma da verba diária das campanhas.", icon: "investment" });

  let extra = 0;
  const colorOf = new Map<string, string>();
  for (const p of m.platforms) colorOf.set(p.platform, DIGITAL.has(p.platform) ? platformColor(p.platform) : EXTRA_COLORS[Math.min(extra++, EXTRA_COLORS.length - 1)]);

  const byBudget = [...data.items].sort((a, b) => b.budget - a.budget);
  const campaignColor = new Map(byBudget.map((i, idx) => [i.id, CAMPAIGN_COLORS[Math.min(idx, CAMPAIGN_COLORS.length - 1)]]));
  const items: PlanItemView[] = data.items.map((i) => ({
    ...i,
    platformLabel: platformLabel(i.platform),
    color: campaignColor.get(i.id) ?? "var(--chart-other)",
    share: safeDivide(i.budget, m.budget),
    costPerResult: itemCostPerResult(i),
    resultText: resultText(i),
    dateLabel: dateLabel(i),
  }));
  const platforms: PlanPlatformView[] = m.platforms.map((p) => ({
    ...p,
    color: colorOf.get(p.platform) ?? "var(--chart-other)",
    description: data.platforms.find((x) => x.platform === p.platform)?.description ?? null,
    items: items.filter((i) => i.platform === p.platform).sort((a, b) => b.budget - a.budget),
  }));

  // Seção de conteúdo com o mesmo nome das metas: entra no bloco de metas.
  const goalSection = data.goals.length ? data.sections.find((s) => /^metas(-do-(ciclo|mes|plano))?$/.test(s.key)) : undefined;
  const sections = data.sections.filter((s) => s !== goalSection);
  const header = data.header;
  const tags = [...(header?.tags ?? [])];
  if (header?.updatedAt && !tags.some((t) => /atualiza/i.test(t))) tags.unshift(`Atualizado em ${formatDate(header.updatedAt)}`);

  return {
    periodLabel: formatPeriod(data.period),
    header: header && (header.title || header.tagline || header.summary || tags.length) ? { title: header.title, tagline: header.tagline, summary: header.summary, tags } : null,
    headline: buildHeadline(data, m),
    reference,
    highlights: figures(data.highlights, "highlight", prev, data.currency),
    kpis,
    goals: figures(data.goals, "goal", prev, data.currency),
    platforms,
    campaigns: items.slice().sort((a, b) => b.budget - a.budget),
    timeline: buildTimeline(data.period, items, colorOf),
    execution: buildExecution(data.period, m, platforms, input.actual, input.today),
    executionPending: !input.actual && input.today >= data.period.start,
    topSections: sections.filter((s) => s.placement === "top"),
    bottomSections: sections.filter((s) => s.placement !== "top"),
    goalNotes: goalSection?.blocks ?? [],
    metrics: m,
  };
}

function buildHeadline(data: MediaPlanData, m: MediaPlanMetrics): string {
  const where = m.platforms.length <= 3 ? m.platforms.map((p) => p.label).join(", ").replace(/, ([^,]+)$/, " e $1") : `${m.platforms.length} plataformas e veículos`;
  let sentence = `${formatPeriod(data.period)}: ${formatCurrency(m.budget, data.currency, { noCents: Number.isInteger(m.budget) })} planejados em ${m.itemCount} ${m.itemCount === 1 ? "campanha" : "campanhas e ações"} (${where})`;
  if (m.resultGroups.length) sentence += `, com meta de ${m.resultGroups.map((g) => `${formatInteger(g.target)} ${lowerFirst(g.label)}`).join(" e ")}`;
  return `${sentence}.`;
}

function buildTimeline(period: Period, items: PlanItemView[], colorOf: Map<string, string>): MediaPlanViewModel["timeline"] {
  if (!items.some((i) => i.start || i.end)) return null;
  const days = periodDays(period);
  const clamp = (iso: string) => (iso < period.start ? period.start : iso > period.end ? period.end : iso);
  const rows = [...items]
    .sort((a, b) => (a.start ?? period.start).localeCompare(b.start ?? period.start) || b.budget - a.budget)
    .map((i) => {
      const s = clamp(i.start ?? period.start);
      const e = clamp(i.end ?? period.end);
      return {
        id: i.id,
        name: i.name,
        platformLabel: i.platformLabel,
        color: colorOf.get(i.platform) ?? "var(--chart-other)",
        offset: (diffDays(s, period.start) / days) * 100,
        width: Math.max(((diffDays(e, s) + 1) / days) * 100, 2),
        dateLabel: i.dateLabel ?? "Mês inteiro",
      };
    });
  const ticks = [1, 8, 15, 22, 29].filter((d) => d <= days).map((d) => ({ label: String(d).padStart(2, "0"), offset: ((d - 1) / days) * 100 }));
  return { ticks, rows };
}

/**
 * Planejado × realizado: a verba de cada plataforma digital contra o investimento
 * do relatório de tráfego do mesmo mês (lido do índice, sem abrir o data.json).
 */
function buildExecution(period: Period, m: MediaPlanMetrics, platforms: PlanPlatformView[], actual: ReportIndexEntry | null, today: string): PlanExecution | null {
  if (!actual || today < period.start) return null;
  const s = actual.summary;
  const actualPlatforms = Object.keys(s).flatMap((k) => /^platform\.(.+)\.investment$/.exec(k)?.[1] ?? []);
  const keys = [...new Set([...platforms.filter((p) => DIGITAL.has(p.platform)).map((p) => p.platform), ...actualPlatforms])];
  const investment: PlanExecutionRow[] = keys.map((key) => {
    const planned = platforms.find((p) => p.platform === key)?.budget ?? null;
    const done = s[`platform.${key}.investment`] ?? null;
    return { key, label: actual.labels[`platform.${key}`] ?? platformLabel(key), color: platformColor(key), planned, actual: done, rate: safeDivide(done, planned), format: "currency" };
  });
  const plannedDigital = platforms.filter((p) => DIGITAL.has(p.platform)).reduce((sum, p) => sum + p.budget, 0);
  const total: PlanExecutionRow = { key: "total", label: "Total em mídia digital", color: null, planned: plannedDigital || null, actual: s.investment ?? null, rate: safeDivide(s.investment ?? null, plannedDigital || null), format: "currency" };
  const results: PlanExecutionRow[] = m.resultGroups
    .filter((g) => g.type && g.type !== "other" && s[`result.${g.type}`] != null)
    .map((g) => ({ key: g.key, label: g.label, color: null, planned: g.target, actual: s[`result.${g.type}`] ?? null, rate: safeDivide(s[`result.${g.type}`] ?? null, g.target), format: "integer" }));
  return { status: today > period.end ? "closed" : "partial", offlineBudget: m.budget - plannedDigital, investment, total, results };
}
