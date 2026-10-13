import { formatInteger, formatPercent, isFiniteNumber } from "@/lib/format/number";
import { averageKey, ratioOfSums, sumKey } from "@/lib/metrics/aggregate";
import { relativeChange } from "@/lib/metrics/safe-math";
import { formatPeriodRange, periodSeriesLabels, periodUnit, type PeriodUnit } from "@/lib/dates/period";
import type { SeriesDef, SeriesPoint } from "@/components/charts/types";
import type { PeriodTableColumn, PeriodTableData } from "@/components/dashboard/period-table";
import type { ReportIndexEntry } from "@/features/reports/schema";
import type { KpiIcon, KpiView } from "@/components/dashboard/kpi-types";
import { SOCIAL_METRICS, socialLabel, type SocialKey } from "./metrics";
import { signed } from "./view-model";

export interface SocialOverviewViewModel {
  unit: PeriodUnit;
  count: number;
  rangeLabel: string;
  headline: string;
  networkLabel: string;
  kpis: KpiView[];
  secondary: KpiView[];
  points: SeriesPoint[];
  /** Novos seguidores × deixaram de seguir, por período. */
  growthSeries: SeriesDef[] | null;
  /** Composição das interações (curtidas, comentários, salvamentos, compartilhamentos), por período. */
  interactionSeries: SeriesDef[] | null;
  /** Alcance e visualizações, por período. */
  audienceSeries: SeriesDef[] | null;
  trendSeries: SeriesDef[];
  table: PeriodTableData;
}

type Values = Record<string, number | null>;

function labelOf(entries: readonly ReportIndexEntry[], key: string): string | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    const label = entries[i].labels[key];
    if (label) return label;
  }
  return null;
}

/**
 * Visão geral de rede social a partir do resumo do índice (sem abrir o data.json).
 * Contagens do mês (novos seguidores, visualizações, interações…) são somadas;
 * seguidores é o total do último mês; alcance e engajamento são contas únicas de
 * cada mês, então aparecem como média — nunca somados. `entries` em ordem cronológica.
 */
