import { formatInteger, formatPercent, isFiniteNumber, type ValueFormat } from "@/lib/format/number";
import { compareValues, type Comparison } from "@/lib/metrics/comparison";
import { relativeChange } from "@/lib/metrics/safe-math";
import { formatPeriod, formatPeriodReference, periodUnit, type PeriodUnit } from "@/lib/dates/period";
import type { SeriesDef, SeriesPoint } from "@/components/charts/types";
import type { ReportIndexEntry } from "@/features/reports/schema";
import type { KpiIcon, KpiView } from "@/components/dashboard/kpi-types";
import type { ComparisonRow } from "@/features/traffic/view-model";
import { SOCIAL_METRICS, computeSocialMetrics, socialLabel, type InteractionSlice, type SocialKey } from "./metrics";
import { NETWORK_LABEL, type SocialData } from "./schema";

export interface SocialAudience {
  followers: number | null;
  newFollowers: number | null;
  lostFollowers: number | null;
  netFollowers: number | null;
  /** Variação do total de seguidores sobre o mês anterior (fração). */
  growth: number | null;
  previousFollowers: number | null;
}

export interface SocialViewModel {
  unit: PeriodUnit;
  networkLabel: string;
  headline: string;
  reference: string | null;
  kpis: KpiView[];
  secondary: KpiView[];
  audience: SocialAudience | null;
  interactions: { total: number | null; slices: Array<InteractionSlice & { comparison: Comparison | null }> } | null;
  comparisonRows: ComparisonRow[];
  trend: { points: SeriesPoint[]; series: SeriesDef[] } | null;
  extraMetrics: Array<{ key: string; label: string; value: number | null; comparison: Comparison | null }>;
  /** O que significa cada métrica que aparece no relatório. */
  glossary: Array<{ key: string; label: string; description: string }>;
}

interface Ctx {
  previous: ReportIndexEntry | null;
  history: ReportIndexEntry[];
}

const ICON: Record<SocialKey, KpiIcon> = {
  followers: "followers",
  newFollowers: "newFollowers",
  lostFollowers: "followers",
  netFollowers: "newFollowers",
  reach: "reach",
  views: "views",
  engagement: "engagement",
  engagementRate: "rate",
  profileVisits: "visits",
  interactions: "interactions",
  likes: "engagement",
  comments: "interactions",
  saves: "interactions",
  shares: "interactions",
  linkClicks: "clicks",
};

/** Ordem de leitura: audiência → alcance → engajamento → ações no perfil. */
const ROW_ORDER: SocialKey[] = ["followers", "newFollowers", "lostFollowers", "netFollowers", "reach", "views", "engagement", "engagementRate", "interactions", "likes", "comments", "saves", "shares", "profileVisits", "linkClicks"];

