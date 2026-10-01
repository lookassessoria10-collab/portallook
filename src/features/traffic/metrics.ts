import { safeDivide, sumMaybe } from "@/lib/metrics/safe-math";
import { isFiniteNumber } from "@/lib/format/number";
import type { ReportSummary } from "@/features/reports/schema";
import { PLATFORM_ORDER, platformLabel, resultTypeLabel, type Campaign, type ResultType, type TrafficData } from "./schema";

export interface CampaignMetrics extends Campaign {
  /** Cliques considerados nos cálculos: cliques gerais ou, na falta, cliques no link. */
  effectiveClicks: number | null;
  clicksSource: "clicks" | "linkClicks" | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  costPerResult: number | null;
  frequency: number | null;
  roas: number | null;
  resultLabel: string | null;
}

export function computeCampaignMetrics(c: Campaign): CampaignMetrics {
  const effectiveClicks = c.clicks ?? c.linkClicks ?? null;
  const clicksSource = c.clicks !== null ? "clicks" : c.linkClicks !== null ? "linkClicks" : null;
  return {
    ...c,
    effectiveClicks,
    clicksSource,
    ctr: safeDivide(effectiveClicks, c.impressions),
    cpc: safeDivide(c.investment, effectiveClicks),
    cpm: (() => {
      const v = safeDivide(c.investment, c.impressions);
      return v === null ? null : v * 1000;
    })(),
    costPerResult: safeDivide(c.investment, c.results),
    frequency: safeDivide(c.impressions, c.reach),
    roas: safeDivide(c.attributedRevenue, c.investment),
    resultLabel: c.results !== null || c.resultType !== null ? resultTypeLabel(c.resultType, c.results ?? 2, c.resultLabel) : null,
  };
}

export interface ResultGroup {
  type: ResultType;
  label: string;
  /** Rótulo no plural, para títulos e para o índice ("Conversas no WhatsApp", "Contatos"). */
  plural: string;
  count: number;
  investment: number;
  costPerResult: number | null;
  campaigns: number;
}

export interface TrafficTotals {
  investment: number;
  impressions: number;
  reach: number | null;
  clicks: number | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  results: number | null;
  costPerResult: number | null;
  /** Investimento só das campanhas com resultado (base do custo por resultado). */
  resultInvestment: number | null;
  /** Impressões só das campanhas com cliques (base do CTR). */
  clickImpressions: number | null;
  resultGroups: ResultGroup[];
  conversions: number | null;
  attributedRevenue: number | null;
  roas: number | null;
  campaignCount: number;
}

export function aggregateCampaigns(campaigns: readonly CampaignMetrics[]): TrafficTotals {
  const investment = sumMaybe(campaigns.map((c) => c.investment)) ?? 0;
  const impressions = sumMaybe(campaigns.map((c) => c.impressions)) ?? 0;
  const clicks = sumMaybe(campaigns.map((c) => c.effectiveClicks));
  const clickCampaigns = campaigns.filter((c) => c.effectiveClicks !== null);
  const clickInvestment = sumMaybe(clickCampaigns.map((c) => c.investment));
  const clickImpressions = sumMaybe(clickCampaigns.map((c) => c.impressions));

  const groups = new Map<ResultType, ResultGroup>();
  // Rótulo próprio ("Contatos") vale para o grupo quando todas as campanhas dele usam o mesmo.
  const customLabels = new Map<ResultType, Set<string | null>>();
  for (const c of campaigns) {
    if (!isFiniteNumber(c.results)) continue;
    const type = c.resultType ?? "other";
    const g = groups.get(type) ?? { type, label: "", plural: "", count: 0, investment: 0, costPerResult: null, campaigns: 0 };
    g.count += c.results;
    g.investment += c.investment;
    g.campaigns += 1;
    groups.set(type, g);
    customLabels.set(type, (customLabels.get(type) ?? new Set()).add(type === "other" ? c.resultLabel : null));
  }
  const resultGroups = [...groups.values()]
    .map((g) => {
      const custom = customLabels.get(g.type);
      const label = custom?.size === 1 ? [...custom][0] : null;
      return { ...g, label: resultTypeLabel(g.type, g.count, label), plural: resultTypeLabel(g.type, 2, label), costPerResult: safeDivide(g.investment, g.count) };
    })
    .sort((a, b) => b.count - a.count);

  const results = resultGroups.length ? resultGroups.reduce((s, g) => s + g.count, 0) : null;
  const resultInvestment = resultGroups.reduce((s, g) => s + g.investment, 0);
  const attributedRevenue = sumMaybe(campaigns.map((c) => c.attributedRevenue));
  const cpm = safeDivide(investment, impressions);

  return {
    investment,
    impressions,
    reach: sumMaybe(campaigns.map((c) => c.reach)),
    clicks,
    // CTR e CPC consideram apenas campanhas com cliques informados.
    ctr: safeDivide(clicks, clickImpressions),
    cpc: safeDivide(clickInvestment, clicks),
    cpm: cpm === null ? null : cpm * 1000,
    resultInvestment: resultGroups.length ? resultInvestment : null,
    clickImpressions,
    results,
    costPerResult: safeDivide(resultInvestment, results),
    resultGroups,
    conversions: sumMaybe(campaigns.map((c) => c.conversions)),
    attributedRevenue,
    roas: safeDivide(attributedRevenue, investment),
    campaignCount: campaigns.length,
  };
}