/** `current`: a visão geral chega ao mês mais recente (false = um ano anterior escolhido no seletor). */
export function buildSocialOverview(entries: readonly ReportIndexEntry[], options: { current?: boolean } = {}): SocialOverviewViewModel {
  const last = entries[entries.length - 1];
  const unit = periodUnit(last.period.granularity);
  const labels = periodSeriesLabels(entries.map((e) => e.period));
  const rangeLabel = formatPeriodRange(entries[0].period, last.period);
  const rows: Values[] = entries.map((e) => ({ ...e.summary }));
  const names: Record<string, string> = {};
  for (const key of ["views", "linkClicks"]) {
    const l = labelOf(entries, key);
    if (l) names[key] = l;
  }
  const label = (key: SocialKey) => socialLabel(key, names);
  const per = `por ${unit.singular}`;

  const withFollowers = rows.map((r, i) => ({ v: r.followers, i })).filter((x): x is { v: number; i: number } => isFiniteNumber(x.v));
  const firstFollowers = withFollowers[0] ?? null;
  const lastFollowers = withFollowers.at(-1) ?? null;
  const followerGain = firstFollowers && lastFollowers && lastFollowers.i > firstFollowers.i ? lastFollowers.v - firstFollowers.v : null;

  const totals: Values = {
    followers: lastFollowers?.v ?? null,
    newFollowers: sumKey(rows, "newFollowers"),
    lostFollowers: sumKey(rows, "lostFollowers"),
    netFollowers: sumKey(rows, "netFollowers"),
    reach: averageKey(rows, "reach"),
    views: sumKey(rows, "views"),
    engagement: averageKey(rows, "engagement"),
    engagementRate: ratioOfSums(rows, "engagement", "reach"),
    interactions: sumKey(rows, "interactions"),
    likes: sumKey(rows, "likes"),
    comments: sumKey(rows, "comments"),
    saves: sumKey(rows, "saves"),
    shares: sumKey(rows, "shares"),
    profileVisits: sumKey(rows, "profileVisits"),
    linkClicks: sumKey(rows, "linkClicks"),
  };

  const average = (key: string) => {
    const v = averageKey(rows, key);
    return v === null ? null : `Média de ${formatInteger(v)} ${per}`;
  };
  const kpi = (key: SocialKey, icon: KpiIcon, overrides: Partial<KpiView> = {}): KpiView => ({
    key,
    label: overrides.label ?? label(key),
    value: totals[key] ?? null,
    format: SOCIAL_METRICS[key].format,
    comparison: null,
    trend: rows.map((r) => r[key] ?? null),
    description: overrides.description ?? SOCIAL_METRICS[key].description,
    footnote: overrides.footnote ?? null,
    icon,
  });

  const firstLabel = firstFollowers ? labels[firstFollowers.i].full.replace(/ de \d{4}$/, "").toLowerCase() : "";
  const gainNote =
    followerGain !== null && firstFollowers
      ? `${signed(followerGain)} desde ${firstLabel}${relativeChange(lastFollowers!.v, firstFollowers.v) !== null ? ` (${followerGain >= 0 ? "+" : "−"}${formatPercent(Math.abs(relativeChange(lastFollowers!.v, firstFollowers.v)!))})` : ""}`
      : null;
  const newNote = isFiniteNumber(totals.lostFollowers) && isFiniteNumber(totals.netFollowers) ? `${formatInteger(totals.lostFollowers)} deixaram de seguir · saldo de ${signed(totals.netFollowers)}` : average("newFollowers");

  const candidates: KpiView[] = [];
  if (totals.followers !== null) {
    // Ano anterior: o total é o do último mês daquele ano, não o de hoje.
    const label = options.current === false && lastFollowers ? `Seguidores em ${labels[lastFollowers.i].full.charAt(0).toLowerCase()}${labels[lastFollowers.i].full.slice(1)}` : "Seguidores hoje";
    candidates.push(kpi("followers", "followers", { label, description: "Total de seguidores no fim do último mês do período.", footnote: gainNote }));
  }
  if (totals.newFollowers !== null) candidates.push(kpi("newFollowers", "newFollowers", { description: "Novos seguidores somados em todos os meses.", footnote: newNote }));
  if (totals.reach !== null) candidates.push(kpi("reach", "reach", { label: `Alcance médio ${per}`, description: "Média de contas únicas alcançadas a cada mês (o alcance não é somado entre meses, porque a mesma conta pode ser alcançada em vários)." }));
  if (totals.interactions !== null) candidates.push(kpi("interactions", "interactions", { description: "Interações somadas em todos os meses.", footnote: average("interactions") }));
  if (candidates.length < 4 && totals.views !== null) candidates.push(kpi("views", "views", { footnote: average("views") }));
  if (candidates.length < 4 && totals.engagement !== null) candidates.push(kpi("engagement", "engagement", { label: `Engajamento médio ${per}` }));
  const kpis = candidates.slice(0, 4);

  const secondary: KpiView[] = [];
  const add = (key: SocialKey, icon: KpiIcon, overrides?: Partial<KpiView>) => {
    if (totals[key] !== null && !kpis.some((k) => k.key === key) && secondary.length < 5) secondary.push(kpi(key, icon, overrides));
  };
  add("views", "views", { description: `${SOCIAL_METRICS.views.description} Soma de todos os meses.` });
  add("engagementRate", "rate", { description: "Engajamento ÷ alcance, considerando todos os meses." });
  add("engagement", "engagement", { label: `Engajamento médio ${per}`, description: "Média de contas engajadas a cada mês." });
  add("profileVisits", "visits");
  add("linkClicks", "clicks");

  const has = (key: string) => rows.filter((r) => isFiniteNumber(r[key])).length >= 1;
  const points: SeriesPoint[] = entries.map((e, i) => ({ key: e.periodKey, label: labels[i].axis, fullLabel: labels[i].full, values: rows[i] }));

  const growthSeries: SeriesDef[] = [];
  if (has("newFollowers")) growthSeries.push({ key: "newFollowers", label: "Novos seguidores", format: "integer", slot: 1 });
  if (has("lostFollowers")) growthSeries.push({ key: "lostFollowers", label: "Deixaram de seguir", format: "integer", color: "var(--chart-other)" });

  const interactionSeries: SeriesDef[] = (["likes", "comments", "saves", "shares"] as const)
    .filter((k) => has(k))
    .map((k, i) => ({ key: k, label: SOCIAL_METRICS[k].label, format: "integer" as const, slot: (i + 1) as 1 | 2 | 3 | 4 }));

  const audienceSeries: SeriesDef[] = [];
  if (has("reach")) audienceSeries.push({ key: "reach", label: label("reach"), format: "integer", slot: 1 });
  if (has("views")) audienceSeries.push({ key: "views", label: label("views"), format: "integer", slot: 2 });

  const trendKeys: SocialKey[] = ["followers", "reach", "views", "engagement", "engagementRate", "interactions", "newFollowers", "profileVisits", "linkClicks"];
  const trendSeries: SeriesDef[] = trendKeys
    .filter((k) => rows.filter((r) => isFiniteNumber(r[k])).length >= 2)
    .map((k) => ({ key: k, label: label(k), format: SOCIAL_METRICS[k].format, slot: 1 as const }));

  const columns: PeriodTableColumn[] = (
    [
      { key: "followers", label: "Seguidores", format: "integer", emphasis: true },
      { key: "newFollowers", label: "Novos", format: "integer" },
      { key: "lostFollowers", label: "Perdas", format: "integer" },
      { key: "reach", label: label("reach"), format: "integer", emphasis: true },
      { key: "views", label: label("views"), format: "integer" },
      { key: "engagement", label: label("engagement"), format: "integer" },
      { key: "engagementRate", label: "Taxa de eng.", format: "percent" },
      { key: "interactions", label: label("interactions"), format: "integer", emphasis: true },
      { key: "profileVisits", label: "Visitas", format: "integer" },
      { key: "linkClicks", label: label("linkClicks"), format: "integer" },
    ] satisfies PeriodTableColumn[]
  ).filter((c) => has(c.key));

  // Linha Total: soma só o que é somável; seguidores, alcance e engajamento (contas únicas) ficam em branco.
  const tableTotal: Values = { ...totals, followers: null, reach: null, engagement: null };

  return {
    unit,
    count: entries.length,
    rangeLabel,
    headline: buildHeadline(rangeLabel, firstFollowers?.v ?? null, lastFollowers?.v ?? null, followerGain, totals),
    networkLabel: labelOf(entries, "network") ?? "Instagram",
    kpis,
    secondary,
    points,
    growthSeries: growthSeries.length ? growthSeries : null,
    interactionSeries: interactionSeries.length ? interactionSeries : null,
    audienceSeries: audienceSeries.length ? audienceSeries : null,
    trendSeries,
    table: {
      groups: [{ key: "total", label: null, columns }],
      rows: entries.map((e, i) => ({ key: e.periodKey, label: labels[i].row, values: rows[i] })),
      total: tableTotal,
    },
  };
}

function buildHeadline(range: string, first: number | null, last: number | null, gain: number | null, totals: Values): string {
  const parts: string[] = [];
  if (first !== null && last !== null && gain !== null) parts.push(`passou de ${formatInteger(first)} para ${formatInteger(last)} seguidores (${signed(gain)})`);
  else if (last !== null) parts.push(`chegou a ${formatInteger(last)} seguidores`);
  if (isFiniteNumber(totals.interactions)) parts.push(`somou ${formatInteger(totals.interactions)} interações`);
  if (isFiniteNumber(totals.reach)) parts.push(`alcançou, em média, ${formatInteger(totals.reach)} contas por mês`);
  if (!parts.length) return `${range}.`;
  const body = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} e ${parts.at(-1)}` : parts[0];
  return `${range}: o perfil ${body}.`;
}
