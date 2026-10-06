import { isFiniteNumber } from "@/lib/format/number";
import { normalizeText } from "@/lib/ids";
import { safeDivide, sumMaybe } from "@/lib/metrics/safe-math";
import type { ReportSummary } from "@/features/reports/schema";
import { PLATFORM_ORDER, platformLabel, resultTypeLabel, type ResultType } from "@/features/traffic/schema";
import type { MediaPlanData, MediaPlanItem } from "./schema";

/** Metas de resultado agrupadas por tipo: leads com leads, conversas com conversas — nunca somadas entre si. */
export interface PlanResultGroup {
  key: string;
  type: ResultType | null;
  label: string;
  target: number;
  /** Verba das linhas que têm essa meta (base do custo esperado). */
  budget: number;
  costPerResult: number | null;
}

export interface PlanPlatform {
  platform: string;
  label: string;
  budget: number;
  share: number | null;
  itemCount: number;
  resultGroups: PlanResultGroup[];
}

export interface MediaPlanMetrics {
  budget: number;
  itemCount: number;
  platforms: PlanPlatform[];
  resultGroups: PlanResultGroup[];
  impressionsTarget: number | null;
  reachTarget: number | null;
  clicksTarget: number | null;
  firstDate: string | null;
  lastDate: string | null;
}

export function resultGroupKey(item: Pick<MediaPlanItem, "resultType" | "resultLabel">): string {
  const type = item.resultType ?? "other";
  return type === "other" ? `other-${normalizeText(item.resultLabel ?? "resultados").replace(/\s+/g, "-")}` : type;
}

function resultLabelOf(item: Pick<MediaPlanItem, "resultType" | "resultLabel">): string {
  return item.resultLabel ?? resultTypeLabel(item.resultType, 2);
}

/** Custo por resultado esperado da linha: o informado ou verba ÷ meta. */
export function itemCostPerResult(item: MediaPlanItem): number | null {
  return item.costPerResultTarget ?? safeDivide(item.budget, item.resultTarget);
}

function groupResults(items: readonly MediaPlanItem[]): PlanResultGroup[] {
  const groups = new Map<string, PlanResultGroup>();
  for (const item of items) {
    if (!isFiniteNumber(item.resultTarget)) continue;
    const key = resultGroupKey(item);
    const g = groups.get(key) ?? { key, type: item.resultType, label: resultLabelOf(item), target: 0, budget: 0, costPerResult: null };
    g.target += item.resultTarget;
    g.budget += item.budget;
    groups.set(key, g);
  }
  return [...groups.values()].map((g) => ({ ...g, costPerResult: safeDivide(g.budget, g.target) })).sort((a, b) => b.target - a.target);
}

function platformRank(platform: string): number {
  const i = PLATFORM_ORDER.indexOf(platform);
  return i === -1 ? 50 : i;
}

export function computeMediaPlanMetrics(data: MediaPlanData): MediaPlanMetrics {
  const budget = data.items.reduce((s, i) => s + i.budget, 0);
  const byPlatform = new Map<string, MediaPlanItem[]>();
  for (const item of data.items) byPlatform.set(item.platform, [...(byPlatform.get(item.platform) ?? []), item]);
  const platforms: PlanPlatform[] = [...byPlatform.entries()]
    .map(([platform, items]) => {
      const total = items.reduce((s, i) => s + i.budget, 0);
      return { platform, label: platformLabel(platform), budget: total, share: safeDivide(total, budget), itemCount: items.length, resultGroups: groupResults(items) };
    })
    .sort((a, b) => b.budget - a.budget || platformRank(a.platform) - platformRank(b.platform));
  const dates = data.items.flatMap((i) => [i.start, i.end]).filter((d): d is string => Boolean(d)).sort();
  return {
    budget,
    itemCount: data.items.length,
    platforms,
    resultGroups: groupResults(data.items),
    impressionsTarget: sumMaybe(data.items.map((i) => i.impressionsTarget)),
    reachTarget: sumMaybe(data.items.map((i) => i.reachTarget)),
    clicksTarget: sumMaybe(data.items.map((i) => i.clicksTarget)),
    firstDate: dates[0] ?? null,
    lastDate: dates.at(-1) ?? null,
  };
}

/** Indicadores gravados no índice: comparação com o plano anterior e "planejado × realizado" sem abrir o data.json. */
export function mediaPlanSummary(data: MediaPlanData): { summary: ReportSummary; labels: Record<string, string> } {
  const m = computeMediaPlanMetrics(data);
  const single = m.resultGroups.length === 1 ? m.resultGroups[0] : null;
  const summary: ReportSummary = {
    budget: m.budget,
    items: m.itemCount,
    platforms: m.platforms.length,
    resultTarget: single?.target ?? null,
    costPerResultTarget: single?.costPerResult ?? null,
    impressionsTarget: m.impressionsTarget,
    reachTarget: m.reachTarget,
    clicksTarget: m.clicksTarget,
  };
  const labels: Record<string, string> = {};
  if (single) labels.result = single.label;
  for (const p of m.platforms) {
    summary[`platform.${p.platform}.budget`] = p.budget;
    labels[`platform.${p.platform}`] = p.label;
  }
  for (const g of m.resultGroups) {
    summary[`result.${g.key}.target`] = g.target;
    labels[`result.${g.key}`] = g.label;
  }
  for (const goal of data.goals) {
    summary[`goal.${goal.key}`] = goal.value;
    labels[`goal.${goal.key}`] = goal.label;
  }
  for (const h of data.highlights) {
    summary[`highlight.${h.key}`] = h.value;
    labels[`highlight.${h.key}`] = h.label;
  }
  return { summary, labels };
}