export interface PlatformView {
  platform: string;
  label: string;
  totals: TrafficTotals;
  campaigns: CampaignMetrics[];
  investmentShare: number | null;
}

export interface TrafficView {
  campaigns: CampaignMetrics[];
  totals: TrafficTotals;
  platforms: PlatformView[];
}

export function buildTrafficView(data: TrafficData): TrafficView {
  const campaigns = data.campaigns.map(computeCampaignMetrics).sort((a, b) => b.investment - a.investment);
  const totals = aggregateCampaigns(campaigns);
  const byPlatform = new Map<string, CampaignMetrics[]>();
  for (const c of campaigns) byPlatform.set(c.platform, [...(byPlatform.get(c.platform) ?? []), c]);
  const platforms = [...byPlatform.entries()]
    .map(([platform, list]) => {
      const t = aggregateCampaigns(list);
      return { platform, label: platformLabel(platform), totals: t, campaigns: list, investmentShare: safeDivide(t.investment, totals.investment) };
    })
    .sort((a, b) => {
      const ia = PLATFORM_ORDER.indexOf(a.platform);
      const ib = PLATFORM_ORDER.indexOf(b.platform);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || b.totals.investment - a.totals.investment;
    });
  return { campaigns, totals, platforms };
}

export function trafficSummary(data: TrafficData): { summary: ReportSummary; labels: Record<string, string> } {
  const { totals, platforms } = buildTrafficView(data);
  const summary: ReportSummary = {
    investment: totals.investment,
    impressions: totals.impressions,
    reach: totals.reach,
    clicks: totals.clicks,
    ctr: totals.ctr,
    cpc: totals.cpc,
    cpm: totals.cpm,
    results: totals.results,
    costPerResult: totals.costPerResult,
    resultInvestment: totals.resultInvestment,
    clickImpressions: totals.clickImpressions,
    conversions: totals.conversions,
    attributedRevenue: totals.attributedRevenue,
    roas: totals.roas,
    campaigns: totals.campaignCount,
  };
  const labels: Record<string, string> = {};
  for (const g of totals.resultGroups) {
    summary[`result.${g.type}`] = g.count;
    summary[`result.${g.type}.cost`] = g.costPerResult;
    labels[`result.${g.type}`] = g.plural;
  }
  for (const p of platforms) {
    summary[`platform.${p.platform}.investment`] = p.totals.investment;
    summary[`platform.${p.platform}.results`] = p.totals.results;
    summary[`platform.${p.platform}.costPerResult`] = p.totals.costPerResult;
    labels[`platform.${p.platform}`] = p.label;
  }
  return { summary, labels };
}