export const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${formatInteger(Math.abs(n))}`;

export function buildSocialViewModel(data: SocialData, ctx: Ctx): SocialViewModel {
  const { values, interactionSlices } = computeSocialMetrics(data);
  const reference = ctx.previous ? formatPeriodReference(ctx.previous.period) : null;
  const label = (key: SocialKey) => socialLabel(key, data.labels);
  const compare = (key: string, value: number | null): Comparison | null => {
    if (!ctx.previous) return null;
    const def = SOCIAL_METRICS[key as SocialKey];
    return compareValues(value, ctx.previous.summary[key] ?? null, { direction: def?.direction ?? "neutral", kind: def?.comparison ?? "relative" });
  };
  const kpi = (key: SocialKey, footnote: string | null = null): KpiView => ({
    key,
    label: label(key),
    value: values[key],
    format: SOCIAL_METRICS[key].format,
    comparison: compare(key, values[key]),
    trend: ctx.history.map((h) => h.summary[key] ?? null),
    description: SOCIAL_METRICS[key].description,
    footnote,
    icon: ICON[key],
  });

  const followersNote =
    isFiniteNumber(values.newFollowers) && isFiniteNumber(values.lostFollowers)
      ? `${signed(values.newFollowers)} novos · ${formatInteger(values.lostFollowers)} deixaram de seguir`
      : isFiniteNumber(values.newFollowers)
        ? `${signed(values.newFollowers)} novos no ${periodUnit(data.period.granularity).singular}`
        : null;
  const engagementNote = values.engagementRate !== null ? `${formatPercent(values.engagementRate)} das contas alcançadas` : null;
  const notes: Partial<Record<SocialKey, string | null>> = { followers: followersNote, engagement: engagementNote };

  // Destaques: seguidores, alcance, visualizações e engajamento — na falta de algum, o próximo da lista.
  const candidates: SocialKey[] = ["followers", "reach", "views", "engagement", "interactions", "newFollowers", "profileVisits", "linkClicks"];
  const kpiKeys = candidates.filter((k) => values[k] !== null).slice(0, 4);
  const kpis = kpiKeys.map((k) => kpi(k, notes[k] ?? null));
  const secondaryKeys: SocialKey[] = ["newFollowers", "lostFollowers", "engagementRate", "interactions", "profileVisits", "linkClicks"];
  const secondary = secondaryKeys.filter((k) => values[k] !== null && !kpiKeys.includes(k)).map((k) => kpi(k));

  const previousFollowers = ctx.previous?.summary.followers ?? null;
  const audience: SocialAudience | null = [values.followers, values.newFollowers, values.lostFollowers].some(isFiniteNumber)
    ? {
        followers: values.followers,
        newFollowers: values.newFollowers,
        lostFollowers: values.lostFollowers,
        netFollowers: values.netFollowers,
        growth: relativeChange(values.followers, previousFollowers),
        previousFollowers,
      }
    : null;

  const slicesTotal = interactionSlices.reduce((s, x) => s + x.value, 0);
  const interactions = slicesTotal > 0 ? { total: values.interactions, slices: interactionSlices.map((s) => ({ ...s, comparison: s.key === "other" ? null : compare(s.key, s.value) })) } : null;

  const comparisonRows: ComparisonRow[] = ROW_ORDER.filter((k) => values[k] !== null).map((k) => ({
    key: k,
    label: label(k),
    format: SOCIAL_METRICS[k].format as ValueFormat,
    current: values[k],
    previous: ctx.previous?.summary[k] ?? null,
    comparison: compare(k, values[k]),
  }));

  const present = ROW_ORDER.filter((k) => values[k] !== null);
  return {
    unit: periodUnit(data.period.granularity),
    networkLabel: NETWORK_LABEL[data.network],
    headline: buildHeadline(data, values, ctx.previous, reference),
    reference,
    kpis,
    secondary,
    audience,
    interactions,
    comparisonRows,
    trend: buildTrend(ctx.history, data.labels),
    extraMetrics: data.extraMetrics.map((e) => ({ ...e, comparison: ctx.previous ? compareValues(e.value, ctx.previous.summary[`extra.${e.key}`] ?? null, { direction: "neutral" }) : null })),
    glossary: present.map((k) => ({ key: k, label: label(k), description: SOCIAL_METRICS[k].description })),
  };
}

function buildTrend(history: ReportIndexEntry[], labels: Record<string, string>): SocialViewModel["trend"] {
  if (history.length < 2) return null;
  const points: SeriesPoint[] = history.map((h) => ({ key: h.periodKey, label: formatPeriod(h.period, "compact"), fullLabel: formatPeriod(h.period), values: h.summary }));
  const keys: SocialKey[] = ["followers", "newFollowers", "reach", "views", "engagement", "engagementRate", "interactions", "profileVisits", "linkClicks"];
  const series = keys
    .filter((k) => history.filter((h) => isFiniteNumber(h.summary[k])).length >= 2)
    .map((k) => ({ key: k, label: socialLabel(k, labels), format: SOCIAL_METRICS[k].format, slot: 1 as const }));
  return series.length ? { points, series } : null;
}

function joinPt(parts: string[]): string {
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} e ${parts.at(-1)}` : (parts[0] ?? "");
}

function buildHeadline(data: SocialData, v: Record<SocialKey, number | null>, previous: ReportIndexEntry | null, reference: string | null): string {
  const period = formatPeriod(data.period);
  const parts: string[] = [];
  if (isFiniteNumber(v.followers)) {
    const change = isFiniteNumber(v.netFollowers) ? ` (saldo de ${signed(v.netFollowers)})` : isFiniteNumber(v.newFollowers) ? ` (${signed(v.newFollowers)} novos)` : "";
    parts.push(`${formatInteger(v.followers)} seguidores${change}`);
  }
  if (isFiniteNumber(v.reach)) parts.push(`${formatInteger(v.reach)} contas alcançadas`);
  if (isFiniteNumber(v.interactions)) parts.push(`${formatInteger(v.interactions)} interações`);
  let sentence = parts.length ? `${period}: ${joinPt(parts)}.` : `${period}.`;
  if (previous && reference) {
    // A frase de comparação usa o alcance (ou, sem ele, as interações).
    const key = isFiniteNumber(v.reach) ? "reach" : "interactions";
    const c = compareValues(v[key], previous.summary[key] ?? null, { direction: "higherIsBetter" });
    if (c.status === "ok" && c.delta !== null) {
      const subject = key === "reach" ? "O alcance" : "As interações";
      const verb = key === "reach" ? (c.trend === "up" ? "cresceu" : "caiu") : c.trend === "up" ? "cresceram" : "caíram";
      sentence += ` ${subject} ${verb} ${formatPercent(Math.abs(c.delta))} em relação a ${reference}.`;
    }
  }
  return sentence;
}
